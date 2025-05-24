import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import { initializeMediaSoup } from "./mediasoup";
import { initializeHLsServer } from "./hls";
import { Room } from "./mediasoup/room";
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use("/stream", express.static("./media"));

io.attachApp(app);

(async () => {
  const { router } = await initializeMediaSoup();
  const room = new Room(router);

  const nms = initializeHLsServer();

  io.on("connection", (socket: Socket) => {
    console.log("Client connected:", socket.id);
  });
})();

//build iife
//
// initialize mediasoup
//initialize HLS server
// socket io connection handling
// s- Add the peer to the room
// st- handle transport creation request
// st- save transport
// st- listen to transport events

// s- connect transport to peer
// s- prduce media params transportId, kind rtpParameters

io.on("connection", (socket: Socket) => {
  console.log("Socket connected");

  //Add peer to the room

  //handle transport creation request
});

app.get("/", (req, res) => {
  res.send("Hello world!");
});

app.listen(3000, () => {
  console.log("Server started");
});
