const os = require("os");
const path = require("path");
console.log(path.join(process.cwd(), "media"));
console.log(os.cpus().length);
// client/src/services/webrtcService.ts
import { io, Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';

// Ensure this URL matches your backend server's address and port for Socket.IO
const SERVER_URL = 'http://localhost:3000'; // Assuming your backend runs on port 3000 as per your example. Adjust if different.

class WebRTCService {
  socket: Socket | null = null;
  device: mediasoupClient.Device | null = null;
  sendTransport: mediasoupClient.types.Transport | null = null;
  recvTransport: mediasoupClient.types.Transport | null = null;
  producers = new Map<string, mediasoupClient.types.Producer>(); // producer.id -> Producer
  consumers = new Map<string, mediasoupClient.types.Consumer>(); // consumer.id -> Consumer
  localStream: MediaStream | null = null;

  // Callbacks for UI updates
  public onRemoteTrack: ((track: MediaStreamTrack, stream: MediaStream, peerId: string, kind: 'audio' | 'video') => void) | null = null;
  public onProducerClosed: ((producerId: string, appData?: any) => void) | null = null;
  public onConsumerClosed: ((consumerId: string, peerId: string, appData?: any) => void) | null = null;
  public onPeerLeft: ((peerId: string) => void) | null = null;

  /**
   * Connects to the signaling server and initializes the Mediasoup device.
   */
  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.socket = io(SERVER_URL);

      this.socket.on('connect', async () => {
        console.log('Connected to signaling server. Socket ID:', this.socket?.id);
        try {
          await this._initializeMediasoupDevice();
          this._setupSocketEventListeners();
          resolve();
        } catch (error) {
          console.error('Initialization error:', error);
          this.close(); // Clean up on failure
          reject(error);
        }
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from signaling server');
        // Consider more robust cleanup or reconnection logic here
        this.producers.forEach(p => p.close());
        this.consumers.forEach(c => c.close());
        // UI should be notified
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });
    });
  }

  /**
   * Fetches router RTP capabilities and loads the Mediasoup device.
   * Requires a 'getRouterRtpCapabilities' event handler on the backend.
   */
  private async _initializeMediasoupDevice(): Promise<void> {
    if (!this.socket) throw new Error('Socket not connected');

    return new Promise((resolve, reject) => {
      this.socket!.emit('getRouterRtpCapabilities', (routerRtpCapabilities: mediasoupClient.types.RtpCapabilities | { error: string }) => {
        if (!routerRtpCapabilities || (routerRtpCapabilities as { error: string }).error) {
          const errMsg = `Failed to get Router RTP Capabilities: ${(routerRtpCapabilities as { error: string })?.error || 'Unknown error'}`;
          console.error(errMsg);
          return reject(new Error(errMsg));
        }
        
        console.log('Received Router RTP Capabilities:', routerRtpCapabilities);
        try {
          this.device = new mediasoupClient.Device();
          this.device.load({ routerRtpCapabilities: routerRtpCapabilities as mediasoupClient.types.RtpCapabilities })
            .then(() => {
              console.log('Mediasoup device loaded successfully.');
              resolve();
            })
            .catch(error => {
              console.error('Error loading Mediasoup device:', error);
              reject(error);
            });
        } catch (error) {
          console.error('Error creating/loading Mediasoup device:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * Sets up listeners for server-initiated Socket.IO events.
   */
  private _setupSocketEventListeners(): void {
    if (!this.socket) return;

    // Listen for new producers from other peers
    this.socket.on('newProducer', async (data: { producerId: string, producerPeerId: string, kind: 'audio' | 'video', appData?: any }) => {
      const { producerId, producerPeerId, kind, appData } = data;
      if (producerPeerId === this.socket?.id) {
        console.log(`Ignoring newProducer event for own producer ${producerId}`);
        return; // It's our own producer
      }
      console.log(`New producer available: ID ${producerId}, Peer ${producerPeerId}, Kind ${kind}`);
      await this.subscribeToProducer(producerId, producerPeerId, kind, appData);
    });

    // Listen for peers disconnecting
    this.socket.on('peerDisconnected', (data: { peerId: string }) => {
      const { peerId } = data;
      console.log(`Peer ${peerId} disconnected`);
      this.consumers.forEach(consumer => {
        if (consumer.appData.peerId === peerId || consumer.appData.producerPeerId === peerId) {
          console.log(`Closing consumer ${consumer.id} for disconnected peer ${peerId}`);
          consumer.close(); // This will trigger 'transportclose' and 'producerclose' if applicable
          // No need to delete from map here, 'consumerclose' or transportclose events handle it.
        }
      });
      this.onPeerLeft?.(peerId);
    });

    // Listen for server indicating a consumer should be closed (e.g., producer it was consuming closed)
    this.socket.on('consumerClosed', (data: { consumerId: string, producerId?: string }) => {
        console.log(`Server instructed to close consumer: ${data.consumerId}`);
        const consumer = this.consumers.get(data.consumerId);
        if (consumer) {
            consumer.close(); // Triggers local cleanup via event listeners on consumer
            // this.consumers.delete(data.consumerId); handled by consumer events
            this.onConsumerClosed?.(consumer.id, consumer.appData.peerId || consumer.appData.producerPeerId, consumer.appData);
        }
    });
  }

  /**
   * Gets audio/video stream from user's device.
   */
  async getLocalStream(): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      console.log('Local stream obtained:', this.localStream);
      return this.localStream;
    } catch (error) {
      console.error('Error getting user media:', error);
      throw error;
    }
  }

  /**
   * Creates a WebRTC transport on the server for sending media.
   */
  async createSendTransport(): Promise<mediasoupClient.types.Transport> {
    if (!this.socket || !this.device) throw new Error('Prerequisites not met: Socket disconnected or device not loaded.');
    if (this?.sendTransport) {
        console.warn('Send transport already exists.');
        return this.sendTransport;
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit('createWebRtcTransport', (response: { params?: any, error?: string }) => {
        if (response.error || !response.params) {
          const errMsg = `Error creating send transport (server): ${response.error || 'No params received'}`;
          console.error(errMsg);
          return reject(new Error(errMsg));
        }
        
        try {
          this.sendTransport = this.device!.createSendTransport(response.params);
          console.log('Send transport created (client-side):', this.sendTransport.id);

          // Event: 'connect' - Fired when transport needs to connect to Mediasoup router
          this.sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
            this.socket!.emit('connectTransport', { transportId: this.sendTransport!.id, dtlsParameters }, (res: { success?: boolean, error?: string }) => {
              if (res.error || !res.success) return errback(new Error(res.error || 'Transport connect failed'));
              callback();
            });
          });

          // Event: 'produce' - Fired when transport.produce() is called
          this.sendTransport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
            this.socket!.emit('produce', { transportId: this.sendTransport!.id, kind, rtpParameters, appData }, (res: { id?: string, error?: string }) => {
              if (res.error || !res.id) return errback(new Error(res.error || 'Produce failed on server'));
              callback({ id: res.id }); // Provide server-side producer ID to mediasoup-client
            });
          });

          // Event: 'connectionstatechange' - Monitors transport connection status
          this.sendTransport.on('connectionstatechange', (state) => {
            console.log(`Send transport state: ${state}`);
            if (state === 'failed' || state === 'closed' || state === 'disconnected') {
              console.error(`Send transport connection issue: ${state}`);
              // Potentially close related producers or notify UI
            }
          });
          resolve(this.sendTransport);
        } catch (error) {
          console.error('Error creating send transport (client-side):', error);
          reject(error);
        }
      });
    });
  }

  /**
   * Publishes a single media track (audio or video).
   */
  async publishTrack(track: MediaStreamTrack, appData: any = {}): Promise<mediasoupClient.types.Producer> {
    if (!this.sendTransport) await this.createSendTransport();
    if (!this.sendTransport || !track) throw new Error('Send transport or track not available.');

    const currentAppData = { ...appData, trackId: track.id, peerId: this.socket?.id };
    const producer = await this.sendTransport.produce({ track, appData: currentAppData });
    
    this.producers.set(producer.id, producer);
    console.log(`Producing ${track.kind} - Producer ID: ${producer.id}, AppData:`, currentAppData);

    producer.on('transportclose', () => {
      console.log(`Producer ${producer.id} transport closed.`);
      this.producers.delete(producer.id);
      this.onProducerClosed?.(producer.id, producer.appData);
    });
    producer.on('trackended', () => {
      console.log(`Producer ${producer.id} track ended.`);
      this.closeProducer(producer.id); // Gracefully close and notify
    });

    return producer;
  }

  /**
   * Publishes all tracks from the local stream.
   */
  async publishLocalStream(): Promise<void> {
    if (!this.localStream) await this.getLocalStream();
    if (!this.localStream) throw new Error("Local stream couldn't be obtained.");

    for (const track of this.localStream.getTracks()) {
        try {
            await this.publishTrack(track, { kind: track.kind });
        } catch (error) {
            console.error(`Failed to publish ${track.kind} track:`, error);
        }
    }
  }

  /**
   * Closes a specific producer.
   */
  async closeProducer(producerId: string): Promise<void> {
    const producer = this.producers.get(producerId);
    if (producer) {
      console.log(`Closing producer: ${producerId}`);
      producer.close(); // This triggers 'transportclose' which handles deletion from map
      // No need to emit to server, backend handles producer closure via transport events
      // or if producer.appData contains info, that's passed to onProducerClosed
      this.onProducerClosed?.(producerId, producer.appData);
    }
  }

  /**
   * Creates a WebRTC transport on the server for receiving media.
   */
  async createRecvTransport(): Promise<mediasoupClient.types.Transport> {
    if (!this.socket || !this.device) throw new Error('Prerequisites not met: Socket disconnected or device not loaded.');
     if (this?.recvTransport) {
        console.warn('Receive transport already exists.');
        return this?.recvTransport;
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit('createWebRtcTransport', (response: { params?: any, error?: string }) => {
        if (response.error || !response.params) {
          const errMsg = `Error creating recv transport (server): ${response.error || 'No params received'}`;
          console.error(errMsg);
          return reject(new Error(errMsg));
        }

        try {
          this.recvTransport = this.device!.createRecvTransport(response.params);
          console.log('Recv transport created (client-side):', this.recvTransport.id);

          this.recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
            this.socket!.emit('connectTransport', { transportId: this.recvTransport!.id, dtlsParameters }, (res: { success?: boolean, error?: string }) => {
              if (res.error || !res.success) return errback(new Error(res.error || 'Transport connect failed'));
              callback();
            });
          });

          this.recvTransport.on('connectionstatechange', (state) => {
            console.log(`Recv transport state: ${state}`);
             if (state === 'failed' || state === 'closed' || state === 'disconnected') {
              console.error(`Recv transport connection issue: ${state}`);
              // Potentially close related consumers or notify UI
            }
          });
          resolve(this.recvTransport);
        } catch (error) {
          console.error('Error creating recv transport (client-side):', error);
          reject(error);
        }
      });
    });
  }

  /**
   * Subscribes to (consumes) a remote producer's media.
   * Requires a 'consume' event handler on the backend.
   */
  async subscribeToProducer(producerId: string, producerPeerId: string, kind: 'audio' | 'video', remoteAppData: any = {}): Promise<mediasoupClient.types.Consumer> {
    if (!this.socket || !this.device) throw new Error('Prerequisites not met.');
    if (!this.recvTransport) await this.createRecvTransport();
    if (!this.recvTransport) throw new Error('Receive transport not available.');
    
    const appData = { producerId, peerId: producerPeerId, kind, ...(remoteAppData || {}) };

    return new Promise((resolve, reject) => {
      this.socket!.emit('consume', {
        transportId: this.recvTransport!.id,
        producerId,
        rtpCapabilities: this.device!.rtpCapabilities, // Consumer's capabilities
        appData // Pass our constructed appData
      }, async (response: { params?: any, error?: string }) => {
        if (response.error || !response.params) {
          const errMsg = `Error consuming producer ${producerId} (server): ${response.error || 'No params received'}`;
          console.error(errMsg);
          return reject(new Error(errMsg));
        }

        try {
          const consumer = await this.recvTransport!.consume({
            id: response.params.id,
            producerId: response.params.producerId,
            kind: response.params.kind,
            rtpParameters: response.params.rtpParameters,
            appData // Use the appData which includes producerPeerId and original producerId
          });

          this.consumers.set(consumer.id, consumer);
          console.log(`Consuming ${kind} - Consumer ID: ${consumer.id}, Producer ID: ${producerId}, AppData:`, consumer.appData);

          consumer.on('transportclose', () => {
            console.log(`Consumer ${consumer.id} transport closed.`);
            this.consumers.delete(consumer.id);
            this.onConsumerClosed?.(consumer.id, consumer.appData.peerId || consumer.appData.producerPeerId, consumer.appData);
          });
          consumer.on('producerclose', () => {
            console.log(`Consumer ${consumer.id} producer closed (remotely).`);
            consumer.close(); // Ensure client-side consumer is closed
            this.consumers.delete(consumer.id); // Ensure removed from map
            this.onConsumerClosed?.(consumer.id, consumer.appData.peerId || consumer.appData.producerPeerId, consumer.appData);
          });
          consumer.on('trackended', () => {
            console.log(`Consumer ${consumer.id} track ended.`);
            // Typically handled by 'producerclose', but good to log.
            // UI might need to react here as well if producerclose isn't immediate.
          });

          // Resume the consumer if it's paused (Mediasoup consumers often start paused)
          if (consumer.paused) {
            try {
                // Option 1: Client directly resumes if server policy allows
                await consumer.resume();
                // Option 2: Ask server to resume (if server needs to track state or bill)
                // this.socket!.emit('resumeConsumer', { consumerId: consumer.id }, (res: any) => {
                //   if (res.error) console.error(`Error resuming consumer ${consumer.id}:`, res.error);
                //   else console.log(`Consumer ${consumer.id} resumed via server.`);
                // });
              console.log(`Consumer ${consumer.id} resumed.`);
            } catch (e) {
              console.error(`Failed to resume consumer ${consumer.id}:`, e);
            }
          }

          const { track } = consumer;
          const remoteStream = new MediaStream([track]); // Create a stream for this track
          this.onRemoteTrack?.(track, remoteStream, producerPeerId, kind);
          
          resolve(consumer);
        } catch (error) {
          console.error(`Error consuming producer ${producerId} (client-side):`, error);
          reject(error);
        }
      });
    });
  }
  
  /**
   * Closes a specific consumer.
   */
  async closeConsumer(consumerId: string): Promise<void> {
    const consumer = this.consumers.get(consumerId);
    if (consumer) {
        console.log(`Closing consumer: ${consumerId}`);
        consumer.close(); // Triggers 'transportclose' which handles deletion
        this.onConsumerClosed?.(consumerId, consumer.appData.peerId || consumer.appData.producerPeerId, consumer.appData);
    }
  }

  /**
   * Closes all connections, stops streams, and cleans up resources.
   */
  close(): void {
    console.log('Closing WebRTCService...');
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.producers.forEach(producer => producer.close());
    this.producers.clear();

    this.consumers.forEach(consumer => consumer.close());
    this.consumers.clear();

    if (this.sendTransport) {
      this.sendTransport.close();
      this.sendTransport = null;
    }
    if (this.recvTransport) {
      this.recvTransport.close();
      this.recvTransport = null;
    }

    // Mediasoup device doesn't have a .close() method itself.
    this.device = null;

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    console.log('WebRTCService closed.');
  }
}

export default new WebRTCService();