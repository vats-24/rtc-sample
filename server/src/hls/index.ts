import fs from "fs";
import path from "path";
import NodeMediaServer from "node-media-server";
import { hlsConfig } from "../config";
import { spawn } from "child_process";

const media = path.join(process.cwd(), "media");
if (!fs.existsSync(media)) {
  fs.mkdirSync(media, { recursive: true });
}

export function initializeHLsServer() {
  const nms = new NodeMediaServer(hlsConfig);

  nms.run();

  nms.on("prePublish", (id, StreamPath, args) => {
    console.log("[NodeMediaServer] Stream Started", StreamPath);

    const streamKey = StreamPath.split("/")[2];
    const hlsOutputPath = path.join(media, streamKey);

    if (!fs.existsSync(hlsOutputPath)) {
      fs.mkdirSync(hlsOutputPath, { recursive: true });
    }

    const ffmpeg = spawn("ffmpeg", [
      "-i",
      `rtmp://localhost/live/${streamKey}`,
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-hls_time",
      "2",
      "-hls_list_size",
      "3",
      "-hls_flags",
      "delete_segments",
      "-f",
      "hls",
      path.join(hlsOutputPath, "index.m3u8"),
    ]);

    ffmpeg.stdout.on("data", (data) => {
      console.log(`FFmpeg stdout: ${data}`);
    });

    ffmpeg.stderr.on("data", (data) => {
      console.log(`FFmpeg stderr: ${data}`);
    });

    ffmpeg.on("close", (code) => {
      console.log(`FFmpeg process exited with code ${code}`);
    });
  });

  return nms;
}
