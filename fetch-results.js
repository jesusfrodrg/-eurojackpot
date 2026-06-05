const https = require('https');
const fs = require('fs');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function fetchResults() {
  const url = 'https://www.lotto.net/es/eurojackpot/resultados';
  const html = await get(url);

  const sorteos = [];
  const today = new Date().toLocaleDateString('es-ES');

  const fechaRe = /(viernes|martes)\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/gi;
  const fechas = [];
  let fm;
  while ((fm = fechaRe.exec(html)) !== null) {
    fechas.push({
      texto: `${fm[1].charAt(0).toUpperCase()+fm[1].slice(1,3)} ${fm[2]} ${fm[3].slice(0,3)} ${fm[4]}`,
      pos: fm.index
    });
    if (fechas.length >= 10) break;
  }

  const numBloqueRe = /(\d{1,2})[^\d]+(\d{1,2})[^\
