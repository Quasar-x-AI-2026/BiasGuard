import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const onlineUsersOnServers = [];

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  const io = new Server(httpServer);

  io.on("connection", (socket) => {
    socket.on("connect", () => {
      console.log("a user connected");
    });

    socket.on("disconnect", () => {
      console.log("user disconnected");

      const index = onlineUsersOnServers.findIndex(onlineUser => onlineUser.socketId === socket.id);
      if (index !== -1) {
        onlineUsersOnServers.splice(index, 1);
      }
      io.emit("get-online-users", onlineUsersOnServers);
    });

    socket.on("add-new-user", (clerkUser) => {
      if ((onlineUsersOnServers.find((onlineUser) => {
        return onlineUser.userId === clerkUser.id
      }))) {
        return;
      }

      const newUser = {
        socketId: socket.id,
        userId: clerkUser.id,
        profile: clerkUser
      }

      onlineUsersOnServers.push(newUser);
      io.emit("get-online-users", onlineUsersOnServers);
    });
    
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
