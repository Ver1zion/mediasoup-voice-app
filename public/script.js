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

//////////////////////// тут хуета снизу

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusDiv = document.getElementById("status");
const canvas = document.getElementById("volumeMeter");
const canvasCtx = canvas.getContext("2d");

let localStream;
let peerConnection;
let socket;
let audioContext;
let analyser;
let dataArray;

const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

// Функция для визуализации уровня громкости
function visualizeVolume() {
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;

  analyser.fftSize = 256;
  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  function draw() {
    requestAnimationFrame(draw);

    analyser.getByteTimeDomainData(dataArray);
    canvasCtx.fillStyle = "rgb(200, 200, 200)";
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = "rgb(0, 0, 0)";

    canvasCtx.beginPath();

    let sliceWidth = WIDTH * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      let v = dataArray[i] / 128.0;
      let y = v * HEIGHT / 2;

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
  }

  draw();
}

// Инициализация WebRTC и подключение к WebSocket
startBtn.addEventListener("click", async () => {
  socket = new WebSocket(`wss://${window.location.host}`);

  // Захват микрофона пользователя
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Инициализация AudioContext для анализа уровня громкости
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();

  const source = audioContext.createMediaStreamSource(localStream);
  source.connect(analyser);

  visualizeVolume(); // Визуализируем уровень громкости

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
