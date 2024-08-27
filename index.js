import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Server } from "socket.io";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

async function main() {
  const db = await open({
    filename: "chat.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_offset TEXT UNIQUE,
        content TEXT
    );
  `);

  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    connectionStateRecovery: {
      maxDisconnectionDuration: 180000,
    },
  });

  const __dirname = dirname(fileURLToPath(import.meta.url));

  io.on("connection", async (socket) => {
    if (socket.recovered) {
      console.log("eita, recuperei");

      const messages = await db.all(
        "SELECT content FROM messages ORDER BY id ASC"
      );
      socket.emit(
        "message history",
        messages.map((msg) => msg.content)
      );
    }

    io.emit("user connected", "Usuário conectado");

    socket.on("send message", async (msg) => {
      let result;
      try {
        result = await db.run("INSERT INTO messages (content) VALUES (?)", msg);
      } catch (e) {
        console.error("Erro ao salvar mensagem:", e);
        return;
      }

      io.emit("send message", msg, result.lastID);
    });

    socket.on("disconnect", () => {
      console.log("user disconnected");

      io.emit("user disconnected", "Um usuário desconectou-se");
    });
  });

  app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "index.html"));
  });

  server.listen(3000, () => console.log("running at port 3000"));
}

main();
