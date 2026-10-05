const fs = require('node:fs');
const path = require('node:path');
const {buildEntry} = require('./build-entry.cjs');
// Share builds never read or modify the personal entry or its release.
fs.writeFileSync(path.join(__dirname, 'share.html'), buildEntry('share'));
