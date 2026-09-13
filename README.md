# 星塔旅人配队一览（Stella Sora Team Builder）

纯静态前端站点 — **旅人图鉴 · 秘纹图鉴 · 配队方案 · 预设码一键导入**

- 线上地址：https://stellasora-team-cn.pages.dev
- 代码仓库：https://github.com/yizhishan-zzz/stellasora-team-cn
- 托管：Cloudflare Pages（免费、无需备案、推送即自动发布）

---

## 快速上手（日常三件事）

| 想做什么 | 怎么做 |
|---|---|
| 本地看效果 / 改配队 | 双击 tools\启动服务器.bat → 打开 http://localhost:8080 |
| 把本机改动同步到线上 | 双击 tools\推送到GitHub.bat → 等 1 分钟 |
| 在线上（手机 / 别的电脑）改配队 | 登录管理员后直接改，自动提交，约 1 分钟后生效 |

> 线上改完，本机要拿最新数据：打开本机站点 → 右上角「从仓库同步」。
> 数据感觉不对劲：双击 tools\检查数据.bat 体检。

---

## 目录结构

```
stella_sora_network/
├── 7 个 html 页面          index / characters / character / patterns / pattern / teams / team
├── favicon.ico            站点图标（浏览器标签页）
├── CNAME                  GitHub Pages 的自定义域名文件（用 Cloudflare 时无作用，留着不碍事）
│
├── assets/                站点资源（约 40 MB）
│   ├── css/style.css      全站样式
│   ├── js/                6 个脚本
│   │   ├── auth.js          管理员鉴权（PBKDF2-SHA256）
│   │   ├── data.js          数据加载器 + 元素/职业/音符常量
│   │   ├── teams-store.js   配队数据读写（本机写文件 / 线上写仓库）
│   │   ├── github-store.js  通过 GitHub 接口提交数据（线上编辑用）
│   │   ├── components.js    公共组件（导航 / 卡片 / 星级 / 图标）
│   │   └── main.js          路由 + 各页面渲染
│   ├── data/              只有这 5 个文件，缺一个整站报错
│   │   ├── characters.json    39 名旅人（含 1131 个潜能 + 高清图标 + 稀有度）
│   │   ├── patterns.json      100 个秘纹（效果 / 参数 / 音符 / 立绘）
│   │   ├── potential-cfg.json 预设码解包字典
│   │   ├── preset-teams.json  配队数据（推荐 + 自建）
│   │   └── auth.json          管理员密码哈希（可公开）
│   ├── img/
│   │   ├── hd/head/       39 张旅人头像（304x404）
│   │   ├── hd/outfit/     100 张秘纹立绘（512x512）
│   │   ├── hd/potential/  423 张潜能图标（364x364，带透明通道）
│   │   ├── hd/discskill/  69 张秘纹效果图（156x156）
│   │   ├── hd/buff/       32 张秘纹 buff 图
│   │   ├── logo.ico       站点图标（导航栏用）
│   │   └── ui/            属性 / 星级 / 音符图标（24 个）
│   └── fonts/             MiSans + MiSansLatin（已子集化，共约 1.1 MB）
│
├── tools/                 工具脚本（不参与运行，只在本机用）
│   ├── 启动服务器.bat       启动本地服务器（8080）
│   ├── 推送到GitHub.bat     推送到仓库（自动检查数据 + 强制覆盖线上）
│   ├── 检查数据.bat         体检：JSON 能否解析、有无合并冲突残留
│   ├── 更新数据.bat         4 步更新游戏数据与高清图
│   ├── serve.js             零依赖静态服务器 + 配队保存接口
│   ├── fetch-data.ps1       下载 ss-data
│   ├── build-data.js        把 ss-data 转成 assets/data/*.json
│   ├── download-icons.js    下载高清潜能 / 秘纹 / buff 图
│   ├── subset-fonts.js      字体子集化（数据大改后可重跑）
│   ├── check-data.js        数据检查的实现
│   ├── check-images.html    图片自检页（用 localhost:8080 打开）
│   └── 更新部署包.bat        打包 dist/（可选）
│
├── logo/                  图标原件（留档，不参与运行）
├── admin/password.txt     管理员密码明文备忘（★ 永远不会上传）
└── 过往资源/               归档：开发文档（★ 不会上传）
```

---

## 配队数据怎么存

**唯一数据源：assets/data/preset-teams.json**（推荐配队 + 自建配队都在里面，用 isRecommended 区分）。

| 你在哪编辑 | 数据去哪 |
|---|---|
| 本机 localhost:8080 | PUT /api/teams → 服务器直接写回 JSON，每次写入自动备份到 assets/data/_backup/（留最近 20 份） |
| 线上站点（填过仓库令牌） | 通过 GitHub 接口提交到仓库 → Cloudflare Pages 约 1 分钟自动重新发布 |
| 线上站点（没填令牌） | 退回浏览器暂存，右上角显示黄色「本地暂存」，可点「导入本地暂存」并进文件 |

写入是**乐观更新**：点完立刻生效（毫秒级），提交在后台进行，右上角显示「正在同步 N 项…」。

**三道去重保险**：写入前按 id 去重、加载时自愈清理、旧数据导入只合并不新增。

---

## 数据更新

双击 tools\更新数据.bat（需要联网），共 4 步：

| 步骤 | 做什么 |
|---|---|
| 1/4 | 从 github.com/AutumnVN/ss-data 拉取旅人 / 秘纹 / 潜能数据 |
| 2/4 | 重建 assets/data/*.json（含高清图路径映射） |
| 3/4 | 从 github.com/AutumnVN/ssassets 下载高清图标（增量，已存在的跳过） |
| 4/4 | 下载高清立绘与头像 |

只补高清图标：`node --use-system-ca tools/download-icons.js`

更新完建议再跑一次字体子集化（出现新汉字时）：`node tools/subset-fonts.js`

---

## 线上编辑（管理员）

1. 打开线上站点 → 右上角「管理员登录」→ 输入密码
2. 点「仓库设置」，填：仓库用户 `yizhishan-zzz`、仓库名 `stellasora-team-cn`、分支 `main`、访问令牌
   - 令牌用 **fine-grained token**，只勾这一个仓库的 **Contents: Read and write**
   - 令牌只存在你自己的浏览器里，不会发给任何第三方
3. 之后编辑配队 → 自动提交到仓库 → 约 1 分钟后线上更新

> 换电脑 / 换浏览器要重新填一次令牌。
> 本机想拿线上最新数据：点「从仓库同步」。

---

## 功能

### 图鉴
- 旅人：按属性 / 星级 / 职业筛选，按 id 降序
- 秘纹：按音符 / 品质 / 属性 / 功能筛选
- 属性、星级、音符全部用图标

### 配队方案
- 新建 / 编辑 / 删除（管理员），改动直接写进 JSON
- 3 名上场旅人（前排 / 后排可选潜能范围不同）
- 潜能：核心潜能限选 2 个（固定 1 级），其余 1-6 级，图标带稀有度底色与角标
- 3 主位 + 3 辅位秘纹，各有 5 个备选；**四个组之间互斥**（同一本秘纹不能重复放）
- 备选秘纹可单个删除（槽位右上角 ✕）
- 队伍简介（500 字）+ 标签（元素 / 流派 / 强度 / 适用场合）
- 配队列表可按标签筛选；首页概览按属性分块，每块最多 6 个并按强度排序

### 预设码
- 粘贴国服预设码 → 自动填充 3 名旅人与全部潜能等级
- 仅支持国服（外服码会提示未识别到旅人）

---

## 数据来源

| 内容 | 来源 |
|------|------|
| 旅人 / 秘纹 / 潜能 / 预设码格式 | stelladb（含 ss-data） |
| 高清头像 / 立绘 / 潜能图标 / 秘纹效果图 / buff 图 | github.com/AutumnVN/ssassets |
| 3-4 星秘纹国服名、属性 / 星级 / 音符图标 | 星塔旅人 BWIKI |
| 字体 | MiSans / MiSansLatin |

---

## 注意

- **不要上传** `admin/password.txt` 与 `密码备忘-不要上传.txt`（都已在 .gitignore 里）
- 网站是纯静态的，任何人都能看，但**只有管理员能编辑**；线上编辑需要你自己的 GitHub 令牌
- 前端鉴权只防误改，不是安全边界（无后端）
