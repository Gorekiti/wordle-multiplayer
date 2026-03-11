const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let roomPlayers = {}; 
let roomTimers = {}; 
let roomScores = {}; 

const ROUND_TIME = 80; 
const CROC_WORDS = ['Телефон', 'Борщ', 'Программист', 'Гитара', 'Космос', 'Крыса', 'Университет', 'Пицца', 'Дракон', 'Скейтборд', 'Машина', 'Яблоко', 'Интернет', 'Наушники', 'Зеркало'];

io.on('connection', (socket) => {
    
    socket.on('getRooms', async () => {
        const { data: rooms } = await supabase.from('game_rooms').select('*').order('created_at', { ascending: false });
        const list = (rooms || []).map(r => ({
            ...r,
            currentCount: roomPlayers[r.room_id]?.length || 0
        }));
        socket.emit('roomsList', list);
    });

    socket.on('createRoom', async ({ mode, nickname }) => {
        const roomId = Math.random().toString(36).substring(2, 8);
        const max = mode === 'wordle' ? 2 : 10;
        
        roomPlayers[roomId] = [];
        roomScores[roomId] = {};
        
        // ВАЖНО: Ждем, пока комната точно запишется в БД!
        await supabase.from('game_rooms').insert([{ 
            room_id: roomId, mode: mode, max_players: max, status: 'waiting', creator_nick: nickname 
        }]);
        
        socket.emit('roomCreated', roomId);
    });

    socket.on('joinRoom', async ({ roomId, nickname }) => {
        const { data: room, error } = await supabase.from('game_rooms').select('*').eq('room_id', roomId).single();
        
        if (!room || error) {
            return socket.emit('joinError', 'Комната не найдена. Возможно, она была удалена.');
        }

        if (!roomPlayers[roomId]) roomPlayers[roomId] = [];
        if (!roomScores[roomId]) roomScores[roomId] = {};
        
        if (roomPlayers[roomId].length >= room.max_players) {
            return socket.emit('joinError', 'Комната уже заполнена!');
        }

        socket.join(roomId);
        socket.roomId = roomId;
        socket.nickname = nickname;
        
        roomPlayers[roomId].push({ id: socket.id, nick: nickname });
        if (roomScores[roomId][nickname] === undefined) roomScores[roomId][nickname] = 0;

        io.to(roomId).emit('chatMessage', { text: `Игрок ${nickname} присоединился.`, type: 'system-join' });
        broadcastRoomUpdate(roomId, room);

        if (room.mode === 'wordle' && roomPlayers[roomId].length === 2 && room.status === 'waiting') {
            startWordleRound(roomId);
        } else if (room.mode === 'croc' && roomPlayers[roomId].length >= 2 && room.status === 'waiting') {
            startCrocSelection(roomId);
        }
    });

    socket.on('drawing', (data) => socket.to(socket.roomId).emit('drawing', data));
    socket.on('clearCanvas', () => io.to(socket.roomId).emit('clearCanvas'));

    socket.on('wordChosen', async (word) => {
        await supabase.from('game_rooms').update({ secret_word: word, status: 'playing' }).eq('room_id', socket.roomId);
        io.to(socket.roomId).emit('gameStarted', { wordLength: word.length });
        startTimer(socket.roomId, () => {
            io.to(socket.roomId).emit('chatMessage', { text: `⏰ Время вышло! Слово: ${word}`, type: 'system-info' });
            startCrocSelection(socket.roomId);
        });
    });

    socket.on('setWord', async ({ roomId, word }) => {
        const wordUpper = word.toUpperCase();
        await supabase.from('game_rooms').update({ secret_word: wordUpper, status: 'playing', attempts_history: [] }).eq('room_id', roomId);
        io.to(roomId).emit('wordReady', { length: wordUpper.length });
        
        startTimer(roomId, () => {
            io.to(roomId).emit('gameOver', { winner: 'Время вышло', word: wordUpper });
            setTimeout(() => startWordleRound(roomId), 4000);
        });
    });

    socket.on('makeGuess', async ({ guess, nickname }) => {
        const { data: room } = await supabase.from('game_rooms').select('*').eq('room_id', socket.roomId).single();
        if (!room || nickname !== room.guesser_nick) return;

        const result = guess.split('').map((char, i) => {
            if (char === room.secret_word[i]) return 'correct';
            return room.secret_word.includes(char) ? 'present' : 'absent';
        });

        const newHistory = [...(room.attempts_history || []), { guess, result }];
        await supabase.from('game_rooms').update({ attempts_history: newHistory }).eq('room_id', socket.roomId);
        io.to(socket.roomId).emit('guessResult', { result, guess });

        if (guess === room.secret_word || newHistory.length >= 6) {
            if (guess === room.secret_word) {
                roomScores[socket.roomId][nickname] += 1;
                broadcastRoomUpdate(socket.roomId, room);
            }
            stopTimer(socket.roomId);
            io.to(socket.roomId).emit('gameOver', { winner: guess === room.secret_word ? nickname : 'Никто', word: room.secret_word });
            setTimeout(() => startWordleRound(socket.roomId), 5000);
        }
    });

    socket.on('chatMessage', async (text) => {
        const { data: room } = await supabase.from('game_rooms').select('*').eq('room_id', socket.roomId).single();
        if (!room) return;
        
        if (room.mode === 'croc' && room.status === 'playing' && socket.nickname !== room.setter_nick) {
            if (text.toLowerCase().trim() === room.secret_word?.toLowerCase()) {
                io.to(socket.roomId).emit('chatMessage', { text: `🎉 ${socket.nickname} угадал слово!`, type: 'system-win' });
                roomScores[socket.roomId][socket.nickname] += 1;
                broadcastRoomUpdate(socket.roomId, room);
                stopTimer(socket.roomId);
                return startCrocSelection(socket.roomId);
            }
        }
        io.to(socket.roomId).emit('chatMessage', { nick: socket.nickname, text });
    });

    socket.on('disconnect', async () => {
        const roomId = socket.roomId;
        if (roomId && roomPlayers[roomId]) {
            roomPlayers[roomId] = roomPlayers[roomId].filter(p => p.id !== socket.id);
            io.to(roomId).emit('chatMessage', { text: `Игрок ${socket.nickname} вышел.`, type: 'system-join' });
            
            if (roomPlayers[roomId].length === 0) {
                stopTimer(roomId);
                delete roomPlayers[roomId];
                delete roomScores[roomId];
                await supabase.from('game_rooms').delete().eq('room_id', roomId);
            } else {
                const { data: room } = await supabase.from('game_rooms').select('*').eq('room_id', roomId).single();
                broadcastRoomUpdate(roomId, room);
            }
        }
    });
});

function startTimer(roomId, onTimeout) {
    stopTimer(roomId);
    let timeLeft = ROUND_TIME;
    io.to(roomId).emit('timer', timeLeft);
    roomTimers[roomId] = setInterval(() => {
        timeLeft--;
        io.to(roomId).emit('timer', timeLeft);
        if (timeLeft <= 0) {
            stopTimer(roomId);
            onTimeout();
        }
    }, 1000);
}

function stopTimer(roomId) {
    if (roomTimers[roomId]) {
        clearInterval(roomTimers[roomId]);
        delete roomTimers[roomId];
    }
}

function broadcastRoomUpdate(roomId, room) {
    if (!roomScores[roomId]) return;
    const leaders = Object.keys(roomScores[roomId]).map(nick => ({
        nickname: nick, score: roomScores[roomId][nick]
    })).sort((a, b) => b.score - a.score);

    io.to(roomId).emit('roomUpdate', { 
        session: room, leaders, 
        activePlayers: roomPlayers[roomId]?.map(p => p.nick) || [],
        maxPlayers: room?.max_players || 0
    });
}

function startCrocSelection(roomId) {
    const players = roomPlayers[roomId];
    if (!players || players.length < 2) return;
    const setter = players[Math.floor(Math.random() * players.length)];
    const shuffled = [...CROC_WORDS].sort(() => 0.5 - Math.random());
    
    supabase.from('game_rooms').update({ setter_nick: setter.nick, status: 'waiting' }).eq('room_id', roomId).then();
    io.to(roomId).emit('crocSelection', { setter: setter.nick, options: shuffled.slice(0, 3) });
}

async function startWordleRound(roomId) {
    const players = roomPlayers[roomId];
    if (players.length < 2) return;
    const { data: room } = await supabase.from('game_rooms').select('setter_nick').eq('room_id', roomId).single();
    let setter = players[0].nick, guesser = players[1].nick;
    if (room?.setter_nick === setter) [setter, guesser] = [guesser, setter];
    
    await supabase.from('game_rooms').update({ setter_nick: setter, guesser_nick: guesser, status: 'setting', attempts_history: [], secret_word: null }).eq('room_id', roomId);
    io.to(roomId).emit('gameStart', { setter, guesser });
    
    startTimer(roomId, () => {
        io.to(roomId).emit('gameOver', { winner: 'Время вышло', word: 'Слово не загадано' });
        setTimeout(() => startWordleRound(roomId), 4000);
    });
}

server.listen(process.env.PORT || 3000);