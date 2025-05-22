export const mediaSoupConfig = {
  worker: {
    logLevel: "warn",
    //rtcMinPort: 10000,
    //rtcMaxPort: 11000,
    portRange: {
      min: 10000,
      max: 11000,
    },
    logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
  },
  router: {
    mediaCodecs: [
      {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: {
          "x-google-start-bitrate": 1000,
        },
      },
      {
        kind: "video",
        mimeType: "video/VP9",
        clockRate: 90000,
      },
      {
        kind: "video",
        mimeType: "video/h264",
        clockRate: 90000,
      },
    ],
  },
};

export const hlsConfig = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: 8080,
    mediaroot: "./media",
    allow_origin: "*",
  },
  trans: {
    ffmpeg: "/usr/local/bin/ffmpeg",
    tasks: [],
  },
};
