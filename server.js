import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: "20mb" }));

function hkdf(mediaKey, info) {
  return crypto.hkdfSync("sha256", mediaKey, Buffer.alloc(0), Buffer.from(info), 112);
}

app.post("/decrypt", (req, res) => {
  try {
    const { mediaKey: mediaKeyB64, file: fileB64 } = req.body;

    if (!mediaKeyB64 || !fileB64) {
      return res.status(400).json({ error: "Faltan parámetros: mediaKey y file" });
    }

    const mediaKey = Buffer.from(mediaKeyB64, "base64");
    const expandedKey = hkdf(mediaKey, "WhatsApp Audio Keys");
    const iv = expandedKey.subarray(0, 16);
    const cipherKey = expandedKey.subarray(16, 48);

    const encBuffer = Buffer.from(fileB64, "base64");
    const fileData = encBuffer.subarray(0, encBuffer.length - 10);

    const decipher = crypto.createDecipheriv("aes-256-cbc", cipherKey, iv);
    const decrypted = Buffer.concat([decipher.update(fileData), decipher.final()]);

    res.json({
      mimeType: "audio/ogg",
      fileName: "audio.ogg",
      data: decrypted.toString("base64"),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("WhatsApp Audio Decrypt API funcionando ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
