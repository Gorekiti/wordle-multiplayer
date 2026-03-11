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
let roomLastSetter = {}; 
let roomChats = {}; 

const ROUND_TIME = 80; 

// === НОВЫЙ ОГРОМНЫЙ СЛОВАРЬ ===
const CROC_WORDS = [
    'люди', 'семья', 'музыка', 'идея', 'видео', 'страна', 'фильм', 'парень', 'девушка', 'писательство', 
    'цель', 'ночь', 'химия', 'местоположение', 'математика', 'дерево', 'президент', 'клетка', 'озеро', 
    'океан', 'кровь', 'вилка', 'нож', 'вращение', 'мим', 'высокий', 'орел', 'брекеты', 'солнечный свет', 
    'меч', 'одеяло', 'макияж', 'олень', 'брак', 'мотоцикл', 'сад', 'пальцы ног', 'локоть', 'корзина', 
    'значок', 'пузырь', 'доктор', 'воск', 'мед', 'песок', 'жук', 'ворон', 'солнцезащитные очки', 'календарь', 
    'салат', 'солнце', 'тост', 'арахис', 'омар', 'леденец', 'тупик', 'спам', 'электронная почта', 'высокий стул', 
    'хоккей', 'буррито', 'стетоскоп', 'рамка', 'упражнение на пресс', 'диван', 'марка', 'носок', 'гараж', 
    'зеленый', 'точка', 'шарф', 'веб-камера', 'мусорное ведро', 'лазер', 'шланг', 'кошелек', 'сумочка', 
    'перерыв', 'кольцо', 'текст', 'макароны', 'багаж', 'двухъярусная кровать', 'облако', 'цимбалы', 'бровь', 
    'ресница', 'палец', 'воронка', 'река', 'плечо', 'червь', 'багель', 'воздушный корабль', 'часы', 
    'перчатка', 'почта', 'тротуар', 'ворота', 'ведро', 'удочка', 'полотенце', 'замороженный десерт', 'желудок', 
    'таракан', 'дикобраз', 'кобра', 'платье', 'дверная ручка', 'гладильная доска', 'бобер', 'крыло', 'ямочка', 
    'бабочка', 'пила', 'язык', 'бутылка', 'груша', 'ковер', 'бумага', 'железная дорога', 'лед', 'сосна', 
    'молоко', 'шторы', 'кирпич', 'корндог', 'тарелка', 'флагшток', 'дым', 'парусная лодка', 'клоп', 'ручка', 
    'нож для открыток', 'такси', 'капот', 'дренаж', 'кузнец', 'вагонетка', 'зимняя рыбалка', 'положительный', 
    'мозговой штурм', 'душа', 'карта', 'интернет', 'блютуз', 'usb', 'камины', 'пень', 'подсолнух', 
    'морская лошадка', 'чемодан', 'овца', 'венок', 'цепь', 'лабиринт', 'флейта', 'светофор', 'серфборд', 
    'принтер', 'ананас', 'сом', 'свадебный торт', 'телепорт', 'молния', 'дом-баржа', 'машина времени', 'CD', 
    'ваза', 'выключатель', 'брецель', 'повязка на голову', 'цирк', 'объятие', 'степлер', 'арфа', 'сурок', 
    'роликовые коньки', 'золотая рыбка', 'лестница', 'почтовый ящик', 'попкорн', 'масло', 'клей', 'колыбель', 
    'американские горки', 'тачка', 'клоун', 'лампочка', 'кнопка', 'сильный', 'фотограф', 'шнурки', 'балет', 
    'аплодировать', 'отскок', 'диск', 'рыбалка', 'батут', 'водопад', 'блинчики', 'песчаная яма', 'гудеть', 
    'жилет', 'морковь', 'стрекоза', 'индюк', 'угорь', 'пожарный гидрант', 'кран', 'фейерверки', 'тыква', 
    'борода', 'песочный замок', 'бикини', 'снежинка', 'черная дыра', 'ремень безопасности', 'колесо обозрения', 
    'соска', 'магнит', 'шина', 'иглу', 'клубника', 'божья коровка', 'гоблин', 'солнечное затмение', 'люстра', 
    'космос', 'маска', 'аист', 'танец', 'фотография', 'WIFI', 'полнолуние', 'отжимания', 'ветка', 'ветер', 
    'аккумулятор', 'электричество', 'скачать', 'астронавт', 'обеденный лоток', 'сокровище', 'конфета в виде тростника', 
    'салфетка', 'лист', 'штрих-код', 'созвездие', 'капкейк', 'беременная', 'виртуальная реальность', 'пароль', 
    'забор', 'маяк', 'бумажная скрепка', 'жемчужное ожерелье', 'карандаш', 'солнечная система', 'зонт', 
    'северный полюс', 'пудель', 'лук', 'яблочный пирог', 'скат', 'ров', 'свеча', 'пазл', 'шторм', 'замок', 
    'Шерлок Холмс', 'Санта-Клаус', 'Кермит-лягушка', 'The Beatles', 'Рапунцель', 'Соник', 'Винни-Пух', 'Уолдо', 
    'Барби', 'Базз Лайтер', 'Ромео и Джульетта', 'Эйнштейн', 'Золушка', 'Марио', 'Сократ', 'Алиса в стране чудес', 
    'Скуби-Ду', 'Элмо', 'Пикачу', 'Винсент Ван Гог', 'Шекспир', 'Настольная игра', 'Тики-бар', 'Трофей', 
    'Барбекю', 'Кубик льда', 'Лиса', 'Динамит', 'Библиотека', 'Зомби', 'Страус', 'Пластилин', 'Скатерть', 
    'Пирог', 'Корневое пиво', 'Гонка', 'Бабушка', 'Лось'
];

async function broadcastRoomsList() {
    try {
        const { data: rooms, error } = await supabase.from('game_rooms').select('*').order('created_at', { ascending: false });
        if (error) {
            console.error("Ошибка БД при загрузке лобби:", error.message);
            return;
        }
        const list = (rooms || []).map(r => ({
            ...r,
            currentCount: roomPlayers[r.room_id]?.length || 0
        }));
        io.emit('roomsList', list);
    } catch (err) {
        console.error("Критическая ошибка лобби:", err.message);
    }
}

io.on('connection', (socket) => {
    socket.on('getRooms', broadcastRoomsList);

    socket.on('createRoom', async ({ mode, nickname }) => {
        try {
            const roomId = Math.random().toString(36).substring(2, 8);
            const max = mode === 'wordle' ? 2 : 10;
            
            roomPlayers[roomId] = [];
            roomScores[roomId] = {};
            roomChats[roomId] = []; 
            
            const { error } = await supabase.from('game_rooms').insert([{ 
                room_id: roomId, mode: mode, max_players: max, status: 'waiting', creator_nick: nickname 
            }]);
            
            if (error) return socket.emit('joinError', `Ошибка базы данных: ${error.message}`);
            
            socket.emit('roomCreated', roomId);
            broadcastRoomsList(); 
        } catch (err) {
            socket.emit('joinError', 'Внутренняя ошибка сервера.');
        }
    });

    socket.on('joinRoom', async ({ roomId, nickname }) => {
        try {
            const { data: room, error } = await supabase.from('game_rooms').select('*').eq('room_id', roomId).single();
            if (error || !room) return socket.emit('joinError', 'Комната не найдена.');

            if (!roomPlayers[roomId]) roomPlayers[roomId] = [];
            if (!roomScores[roomId]) roomScores[roomId] = {};
            if (!roomChats[roomId]) roomChats[roomId] = []; 
            
            if (roomPlayers[roomId].length >= room.max_players) return socket.emit('joinError', 'Комната уже заполнена!');

            socket.join(roomId);
            socket.roomId = roomId;
            socket.nickname = nickname;
            
            roomPlayers[roomId].push({ id: socket.id, nick: nickname });
            if (roomScores[roomId][nickname] === undefined) roomScores[roomId][nickname] = 0;

            await supabase.from('players').upsert({ nickname });

            socket.emit('chatHistory', roomChats[roomId]);

            const joinMsg = { text: `Игрок ${nickname} присоединился.`, type: 'system-join' };
            roomChats[roomId].push(joinMsg);
            io.to(roomId).emit('chatMessage', joinMsg);
            
            broadcastRoomUpdate(roomId, room);
            broadcastRoomsList(); 

            if (room.mode === 'wordle' && roomPlayers[roomId].length === 2 && room.status === 'waiting') {
                startWordleRound(roomId);
            } else if (room.mode === 'croc' && roomPlayers[roomId].length >= 2 && room.status === 'waiting') {
                startCrocSelection(roomId);
            }
        } catch (err) {
            socket.emit('joinError', 'Ошибка при входе в комнату.');
        }
    });

    socket.on('setWord', async ({ roomId, word }) => {
        const wordUpper = word.toUpperCase();
        await supabase.from('game_rooms').update({ 
            secret_word: wordUpper, status: 'playing', attempts_history: [] 
        }).eq('room_id', roomId);
        
        const { data: room } = await supabase.from('game_rooms').select('*').eq('room_id', roomId).single();
        io.to(roomId).emit('wordReady', { length: wordUpper.length, setter: room.setter_nick });
    });

    socket.on('makeGuess', async ({ roomId, guess, nickname }) => {
        const { data: room } = await supabase.from('game_rooms').select('*').eq('room_id', roomId).single();
        if (!room || nickname !== room.guesser_nick) return;

        const result = guess.split('').map((char, i) => {
            if (char === room.secret_word[i]) return 'correct';
            return room.secret_word.includes(char) ? 'present' : 'absent';
        });

        const newHistory = [...(room.attempts_history || []), { guess, result }];
        await supabase.from('game_rooms').update({ attempts_history: newHistory }).eq('room_id', roomId);
        io.to(roomId).emit('guessResult', { result, guess });

        if (guess === room.secret_word || newHistory.length >= 6) {
            if (guess === room.secret_word) {
                if (!roomScores[roomId]) roomScores[roomId] = {};
                if (!roomScores[roomId][nickname]) roomScores[roomId][nickname] = 0;
                roomScores[roomId][nickname] += 1;
                broadcastRoomUpdate(roomId, room);
            }
            io.to(roomId).emit('gameOver', { winner: guess === room.secret_word ? nickname : 'Никто', word: room.secret_word });
            setTimeout(() => startWordleRound(roomId), 6000);
        }
    });

    socket.on('drawing', (data) => socket.to(socket.roomId).emit('drawing', data));
    socket.on('clearCanvas', () => io.to(socket.roomId).emit('clearCanvas'));

    socket.on('wordChosen', async (word) => {
        await supabase.from('game_rooms').update({ secret_word: word, status: 'playing' }).eq('room_id', socket.roomId);
        io.to(socket.roomId).emit('gameStarted', { wordLength: word.length });
        
        startTimer(socket.roomId, async () => {
            const { data: r } = await supabase.from('game_rooms').select('setter_nick').eq('room_id', socket.roomId).single();
            await supabase.from('game_rooms').update({ status: 'ended' }).eq('room_id', socket.roomId);
            
            const infoMsg = { text: `⏰ Время вышло! Никто не угадал: ${word}`, type: 'system-info' };
            roomChats[socket.roomId].push(infoMsg);
            io.to(socket.roomId).emit('chatMessage', infoMsg);
            
            io.to(socket.roomId).emit('crocWin', { word: word, setter: r?.setter_nick || 'Неизвестно', winner: null });
            
            setTimeout(() => startCrocSelection(socket.roomId), 5000);
        });
    });

    socket.on('chatMessage', async (text) => {
        const { data: room } = await supabase.from('game_rooms').select('*').eq('room_id', socket.roomId).single();
        if (!room) return;
        
        if (room.mode === 'croc' && room.status === 'playing' && socket.nickname !== room.setter_nick) {
            if (text.toLowerCase().trim() === room.secret_word?.toLowerCase()) {
                
                const guessMsg = { nick: socket.nickname, text: text };
                roomChats[socket.roomId].push(guessMsg);
                io.to(socket.roomId).emit('chatMessage', guessMsg);

                await supabase.from('game_rooms').update({ status: 'ended' }).eq('room_id', socket.roomId);
                
                if (!roomScores[socket.roomId]) roomScores[socket.roomId] = {};
                if (!roomScores[socket.roomId][socket.nickname]) roomScores[socket.roomId][socket.nickname] = 0;
                
                roomScores[socket.roomId][socket.nickname] += 1;
                broadcastRoomUpdate(socket.roomId, room);
                stopTimer(socket.roomId);
                
                const winMsg = { text: `🎉 ${socket.nickname} угадал слово!`, type: 'system-win' };
                roomChats[socket.roomId].push(winMsg);
                io.to(socket.roomId).emit('chatMessage', winMsg);
                
                io.to(socket.roomId).emit('crocWin', { word: room.secret_word, setter: room.setter_nick, winner: socket.nickname });

                setTimeout(() => startCrocSelection(socket.roomId), 5000);
                return;
            }
        }
        
        const normalMsg = { nick: socket.nickname, text };
        roomChats[socket.roomId].push(normalMsg);
        io.to(socket.roomId).emit('chatMessage', normalMsg);
    });

    socket.on('disconnect', async () => {
        const roomId = socket.roomId;
        if (roomId && roomPlayers[roomId]) {
            roomPlayers[roomId] = roomPlayers[roomId].filter(p => p.id !== socket.id);
            
            const leaveMsg = { text: `Игрок ${socket.nickname} вышел.`, type: 'system-join' };
            if (roomChats[roomId]) roomChats[roomId].push(leaveMsg);
            io.to(roomId).emit('chatMessage', leaveMsg);
            
            if (roomPlayers[roomId].length === 0) {
                stopTimer(roomId);
                delete roomPlayers[roomId];
                delete roomScores[roomId];
                delete roomLastSetter[roomId];
                delete roomChats[roomId]; 
                await supabase.from('game_rooms').delete().eq('room_id', roomId);
            } else {
                const { data: room } = await supabase.from('game_rooms').select('*').eq('room_id', roomId).single();
                broadcastRoomUpdate(roomId, room);
            }
            broadcastRoomsList(); 
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
    
    let availablePlayers = players;
    if (roomLastSetter[roomId] && players.length > 1) {
        availablePlayers = players.filter(p => p.nick !== roomLastSetter[roomId]);
    }
    
    const setter = availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
    roomLastSetter[roomId] = setter.nick; 
    
    const shuffled = [...CROC_WORDS].sort(() => 0.5 - Math.random());
    
    supabase.from('game_rooms').update({ setter_nick: setter.nick, status: 'waiting' }).eq('room_id', roomId).then();
    io.to(roomId).emit('crocSelection', { setter: setter.nick, options: shuffled.slice(0, 3) });
}

async function startWordleRound(roomId) {
    const players = roomPlayers[roomId];
    if (players.length < 2) return;
    const { data: room } = await supabase.from('game_rooms').select('setter_nick').eq('room_id', roomId).single();
    
    let setter = players[0].nick;
    let guesser = players[1].nick;

    if (room && room.setter_nick === setter) {
        setter = players[1].nick;
        guesser = players[0].nick;
    }
    
    await supabase.from('game_rooms').update({ setter_nick: setter, guesser_nick: guesser, status: 'setting', attempts_history: [], secret_word: null }).eq('room_id', roomId);
    io.to(roomId).emit('gameStart', { mode: 'wordle', setter, guesser });
}

server.listen(process.env.PORT || 3000);