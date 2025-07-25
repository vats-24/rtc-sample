import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import { createWebRtcTransport, initializeMediaSoup } from "./mediasoup";
import { initializeHLsServer } from "./hls";
import { Room } from "./mediasoup/room";
import { resolve } from "path";
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

    socket.on("getExistingProducers", async (callback) => {
      const producersList: {
        producerId: string;
        producerPeerId: string;
        kind: "audio" | "video";
      }[] = [];
      try {
        if (!room || !room.peers) {
          console.error("Room or peers not initialized");
          return callback({
            producers: [],
            error: "Server error room is not ready",
          });
        }
        for (const [otherPeerId, peer] of room.peers.entries()) {
          if (otherPeerId === socket.id) continue;

          for (const [producerId, producer] of peer.producers.entries()) {
            producersList.push({
              producerId,
              producerPeerId: otherPeerId,
              kind: producer.kind,
            });
          }
        }

        callback({ producers: producersList });
      } catch (error: any) {
        console.error(
          `[Socket ${socket.id}] Error in getExistingProducers:`,
          error
        );
        callback({
          producers: [],
          error: error.message || "Failed to get existing producers",
        });
      }
    });

    socket.on("getRouterRtpCapabilities", async (callback) => {
      try {
        const routerRtpCapabilities = router.rtpCapabilities;
        callback(routerRtpCapabilities);
      } catch (error) {
        console.error("Error getting router RTP capabilities:", error);
        callback(error);
      }
    });

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
      } catch (error: any) {
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

    socket.on(
      "produce",
      async ({ transportId, kind, rtpParameters }, callback) => {
        try {
          const peer = room.getPeer(socket.id);
          const transport = peer.transport.get(transportId);

          if (!transport) {
            throw new Error(`Transport with ID ${transportId} not found`);
          }

          const producer = await transport.produce({ kind, rtpParameters });

          room.addProducer(socket.id, producer);

          socket.broadcast.emit("newProducer", {
            producerId: producer.id,
            producerPeerId: socket.id,
            kind,
          });

          callback({ id: producer.id });
        } catch (error: any) {
          console.error("Error producing:", error);
          callback({ error: error.message });
        }
      }
    );

    socket.on(
      "consume",
      async ({ transportId, producerId, rtpCapabilities }, callback) => {
        try {
          const peer = room.getPeer(socket.id);
          const transport = peer.transport.get(transportId);

          if (!transport) {
            throw new Error(`Transport with ID ${transportId} not found`);
          }

          const consumer = await transport.consume({
            producerId,
            rtpCapabilities,
          });

          room.addConsumer(socket.id, consumer);

          callback({
            params: {
              id: consumer.id,
              producerId: consumer.producerId,
              kind: consumer.kind,
              rtpParameters: consumer.rtpParameters,
            },
          });
        } catch (error: any) {
          console.error(`[Socket ${socket.id}] Error in consume:`, error);
          callback({
            error: error.message,
          });
        }
      }
    );

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);

      try {
        room.removePeer(socket.id);

        socket.broadcast.emit("peerDisconnected", { peerId: socket.id });
      } catch (error) {
        console.error("Error removing peer from room:", error);
      }
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
})();
