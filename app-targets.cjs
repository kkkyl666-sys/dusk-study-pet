const common = {shareURL:'https://kkkyl666-sys.github.io/dusk-handbook/'};
module.exports = {
  personal: {...common, version:'2026.10.08.1', title:'夕的手账', shortName:'夕的手账', label:'自用版',
    repository:'kkkyl666-sys/dusk-study-pet', branch:'personal-release',
    url:'https://kkkyl666-sys.github.io/dusk-study-pet/', cachePrefix:'dusk-personal-',
    legacyCachePrefix:'dusk-study-pet-', entry:'index.html'},
  share: {...common, version:'2026.10.08.1', title:'夕的手账 · 分享版', shortName:'夕的手账分享版', label:'分享版',
    repository:'kkkyl666-sys/dusk-handbook', branch:'main',
    url:common.shareURL, cachePrefix:'dusk-share-', entry:'share.html'},
};
