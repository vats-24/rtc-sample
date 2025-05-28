/*build a webrtc service class 

first declare the necessary variables
connect asynchronously to the server

build function to get user media using browser apis and write the object configs
returnt this.localStream


*/

import { io, Socket } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";

class WebRTCService {
  socket: Socket | null = null;
  device: mediasoupClient.types.Device | null = null;
  sendTransport: mediasoupClient.types.Transport | null = null;
  recvTransport: mediasoupClient.types.Transport | null = null;
  producers = new Map();
  consumers = new Map();
  localStream: MediaStream | null = null;

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = io("http://localhost:3000");

      this.socket.on("connect", () => {
        console.log("Connected to signalling server");
      });

      this.socket.on("disconnect", () => {
        console.log("Disconnected from signalling server");
      });

      this.socket.on("connect_error", (error) => {
        console.log("Error connecting to signalling server:", error);
        reject(error);
      });
    });
  }

  async getUserMedia() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
    } catch (error) {
      console.error("Error getting user media:", error);
      throw error;
    }
  }
}
