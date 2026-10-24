const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const targets=require('../app-targets.cjs');
const source=process.argv[2];
if(!/^[a-f0-9]{40}$/.test(source||''))throw Error('Pass the expected source commit');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function read(url){return execFileSync('curl.exe',['--fail','--silent','--show-error','--location','--max-time','25',url],{maxBuffer:8*1024*1024});}
(async()=>{for(const edition of ['personal','share']){
 const target=targets[edition];let release;
 for(let attempt=0;attempt<20;attempt++){
  try{const candidate=JSON.parse(read(target.url+'release.json?check='+Date.now()));
   if(candidate.sourceCommit===source&&candidate.version===target.version){release=candidate;break;}
  }catch(error){console.log(edition,'waiting:',error.message.split('\n')[0]);}
  await pause(10000);
 }
 assert(release,edition+' did not publish the expected source');
 const files=['index.html','study-shell.js','study-shell.css','word-training.js','development-log.json','sw.js'];
 if(edition==='share')files.push('share-guide.js');
 for(const file of files){const bytes=read(target.url+file+'?check='+Date.now());
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),release.files[file],edition+' '+file);
 }
 console.log('PASS published',edition,release.version,release.sourceCommit,files.length+' file hashes');
}})().catch(error=>{console.error(error);process.exitCode=1;});
