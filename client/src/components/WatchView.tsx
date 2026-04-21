import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export const WatchView = ({ streamKey }: { streamKey: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const HLS_STREAM_URL = `http://localhost:3000/stream/${streamKey}/index.m3u8`;

  useEffect(() => {
    let hls: Hls;

    const initializePlayer = () => {
      const video = videoRef.current;
      if (!video) return;

      if (Hls.isSupported()) {
        hls = new Hls({
          lowLatencyMode: true,
          backBufferLength: 90,
        });

        hls.loadSource(HLS_STREAM_URL);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log("HLS Manifest loaded, ready to play.");
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error("Fatal HLS error encountered", data);
            setError("Stream is currently offline or unavailable.");
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = HLS_STREAM_URL;
        video.addEventListener("loadedmetadata", () => {
          console.log("Native HLS loaded.");
        });
      } else {
        setError("Your browser does not support HLS playback.");
      }
    };

    initializePlayer();

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [HLS_STREAM_URL]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-4xl w-full flex flex-col gap-4">
        <header className="flex justify-between items-center bg-slate-800 p-4 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold">Live Broadcast</h1>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
            <span className="text-red-400 font-semibold tracking-wide">
              LIVE
            </span>
          </div>
        </header>

        {error ? (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-8 rounded-lg text-center">
            {error}
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden bg-black shadow-2xl aspect-video">
            <video ref={videoRef} className="w-full h-full" controls={false} />
          </div>
        )}

        <div className="flex justify-center mt-4">
          <button
            onClick={handlePlayPause}
            disabled={!!error}
            className={`px-8 py-3 rounded-full font-bold transition-transform ${
              error
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-blue-600 hover:scale-105 hover:bg-blue-500"
            }`}
          >
            {isPlaying ? "Pause Stream" : "Join Stream"}
          </button>
        </div>
      </div>
    </div>
  );
};
