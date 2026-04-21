import { launch, getStream } from "puppeteer-stream";
import { spawn } from "child_process";

export async function startEgress(roomId: string, streamKey: string) {
  console.log(`[Egress] Starting bridge for Room: ${roomId}`);

  try {
    const browser = await launch({
      executablePath: "/usr/bin/google-chrome",
      defaultViewport: { width: 1280, height: 720 },
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--use-fake-ui-for-media-stream",
        "--allow-http-screen-capture", // 👈 important
        "--auto-select-desktop-capture-source=puppeteer-stream", // 👈 key
        "--enable-usermedia-screen-capturing",
      ],
    });

    const page = await browser.newPage();

    const egressUrl = `http://localhost:5173/?view=egress&room=${roomId}`;
    console.log(`[Egress] Navigating to ${egressUrl}`);
    await page.goto(egressUrl);

    const stream = await getStream(page, { audio: true, video: true });
    console.log("[Egress] Browser stream captured. Piping to FFmpeg...");

    const rtmpUrl = `rtmp://localhost:1935/live/${streamKey}`;
    const ffmpeg = spawn("ffmpeg", [
      "-f",
      "webm",
      "-i",
      "pipe:0",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-tune",
      "zerolatency",
      "-c:a",
      "aac",
      "-ar",
      "44100",
      "-f",
      "flv",
      rtmpUrl,
    ]);

    stream.pipe(ffmpeg.stdin);

    ffmpeg.stderr.on("data", (data) => {
      console.log(`[FFmpeg] ${data.toString()}`);
    });

    ffmpeg.on("close", (code) => {
      console.log(`[Egress] FFmpeg process exited with code ${code}`);
      browser.close();
    });

    return {
      stop: async () => {
        console.log("[Egress] Stopping bridge...");
        ffmpeg.kill("SIGINT");
        await browser.close();
      },
    };
  } catch (error) {
    console.error("[Egress] Error starting bridge:", error);
    throw error;
  }
}
