const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const fs = require('fs');

const today = new Date().toLocaleDateString('es-ES');

async function getResults() {
  const prompt = `Hoy es ${today}. Dame los últimos 10 resultados del sorteo Eurojackpot (se sortea martes y viernes).
Busca en la web los resultados más recientes y devuelve SOLO un JSON válido sin texto adicional ni backticks:
{"bote":"27 millones €","sorteos":[{"fecha":"Mar 3 jun 2026","nums":[1,2,3,4,5],"stars":[1,2]},...],"fuente":"euro-jackpot.net","actualizado":"${today}"}
Los sorteos deben ir del más reciente al más antiguo. Incluye exactamente 10 sorteos.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await res.json();
  let txt = '';
  for (const block of data.content) {
    if (block.type === 'text' && block.text) {
      txt = block.text.replace(/```json|```/g, '').trim();
      break;
    }
  }

  const parsed = JSON.parse(txt);
  fs.writeFileSync('data.json', JSON.stringify(parsed, null, 2));
  console.log('data.json actualizado correctamente:', parsed.actualizado);
}

getResults().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
