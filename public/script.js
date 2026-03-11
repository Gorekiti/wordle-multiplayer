const socket = io();
let roomId = new URLSearchParams(window.location.search).get('room');
let myNick = localStorage.getItem('wordle-nick') || "";
let currentWordLen = 0;
let currentAttempt = 0;
let isGuesser = false;

// Подгрузка ника
if (myNick) {
    document.getElementById('nick-input').value = myNick;
    document.getElementById('create-room-btn').disabled = false;
}

// Слушатели для Enter
document.getElementById('nick-input').addEventListener('keypress', (e) => { if(e.key === 'Enter' && myNick.length >= 2) createRoom(); });
document.getElementById('secret-word').addEventListener('keypress', (e) => { if(e.key === 'Enter') sendSecret(); });
document.getElementById('guess-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') sendGuess(); });

document.getElementById('nick-input').addEventListener('input', (e) => {
    myNick = e.target.value.trim();
    localStorage.setItem('wordle-nick', myNick);
    document.getElementById('create-room-btn').disabled = myNick.length < 2;
});

function showNotify(text, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = text;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function createRoom() {
    if (!roomId) {
        roomId = Math.random().toString(36).substring(2, 9);
        window.history.pushState({}, '', `?room=${roomId}`);
    }
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
    socket.emit('joinRoom', { roomId, nickname: myNick });
}

socket.on('roomUpdate', ({ session, leaders, activePlayers }) => {
    document.getElementById('leaderboard').innerHTML = leaders.map(p => `<li>${p.nickname}: <b>${p.score}</b></li>`).join('');
    document.getElementById('player-list').innerHTML = activePlayers.map(name => `<li>${name}${name === myNick ? " (Вы)" : ""}</li>`).join('');
    if (session && session.status === 'playing') syncGame(session);
});

socket.on('gameStart', ({ setter, guesser }) => {
    resetUI();
    isGuesser = (myNick === guesser);
    document.getElementById('status-msg').innerText = isGuesser ? `Угадывай слово от ${setter}` : `Загадай слово для ${guesser}`;
    if (!isGuesser) document.getElementById('setup-zone').classList.remove('hidden');
    showNotify("Начался новый раунд!", "success");
});

socket.on('wordReady', ({ length, setter }) => {
    currentWordLen = length;
    document.getElementById('setup-zone').classList.add('hidden');
    document.getElementById('grid-zone').classList.remove('hidden');
    initGrid(length);
    
    if (isGuesser) {
        document.getElementById('input-wrapper').classList.remove('hidden');
        document.getElementById('status-msg').innerText = "Твой ход!";
    } else {
        document.getElementById('input-wrapper').classList.add('hidden');
        document.getElementById('status-msg').innerText = "Соперник угадывает...";
    }
});

socket.on('guessResult', ({ result, guess }) => {
    const rows = document.querySelectorAll('.row');
    if (rows[currentAttempt]) {
        const tiles = rows[currentAttempt].querySelectorAll('.tile');
        result.forEach((status, i) => {
            tiles[i].classList.add(status);
            tiles[i].innerText = guess[i];
        });
        currentAttempt++;
    }
});

socket.on('gameOver', ({ winner, word }) => {
    const resDiv = document.getElementById('result-display');
    resDiv.innerText = `ПРАВИЛЬНОЕ СЛОВО: ${word}`;
    resDiv.classList.remove('hidden');
    document.getElementById('status-msg').innerText = `${winner} победил!`;
    document.getElementById('input-wrapper').classList.add('hidden');
    showNotify("Раунд окончен. Ждем смены ролей...", "info");
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

function syncGame(session) {
    if (!session.secret_word) return;
    initGrid(session.secret_word.length);
    session.attempts_history.forEach((attempt, i) => {
        const rows = document.querySelectorAll('.row');
        if (rows[i]) {
            const tiles = rows[i].querySelectorAll('.tile');
            attempt.result.forEach((status, j) => {
                tiles[j].classList.add(status);
                tiles[j].innerText = attempt.guess[j];
            });
            currentAttempt = i + 1;
        }
    });
}

function sendSecret() {
    const word = document.getElementById('secret-word').value.trim().toUpperCase();
    if (word.length >= 2 && word.length <= 10) {
        socket.emit('setWord', { roomId, word });
        document.getElementById('secret-word').value = "";
    } else {
        showNotify("Слово должно быть от 2 до 10 букв!", "error");
    }
}

function sendGuess() {
    const guess = document.getElementById('guess-input').value.trim().toUpperCase();
    if (guess.length !== currentWordLen) {
        showNotify(`Нужно ${currentWordLen} букв!`, "error");
        return;
    }
    socket.emit('makeGuess', { roomId, guess, nickname: myNick });
    document.getElementById('guess-input').value = "";
}

function copyRoomLink() {
    const url = window.location.href;
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(() => showNotify("Ссылка скопирована!", "success"));
    } else {
        const input = document.createElement('textarea');
        input.value = url; document.body.appendChild(input);
        input.select(); document.execCommand('copy');
        document.body.removeChild(input);
        showNotify("Ссылка скопирована!", "success");
    }
}

function goHome() { window.location.href = window.location.origin; }
function resetUI() {
    document.getElementById('result-display').classList.add('hidden');
    document.getElementById('grid').innerHTML = "";
    document.getElementById('setup-zone').classList.add('hidden');
    document.getElementById('grid-zone').classList.add('hidden');
    document.getElementById('input-wrapper').classList.add('hidden');
}