const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// ЯДЕРНАЯ БЛОКИРОВКА СКРОЛЛА ПЕРОМ
canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
canvas.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });

// И на всякий случай блокируем контекстное меню при долгом нажатии пером
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

let drawing = false, currentColor = '#000000';
let prevPos = null; 
let currentSetter = ''; // Переменная для хранения имени текущего художника

canvas.addEventListener('pointerdown', (e) => {
    if (!isSetter || myMode !== 'croc') return;
    drawing = true; 
    prevPos = getPos(e); 
});

canvas.addEventListener('pointermove', (e) => {
    if (!drawing || !prevPos) return;
    const currentPos = getPos(e);
    const size = document.getElementById('size-picker').value;
    
    const data = { 
        prevX: prevPos.x, prevY: prevPos.y, 
        x: currentPos.x, y: currentPos.y, 
        color: currentColor, size: size 
    };
    
    socket.emit('drawing', data); 
    drawLocal(data);
    
    prevPos = currentPos;
});

window.addEventListener('pointerup', () => {
    drawing = false;
    prevPos = null;
});

function drawLocal(data) {
    ctx.beginPath();
    ctx.lineWidth = data.size; 
    ctx.lineCap = 'round'; 
    ctx.lineJoin = 'round';
    ctx.strokeStyle = data.color;
    ctx.moveTo(data.prevX, data.prevY);
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
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

// === ЭКРАН ПОБЕДЫ И РАЗБЛОКИРОВКА ЧАТА ===
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
        guesserBlock.classList.add('hidden');
    }

    // 🔓 Возвращаем художнику возможность писать после раунда
    const chatInput = document.getElementById('chat-input');
    chatInput.disabled = false;
    chatInput.placeholder = "Сообщение...";
    chatInput.style.opacity = "1";

    let ticks = 5;
    document.getElementById('win-timer').innerText = ticks;
    const iv = setInterval(() => {
        ticks--;
        if (ticks <= 0) clearInterval(iv);
        else document.getElementById('win-timer').innerText = ticks;
    }, 1000);
});

// === ВЫБОР СЛОВА (ЦЕНТРАЛЬНАЯ МОДАЛКА) И БЛОКИРОВКА ВВОДА ===
socket.on('crocSelection', ({ setter, options }) => {
    resetUI(); 
    document.getElementById('croc-win-screen').classList.add('hidden');
    ctx.clearRect(0, 0, canvas.width, canvas.height); 

    isSetter = (myNick === setter);
    currentSetter = setter; 
    
    const chatInput = document.getElementById('chat-input');
    const tools = document.getElementById('croc-tools');
    const hintDisplay = document.getElementById('hint-display');
    
    hintDisplay.classList.add('hidden'); // Прячем подсказку в начале раунда

    if (isSetter) {
        tools.classList.remove('hidden'); // ПОКАЗЫВАЕМ инструменты художнику
        const picker = document.getElementById('word-picker');
        picker.classList.remove('hidden');
        document.getElementById('word-options').innerHTML = options.map(w => `<button class="word-btn" onclick="chooseWord('${w}')">${w}</button>`).join('');
        document.getElementById('status-msg').innerText = "Выбирай слово!";
        
        chatInput.disabled = true;
        chatInput.placeholder = "Художник не может писать...";
        chatInput.style.opacity = "0.5";
    } else {
        tools.classList.add('hidden'); // ПРЯЧЕМ инструменты у отгадывающих
        document.getElementById('status-msg').innerText = `${setter} выбирает слово...`;
        
        chatInput.disabled = false;
        chatInput.placeholder = "Сообщение...";
        chatInput.style.opacity = "1";
    }
});

function chooseWord(word) {
    document.getElementById('word-picker').classList.add('hidden');
    document.getElementById('status-msg').innerText = `Рисуй: ${word}`;
    socket.emit('wordChosen', word);
}

// === НАЧАЛО ИГРЫ (ОБНОВЛЕННЫЙ СТАТУС) ===
socket.on('gameStarted', () => {
    if (!isSetter && myMode === 'croc') {
        // Выводим имя художника без подсказок
        document.getElementById('status-msg').innerText = `${currentSetter} рисует`; 
    }
});

// === ПОКАЗ ПОДСКАЗОК ===
socket.on('crocHint', (hint) => {
    const hintEl = document.getElementById('hint-display');
    hintEl.innerText = hint;
    hintEl.classList.remove('hidden');
});

socket.on('drawing', (data) => drawLocal(data));
socket.on('clearCanvas', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
function clearCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); socket.emit('clearCanvas'); }