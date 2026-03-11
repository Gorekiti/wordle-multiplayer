const socket = io();
let roomId = new URLSearchParams(window.location.search).get('room');
let myNick = localStorage.getItem('wordle-nick') || "";
let currentWordLen = 0;
let isGuesser = false;

// Подгружаем сохраненный ник
if (myNick) {
    document.getElementById('nick-input').value = myNick;
    document.getElementById('create-room-btn').disabled = false;
}

document.getElementById('nick-input').addEventListener('input', (e) => {
    myNick = e.target.value.trim();
    localStorage.setItem('wordle-nick', myNick);
    document.getElementById('create-room-btn').disabled = myNick.length < 2;
});

function createRoom() {
    if (!roomId) {
        roomId = Math.random().toString(36).substring(2, 9);
        window.history.pushState({}, '', `?room=${roomId}`);
    }
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
    socket.emit('joinRoom', { roomId, nickname: myNick });
}

socket.on('roomUpdate', ({ session, leaders }) => {
    updateLeaderboard(leaders);
    if (session.status === 'playing') syncGame(session);
});

socket.on('gameStart', ({ setter, guesser }) => {
    resetUI();
    isGuesser = (myNick === guesser);
    
    if (myNick === setter) {
        document.getElementById('status-msg').innerText = `Ты загадываешь для ${guesser}`;
        document.getElementById('setup-zone').classList.remove('hidden');
    } else if (isGuesser) {
        document.getElementById('status-msg').innerText = `Угадывай слово от ${setter}`;
    }
});

socket.on('wordReady', ({ length, setter }) => {
    document.getElementById('setup-zone').classList.add('hidden');
    document.getElementById('grid-zone').classList.remove('hidden');
    initGrid(length);
    
    // Блокируем ввод, если ты не угадываешь
    document.getElementById('input-wrapper').classList.toggle('hidden', !isGuesser);
    if (!isGuesser) document.getElementById('status-msg').innerText = `Соперник угадывает твоё слово...`;
});

socket.on('guessResult', ({ result, guess }) => {
    const rows = document.querySelectorAll('.row');
    const tiles = rows[currentAttempt].querySelectorAll('.tile');
    result.forEach((status, i) => {
        tiles[i].classList.add(status);
        tiles[i].innerText = guess[i];
    });
    currentAttempt++;
});

socket.on('gameOver', ({ winner, word }) => {
    const resDiv = document.getElementById('result-display');
    resDiv.innerText = `ПРАВИЛЬНОЕ СЛОВО: ${word}`;
    resDiv.classList.remove('hidden');
    document.getElementById('status-msg').innerText = `Победил ${winner}! Новый раунд через 5 сек...`;
    document.getElementById('input-wrapper').classList.add('hidden');
});

function sendSecret() {
    const word = document.getElementById('secret-word').value.trim().toUpperCase();
    if (word.length >= 2 && word.length <= 10) {
        socket.emit('setWord', { roomId, word, nickname: myNick });
        document.getElementById('secret-word').value = "";
    }
}

function sendGuess() {
    const guess = document.getElementById('guess-input').value.trim().toUpperCase();
    if (guess.length !== currentWordLen) return alert(`Нужно ${currentWordLen} букв!`);
    socket.emit('makeGuess', { roomId, guess, nickname: myNick });
    document.getElementById('guess-input').value = "";
}

function initGrid(len) {
    currentWordLen = len;
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

function goHome() {
    window.location.href = window.location.origin;
}

function resetUI() {
    document.getElementById('result-display').classList.add('hidden');
    document.getElementById('setup-zone').classList.add('hidden');
    document.getElementById('grid-zone').classList.add('hidden');
    document.getElementById('grid').innerHTML = "";
}