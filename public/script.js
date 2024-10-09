// client.js
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusDiv = document.getElementById("status");

let localStream;
let peerConnection;
let socket;

// Конфигурация для STUN сервера (нужен для работы WebRTC)
const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

// Функция для инициализации WebRTC и подключения к WebSocket
startBtn.addEventListener("click", async () => {
  // Инициализация WebSocket
  socket = new WebSocket(`ws://${window.location.host}`);

  // Захват микрофона пользователя
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Инициализация PeerConnection для WebRTC
  peerConnection = new RTCPeerConnection(configuration);
  localStream
    .getTracks()
    .forEach((track) => peerConnection.addTrack(track, localStream));

  // Обработка ICE кандидатов
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.send(JSON.stringify({ candidate: event.candidate }));
    }
  };

  // Обработка полученного медиапотока
  peerConnection.ontrack = (event) => {
    const audioElement = document.createElement("audio");
    audioElement.srcObject = event.streams[0];
    audioElement.play();
  };

  // Обработка сообщений WebSocket
  socket.onmessage = async (message) => {
    const data = JSON.parse(message.data);

    // Обработка ICE кандидатов
    if (data.candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }

    // Обработка SDP предложений (offer/answer)
    if (data.offer) {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.offer)
      );
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.send(JSON.stringify({ answer }));
    }

    if (data.answer) {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.answer)
      );
    }
  };

  // Создание SDP предложения (offer)
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.send(JSON.stringify({ offer }));

  // Обновление UI
  statusDiv.innerText = "Подключено";
  startBtn.disabled = true;
  stopBtn.disabled = false;
});

// Отключение
stopBtn.addEventListener("click", () => {
  peerConnection.close();
  socket.close();

  statusDiv.innerText = "Отключено";
  startBtn.disabled = false;
  stopBtn.disabled = true;
});