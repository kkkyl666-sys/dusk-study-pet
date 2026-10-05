// Compile a separate entry from the same UI; never include private sync config.
const fs = require('node:fs');
const path = require('node:path');
require('./build-experience.cjs')();
let html = fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
function replaceOnce(from,to) {
  if(html.split(from).length!==2)throw new Error(`Share template marker changed: ${from}`);
  html=html.replace(from,to);
}
replaceOnce('<title>夕的手账</title>','<title>夕的手账 · 分享版</title>');
replaceOnce('<meta name="apple-mobile-web-app-title" content="夕的手账">','<meta name="apple-mobile-web-app-title" content="夕的手账分享版">');
replaceOnce('<h1>夕的手账</h1>','<h1>夕的手账 · 分享版</h1>');
replaceOnce('href="manifest.webmanifest"','href="manifest-demo.webmanifest"');
const bootstrap=fs.readFileSync(path.join(__dirname,'demo-config.js'),'utf8');
if (/<\/script/i.test(bootstrap)) throw new Error('Share bootstrap contains an HTML script terminator');
replaceOnce('<script src="sync-config.js"></script>','<script id="share-bootstrap">\n'+bootstrap.trimEnd()+'\n</script>');
replaceOnce('版本 2026.10.05.2 · 自用版','版本 2026.10.05.2 · 分享版');
replaceOnce('</head>','  <link rel="stylesheet" href="demo.css?v=26">\n  <link rel="stylesheet" href="share-tools.css?v=1">\n</head>');
replaceOnce('</body>','  <script src="demo.js?v=28"></script>\n  <script src="papaparse.min.js"></script>\n  <script src="feedback-config.js?v=1"></script>\n  <script src="feedback.js?v=2"></script>\n  <script src="share-tools.js?v=2"></script>\n</body>');
if(html.includes('sync-config.js'))throw new Error('Private config must not appear in share entry');
fs.writeFileSync(path.join(__dirname,'share.html'),html);
