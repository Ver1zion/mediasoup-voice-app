// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

// Инициализация Express приложения
const app = express();
app.use(express.static('public'));  // Статическая папка для раздачи HTML и JS файлов

// Создание HTTP сервера для Express
const server = http.createServer(app);

// Создание WebSocket сервера поверх HTTP сервера
const wss = new WebSocket.Server({ server });

// Логирование подключений и сигналов от клиентов
wss.on('connection', (ws) => {
    console.log('Пользователь подключился');

    // Получение сигналов от клиентов (например, предложения или ответы WebRTC)
    ws.on('message', (message) => {
        console.log('Сообщение:', message);
        // Отправляем сигнал другим клиентам
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on('close', () => {
        console.log('Пользователь отключился');
    });
});

// Запуск сервера на порту 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
