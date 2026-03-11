const socket = io();
let roomId = new URLSearchParams(window.location.search).get('room');
let myMode = '', myNick = localStorage.getItem('wordle-nick') || '';
let isSetter = false;
let isGuesser = false; // Для Wordle логики

if (myNick) document.getElementById('nick-input').value = myNick;

// Логика прямого перехода по ссылке
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
    if (!myNick) return showNotify("Введите ник!", "error");
    localStorage.setItem('wordle-nick', myNick);
    document.getElementById('auth-screen').classList.add('hidden');
    socket.emit('joinRoom', { roomId, nickname: myNick });
}

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
            <div class="room-info">
                <h3>Комната: ${r.creator_nick || 'Неизвестно'}</h3>
                <p>Игроков: <span class="badge">${r.currentCount}/${r.max_players}</span></p>
            </div>
            <button class="join-btn" ${r.currentCount >= r.max_players ? 'disabled style="background:#3a3a3c"' : ''} onclick="join('${r.room_id}')">
                ${r.currentCount >= r.max_players ? 'Заполнена' : 'Войти'}
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

function createRoom() { socket.emit('createRoom', { mode: myMode, nickname: myNick }); }
socket.on('roomCreated', (id) => join(id));

// Обновление состояния комнаты
socket.on('roomUpdate', ({ session, leaders, activePlayers, maxPlayers }) => {
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    
    myMode = session.mode;
    document.getElementById('leaderboard').innerHTML = leaders.map(p => `<li>${p.nickname}: <b>${p.score}</b></li>`).join('');
    document.getElementById('player-list').innerHTML = activePlayers.map(name => `<li>${name}${name === myNick ? " (Вы)" : ""}</li>`).join('');
    document.getElementById('player-count-badge').innerText = `${activePlayers.length}/${maxPlayers}`;

    if (myMode === 'wordle') {
        document.getElementById('wordle-ui').classList.remove('hidden');
        document.getElementById('croc-ui').classList.add('hidden');
        if (session.status === 'waiting' && typeof initPlaceholderGrid === 'function') initPlaceholderGrid(); 
        if (session.status === 'playing' && typeof syncGame === 'function') syncGame(session);
    } else {
        document.getElementById('croc-ui').classList.remove('hidden');
        document.getElementById('wordle-ui').classList.add('hidden');
    }
});

// Глобальный таймер
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