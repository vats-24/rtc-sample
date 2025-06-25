import { useEffect, useRef, useState } from "react";
import WebRTCService from "../services/webrtcService";

export const Stream = () => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  const remoteStreams = useRef<Map<string, MediaStream>>(new Map());

  useEffect(() => {
    const connect = async () => {
      try {
        await WebRTCService.joinRoom();
        setIsConnected(true);
      } catch (error) {
        console.error("Error connecting to server:", error);
      }
    };

    connect();

    WebRTCService.onRemoteTrack = (track, stream, peerId, kind) => {
      let remoteStream = remoteStreams.current.get(peerId);
      if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteStreams.current.set(peerId, remoteStream);

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      }

      remoteStream.addTrack(track);
    };

    return () => {
      WebRTCService.close();
    };
  }, []);

  const togglePlay = async () => {
    if (cameraOn) {
      setCameraOn(false);
      if (localVideoRef?.current?.srcObject) {
        const tracks = (
          localVideoRef.current.srcObject as MediaStream
        ).getTracks();
        tracks.forEach((track) => track.stop());
        localVideoRef.current.srcObject = null;
      }
    } else {
      await WebRTCService.publishLocalStream();
      const stream = await WebRTCService.getLocalStream();
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setCameraOn(true);
    }
  };

  // const watchUserMedia = async () => {
  //   console.log("first");
  //   WebRTCService.onRemoteTrack = (track, stream, peerId, kind) => {
  //     console.log(stream);
  //     if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
  //   };
  // };

  return (
    <div className="flex flex-col items-center gap-3 justify-center h-screen bg-white">
      <h1 className="text-3xl font-bold">Stream</h1>
      <div className="flex flex-col gap-2">
        <video ref={localVideoRef} autoPlay className="bg-amber-300"></video>
        <video ref={remoteVideoRef} autoPlay className="bg-amber-200"></video>
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
