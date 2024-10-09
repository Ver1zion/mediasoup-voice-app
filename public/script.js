// client.js
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

// Инициализация WebRTC и подключение к WebSocket
startBtn.addEventListener("click", async () => {
  socket = new WebSocket(`wss://${window.location.host}`);

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  localStream.getTracks().forEach(track => {
    console.log(`Track kind: ${track.kind}, enabled: ${track.enabled}`);
  });

  peerConnection = new RTCPeerConnection(configuration);
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

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

  peerConnection.ontrack = (event) => {
    console.log('Received remote track');
    const audioElement = document.createElement("audio");
    audioElement.srcObject = event.streams[0];
    audioElement.autoplay = true;
    document.body.appendChild(audioElement); // добавляем элемент на страницу
  };

  socket.onopen = async () => {
    console.log("WebSocket соединение установлено");

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log("Sending offer: ", peerConnection.localDescription.sdp);
    socket.send(JSON.stringify({ offer }));
  };

  socket.onmessage = async (message) => {
    const data = JSON.parse(message.data);

    if (data.candidate) {
      console.log("Received ICE candidate: ", data.candidate);
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }

    if (data.offer) {
      console.log("Received offer: ", data.offer.sdp);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log("Sending answer: ", peerConnection.localDescription.sdp);
      socket.send(JSON.stringify({ answer }));
    }

    if (data.answer) {
      console.log("Received answer: ", data.answer.sdp);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  };

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