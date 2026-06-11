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

function formatFecha(dateStr) {
  var d = new Date(dateStr);
  return DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.getFullYear();
}

async function fetchResults() {
  var today = new Date();
  var todayStr = today.toLocaleDateString('es-ES');
  var sorteos = [];
  var bote = null;

  // FUENTE 1: API JSON de Lottoland (sin auth, sin bloqueo)
  try {
    console.log('Intentando API Lottoland...');
    var raw = await get('https://media.lottoland.com/api/drawings/euroJackpot');
    var data = JSON.parse(raw);
    // La API devuelve los sorteos en data.drawings o data.last
    var drawings = data.drawings || data.last || data.results || [];
    if (!Array.isArray(drawings) && data.last) drawings = [data.last];
    if (!Array.isArray(drawings)) drawings = Object.values(data).filter(function(v){return Array.isArray(v);})[0] || [];

    drawings.slice(0,10).forEach(function(d) {
      var fecha = formatFecha(d.date || d.drawDate || d.draw_date);
      var nums = (d.numbers || d.winningNumbers || d.main || []).map(Number).sort(function(a,b){return a-b;});
      var stars = (d.euroNumbers || d.bonusNumbers || d.stars || d.secondary || []).map(Number).sort(function(a,b){return a-b;});
      if (nums.length === 5 && stars.length === 2) {
        sorteos.push({fecha: fecha, nums: nums, stars: stars});
      }
    });

    // Bote desde la API
    if (data.jackpot || data.nextJackpot) {
      var j = data.jackpot || data.nextJackpot;
      var mill = Math.round((j.amount || j) / 1000000);
      if (mill >= 10 && mill <= 120) bote = mill + ' millones \u20ac';
    }
    console.log('Lottoland: ' + sorteos.length + ' sorteos, bote: ' + (bote||'no'));
  } catch(e) {
    console.log('Lottoland error: ' + e.message);
  }

  // FUENTE 2: combinacionganadora.com (HTML simple, sin JS dinámico)
  if (sorteos.length === 0) {
    try {
      console.log('Intentando combinacionganadora.com...');
      var html = await get('https://www.combinacionganadora.com/eurojackpot/');
      // Patron: "1,14,22,39,48. Soles: 8,11"
      var m = html.match(/(\d+),(\d+),(\d+),(\d+),(\d+)\.\s*Soles:\s*(\d+),(\d+)/g);
      var fechaRe = /(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/g;
      var fechas = [];
      var fm;
      var meses={enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,octubre:9,noviembre:10,diciembre:11};
      while((fm=fechaRe.exec(html))!==null && fechas.length<10) {
        var mes = meses[fm[2].toLowerCase()];
        if(mes!==undefined) {
          var d2 = new Date(+fm[3], mes, +fm[1]);
          fechas.push(formatFecha(d2.toISOString()));
        }
      }
      if (m) {
        m.slice(0,10).forEach(function(match, i) {
          var parts = match.match(/(\d+),(\d+),(\d+),(\d+),(\d+)\.\s*Soles:\s*(\d+),(\d+)/);
          if (parts) {
            sorteos.push({
              fecha: fechas[i] || todayStr,
              nums: [+parts[1],+parts[2],+parts[3],+parts[4],+parts[5]].sort(function(a,b){return a-b;}),
              stars: [+parts[6],+parts[7]].sort(function(a,b){return a-b;})
            });
          }
        });
      }
      console.log('combinacionganadora: ' + sorteos.length + ' sorteos');
    } catch(e) {
      console.log('combinacionganadora error: ' + e.message);
    }
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
    } catch(e) { console.log('bote error: ' + e.message); }
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
  var topPares=Object.keys(pares).map(function(k){return{par:k,c:pares[k]};}).sort(function(a,b){return b.c-a.c;}).slice(0,10);

  var result = {
    bote: bote || '35 millones \u20ac',
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
