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

async function fetchResults() {
  var today = new Date();
  var todayStr = today.toLocaleDateString('es-ES');
  var sorteos = [];
  var bote = null;

  // BOTE desde juegosonce.es
  try {
    var h1 = await get('https://www.juegosonce.es/eurojackpot');
    var m = h1.match(/Eurojackpot[.\s\n\r]{1,20}([\d.]+)\s*\u20ac/);
    if (!m) m = h1.match(/bote[^0-9]{0,30}([\d.]+)\s*\u20ac/i);
    if (!m) m = h1.match(/([\d]+\.[\d]{3}\.[\d]{3})\s*\u20ac/);
    if (m) {
      var euros = parseInt(m[1].replace(/\./g,''));
      if (euros >= 10000000 && euros <= 120000000)
        bote = (euros/1000000).toFixed(0) + ' millones \u20ac';
    }
  } catch(e) { console.log('bote error: '+e.message); }

  // SORTEOS desde euro-jackpot.net — intentar coger 30
  try {
    var h2 = await get('https://www.euro-jackpot.net/es/resultados');
    var fechaRe = /((?:lunes|martes|mi\u00e9rcoles|jueves|viernes|s\u00e1bado|domingo)\s+\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/gi;
    var fechas = [];
    var fm;
    var dias={lunes:'Lun',martes:'Mar',miercoles:'Mie',jueves:'Jue',viernes:'Vie',sabado:'Sab',domingo:'Dom'};
    var meses={enero:'ene',febrero:'feb',marzo:'mar',abril:'abr',mayo:'may',junio:'jun',julio:'jul',agosto:'ago',septiembre:'sep',octubre:'oct',noviembre:'nov',diciembre:'dic'};
    while ((fm = fechaRe.exec(h2)) !== null) {
      var s = fm[1].toLowerCase().replace(/\u00e9/g,'e').replace(/\u00e1/g,'a');
      var dm = s.match(/(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\s+(\d+)\s+de\s+(\w+)\s+de\s+(\d{4})/);
      if (dm) fechas.push({ texto:(dias[dm[1]]||dm[1].slice(0,3))+' '+dm[2]+' '+(meses[dm[3]]||dm[3].slice(0,3))+' '+dm[4], pos:fm.index });
      if (fechas.length >= 35) break;
    }
    for (var i = 0; i < fechas.length && sorteos.length < 30; i++) {
      var start = fechas[i].pos;
      var end = i+1 < fechas.length ? fechas[i+1].pos : start+500;
      var bloque = h2.substring(start, end);
      var nums = [];
      var liRe = /\*\s*(\d{1,2})\n/g; var lm;
      while ((lm = liRe.exec(bloque)) !== null) { nums.push(+lm[1]); if(nums.length>=7) break; }
      if (nums.length < 7) {
        nums = [];
        var liRe2 = /<li[^>]*>\s*(\d{1,2})\s*<\/li>/g;
        while ((lm = liRe2.exec(bloque)) !== null) { nums.push(+lm[1]); if(nums.length>=7) break; }
      }
      if (nums.length===7 && nums.every(function(n){return n>=1&&n<=50;})) {
        sorteos.push({
          fecha: fechas[i].texto,
          nums: nums.slice(0,5).sort(function(a,b){return a-b;}),
          stars: nums.slice(5,7).sort(function(a,b){return a-b;})
        });
      }
    }
    // Si solo hay 10 en la primera pagina, intentar paginas anteriores
    if (sorteos.length < 20) {
      try {
        var h3 = await get('https://www.euro-jackpot.net/es/archivo-resultados');
        var fechas2 = [];
        while ((fm = fechaRe.exec(h3)) !== null) {
          var s2 = fm[1].toLowerCase().replace(/\u00e9/g,'e').replace(/\u00e1/g,'a');
          var dm2 = s2.match(/(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\s+(\d+)\s+de\s+(\w+)\s+de\s+(\d{4})/);
          if (dm2) fechas2.push({ texto:(dias[dm2[1]]||dm2[1].slice(0,3))+' '+dm2[2]+' '+(meses[dm2[3]]||dm2[3].slice(0,3))+' '+dm2[4], pos:fm.index });
          if (fechas2.length >= 25) break;
        }
        for (var j = 0; j < fechas2.length && sorteos.length < 30; j++) {
          var s3 = fechas2[j].pos;
          var e3 = j+1 < fechas2.length ? fechas2[j+1].pos : s3+500;
          var b3 = h3.substring(s3, e3);
          var n3 = [];
          var r3 = /<li[^>]*>\s*(\d{1,2})\s*<\/li>/g;
          while ((lm = r3.exec(b3)) !== null) { n3.push(+lm[1]); if(n3.length>=7) break; }
          if (n3.length===7 && n3.every(function(n){return n>=1&&n<=50;})) {
            sorteos.push({
              fecha: fechas2[j].texto,
              nums: n3.slice(0,5).sort(function(a,b){return a-b;}),
              stars: n3.slice(5,7).sort(function(a,b){return a-b;})
            });
          }
        }
      } catch(e) { console.log('archivo error: '+e.message); }
    }
    console.log('Sorteos obtenidos: '+sorteos.length);
  } catch(e) { console.log('sorteos error: '+e.message); }

  // Respaldo
  if (sorteos.length === 0) {
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
      {fecha:'Vie 17 abr 2026',nums:[16,31,35,43,44],stars:[2,9]},
      {fecha:'Mar 14 abr 2026',nums:[13,22,32,46,47],stars:[6,7]},
      {fecha:'Vie 10 abr 2026',nums:[1,6,11,18,48],stars:[10,12]},
      {fecha:'Mar 7 abr 2026',nums:[2,4,16,23,27],stars:[5,8]},
      {fecha:'Vie 3 abr 2026',nums:[9,10,18,22,37],stars:[1,11]},
      {fecha:'Mar 31 mar 2026',nums:[5,15,18,20,35],stars:[7,8]}
    );
  }

  // Calcular pares frecuentes
  var pares = {};
  sorteos.forEach(function(s) {
    for (var i = 0; i < s.nums.length; i++) {
      for (var j = i+1; j < s.nums.length; j++) {
        var k = s.nums[i]+'-'+s.nums[j];
        pares[k] = (pares[k]||0) + 1;
      }
    }
  });
  var topPares = Object.keys(pares).map(function(k){return{par:k,c:pares[k]};}).sort(function(a,b){return b.c-a.c;}).slice(0,10);

  var result = {
    bote: bote || '35 millones \u20ac',
    sorteos: sorteos,
    topPares: topPares,
    fuente: 'juegosonce.es + euro-jackpot.net',
    actualizado: todayStr
  };
  fs.writeFileSync('data.json', JSON.stringify(result, null, 2));
  console.log('OK: bote='+result.bote+' sorteos='+sorteos.length);
}

fetchResults().catch(function(err) {
  console.error('Error: '+err.message);
  process.exit(1);
});
