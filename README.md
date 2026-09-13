# 星塔旅人配队一览（Stella Sora Team Builder）

纯静态前端站点 — **旅人图鉴 · 秘纹图鉴 · 配队方案 · 预设码一键导入**

---

## 目录结构

```
stella_sora_network/
├── index.html            首页（配队统计 + 配队概览（按属性分块）+ 旅人速览）
├── characters.html       旅人图鉴
├── character.html        旅人详情（潜能按流派分组）
├── patterns.html         秘纹图鉴
├── pattern.html          秘纹详情（Melody / Harmony）
├── teams.html            配队方案列表
├── team.html             配队详情 / 编辑（管理员）
│
├── assets/               站点资源（约 58 MB）
│   ├── css/style.css     全站样式（浅色主题，主色 #4b5082）
│   ├── js/
│   │   ├── auth.js        管理员鉴权（PBKDF2-SHA256，前端只存哈希）
│   │   ├── data.js        数据加载器 + 元素/职业/音符常量
│   │   ├── teams-store.js 配队本地存储 + 推荐配队覆盖层
│   │   ├── components.js  公共组件（导航/卡片/星级/图标）
│   │   └── main.js        路由 + 各页面渲染
│   ├── data/             只加载这 5 个文件
│   │   ├── characters.json    39 名旅人（含潜能 + 高清图标 + 稀有度）
│   │   ├── patterns.json      100 个秘纹（含效果/param/音符/立绘）
│   │   ├── potential-cfg.json 预设码解包配置（潜能 ID → 中文名）
│   │   ├── preset-teams.json  23 个推荐配队（只读）
│   │   └── auth.json          管理员密码哈希
│   ├── img/
│   │   ├── hd/head/       39 张高清旅人头像（304x404）
│   │   ├── hd/outfit/     100 张高清秘纹立绘（512x512）
│   │   ├── hd/potential/  423 张高清潜能图标（364x364）
│   │   ├── hd/discskill/  69 张高清秘纹效果图（156x156）
│   │   ├── hd/buff/       32 张高清秘纹 buff 图
│   │   └── ui/            属性/星级/音符图标（24 个）
│   └── fonts/            MiSans + MiSansLatin（4 字重，约 19 MB）
│
├── tools/                工具脚本
│   ├── 启动本地服务器.bat   双击启动 http://localhost:8080
│   ├── serve.js           零依赖静态服务器（已禁用缓存，改完刷新即生效）
│   ├── 更新数据.bat         一键 4 步更新数据与高清图
│   ├── fetch-data.ps1     下载 ss-data 的 6 个数据文件
│   ├── build-data.js      把 ss-data 转成 assets/data/*.json（含高清图路径映射）
│   ├── download-icons.js  下载高清潜能/秘纹效果/秘纹 buff 图
│   ├── download-hd.bat    重新下载高清立绘/头像
│   ├── download-hd.ps1
│   ├── check-images.html  图片资源自检页（用 localhost:8080 打开）
│   └── 更新部署包.bat       同步最新代码到 dist/（可选，正式用域名时用得到）
│
├── admin/password.txt    管理员密码明文（★ 不要上传到公网）
├── 过往资源/              已归档：旧版素材、弃用数据、开发临时文件
└── 过往文件/              历史资料（原始网页抓取、stelladb 源码、字体原件等）
```

> `过往资源/整理清单.md` 记录了归档了什么、为什么、怎么还原。

---

## 本地运行

**双击 `tools/启动服务器.bat`** → 自动打开 http://localhost:8080

> 必须通过服务器访问（`file://` 协议无法 fetch JSON 数据）
> 本机的服务器除了发静态文件，还负责**把配队改动写回 JSON 文件**（见下一节）

---

## 配队数据怎么存

**唯一数据源：`assets/data/preset-teams.json`**（推荐配队 + 自己建的配队都在里面，用 `isRecommended` 区分）。
页面上不再有"仅本浏览器可见"的覆盖层，改动一律写回这个文件。保存方式按环境自动选：

| 环境 | 保存方式 |
|---|---|
| 本机 8080（`tools/serve.js` 在跑） | `PUT /api/teams` → 服务器直接写回 JSON，**每次写入前自动备份**到 `assets/data/_backup/`（最多留 20 份） |
| 线上（GitHub Pages）+ 填过仓库令牌 | 通过 GitHub 接口把 JSON 提交回仓库，Pages 自动重新发布（约 1 分钟） |
| 都没有 | 退回浏览器暂存，页面右上角会显示"本地暂存"，可点「导入本地暂存」并进文件 |

页面右上角会显示当前模式（绿色=已接数据源 / 黄色=仅本地）。**照常编辑即可，改完立刻落盘。**

### 线上部署（GitHub Pages）

1. 建一个 GitHub 仓库，把项目推上去（**不要推 `admin/password.txt`**）
2. 仓库 Settings → Pages → Source 选 `Deploy from a branch`，分支选 `main`、目录 `/ (root)`
3. 打开线上站点 → 右上角「管理员登录」→ 再点「仓库设置」，填仓库用户/仓库名/分支 + 令牌
   - 令牌用 **fine-grained token**，只勾这一个仓库的 **Contents: Read and write**
   - 令牌只存在你自己的浏览器里，不会发给任何第三方
4. 之后在线上编辑配队 → 自动提交到仓库 → Pages 约 1 分钟后更新

> 没填令牌时线上站点是只读的（访客本来也只能看）。

---

## 更新数据

双击 `tools/更新数据.bat`（需要联网），共 4 步：

| 步骤 | 做什么 |
|---|---|
| 1/4 | 从 `github.com/AutumnVN/ss-data` 拉取旅人/秘纹/潜能数据 |
| 2/4 | 重建 `assets/data/*.json`（含高清图路径映射） |
| 3/4 | 从 `github.com/AutumnVN/ssassets` 下载高清图标（增量，已存在会跳过） |
| 4/4 | 下载高清立绘/头像（39 头像 + 100 立绘） |

只补高清图标可以单独跑：`node --use-system-ca tools/download-icons.js`

---

## 功能

### 旅人图鉴 / 秘纹图鉴
- 按属性 / 星级（秘纹另有音符、功能）筛选，按 id 降序排列
- 属性、星级、音符全部使用图标

### 配队方案
- 新建 / 编辑 / 删除配队（管理员），**改动直接写进 assets/data/preset-teams.json**
- 推荐配队同样可编辑，保存即生效；服务器每次写入会自动备份
- 3 名上场旅人（前排 / 后排位置不同，潜能可选范围不同）
- 潜能编配：核心潜能限选 2 个（固定 1 级），其余可选 1-6 级
- 潜能图标带稀有度底色（核心粉 / 彩紫 / 金金）+ 角标，和游戏内一致
- 3 个主位秘纹 + 3 个辅位秘纹 + 各自的 5 个备选秘纹
- 队伍简介（500 字以内）+ 队伍标签（元素 / 流派 / 强度）
- 首页配队概览按属性分块，每块最多展示 6 个并按强度（T0 → T0.5 → …）排序
- 数据存 localStorage

### 预设码一键导入
- 粘贴国服预设码 → 自动填充 3 名旅人 + 全部潜能及等级
- 解析逻辑移植自 stelladb 的 `unpackPotentialData`
- ⚠️ 仅支持国服预设码（外服码会提示未识别）

---

## 数据来源

| 内容 | 来源 |
|------|------|
| 旅人 / 秘纹 / 潜能 / 预设码格式 | stelladb（含 ss-data） |
| 高清头像 / 立绘 / 潜能图标 / 秘纹效果图 / buff 图 | github.com/AutumnVN/ssassets |
| 3-4 星秘纹国服名、属性/星级/音符图标 | 星塔旅人 BWIKI |
| 字体 | MiSans / MiSansLatin |

---

## 上线（未来买域名后）

站点是纯静态的，把项目根目录（或跑一次 `tools/更新部署包.bat` 得到的 `dist/`）整个扔到任意静态托管即可。

- **不要上传** `admin/password.txt`（密码明文）
- 用户配队存在 localStorage，按域名隔离 —— 换域名后需要重新创建/导入
- 前端鉴权只防误改，不是安全边界（无后端）
