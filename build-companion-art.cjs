// Delivery copies only; user originals are never modified.
const fs=require('node:fs'),path=require('node:path');
const sharp=require('../方案预览/.tools/node_modules/sharp');
const source='C:/Users/ASUS/Desktop/夕宝';
(async()=>{
 const manifest={anger:[],praise:[],wallpapers:[]};
 fs.mkdirSync('assets/companion',{recursive:true});
 for(const [folder,key] of [['怒','anger'],['夸夸','praise']]){
  const files=fs.readdirSync(path.join(source,folder)).filter(n=>/\.(jpg|png|webp)$/i.test(n));
  for(let i=0;i<files.length;i++){
   const name=`assets/companion/${key}-${i+1}.webp`;
   await sharp(path.join(source,folder,files[i])).rotate().resize({width:1000,height:1100,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toFile(name);
   manifest[key].push(name);
  }
 }
 const all=fs.readdirSync(path.join(source,'都可以')).filter(n=>/\.(jpg|png|webp)$/i.test(n));
 const selected=[['desk-study',15,'desktop','窗前案台','50% 50%'],['desk-ink',16,'desktop','山水入画','50% 45%'],['desk-sword',18,'desktop','剑与画境','50% 45%'],['desk-breeze',43,'desktop','长卷清风','50% 40%'],['phone-ink',7,'mobile','墨中山水','50% 12%'],['phone-mist',9,'mobile','雾中画意','50% 20%'],['phone-window',28,'mobile','窗边小憩','50% 15%'],['phone-studio',34,'mobile','画室一角','50% 14%']];
 for(const [id,index,device,label,position] of selected){
  const file=`assets/wallpapers/${id}.webp`,preview=file.replace('.webp','-preview.webp'),input=path.join(source,'都可以',all[index]);
  await sharp(input).rotate().resize({width:device==='desktop'?1920:960,withoutEnlargement:true}).webp({quality:80}).toFile(file);
  await sharp(input).rotate().resize({width:480,withoutEnlargement:true}).webp({quality:65}).toFile(preview);
  manifest.wallpapers.push({id,device,label,position,file,preview});
 }
 fs.writeFileSync('companion-art.json',JSON.stringify(manifest,null,2)+'\n');
 console.log('Generated',manifest.anger.length,'anger,',manifest.praise.length,'praise,',manifest.wallpapers.length,'wallpapers');
})();
