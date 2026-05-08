const socket = io();
let roomId = new URLSearchParams(window.location.search).get('room');

// Загружаем данные из памяти
let myMode = '', myNick = localStorage.getItem('wordle-nick') || '';
let myColor = localStorage.getItem('wordle-color') || '#538d4e'; 
let currentRegion = localStorage.getItem('game-region') || 'ru'; // ДОБАВЛЕН РЕГИОН
let isSetter = false;
let isGuesser = false; 

// === ПОЛНЫЙ СЛОВАРЬ ПЕРЕВОДОВ ИНТЕРФЕЙСА И ИГР ===
const i18n = {
    ru: {
        // UI Лобби и Кнопки
        nickPlaceholder: "Введите ваш ник...", crocBtn: "Крокодил", lobbyTitle: "Лобби", createBtn: "+ Создать",
        homeBtn: "🏠 На главную", ratingTitle: "🏆 Рейтинг комнаты", waiting: "Ожидание...", chooseWord: "Выбери слово:",
        drew: "Рисовал(а):", guessed: "Угадал(а):", nextRound: "След. раунд через:", eraser: "🧽 Ластик", clear: "🗑 Сброс",
        playersTitle: "👥 Игроки", chatTitle: "💬 Чат", chatPlaceholder: "Сообщение...", copyBtn: "🔗 Ссылка",
        emptyLobby: "Нет открытых комнат. Создай свою!", fullBtn: "Заполнена", joinBtn: "Войти",
        wordleBtn: "Wordle 1x1", secretWord: "Загадай слово (2-10)", yourAnswer: "Твой ответ",
        errNick: "Введите ник!", waitPlayers: "Ожидание игроков...",
        
        // Логика игр (Крокодил и Wordle)
        newRound: "Начался новый раунд!", yourTurn: "Твой ход!", oppGuesses: "Соперник угадывает...",
        guessFrom: "Угадывай слово от", setFor: "Загадай слово для", wordIs: "Слово:",
        wordLenErr: "Слово должно быть от 2 до 10 букв!", needLetters: "Нужно букв:",
        choosing: "выбирает слово...", drawCmd: "Рисуй:", drawingNow: "рисует", hintMsg: "Подсказка:"
    },
    ua: {
        // UI Лобби и Кнопки
        nickPlaceholder: "Введіть ваш нік...", crocBtn: "Крокодил", lobbyTitle: "Лобі", createBtn: "+ Створити",
        homeBtn: "🏠 На головну", ratingTitle: "🏆 Рейтинг кімнати", waiting: "Очікування...", chooseWord: "Обери слово:",
        drew: "Малював(ла):", guessed: "Вгадав(ла):", nextRound: "Наст. раунд через:", eraser: "🧽 Гумка", clear: "🗑 Скинути",
        playersTitle: "👥 Гравці", chatTitle: "💬 Чат", chatPlaceholder: "Повідомлення...", copyBtn: "🔗 Лінк",
        emptyLobby: "Немає відкритих кімнат. Створи свою!", fullBtn: "Заповнена", joinBtn: "Увійти",
        wordleBtn: "Wordle 1x1", secretWord: "Загадай слово (2-10)", yourAnswer: "Твоя відповідь",
        errNick: "Введіть нік!", waitPlayers: "Очікування гравців...",
        
        // Логика игр (Крокодил и Wordle)
        newRound: "Почався новий раунд!", yourTurn: "Твій хід!", oppGuesses: "Суперник вгадує...",
        guessFrom: "Вгадуй слово від", setFor: "Загадай слово для", wordIs: "Слово:",
        wordLenErr: "Слово має бути від 2 до 10 літер!", needLetters: "Потрібно літер:",
        choosing: "обирає слово...", drawCmd: "Малюй:", drawingNow: "малює", hintMsg: "Підказка:"
    },
    en: {
        // UI Лобби и Кнопки
        nickPlaceholder: "Enter nickname...", crocBtn: "Charades", lobbyTitle: "Lobby", createBtn: "+ Create",
        homeBtn: "🏠 Home", ratingTitle: "🏆 Room Rating", waiting: "Waiting...", chooseWord: "Choose a word:",
        drew: "Drew:", guessed: "Guessed:", nextRound: "Next round in:", eraser: "🧽 Eraser", clear: "🗑 Clear",
        playersTitle: "👥 Players", chatTitle: "💬 Chat", chatPlaceholder: "Message...", copyBtn: "🔗 Link",
        emptyLobby: "No rooms. Create one!", fullBtn: "Full", joinBtn: "Join",
        wordleBtn: "Wordle 1v1", secretWord: "Set a word (2-10)", yourAnswer: "Your guess",
        errNick: "Enter nickname!", waitPlayers: "Waiting for players...",
        
        // Логика игр (Крокодил и Wordle)
        newRound: "New round started!", yourTurn: "Your turn!", oppGuesses: "Opponent guessing...",
        guessFrom: "Guess word from", setFor: "Set a word for", wordIs: "Word:",
        wordLenErr: "Word must be 2-10 letters!", needLetters: "Letters needed:",
        choosing: "is choosing a word...", drawCmd: "Draw:", drawingNow: "is drawing", hintMsg: "Hint:"
    }
};

// Функция перевода
function changeLanguage(lang) {
    currentRegion = lang;
    localStorage.setItem('game-region', lang);
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.innerHTML = i18n[lang][el.getAttribute('data-i18n')];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = i18n[lang][el.getAttribute('data-i18n-placeholder')];
    });

    if (!document.getElementById('lobby-screen').classList.contains('hidden')) {
        socket.emit('getRooms');
    }
}

// Инициализация при старте
document.getElementById('region-select').value = currentRegion;
changeLanguage(currentRegion);

if (myNick) document.getElementById('nick-input').value = myNick;
const colorInput = document.getElementById('nick-color');
if (colorInput) colorInput.value = myColor;

if (roomId) {
    if (myNick && myNick.length >= 2) {
        document.getElementById('auth-screen').classList.add('hidden');
        socket.emit('joinRoom', { roomId, nickname: myNick });
    } else {
        document.querySelector('.mode-select').innerHTML = `
            <button class="mode-btn wordle" onclick="joinFromUrl()" style="width:100%">Войти в игру</button>
        `;
    }
}

function joinFromUrl() {
    myNick = document.getElementById('nick-input').value.trim();
    const selectedColor = document.getElementById('nick-color')?.value || '#538d4e'; 
    if (!myNick) return showNotify(i18n[currentRegion].errNick, "error");
    
    localStorage.setItem('wordle-nick', myNick);
    localStorage.setItem('wordle-color', selectedColor);
    
    document.getElementById('auth-screen').classList.add('hidden');
    socket.emit('joinRoom', { roomId, nickname: myNick });
}

function openLobby(mode) {
    myMode = mode;
    myNick = document.getElementById('nick-input').value.trim();
    const selectedColor = document.getElementById('nick-color')?.value || '#538d4e'; 
    if (!myNick) return showNotify("Введите ник!", "error");
    
    localStorage.setItem('wordle-nick', myNick);
    localStorage.setItem('wordle-color', selectedColor);
    
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');
    
    document.getElementById('rooms-list').innerHTML = `<p style="text-align: center; width: 100%; color: var(--accent); margin-top: 20px; font-weight: bold;">⏳ ...</p>`;
    socket.emit('getRooms');
}

socket.on('roomsList', (rooms) => {
    const list = document.getElementById('rooms-list');
    
    // ФИЛЬТРУЕМ КОМНАТЫ ПО РЕЖИМУ И РЕГИОНУ!
    const filteredRooms = rooms.filter(r => r.mode === myMode && r.region === currentRegion);
    
    if (filteredRooms.length === 0) {
        list.innerHTML = `<p style="text-align: center; width: 100%; color: #aaa; margin-top: 20px;">${i18n[currentRegion].emptyLobby}</p>`;
        return;
    }

    list.innerHTML = filteredRooms.map(r => `
        <div class="room-card">
            <div class="room-info">
                <h3>Room: ${r.creator_nick || '?'}</h3>
                <p>${i18n[currentRegion].playersTitle}: <span class="badge">${r.currentCount}/${r.max_players}</span></p>
            </div>
            <button class="join-btn" ${r.currentCount >= r.max_players ? 'disabled style="background:#3a3a3c"' : ''} onclick="join('${r.room_id}')">
                ${r.currentCount >= r.max_players ? i18n[currentRegion].fullBtn : i18n[currentRegion].joinBtn}
            </button>
        </div>
    `).join('');
});

function join(id) {
    roomId = id;
    socket.emit('joinRoom', { roomId, nickname: myNick });
}

socket.on('joinError', (msg) => {
    showNotify(msg, "error");
    setTimeout(() => goHome(), 2000); 
});

// ОТПРАВЛЯЕМ РЕГИОН НА СЕРВЕР ПРИ СОЗДАНИИ
function createRoom() { 
    socket.emit('createRoom', { mode: myMode, nickname: myNick, region: currentRegion }); 
}

socket.on('roomCreated', (id) => join(id));

socket.on('roomUpdate', ({ session, leaders, activePlayers, maxPlayers }) => {
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.querySelector('.server-selector').classList.add('hidden'); // Прячем глобус в игре
    
    myMode = session.mode;
    
    if (myMode === 'wordle') document.body.classList.add('wordle-mode');
    else document.body.classList.remove('wordle-mode');

    document.getElementById('leaderboard').innerHTML = leaders.map(p => `<li>${p.nickname}: <b>${p.score}</b></li>`).join('');
    document.getElementById('player-list').innerHTML = activePlayers.map(name => `<li>${name}${name === myNick ? " (Вы)" : ""}</li>`).join('');
    document.getElementById('player-count-badge').innerText = `${activePlayers.length}/${maxPlayers}`;

    if (session.status === 'waiting') {
        const txt = currentRegion === 'en' ? 'Waiting...' : (currentRegion === 'ua' ? 'Очікування...' : 'Ожидание...');
        document.getElementById('status-msg').innerText = txt;
        document.getElementById('setup-zone').classList.add('hidden');
        document.getElementById('input-wrapper').classList.add('hidden');
        document.getElementById('word-picker').classList.add('hidden');
        document.getElementById('croc-win-screen').classList.add('hidden');
        document.getElementById('result-display').classList.add('hidden');
        
        const hintEl = document.getElementById('hint-display');
        if (hintEl) hintEl.classList.add('hidden');
        
        if (myMode === 'croc' && typeof clearCanvas === 'function') clearCanvas();
        if (myMode === 'wordle' && typeof initPlaceholderGrid === 'function') initPlaceholderGrid();
    }

    if (myMode === 'wordle') {
        document.getElementById('wordle-ui').classList.remove('hidden');
        document.getElementById('croc-ui').classList.add('hidden');
        document.getElementById('timer-display').classList.add('hidden');
        document.getElementById('chat-container').classList.add('hidden');
        
        if (session.status === 'waiting' && typeof initPlaceholderGrid === 'function') initPlaceholderGrid(); 
        if (session.status === 'playing' && typeof syncGame === 'function') syncGame(session);
    } else {
        document.getElementById('croc-ui').classList.remove('hidden');
        document.getElementById('wordle-ui').classList.add('hidden');
        document.getElementById('timer-display').classList.remove('hidden');
        document.getElementById('chat-container').classList.remove('hidden');
    }
});

socket.on('gameStart', ({ setter, guesser }) => {
    resetUI(); 
    isSetter = (myNick === setter);
    const txt = currentRegion === 'en' ? 'Waiting for word...' : (currentRegion === 'ua' ? 'Очікуємо слово...' : 'Ждем слово...');
    const txtSet = currentRegion === 'en' ? 'Choose a word!' : (currentRegion === 'ua' ? 'Загадай слово!' : 'Загадай слово!');
    
    document.getElementById('status-msg').innerText = isSetter ? txtSet : txt;
    if (isSetter) document.getElementById('setup-zone').classList.remove('hidden');
    if (myMode === 'wordle' && typeof initPlaceholderGrid === 'function') initPlaceholderGrid();
});

socket.on('timer', (seconds) => {
    const mins = Math.floor(seconds / 60); const secs = seconds % 60;
    document.getElementById('timer-display').innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
});

function showNotify(text, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`; toast.innerText = text;
    container.appendChild(toast); setTimeout(() => toast.remove(), 4000);
}

function goHome() { window.location.href = window.location.origin; }

function resetUI() {
    if (typeof ctx !== 'undefined' && typeof canvas !== 'undefined') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    document.getElementById('setup-zone').classList.add('hidden');
    document.getElementById('input-wrapper').classList.add('hidden');
    document.getElementById('word-picker').classList.add('hidden');
    document.getElementById('result-display').classList.add('hidden');
}