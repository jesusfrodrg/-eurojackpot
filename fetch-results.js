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

var DIAS = {lunes:'Lun',martes:'Mar','mi\u00e9rcoles':'Mie',miercoles:'Mie',jueves:'Jue',viernes:'Vie','s\u00e1bado':'Sab',sabado:'Sab',domingo:'Dom'};
var MESES = {enero:'ene',febrero:'feb',marzo:'mar',abril:'abr',mayo:'may',junio:'jun',julio:'jul',agosto:'ago',septiembre:'sep',octubre:'oct',noviembre:'nov',diciembre:'dic'};

function formatFecha(str) {
  var s = str.toLowerCase().replace(/\u00e9/g,'e').replace(/\u00e1/g,'a');
  var m = s.match(/(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\s+(\d+)\s+de\s+(\w+)\s+de\s+(\d{4})/);
  if (!m) return str;
  return (DIAS[m[1]]||m[1].slice(0,3)) + ' ' + m[2] + ' ' + (MESES[m[3]]||m[3].slice(0,3)) + ' ' + m[4];
}

async function fetchResults() {
  var today = new Date();
  var todayStr = today.toLocaleDateString('es-ES');
  var sorteos = [];
  var bote = null;

  try {
    var html = await get('https://www.euro-jackpot.net/es/resultados');

    // Extraer bote proximo
    var bm = html.match(/Bote\s+([\d.]+)\s*\u20ac/);
    if (bm) {
      var euros = parseInt(bm[1].replace(/\./g,''));
      var mill = Math.round(euros / 1000000);
      if (mill > 0) bote = mill + ' millones \u20ac';
    }
    console.log('Bote: ' + (bote||'no encontrado'));

    // Patron: "Dia DD de Mes de YYYY" seguido de lista de numeros
    var fechaRe = /((?:lunes|martes|mi\u00e9rcoles|jueves|viernes|s\u00e1bado|domingo)\s+\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/gi;
    var fechas = [];
    var fm;
    while ((fm = fechaRe.exec(html)) !== null) {
      fechas.push({ texto: formatFecha(fm[1]), pos: fm.index });
      if (fechas.length >= 12) break;
    }

    for (var i = 0; i < fechas.length && sorteos.length < 10; i++) {
      var start = fechas[i].pos;
      var end = i + 1 < fechas.length ? fechas[i+1].pos : start + 400;
      var bloque = html.substring(start, end);
      var nums = [];
      var liRe = /\*\s*(\d{1,2})\n/g;
      var lm;
      while ((lm = liRe.exec(bloque)) !== null) {
        nums.push(+lm[1]);
        if (nums.length >= 7) break;
      }
      // Si no encontro con *, buscar con <li>
      if (nums.length < 7) {
        nums = [];
        var liRe2 = /<li[^>]*>\s*(\d{1,2})\s*<\/li>/g;
        while ((lm = liRe2.exec(bloque)) !== null) {
          nums.push(+lm[1]);
          if (nums.length >= 7) break;
        }
      }
      if (nums.length === 7 && nums.every(function(n){return n>=1&&n<=50;})) {
        sorteos.push({
          fecha: fechas[i].texto,
          nums: nums.slice(0,5).sort(function(a,b){return a-b;}),
          stars: nums.slice(5,7).sort(function(a,b){return a-b;})
        });
      }
    }
    console.log('Sorteos: ' + sorteos.length);
  } catch(e) {
    console.log('Error: ' + e.message);
  }

  if (sorteos.length === 0) {
    console.log('Usando respaldo');
    sorteos.push(
      {fecha:'Vie 6 jun 2026',nums:[21,23,44,47,50],stars:[1,7]},
      {fecha:'Mar 2 jun 2026',nums:[2,36,38,40,46],stars:[7,8]},
      {fecha:'Vie 29 may 2026',nums:[3,20,21,42,49],stars:[5,6]},
      {fecha:'Mar 26 may 2026',nums:[5,11,23,33,42],stars:[10,12]},
      {fecha:'Vie 22 may 2026',nums:[5,34,35,42,46],stars:[3,5]},
      {fecha:'Vie 1 may 2026',nums:[10,11,13,16,27],stars:[5,7]},
      {fecha:'Mar 28 abr 2026',nums:[19,20,41,43,46],stars:[5,7]},
      {fecha:'Vie 24 abr 2026',nums:[6,21,29,39,44],stars:[1,5]},
      {fecha:'Mar 21 abr 2026',nums:[31,32,36,39,47],stars:[7,8]},
      {fecha:'Vie 17 abr 2026',nums:[16,31,35,43,44],stars:[2,9]}
    );
  }

  var result = {
    bote: bote || todayStr,
    sorteos: sorteos.slice(0,10),
    fuente: 'euro-jackpot.net',
    actualizado: todayStr
  };
  fs.writeFileSync('data.json', JSON.stringify(result, null, 2));
  console.log('OK: bote=' + result.bote + ' sorteos=' + sorteos.length);
}

fetchResults().catch(function(err) {
  console.error('Error: ' + err.message);
  process.exit(1);
});
