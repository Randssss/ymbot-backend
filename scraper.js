const puppeteer = require('puppeteer');

const LMS_URL = process.env.LMS_URL;

async function loginAndScrape(username, password) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // LOGIN
    await page.goto(`${LMS_URL}`, { waitUntil: 'networkidle2' });

    // DEBUG: ambil screenshot + judul halaman biar bisa dicek
    // halaman apa yang beneran keload pas Puppeteer jalan
    await page.screenshot({ path: 'debug-login.png', fullPage: true });
    console.log('🔍 Judul halaman:', await page.title());
    console.log('🔍 URL saat ini:', page.url());

    // Tunggu sampai kotak Username beneran muncul di halaman (maksimal 15 detik),
    // soalnya beberapa halaman butuh waktu render setelah "network idle"
    await page.waitForSelector('input[placeholder="Username"]', { timeout: 15000 });

    // Selector diganti pake placeholder, karena input di LMS UYM
    // nggak punya atribut "name" (cek hasil Inspect Element)
    await page.type('input[placeholder="Username"]', username);
    await page.type('input[placeholder="Password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // CEK LOGIN BERHASIL
    const currentUrl = page.url();
    if (currentUrl.includes('login')) {
      throw new Error('Login gagal, cek username/password');
    }

    // SCRAPE JADWAL KELAS
    await page.goto(`${LMS_URL}/kelas`, { waitUntil: 'networkidle2' });
    const kelas = await page.evaluate(() => {
      const items = document.querySelectorAll('.kelas-kuliah-item');
      const results = [];
      items.forEach(item => {
        const nama = item.querySelector('.is-size-5')?.innerText?.trim();
        const dosen = item.querySelector('.avatar')?.nextElementSibling?.innerText?.trim();
        const jadwalRaw = item.querySelector('.is-flex.is-grey.mb-2.no-wrap')?.innerText?.trim();
        const jadwal = jadwalRaw ? jadwalRaw.replace(/\s+/g, ' ') : null;
        if (nama) results.push({ nama, jadwal, dosen });
      });
      return results;
    });

    // SCRAPE TUGAS
    await page.goto(`${LMS_URL}/tugas`, { waitUntil: 'networkidle2' });
    const tugas = await page.evaluate(() => {
      const items = document.querySelectorAll('.tugas-card');
      const results = [];
      items.forEach(item => {
        const judul = item.querySelector('.tugas-card__title')?.innerText?.trim();
        const matkul = item.querySelector('.makul-column p')?.innerText?.trim();
        const datetimeText = item.querySelector('.datetime-column')?.innerText?.trim().replace(/\s+/g, ' ');
        // Formatnya "tanggal mulai — tanggal deadline", jadi ambil bagian setelah tanda "—"
        const parts = datetimeText ? datetimeText.split('—') : [];
        const deadline = parts.length > 1 ? parts[1].trim() : datetimeText;
        const status = item.querySelector('.tag')?.innerText?.trim();
        if (judul) results.push({ judul, matkul, deadline, status });
      });
      return results;
    });

    await browser.close();
    return { success: true, kelas, tugas };

  } catch (error) {
    await browser.close();
    return { success: false, error: error.message };
  }
}

module.exports = { loginAndScrape };