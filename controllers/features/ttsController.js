// controllers/features/ttsController.js — Text to Speech via ElevenLabs
const axios = require('axios');

async function generate(req, res) {
    const { text, voice_id = '21m00Tcm4TlvDq8ikWAM' } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, message: '❌ Teks tidak boleh kosong.' });
    if (text.length > 500) return res.status(400).json({ success: false, message: '❌ Maks 500 karakter.' });

    try {
        const response = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`,
            { text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } },
            {
                headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
                responseType: 'arraybuffer',
                timeout: 30_000,
            }
        );
        res.set('Content-Type', 'audio/mpeg');
        res.send(Buffer.from(response.data));
    } catch (err) {
        console.error('TTS error:', err.response?.status, err.message);
        res.status(500).json({ success: false, message: 'Gagal generate TTS.' });
    }
}

module.exports = { generate };
