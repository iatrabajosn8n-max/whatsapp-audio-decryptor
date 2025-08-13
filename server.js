import express from 'express';
import fetch from 'node-fetch';
import { decryptMedia } from 'whatsapp-web.js';

const app = express();
app.use(express.json({ limit: '50mb' }));

app.post('/decrypt-audio', async (req, res) => {
    try {
        const { mediaKey, directPath } = req.body;

        if (!mediaKey || !directPath) {
            return res.status(400).json({ error: 'Faltan parámetros: mediaKey o directPath' });
        }

        const fileUrl = `https://mmg.whatsapp.net${directPath}`;
        const response = await fetch(fileUrl);
        const encBuffer = Buffer.from(await response.arrayBuffer());

        const decrypted = await decryptMedia(
            {
                mediaKey: Buffer.from(mediaKey, 'base64'),
                mediaType: 'audio',
                mimetype: 'audio/ogg; codecs=opus'
            },
            { data: encBuffer }
        );

        res.setHeader('Content-Type', 'audio/ogg');
        res.send(decrypted);

    } catch (err) {
        console.error('Error desencriptando audio:', err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
