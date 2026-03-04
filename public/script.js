const socket = io();
let roomId = new URLSearchParams(window.location.search).get('room');
let myNick = localStorage.getItem('wordle-nick') || "";
let currentWordLen = 0;

// Активация кнопки при вводе ника
document.getElementById('nick-input').addEventListener('input', (e) => {
    const btn = document.getElementById('create-room-btn');
    btn.disabled = e.target.value.trim().length < 2;
});

// Если зашли по ссылке — сразу просим ник
window.onload = () => {
    if (roomId) {
        document.getElementById('create-room-btn').innerText = "Войти в комнату";
    }
};

function createRoom() {
    myNick = document.getElementById('nick-input').value.trim();
    localStorage.setItem('wordle-nick', myNick);
    
    if (!roomId) {
        roomId = Math.random().toString(36).substring(2, 9);
        window.history.pushState({}, '', `?room=${roomId}`);
    }
    
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
    
    socket.emit('joinRoom', { roomId, nickname: myNick });
}

socket.on('roomUpdate', ({ playersCount, session }) => {
    document.getElementById('player-list').innerHTML = `<li>В комнате: ${playersCount}/2</li>`;
    
    if (playersCount === 2 && session.status === 'waiting') {
        // Логика назначения ролей (для теста: первый зашедший — setter)
        // В продакшене лучше делать через массив ников на сервере
    }
    
    if (session.status === 'playing') syncGame(session);
});

function sendSecret() {
    const word = document.getElementById('secret-word').value.trim();
    if (word.length >= 2 && word.length <= 10) {
        socket.emit('setWord', { roomId, word, nickname: myNick });
    }
}

function sendGuess() {
    const guess = document.getElementById('guess-input').value.trim().toUpperCase();
    if (guess.length !== currentWordLen) return alert(`Нужно ${currentWordLen} букв!`);
    socket.emit('makeGuess', { roomId, guess, nickname: myNick });
}

function copyRoomLink() {
    navigator.clipboard.writeText(window.location.href);
    alert("Ссылка скопирована! Отправь её другу.");
}

function initGrid(len) {
    currentWordLen = len;
    const grid = document.getElementById('grid');
    grid.innerHTML = "";
    for (let i = 0; i < 6; i++) {
        const row = document.createElement('div');
        row.className = 'row';
        for (let j = 0; j < len; j++) row.innerHTML += `<div class="tile"></div>`;
        grid.appendChild(row);
    }
}