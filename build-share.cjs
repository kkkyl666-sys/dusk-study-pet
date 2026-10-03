// Compile a separate entry from the same UI; never include private sync config.
const fs = require('node:fs');
const path = require('node:path');
let html = fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
function replaceOnce(from,to) {
  if(html.split(from).length!==2)throw new Error(`Share template marker changed: ${from}`);
  html=html.replace(from,to);
}
replaceOnce('<title>夕的案台画室</title>','<title>夕的案台画室 · 分享演示</title>');
replaceOnce('<h1>光电学习桌宠</h1>','<h1>夕的画室 · 演示</h1>');
replaceOnce('href="manifest.webmanifest"','href="manifest-demo.webmanifest"');
replaceOnce('<script src="sync-config.js"></script>','<script src="demo-config.js?v=24"></script>');
replaceOnce('</head>','  <link rel="stylesheet" href="demo.css?v=24">\n</head>');
replaceOnce('</body>','  <script src="demo.js?v=24"></script>\n</body>');
if(html.includes('sync-config.js'))throw new Error('Private config must not appear in share entry');
fs.writeFileSync(path.join(__dirname,'share.html'),html);
