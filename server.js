import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

const onlineUsersOnServers = [];

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
    })

    socket.on("call", callData => {
      const { participants, role } = callData;

      io.to(participants.receiver.socketId).emit("call", {
        participants,
        isRinging: true,
        role: role==="teacher"?"student":"teacher",
      })
    })

    socket.on("conn-signal", (data) => {
      const { userToSignal, signal, callerId } = data;
      io.to(userToSignal).emit("conn-signal", { signal, callerId });
    });

    socket.on("hangup", (data) => {
      if (data.participantId) {
        io.to(data.participantId).emit("hangup");
      }
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
