document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) { 
        socket.emit('chatMessage', e.target.value); 
        e.target.value = ''; 
    }
});

socket.on('chatMessage', ({ nick, text, type }) => {
    const box = document.getElementById('chat-box');
    const msg = document.createElement('div');
    if (type === 'system-join' || type === 'system-info') {
        msg.className = 'chat-sys'; msg.innerHTML = `<i>${text}</i>`;
    } else if (type === 'system-win') {
        msg.className = 'chat-sys win'; msg.innerHTML = `<b>${text}</b>`;
    } else {
        msg.className = 'chat-msg'; msg.innerHTML = `<b>${nick}:</b> ${text}`;
    }
    box.appendChild(msg); box.scrollTop = box.scrollHeight;
});

function copyRoomLink() {
    const url = window.location.origin + '?room=' + roomId;
    navigator.clipboard.writeText(url).then(() => showNotify("Ссылка скопирована!", "success"));
}