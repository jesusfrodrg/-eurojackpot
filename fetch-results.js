const https = require('https');
const fs = require('fs');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function fetchResults() {
  const url = 'https://www.lotto.net/es/eurojackpot/resultados';
  const html = await get(url);
  const today = new Date().toLocaleDateString('es-ES');
  const sorteos = [];

  const fechaRe = /(viernes|martes)\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/gi;
  const fechas = [];
  let fm;
  while ((fm = fechaRe.exec(html)) !== null) {
    fechas.push({ texto: fm[1].slice(0,3) + ' ' + fm[2] + ' ' + fm[3].slice(0,3) + ' ' + fm[4], pos: fm.index });
    if (fechas.length >= 10) break;
  }

  for (let i = 0; i < fechas.length && sorteos.length < 10; i++) {
    const start = fechas[i].pos;
    const end = fechas[i + 1] ? fechas[i + 1].pos : start + 600;
    const bloque = html.substring(start, end);
    const nums = [];
    const liRe = />\s*(\d{1,2})\s*</g;
    let lr;
    while ((lr = liRe.exec(bloque)) !== null) {
      const n = parseInt(lr[1]);
      if (n >= 1 && n <= 50) nums.push(n);
      if (nums.length >= 7) break;
    }
    if (nums.length === 7) {
      sorteos.push({
        fecha: fechas[i].texto,
        nums: nums.slice(0, 5).sort((a, b) => a - b),
        stars: nums.slice(5, 7).sort((a, b) => a - b)
      });
    }
  }

  const bm = html.match(/(\d+)\s*millones/i);
  const bote = bm ? bm[1] + ' millones €' : '—';

  const result = { bote, sorteos: sorteos.slice(0, 10), fuente: 'lotto.net', actualizado: today };
  fs.writeFileSync('data.json', JSON.stringify(result, null, 2));
  console.log('OK: ' + sorteos.length + ' sorteos, bote: ' + bote);
}

fetchResults().catch(function(err) {
  console.error('Error:', err);
  process.exit(1);
});
