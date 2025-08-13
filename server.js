import express from 'express';
import multer from 'multer';
import crypto from 'crypto';

const app = express();
const upload = multer();

// Constantes para el desencriptado de WhatsApp
const IV_LENGTH = 16;
const CIPHER_KEY_LENGTH = 32;
const MAC_KEY_LENGTH = 32;
const WHATSAPP_AUDIO_INFO = 'WhatsApp Audio Keys';

function deriveKeys(mediaKeyBase64) {
    const mediaKey = Buffer.from(mediaKeyBase64, 'base64');
    const expandedKey = crypto.createHmac('sha256', mediaKey)
        .update(Buffer.from(WHATSAPP_AUDIO_INFO, 'utf-8'))
        .digest();

    return {
        iv: expandedKey.subarray(0, IV_LENGTH),
        cipherKey: expandedKey.subarray(IV_LENGTH, IV_LENGTH + CIPHER_KEY_LENGTH),
        macKey: expandedKey.subarray(IV_LENGTH + CIPHER_KEY_LENGTH, IV_LENGTH + CIPHER_KEY_LENGTH + MAC_KEY_LENGTH),
    };
}

function decryptWhatsAppAudio(encBuffer, mediaKeyBase64) {
    const keys = deriveKeys(mediaKeyBase64);

    // Quitar el último bloque de 10 bytes del MAC
    const fileData = encBuffer.subarray(0, encBuffer.length - 10);

    const decipher = crypto.createDecipheriv('aes-256-cbc', keys.cipherKey, keys.iv);
    let decrypted = decipher.update(fileData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
}

app.post('/decrypt-multipart', upload.single('encAudio'), (req, res) => {
    console.log("MediaKey recibida:", req.body.mediaKey);
    console.log("Longitud Base64:", req.body.mediaKey?.length || "VACÍA");

    const mediaKeyBuffer = Buffer.from(req.body.mediaKey, 'base64');
    console.log("Bytes de mediaKey:", mediaKeyBuffer.length);

    try {
        const mediaKey = req.body.mediaKey;
        const encAudioBuffer = req.file.buffer;

        const decryptedBuffer = decryptWhatsAppAudio(encAudioBuffer, mediaKey);

        res.setHeader('Content-Type', 'audio/ogg');
        res.send(decryptedBuffer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al desencriptar el audio' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
