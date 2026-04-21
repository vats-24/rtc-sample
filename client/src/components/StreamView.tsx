import { useEffect, useRef, useState } from "react";
import WebRTCService from "../services/webrtcService";

type StreamProps = {
  isBot?: boolean;
};

export const Stream = ({ isBot = false }: StreamProps) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);

  const [remotePeers, setRemotePeers] = useState<string[]>([]);
  const remoteStreams = useRef<Map<string, MediaStream>>(new Map());

  useEffect(() => {
    const initRTC = async () => {
      try {
        await WebRTCService.joinRoom();
        setIsConnected(true);
      } catch (error) {
        console.error("Failed to join room:", error);
      }
    };

    WebRTCService.onRemoteTrack = (track, stream, peerId) => {
      console.log(`Receiving ${track.kind} track from ${peerId}`);

      let remoteStream = remoteStreams.current.get(peerId);

      if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteStreams.current.set(peerId, remoteStream);
        setRemotePeers((prev) => [...new Set([...prev, peerId])]);
      }

      remoteStream.addTrack(track);
    };

    initRTC();

    return () => {
      WebRTCService.close();
    };
  }, []);

  const handleToggleCamera = async () => {
    if (cameraOn) {
      const stream = localVideoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach((track) => track.stop());
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setCameraOn(false);
    } else {
      try {
        await WebRTCService.publishLocalStream();
        const stream = await WebRTCService.getLocalStream();
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setCameraOn(true);
      } catch (err) {
        console.error("Error publishing stream:", err);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-10 min-h-screen bg-gray-100">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800">SFU Video Room</h1>
        <p className="text-sm text-gray-500">
          Status: {isConnected ? "Connected" : "Connecting..."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-6xl">
        <div className="relative rounded-xl overflow-hidden bg-black shadow-lg aspect-video">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-xs">
            You (Local)
          </div>
        </div>

        {remotePeers.map((peerId) => (
          <RemoteVideoSlot
            key={peerId}
            peerId={peerId}
            stream={remoteStreams.current.get(peerId)!}
          />
        ))}
      </div>

      {!isBot && (
        <button
          onClick={handleToggleCamera}
          className={`${
            cameraOn ? "bg-red-500" : "bg-blue-600"
          } text-white px-8 py-3 rounded-full font-semibold transition-all hover:scale-105 shadow-md`}
        >
          {cameraOn ? "Stop Camera" : "Start Camera"}
        </button>
      )}
    </div>
  );
};

const RemoteVideoSlot = ({
  peerId,
  stream,
}: {
  peerId: string;
  stream: MediaStream;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative rounded-xl overflow-hidden bg-slate-800 shadow-lg aspect-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-xs">
        Peer: {peerId.slice(0, 5)}
      </div>
    </div>
  );
};
