// Depois do `expo export --platform web`, prepara a versão web do app para ser
// "instalada" no iPhone (Safari → Compartilhar → Adicionar à Tela de Início):
// ícones, manifesto e as metatags que o iOS usa para abrir em tela cheia.
// Uso: node web/preparar-pwa.js <pasta-do-export>
const fs = require('fs');
const path = require('path');
const destino = process.argv[2];
if (!destino) { console.error('Informe a pasta do export.'); process.exit(1); }
const BASE = '/app';
for (const f of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
  fs.copyFileSync(path.join(__dirname, f), path.join(destino, f));
}
fs.writeFileSync(path.join(destino, 'manifest.json'), JSON.stringify({
  name: 'Atravessia', short_name: 'Atravessia', lang: 'pt-BR',
  description: 'Acolhimento para quem atravessa o luto.',
  start_url: `${BASE}/`, scope: `${BASE}/`, display: 'standalone', orientation: 'portrait',
  background_color: '#F6F1EE', theme_color: '#45358A',
  icons: [
    { src: `${BASE}/icon-192.png`, sizes: '192x192', type: 'image/png' },
    { src: `${BASE}/icon-512.png`, sizes: '512x512', type: 'image/png' },
  ],
}, null, 2));
const arq = path.join(destino, 'index.html');
let html = fs.readFileSync(arq, 'utf8');
const tags = [
  `<link rel="manifest" href="${BASE}/manifest.json">`,
  `<link rel="apple-touch-icon" href="${BASE}/apple-touch-icon.png">`,
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="Atravessia">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
].join('\n');
if (!html.includes('apple-touch-icon')) html = html.replace('</head>', `${tags}\n</head>`);
// Tela cheia no iPhone, respeitando o entalhe.
html = html.replace('shrink-to-fit=no', 'shrink-to-fit=no, viewport-fit=cover');
fs.writeFileSync(arq, html);
console.log('PWA pronta em', destino);
