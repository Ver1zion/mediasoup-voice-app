const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusDiv = document.getElementById("status");

let localStream;
let peers = {};  // Объект для хранения всех PeerConnection
let socket;

const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

// Функция для обработки сообщений WebSocket
function handleSocketMessage(data, senderId) {
  if (data.candidate) {
    console.log("Received ICE candidate: ", data.candidate);
    peers[senderId].addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => console.error(e));
  }

  if (data.offer) {
    console.log("Received offer from: ", senderId);
    if (!peers[senderId]) {
      peers[senderId] = new RTCPeerConnection(configuration);
      localStream.getTracks().forEach(track => peers[senderId].addTrack(track, localStream));

      peers[senderId].onicecandidate = (event) => {
        if (event.candidate) {
          console.log("Sending ICE candidate to ", senderId);
          socket.send(JSON.stringify({ candidate: event.candidate, senderId }));
        }
      };

      peers[senderId].ontrack = (event) => {
        console.log('Received remote track from: ', senderId);
        const audioElement = document.createElement("audio");
        audioElement.srcObject = event.streams[0];
        audioElement.autoplay = true;
        document.body.appendChild(audioElement);
      };
    }

    peers[senderId].setRemoteDescription(new RTCSessionDescription(data.offer)).then(async () => {
      const answer = await peers[senderId].createAnswer();
      await peers[senderId].setLocalDescription(answer);
      console.log("Sending answer to: ", senderId);
      socket.send(JSON.stringify({ answer, senderId }));
    });
  }

  if (data.answer) {
    console.log("Received answer from: ", senderId);
    peers[senderId].setRemoteDescription(new RTCSessionDescription(data.answer)).catch(e => console.error(e));
  }
}

// Инициализация WebRTC и подключение к WebSocket
startBtn.addEventListener("click", async () => {
  // Инициализация WebSocket
  socket = new WebSocket(`wss://${window.location.host}`);

  // Захват микрофона пользователя
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Ожидаем, пока WebSocket соединение станет OPEN
  socket.onopen = async () => {
    console.log("WebSocket соединение установлено");

    // Установить обработчик для получения сообщений
    socket.onmessage = async (message) => {
      const data = JSON.parse(message.data);
      handleSocketMessage(data.message, data.senderId);
    };

    // Создание SDP предложения (offer) после установления WebSocket соединения
    for (const clientId in peers) {
      const offer = await peers[clientId].createOffer();
      await peers[clientId].setLocalDescription(offer);
      console.log("Sending offer to: ", clientId);
      socket.send(JSON.stringify({ offer, clientId }));
    }
  };

  // Обновление UI
  statusDiv.innerText = "Подключено";
  startBtn.disabled = true;
  stopBtn.disabled = false;
});

// Отключение
stopBtn.addEventListener("click", () => {
  Object.values(peers).forEach(peer => peer.close()); // Закрываем все соединения
  socket.close();

  statusDiv.innerText = "Отключено";
  startBtn.disabled = false;
  stopBtn.disabled = true;
});