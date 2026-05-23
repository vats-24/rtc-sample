import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export const WatchView = ({ streamKey }: { streamKey: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const HLS_STREAM_URL = `http://localhost:3000/stream/${streamKey}/index.m3u8`;

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let hls: Hls;
    let retryTimer: NodeJS.Timeout;

    const startWatching = async () => {
      try {
        await fetch("http://localhost:3000/api/watch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: streamKey }),
        });
        initializePlayer();
      } catch (err) {
        setError("Failed to reach server to start stream.");
      }
    };

    const initializePlayer = () => {
      const video = videoRef.current;
      if (!video) return;

      if (Hls.isSupported()) {
        hls = new Hls({ lowLatencyMode: true, backBufferLength: 90 });
        hls.loadSource(HLS_STREAM_URL);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log("HLS Manifest loaded, ready to play.");
          setIsLoading(false); // Hide the loading screen
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            //  THE FIX: If the file isn't ready yet, wait 3 seconds and try again!
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              console.log("Stream booting up, retrying in 3 seconds...");
              retryTimer = setTimeout(() => {
                hls.startLoad();
              }, 3000);
            } else {
              console.error("Fatal HLS error encountered", data);
              setError("Stream is currently offline or unavailable.");
              setIsLoading(false);
            }
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = HLS_STREAM_URL;
        video.addEventListener("loadedmetadata", () => setIsLoading(false));
      }
    };

    startWatching();

    return () => {
      if (hls) hls.destroy();
      clearTimeout(retryTimer);
    };
  }, [HLS_STREAM_URL, streamKey]);

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
            {/* ✅ ADD THIS: Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-blue-400 font-semibold animate-pulse">
                    Starting live feed... (Takes ~5 seconds)
                  </p>
                </div>
              </div>
            )}
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
