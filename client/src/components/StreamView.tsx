import { useEffect, useRef, useState } from "react";
import WebRTCService from "../services/webrtcService";
import webrtcService from "../services/webrtcService";

export const Stream = () => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const connect = async () => {
      try {
        await WebRTCService.connect();
        setIsConnected(true);
      } catch (error) {
        console.error("Error connecting to server:", error);
      }
    };

    connect();

    return () => {
      WebRTCService.close();
    };
  }, []);

  const togglePlay = async () => {
    if (cameraOn) {
      setCameraOn(false);
    } else {
      const stream = await WebRTCService.getLocalStream();
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const producedStreamToServer = await WebRTCService.publishLocalStream(); // const stream = localVideoRef.current?.play()
      console.log(WebRTCService.consumers);
    }
  };

  const watchUserMedia = async () => {
    if (cameraOn) {
      setCameraOn(false);
    } else {
    }
  };
  return (
    <div className="flex flex-col items-center gap-3 justify-center h-screen bg-white">
      <h1 className="text-3xl font-bold">Stream</h1>
      <div className="flex flex-row gap-2">
        <video ref={localVideoRef} autoPlay className="bg-amber-300"></video>
        <video ref={remoteVideoRef} className="bg-amber-200"></video>
      </div>
      <button
        onClick={() => togglePlay()}
        className="bg-blue-500 p-2 px-3 rounded-md"
      >
        Play
      </button>
    </div>
  );
};
