import express from "express";
import multer from "multer";
import crypto from "crypto";

const app = express();
const upload = multer();

// Derivar AES key y IV desde mediaKey usando HKDF
function getAESKeyAndIV(mediaKey) {
    const info = Buffer.from("WhatsApp Audio Keys", "utf-8");
    const expandedKey = Buffer.alloc(112); // Aquí guardamos el resultado

    crypto.hkdfSync(
        "sha256",
        mediaKey,
        Buffer.alloc(32, 0),
        info,
        112,
        expandedKey
    );

    return {
        aesKey: expandedKey.subarray(0, 32),
        iv: expandedKey.subarray(32, 48)
    };
}

// Descifrar audio
function decryptWhatsAppAudio(mediaKeyBase64, encBuffer) {
    const mediaKey = Buffer.from(mediaKeyBase64, "base64");
    const { aesKey, iv } = getAESKeyAndIV(mediaKey);

    const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
    return Buffer.concat([decipher.update(encBuffer), decipher.final()]);
}

// Webhook que recibe form-data desde n8n
app.post(
    "/webhook",
    upload.fields([
        { name: "mediaKey", maxCount: 1 },
        { name: "encAudio", maxCount: 1 }
    ]),
    (req, res) => {
        try {
            const mediaKey = req.body?.mediaKey;
            const encAudioFile = req.files?.encAudio?.[0];

            if (!mediaKey || !encAudioFile) {
                return res.status(400).send("No se recibieron mediaKey o encAudio");
            }

            const encBuffer = encAudioFile.buffer;
            const audioBuffer = decryptWhatsAppAudio(mediaKey, encBuffer);

            res.setHeader("Content-Type", "audio/ogg");
            res.send(audioBuffer);
        } catch (err) {
            console.error("Error al procesar el audio:", err);
            res.status(500).send("Error al procesar el audio");
        }
    }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
