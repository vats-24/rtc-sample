import { useEffect, useState } from "react";
import "./App.css";
import { Stream } from "./components/StreamView";
import { WatchView } from "./components/WatchView";

function App() {
  const [currentView, setCurrentView] = useState<
    "home" | "stream" | "watch" | "egress"
  >("home");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "egress") {
      setCurrentView("egress");
    }
  }, []);
  const [roomId, setRoomId] = useState("room1");
  if (currentView === "egress") {
    return (
      <div className="w-screen h-screen bg-black overflow-hidden flex items-center justify-center">
        {/* Pass a prop to hide buttons, or just ensure your Stream component 
            doesn't render the "Play" button if it's the bot viewing it */}
        <Stream isBot={true} />
      </div>
    );
  }

  if (currentView === "stream") {
    return (
      <div className="relative">
        <button
          onClick={() => setCurrentView("home")}
          className="absolute top-4 left-4 z-50 bg-red-600 text-white px-4 py-2 rounded shadow"
        >
          Leave Stage
        </button>
        <Stream />
      </div>
    );
  }

  if (currentView === "watch") {
    return (
      <div className="relative">
        <button
          onClick={() => setCurrentView("home")}
          className="absolute top-4 left-4 z-50 bg-gray-600 text-white px-4 py-2 rounded shadow"
        >
          Back to Home
        </button>
        <WatchView streamKey={roomId} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-2xl text-center flex flex-col gap-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 text-blue-400">LiveApp</h1>
          <p className="text-slate-400">
            Choose how you want to join the session.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <label className="text-left text-sm text-slate-300 font-semibold">
            Room / Stream Key
          </label>
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="p-3 rounded bg-slate-700 text-white border border-slate-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => setCurrentView("stream")}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg"
          >
            🎤 Join as Speaker (WebRTC)
          </button>

          <button
            onClick={() => setCurrentView("watch")}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg"
          >
            👁️ Watch Audience (HLS)
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
