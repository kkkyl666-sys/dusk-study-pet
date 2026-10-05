const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const targets = require('./app-targets.cjs');
const {buildRelease} = require('./build-release.cjs');
const edition = process.argv[2];
const target = targets[edition];
if (!target || !process.argv.includes('--publish')) throw new Error('Usage: node publish-release.cjs personal|share --publish');
const git = (args, options={}) => execFileSync('git',args,{cwd:__dirname,encoding:'utf8',...options}).trim();
if (git(['status','--porcelain']).length) throw new Error('Commit reviewed source changes before publishing');
const sourceCommit = git(['rev-parse','HEAD']);
const files = buildRelease(edition);
const metadata = JSON.parse(files['release.json']);metadata.sourceCommit=sourceCommit;
files['release.json']=Buffer.from(JSON.stringify(metadata,null,2)+'\n');
const remote='https://github.com/'+target.repository+'.git';
const head=git(['ls-remote',remote,'refs/heads/'+target.branch]).split(/\s/)[0];
if (head) git(['fetch','--no-tags',remote,target.branch]);
// A temporary Git index produces an exact allowlisted artifact tree, without a worktree reset.
const dir=path.join(__dirname,'.releases');fs.mkdirSync(dir,{recursive:true});
const index=path.join(dir,edition+'-'+Date.now()+'.index');
const env={...process.env,GIT_INDEX_FILE:index};
const staged=(args,options={})=>git(args,{env,...options});
staged(['read-tree','--empty']);
for (const [file,data] of Object.entries(files)) {
  const blob=git(['hash-object','-w','--stdin'],{input:data});
  staged(['update-index','--add','--cacheinfo','100644',blob,file]);
}
const tree=staged(['write-tree']);
const commit=git(['commit-tree',tree,...(head?['-p',head]:[]),'-m',`Release ${edition} ${target.version}\nSource: ${sourceCommit}`]);
git(['push',remote,commit+':refs/heads/'+target.branch]);
console.log(JSON.stringify({edition,repository:target.repository,branch:target.branch,commit,sourceCommit,url:target.url},null,2));
