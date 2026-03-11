const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let roomPlayers = {}; // { roomId: [nick1, nick2] }

io.on('connection', (socket) => {
    socket.on('joinRoom', async ({ roomId, nickname }) => {
        socket.join(roomId);
        if (!roomPlayers[roomId]) roomPlayers[roomId] = [];
        if (!roomPlayers[roomId].includes(nickname)) roomPlayers[roomId].push(nickname);

        await supabase.from('players').upsert({ nickname });
        let { data: room } = await supabase.from('game_rooms').select('*').eq('room_id', roomId).single();
        
        if (!room) {
            const { data } = await supabase.from('game_rooms').insert([{ room_id: roomId, status: 'waiting' }]).select().single();
            room = data;
        }

        const { data: leaders } = await supabase.from('players').select('nickname, score').order('score', { ascending: false }).limit(10);
        io.to(roomId).emit('roomUpdate', { session: room, leaders });

        if (roomPlayers[roomId].length >= 2 && room.status === 'waiting') {
            startNewRound(roomId);
        }
    });

    socket.on('setWord', async ({ roomId, word, nickname }) => {
        await supabase.from('game_rooms').update({ secret_word: word, status: 'playing', attempts_history: [] }).eq('room_id', roomId);
        io.to(roomId).emit('wordReady', { length: word.length, setter: nickname });
    });

    socket.on('makeGuess', async ({ roomId, guess, nickname }) => {
        const { data: room } = await supabase.from('game_rooms').select('*').eq('room_id', roomId).single();
        const result = guess.split('').map((char, i) => {
            if (char === room.secret_word[i]) return 'correct';
            return room.secret_word.includes(char) ? 'present' : 'absent';
        });

        const newHistory = [...(room.attempts_history || []), { guess, result }];
        await supabase.from('game_rooms').update({ attempts_history: newHistory }).eq('room_id', roomId);
        
        io.to(roomId).emit('guessResult', { result, guess });

        if (guess === room.secret_word || newHistory.length >= 6) {
            if (guess === room.secret_word) {
                const { data: p } = await supabase.from('players').select('score').eq('nickname', nickname).single();
                await supabase.from('players').update({ score: (p?.score || 0) + 1 }).eq('nickname', nickname);
            }
            io.to(roomId).emit('gameOver', { winner: guess === room.secret_word ? nickname : 'Никто', word: room.secret_word });
            setTimeout(() => startNewRound(roomId), 6000);
        }
    });
});

async function startNewRound(roomId) {
    const players = roomPlayers[roomId];
    if (!players || players.length < 2) return;

    const { data: room } = await supabase.from('game_rooms').select('*').eq('room_id', roomId).single();
    
    // Меняем роли
    let setter = players[0];
    let guesser = players[1];
    if (room && room.setter_nick === players[0]) {
        setter = players[1];
        guesser = players[0];
    }

    await supabase.from('game_rooms').update({
        setter_nick: setter,
        guesser_nick: guesser,
        status: 'setting',
        attempts_history: [],
        secret_word: null
    }).eq('room_id', roomId);

    io.to(roomId).emit('gameStart', { setter, guesser });
}

server.listen(process.env.PORT || 3000);