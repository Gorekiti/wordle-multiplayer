let currentWordLen = 0, currentAttempt = 0;

document.getElementById('secret-word').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) sendSecret();
});

document.getElementById('guess-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) sendGuess();
});

socket.on('gameStart', ({ mode, setter, guesser }) => {
    if (mode !== 'wordle') return;
    resetUI();
    isSetter = (myNick === setter);
    isGuesser = (myNick === guesser);
    
    document.getElementById('status-msg').innerText = isGuesser ? `Угадывай слово от ${setter}` : `Загадай слово для ${guesser}`;
    if (!isGuesser) document.getElementById('setup-zone').classList.remove('hidden');
    showNotify("Начался новый раунд!", "success");
    initPlaceholderGrid();
});

socket.on('wordReady', ({ length, setter }) => {
    currentWordLen = length;
    document.getElementById('setup-zone').classList.add('hidden');
    initGrid(length);
    
    if (isGuesser) {
        document.getElementById('input-wrapper').classList.remove('hidden');
        document.getElementById('status-msg').innerText = "Твой ход!";
    } else {
        document.getElementById('input-wrapper').classList.add('hidden');
        document.getElementById('status-msg').innerText = "Соперник угадывает...";
    }
});

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
    if (guess.length === currentWordLen) {
        socket.emit('makeGuess', { roomId, guess, nickname: myNick });
        document.getElementById('guess-input').value = "";
    } else {
        showNotify(`Нужно ${currentWordLen} букв!`, "error");
    }
}

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

function initPlaceholderGrid() {
    const grid = document.getElementById('grid'); grid.innerHTML = "";
    for (let i = 0; i < 6; i++) {
        const row = document.createElement('div'); row.className = 'row';
        for (let j = 0; j < 5; j++) row.innerHTML += `<div class="tile" style="opacity: 0.3"></div>`;
        grid.appendChild(row);
    }
}

function initGrid(len) {
    currentAttempt = 0; currentWordLen = len;
    const grid = document.getElementById('grid'); grid.innerHTML = "";
    for (let i = 0; i < 6; i++) {
        const row = document.createElement('div'); row.className = 'row';
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

socket.on('gameOver', ({ winner, word }) => {
    // Если слово угадано, принудительно закрашиваем текущую строку зеленым
    const rows = document.querySelectorAll('.row');
    if (rows[currentAttempt]) {
        const tiles = rows[currentAttempt].querySelectorAll('.tile');
        if (tiles[0] && tiles[0].innerText === '') {
            word.split('').forEach((char, i) => {
                if(tiles[i]) {
                    tiles[i].innerText = char;
                    tiles[i].classList.add('correct');
                }
            });
        }
    }
    
    // Прячем поле ввода, чтобы больше не писали
    document.getElementById('input-wrapper').classList.add('hidden');

    // Ждем 1.5 секунды (чтобы игрок насладился победой), затем показываем итог
    setTimeout(() => {
        const res = document.getElementById('result-display');
        res.innerText = winner ? `Победитель: ${winner}\nСлово: ${word}` : `Слово: ${word}`; 
        res.classList.remove('hidden');
    }, 1500);
});