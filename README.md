# 我的博客

一个**纯静态前端**的个人博客（原生 HTML / CSS / JavaScript，无前端构建）。页面可双击打开、部署到 GitHub Pages；**注册登录 + 全站共享评论 + 审核**由一个可选的轻量后端（`server/`，Node.js，零依赖）提供。

## 功能特性

- ✅ Markdown 写作 + 代码高亮（自研轻量解析器，无需联网）
- ✅ 首屏封面：滚轮下滑一段距离后封面向上滑走进入文章、回顶后上滑封面滑回（封面为独立整屏）
- ✅ 标签 / 分类浏览（点选筛选，再点一次取消）
- ✅ 站内全文搜索（标题、摘要、正文）
- ✅ 深色模式（自动跟随系统 + 手动切换，右侧悬浮球控制，本地记忆）
- ✅ 用户系统（账户登录 + 昵称分离，头像菜单，用户中心页，登录后才能评论）
- ✅ 评论系统（**真实多人共享**，支持回复；**评论/回复需管理员审核后才发布**；用户中心可查看自己的评论与收到的回复）
- ✅ 文章管理（**管理员在用户中心里新建/编辑/删除文章**，正文 Markdown）
- ✅ 可选后端（`server/`，Node.js + SQLite，零依赖，部署到自己的 VPS 即可）
- ✅ RSS 订阅（`rss.xml`）
- ✅ 文章内嵌视频 / 音频
- ✅ 响应式设计，移动端友好
- ✅ 阅读进度条、上一篇/下一篇、阅读时长估算

## 目录结构

```
├── index.html           首页（封面主图 + 文章列表 + 标签分类 + 搜索）
├── article.html         文章详情页
├── announcement.html    公告页（列出全部公告）
├── about.html           关于页
├── user.html            用户中心页
├── test.png             ★ 首页封面主图（首屏背景，可替换）
├── rss.xml              RSS 订阅源（由 build-rss.js 生成）
├── build-rss.js         重新生成 rss.xml 的脚本
├── server/              ★ 后端（部署到自己的 VPS，见 server/README.md）
│   └── server.js        注册登录 + 评论 + 审核（Node.js + SQLite，零依赖）
├── assets/
│   ├── css/style.css    全局样式（含深色模式变量）
│   └── js/
│       ├── config.js    站点配置（名称、作者、网址、apiUrl 等）
│       ├── posts.js     ★ 文章数据（在这里写文章）
│       ├── markdown.js  Markdown 解析器 + 代码高亮
│       ├── api.js       后端 API 封装
│       ├── auth.js      用户系统前端（登录态 + 本地缓存）
│       ├── app.js       公共逻辑（主题、页头页脚、登录弹窗、工具）
│       ├── home.js      首页逻辑
│       └── article.js   文章页逻辑（含登录后评论）
```

### 更换封面主图

首页首屏的背景图是根目录下的 `test.png`。想换封面，直接把新图片命名为 `test.png` 覆盖即可（推荐横版 16:9、宽度 ≥ 1280px）；或用其他文件名时，改 `assets/css/style.css` 中 `.hero` 的 `background-image: url("../../test.png")`。

## 快速开始

1. 直接双击 `index.html`，或在本目录启动任意静态服务器：

   ```bash
   # 任选其一
   python -m http.server 8000
   npx serve .
   ```

2. 浏览器访问 `http://localhost:8000`。

## 如何写文章

**推荐方式（有后端时）**：登录管理员账号 → 进入「用户中心 → 文章管理」，直接**新建 / 编辑 / 删除**文章，正文用 Markdown 填写即可，无需改代码。

**传统方式（静态兜底）**：直接编辑 `assets/js/posts.js`。每个文章是一个对象：

```javascript
{
  id: 'my-post',            // 唯一标识，英文短横线，用于链接和评论
  title: '文章标题',
  date: '2025-01-01',       // YYYY-MM-DD
  tags: ['标签一', '标签二'],
  category: '分类',
  excerpt: '一句话摘要，显示在首页卡片',
  content: `                // 正文，Markdown 语法
正文内容……
`
}
```

复制一个对象、修改字段、插入 `POSTS` 数组即可。**注意**：

- 正文写在模板字符串（反引号）里，正文中的反引号 `` ` `` 要写成 `` \` ``，`${` 要写成 `\${`；
- 代码块建议用 `~~~` 围栏（与 ` ``` ` 等价），避免与模板字符串的反引号冲突。

> 说明：部署后端后，前端优先从后端 `/api/posts` 读取文章（`posts.js` 仅作为后端不可用时的静态兜底；后端首次启动也会自动从 `posts.js` 导入初始文章）。

## Markdown 语法

| 语法 | 写法 |
| --- | --- |
| 标题 | `#` ~ `######` |
| 粗体 / 斜体 / 删除线 | `**粗**` `*斜*` `~~删~~` |
| 行内代码 / 代码块 | `` `code` `` 或 `~~~lang` 围栏 |
| 链接 / 图片 | `[文字](url)` / `![替代](url)` |
| 无序 / 有序列表 | `-` `*` `+` / `1.` |
| 引用 / 分隔线 | `>` / `---` |
| 表格 | `\| 表头 \|` + 分隔行 |
| 视频 / 音频 | `@[video](url)` / `@[audio](url)` |
| 原生 HTML | `<video>` `<audio>` `<iframe>` 等直接透传 |

完整示例见站内《Markdown 写作指南》一文（`article.html?id=markdown-guide`）。

## 视频与音频

两种方式：

1. **快捷语法**：`@[video](视频地址)`、`@[audio](音频地址)`；
2. **原生标签**：直接写 `<video controls src="..."></video>` 或 `<audio controls src="..."></audio>`，可加 `poster`、`width` 等属性。

第三方视频（YouTube、B 站等）用它们的"嵌入" iframe 代码粘贴即可。

## 用户系统（登录后评论）

用户数据由**后端**（`server/server.js`）管理，评论需登录后发表。账户与昵称**分离**：

- **账户（account）**：用于登录，唯一，仅限英文/数字/下划线/点/短横线；
- **用户名 / 昵称（nickname）**：仅用于显示，可修改，不参与登录；
- 密码经 **scrypt 加盐哈希**后存在后端数据库（不存明文），登录态用 JWT（30 天）；
- 页头右侧是**头像**：登录后头像左侧显示昵称，**悬停头像**弹出菜单（账户名、更改昵称、更改密码、退出登录），**点击头像**进入用户中心（`user.html`）；
- 评论显示昵称，**自己的评论可删除**。

### 管理员与审核

- 后端首次启动自动创建管理员，默认账户 `admin`、昵称 `站长`、密码 `admin123`（用环境变量 `ADMIN_ACCOUNT` / `ADMIN_PASSWORD` / `ADMIN_NICKNAME` 覆盖）；
- **所有评论和回复都先进入「待审核」**，公开页面不显示；
- 管理员登录后在**用户中心 → 评论审核**面板点「通过 / 删除」，通过后才对所有人可见；
- 管理员可删除任意评论，昵称旁显示 🟡「管理员」徽标；
- 管理员还可在**用户中心 → 文章管理**里**新建、编辑、删除文章**（正文 Markdown）；
- **请部署后尽快修改管理员初始密码。**

## 评论系统

评论存在**后端 SQLite 数据库**里，跨设备、跨访客共享，并支持回复。

- 发评论/回复 → 存为「待审核」；
- 管理员审核通过 → 公开显示；
- 未登录只能看已通过评论，不能发言。

后端部署见 [`server/README.md`](server/README.md)（香港 VPS + Caddy HTTPS + pm2 保活）。

## RSS 订阅

`rss.xml` 由 `build-rss.js` 从文章数据自动生成。新增/修改文章后运行：

```bash
node build-rss.js
```

## 上线前配置

打开 `assets/js/config.js`，改这几个字段：

- `name`：站点名称
- `slogan` / `description`：副标题与简介
- `announcements`：公告列表（`{date, text}`，最新一条以 50% 透明度的气泡浮在首页封面上、可关闭；公告页展示全部）
- `nav`：导航栏（默认「首页 / 公告 / 关于」）
- `author`：作者名
- `url`：站点真实域名（影响 RSS 与评论链接）
- `apiUrl`：后端 API 地址（本地测试填 `http://localhost:3000`，上线后填 `https://你的域名.com`）
- `icp`：备案号（可留空）

## 部署

整个目录就是站点，**无构建步骤、无依赖安装**，直接上传到任意静态托管即可。

### 部署到 GitHub Pages

1. 在 GitHub 新建一个仓库（可设为公开），把本站文件推上去（`index.html` 在仓库根目录）：
   ```bash
   git init
   git add .
   git commit -m "init blog"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git push -u origin main
   ```
2. 仓库页面 → **Settings → Pages**，把 Source 选为 **Deploy from a branch**，分支选 `main`、目录选 `/ (root)`，保存。
3. 一两分钟后即可通过 `https://<你的用户名>.github.io/<仓库名>/` 访问。

> 站内所有链接都用的**相对路径**，所以部署在 `用户名.github.io/仓库名/` 这种子目录下也能正常跳转。

**上线前务必改两处**（否则 RSS 链接会指向示例域名）：

1. 打开 `assets/js/config.js`，把 `url` 改成你的 Pages 地址，例如：
   ```javascript
   url: 'https://<你的用户名>.github.io/<仓库名>'
   ```
2. 重新生成订阅源：`node build-rss.js`

> 仓库里已放置 `.nojekyll` 文件，让 GitHub Pages 跳过 Jekyll 处理、按纯静态文件直接托管。

### 部署到其他平台（Vercel / Netlify / Cloudflare Pages）

同样只需上传整个目录，无需任何构建命令；Vercel/Netlify 可把「构建命令」留空、输出目录设为仓库根目录。

### ⚠️ 关于用户系统与评论（需要后端）

GitHub Pages 只托管**静态前端**。真实多人登录 + 全站共享评论 + 审核，需要把 `server/` 后端部署到你自己的服务器（香港 VPS 最省事、免备案）。部署步骤见 [`server/README.md`](server/README.md)，然后把 `config.js` 的 `apiUrl` 指向后端地址即可。

不部署后端时，登录/评论功能会提示"无法连接服务器"，其余静态功能（文章、搜索、主题、公告等）不受影响。

---

祝你写作愉快 ✍️
