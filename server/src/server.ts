import express from "express";
import { Server, Socket } from "socket.io";
const app = express();
const io = new Server();

io.attachApp(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Hello world!");
});

app.listen(3000, () => {
  console.log("Server started");
});
