import express from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";

const app = express();

// n8n envía: mediaKey (texto) + encAudio (binario) vía multipart/form-data
const upload = multer();

// --- Deriva IV + cipherKey desde mediaKey usando HKDF (WhatsApp Audio) ---
function deriveKeys(mediaKey) {
  // Info string específica para audio
  const info = Buffer.from("WhatsApp Audio Keys", "utf-8");

  // Node devuelve un Buffer directamente
  const expanded = crypto.hkdfSync(
    "sha256",
    mediaKey,                 // ikm
    Buffer.alloc(32, 0x00),   // salt 32 bytes a cero
    info,                     // info
    112                       // longitud expandida
  );

  // Estructura WhatsApp media (común en clientes): IV(16) + cipherKey(32) + macKey(32) + ...
  const iv = expanded.slice(0, 16);
  const cipherKey = expanded.slice(16, 48);
  // macKey = expanded.slice(48, 80); // no lo usamos aquí

  return { iv, cipherKey };
}

// --- Desencripta buffer cifrado de WhatsApp (AES-256-CBC + tag de 10 bytes al final) ---
function decryptWhatsAppAudio(mediaKeyB64, encryptedFile) {
  console.log("mediaKey Base64:", mediaKeyB64);

  const mediaKey = Buffer.from(mediaKeyB64, "base64");
  console.log("Bytes mediaKey:", mediaKey.length);
  console.log("Tamaño encAudio recibido:", encryptedFile.length);

  // Guarda el binario recibido para diagnóstico
  try {
    fs.writeFileSync("encAudio_recibido.enc", encryptedFile);
    console.log("Guardado encAudio_recibido.enc");
  } catch (e) {
    console.warn("No se pudo guardar encAudio_recibido.enc:", e.message);
  }

  const { iv, cipherKey } = deriveKeys(mediaKey);
  console.log("IV len:", iv.length, "Key len:", cipherKey.length);

  // Los binarios de media de WhatsApp suelen incluir un tag HMAC de 10 bytes al final.
  // Hay que retirarlo para que el tamaño sea múltiplo de 16 (bloque AES-CBC).
  let payload = encryptedFile;
  if (payload.length > 10) {
    payload = payload.slice(0, payload.length - 10);
  }
  console.log("Tamaño tras quitar tag(10):", payload.length, "múltiplo de 16 =", payload.length % 16 === 0);

  const decipher = crypto.createDecipheriv("aes-256-cbc", cipherKey, iv);
  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);

  // Guarda el resultado para comprobar
  try {
    fs.writeFileSync("audio_descifrado.ogg", decrypted);
    console.log("Guardado audio_descifrado.ogg");
  } catch (e) {
    console.warn("No se pudo guardar audio_descifrado.ogg:", e.message);
  }

  return decrypted;
}

// --- Webhook para n8n: multipart/form-data con mediaKey (text) + encAudio (file) ---
app.post(
  "/webhook",
  upload.single("encAudio"), // captura el binario en req.file
  (req, res) => {
    try {
      const mediaKey = req.body?.mediaKey;
      const encAudioBuffer = req.file?.buffer;

      if (!mediaKey || !encAudioBuffer) {
        console.log("Faltan campos. body keys:", Object.keys(req.body || {}), "file?:", !!req.file);
        return res.status(400).send("No se recibieron mediaKey y/o encAudio");
      }

      const audio = decryptWhatsAppAudio(mediaKey, encAudioBuffer);
      res.setHeader("Content-Type", "audio/ogg");
      res.send(audio);
    } catch (err) {
      console.error("Error al procesar el audio:", err);
      res.status(500).send("Error al procesar el audio");
    }
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
