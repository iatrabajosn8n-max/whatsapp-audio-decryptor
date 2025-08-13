import express from "express";
import crypto from "crypto";
import multer from "multer";

const app = express();
app.use(express.json({ limit: "25mb" }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function hkdf(mediaKey, info) {
  return crypto.hkdfSync("sha256", mediaKey, Buffer.alloc(0), Buffer.from(info), 112);
}

function decryptEnc(mediaKeyB64, encBuffer) {
  const mediaKey = Buffer.from(mediaKeyB64, "base64");
  const expandedKey = hkdf(mediaKey, "WhatsApp Audio Keys");
  const iv = expandedKey.subarray(0, 16);
  const cipherKey = expandedKey.subarray(16, 48);
  const fileData = encBuffer.subarray(0, encBuffer.length - 10);
  const decipher = crypto.createDecipheriv("aes-256-cbc", cipherKey, iv);
  return Buffer.concat([decipher.update(fileData), decipher.final()]);
}

// 1) JSON (opcional, por si luego lo quieres seguir usando)
app.post("/decrypt", (req, res) => {
  try {
    const { mediaKey, file } = req.body;
    if (!mediaKey || !file) return res.status(400).json({ error: "Faltan mediaKey o file" });
    const dec = decryptEnc(mediaKey, Buffer.from(file, "base64"));
    res.json({ mimeType: "audio/ogg", fileName: "audio.ogg", data: dec.toString("base64") });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2) MULTIPART: ***usa este endpoint desde n8n***
app.post("/decrypt-multipart", upload.single("encAudio"), (req, res) => {
  try {
    const mediaKey = req.body.mediaKey;
    const fileBuf = req.file?.buffer;
    if (!mediaKey || !fileBuf) return res.status(400).json({ error: "Faltan mediaKey o archivo encAudio" });
    const dec = decryptEnc(mediaKey, fileBuf);
    res.json({ mimeType: "audio/ogg", fileName: "audio.ogg", data: dec.toString("base64") });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/", (_, res) => res.send("WhatsApp Audio Decrypt API ✅ /decrypt-multipart listo"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`OK ${PORT}`));
