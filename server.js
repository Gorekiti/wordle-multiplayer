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
let roomRegions = {};

const ROUND_TIME = 80; 

// СЛОВАРЬ 
const CROC_WORDS = {
    ru: [ 
        'кот', 'собака', 'пицца', 'телефон', 'ноутбук', 'зарядка', 'повербанк', 'ютуб', 'тикток', 'майнкрафт', 
        'роблокс', 'ксго', 'дота', 'симс', 'ведьмак', 'гта', 'аниме', 'манга', 'наруто', 'гарри поттер', 
        'сумерки', 'мстители', 'шаурма', 'пельмени', 'борщ', 'суши', 'кола', 'фанта', 'спрайт', 'энергетик', 
        'кофе', 'чай', 'школа', 'универ', 'экзамен', 'сессия', 'препод', 'общага', 'стипендия', 'диплом', 
        'шпаргалка', 'рюкзак', 'пенал', 'кроссовки', 'кеды', 'джинсы', 'футболка', 'куртка', 'шапка', 'кепка', 
        'носки', 'трусы', 'кровать', 'подушка', 'одеяло', 'диван', 'стул', 'стол', 'зеркало', 'окно', 
        'дверь', 'туалет', 'ванна', 'душ', 'шампунь', 'мыло', 'зубная щетка', 'паста', 'расческа', 'фен', 
        'утюжок', 'плойка', 'помада', 'тушь', 'духи', 'дезодорант', 'автобус', 'метро', 'такси', 'самолет', 
        'поезд', 'велосипед', 'самокат', 'скейт', 'ролики', 'коньки', 'лыжи', 'сноуборд', 'мяч', 'ракетка', 
        'гитара', 'пианино', 'барабаны', 'скрипка', 'микрофон', 'наушники', 'колонка', 'телевизор', 'пульт', 
        'мышка', 'клавиатура', 'монитор', 'флешка', 'принтер', 'камера', 'штатив', 'кольцевая лампа', 'блогер', 
        'стример', 'геймер', 'киберспорт', 'донат', 'лайк', 'подписка', 'коммент', 'репост', 'бан', 'спам', 
        'мем', 'тролль', 'хейтер', 'краш', 'симп', 'вайб', 'чилл', 'флекс', 'рофл', 'пранк', 'фейспалм', 
        'кринж', 'база', 'имба', 'жиза', 'дед инсайд', 'альтушка', 'скуф', 'масик', 'тюбик', 'штрих', 
        'чечик', 'нормис', 'пикми', 'вумен', 'мэн', 'сигма', 'гигачад', 'вупсень', 'пупсень', 'шрек', 
        'осел', 'фиона', 'кот в сапогах', 'дракон', 'мадагаскар', 'ледниковый период', 'пингвины', 'лев', 'зебра', 
        'жираф', 'бегемот', 'обезьяна', 'банан', 'яблоко', 'груша', 'апельсин', 'мандарин', 'лимон', 'арбуз', 
        'дыня', 'клубника', 'малина', 'вишня', 'черешня', 'виноград', 'персик', 'абрикос', 'слива', 'картошка', 
        'огурец', 'помидор', 'лук', 'чеснок', 'морковка', 'свекла', 'капуста', 'перец', 'соль', 'сахар', 
        'перец чили', 'сыр', 'колбаса', 'сосиски', 'бекон', 'мясо', 'курица', 'рыба', 'яйцо', 'молоко', 
        'кефир', 'йогурт', 'творог', 'сметана', 'сливочное масло', 'подсолнечное масло', 'хлеб', 'батон', 'булочка', 
        'пирожок', 'торт', 'пирожное', 'печенье', 'шоколад', 'конфета', 'мармелад', 'зефир', 'мороженое', 'леденец', 
        'чупа-чупс', 'сникерс', 'твикс', 'марс', 'баунти', 'милки вэй', 'киткат', 'эмэндэмс', 'скитлс', 'орбит', 
        'спать', 'бегать', 'прыгать', 'плавать', 'летать', 'петь', 'танцевать', 'рисовать', 'читать', 'писать', 
        'смотреть', 'слушать', 'говорить', 'кричать', 'смеяться', 'плакать', 'улыбаться', 'грустить', 'злиться', 
        'бояться', 'удивляться', 'любить', 'ненавидеть', 'обнимать', 'целовать', 'драться', 'кусать', 'царапать', 
        'пинать', 'толкать', 'тянуть', 'кидать', 'ловить', 'врач', 'повар', 'полицейский', 'пожарный', 'учитель', 
        'водитель', 'пилот', 'космонавт', 'актер', 'певец', 'художник', 'писатель', 'программист', 'строитель', 
        'продавец', 'кассир', 'парикмахер', 'мастер маникюра', 'больница', 'поликлиника', 'ресторан', 'кафе', 
        'макдональдс', 'магазин', 'супермаркет', 'торговый центр', 'кинотеатр', 'театр', 'музей', 'выставка', 
        'парк', 'лес', 'горы', 'море', 'пляж', 'река', 'бассейн', 'стадион', 'спортзал', 'фитнес', 'аптека', 
        'аптечка', 'таблетки', 'бинт', 'пластырь', 'укол', 'градусник', 'температура', 'кашель', 'насморк'
    ],
    ua: [ 
        'кіт', 'собака', 'піца', 'телефон', 'ноутбук', 'зарядка', 'повербанк', 'ютуб', 'тікток', 'майнкрафт', 
        'роблокс', 'ксго', 'дота', 'сімс', 'відьмак', 'гта', 'аніме', 'манга', 'наруто', 'гаррі поттер', 
        'сутінки', 'месники', 'шаурма', 'пельмені', 'борщ', 'суші', 'кола', 'фанта', 'спрайт', 'енергетик', 
        'кава', 'чай', 'школа', 'універ', 'екзамен', 'сесія', 'викладач', 'гуртожиток', 'стипендія', 'диплом', 
        'шпора', 'рюкзак', 'пенал', 'кросівки', 'кеди', 'джинси', 'футболка', 'куртка', 'шапка', 'кепка', 
        'шкарпетки', 'труси', 'ліжко', 'подушка', 'ковдра', 'диван', 'стілець', 'стіл', 'дзеркало', 'вікно', 
        'двері', 'туалет', 'ванна', 'душ', 'шампунь', 'мило', 'зубна щітка', 'паста', 'гребінець', 'фен', 
        'праска', 'плойка', 'помада', 'туш', 'парфуми', 'дезодорант', 'автобус', 'метро', 'таксі', 'літак', 
        'поїзд', 'велосипед', 'самокат', 'скейт', 'ролики', 'ковзани', 'лижі', 'сноуборд', 'м\'яч', 'ракетка', 
        'гітара', 'піаніно', 'барабани', 'скрипка', 'мікрофон', 'навушники', 'колонка', 'телевізор', 'пульт', 
        'мишка', 'клавіатура', 'монітор', 'флешка', 'принтер', 'камера', 'штатив', 'кільцева лампа', 'блогер', 
        'стрімер', 'геймер', 'кіберспорт', 'донат', 'лайк', 'підписка', 'комент', 'репост', 'бан', 'спам', 
        'мем', 'троль', 'хейтер', 'краш', 'сімп', 'вайб', 'чил', 'флекс', 'рофл', 'пранк', 'фейспалм', 
        'крінж', 'база', 'імба', 'жиза', 'дід інсайд', 'альтушка', 'скуф', 'масік', 'тюбік', 'штрих', 
        'чечік', 'норміс', 'пікмі', 'вумен', 'мен', 'сігма', 'гігачад', 'вупсень', 'пупсень', 'шрек', 
        'віслюк', 'фіона', 'кіт у чоботях', 'дракон', 'мадагаскар', 'льодовиковий період', 'пінгвіни', 'лев', 'зебра', 
        'жираф', 'бегемот', 'мавпа', 'банан', 'яблуко', 'груша', 'апельсин', 'мандарин', 'лимон', 'кавун', 
        'диня', 'полуниця', 'малина', 'вишня', 'черешня', 'виноград', 'персик', 'абрикос', 'слива', 'картопля', 
        'огірок', 'помідор', 'цибуля', 'часник', 'морква', 'буряк', 'капуста', 'перець', 'сіль', 'цукор', 
        'перець чилі', 'сир', 'ковбаса', 'сосиски', 'бекон', 'м\'ясо', 'курка', 'риба', 'яйце', 'молоко', 
        'кефір', 'йогурт', 'сметана', 'вершкове масло', 'соняшникова олія', 'хліб', 'батон', 'булочка', 
        'пиріжок', 'торт', 'тістечко', 'печиво', 'шоколад', 'цукерка', 'мармелад', 'зефір', 'морозиво', 'льодяник', 
        'чупа-чупс', 'снікерс', 'твікс', 'марс', 'баунті', 'мілкі вей', 'кіткат', 'емендемс', 'скітлс', 'орбіт', 
        'спати', 'бігати', 'стрибати', 'плавати', 'літати', 'співати', 'танцювати', 'малювати', 'читати', 'писати', 
        'дивитися', 'слухати', 'говорити', 'кричати', 'сміятися', 'плакати', 'посміхатися', 'сумувати', 'злитися', 
        'боятися', 'дивуватися', 'любити', 'ненавидіти', 'обіймати', 'цілувати', 'битися', 'кусати', 'дряпати', 
        'штовхати', 'тягнути', 'кидати', 'ловити', 'лікар', 'кухар', 'поліцейський', 'пожежник', 'вчитель', 
        'водій', 'пілот', 'космонавт', 'актор', 'співак', 'художник', 'письменник', 'програміст', 'будівельник', 
        'продавець', 'касир', 'перукар', 'майстер манікюру', 'лікарня', 'поліклініка', 'ресторан', 'кафе', 
        'макдональдс', 'магазин', 'супермаркет', 'торговий центр', 'кінотеатр', 'театр', 'музей', 'виставка', 
        'парк', 'ліс', 'гори', 'море', 'пляж', 'річка', 'басейн', 'стадіон', 'спортзал', 'фітнес', 'аптека', 
        'аптечка', 'таблетки', 'бинт', 'пластир', 'укол', 'градусник', 'температура', 'кашель', 'нежить'
    ],
    en: [ 
        'cat', 'dog', 'pizza', 'phone', 'laptop', 'charger', 'powerbank', 'youtube', 'tiktok', 'minecraft', 
        'roblox', 'csgo', 'dota', 'sims', 'witcher', 'gta', 'anime', 'manga', 'naruto', 'harry potter', 
        'twilight', 'avengers', 'shawarma', 'dumplings', 'borsch', 'sushi', 'cola', 'fanta', 'sprite', 'energy drink', 
        'coffee', 'tea', 'school', 'university', 'exam', 'finals', 'professor', 'dorm', 'scholarship', 'diploma', 
        'cheat sheet', 'backpack', 'pencil case', 'sneakers', 'converse', 'jeans', 't-shirt', 'jacket', 'beanie', 'cap', 
        'socks', 'underwear', 'bed', 'pillow', 'blanket', 'sofa', 'chair', 'table', 'mirror', 'window', 
        'door', 'toilet', 'bath', 'shower', 'shampoo', 'soap', 'toothbrush', 'toothpaste', 'comb', 'hairdryer', 
        'straightener', 'curling iron', 'lipstick', 'mascara', 'perfume', 'deodorant', 'bus', 'subway', 'taxi', 'airplane', 
        'train', 'bicycle', 'scooter', 'skateboard', 'roller skates', 'ice skates', 'skis', 'snowboard', 'ball', 'racket', 
        'guitar', 'piano', 'drums', 'violin', 'microphone', 'headphones', 'speaker', 'tv', 'remote', 
        'mouse', 'keyboard', 'monitor', 'flash drive', 'printer', 'camera', 'tripod', 'ring light', 'blogger', 
        'streamer', 'gamer', 'esports', 'donate', 'like', 'subscribe', 'comment', 'repost', 'ban', 'spam', 
        'meme', 'troll', 'hater', 'crush', 'simp', 'vibe', 'chill', 'flex', 'rofl', 'prank', 'facepalm', 
        'cringe', 'based', 'op', 'relatable', 'dead inside', 'alt girl', 'boomer', 'normie', 'pick me', 
        'women', 'men', 'sigma', 'gigachad', 'shrek', 'donkey', 'fiona', 'puss in boots', 'dragon', 'madagascar', 'ice age', 'penguins', 'lion', 'zebra', 
        'giraffe', 'hippo', 'monkey', 'banana', 'apple', 'pear', 'orange', 'tangerine', 'lemon', 'watermelon', 
        'melon', 'strawberry', 'raspberry', 'cherry', 'grapes', 'peach', 'apricot', 'plum', 'potato', 
        'cucumber', 'tomato', 'onion', 'garlic', 'carrot', 'beet', 'cabbage', 'pepper', 'salt', 'sugar', 
        'chili pepper', 'cheese', 'sausage', 'hot dog', 'bacon', 'meat', 'chicken', 'fish', 'egg', 'milk', 
        'kefir', 'yogurt', 'cottage cheese', 'sour cream', 'butter', 'oil', 'bread', 'loaf', 'bun', 
        'pie', 'cake', 'pastry', 'cookies', 'chocolate', 'candy', 'marmalade', 'marshmallow', 'ice cream', 'lollipop', 
        'chupa chups', 'snickers', 'twix', 'mars', 'bounty', 'milky way', 'kitkat', 'm&ms', 'skittles', 'orbit', 
        'sleep', 'run', 'jump', 'swim', 'fly', 'sing', 'dance', 'draw', 'read', 'write', 
        'watch', 'listen', 'speak', 'yell', 'laugh', 'cry', 'smile', 'sad', 'angry', 
        'scared', 'surprised', 'love', 'hate', 'hug', 'kiss', 'fight', 'bite', 'scratch', 
        'kick', 'push', 'pull', 'throw', 'catch', 'doctor', 'chef', 'police officer', 'firefighter', 'teacher', 
        'driver', 'pilot', 'astronaut', 'actor', 'singer', 'artist', 'writer', 'programmer', 'builder', 
        'seller', 'cashier', 'hairdresser', 'nail technician', 'hospital', 'clinic', 'restaurant', 'cafe', 
        'mcdonalds', 'shop', 'supermarket', 'mall', 'cinema', 'theater', 'museum', 'exhibition', 
        'park', 'forest', 'mountains', 'sea', 'beach', 'river', 'pool', 'stadium', 'gym', 'fitness', 'pharmacy', 
        'first aid kit', 'pills', 'bandage', 'band-aid', 'injection', 'thermometer', 'temperature', 'cough', 'runny nose'
    ]
};

// СЛОВАРЬ СИСТЕМНЫХ СООБЩЕНИЙ
const SYS_MSG = {
    ru: { join: n => `Игрок ${n} присоединился.`, leave: n => `Игрок ${n} вышел.`, win: n => `🎉 ${n} угадал слово!`, time: w => `⏰ Время вышло! Никто не угадал: ${w}`, stop: "Недостаточно игроков. Игра остановлена." },
    ua: { join: n => `Гравець ${n} приєднався.`, leave: n => `Гравець ${n} вийшов.`, win: n => `🎉 ${n} вгадав слово!`, time: w => `⏰ Час вийшов! Ніхто не вгадав: ${w}`, stop: "Замало гравців. Гру зупинено." },
    en: { join: n => `Player ${n} joined.`, leave: n => `Player ${n} left.`, win: n => `🎉 ${n} guessed the word!`, time: w => `⏰ Time's up! No one guessed: ${w}`, stop: "Not enough players. Game stopped." }
};

async function broadcastRoomsList() {
    try {
        const { data: rooms, error } = await supabase.from('game_rooms').select('*').order('created_at', { ascending: false });
        
        if (error) {
            console.error("Ошибка БД:", error.message);
            io.emit('roomsList', []); // Важно: отправляем пустой массив
            return;
        }
        
       const list = (rooms || []).map(r => ({
    ...r,
    region: roomRegions[r.room_id] || 'ua',
    currentCount: roomPlayers[r.room_id] ? roomPlayers[r.room_id].length : 0
}));
        
        io.emit('roomsList', list);
    } catch (err) {
        io.emit('roomsList', []);
    }
}

// === Очистка "мертвых" комнат при запуске сервера ===
async function cleanupOldRooms() {
    try {
        // Удаляем записи, где room_id не пустой
        const { error } = await supabase.from('game_rooms').delete().not('room_id', 'is', null);
        if (error) throw error;
        console.log("🧹 База комнат успешно очищена");
    } catch (err) {
        console.error("Ошибка при очистке:", err.message);
    }
}
cleanupOldRooms();

io.on('connection', (socket) => {
    socket.on('getRooms', broadcastRoomsList);

    socket.on('createRoom', async ({ mode, nickname, region }) => {
        try {
            const roomId = Math.random().toString(36).substring(2, 8);
            const max = mode === 'wordle' ? 2 : 10;
            
            roomPlayers[roomId] = [];
            roomScores[roomId] = {};
            roomChats[roomId] = []; 
            roomRegions[roomId] = region || 'ua';
            
            const { error } = await supabase.from('game_rooms').insert([{ 
                 room_id: roomId, mode: mode, max_players: max, status: 'waiting', creator_nick: nickname, region: region 
            }]).then();
            
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

            const reg = room.region || 'ua';
            const joinMsg = { text: SYS_MSG[reg].join(nickname), type: 'system-join' };
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
        io.to(socket.roomId).emit('gameStarted');
        
        startTimer(socket.roomId, async () => {
            const { data: r } = await supabase.from('game_rooms').select('setter_nick').eq('room_id', socket.roomId).single();
            await supabase.from('game_rooms').update({ status: 'ended' }).eq('room_id', socket.roomId);
            
            const reg = roomRegions[socket.roomId] || 'ua';
            const infoMsg = { text: SYS_MSG[reg].time(word), type: 'system-info' };
            roomChats[socket.roomId].push(infoMsg);
            io.to(socket.roomId).emit('chatMessage', infoMsg);
            
            io.to(socket.roomId).emit('crocWin', { word: word, setter: r?.setter_nick || 'Неизвестно', winner: null });
            
            setTimeout(() => startCrocSelection(socket.roomId), 5000);
        });
    });

    // Заменили (text) на (data)
socket.on('chatMessage', async (data) => {
    // Теперь всё сработает правильно
    const text = data.text || data; 
    const color = data.color || '#ffffff';
    
    const { data: room } = await supabase.from('game_rooms').select('*').eq('room_id', socket.roomId).single();
    if (!room) return;
    
    if (room.mode === 'croc' && room.status === 'playing' && socket.nickname !== room.setter_nick) {
        if (text.toLowerCase().trim() === room.secret_word?.toLowerCase()) {
            
            // 1. ДОБАВИЛИ ЦВЕТ СЮДА (когда игрок угадал слово, но его ответ всё равно летит в чат)
            const guessMsg = { nick: socket.nickname, text: text, color: color };
            roomChats[socket.roomId].push(guessMsg);
            io.to(socket.roomId).emit('chatMessage', guessMsg);

            await supabase.from('game_rooms').update({ status: 'ended' }).eq('room_id', socket.roomId);
            
            if (!roomScores[socket.roomId]) roomScores[socket.roomId] = {};
            if (!roomScores[socket.roomId][socket.nickname]) roomScores[socket.roomId][socket.nickname] = 0;
            
            roomScores[socket.roomId][socket.nickname] += 1;
            broadcastRoomUpdate(socket.roomId, room);
            stopTimer(socket.roomId);
            
            const reg = room.region || 'ua';
            const winMsg = { text: SYS_MSG[reg].win(socket.nickname), type: 'system-win' };
            roomChats[socket.roomId].push(winMsg);
            io.to(socket.roomId).emit('chatMessage', winMsg);
            
            io.to(socket.roomId).emit('crocWin', { word: room.secret_word, setter: room.setter_nick, winner: socket.nickname });

            setTimeout(() => startCrocSelection(socket.roomId), 5000);
            return;
        }
    }
    
    // 2. ДОБАВИЛИ ЦВЕТ СЮДА (для всех обычных сообщений)
    const normalMsg = { nick: socket.nickname, text: text, color: color };
    roomChats[socket.roomId].push(normalMsg);
    io.to(socket.roomId).emit('chatMessage', normalMsg);
});

    socket.on('disconnect', async () => {
        const roomId = socket.roomId;
        if (roomId && roomPlayers[roomId]) {
            roomPlayers[roomId] = roomPlayers[roomId].filter(p => p.id !== socket.id);
            
            const reg = roomRegions[roomId] || 'ua';
            const leaveMsg = { text: SYS_MSG[reg].leave(socket.nickname), type: 'system-join' };
            if (roomChats[roomId]) roomChats[roomId].push(leaveMsg);
            io.to(roomId).emit('chatMessage', leaveMsg);
            
            if (roomPlayers[roomId].length === 0) {
                stopTimer(roomId);
                delete roomPlayers[roomId];
                delete roomScores[roomId];
                delete roomLastSetter[roomId];
                delete roomChats[roomId]; 
                delete roomRegions[roomId];
                await supabase.from('game_rooms').delete().eq('room_id', roomId);
            } else {
                // === ЕСЛИ ОСТАЛСЯ ТОЛЬКО 1 ИГРОК - СБРАСЫВАЕМ ИГРУ ===
                if (roomPlayers[roomId].length === 1) {
                    await supabase.from('game_rooms').update({ status: 'waiting', secret_word: null }).eq('room_id', roomId);
                    stopTimer(roomId);
                    
                    // --- ОБНУЛЯЕМ ТАЙМЕР И ПРЯЧЕМ ПОДСКАЗКУ У ИГРОКА ---
                    io.to(roomId).emit('timer', ROUND_TIME); // Возвращаем визуально на 01:20
                    io.to(roomId).emit('crocHint', ''); // Прячем подсказку
                    
                    const reg = roomRegions[roomId] || 'ua';
                    const resetMsg = { text: SYS_MSG[reg].stop, type: 'system-info' };
                    roomChats[roomId].push(resetMsg);
                    io.to(roomId).emit('chatMessage', resetMsg);
                }

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

    let secretWord = "";
    let revealed = [];
    let revealTimes = [];

    // Асинхронно достаем слово из БД и считаем график подсказок
    supabase.from('game_rooms').select('secret_word, mode').eq('room_id', roomId).single()
    .then(({ data: room }) => {
        if (room && room.mode === 'croc' && room.secret_word) {
            secretWord = room.secret_word;
            let len = secretWord.length;
            
            // Открываем ровно половину букв
            let revealCount = Math.floor(len * 0.7);
            let timeWindow = 25; // Распределяем время открытия с 50 до 10 сек
            
            for (let i = 0; i < revealCount; i++) {
                // Высчитываем точную секунду для каждой буквы
                let t = 35 - Math.floor((timeWindow / revealCount) * i);
                revealTimes.push(t);
            }
        }
    });
    
    roomTimers[roomId] = setInterval(() => {
        timeLeft--;
        io.to(roomId).emit('timer', timeLeft);

        // === ПЛАВНОЕ ОТКРЫТИЕ СЛУЧАЙНЫХ БУКВ ===
        if (secretWord && revealTimes.includes(timeLeft)) {
            let unrevealed = [];
            for (let i = 0; i < secretWord.length; i++) {
                if (!revealed.includes(i) && secretWord[i] !== ' ') unrevealed.push(i);
            }
            // Выбираем случайную закрытую букву
            if (unrevealed.length > 0) {
                let randIdx = unrevealed[Math.floor(Math.random() * unrevealed.length)];
                revealed.push(randIdx);
            }

            // Строим строку подсказки
            let hintStr = secretWord.split('').map((char, index) => {
                if (char === ' ') return '  ';
                return revealed.includes(index) ? char : '_';
            }).join(' ');

            io.to(roomId).emit('crocHint', hintStr);
        }

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
    
    const roomRegion = roomRegions[roomId] || 'ua';
    const dict = CROC_WORDS[roomRegion] || CROC_WORDS['ua'];
    const shuffled = [...dict].sort(() => 0.5 - Math.random());
    
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