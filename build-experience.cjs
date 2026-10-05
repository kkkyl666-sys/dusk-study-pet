const fs = require('node:fs');
const path = require('node:path');

function buildExperience() {
  const entry = path.join(__dirname, 'index.html');
  const source = fs.readFileSync(path.join(__dirname, 'experience.js'), 'utf8');
  if (/<\/script/i.test(source)) throw new Error('Runtime source contains an HTML script terminator');
  const html = fs.readFileSync(entry, 'utf8');
  const marker = /<script src="experience\.js\?v=\d+"><\/script>|<script id="experience-runtime"[^>]*>[\s\S]*?<\/script>/g;
  if ((html.match(marker) || []).length !== 1) throw new Error('Missing or duplicate recovery runtime marker');
  // Startup must not depend on a second network/cache response for its core functions.
  const runtime = '<script id="experience-runtime" data-runtime="26">\n' +
    '// Generated from experience.js by build-experience.cjs.\n' + source.trimEnd() + '\n  </script>';
  const next = html.replace(marker, () => runtime);
  if (next !== html) fs.writeFileSync(entry, next);
}

module.exports = buildExperience;
if (require.main === module) buildExperience();
