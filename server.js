import express from "express";
import pkg from "whatsapp-web.js";

const { decryptMedia } = pkg;

const app = express();
app.use(express.json({ limit: "50mb" }));

app.post("/decrypt", async (req, res) => {
  try {
    const { url, mimetype, mediaKey } = req.body;

    if (!url || !mimetype || !mediaKey) {
      return res.status(400).json({ error: "Faltan parámetros" });
    }

    // Crear un objeto 'Message' simulado para whatsapp-web.js
    const message = {
      _data: {
        mimetype: mimetype,
        mediaKey: Buffer.from(mediaKey, "base64"),
        directPath: new URL(url).pathname,
      },
      client: {
        options: {
          // Simular usuario-agente para que WhatsApp no bloquee
          userAgent: "WhatsApp/2.23.10 iOS"
        }
      }
    };

    // Desencriptar
    const decrypted = await decryptMedia(message);

    // Convertir a base64 para que n8n lo pueda guardar
    const base64Audio = Buffer.from(decrypted).toString("base64");

    res.json({
      fileName: "audio.ogg",
      mimeType: mimetype,
      data: base64Audio
    });

  } catch (err) {
    console.error("Error al desencriptar:", err);
    res.status(500).json({ error: "Error desencriptando" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Servidor listo en puerto ${PORT}`)
);
