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
  var today = new Date();
  var todayStr = today.toLocaleDateString('es-ES');
  var sorteos = [];
  var bote = null;

  // Obtener bote de juegosonce.es buscando patron especifico "Proximo bote: X €"
  try {
    var html = await get('https://www.juegosonce.es/resultados-eurojackpot');
    // Buscar patron "proximo bote: 35.000.000" o "bote de: 35.000.000"
    var m = html.match(/(?:pr[oó]ximo\s+bote|bote\s+(?:es\s+de|de))[\s:]+([0-9]+(?:[.,][0-9]+)?)\s*(?:millones|mill\.|\.000\.000|\s*€)/i);
    if (!m) {
      // Buscar patron "35.000.000 €" evitando el 120
      var matches = html.match(/([1-9][0-9]?)\.000\.000\s*[€e]/g);
      if (matches) {
        // Coger el primero que no sea 120
        for (var i = 0; i < matches.length; i++) {
          var nm = matches[i].match(/([0-9]+)\.000\.000/);
          if (nm && +nm[1] !== 120) {
            bote = nm[1] + ' millones de euros';
            break;
          }
        }
      }
    } else {
      var val = m[1].replace(',', '.');
      bote = val + ' millones de euros';
    }
    if (bote) console.log('Bote encontrado: ' + bote);
    else console.log('Bote no encontrado en juegosonce.es');
  } catch(e) {
    console.log('Error bote: ' + e.message);
  }

  // Obtener resultados
  try {
    var html2 = await get('https://eurojackpot.net/es/resultados.htm');
    var liRe = /<li[^>]*>(\d+)<\/li>/g;
    var allNums = [];
    var m2;
    while ((m2 = liRe.exec(html2)) !== null) allNums.push(+m2[1]);

    var fechaRe = /(\d{1,2})[.\s\/](\d{1,2})[.\s\/](\d{4})/g;
    var fechas = [];
    while ((m2 = fechaRe.exec(html2)) !== null && fechas.length < 10) {
      fechas.push(pad(m2[1]) + '/' + pad(m2[2]) + '/' + m2[3]);
    }

    for (var i = 0; i < allNums.length - 6 && sorteos.length < 10; i += 7) {
      var chunk = allNums.slice(i, i + 7);
      if (chunk.every(function(n) { return n >= 1 && n <= 50; })) {
        sorteos.push({
          fecha: fechas[sorteos.length] || todayStr,
          nums: chunk.slice(0, 5).sort(function(a, b) { return a - b; }),
          stars: chunk.slice(5, 7).sort(function(a, b) { return a - b; })
        });
      }
    }
    console.log('Sorteos: ' + sorteos.length);
  } catch(e) {
    console.log('Error sorteos: ' + e.message);
  }

  if (sorteos.length === 0) {
    console.log('Usando respaldo');
    sorteos.push(
      {fecha:'06/06/2026',nums:[21,23,44,47,50],stars:[1,7]},
      {fecha:'02/06/2026',nums:[2,36,38,40,46],stars:[7,8]},
      {fecha:'29/05/2026',nums:[3,20,21,42,49],stars:[5,6]},
      {fecha:'26/05/2026',nums:[5,11,23,33,42],stars:[10,12]},
      {fecha:'22/05/2026',nums:[5,34,35,42,46],stars:[3,5]},
      {fecha:'01/05/2026',nums:[10,11,13,16,27],stars:[5,7]},
      {fecha:'28/04/2026',nums:[19,20,41,43,46],stars:[5,7]},
      {fecha:'24/04/2026',nums:[6,21,29,39,44],stars:[1,5]},
      {fecha:'21/04/2026',nums:[31,32,36,39,47],stars:[7,8]},
      {fecha:'17/04/2026',nums:[16,31,35,43,44],stars:[2,9]}
    );
  }

  var result = {
    bote: bote || '35 millones de euros',
    sorteos: sorteos.slice(0, 10),
    fuente: 'juegosonce.es',
    actualizado: todayStr
  };

  fs.writeFileSync('data.json', JSON.stringify(result, null, 2));
  console.log('data.json actualizado: bote=' + result.bote);
}

fetchResults().catch(function(err) {
  console.error('Error: ' + err.message);
  process.exit(1);
});
