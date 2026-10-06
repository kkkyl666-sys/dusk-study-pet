// Delivery variants only: original artwork and credits stay in the source tree.
const path = require('node:path');
const fs = require('node:fs');
const sharp = require(path.resolve(__dirname, '../方案预览/.tools/node_modules/sharp'));
(async () => {
  await sharp(path.join(__dirname, 'dusk-pet.png')).webp({quality:86, effort:6})
    .toFile(path.join(__dirname, 'assets/dusk-pet.webp'));
  for (const scene of ['studio', 'realm']) {
    const base = path.join(__dirname, 'assets/wallpapers/dusk-'+scene+'-concept');
    await sharp(base+'.png').webp({quality:84, effort:6}).toFile(base+'.webp');
    await sharp(base+'.png').resize({width:720}).webp({quality:72, effort:6}).toFile(base+'-preview.webp');
  }
  for (const file of ['assets/dusk-pet.webp', ...['studio','realm'].flatMap(s =>
    ['.webp','-preview.webp'].map(ext => 'assets/wallpapers/dusk-'+s+'-concept'+ext))]) {
    console.log(file, fs.statSync(path.join(__dirname,file)).size);
  }
})().catch(error => {console.error(error);process.exitCode=1;});
