import express from "express";
import multer from "multer";
import crypto from "crypto";

const app = express();
const upload = multer();
app.use(express.json());

// Función para derivar la AES key y IV desde la mediaKey usando HKDF
function getAESKeyAndIV(mediaKey) {
    // "WhatsApp Audio Keys" es el info string para audios
    const info = Buffer.from("WhatsApp Audio Keys", "utf-8");

    // Deriva 112 bytes desde mediaKey con HKDF (SHA256)
    const expandedKey = crypto.hkdfSync(
        "sha256",
        mediaKey,              // mediaKey original
        Buffer.alloc(32, 0),   // salt de 32 bytes a cero
        info,                  // info string
        112                    // longitud total derivada
    );

    return {
        aesKey: expandedKey.subarray(0, 32),   // primeros 32 bytes para AES-256
        iv: expandedKey.subarray(32, 48)       // siguientes 16 bytes para IV
    };
}

// Función para descargar y descifrar audio de WhatsApp
async function decryptWhatsAppAudio(mediaKeyBase64, encUrl) {
    console.log("MediaKey recibida:", mediaKeyBase64);

    // Convierte la mediaKey de Base64 a bytes
    const mediaKey = Buffer.from(mediaKeyBase64, "base64");
    console.log("Bytes de mediaKey:", mediaKey.length);

    // Derivar clave AES e IV
    const { aesKey, iv } = getAESKeyAndIV(mediaKey);
    console.log("AES Key length:", aesKey.length);
    console.log("IV length:", iv.length);

    // Descargar archivo encriptado
    const response = await fetch(encUrl);
    const encBuffer = Buffer.from(await response.arrayBuffer());

    // Desencriptar usando AES-256-CBC
    const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
    const decrypted = Buffer.concat([
        decipher.update(encBuffer),
        decipher.final()
    ]);

    return decrypted;
}

// Endpoint para recibir webhook y procesar audio
app.post("/webhook", upload.none(), async (req, res) => {
    try {
        const message = req.body?.data?.messages?.message;
        if (!message?.audioMessage) {
            return res.status(400).send("No hay audio en el mensaje");
        }

        const mediaKey = message.audioMessage.mediaKey;
        const url = message.audioMessage.url;

        // Descifra el audio
        const audioBuffer = await decryptWhatsAppAudio(mediaKey, url);

        // Responder con el archivo descifrado (por ejemplo, .ogg)
        res.setHeader("Content-Type", "audio/ogg");
        res.send(audioBuffer);

    } catch (err) {
        console.error(err);
        res.status(500).send("Error al procesar el audio");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
