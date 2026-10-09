const fs = require('node:fs');
const path = require('node:path');
const targets = require('./app-targets.cjs');
const root = __dirname;
const templateFile = path.join(root, 'shared', 'app.html');

function initializeTemplate() {
  if (fs.existsSync(templateFile)) throw new Error('Shared template already exists');
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const replacements = [
    ['<title>夕的手账</title>', '<title>{{TITLE}}</title>'],
    ['content="夕的手账">', 'content="{{SHORT_NAME}}">'],
    ['<h1>夕的手账</h1>', '<h1>{{TITLE}}</h1>'],
    ['href="manifest.webmanifest"', 'href="{{MANIFEST}}"'],
    ['<script src="sync-config.js"></script>', '{{BOOTSTRAP}}'],
    ['版本 2026.10.05.2 · 自用版', '版本 {{VERSION}} · {{LABEL}}'],
    ['</head>', '{{EDITION_STYLES}}\n</head>'],
    ['</body>', '{{EDITION_SCRIPTS}}\n</body>'],
  ];
  for (const [from, to] of replacements) {
    if (html.split(from).length !== 2) throw new Error('Ambiguous template marker: ' + from);
    html = html.replace(from, to);
  }
  html = html.replace(/<script id="experience-runtime"[^>]*>[\s\S]*?<\/script>/, '{{RECOVERY_RUNTIME}}');
  fs.mkdirSync(path.dirname(templateFile), {recursive:true});
  fs.writeFileSync(templateFile, html);
}

function buildEntry(edition) {
  const target = targets[edition];
  if (!target) throw new Error('Unknown edition');
  const source = fs.readFileSync(path.join(root, 'experience.js'), 'utf8');
  const demo = edition === 'share' ? fs.readFileSync(path.join(root, 'demo-config.js'), 'utf8') : '';
  if (/<\/script/i.test(source + demo)) throw new Error('Invalid embedded script');
  const identity = `<script id="app-target">window.PET_APP=${JSON.stringify({edition,version:target.version,shareURL:target.shareURL})};</script>`;
  const values = {
    TITLE:target.title, SHORT_NAME:target.shortName, VERSION:target.version, LABEL:target.label,
    MANIFEST:edition === 'share' ? 'manifest-demo.webmanifest' : 'manifest.webmanifest',
    BOOTSTRAP:identity + (edition === 'share' ? '\n<script id="share-bootstrap">\n'+demo.trimEnd()+'\n</script>' : '\n<script src="sync-config.js"></script>'),
    RECOVERY_RUNTIME:'<script id="experience-runtime" data-runtime="26">\n// Generated from experience.js.\n'+source.trimEnd()+'\n</script>',
    EDITION_STYLES:edition === 'share' ? '<link rel="stylesheet" href="demo.css?v=26">\n<link rel="stylesheet" href="share-tools.css?v=1">' : '',
    EDITION_SCRIPTS:edition === 'share' ? '<script src="demo.js?v=29"></script>\n<script src="papaparse.min.js"></script>\n<script src="feedback-config.js?v=1"></script>\n<script src="feedback.js?v=2"></script>\n<script src="share-tools.js?v=3"></script>' : '',
  };
  const html = fs.readFileSync(templateFile, 'utf8').replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error('Unknown template field: '+key);
    return values[key];
  });
  if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unresolved template field');
  if (edition === 'share' && html.includes('sync-config.js')) throw new Error('Personal configuration leaked');
  const before = html.slice(0, html.indexOf('<script id="experience-runtime"'));
  if (/<script src="lucide\.min\.js"(?![^>]*\bdefer\b)/.test(before)) throw new Error('Icons block recovery');
  return html;
}
module.exports = {buildEntry, initializeTemplate};
if (require.main === module) {
  if (process.argv.includes('--initialize-template')) initializeTemplate();
  else for (const edition of process.argv.slice(2)) {
    const target = targets[edition];
    if (!target) throw new Error('Specify personal or share');
    fs.writeFileSync(path.join(root, target.entry), buildEntry(edition));
  }
}
