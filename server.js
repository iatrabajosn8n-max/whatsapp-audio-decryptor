import express from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";

const app = express();
const upload = multer();

// Función para derivar la AES key y IV desde la mediaKey usando HKDF
function getAESKeyAndIV(mediaKey) {
    const info = Buffer.from("WhatsApp Audio Keys", "utf-8");
    const expandedKey = Buffer.alloc(112); // Prepara el espacio
    crypto.hkdfSync(
        "sha256",
        mediaKey,
        Buffer.alloc(32, 0),
        info,
        expandedKey
    );

    return {
        aesKey: expandedKey.slice(0, 32),
        iv: expandedKey.slice(32, 48)
    };
}

// Función para desencriptar audio
async function decryptWhatsAppAudio(mediaKeyBase64, encBuffer) {
    console.log("mediaKey Base64:", mediaKeyBase64);
    const mediaKey = Buffer.from(mediaKeyBase64, "base64");
    console.log("Bytes de mediaKey:", mediaKey.length);
    console.log("Tamaño encAudio recibido:", encBuffer.length);

    // Guardar archivo cifrado para diagnóstico
    fs.writeFileSync("encAudio_recibido.enc", encBuffer);
    console.log("Archivo cifrado guardado como encAudio_recibido.enc");

    const { aesKey, iv } = getAESKeyAndIV(mediaKey);

    const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
    const decrypted = Buffer.concat([
        decipher.update(encBuffer),
        decipher.final()
    ]);

    return decrypted;
}

// Endpoint para recibir datos desde n8n
app.post("/webhook", upload.single("encAudio"), async (req, res) => {
    try {
        const mediaKey = req.body?.mediaKey;
        const encAudioBuffer = req.file?.buffer;

        if (!mediaKey || !encAudioBuffer) {
            console.log("Payload recibido sin mediaKey o encAudio:", req.body);
            return res.status(400).send("No se encontraron mediaKey y audio en el payload");
        }

        const audioBuffer = await decryptWhatsAppAudio(mediaKey, encAudioBuffer);

        res.setHeader("Content-Type", "audio/ogg");
        res.send(audioBuffer);

    } catch (err) {
        console.error("Error al procesar el audio:", err);
        res.status(500).send("Error al procesar el audio");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
