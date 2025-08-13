import express from "express";
import fetch from "node-fetch";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: "50mb" }));

// Función para descifrar el audio
async function decryptWhatsAppAudio(encBuffer, mediaKeyBase64, mimetype) {
  const mediaKey = Buffer.from(mediaKeyBase64, "base64");

  // Parámetros de derivación según tipo de archivo
  const IV_LENGTH = 16;
  const CIPHER_KEY_LENGTH = 32;
  const info = mimetype.startsWith("audio")
    ? "WhatsApp Audio Keys"
    : "WhatsApp Video Keys";

  // Derivar keys
  const expandedKey = crypto.hkdfSync("sha256", mediaKey, Buffer.alloc(0), info, 112);
  const iv = expandedKey.subarray(0, IV_LENGTH);
  const cipherKey = expandedKey.subarray(IV_LENGTH, IV_LENGTH + CIPHER_KEY_LENGTH);

  // El archivo cifrado lleva un MAC al final (10 bytes), lo quitamos
  const fileData = encBuffer.subarray(0, encBuffer.length - 10);

  // Descifrar
  const decipher = crypto.createDecipheriv("aes-256-cbc", cipherKey, iv);
  const decrypted = Buffer.concat([decipher.update(fileData), decipher.final()]);

  return decrypted;
}

app.post("/decrypt", async (req, res) => {
  try {
    const { url, mediaKey, mimetype } = req.body;

    console.log("📩 Datos recibidos:", { url, mediaKey, mimetype });

    if (!url || !mediaKey || !mimetype) {
      return res.status(400).json({ error: "Faltan parámetros" });
    }

    // Descargar el archivo encriptado
    const response = await fetch(url);
    if (!response.ok) {
      console.error("❌ Error descargando archivo:", response.status, response.statusText);
      return res.status(500).json({ error: "Error descargando el archivo" });
    }
    const encBuffer = await response.arrayBuffer();
    console.log("📦 Tamaño del archivo descargado:", encBuffer.byteLength);

    // Simular mensaje para whatsapp-web.js
    const message = {
      mimetype,
      mediaKey,
      type: "audio",
      _data: { body: Buffer.from(encBuffer) }
    };

    console.log("🔍 Intentando desencriptar...");

    // Desencriptar
    const decrypted = await decryptMedia(message);
    console.log("✅ Desencriptado con éxito, tamaño:", decrypted.length);

    // Devolver como Base64 para n8n
    const base64Audio = Buffer.from(decrypted).toString("base64");

    res.json({
      fileName: "audio.ogg",
      mimeType: mimetype,
      data: base64Audio
    });

  } catch (err) {
    console.error("❌ Error exacto:", err);
    res.status(500).json({ error: "Error desencriptando", details: err.message });
  }
});
