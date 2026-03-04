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

io.on('connection', (socket) => {
    
    socket.on('joinRoom', async ({ roomId, nickname }) => {
        socket.join(roomId);
        
        // Регистрируем игрока
        await supabase.from('players').upsert({ nickname });
        
        // Проверяем/создаем комнату в базе
        let { data: room } = await supabase.from('game_rooms').select('*').eq('room_id', roomId).single();
        if (!room) {
            const { data: newRoom } = await supabase.from('game_rooms').insert([
                { room_id: roomId, status: 'waiting', attempts_history: [] }
            ]).select().single();
            room = newRoom;
        }

        // Получаем список игроков в этой конкретной комнате
        const clients = io.sockets.adapter.rooms.get(roomId);
        const numClients = clients ? clients.size : 0;

        // Рассылаем инфо о комнате
        io.to(roomId).emit('roomUpdate', {
            playersCount: numClients,
            session: room
        });

        // Если в комнате двое и она пуста — стартуем
        if (numClients === 2 && room.status === 'waiting') {
            startRoomRound(roomId);
        }
    });

    socket.on('setWord', async ({ roomId, word, nickname }) => {
        const wordUpper = word.toUpperCase();
        await supabase.from('game_rooms').update({
            secret_word: wordUpper,
            status: 'playing',
            attempts_history: []
        }).eq('room_id', roomId);

        io.to(roomId).emit('wordReady', { length: wordUpper.length, setter: nickname });
    });

    socket.on('makeGuess', async ({ roomId, guess, nickname }) => {
        const { data: room } = await supabase.from('game_rooms').select('*').eq('room_id', roomId).single();
        if (nickname !== room.guesser_nick) return;

        const result = guess.split('').map((char, i) => {
            if (char === room.secret_word[i]) return 'correct';
            if (room.secret_word.includes(char)) return 'present';
            return 'absent';
        });

        const newHistory = [...room.attempts_history, { guess, result }];
        await supabase.from('game_rooms').update({ attempts_history: newHistory }).eq('room_id', roomId);

        io.to(roomId).emit('guessResult', { result, guess });

        if (guess === room.secret_word) {
            // Обновляем счет в таблице игроков
            const { data: p } = await supabase.from('players').select('score').eq('nickname', nickname).single();
            await supabase.from('players').update({ score: (p?.score || 0) + 1 }).eq('nickname', nickname);
            
            io.to(roomId).emit('gameOver', { winner: nickname, word: room.secret_word });
            setTimeout(() => startRoomRound(roomId), 4000);
        }
    });
});

async function startRoomRound(roomId) {
    // Логика выбора кто загадывает (простая ротация)
    const { data: room } = await supabase.from('game_rooms').select('*').eq('room_id', roomId).single();
    
    // В реальности тут нужно брать ники активных сокетов, но для простоты:
    // Мы просто сбросим статус, чтобы игроки нажали "Готов" или назначим их
    // Для полноценной комнаты лучше передавать ники при joinRoom
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server live on ${PORT}`));