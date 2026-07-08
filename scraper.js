const puppeteer = require('puppeteer');
const fs = require('fs');

const LMS_URL = process.env.LMS_URL;

async function loginAndScrape(username, password) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  try {
    // ===== LOGIN =====
    await page.goto(`${LMS_URL}`, { waitUntil: 'networkidle2' });

    console.log('🔍 Judul halaman login:', await page.title());
    console.log('🔍 URL saat ini:', page.url());

    await page.waitForSelector('input[placeholder="Username"]', { timeout: 15000 });
    await page.type('input[placeholder="Username"]', username);
    await page.type('input[placeholder="Password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    const currentUrl = page.url();
    if (currentUrl.includes('login')) {
      throw new Error('Login gagal, cek username/password');
    }
    console.log('✅ Login sukses, URL sekarang:', currentUrl);

    // ===== SCRAPE JADWAL KELAS =====
    await page.goto(`${LMS_URL}/kelas`, { waitUntil: 'networkidle2' });

    // DEBUG: simpan kondisi halaman /kelas SEBELUM di-scrape
    await page.screenshot({ path: 'debug-kelas.png', fullPage: true });
    fs.writeFileSync('debug-kelas.html', await page.content());
    console.log('📸 debug-kelas.png & debug-kelas.html tersimpan');
    console.log('🔍 URL halaman kelas:', page.url());

    // Cek dulu apakah selector container-nya ada, kasih waktu render
    const kelasSelectorFound = await page
      .waitForSelector('.kelas-kuliah-item', { timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!kelasSelectorFound) {
      console.log('⚠️ Selector .kelas-kuliah-item TIDAK ditemukan di /kelas');
      // cek kalau-kalau kontennya di dalam iframe
      const frameUrls = page.frames().map(f => f.url());
      console.log('🔍 Frame yang ada di halaman:', frameUrls);
    }

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

    console.log(`📊 Kelas ditemukan: ${kelas.length}`);

    // ===== SCRAPE TUGAS =====
    await page.goto(`${LMS_URL}/tugas`, { waitUntil: 'networkidle2' });

    // DEBUG: simpan kondisi halaman /tugas SEBELUM di-scrape
    await page.screenshot({ path: 'debug-tugas.png', fullPage: true });
    fs.writeFileSync('debug-tugas.html', await page.content());
    console.log('📸 debug-tugas.png & debug-tugas.html tersimpan');
    console.log('🔍 URL halaman tugas:', page.url());

    const tugasSelectorFound = await page
      .waitForSelector('.tugas-card', { timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!tugasSelectorFound) {
      console.log('⚠️ Selector .tugas-card TIDAK ditemukan di /tugas');
      const frameUrls = page.frames().map(f => f.url());
      console.log('🔍 Frame yang ada di halaman:', frameUrls);
    }

    const tugas = await page.evaluate(() => {
      const items = document.querySelectorAll('.tugas-card');
      const results = [];
      items.forEach(item => {
        const judul = item.querySelector('.tugas-card__title')?.innerText?.trim();
        const matkul = item.querySelector('.makul-column p')?.innerText?.trim();
        const datetimeText = item.querySelector('.datetime-column')?.innerText?.trim().replace(/\s+/g, ' ');
        const parts = datetimeText ? datetimeText.split('—') : [];
        const deadline = parts.length > 1 ? parts[1].trim() : datetimeText;
        const status = item.querySelector('.tag')?.innerText?.trim();
        if (judul) results.push({ judul, matkul, deadline, status });
      });
      return results;
    });

    console.log(`📊 Tugas ditemukan: ${tugas.length}`);

    await browser.close();
    return { success: true, kelas, tugas };

  } catch (error) {
    console.log('❌ Error di scraper:', error.message);
    await browser.close();
    return { success: false, error: error.message };
  }
}

module.exports = { loginAndScrape };