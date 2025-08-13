import express from "express";
import axios from "axios";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: "10mb" }));

// --- Función para derivar la clave de WhatsApp ---
function getMediaKeys(mediaKeyBase64) {
    const mediaKey = Buffer.from(mediaKeyBase64, "base64");
    const expandedKey = crypto.createHmac("sha256", mediaKey)
        .update("WhatsApp Audio Keys")
        .digest();
    return expandedKey;
}

// --- Función para desencriptar ---
async function decryptAudio(url, mediaKeyBase64) {
    const fileEnc = await axios.get(url, { responseType: "arraybuffer" });
    const fileData = Buffer.from(fileEnc.data);

    const iv = fileData.subarray(0, 16);
    const ciphertext = fileData.subarray(16, fileData.length - 10);

    const expandedKey = getMediaKeys(mediaKeyBase64);
    const decipher = crypto.createDecipheriv("aes-256-cbc", expandedKey, iv);

    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
}

// --- Ruta principal ---
app.post("/decrypt", async (req, res) => {
    try {
        const audioMessage = req.body?.rawMessage?.audioMessage;
        if (!audioMessage || !audioMessage.url || !audioMessage.mediaKey || !audioMessage.mimetype) {
            return res.status(400).json({ error: "JSON inválido o faltan campos" });
        }

        const { url, mediaKey, mimetype } = audioMessage;
        console.log("📥 Recibido:", url, mimetype, mediaKey);

        const audioBuffer = await decryptAudio(url, mediaKey);

        // Convertir a Base64
        const audioBase64 = audioBuffer.toString("base64");

        res.json({
            mimetype,
            base64: audioBase64
        });

    } catch (err) {
        console.error("❌ Error desencriptando:", err.message);
        res.status(500).json({ error: "Error desencriptando" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor iniciado en puerto ${PORT}`));
