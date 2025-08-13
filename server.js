import express from "express";
import pkg from "whatsapp-web.js";

const { decryptMedia } = pkg;

const app = express();
app.use(express.json({ limit: "50mb" }));

app.post("/decrypt", async (req, res) => {
  try {
    // Recibe el JSON entero
    const data = req.body;

    // Buscar los parámetros dentro del JSON
    const url = data?.rawMessage?.audioMessage?.url;
    const mimetype = data?.rawMessage?.audioMessage?.mimetype;
    const mediaKey = data?.rawMessage?.audioMessage?.mediaKey;

    if (!url || !mimetype || !mediaKey) {
      return res.status(400).json({ error: "No se encontraron parámetros en el JSON" });
    }

    // Crear objeto simulado para whatsapp-web.js
    const message = {
      _data: {
        mimetype: mimetype,
        mediaKey: Buffer.from(mediaKey, "base64"),
        directPath: new URL(url).pathname,
      },
      client: {
        options: {
          userAgent: "WhatsApp/2.23.10 iOS"
        }
      }
    };

    // Desencriptar
    const decrypted = await decryptMedia(message);

    // Pasar a base64
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
