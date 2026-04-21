## Interactive Broadcast System: WebRTC SFU to HLS Bridge

A highly scalable, hybrid media streaming architecture that bridges sub-500ms low-latency communication (WebRTC) with massively scalable audience broadcasting (HLS).

This project demonstrates a decoupled backend architecture where a Selective Forwarding Unit (SFU) handles real-time peer-to-peer streams, and a headless egress compositor dynamically translates the room's visual state into a standard HTTP Live Streaming (HLS) feed.

## 🏗️ System Architecture & Low-Level Design (LLD)

The system is separated into three distinct domains to isolate heavy CPU transcoding from sensitive real-time packet routing:

1. **The Real-Time Stage (Mediasoup SFU)**
   - **Signaling:** Handled via WebSocket (`Socket.io`) to negotiate router capabilities and exchange WebRTC transport parameters (ICE/DTLS).
   - **Routing:** Mediasoup handles multiplexing. Browsers publish (`Produce`) to a C++ Worker, which selectively routes (`Consume`) tracks to other active speakers.
2. **The Egress Compositor (Puppeteer + FFmpeg)**
   - **Trigger:** An event-driven bridge that launches when the first video track is published.
   - **Capture:** A headless Chromium instance joins the room silently, rendering the dynamic React UI into a virtual frame buffer.
   - **Transcode:** Raw canvas and audio buffers are piped from Node.js into FFmpeg, encoded to H.264/AAC, and pushed via RTMP.
3. **The Audience Broadcast (NodeMediaServer + Express)**
   - **Ingestion:** NMS accepts the RTMP feed and processes it into 2-second `.ts` chunks.
   - **Delivery:** An `index.m3u8` playlist is generated and served statically via Express, allowing infinite audience scaling via standard HTTP GET requests using `hls.js`.

## 🚀 Tech Stack

**Backend**

- Node.js & Express
- Socket.io (Signaling)
- Mediasoup (WebRTC SFU)
- NodeMediaServer (RTMP ingest & HLS chunking)
- Puppeteer & `puppeteer-stream` (Headless compositor)
- FFmpeg (Transcoding)

**Frontend**

- React & TypeScript
- `mediasoup-client` (WebRTC Transport negotiation)
- `hls.js` (Audience playback)
- Tailwind CSS

## ⚙️ Prerequisites

To run this application locally, your system must have the following installed:

- **Node.js** (v18+ recommended)
- **FFmpeg** (`sudo apt install ffmpeg` or `brew install ffmpeg`)
- **Google Chrome / Chromium** (Required for the Puppeteer Egress script)

# 🚀 Project Setup & Usage

## 📦 Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/vats-24/rtc-sample
   cd rtc-sample
   ```

2. **Install Backend Dependencies:**

   ```bash
   cd backend
   npm install
   ```

3. **Install Frontend Dependencies:**

   ```bash
   cd frontend
   npm install
   ```

---

## 🏃‍♂️ Running the Application

This project requires both the backend and frontend to be running simultaneously.

### ▶️ Start the Backend Server

```bash
cd backend
npm run dev
```

Server will start on: http://localhost:3000

### 💻 Start the Frontend Client

```bash
cd frontend
npm run dev
```

App will be served on: http://localhost:5173

---

## 🧪 How to Test the Flow

1. Open a browser tab to http://localhost:5173
2. Click 🎤 **Join as Speaker (WebRTC)**
3. Grant camera and microphone permissions — you are now publishing to the SFU

**Behind the scenes:**

- The backend detects your video
- Launches Puppeteer
- Starts generating HLS chunks

4. Open a second browser tab to http://localhost:5173
5. Click 👁️ **Watch Audience (HLS)**

After a **5–10 second delay** (standard for HTTP Live Streaming),
you will see your broadcast feed without requiring camera permissions.

---

## 🧠 Key Engineering Decisions

### 🎥 Headless Compositor vs. Raw RTP Muxing

Compositing streams via raw RTP packets in FFmpeg `complex_filter` is rigid and prone to crashing upon peer disconnection.
Using a headless browser allows:

- Dynamic layouts via CSS/React
- Graceful handling of peer disconnects
- Improved fault tolerance

---

### 🧩 Separation of Concerns

- Mediasoup router and NodeMediaServer run on different protocols and ports
- If the HLS pipeline fails, real-time WebRTC speakers remain unaffected
