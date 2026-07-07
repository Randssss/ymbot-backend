require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { loginAndScrape } = require('./scraper');
const { tanyaBot } = require('./claude');

const app = express();
app.use(cors());
app.use(express.json());

// Simpan session sementara di memory
const sessions = {};

// ENDPOINT LOGIN
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }

  const result = await loginAndScrape(username, password);

  if (!result.success) {
    console.log('❌ Alasan gagal:', result.error);
    return res.status(401).json({ error: result.error });
  }

  sessions[username] = {
    kelas: result.kelas,
    tugas: result.tugas,
    riwayatChat: [],
    lastUpdate: new Date()
  };

  console.log(`✅ Login berhasil: ${username}`);
  console.log(`📚 Kelas ditemukan: ${result.kelas.length}`);
  console.log(`📝 Tugas ditemukan: ${result.tugas.length}`);

  res.json({ success: true, message: 'Login berhasil!' });
});

// ENDPOINT CHAT
app.post('/api/chat', async (req, res) => {
  const { username, pesan } = req.body;

  if (!sessions[username]) {
    return res.status(401).json({ error: 'Sesi tidak ditemukan, silakan login ulang' });
  }

  const session = sessions[username];

  try {
    const jawaban = await tanyaBot(
  pesan,
  session.kelas,
  session.tugas,
  session.riwayatChat
    );

    session.riwayatChat.push({ role: 'user', content: pesan });
    session.riwayatChat.push({ role: 'assistant', content: jawaban });
    if (session.riwayatChat.length > 20) {
      session.riwayatChat = session.riwayatChat.slice(-20);
    }

    res.json({ jawaban });
  } catch (error) {
    console.error('Error AI:', error);
    res.status(500).json({ error: 'Gagal menghubungi AI, coba lagi' });
  }
});

// ENDPOINT CEK DATA (opsional, buat debug)
app.get('/api/data/:username', (req, res) => {
  const session = sessions[req.params.username];
  if (!session) return res.status(404).json({ error: 'Session tidak ada' });
  res.json({ kelas: session.kelas, tugas: session.tugas });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server jalan di http://localhost:${PORT}`);
});