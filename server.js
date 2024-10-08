// Подключаем нужные библиотеки (модули), которые мы установили через npm.
const express = require('express');    // express используется для создания веб-сервера.
const http = require('http');          // встроенный в Node.js модуль для работы с HTTP-сервером.
const socketIo = require('socket.io'); // socket.io позволяет создавать WebSocket соединения для реального времени.
const mediasoup = require('mediasoup'); // mediasoup используется для работы с WebRTC и голосовыми коммуникациями.

// Создаем экземпляр express-приложения и HTTP-сервер.
const app = express();
const server = http.createServer(app); // создаём HTTP сервер на базе express.
const io = socketIo(server);           // создаём WebSocket сервер поверх HTTP сервера.

// Глобальные переменные для хранения объекта Worker, Router и голосовой комнаты.
let worker;                            // worker - это процесс mediasoup, который будет обрабатывать WebRTC соединения.
let router;                            // router используется для маршрутизации медиапотоков между участниками.
let voiceRoom = {};                    // объект для хранения информации о пользователях в комнате.

// Создание Worker и Router при запуске сервера. Это асинхронная операция.
(async () => {
    // Создаем worker - это процесс, который управляет потоками медиа.
    worker = await mediasoup.createWorker();

    // Создаем router с поддержкой аудио (кодек opus).
    router = await worker.createRouter({
        mediaCodecs: [ // описываем, какие медиаформаты поддерживает наш router.
            {
                kind: 'audio',           // только аудио.
                mimeType: 'audio/opus',  // используем кодек Opus для сжатия аудио.
                clockRate: 48000,        // частота дискретизации аудио.
                channels: 2,             // стерео-каналы.
            }
        ]
    });
})();

// Когда клиент подключается через WebSocket, запускается эта функция.
io.on('connection', socket => {
    console.log('Пользователь подключился:', socket.id); // выводим ID подключенного клиента.

    // Обработчик события, когда пользователь присоединяется к голосовой комнате.
    socket.on('join-voice', async () => {
        const transport = await createTransport(socket); // создаём транспорт для передачи аудио.

        // Отправляем параметры транспорта на клиент, чтобы они могли использовать WebRTC для подключения.
        socket.emit('transport-created', {
            transportParams: transport,
        });

        // Обработчик для события "send-audio", когда клиент начинает отправлять аудиопоток.
        socket.on('send-audio', async ({ transportId, rtpCapabilities }) => {
            // Создаем Producer (отправитель медиа) для передачи аудио в комнату.
            const producer = await createProducer(transportId, rtpCapabilities);

            // Сохраняем информацию о пользователе и его Producer в комнате.
            voiceRoom[socket.id] = producer;

            // Отправляем клиенту подтверждение, что Producer был создан.
            socket.emit('producer-created', { id: producer.id });
        });
    });

    // Обработчик, когда пользователь отключается от сервера.
    socket.on('disconnect', () => {
        console.log('Пользователь отключился:', socket.id); // выводим сообщение об отключении.

        // Если пользователь был в комнате и отправлял аудио, закрываем его Producer.
        if (voiceRoom[socket.id]) {
            voiceRoom[socket.id].close(); // закрываем медиа-соединение.
            delete voiceRoom[socket.id];  // удаляем его из списка пользователей в комнате.
        }
    });
});

// Функция для создания транспорта (WebRTC транспорт для передачи аудио/видео).
async function createTransport(socket) {
    // Создаем WebRTC транспорт, который будет использовать UDP/TCP для передачи медиа.
    const transport = await router.createWebRtcTransport({
        listenIps: [{ ip: '127.0.0.1', announcedIp: null }], // локальный IP, по которому клиенты будут подключаться.
        enableUdp: true,   // разрешаем использовать UDP (для передачи медиа).
        enableTcp: true,   // разрешаем использовать TCP.
        preferUdp: true,   // предпочитаем UDP (обычно быстрее).
    });

    // Обрабатываем событие, когда состояние DTLS (протокол безопасности) изменяется.
    transport.on('dtlsstatechange', dtlsState => {
        if (dtlsState === 'closed') { // если состояние изменилось на "закрыто", закрываем транспорт.
            transport.close();
        }
    });

    // Возвращаем параметры транспорта, которые будут переданы клиенту для настройки WebRTC соединения.
    return {
        id: transport.id,                     // уникальный идентификатор транспорта.
        iceParameters: transport.iceParameters, // параметры ICE для пробивания NAT.
        iceCandidates: transport.iceCandidates, // кандидаты для установления соединения.
        dtlsParameters: transport.dtlsParameters, // параметры DTLS для безопасности соединения.
    };
}

// Функция для создания Producer (потока аудио от клиента к серверу).
async function createProducer(transportId, rtpCapabilities) {
    // Получаем транспорт по его ID.
    const transport = await router.getTransportById(transportId);

    // Создаем Producer, который будет отправлять аудио в сеть.
    const producer = await transport.produce({ 
        kind: 'audio', // тип данных - аудио.
        rtpParameters: rtpCapabilities // параметры RTP, которые получены от клиента.
    });

    return producer; // возвращаем созданный Producer.
}

// Запуск сервера на порту 3000.
server.listen(3000, () => {
    console.log('Сервер запущен на порту 3000');
});