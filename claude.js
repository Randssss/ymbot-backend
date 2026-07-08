const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY?.trim() });

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set');
}

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
Tugasmu:
- Jadwal kuliah bersifat RUTIN MINGGUAN (berdasarkan nama hari seperti Senin/Selasa/dst), BUKAN tanggal spesifik. Kalau ditanya "jadwal minggu ini" atau "hari ini", tetap tampilkan SEMUA kelas yang ada datanya, karena itu jadwal tetap yang berulang tiap minggu.
- Jawab pertanyaan soal jadwal kuliah dengan akurat
- Ingatkan tugas yang deadline-nya dekat (< 3 hari) dengan peringatan khusus ⚠️
- Tugas yang "Belum Dikerjakan" harus selalu diingatkan
- Bantu prioritaskan tugas berdasarkan deadline terdekat
- Jawab pakai Bahasa Indonesia yang santai dan friendly
- Gunakan emoji biar lebih menarik
- Kalau ditanya hal di luar akademik, tetap jawab dengan ramah tapi arahkan balik ke topik akademik
  `;
}

async function callGemini(systemPrompt, riwayatChat, pesanUser) {
  const contents = [
    ...riwayatChat.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    })),
    { role: 'user', parts: [{ text: pesanUser }] }
  ];

  const response = await gemini.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: { systemInstruction: systemPrompt }
  });

  return response.text;
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
    } catch (error) {
      if (error.status === 429) {
        return 'Maaf, AI lagi sibuk! Coba lagi dalam 1 menit ya 😊';
      }
      throw error;
    }
  }
}

module.exports = { tanyaBot };