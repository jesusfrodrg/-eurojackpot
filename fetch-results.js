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

function formatFechaObj(dateObj) {
  if (!dateObj || typeof dateObj !== 'object') return String(dateObj);
  var day = dateObj.day, month = dateObj.month, year = dateObj.year;
  if (!day || !month || !year) return JSON.stringify(dateObj);
  var d = new Date(year, month - 1, day);
  return DIAS[d.getDay()] + ' ' + day + ' ' + MESES[month - 1] + ' ' + year;
}

var MAX_SORTEOS = 30;

async function fetchResults() {
  var today = new Date();
  var todayStr = today.toLocaleDateString('es-ES');
  var ultimoSorteo = null;
  var bote = null;

  // PASO 1: Ultimo sorteo + bote desde Lottoland API
  try {
    var raw = await get('https://media.lottoland.com/api/drawings/euroJackpot');
    var data = JSON.parse(raw);
    var last = data.last;
    if (last) {
      var fecha = formatFechaObj(last.date);
      var nums = (last.numbers || []).map(Number).sort(function(a,b){return a-b;});
      var stars = (last.euroNumbers || []).map(Number).sort(function(a,b){return a-b;});
      if (nums.length === 5 && stars.length === 2) {
        ultimoSorteo = {fecha: fecha, nums: nums, stars: stars};
        console.log('Ultimo sorteo: ' + fecha + ' nums=' + nums + ' stars=' + stars);
      }
      if (data.next && data.next.jackpot) {
        var mill = parseInt(data.next.jackpot);
        if (mill >= 10 && mill <= 120) bote = mill + ' millones \u20ac';
      }
      if (!bote && last.jackpot) {
        var mill2 = parseInt(last.jackpot);
        if (mill2 >= 10 && mill2 <= 120) bote = mill2 + ' millones \u20ac';
      }
    }
    console.log('Bote: ' + (bote||'no encontrado'));
  } catch(e) {
    console.log('Lottoland error: ' + e.message);
  }

  // PASO 2: Cargar historial existente del data.json anterior (acumulativo)
  var sorteosExistentes = [];
  try {
    var prev = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    if (Array.isArray(prev.sorteos)) sorteosExistentes = prev.sorteos;
    console.log('Sorteos existentes en data.json: ' + sorteosExistentes.length);
  } catch(e) {
    console.log('No hay data.json previo, se creara desde cero');
  }

  // Historial base de respaldo (15 sorteos conocidos, para arrancar el historial de 30)
  var historialBase = [
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
  ];

  // Construir nueva lista: empezar con existentes o base
  var base = sorteosExistentes.length > 0 ? sorteosExistentes : historialBase;
  var sorteos = base.slice();

  // Si tenemos un sorteo nuevo de Lottoland y no esta ya en la lista, añadirlo al principio
  if (ultimoSorteo) {
    var yaExiste = sorteos.some(function(s){ return s.nums.join() === ultimoSorteo.nums.join() && s.stars.join() === ultimoSorteo.stars.join(); });
    if (!yaExiste) {
      sorteos.unshift(ultimoSorteo);
      console.log('Nuevo sorteo añadido al historial: ' + ultimoSorteo.fecha);
    } else {
      console.log('El sorteo ya estaba en el historial, no se duplica');
    }
  }

  // Limitar a MAX_SORTEOS
  sorteos = sorteos.slice(0, MAX_SORTEOS);

  // Si por algun motivo nos quedamos cortos, completar con base sin duplicar
  if (sorteos.length < MAX_SORTEOS) {
    historialBase.forEach(function(h) {
      if (sorteos.length < MAX_SORTEOS && !sorteos.some(function(s){return s.nums.join()===h.nums.join() && s.stars.join()===h.stars.join();})) {
        sorteos.push(h);
      }
    });
  }

  // Calcular pares (sobre ultimos 30 para que sea representativo)
  var ult30 = sorteos.slice(0, 30);
  var pares = {};
  ult30.forEach(function(s) {
    for (var i = 0; i < s.nums.length; i++) {
      for (var j = i+1; j < s.nums.length; j++) {
        var k = s.nums[i] + '-' + s.nums[j];
        pares[k] = (pares[k]||0) + 1;
      }
    }
  });
  var topPares = Object.keys(pares).map(function(k){return{par:k,c:pares[k]};}).sort(function(a,b){return b.c-a.c;}).slice(0,10);

  var result = {
    bote: bote || (sorteosExistentes.length ? JSON.parse(fs.readFileSync('data.json','utf8')).bote : '45 millones \u20ac') || '45 millones \u20ac',
    sorteos: sorteos,
    topPares: topPares,
    fuente: 'lottoland.com',
    actualizado: todayStr
  };

  fs.writeFileSync('data.json', JSON.stringify(result, null, 2));
  console.log('FINAL: bote=' + result.bote + ' sorteos=' + sorteos.length);
}

fetchResults().catch(function(err) {
  console.error('Error: ' + err.message);
  process.exit(1);
});
