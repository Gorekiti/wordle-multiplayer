const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let players = {}; 
let gameState = {
    word: "",
    setter: null,
    guesser: null,
    status: "waiting" // waiting, setting, playing
};

io.on('connection', (socket) => {
    socket.on('registerPlayer', (nickname) => {
        players[socket.id] = { id: socket.id, name: nickname, score: 0 };
        io.emit('updatePlayers', players);
        
        if (Object.keys(players).length >= 2 && gameState.status === "waiting") {
            startNewRound();
        }
    });

    socket.on('setWord', (word) => {
        if (socket.id === gameState.setter && word.length >= 2) {
            gameState.word = word.toUpperCase();
            gameState.status = "playing";
            io.emit('wordReady', { length: word.length, guesser: gameState.guesser });
        }
    });

    socket.on('makeGuess', (guess) => {
        if (socket.id === gameState.guesser) {
            const secret = gameState.word;
            const guessUpper = guess.toUpperCase();
            
            // Логика проверки букв
            let result = guessUpper.split('').map((char, i) => {
                if (char === secret[i]) return 'correct';
                if (secret.includes(char)) return 'present';
                return 'absent';
            });

            socket.emit('guessResult', { result, guess: guessUpper });

            if (guessUpper === secret) {
                players[socket.id].score += 1;
                io.emit('gameOver', { winner: players[socket.id].name, word: secret });
                setTimeout(startNewRound, 3000);
            }
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        if (Object.keys(players).length < 2) {
            gameState = { word: "", setter: null, guesser: null, status: "waiting" };
        }
        io.emit('updatePlayers', players);
        io.emit('resetUI');
    });

    function startNewRound() {
        const ids = Object.keys(players);
        // Меняем ролями: первый загадывает, второй угадывает (или наоборот)
        if (!gameState.setter || gameState.setter === ids[0]) {
            gameState.setter = ids[1] || ids[0];
            gameState.guesser = ids[0];
        } else {
            gameState.setter = ids[0];
            gameState.guesser = ids[1];
        }
        gameState.status = "setting";
        gameState.word = "";
        io.emit('gameStart', { setter: gameState.setter, guesser: gameState.guesser, players });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));