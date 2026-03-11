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
    const scaleX = canvas.width / rect.width;    
    const scaleY = canvas.height / rect.height;  
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
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

// === ЭКРАН ПОБЕДЫ ===
socket.on('crocWin', ({ word, setter, winner }) => {
    const winScreen = document.getElementById('croc-win-screen');
    winScreen.classList.remove('hidden');
    
    document.getElementById('win-word').innerText = word;
    document.getElementById('win-setter').innerText = setter;
    
    const guesserBlock = document.getElementById('win-guesser-block');
    if (winner) {
        guesserBlock.classList.remove('hidden');
        document.getElementById('win-guesser').innerText = winner;
    } else {
        guesserBlock.classList.add('hidden'); // Если никто не угадал
    }

    // Локальный визуальный таймер
    let ticks = 5;
    document.getElementById('win-timer').innerText = ticks;
    const iv = setInterval(() => {
        ticks--;
        if (ticks <= 0) clearInterval(iv);
        else document.getElementById('win-timer').innerText = ticks;
    }, 1000);
});

socket.on('crocSelection', ({ setter, options }) => {
    resetUI(); 
    
    // Прячем экран победы и очищаем холст только локально (чтобы не спамить сервер)
    document.getElementById('croc-win-screen').classList.add('hidden');
    ctx.clearRect(0, 0, canvas.width, canvas.height); 

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
    if (!isSetter && myMode === 'croc') {
        document.getElementById('status-msg').innerText = `Угадай (${wordLength} букв)`;
    }
});

socket.on('drawing', (data) => drawLocal(data));
socket.on('clearCanvas', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
function clearCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); socket.emit('clearCanvas'); }