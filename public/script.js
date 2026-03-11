const socket = io();
let myMode = '', roomId = '', myNick = localStorage.getItem('wordle-nick') || '', isSetter = false;
let currentWordLen = 0, currentAttempt = 0;

// Планшетная поддержка (Pointer Events)
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let drawing = false;

canvas.addEventListener('pointerdown', (e) => {
    if (!isSetter || myMode !== 'croc') return;
    drawing = true;
    ctx.beginPath();
    const pos = getPos(e);
    ctx.moveTo(pos.x, pos.y);
});

canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const pos = getPos(e);
    const data = { x: pos.x, y: pos.y, color: document.getElementById('color-picker').value, size: document.getElementById('size-picker').value };
    socket.emit('drawing', data);
    drawLocal(data);
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

// ЛОББИ
function openLobby(mode) {
    myMode = mode;
    myNick = document.getElementById('nick-input').value.trim();
    if (!myNick) return showNotify("Введи ник!", "error");
    localStorage.setItem('wordle-nick', myNick);
    
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');
    socket.emit('getRooms');
}

socket.on('roomsList', (rooms) => {
    const list = document.getElementById('rooms-list');
    list.innerHTML = rooms.filter(r => r.mode === myMode).map(r => `
        <div class="room-card">
            <span>Комната #${r.room_id} (${r.currentCount}/${r.max_players})</span>
            <button ${r.currentCount >= r.max_players ? 'disabled class="full"' : ''} onclick="join('${r.room_id}')">
                ${r.currentCount >= r.max_players ? 'Мест нет' : 'Войти'}
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

// ИГРОВАЯ ЛОГИКА
socket.on('roomUpdate', ({ session, leaders, activePlayers }) => {
    document.getElementById('leaderboard').innerHTML = leaders.map(p => `<li>${p.nickname}: <b>${p.score}</b></li>`).join('');
    document.getElementById('player-list').innerHTML = activePlayers.map(name => `<li>${name}${name === myNick ? " (Вы)" : ""}</li>`).join('');
    
    if (session.mode === 'wordle') document.getElementById('wordle-ui').classList.remove('hidden');
    if (session.mode === 'croc') document.getElementById('croc-ui').classList.remove('hidden');
});

socket.on('gameStart', ({ setter, guesser }) => {
    resetUI();
    isSetter = (myNick === setter);
    document.getElementById('status-msg').innerText = isSetter ? `Загадай слово для ${guesser}` : `Ждем слово от ${setter}`;
    if (isSetter) document.getElementById('setup-zone').classList.remove('hidden');
});

socket.on('crocSelection', ({ setter, options }) => {
    resetUI();
    isSetter = (myNick === setter);
    if (isSetter) {
        const picker = document.getElementById('word-picker');
        picker.classList.remove('hidden');
        document.getElementById('word-options').innerHTML = options.map(w => `<button onclick="chooseWord('${w}')">${w}</button>`).join('');
        document.getElementById('status-msg').innerText = "Выбирай слово!";
    } else {
        document.getElementById('status-msg').innerText = `${setter} выбирает слово...`;
    }
});

function chooseWord(word) {
    document.getElementById('word-picker').classList.add('hidden');
    document.getElementById('croc-tools').classList.remove('hidden');
    document.getElementById('status-msg').innerText = `Рисуй слово: ${word}`;
    socket.emit('wordChosen', word);
}

socket.on('gameStarted', ({ wordLength }) => {
    if (!isSetter) document.getElementById('status-msg').innerText = `Угадай слово из ${wordLength} букв!`;
    document.getElementById('croc-tools').classList.toggle('hidden', !isSetter);
});

socket.on('drawing', (data) => drawLocal(data));
socket.on('clearCanvas', () => ctx.clearRect(0, 0, canvas.width, canvas.height));

// ЧАТ И ENTER
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') { socket.emit('chatMessage', e.target.value); e.target.value = ''; }
});

socket.on('chatMessage', ({ nick, text, type }) => {
    const box = document.getElementById('chat-box');
    const msg = document.createElement('div');
    msg.innerHTML = `<b style="${type==='system'?'color:#538d4e':''}">${nick}:</b> ${text}`;
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight;
});

function showNotify(text, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = text;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function clearCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); socket.emit('clearCanvas'); }
function goHome() { window.location.href = window.location.origin; }

function resetUI() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('setup-zone').classList.add('hidden');
    document.getElementById('input-wrapper').classList.add('hidden');
    document.getElementById('word-picker').classList.add('hidden');
    document.getElementById('croc-tools').classList.add('hidden');
    document.getElementById('result-display').classList.add('hidden');
}

// WORDLE LOGIC (Старая)
function sendSecret() {
    const word = document.getElementById('secret-word').value.trim().toUpperCase();
    if (word.length >= 2) socket.emit('setWord', { roomId, word });
}

socket.on('wordReady', ({ length }) => {
    currentWordLen = length;
    document.getElementById('setup-zone').classList.add('hidden');
    document.getElementById('wordle-ui').classList.remove('hidden');
    document.getElementById('input-wrapper').classList.toggle('hidden', isSetter);
    initGrid(length);
});

function initGrid(len) {
    currentAttempt = 0;
    const grid = document.getElementById('grid');
    grid.innerHTML = "";
    for (let i = 0; i < 6; i++) {
        const row = document.createElement('div');
        row.className = 'row';
        for (let j = 0; j < len; j++) row.innerHTML += `<div class="tile"></div>`;
        grid.appendChild(row);
    }
}