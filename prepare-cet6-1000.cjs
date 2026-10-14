const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=__dirname,data=path.resolve(root,'../数据');
function canonical(s){return s.toLowerCase().trim().replace(/[\s-]+/g,'');}
function sentenceOK(s,word){return /^[A-Z]/.test(s)&&/[.!?]$/.test(s)&&!/[\r\n]|\.\.\.|…|\[|\]/.test(s)&&s.split(/\s+/).length>=6&&s.split(/\s+/).length<=24&&new RegExp('\\b'+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(s)&&!(/\ba (?:outdated|exotic|important|excellent|ordinary)\b/i.test(s));}
(async()=>{
  const legacyFile=path.join(data,'cet6-legacy-350.json');let legacy;
  if(fs.existsSync(legacyFile))legacy=JSON.parse(fs.readFileSync(legacyFile,'utf8'));else{const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'cet6-35.js'),'utf8'),context);legacy=context.window.CET6_35;fs.writeFileSync(legacyFile,JSON.stringify(legacy,null,2)+'\n');}
  const repo='KyleBing/english-vocabulary';const meta={sha:'c4c6c80879ff17d7025c28fb853a4991c8e6be6a'};
  const url='https://raw.githubusercontent.com/'+repo+'/'+meta.sha+'/'+encodeURI('full_line_jsonl/sentence/正序/六级.jsonl');const response=await fetch(url);assert(response.ok);const raw=await response.text();const rows=raw.trim().split(/\r?\n/).map(JSON.parse),byWord=new Map(rows.map(w=>[canonical(w.word),w]));
  const uk=JSON.parse(fs.readFileSync(path.join(data,'英语英式IPA本地词典-ipa-dict-en_UK.json'),'utf8'));
  const license=await fetch('https://raw.githubusercontent.com/'+repo+'/'+meta.sha+'/LICENSE').then(r=>r.text());assert(license.includes('BSD 3-Clause'));
  function make(row,old,day){
    const candidates=(row?.sentences||[]).filter(s=>sentenceOK(s.sentence,row.word));
    const example=candidates[0]||null;
    const word=old?.word||row.word,translations=(row?.translations||[]).filter(t=>['n','v','adj','adv'].includes(t.type));
    const sense=translations.find(t=>old&&old.pos===t.type+'.')||translations[0];
    const pos=!example&&old?old.pos:sense?sense.type+'.':old.pos;
    const meaning=!example&&old?old.meaning:translations.filter(t=>t.type+'.'===pos).map(t=>t.translation).join('；')||old.meaning;
    const ipa=(row?.uk||uk[canonical(word)]?.[0]||old?.phonetic||'').replace(/^\/+|\/+$/g,'').replace(/'/g,'ˈ').replace(/[\u200b-\u200d\ufeff]/g,'');
    const text=(example?.sentence||old?.example||'').replace(/\s*\(=[^)]*\)/g,'').replace(/\s+([,.!?;:])/g,'$1').replace(/[ \t]+/g,' ').trim();
    return {word,id:day+'-'+word,pos,meaning:meaning.trim().split(/[；;]+/).slice(0,3).join('；'),fullMeaning:meaning.trim(),phonetic:'/'+ipa+'/',example:text,exampleTranslation:example?.translation||'',audio:'https://dict.youdao.com/dictvoice?audio='+encodeURIComponent(word)+'&type=1',dictionary:'https://youdao.com/result?lang=en&word='+encodeURIComponent(word),source:row?'third-party-cet6':'legacy',sourceCommit:row?meta.sha:'',exampleSource:example?'third-party-cet6':'original'};
  }
  const selected=[],seen=new Set(),sentences=new Set();
  for(let day=0;day<legacy.length;day++)for(const old of legacy[day].words){const w=make(byWord.get(canonical(old.word)),old,day);assert(!seen.has(canonical(w.word)));seen.add(canonical(w.word));sentences.add(w.example);selected.push(w);}
  const candidates=rows.filter(row=>!seen.has(canonical(row.word))&&/^[a-z][a-z-]+$/.test(row.word)&&row.uk&&row.translations.some(t=>['n','v','adj','adv'].includes(t.type))&&row.sentences.some(s=>sentenceOK(s.sentence,row.word)));
  // Sample the whole alphabet deterministically, not just the first few letters.
  const ordered=Array.from({length:650},(_,i)=>candidates[Math.floor(i*candidates.length/650)]).concat(candidates);
  for(const row of ordered){if(selected.length>=1000)break;if(seen.has(canonical(row.word)))continue;
    const w=make(row,null,Math.floor(selected.length/10));if(!w.example||sentences.has(w.example)||!w.meaning||w.meaning.length>300)continue;
    seen.add(canonical(w.word));sentences.add(w.example);selected.push(w);
  }
  assert.equal(selected.length,1000);assert.equal(seen.size,1000);assert(selected.every(w=>w.example&&w.phonetic.length>3&&w.audio));
  // Corrections to known legacy sense/example mismatches keep word IDs unchanged.
  const fixes={proximately:{example:'The term refers to causes that act proximately rather than remotely.',meaning:'直接地；近因地'},lobby:{pos:'v.',meaning:'游说',example:'The campaigners lobby Parliament for stronger environmental protection.'},dismiss:{meaning:'解雇；不予考虑',example:'The committee dismissed the proposal because it lacked evidence.'},possession:{meaning:'拥有；所有物',example:'Her most valuable possession was a notebook from her grandfather.'},compact:{pos:'adj.',meaning:'紧凑的；小巧的',example:'The compact device fits easily into a jacket pocket.'},positively:{pos:'adv.',meaning:'明确地；确实；积极地',example:'Regular exercise can positively affect your concentration and mood.'}};
  for(const w of selected)if(fixes[w.word])Object.assign(w,fixes[w.word],{exampleTranslation:'',exampleSource:'original'});
  const lessons=Array.from({length:100},(_,i)=>({title:legacy[i]?.title?.trim()&&!/·\s*$/.test(legacy[i].title)?legacy[i].title.trim():i<35?'六级核心 · 巩固与拓展':'六级扩展 · 第'+(i+1)+'组',scene:'六级备考辅助词汇；复习不占新词额度。',words:selected.slice(i*10,i*10+10)}));
  fs.writeFileSync(path.join(root,'cet6-35.js'),'window.CET6_35 = '+JSON.stringify(lessons)+';\n');
  fs.writeFileSync(path.join(data,'夕式桌宠-1000词六级词库.json'),JSON.stringify({schema:1,total:1000,defaultDaily:10,lessons},null,2)+'\n');
  fs.mkdirSync(path.join(root,'assets/licenses'),{recursive:true});fs.writeFileSync(path.join(root,'assets/licenses/CET6-BSD-3-Clause.txt'),license);
  const audit={generatedAt:new Date().toISOString(),source:url,commit:meta.sha,rawSha256:crypto.createHash('sha256').update(raw).digest('hex'),count:1000,unique:1000,legacyRetained:350,sourceUnmatchedLegacy:selected.filter(w=>w.source==='legacy').map(w=>w.word),originalExamples:selected.filter(w=>w.exampleSource==='original').map(w=>w.word),rules:['no duplicate headwords','UK phonetic present','nonempty example','new examples complete sentences, 6-24 words, contain target word','no shared example sentences among added words'],limits:['Third-party CET6-labelled list, not an official complete exam syllabus','Repository BSD notice retained; upstream dictionary content attribution is documented, not independently certified','Automatic checks and sample review do not equal expert review of all senses','British audio URLs require network; no audio redistribution or permanent availability promise']};
  fs.writeFileSync(path.join(root,'cet6-audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
