const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function buildWorker(target, files) {
  const source=fs.readFileSync(path.join(__dirname,'shared','worker.js'),'utf8');
  const required = ['./index.html','./cet6-35.js','./atelier.js?v=32','./atelier.css?v=25','./word-training.js?v=2','./word-training.css?v=2'];
  if (target.label === '自用版') required.push('./sync-config.js');
  else required.push('./share.html','./demo.js?v=29','./demo.css?v=26','./share-tools.js?v=3','./share-tools.css?v=1','./papaparse.min.js');
  const query = {'feedback-admin.css':1,'feedback-admin.js':1,'feedback-config.js':1,'feedback.js':2,'development.js':25,'development.css':25};
  const optional = Object.keys(files).filter(file => !['sw.js','release.json','.nojekyll'].includes(file))
    .map(file => './'+file+(query[file] ? '?v='+query[file] : ''))
    .filter(entry => !required.some(req => req.split('?')[0] === entry.split('?')[0]));
  const hash = crypto.createHash('sha256');
  hash.update(source);
  for (const file of Object.keys(files).sort()) hash.update(file).update(files[file]);
  const assets=Object.fromEntries(Object.entries(files).filter(([name])=>/\.(webp|png|woff2)$/.test(name))
    .map(([name,bytes])=>['./'+name,crypto.createHash('sha256').update(bytes).digest('hex')]));
  optional.sort((a,b)=>Number(/\/fonts\//.test(a))-Number(/\/fonts\//.test(b)));
  const config = {cachePrefix:target.cachePrefix,legacyCachePrefix:target.legacyCachePrefix || '',required,optional,assets,
    entries:['','index.html','share.html','development.html',...(target.label === '自用版' ? ['feedback-admin.html'] : [])]};
  return source
    .replace('/*APP_WORKER_CONFIG*/', JSON.stringify(config))
    .replace('/*APP_CACHE_NAME*/', JSON.stringify(target.cachePrefix+target.version+'-'+hash.digest('hex').slice(0,12)));
}
module.exports = {buildWorker};
