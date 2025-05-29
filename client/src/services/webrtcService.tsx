/*build a webrtc service class 

first declare the necessary variables
connect asynchronously to the server

build function to get user media using browser apis and write the object configs
return this.localStream


*/

import { io, Socket } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";

export class WebRTCService {
  socket: Socket | null = null;
  device: mediasoupClient.types.Device | null = null;
  sendTransport: mediasoupClient.types.Transport | null = null;
  recvTransport: mediasoupClient.types.Transport | null = null;
  producers = new Map<string, mediasoupClient.types.Producer>();
  consumers = new Map<string, mediasoupClient.types.Consumer>();
  localStream: MediaStream | null = null;

  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.socket = io("http://localhost:3000");

      this.socket.on("connect", async () => {
        console.log("Connected to signalling server");
        // try {
        // } catch (error) {}
      });

      this.socket.on("disconnect", () => {
        console.log("Disconnected from signalling server");
        this.producers.forEach((p) => p.close());
        this.consumers.forEach((c) => c.close());
      });

      this.socket.on("connect_error", (error) => {
        console.log("Error connecting to signalling server:", error);
        reject(error);
      });
    });
  }

  private async _initializeMediasoupDevice() {
    if (!this.socket) throw new Error("Socket not connected");

    return new Promise<void>((resolve, reject) => {
      this.socket!.emit(
        "getRouterRtpCapabilities",
        (
          routerRtpCapabilities:
            | mediasoupClient.types.RtpCapabilities
            | {
                error: string;
              }
        ) => {
          if (
            !routerRtpCapabilities ||
            (routerRtpCapabilities as { error: string }).error
          ) {
            console.error(
              "Error getting router RTP capabilities:",
              routerRtpCapabilities
            );
            return reject(new Error("Error getting router RTP capabilities"));
          }

          console.log(
            "Received router RTP capabilities:",
            routerRtpCapabilities
          );

          try {
            this.device = new mediasoupClient.Device();
            this.device
              .load({
                routerRtpCapabilities:
                  routerRtpCapabilities as mediasoupClient.types.RtpCapabilities,
              })
              .then(() => {
                console.log("Mediasoup device loaded successfully");
                resolve();
              });
          } catch (error) {
            console.error("Error loading mediasoup device:", error);
            reject(error);
          }
        }
      );
    });
  }

  private _setupSocketEventListeners(): void {
    if (!this.socket) return;

    this.socket.on(
      "newProducer",
      (data: {
        producerId: string;
        producerPeerId: string;
        kind: "audio" | "video";
      }) => {
        const { producerId, producerPeerId, kind } = data;

        if (producerId === this.socket?.id) {
          console.log("Ignoring producer event from self");
          return;
        }
        console.log(
          "New producer available:",
          producerId,
          producerPeerId,
          kind
        );
      }
    );
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

  close(): void {
    console.log("Closing WebRTC service");
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.producers.forEach((p) => p.close());
    this.producers.clear();

    this.consumers.forEach((c) => c.close());
    this.consumers.clear();

    if (this.sendTransport) {
      this.sendTransport.close();
      this.sendTransport = null;
    }
    if (this.recvTransport) {
      this.recvTransport.close();
      this.recvTransport = null;
    }

    this.device = null;

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    console.log("WebRTC service closed");
  }
}
