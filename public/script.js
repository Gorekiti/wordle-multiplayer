const socket = io();
let myMode = '', roomId = '', myNick = localStorage.getItem('wordle-nick') || '', isSetter = false;
let currentWordLen = 0, currentAttempt = 0;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let drawing = false, currentColor = '#000000';

canvas.addEventListener('pointerdown', (e) => {
    if (!isSetter || myMode !== 'croc') return;
    drawing = true; ctx.beginPath();
    const pos = getPos(e); ctx.moveTo(pos.x, pos.y);
});
canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const pos = getPos(e);
    const size = document.getElementById('size-picker').value;
    const data = { x: pos.x, y: pos.y, color: currentColor, size: size };
    socket.emit('drawing', data); drawLocal(data);
});
window.addEventListener('pointerup', () => drawing = false);

function drawLocal(data) {
    ctx.lineWidth = data.size; ctx.lineCap = 'round'; ctx.strokeStyle = data.color;
    ctx.lineTo(data.x, data.y); ctx.stroke();
}
function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function setColor(color, el) {
    currentColor = color;
    document.querySelectorAll('.color-swatch, .tool-btn').forEach(btn => btn.classList.remove('active'));
    if (el) el.classList.add('active');
}
function setEraser(el) {
    currentColor = '#ffffff';
    document.querySelectorAll('.color-swatch, .tool-btn').forEach(btn => btn.classList.remove('active'));
    el.classList.add('active');
}

socket.on('timer', (seconds) => {
    const mins = Math.floor(seconds / 60); const secs = seconds % 60;
    document.getElementById('timer-display').innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
});

if (myNick) document.getElementById('nick-input').value = myNick;

function openLobby(mode) {
    myMode = mode;
    myNick = document.getElementById('nick-input').value.trim();
    if (!myNick) return showNotify("Введите ник!", "error");
    localStorage.setItem('wordle-nick', myNick);
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');
    socket.emit('getRooms');
}

socket.on('roomsList', (rooms) => {
    const list = document.getElementById('rooms-list');
    list.innerHTML = rooms.filter(r => r.mode === myMode).map(r => `
        <div class="room-card">
            <h3>Создатель: ${r.creator_nick || 'Неизвестно'}</h3>
            <p>Игроков: ${r.currentCount}/${r.max_players}</p>
            <button ${r.currentCount >= r.max_players ? 'disabled style="background:#3a3a3c"' : ''} onclick="join('${r.room_id}')">
                Войти в игру
            </button>
        </div>
    `).join('');
});

function join(id) {
    roomId = id;
    socket.emit('joinRoom', { roomId, nickname: myNick });
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
}

function createRoom() { socket.emit('createRoom', { mode: myMode, nickname: myNick }); }
socket.on('roomCreated', (id) => join(id));

// === ЖЕСТКОЕ РАЗДЕЛЕНИЕ ИНТЕРФЕЙСОВ ===
socket.on('roomUpdate', ({ session, leaders, activePlayers, maxPlayers }) => {
    myMode = session.mode; // Синхронизируем режим с сервером
    document.getElementById('leaderboard').innerHTML = leaders.map(p => `<li>${p.nickname}: <b>${p.score}</b></li>`).join('');
    document.getElementById('player-list').innerHTML = activePlayers.map(name => `<li>${name}${name === myNick ? " (Вы)" : ""}</li>`).join('');
    document.getElementById('player-count-badge').innerText = `${activePlayers.length}/${maxPlayers}`;

    if (myMode === 'wordle') {
        document.getElementById('wordle-ui').classList.remove('hidden');
        document.getElementById('croc-ui').classList.add('hidden');
    } else {
        document.getElementById('croc-ui').classList.remove('hidden');
        document.getElementById('wordle-ui').classList.add('hidden');
    }
});

// Событие старта раунда Wordle
socket.on('gameStart', ({ setter, guesser }) => {
    resetUI(); 
    isSetter = (myNick === setter);
    document.getElementById('status-msg').innerText = isSetter ? `Загадай для ${guesser}` : `Ждем ${setter}...`;
    if (isSetter) document.getElementById('setup-zone').classList.remove('hidden');
});

// Событие старта раунда Крокодила
socket.on('crocSelection', ({ setter, options }) => {
    resetUI(); 
    isSetter = (myNick === setter);
    if (isSetter) {
        document.getElementById('word-picker').classList.remove('hidden');
        document.getElementById('word-options').innerHTML = options.map(w => `<button class="word-btn" onclick="chooseWord('${w}')">${w}</button>`).join('');
        document.getElementById('status-msg').innerText = "Выбирай слово!";
    } else {
        document.getElementById('status-msg').innerText = `${setter} выбирает слово...`;
    }
});

function chooseWord(word) {
    document.getElementById('word-picker').classList.add('hidden');
    document.getElementById('status-msg').innerText = `Рисуй: ${word}`;
    socket.emit('wordChosen', word);
}

socket.on('gameStarted', ({ wordLength }) => {
    if (!isSetter) document.getElementById('status-msg').innerText = `Угадай (${wordLength} букв)`;
    document.getElementById('croc-tools').classList.toggle('hidden', !isSetter);
});

// ENTER ключи для инпутов
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) { socket.emit('chatMessage', e.target.value); e.target.value = ''; }
});
document.getElementById('secret-word').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) sendSecret();
});
document.getElementById('guess-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) sendGuess();
});

socket.on('chatMessage', ({ nick, text, type }) => {
    const box = document.getElementById('chat-box');
    const msg = document.createElement('div');
    if (type === 'system-join' || type === 'system-info') {
        msg.className = 'chat-sys'; msg.innerHTML = `<i>${text}</i>`;
    } else if (type === 'system-win') {
        msg.className = 'chat-sys win'; msg.innerHTML = `<b>${text}</b>`;
    } else {
        msg.className = 'chat-msg'; msg.innerHTML = `<b>${nick}:</b> ${text}`;
    }
    box.appendChild(msg); box.scrollTop = box.scrollHeight;
});

function copyRoomLink() {
    const url = window.location.origin + '?room=' + roomId;
    navigator.clipboard.writeText(url).then(() => showNotify("Ссылка скопирована!", "success"));
}

function showNotify(text, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`; toast.innerText = text;
    container.appendChild(toast); setTimeout(() => toast.remove(), 3000);
}

socket.on('drawing', (data) => drawLocal(data));
socket.on('clearCanvas', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
function clearCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); socket.emit('clearCanvas'); }
function goHome() { window.location.href = window.location.origin; }

function resetUI() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('setup-zone').classList.add('hidden');
    document.getElementById('input-wrapper').classList.add('hidden');
    document.getElementById('word-picker').classList.add('hidden');
    document.getElementById('croc-tools').classList.add('hidden');
    document.getElementById('result-display').classList.add('hidden');
    document.getElementById('status-msg').innerText = "Подготовка...";
}

// === WORDLE LOGIC ===
function sendSecret() {
    const word = document.getElementById('secret-word').value.trim().toUpperCase();
    if (word.length >= 2) {
        socket.emit('setWord', { roomId, word });
        document.getElementById('secret-word').value = "";
    }
}

socket.on('wordReady', ({ length }) => {
    currentWordLen = length;
    document.getElementById('setup-zone').classList.add('hidden');
    document.getElementById('input-wrapper').classList.toggle('hidden', isSetter);
    initGrid(length);
});

function initGrid(len) {
    currentAttempt = 0; const grid = document.getElementById('grid'); grid.innerHTML = "";
    for (let i = 0; i < 6; i++) {
        const row = document.createElement('div'); row.className = 'row';
        for (let j = 0; j < len; j++) row.innerHTML += `<div class="tile"></div>`;
        grid.appendChild(row);
    }
}

function sendGuess() {
    const guess = document.getElementById('guess-input').value.trim().toUpperCase();
    if (guess.length === currentWordLen) {
        socket.emit('makeGuess', { guess, nickname: myNick });
        document.getElementById('guess-input').value = "";
    } else {
        showNotify(`Нужно ${currentWordLen} букв!`, "error");
    }
}

socket.on('guessResult', ({ result, guess }) => {
    const rows = document.querySelectorAll('.row');
    if (rows[currentAttempt]) {
        const tiles = rows[currentAttempt].querySelectorAll('.tile');
        result.forEach((status, i) => { tiles[i].classList.add(status); tiles[i].innerText = guess[i]; });
        currentAttempt++;
    }
});

socket.on('gameOver', ({ winner, word }) => {
    const res = document.getElementById('result-display');
    res.innerText = `Слово: ${word}`; res.classList.remove('hidden');
    document.getElementById('input-wrapper').classList.add('hidden');
});