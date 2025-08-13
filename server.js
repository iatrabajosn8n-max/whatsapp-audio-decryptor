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

    if (!url || !mediaKey || !mimetype) {
      return res.status(400).json({ error: "Faltan parámetros" });
    }

    // Descargar el archivo .enc desde WhatsApp
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(500).json({ error: "Error descargando el archivo" });
    }
    const encBuffer = Buffer.from(await response.arrayBuffer());

    // Desencriptar
    const decrypted = await decryptWhatsAppAudio(encBuffer, mediaKey, mimetype);

    // Convertir a Base64
    const base64Audio = decrypted.toString("base64");

    res.json({
      fileName: "audio.ogg",
      mimeType: mimetype,
      data: base64Audio
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error desencriptando", details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
