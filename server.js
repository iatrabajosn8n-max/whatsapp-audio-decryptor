import express from "express";
import fetch from "node-fetch";
import pkg from "whatsapp-web.js";

const { decryptMedia } = pkg;

const app = express();
app.use(express.json());

app.post("/decrypt-audio", async (req, res) => {
  try {
    const { url, mimetype, mediaKey } = req.body;

    const response = await fetch(url);
    const encBuffer = Buffer.from(await response.arrayBuffer());

    const decrypted = await decryptMedia(
      { mediaKey: Buffer.from(mediaKey, "base64"), mimetype },
      encBuffer
    );

    res.setHeader("Content-Type", mimetype);
    res.send(decrypted);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error decrypting audio");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
