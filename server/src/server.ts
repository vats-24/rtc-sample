import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import { createWebRtcTransport, initializeMediaSoup } from "./mediasoup";
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

    try {
      room.addPeer(socket.id);
    } catch (error) {
      console.error("Error adding peer to room:", error);
    }

    socket.on("createWebRtcTransport", async (callback) => {
      try {
        const { transport, params } = await createWebRtcTransport();

        room.addTransport(socket.id, transport);

        transport.on("dtlsstatechange", (dtlsState) => {
          if (dtlsState == "closed") {
            transport.close();
          }
        });

        transport.on("@close", () => {
          console.log("Transport closed");
        });

        callback({ params });
      } catch (error) {
        console.error("Error creating WebRTC transport:", error);
        callback({ error: error?.message });
      }
    });

    socket.on(
      "connectTransport",
      async ({ transportId, dtlsParameters }, callback) => {
        try {
          const peer = room.getPeer(socket.id);
          const transport = peer.transport.get(transportId);

          if (!transport) {
            throw new Error(`Transport with ID ${transportId} not found`);
          }

          await transport.connect({ dtlsParameters });
          callback({ success: true });
        } catch (error: any) {
          console.error("Error connecting transport:", error);
          callback({ error: error.message });
        }
      }
    );
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

app.get("/", (req, res) => {
  res.send("Hello world!");
});

app.listen(3000, () => {
  console.log("Server started");
});
