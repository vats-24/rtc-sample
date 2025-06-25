/*build a webrtc service class 

first declare the necessary variables
connect asynchronously to the server

build function to get user media using browser apis and write the object configs
return this.localStream


*/

import { io, Socket } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";

class WebRTCService {
  socket: Socket | null = null;
  device: mediasoupClient.types.Device | null = null;
  sendTransport: mediasoupClient.types.Transport | null = null;
  recvTransport: mediasoupClient.types.Transport | null = null;
  producers = new Map<string, mediasoupClient.types.Producer>();
  consumers = new Map<string, mediasoupClient.types.Consumer>();
  localStream: MediaStream | null = null;

  public onRemoteTrack:
    | ((
        track: MediaStreamTrack,
        stream: MediaStream,
        peerId: string,
        kind: "audio" | "video"
      ) => void)
    | null = null;

  async joinRoom(): Promise<void> {
    await this.connect();
    await this.createRecvTransport();
    await this.createSendTransport();
    await this.getLocalStream();

    console.log("Hurrah");

    const existingProducers = await this.getExistingProducers();

    console.log(existingProducers);

    existingProducers?.forEach((producer) => {
      this.subscribeToProducer(
        producer.producerId,
        producer.producerPeerId,
        producer.kind
      );
    });
  }

  async getExistingProducers() {
    return new Promise((resolve, reject) => {
      this.socket?.emit("getExistingProducers", (res: any) => {
        resolve(res.producers);
      });
    });
  }

  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.socket = io("http://localhost:3000");

      this.socket.on("connect", async () => {
        console.log("Connected to signalling server");
        try {
          await this._initializeMediasoupDevice();
          this._setupSocketEventListeners();

          resolve();
        } catch (error) {
          console.error("Initialization error:", error);
          this.close();
          reject(error);
        }
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
      async (data: {
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
          "New producer available: ID",
          producerId,
          producerPeerId,
          kind
        );
        await this.subscribeToProducer(producerId, producerPeerId, kind);
      }
    );

    this.socket.on("existingProducer", () => {});

    //peer-disconnected

    //consumer-closed
  }

  async createSendTransport() {
    return new Promise((resolve, reject) => {
      this.socket?.emit(
        "createWebRtcTransport",
        (response: { params?: any; error?: string }) => {
          if (response.error) {
            console.error("Error creating WebRTC transport:", response.error);
            return reject(new Error(response.error));
          }

          try {
            this.sendTransport = this.device!.createSendTransport(
              response?.params
            );

            this.sendTransport.on(
              "connect",
              async ({ dtlsParameters }, callback, errCallback) => {
                try {
                  this.socket!.emit(
                    "connectTransport",
                    {
                      transportId: this.sendTransport!.id,
                      dtlsParameters,
                    },
                    (res: { success?: boolean; error?: string }) => {
                      callback();
                    }
                  );
                } catch (error: any) {
                  errCallback(error);
                }
              }
            );

            this.sendTransport.on(
              "produce",
              async (params, callback, errCallback) => {
                try {
                  this.socket!.emit(
                    "produce",
                    {
                      transportId: this.sendTransport!.id,
                      kind: params.kind,
                      rtpParameters: params.rtpParameters,
                    },
                    (res: { id?: string; error?: string }) => {
                      callback({
                        id: res.id,
                      });
                    }
                  );
                } catch (error) {
                  errCallback(error);
                }
              }
            );

            resolve(this.sendTransport);
          } catch (error) {
            console.log(error);
          }
        }
      );
    });
  }

  async publishTrack(track: MediaStreamTrack, appData: any = {}) {
    if (!this.sendTransport) await this.createSendTransport();
    if (!this.sendTransport) throw new Error("Send transport not found");

    const currentAppData = {
      ...appData,
      trackId: track.id,
      peerId: this.socket?.id,
    };

    const producer = await this.sendTransport.produce({
      track,
      appData: currentAppData,
    });

    this.producers.set(producer.id, producer);

    producer.on("transportclose", () => {
      console.log(`Producer ${producer.id} transport closed.`);
      this.producers.delete(producer.id);
    });

    producer.on("trackended", () => {
      console.log(`Producer ${producer.id} track ended.`);
      this.producers.delete(producer.id);
    });

    return producer;
  }

  async publishLocalStream() {
    if (!this.localStream) await this.getLocalStream();
    if (!this.localStream) throw new Error("Local stream not found");
    for (const track of this.localStream.getTracks()) {
      try {
        await this.publishTrack(track, { kind: track.kind });
        console.log(`Successfully published ${track.kind} track`);
      } catch (error) {
        console.error(`Failed to publish ${track.kind} track:`, error);
      }
    }
  }

  async createRecvTransport() {
    console.log("Receiuveed called");
    return new Promise((resolve, reject) => {
      this.socket!.emit(
        "createWebRtcTransport",
        (response: { params?: any; error?: string }) => {
          if (response.error) {
            console.error("Error creating WebRTC transport:", response.error);
            return reject(new Error(response.error));
          }

          try {
            this.recvTransport = this.device!.createRecvTransport(
              response.params
            );

            this.recvTransport.on(
              "connect",
              async ({ dtlsParameters }, callback, errCallback) => {
                this.socket!.emit(
                  "connectTransport",
                  {
                    transportId: this.recvTransport!.id,
                    dtlsParameters,
                  },
                  () => {
                    callback();
                  }
                );
              }
            );

            resolve(this.recvTransport);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  //look in for appData here neither sent nor received
  async subscribeToProducer(
    producerId: string,
    producerPeerId: string,
    kind: "audio" | "video"
  ) {
    if (!this.socket || !this.device) throw new Error("Pre requisite not met");
    if (!this.recvTransport) await this.createRecvTransport();
    if (!this.recvTransport) throw new Error("Recv transport not found");

    const appData = { producerId, peerId: producerPeerId, kind };

    return new Promise((resolve, reject) => {
      this.socket!.emit(
        "consume",
        {
          transportId: this.recvTransport?.id,
          producerId,
          rtpCapabilities: this.device?.rtpCapabilities,
          appData,
        },
        async (res: { params?: any; error?: string }) => {
          if (res.error) return reject(new Error(res.error));

          try {
            const consumer = await this.recvTransport!.consume({
              id: res.params.id,
              producerId: res.params.producerId,
              kind: res.params.kind,
              rtpParameters: res.params.rtpParameters,
            });

            this.consumers.set(consumer.id, consumer);
            console.log(
              `Consuming ${kind} - Consumer ID: ${consumer.id}, Producer ID: ${producerId}, AppData:`,
              consumer.appData
            );

            consumer?.on("transportclose", () => {
              console.log(`Consumer ${consumer.id} transport closed.`);
              this.consumers.delete(consumer.id);
            });
            const { track } = consumer;
            const remoteStream = new MediaStream([track]); // Create a stream for this track
            this.onRemoteTrack?.(track, remoteStream, producerPeerId, kind);

            resolve(consumer);
          } catch (error) {
            console.error(
              `Error consuming producer ${producerId} (client-side):`,
              error
            );
            reject(error);
          }
        }
      );
    });
  }

  async getLocalStream() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      return this.localStream;
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

export default new WebRTCService();
