const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusDiv = document.getElementById("status");

let localStream;
let peerConnection;
let socket;

const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

// Функция для обработки сообщений WebSocket
function handleSocketMessage(data) {
  // Обработка ICE кандидатов
  if (data.candidate) {
    console.log("Received ICE candidate: ", data.candidate);
    peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => console.error(e));
  }

  // Обработка SDP предложений (offer/answer)
  if (data.offer) {
    console.log("Received offer: ", data.offer.sdp);
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer)).then(async () => {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log("Sending answer: ", peerConnection.localDescription.sdp);
      socket.send(JSON.stringify({ answer }));
    });
  }

  if (data.answer) {
    console.log("Received answer: ", data.answer.sdp);
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(e => console.error(e));
  }
}

// Инициализация WebRTC и подключение к WebSocket
startBtn.addEventListener("click", async () => {
  // Инициализация WebSocket
  socket = new WebSocket(`wss://${window.location.host}`);

  // Захват микрофона пользователя
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Инициализация PeerConnection для WebRTC
  peerConnection = new RTCPeerConnection(configuration);
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  // Обработка ICE кандидатов
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("Sending ICE candidate: ", event.candidate);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ candidate: event.candidate }));
      } else {
        console.error("WebSocket не готов к отправке, статус: ", socket.readyState);
      }
    }
  };

  // Обработка полученного медиапотока (входящего аудио)
  peerConnection.ontrack = (event) => {
    console.log('Received remote track');
    const audioElement = document.createElement("audio");
    audioElement.srcObject = event.streams[0];
    audioElement.autoplay = true;
    document.body.appendChild(audioElement); // добавляем элемент на страницу для воспроизведения
  };

  // Ожидаем, пока WebSocket соединение станет OPEN
  socket.onopen = async () => {
    console.log("WebSocket соединение установлено");

    // Создание SDP предложения (offer) после установления WebSocket соединения
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log("Sending offer: ", peerConnection.localDescription.sdp);
    socket.send(JSON.stringify({ offer }));
  };

  // Обработка сообщений WebSocket
  socket.onmessage = async (message) => {
    // Если сообщение пришло в формате Blob, конвертируем его в текст
    if (message.data instanceof Blob) {
      const text = await message.data.text();
      const data = JSON.parse(text); // парсим JSON из текста
      handleSocketMessage(data); // обработка сообщения
    } else {
      const data = JSON.parse(message.data);
      handleSocketMessage(data); // обработка сообщения
    }
  };

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
