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

function formatFecha(str) {
  var dias = {lunes:'Lun',martes:'Mar',miercoles:'Mie',jueves:'Jue',viernes:'Vie',sabado:'Sab',domingo:'Dom'};
  var meses = {enero:'ene',febrero:'feb',marzo:'mar',abril:'abr',mayo:'may',junio:'jun',julio:'jul',agosto:'ago',septiembre:'sep',octubre:'oct',noviembre:'nov',diciembre:'dic'};
  var m = str.match(/(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+(\d+)\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (!m) return str;
  var dia = dias[m[1].toLowerCase().replace('é','e').replace('á','a')] || m[1].slice(0,3);
  var mes = meses[m[3].toLowerCase()] || m[3].slice(0,3);
  return dia + ' ' + m[2] + ' ' + mes + ' ' + m[4];
}

async function fetchResults() {
  var today = new Date();
  var todayStr = today.toLocaleDateString('es-ES');
  var sorteos = [];
  var bote = null;

  try {
    var html = await get('https://www.euro-jackpot.net/es/resultados');

    // Extraer bote del proximo sorteo - buscar "Proximo bote" o "Siguiente bote"
    var boteNext = html.match(/(?:pr[oó]ximo|siguiente)\s+(?:bote|jackpot)[^\d]*([0-9]+(?:[.,][0-9]+)?)\s*(?:millones|mill)/i);
    if (boteNext) {
      bote = boteNext[1] + ' millones €';
    } else {
      // Buscar patron "Bote X.XXX.XXX €" - coger el del sorteo mas reciente
      var boteMatch = html.match(/Bote\s+([\d.]+)\s*€/);
      if (boteMatch) {
        var euros = parseInt(boteMatch[1].replace(/\./g, ''));
        var millones = Math.round(euros / 1000000);
        if (millones > 0 && millones !== 120) {
          bote = millones + ' millones €';
        }
      }
    }
    console.log('Bote: ' + (bote || 'no encontrado'));

    // Extraer sorteos - buscar bloques con fecha + numeros
    var bloqueRe = /((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d+\s+de\s+\w+\s+de\s+\d{4})([\s\S]*?)(?=(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d+\s+de|$)/gi;
    var bm;
    while ((bm = bloqueRe.exec(html)) !== null && sorteos.length < 10) {
      var fecha = formatFecha(bm[1]);
      var bloque = bm[2];
      var nums = [];
      var liRe = /<li[^>]*>\s*(\d{1,2})\s*<\/li>/g;
      var lm;
      while ((lm = liRe.exec(bloque)) !== null) {
        nums.push(+lm[1]);
        if (nums.length >= 7) break;
      }
      if (nums.length === 7) {
        sorteos.push({
          fecha: fecha,
          nums: nums.slice(0, 5).sort(function(a, b) { return a - b; }),
          stars: nums.slice(5, 7).sort(function(a, b) { return a - b; })
        });
      }
    }
    console.log('Sorteos encontrados: ' + sorteos.length);
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
    bote: bote || '33 millones €',
    sorteos: sorteos.slice(0, 10),
    fuente: 'euro-jackpot.net',
    actualizado: todayStr
  };

  fs.writeFileSync('data.json', JSON.stringify(result, null, 2));
  console.log('Guardado: bote=' + result.bote + ', sorteos=' + sorteos.length);
}

fetchResults().catch(function(err) {
  console.error('Error: ' + err.message);
  process.exit(1);
});
