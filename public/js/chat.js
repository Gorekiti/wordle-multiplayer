document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') { 
        let text = e.target.value.trim();
        if (!text) return;

        // Ограничение: максимум 15 слов
        const words = text.split(/\s+/);
        if (words.length > 15) {
            text = words.slice(0, 15).join(' '); // Обрезаем лишнее
        }

        // Берем цвет из палитры (или стандартный зеленый)
        const color = document.getElementById('nick-color')?.value || '#538d4e';
        
        // Отправляем объект с текстом и цветом
        socket.emit('chatMessage', { text: text, color: color }); 
        e.target.value = ''; 
    }
});

socket.on('chatMessage', ({ nick, text, type, color }) => {
    const box = document.getElementById('chat-box');
    const msg = document.createElement('div');
    const nickColor = color || '#ffffff'; // Цвет по умолчанию

    if (type === 'system-join' || type === 'system-info') {
        msg.className = 'chat-sys'; msg.innerHTML = `<i>${text}</i>`;
    } else if (type === 'system-win') {
        msg.className = 'chat-sys win'; msg.innerHTML = `<b>${text}</b>`;
    } else {
        msg.className = 'chat-msg'; 
        // Применяем цвет к нику
        msg.innerHTML = `<b style="color: ${nickColor}">${nick}:</b> ${text}`;
    }
    box.appendChild(msg); 
    box.scrollTop = box.scrollHeight;
});

// Тихое копирование ссылки без уведомления
function copyRoomLink() {
    const url = window.location.origin + '?room=' + roomId;
    navigator.clipboard.writeText(url);
}