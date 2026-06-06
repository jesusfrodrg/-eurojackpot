const https = require('https');
const fs = require('fs');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9'
      },
      timeout: 15000
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function pad(n) { return String(n).padStart(2, '0'); }

async function fetchResults() {
  const today = new Date();
  const todayStr = today.toLocaleDateString('es-ES');
  const sorteos = [];

  try {
    const html = await get('https://eurojackpot.net/es/resultados.htm');
    const liRe = /<li[^>]*>(\d+)<\/li>/g;
    const allNums = [];
    let m;
    while ((m = liRe.exec(html)) !== null) allNums.push(+m[1]);

    const fechaRe = /(\d{1,2})[.\s\/](\d{1,2})[.\s\/](\d{4})/g;
    const fechas = [];
    while ((m = fechaRe.exec(html)) !== null && fechas.length < 10) {
      fechas.push(pad(m[1]) + '/' + pad(m[2]) + '/' + m[3]);
    }

    for (let i = 0; i < allNums.length - 6 && sorteos.length < 10; i += 7) {
      const chunk = allNums.slice(i, i + 7);
      if (chunk.every(n => n >= 1 && n <= 50)) {
        sorteos.push({
          fecha: fechas[sorteos.length] || todayStr,
          nums: chunk.slice(0, 5).sort((a, b) => a - b),
          stars: chunk.slice(5, 7).sort((a, b) => a - b)
        });
      }
    }
  } catch(e) {
    console.log('Web no accesible:', e.message);
  }

  if (sorteos.length === 0) {
    console.log('Usando datos de respaldo');
    const backup = [
      {"fecha":"Mar 2 jun 2026","nums":[2,36,38,40,46],"stars":[7,8]},
      {"fecha":"Vie 29 may 2026","nums":[3,20,21,42,49],"stars":[5,6]},
      {"fecha":"Mar 26 may 2026","nums":[5,11,23,33,42],"stars":[10,12]},
      {"fecha":"Vie 22 may 2026","nums":[5,34,35,42,46],"stars":[3,5]},
      {"fecha":"Vie 1 may 2026
