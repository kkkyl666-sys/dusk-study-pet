const fs = require('node:fs');
const path = require('node:path');
const {buildEntry} = require('./build-entry.cjs');

function buildExperience() {
  fs.writeFileSync(path.join(__dirname, 'index.html'), buildEntry('personal'));
  fs.writeFileSync(path.join(__dirname, 'sw.js'), require('./build-release.cjs').buildRelease('personal')['sw.js']);
}

module.exports = buildExperience;
if (require.main === module) buildExperience();
