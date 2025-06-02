import { useEffect } from "react";
import "./App.css";
import { WebRTCService } from "./services/webrtcService";
import { Stream } from "./components/StreamView";

function App() {
  return (
    <>
      <Stream />
    </>
  );
}

export default App;
