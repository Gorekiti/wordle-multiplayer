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
    if (!isSetter && myMode === 'croc') document.getElementById('status-msg').innerText = `Угадай (${wordLength} букв)`;
});

socket.on('drawing', (data) => drawLocal(data));
socket.on('clearCanvas', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
function clearCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); socket.emit('clearCanvas'); }