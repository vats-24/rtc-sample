import * as mediaSoup from "mediasoup";
import { mediaSoupConfig } from "../config";

let worker: mediaSoup.types.Worker;
let router: mediaSoup.types.Router;

export async function initializeMediaSoup() {
  worker = await mediaSoup.createWorker({
    logLevel: mediaSoupConfig.worker.logLevel as mediaSoup.types.WorkerLogLevel,
    logTags: mediaSoupConfig.worker.logTags as mediaSoup.types.WorkerLogTag[],
  });

  console.log("Mediasoup worker created");

  worker.on("died", () => {
    console.log("Mediasoup worker died");
    setTimeout(() => process.exit(1), 2000);
  });

  router = await worker.createRouter({
    mediaCodecs: mediaSoupConfig.router
      .mediaCodecs as mediaSoup.types.RtpCodecCapability[],
  });

  console.log("Mediasoup router created");

  return { worker, router };
}

export async function createWebRtcTransport() {
  const transport = await router.createWebRtcTransport({
    listenIps: [
      {
        ip: "0.0.0.0",
        announcedIp: "127.0.0.1",
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1000000,
  });

  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    },
  };
}
