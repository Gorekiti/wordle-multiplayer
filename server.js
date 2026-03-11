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

let roomPlayers = {}; // { roomId: [{id, nick}, ...] }
const CROC_WORDS = ['Телефон', 'Борщ', 'Программист', 'Гитара', 'Космос', 'Крыса', 'Университет', 'Пицца'];

io.on('connection', (socket) => {
    
    // ЛОББИ: Отправка списка комнат
    socket.on('getRooms', async () => {
        const { data: rooms } = await supabase.from('game_rooms').select('*').order('created_at', { ascending: false });
        const list = rooms.map(r => ({
            ...r,
            currentCount: roomPlayers[r.room_id]?.length || 0
        }));
        socket.emit('roomsList', list);
    });

    // СОЗДАНИЕ КОМНАТЫ
    socket.on('createRoom', async ({ mode, nickname }) => {
        const roomId = Math.random().toString(36).substring(2, 8);
        const max = mode === 'wordle' ? 2 : 10;
        
        await supabase.from('game_rooms').insert([{ 
            room_id: roomId, mode, max_players: max, status: 'waiting' 
        }]);
        
        socket.emit('roomCreated', roomId);
    });

    // ВХОД В КОМНАТУ
    socket.on('joinRoom', async ({ roomId, nickname }) => {
        const { data: room } = await supabase.from('game_rooms').select('*').eq('room_id', roomId).single();
        if (!room) return socket.emit('error', 'Комната не найдена');

        const currentCount = roomPlayers[roomId]?.length || 0;
        if (currentCount >= room.max_players) return socket.emit('error', 'Комната полна');

        socket.join(roomId);
        socket.roomId = roomId;
        socket.nickname = nickname;

        if (!roomPlayers[roomId]) roomPlayers[roomId] = [];
        roomPlayers[roomId].push({ id: socket.id, nick: nickname });

        await supabase.from('players').upsert({ nickname });
        
        broadcastRoomUpdate(roomId);

        // Авто-старт для Вордли
        if (room.mode === 'wordle' && roomPlayers[roomId].length === 2 && room.status === 'waiting') {
            startWordleRound(roomId);
        }
    });

    // ЛОГИКА РИСОВАНИЯ (Крокодил)
    socket.on('drawing', (data) => {
        socket.to(socket.roomId).emit('drawing', data);
    });

    socket.on('clearCanvas', () => {
        io.to(socket.roomId).emit('clearCanvas');
    });

    // ЧАТ И ПРОВЕРКА СЛОВА
    socket.on('chatMessage', async (text) => {
        const { data: room } = await supabase.from('game_rooms').select('*').eq('room_id', socket.roomId).single();
        
        if (room.mode === 'croc' && room.status === 'playing' && socket.nickname !== room.current_drawer) {
            if (text.toLowerCase().trim() === room.secret_word.toLowerCase()) {
                io.to(socket.roomId).emit('chatMessage', { nick: 'Система', text: `🎉 ${socket.nickname} угадал слово!`, type: 'system' });
                return endCrocRound(socket.roomId, socket.nickname);
            }
        }
        io.to(socket.roomId).emit('chatMessage', { nick: socket.nickname, text });
    });

    // ВОРДЛИ: Ход игрока
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
            if (guess === room.secret_word) addScore(nickname);
            io.to(socket.roomId).emit('gameOver', { winner: guess === room.secret_word ? nickname : 'Никто', word: room.secret_word });
            setTimeout(() => startWordleRound(socket.roomId), 6000);
        }
    });

    socket.on('disconnect', () => {
        if (socket.roomId && roomPlayers[socket.roomId]) {
            roomPlayers[socket.roomId] = roomPlayers[socket.roomId].filter(p => p.id !== socket.id);
            broadcastRoomUpdate(socket.roomId);
        }
    });
});

async function addScore(nickname) {
    const { data: p } = await supabase.from('players').select('score').eq('nickname', nickname).single();
    await supabase.from('players').update({ score: (p?.score || 0) + 1 }).eq('nickname', nickname);
    const { data: leaders } = await supabase.from('players').select('nickname, score').order('score', { ascending: false }).limit(10);
    io.emit('globalLeaderUpdate', leaders);
}

async function broadcastRoomUpdate(roomId) {
    const { data: leaders } = await supabase.from('players').select('nickname, score').order('score', { ascending: false }).limit(10);
    const { data: room } = await supabase.from('game_rooms').select('*').eq('room_id', roomId).single();
    io.to(roomId).emit('roomUpdate', { 
        session: room, 
        leaders: leaders || [], 
        activePlayers: roomPlayers[roomId]?.map(p => p.nick) || []
    });
}

async function startWordleRound(roomId) {
    const players = roomPlayers[roomId];
    if (!players || players.length < 2) return;
    const { data: room } = await supabase.from('game_rooms').select('*').eq('room_id', roomId).single();
    let setter = players[0].nick, guesser = players[1].nick;
    if (room?.setter_nick === setter) [setter, guesser] = [guesser, setter];

    await supabase.from('game_rooms').update({
        setter_nick: setter, guesser_nick: guesser,
        status: 'setting', attempts_history: [], secret_word: null
    }).eq('room_id', roomId);
    io.to(roomId).emit('gameStart', { mode: 'wordle', setter, guesser });
}

server.listen(process.env.PORT || 3000);