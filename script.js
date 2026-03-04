const socket = io();
let myId = null;
let currentAttempt = 0;

function joinGame() {
    const nick = document.getElementById('nickname-input').value.trim();
    if (nick) {
        myId = socket.id;
        socket.emit('registerPlayer', nick);
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-ui').classList.remove('hidden');
    }
}

socket.on('updatePlayers', (players) => {
    const pList = document.getElementById('player-list');
    const lList = document.getElementById('leaderboard');
    pList.innerHTML = ""; lList.innerHTML = "";

    const sorted = Object.values(players).sort((a, b) => b.score - a.score);
    Object.values(players).forEach(p => {
        pList.innerHTML += `<li>${p.name} ${p.id === socket.id ? '(Вы)' : ''}</li>`;
    });
    sorted.forEach(p => {
        lList.innerHTML += `<li>${p.name}: <b>${p.score}</b></li>`;
    });
});

socket.on('gameStart', ({ setter, guesser, players }) => {
    currentAttempt = 0;
    document.getElementById('grid-zone').classList.add('hidden');
    document.getElementById('setup-zone').classList.add('hidden');
    
    if (socket.id === setter) {
        document.getElementById('status-msg').innerText = "Твоя очередь загадывать!";
        document.getElementById('setup-zone').classList.remove('hidden');
    } else {
        document.getElementById('status-msg').innerText = `Ждем, пока ${players[setter].name} загадает слово...`;
    }
});

function sendSecret() {
    const word = document.getElementById('secret-word').value.trim();
    if (word.length >= 2) socket.emit('setWord', word);
}

socket.on('wordReady', ({ length, guesser }) => {
    document.getElementById('setup-zone').classList.add('hidden');
    if (socket.id === guesser) {
        document.getElementById('status-msg').innerText = "Угадывай слово!";
        document.getElementById('grid-zone').classList.remove('hidden');
        initGrid(length);
    } else {
        document.getElementById('status-msg').innerText = "Соперник угадывает...";
    }
});

function initGrid(len) {
    const grid = document.getElementById('grid');
    grid.innerHTML = "";
    document.getElementById('guess-input').maxLength = len;
    for (let i = 0; i < 6; i++) {
        const row = document.createElement('div');
        row.className = 'row';
        for (let j = 0; j < len; j++) {
            row.innerHTML += `<div class="tile"></div>`;
        }
        grid.appendChild(row);
    }
}

function sendGuess() {
    const val = document.getElementById('guess-input').value.trim();
    socket.emit('makeGuess', val);
}

socket.on('guessResult', ({ result, guess }) => {
    const rows = document.querySelectorAll('.row');
    const tiles = rows[currentAttempt].querySelectorAll('.tile');
    result.forEach((status, i) => {
        tiles[i].classList.add(status);
        tiles[i].innerText = guess[i];
    });
    currentAttempt++;
    document.getElementById('guess-input').value = "";
});

socket.on('gameOver', ({ winner, word }) => {
    alert(`Раунд окончен! Победил ${winner}. Слово: ${word}`);
    document.getElementById('grid-zone').classList.add('hidden');
});

socket.on('resetUI', () => { location.reload(); });