const { tanyaBot } = require('./claude');

async function test() {
  const dataKelas = [
    { mataKuliah: 'Basis Data', hari: 'Senin', jam: '08:00-10:00' }
  ];
  const dataTugas = [
    { mataKuliah: 'Basis Data', deskripsi: 'Buat ERD', deadline: '2026-07-06', status: 'Belum Dikerjakan' }
  ];
  const riwayatChat = [];

  const jawaban = await tanyaBot('Ada tugas apa aja minggu ini?', dataKelas, dataTugas, riwayatChat);
  console.log('Jawaban bot:', jawaban);
}

test();