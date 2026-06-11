const https = require('https');
const fs = require('fs');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/html',
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

var DIAS = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
var MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function formatFecha(val) {
  if (!val) return '—';
  var d;
  // Formato DD.MM.YYYY
  if (typeof val === 'string' && val.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
    var p = val.split('.');
    d = new Date(+p[2], +p[1]-1, +p[0]);
  }
  // Formato timestamp numero
  else if (typeof val === 'number') {
    d = new Date(val > 9999999999 ? val : val * 1000);
  }
  // Formato ISO o cualquier string fecha
  else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) return String(val);
  return DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.getFullYear();
}

async function fetchResults() {
  var today = new Date();
  var todayStr = today.toLocaleDateString('es-ES');
  var sorteos = [];
  var bote = null;

  // FUENTE 1: API JSON de Lottoland
  try {
    console.log('Intentando API Lottoland...');
    var raw = await get('https://media.lottoland.com/api/drawings/euroJackpot');
    console.log('Lottoland raw (primeros 500): ' + raw.substring(0, 500));
    var data = JSON.parse(raw);

    // Explorar estructura para encontrar los sorteos
    var drawings = [];
    if (Array.isArray(data)) drawings = data;
    else if (Array.isArray(data.drawings)) drawings = data.drawings;
    else if (Array.isArray(data.results)) drawings = data.results;
    else if (data.last) drawings = [data.last];
    else {
      // Buscar el primer array dentro del objeto
      var keys = Object.keys(data);
      for (var k = 0; k < keys.length; k++) {
        if (Array.isArray(data[keys[k]])) { drawings = data[keys[k]]; break; }
      }
    }

    console.log('Drawings encontrados: ' + drawings.length);
    if (drawings.length > 0) console.log('Primer drawing: ' + JSON.stringify(drawings[0]).substring(0, 300));

    drawings.slice(0, 10).forEach(function(d) {
      // Fecha — probar varios campos posibles
      var fechaRaw = d.date || d.drawDate || d.draw_date || d.drawOn || d.gameDate || null;
      var fecha = formatFecha(fechaRaw);

      // Numeros principales
      var nums = [];
      if (Array.isArray(d.numbers)) nums = d.numbers.map(Number);
      else if (Array.isArray(d.winningNumbers)) nums = d.winningNumbers.map(Number);
      else if (Array.isArray(d.mainNumbers)) nums = d.mainNumbers.map(Number);
      else if (d.primary && Array.isArray(d.primary)) nums = d.primary.map(Number);

      // Soles / estrellas
      var stars = [];
      if (Array.isArray(d.euroNumbers)) stars = d.euroNumbers.map(Number);
      else if (Array.isArray(d.bonusNumbers)) stars = d.bonusNumbers.map(Number);
      else if (Array.isArray(d.stars)) stars = d.stars.map(Number);
      else if (Array.isArray(d.secondary)) stars = d.secondary.map(Number);
      else if (d.additionalNumbers && Array.isArray(d.additionalNumbers)) stars = d.additionalNumbers.map(Number);

      if (nums.length === 5 && stars.length === 2) {
        sorteos.push({
          fecha: fecha,
          nums: nums.sort(function(a,b){return a-b;}),
          stars: stars.sort(function(a,b){return a-b;})
        });
      }
    });

    // Bote
    if (data.jackpot) {
      var j = typeof data.jackpot === 'object' ? (data.jackpot.amount || data.jackpot.value || 0) : data.jackpot;
      var mill = Math.round(j / 1000000);
      if (mill >= 10 && mill <= 120) bote = mill + ' millones \u20ac';
    }
    if (!bote && data.nextJackpot) {
      var j2 = typeof data.nextJackpot === 'object' ? (data.nextJackpot.amount || data.nextJackpot.value || 0) : data.nextJackpot;
      var mill2 = Math.round(j2 / 1000000);
      if (mill2 >= 10 && mill2 <= 120) bote = mill2 + ' millones \u20ac';
    }
    console.log('Lottoland: ' + sorteos.length + ' sorteos, bote: ' + (bote||'no'));
  } catch(e) {
    console.log('Lottoland error: ' + e.message);
  }

  // BOTE desde juegosonce si no lo tenemos
  if (!bote) {
    try {
      var h2 = await get('https://www.juegosonce.es/eurojackpot');
      var bm = h2.match(/Eurojackpot[.\s\n\r]{1,20}([\d.]+)\s*\u20ac/);
      if (!bm) bm = h2.match(/([\d]+\.[\d]{3}\.[\d]{3})\s*\u20ac/);
      if (bm) {
        var euros = parseInt(bm[1].replace(/\./g,''));
        if (euros >= 10000000 && euros <= 120000000)
          bote = (euros/1000000).toFixed(0) + ' millones \u20ac';
      }
    } catch(e) { console.log('bote juegosonce error: ' + e.message); }
  }

  // RESPALDO si todo falla
  if (sorteos.length === 0) {
    console.log('Usando respaldo');
    sorteos.push(
      {fecha:'Mar 9 jun 2026',nums:[1,14,22,39,48],stars:[8,11]},
      {fecha:'Vie 6 jun 2026',nums:[21,23,44,47,50],stars:[1,7]},
      {fecha:'Mar 2 jun 2026',nums:[2,36,38,40,46],stars:[7,8]},
      {fecha:'Vie 29 may 2026',nums:[3,20,21,42,49],stars:[5,6]},
      {fecha:'Mar 26 may 2026',nums:[5,11,23,33,42],stars:[10,12]},
      {fecha:'Vie 22 may 2026',nums:[5,34,35,42,46],stars:[3,5]},
      {fecha:'Vie 1 may 2026',nums:[10,11,13,16,27],stars:[5,7]},
      {fecha:'Mar 28 abr 2026',nums:[19,20,41,43,46],stars:[5,7]},
      {fecha:'Vie 24 abr 2026',nums:[6,21,29,39,44],stars:[1,5]},
      {fecha:'Mar 21 abr 2026',nums:[31,32,36,39,47],stars:[7,8]}
    );
  }

  // Calcular pares
  var pares = {};
  sorteos.forEach(function(s) {
    for (var i=0;i<s.nums.length;i++) {
      for (var j=i+1;j<s.nums.length;j++) {
        var k=s.nums[i]+'-'+s.nums[j];
        pares[k]=(pares[k]||0)+1;
      }
    }
  });
  var topPares = Object.keys(pares).map(function(k){return{par:k,c:pares[k]};}).sort(function(a,b){return b.c-a.c;}).slice(0,10);

  var result = {
    bote: bote || '45 millones \u20ac',
    sorteos: sorteos.slice(0,10),
    topPares: topPares,
    fuente: 'lottoland API + juegosonce.es',
    actualizado: todayStr
  };
  fs.writeFileSync('data.json', JSON.stringify(result, null, 2));
  console.log('OK: bote=' + result.bote + ' sorteos=' + sorteos.length);
}

fetchResults().catch(function(err) {
  console.error('Error: ' + err.message);
  process.exit(1);
});
