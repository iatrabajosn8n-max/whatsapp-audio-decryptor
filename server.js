import express from "express";
import fetch from "node-fetch";
import pkg from "whatsapp-web.js";

const { decryptMedia } = pkg;
const app = express();
app.use(express.json({ limit: "50mb" }));

console.log("🚀 Iniciando servidor de WhatsApp Audio Decryptor...");

// Ruta para desencriptar
app.post("/decrypt", async (req, res) => {
  try {
    const { url, mediaKey, mimetype } = req.body;

    if (!url || !mediaKey || !mimetype) {
      return res.status(400).json({ error: "Faltan parámetros" });
    }

    console.log(`📥 Descargando archivo desde: ${url}`);

    // Descargar el archivo encriptado
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(500).json({ error: "Error descargando el archivo" });
    }
    const encBuffer = await response.arrayBuffer();

    // Simular mensaje para whatsapp-web.js
    const message = {
      mimetype,
      mediaKey,
      url
    };

    console.log(`🔓 Desencriptando con mediaKey: ${mediaKey}`);

    // Desencriptar
    const decrypted = await decryptMedia(message, {
      data: Buffer.from(encBuffer)
    });

    // Convertir a Base64 para n8n
    const base64Audio = Buffer.from(decrypted).toString("base64");

    console.log(`✅ Archivo desencriptado y enviado`);

    res.json({
      fileName: "audio.ogg",
      mimeType: mimetype,
      data: base64Audio
    });

  } catch (err) {
    console.error("❌ Error desencriptando:", err);
    res.status(500).json({ error: "Error desencriptando" });
  }
});

// Mantener servidor vivo en Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor escuchando en puerto ${PORT}`);
});

});
