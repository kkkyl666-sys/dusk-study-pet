# 夕的手账：共用零件，独立发布

## 产品方向

分享版是面向用户试用、收集反馈、改进体验的主线。自用版保留个人云端记录，作为独立的稳定应用。经过反馈验证的共用改进，可按需发布到自用版；不再改分享一次就被迫更新自用。

未来可以统一为大家使用的分享产品，但本次不自动将个人课程上传到分享版，不新增账号，也不删除旧应用。合并前需决定个人备份导入、同步能力与用户数据边界。

## 文件职责

- `shared/app.html`：共用界面和学习核心的维护源。不要手改生成的 index/share HTML。
- `experience.js`：存档校验、恢复、编辑与启动增强的维护源，构建时内嵌，避免网络缺函数。
- `atelier.js/css`、`cet6-35.js`、`assets/`：共用呈现、词库和素材。
- `app-targets.cjs`：两套身份、独立版本号、发布目标与缓存命名。
- `build-entry.cjs`：依据明确目标从共用模板生成页面，分享不读取自用 HTML 或同步配置。
- `build-release.cjs`：白名单生成完整、互不引用的发布包。
- `shared/worker.js`：worker 共用源码；每套发布生成自己的资源表、缓存前缀和清理范围。
- `demo-config.js`、`demo.js`、`share-tools.js`：分享版的初始化、录入、备份和反馈界面。
- `sync-config.js`：只放入自用包的公开同步客户端配置；不是服务端管理密钥。
- `feedback-admin.*`：只放入自用包的收件箱，管理凭证由操作者输入。

## 两个发布目标

| | 自用 | 分享主线 |
|---|---|---|
| 网址 | https://kkkyl666-sys.github.io/dusk-study-pet/ | https://kkkyl666-sys.github.io/dusk-handbook/ |
| 发布仓库 | dusk-study-pet | dusk-handbook |
| 发布分支 | personal-release | main |
| worker 范围 | /dusk-study-pet/ | /dusk-handbook/ |
| 缓存前缀 | dusk-personal- | dusk-share- |
| 本机学习键 | 保留原键 | 保留 dusk-demo-v1: 原前缀 |
| 个人云端 | 保留 | 不调用 |
| 反馈 | 独立管理页读信 | 用户主动提交 |

源码仍在 dusk-study-pet 的 main 分支。main 推送不会再自动发布自用；指定目标发布才更新线上对应应用。发布包不靠另一套网址下载词库、界面、配置或启动文件。分享反馈失败不影响本机课表与背词；自用云同步失败可继续使用已有有效本机存档。

两套 GitHub Pages 仍为同一 origin。存档前缀、worker 路径及发布已隔离，但不是跨域安全隔离；同源代码仍能访问同源存储。跨域隔离和国内托管需要另外建立域名并迁移备份，不能把本次拆分当作国内无 VPN 问题已解决。

## 独立更新

```text
node build-release.cjs share
node tests/verify-independent-apps.cjs
node tests/verify-share-f2.cjs
git commit ...
node publish-release.cjs share --publish
```

只更新分享不会变更 personal-release。发布自用时使用 personal 目标，并先跑同步与正式功能回归。publish-release 以白名单生成精确 Git 树、正常追加发布提交，不强推、不重置源目录。Pages 构建成功和线上 release.json 核对仍是发布验收的必要步骤，推送成功不代表手机已经更新。

旧 `/dusk-study-pet/share.html` 保留迁移页面，可导出旧分享 JSON 备份。原键不清空。同浏览器同 origin 可继续读取旧分享记录，但主屏 App 与浏览器未必共享存储；若没有显示，使用备份恢复，不以清数据解决。

## 手机画室与背词呈现

两端复用 `atelier.js/css` 与 `word-training.js/css`，分别构建发布，不复制预览里的示例数据或 iframe。手机采用 B 整屏壁纸和不透明阅读面，C 完整画卷通过已有 quick-dialog 生命周期打开；沿用原背景选择、自选媒体 IndexedDB 和缓存，不新增学习数据结构。画卷立即复用当前预览、再升级完整图，关闭后取消迟到更新。

答后只渲染正确项和选中的错误项，保留原选项字母但正确项排前，不使用隐藏占位。电脑正确项作为继续入口；手机正确项只读，固定底部按钮推进；回看仍只读。场景图使用可用矩形与 `contain`，台词单独占位；原评分、抽卡、复习和存档逻辑不变。`verify-mobile-studio.cjs` 验证 B/C、三种手机视口、自选恢复与继续入口，`verify-companion-media.cjs` 覆盖随机场景及紧凑对照。

## 验收边界

独立应用专项使用合成记录验证两套故障、两套升级、缓存清理范围、旧分享存档、备份入口、词汇完成及离线重开。反馈专项使用模拟请求和本地 PostgreSQL 函数，不写真实个人云端。用户安卓无 VPN 的真实网络测试、国内入口和未来多用户云同步均未由这些测试证明。
