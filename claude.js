const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function buildSystemPrompt(dataKelas, dataTugas) {
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return `
Kamu adalah asisten akademik pintar bernama "YMBot" untuk mahasiswa Universitas Yatsi Madani (UYM).
Hari ini: ${today}

📚 DATA JADWAL KULIAH MAHASISWA:
${JSON.stringify(dataKelas, null, 2)}

📝 DATA TUGAS MAHASISWA:
${JSON.stringify(dataTugas, null, 2)}

Tugasmu:
- Jawab pertanyaan soal jadwal kuliah dengan akurat
- Ingatkan tugas yang deadline-nya dekat (< 3 hari) dengan peringatan khusus ⚠️
- Tugas yang "Belum Dikerjakan" harus selalu diingatkan
- Bantu prioritaskan tugas berdasarkan deadline terdekat
- Jawab pakai Bahasa Indonesia yang santai dan friendly
- Gunakan emoji biar lebih menarik
- Kalau ditanya hal di luar akademik, tetap jawab dengan ramah tapi arahkan balik ke topik akademik
  `;
}

async function callGemini(systemPrompt, riwayatChat, pesanUser, retries = 2) {
  const contents = [
    ...riwayatChat.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    })),
    { role: 'user', parts: [{ text: pesanUser }] }
  ];

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: { systemInstruction: systemPrompt }
      });
      return response.text;
    } catch (err) {
      const isOverloaded = err.message?.includes('UNAVAILABLE') || err.message?.includes('503');
      if (isOverloaded && i < retries) {
        console.warn(`⏳ Gemini overload, coba lagi... (percobaan ${i + 1})`);
        await new Promise(r => setTimeout(r, 1500 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
}

async function callClaude(systemPrompt, riwayatChat, pesanUser) {
  const messages = [...riwayatChat, { role: 'user', content: pesanUser }];

  const response = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages
  });

  return response.content[0].text;
}

async function tanyaBot(pesanUser, dataKelas, dataTugas, riwayatChat) {
  const systemPrompt = buildSystemPrompt(dataKelas, dataTugas);

  try {
    return await callGemini(systemPrompt, riwayatChat, pesanUser);
  } catch (err) {
    console.warn('⚠️ Gemini gagal, fallback ke Claude. Alasan:', err.message);
    try {
      return await callClaude(systemPrompt, riwayatChat, pesanUser);
    } catch (err2) {
      console.error('❌ Claude juga gagal:', err2.message);
      return 'Maaf, YMBot lagi sibuk banget nih 😅 Server AI-nya lagi rame, coba kirim pesan sekali lagi ya sebentar lagi!';
    }
  }
}

module.exports = { tanyaBot };