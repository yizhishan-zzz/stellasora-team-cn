<div align="center">

<img src="assets/img/logo.ico" width="96" height="96" alt="logo">

# 星塔旅人配队一览

**旅人图鉴 · 秘纹图鉴 · 配队方案 · 预设码一键导入**

纯静态前端站点 —— 无后端、无数据库、无框架。

[![在线访问](https://img.shields.io/badge/在线访问-stellasora--team--cn.pages.dev-4b5082?style=for-the-badge)](https://stellasora-team-cn.pages.dev)
[![托管](https://img.shields.io/badge/托管-Cloudflare%20Pages-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://stellasora-team-cn.pages.dev)
[![数据来源](https://img.shields.io/badge/数据来源-stelladb-52C878?style=flat-square)](https://github.com/AutumnVN/stelladb)

</div>

---

## 功能

### 旅人图鉴
- 按属性 / 职业 / 星级筛选，按 id 降序排列
- 详情页展示该旅人的全部潜能，按流派自动分组（前排核心 / 前排特有 / 通用 / 后排核心 / 后排特有）
- 潜能图标带稀有度底色与角标（核心粉 · 彩紫 · 金金），与游戏内一致

### 秘纹图鉴
- 按音符 / 品质 / 属性 / 功能筛选
- 详情页展示 Melody 主效果与 Harmony 协奏效果
- 阶数滑条可实时查看每一级的数值与音符需求

### 配队方案
- 3 名上场旅人（前排 / 后排可选潜能范围不同，核心潜能限选 2 个、固定 1 级）
- 3 主位秘纹 + 3 辅位秘纹，各带 5 个备选；**四组之间互斥**，同一本秘纹不会重复出现
- 队伍标签：元素 / 流派 / 强度 / 适用场合（单体 · 群体 · 新手向）
- 列表页可按标签筛选；首页概览按属性分块，每块最多 6 个并按强度排序
- 备选秘纹支持单个删除

### 预设码
- **一键导入**：粘贴国服预设码 → 自动填充 3 名旅人与全部潜能等级
- **一键生成**：配好队伍后直接生成游戏内可用的预设码，并自动复制到剪贴板

> 编码格式与游戏完全一致（用 23 个真实游戏预设码做过往返验证，真机可直接使用）。
> 仅支持国服格式。

---

## 数据

站点运行时只读取 `assets/data/` 下的 5 个 JSON：

| 文件 | 内容 |
|---|---|
| `characters.json` | 全部旅人及其潜能（含图标路径与稀有度） |
| `patterns.json` | 全部秘纹（效果模板、各级数值、音符、立绘） |
| `potential-cfg.json` | 预设码解包字典 |
| `preset-teams.json` | 配队方案 |
| `auth.json` | 管理员登录校验用 |

这些文件由脚本从上游抓取生成，**不需要手工维护**：

```
github.com/AutumnVN/ss-data    -->  build-data.js   -->  characters.json / patterns.json
github.com/AutumnVN/ssassets   -->  download-*.js   -->  assets/img/hd/**
```

运行 `tools/更新数据.bat` 一键完成：抓数据 → 重建 JSON（**会自动识别新增的旅人与秘纹**）→ 下载高清图 → 数据体检。

### 数据来源

站点数据全部来自 **stelladb**（同一作者 AutumnVN 的项目，包含两个仓库，本站两个都用）：

| stelladb 的仓库 | 提供什么 |
|---|---|
| [ss-data](https://github.com/AutumnVN/ss-data) | 旅人与秘纹的全部文本数据：星级 / 属性 / 职业 / 潜能分组 / 效果描述 / 各级数值 / 音符需求 |
| [ssassets](https://github.com/AutumnVN/ssassets) | 全部图片素材：旅人头像、秘纹立绘、潜能图标、秘纹效果图与 buff 图 |

```
stelladb
  |- ss-data    -->  build-data.js   -->  assets/data/*.json
  '- ssassets   -->  download-*.js   -->  assets/img/hd/**
```

其余部分：

- 属性 / 星级 / 音符小图标：stelladb 的素材库里没有对应资源，这部分是早期从社区 wiki 整理的，随项目打包，不由脚本下载
- 字体 MiSans / MiSansLatin，已按站点用字子集化（19 MB 压缩到 1.1 MB）

---

## 技术栈

| 项 | 说明 |
|---|---|
| 前端 | 原生 HTML + CSS + JavaScript，**无框架、无构建工具、无 npm 依赖** |
| 渲染 | 每个页面启动时并行读取 JSON，由 JS 全量渲染；新增旅人 / 秘纹**不需要改代码** |
| 预设码 | 位级编码 / 解码（3x32 位旅人编号 + 核心 1 位 + 普通 3 位 + 通用 3 位），纯前端实现 |
| 数据编辑 | 本机编辑直接写回 JSON 文件（服务器自动备份）；线上编辑通过 GitHub 接口提交到仓库 |
| 首屏体积 | 约 2 MB |

---

## 新增旅人 / 秘纹时

运行 `tools/更新数据.bat` 会自动识别并补齐：

- 新旅人：从 ss-data 读中文名、星级、属性、职业、头像路径，潜能全量导入
- 新秘纹：读名称、星级、属性、效果描述、各级数值、音符需求、立绘与效果图
- 编号自动生成（秘纹接着现有编号往下排；旅人用英文名转 slug）

之后运行 `tools/推送到GitHub.bat` 即可发布。

> 唯一需要人工补的是**新秘纹的协奏效果（Harmony 文本）** —— ss-data 不提供这部分数据。

---

## 本地运行

```bash
node tools/serve.js      # 或双击 tools/启动服务器.bat
# 然后打开 http://localhost:8080
```

> 必须通过服务器访问 —— `file://` 协议下浏览器不允许读取 JSON。

<details>
<summary><b>目录结构</b></summary>

```
stella_sora_network/
├── 7 个 html 页面          index / characters / character / patterns / pattern / teams / team
├── favicon.ico            浏览器标签页图标
├── robots.txt             爬虫规则（含 sitemap 声明）
├── sitemap.xml            站点地图（7 个页面）
├── _headers               Cloudflare Pages 缓存与安全策略
├── README.md              本文件
├── 6f9cd0fd....txt        IndexNow 验证文件（必须在根目录，勿删）
│
├── assets/                站点资源
│   ├── css/style.css      全站样式
│   ├── js/                6 个脚本（auth / data / teams-store / github-store / components / main）
│   ├── data/              5 个 JSON（缺一个整站报错）
│   ├── img/hd/            高清素材（头像 / 立绘 / 潜能图标 / 效果图 / buff）
│   ├── img/ui/            属性 / 星级 / 音符图标
│   └── fonts/             MiSans + MiSansLatin（已子集化，约 1.1 MB）
│
├── tools/                 工具脚本（不参与运行）
│   ├── 一键更新并发布.bat   出新旅人时一键更新+推送
│   ├── 更新数据.bat         只更新数据与图片
│   ├── 推送到GitHub.bat     推送（自动合并云端配队）
│   ├── 启动服务器.bat       本地预览 http://localhost:8080
│   ├── 检查数据.bat         数据体检
│   ├── 压缩图片.bat         图片压缩
│   └── *.js                 各脚本的实现
│
├── 文档/                  密码备忘（不上传）
└── 过往资源/              归档（不上传，可整包移出项目）

</details>

<details>
<summary><b>部署与线上编辑</b></summary>

托管在 **Cloudflare Pages**（免费、无需备案）：推送 `main` 分支后自动重新发布，约 1 分钟生效。

线上编辑配队需先配置一次：登录管理员 → 右上角「仓库设置」→ 填仓库与 GitHub 令牌
（fine-grained token，只需该仓库的 **Contents: Read and write**；令牌只存在自己的浏览器里）。

| 编辑位置 | 数据去向 |
|---|---|
| 本机 localhost:8080 | 直接写回 `assets/data/preset-teams.json`，每次写入自动备份到 `assets/data/_backup/` |
| 线上站点 | 通过 GitHub 接口提交到仓库，Pages 约 1 分钟后更新 |

</details>

---

<div align="center">
<sub>玩家自制的资料整理工具，数据来自公开社区；游戏内容版权归原作者所有。</sub>
</div>
