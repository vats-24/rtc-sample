import { useEffect } from "react";
import "./App.css";
import { WebRTCService } from "./services/webrtcService";

function App() {
  const webrtcService = new WebRTCService();
  useEffect(() => {
    console.log("first");
    webrtcService.connect();
  });
  return <></>;
}

export default App;
