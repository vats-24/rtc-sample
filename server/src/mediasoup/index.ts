import mediaSoup from "mediasoup";
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
    setTimeout(() => process.exit(1), 1000);
  });

  router = await worker.createRouter({
    mediaCodecs: mediaSoupConfig.router
      .mediaCodecs as mediaSoup.types.RtpCodecCapability[],
  });

  console.log("Mediasoup router created");

  return { worker, router };
}

export async function createWebRtcTransport() {
  const transport = await worker.createWebRtcServer({
    listenInfos: [
      {
        protocol: "udp",
        ip: "0.0.0.0",
        announcedAddress: "127.0.0.1",
        portRange: mediaSoupConfig.worker.portRange,
      },
      {
        protocol: "tcp",
        ip: "0.0.0.0",
        announcedAddress: "127.0.0.1",
        portRange: mediaSoupConfig.worker.portRange,
      },
    ],
  });

  return {
    transport,
  };
}
