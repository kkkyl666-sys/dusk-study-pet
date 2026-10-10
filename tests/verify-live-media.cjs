// Public static files only: never access personal cloud snapshots.
const crypto=require('node:crypto'),assert=require('node:assert/strict');
const targets=require('../app-targets.cjs');
const {execFileSync}=require('node:child_process');
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
(async()=>{
 for(const edition of ['personal','share']){
  const target=targets[edition];let release;
  for(let i=0;i<40;i++){
   try{const r=await fetch(target.url+'release.json?check='+Date.now());const data=await r.json();if(data.version===target.version&&data.sourceCommit===source){release=data;break;}}catch{}
   await new Promise(r=>setTimeout(r,5000));
  }
  assert(release,'online release not current: '+edition);
  const names=['word-training.js','word-training.css','companion-media.js','companion-art.json','atelier.js','atelier.css',...Object.keys(release.files).filter(n=>n.startsWith('assets/companion/')||/assets\/wallpapers\/(desk|phone)-/.test(n))];
  for(let i=0;i<names.length;i+=5)await Promise.all(names.slice(i,i+5).map(async name=>{
   const r=await fetch(target.url+name+'?check='+Date.now());assert(r.ok,name);
   const hash=crypto.createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex');assert.equal(hash,release.files[name],edition+' '+name);
  }));
  console.log('LIVE VERIFIED',edition,release.version,release.sourceCommit,names.length,'file hashes');
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
