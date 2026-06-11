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

function formatFechaLottoland(dateObj) {
  // dateObj = {day:9, month:6, year:2026, ...}
  if (!dateObj || !dateObj.day) return '—';
  var d = new Date(dateObj.year, dateObj.month - 1, dateObj.day);
  return DIAS[d.getDay()] + ' ' + dateObj.day + ' ' + MESES[dateObj.month - 1] + ' ' + dateObj.year;
}

function parseSorteoLottoland(d) {
  var fecha = formatFechaLottoland(d.date);
  var nums = (d.numbers || []).map(Number).sort(function(a,b){return a-b;});
  var stars = (d.euroNumbers || []).map(Number).sort(function(a,b){return a-b;});
  if (nums.length === 5 && stars.length === 2) {
    return {fecha: fecha, nums: nums, stars: stars};
  }
  return null;
}

async function fetchResults() {
  var today = new Date();
  var todayStr = today.toLocaleDateString('es-ES');
  var sorteos = [];
  var bote = null;

  // PASO 1: Obtener ultimo sorteo + bote de Lottoland
  try {
    var raw = await get('https://media.lottoland.com/api/drawings/euroJackpot');
    var data = JSON.parse(raw);

    // Bote: jackpot es string con millones "35"
    if (data.last && data.last.jackpot) {
      var mill = parseInt(data.last.jackpot);
      if (mill >= 10 && mill <= 120) bote = mill + ' millones \u20ac';
    }
    // Tambien puede estar en marketingJackpot del proximo
    if (!bote && data.next && data.next.jackpot) {
      var mill2 = parseInt(data.next.jackpot);
      if (mill2 >= 10 && mill2 <= 120) bote = mill2 + ' millones \u20ac';
    }

    // Ultimo sorteo
    if (data.last) {
      var s = parseSorteoLottoland(data.last);
      if (s) sorteos.push(s);
    }
    console.log('Lottoland: 1 sorteo obtenido, bote=' + (bote||'no'));
  } catch(e) {
    console.log('Lottoland error: ' + e.message);
  }

  // PASO 2: Obtener historial de los ultimos 10 sorteos desde combinacionganadora.com
  try {
    var html = await get('https://www.combinacionganadora.com/eurojackpot/');
    // Buscar patron: "1,14,22,39,48. Soles: 8,11"
    var patRe = /(\d{1,2}),(\d{1,2}),(\d{1,2}),(\d{1,2}),(\d{1,2})\.\s*Soles:\s*(\d{1,2}),(\d{1,2})/g;
    // Fechas: "martes 9 de junio de 2026" o "viernes 6 de junio de 2026"
    var fechaRe = /(lunes|martes|mi\u00e9rcoles|jueves|viernes|s\u00e1bado|domingo)\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/gi;
    var mesesMap = {enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,octubre:9,noviembre:10,diciembre:11};
    var diasMap = {lunes:'Lun',martes:'Mar','mi\u00e9rcoles':'Mie',miercoles:'Mie',jueves:'Jue',viernes:'Vie','s\u00e1bado':'Sab',sabado:'Sab',domingo:'Dom'};

    var fechas = [];
    var fm;
    while ((fm = fechaRe.exec(html)) !== null) {
      var mes = mesesMap[fm[3].toLowerCase()];
      if (mes !== undefined) {
        var d2 = new Date(+fm[4], mes, +fm[2]);
        var diaKey = fm[1].toLowerCase().replace(/\u00e9/g,'e').replace(/\u00e1/g,'a');
        fechas.push((diasMap[diaKey]||fm[1].slice(0,3)) + ' ' + fm[2] + ' ' + MESES[mes] + ' ' + fm[4]);
      }
      if (fechas.length >= 10) break;
    }

    var pm;
    var idx = 0;
    while ((pm = patRe.exec(html)) !== null && sorteos.length < 10) {
      var nums = [+pm[1],+pm[2],+pm[3],+pm[4],+pm[5]].sort(function(a,b){return a-b;});
      var stars = [+pm[6],+pm[7]].sort(function(a,b){return a-b;});
      var fecha = fechas[idx] || todayStr;
      // Evitar duplicar el ultimo sorteo que ya tenemos de Lottoland
      var yaExiste = sorteos.some(function(s){return s.nums.join()==nums.join();});
      if (!yaExiste) {
        sorteos.push({fecha: fecha, nums: nums, stars: stars});
      }
      idx++;
    }
    console.log('combinacionganadora: total sorteos=' + sorteos.length);
  } catch(e) {
    console.log('combinacionganadora error: ' + e.message);
  }

  // BOTE desde juegosonce si no lo tenemos
  if (!bote) {
    try {
      var h2 = await get('https://www.juegosonce.es/eurojackpot');
      var bm = h2.match(/([\d]+\.[\d]{3}\.[\d]{3})\s*\u20ac/);
      if (bm) {
        var euros = parseInt(bm[1].replace(/\./g,''));
        if (euros >= 10000000 && euros <= 120000000)
          bote = (euros/1000000).toFixed(0) + ' millones \u20ac';
      }
    } catch(e) { console.log('bote juegosonce error: ' + e.message); }
  }

  // RESPALDO si no hay suficientes sorteos
  if (sorteos.length < 5) {
    console.log('Completando con respaldo...');
    var respaldo = [
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
    ];
    respaldo.forEach(function(r) {
      if (sorteos.length < 10 && !sorteos.some(function(s){return s.nums.join()==r.nums.join();})) {
        sorteos.push(r);
      }
    });
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
    bote: bote || '45 millones \u20ac',
    sorteos: sorteos.slice(0,10),
    topPares: topPares,
    fuente: 'lottoland + combinacionganadora.com',
    actualizado: todayStr
  };
  fs.writeFileSync('data.json', JSON.stringify(result, null, 2));
  console.log('FINAL: bote=' + result.bote + ' sorteos=' + sorteos.length);
}

fetchResults().catch(function(err) {
  console.error('Error: ' + err.message);
  process.exit(1);
});
