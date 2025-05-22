import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.attachApp(app);

io.on("connection", (socket: Socket) => {
  console.log("Socket connected");
});

app.get("/", (req, res) => {
  res.send("Hello world!");
});

app.listen(3000, () => {
  console.log("Server started");
});
