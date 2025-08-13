import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import pkg from "whatsapp-web.js";

const { decryptMedia } = pkg;
const app = express();
app.use(express.json());

app.post("/decrypt", async (req, res) => {
  try {
    const { url, mediaKey, mimetype } = req.body;

    if (!url || !mediaKey || !mimetype) {
      return res.status(400).json({ error: "Faltan parámetros" });
    }

    // 1. Descargar el archivo encriptado
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(500).json({ error: "Error descargando el archivo" });
    }
    const encBuffer = await response.arrayBuffer();

    // 2. Crear objeto simulado para whatsapp-web.js
    const message = {
      mimetype,
      mediaKey,
      fileSha256: null,
      fileEncSha256: null,
      directPath: null,
      url,
    };

    // 3. Desencriptar
    const decrypted = await decryptMedia(message, { data: Buffer.from(encBuffer) });

    // 4. Enviar el archivo como descarga
    res.setHeader("Content-Type", mimetype);
    res.setHeader("Content-Disposition", 'attachment; filename="audio.ogg"');
    res.send(decrypted);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error desencriptando" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));

