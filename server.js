import express from "express";
import crypto from "crypto";
import fetch from "node-fetch"; // Necesario instalar: npm install node-fetch

const app = express();
app.use(express.json()); // Parsear JSON en request body

// Función para derivar la AES key y IV desde la mediaKey usando HKDF
function getAESKeyAndIV(mediaKey) {
    const info = Buffer.from("WhatsApp Audio Keys", "utf-8");

    const expandedKey = crypto.hkdfSync(
        "sha256",
        mediaKey,
        Buffer.alloc(32, 0),
        info,
        112
    );

    return {
        aesKey: expandedKey.subarray(0, 32),
        iv: expandedKey.subarray(32, 48)
    };
}

// Función para descargar y descifrar audio de WhatsApp
async function decryptWhatsAppAudio(mediaKeyBase64, encUrl) {
    console.log("MediaKey recibida:", mediaKeyBase64);

    const mediaKey = Buffer.from(mediaKeyBase64, "base64");
    console.log("Bytes de mediaKey:", mediaKey.length);

    const { aesKey, iv } = getAESKeyAndIV(mediaKey);
    console.log("AES Key length:", aesKey.length);
    console.log("IV length:", iv.length);

    const response = await fetch(encUrl);
    const encBuffer = Buffer.from(await response.arrayBuffer());

    const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
    const decrypted = Buffer.concat([
        decipher.update(encBuffer),
        decipher.final()
    ]);

    return decrypted;
}

// Endpoint webhook
app.post("/webhook", async (req, res) => {
    try {
        const message = req.body?.data?.messages?.message;

        if (!message?.audioMessage?.mediaKey || !message?.audioMessage?.url) {
            console.log("Payload recibido sin audio:", JSON.stringify(req.body, null, 2));
            return res.status(400).send("No hay audio en el mensaje");
        }

        const mediaKey = message.audioMessage.mediaKey;
        const url = message.audioMessage.url;

        const audioBuffer = await decryptWhatsAppAudio(mediaKey, url);

        res.setHeader("Content-Type", "audio/ogg");
        res.send(audioBuffer);

    } catch (err) {
        console.error(err);
        res.status(500).send("Error al procesar el audio");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
