import type { Producer, Router, Transport } from "mediasoup/node/lib/types";

interface Peer {
  id: string;
  name?: string;
  transport: Map<string, Transport>;
  producers: Map<string, Producer>;
  consumers: Map<string, Producer>;
}

export class Room {
  private peers: Map<string, Peer> = new Map();
  private router: Router;

  constructor(router: Router) {
    this.router = router;
  }

  addPeer(peerId: string, name?: string): Peer {
    if (this.peers.has(peerId)) {
      throw new Error(`Peer with id ${peerId} already exists`);
    }

    const peer: Peer = {
      id: peerId,
      name,
      transport: new Map(),
      producers: new Map(),
      consumers: new Map(),
    };

    this.peers.set(peerId, peer);

    return peer;
  }

  getPeer(peerId: string): Peer {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error(`Peer with id ${peerId} does not exist`);
    }
    return peer;
  }

  getRouter() {
    return this.router;
  }

  addTransport(peerId: string, transport: Transport): void {
    const peer = this.peers.get(peerId);

    peer?.transport.set(transport.id, transport);
  }

  addProducer(peerId: string, producer: Producer): void {
    const peer = this.peers.get(peerId);

    peer?.producers.set(producer.id, producer);
  }

  addConsumer(peerId: string, consumer: Consumer): void {
    const peer = this.getPeer(peerId);
    peer?.consumers.set(consumer.id, consumer);
  }

  removePeer(peerId: string) {
    const peer = this.peers.get(peerId);

    if (!peer) {
      throw new Error(`Peer with id ${peerId} does not exist`);
    }

    peer.transport.forEach((transport) => transport.close());

    this.peers.delete(peerId);
  }
}
