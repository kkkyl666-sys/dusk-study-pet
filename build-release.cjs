const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const targets = require('./app-targets.cjs');
const {buildEntry} = require('./build-entry.cjs');
const {buildWorker} = require('./build-worker.cjs');
const common = ['atelier.js','atelier.css','cet6-35.js','dusk-pet.png','lucide.min.js','lucide-LICENSE.txt',
  'development.html','development-log.json','development.js','development.css','DEVELOPMENT.md','ASSETS.md'];
const extra = {
  personal:['sync-config.js','feedback-admin.html','feedback-admin.css','feedback-admin.js','feedback-config.js','feedback.js'],
  share:['demo.js','demo.css','share-tools.js','share-tools.css','papaparse.min.js','papaparse-LICENSE.txt','feedback-config.js','feedback.js','SHARE.md'],
};
function buildRelease(edition, output) {
  const target = targets[edition];
  if (!target) throw new Error('Choose personal or share');
  const files = {};
  for (const file of common.concat(extra[edition])) files[file] = fs.readFileSync(path.join(__dirname,file));
  function assets(dir) {
    for (const entry of fs.readdirSync(path.join(__dirname,dir),{withFileTypes:true})) {
      const name=dir+'/'+entry.name;
      if (entry.isDirectory()) assets(name);
      else if (entry.isFile()) files[name]=fs.readFileSync(path.join(__dirname,name));
    }
  }
  assets('assets');
  const html=buildEntry(edition);
  files['index.html']=Buffer.from(html);
  files['share.html']=Buffer.from(edition === 'share' ? html : fs.readFileSync(path.join(__dirname,'legacy-share.html'),'utf8'));
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,edition === 'share' ? 'manifest-demo.webmanifest' : 'manifest.webmanifest'),'utf8'));
  // Personal installation identity stays unchanged; the new share app has its own scope.
  if (edition === 'share') {manifest.id='./';manifest.start_url='./';}
  files[edition === 'share' ? 'manifest-demo.webmanifest' : 'manifest.webmanifest']=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
  files['.nojekyll']=Buffer.alloc(0);
  files['sw.js']=Buffer.from(buildWorker(target,files));
  const digest=Object.fromEntries(Object.entries(files).map(([file,data])=>[file,crypto.createHash('sha256').update(data).digest('hex')]));
  files['release.json']=Buffer.from(JSON.stringify({edition,version:target.version,repository:target.repository,files:digest},null,2)+'\n');
  if (output) for (const [file,data] of Object.entries(files)) {
    const dest=path.join(output,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);
  }
  return files;
}
module.exports = {buildRelease};
if (require.main === module) {
  const edition=process.argv[2];
  const out=path.join(__dirname,'.releases',edition || 'invalid');
  const files=buildRelease(edition,out);
  console.log(`Built ${edition}: ${Object.keys(files).length} files in ${out}`);
}
