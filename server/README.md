# 博客后端部署教程（香港 VPS）

后端是一个**零第三方依赖**的 Node.js 服务，负责：邮箱密码注册/登录、发评论/回复（先"待审核"）、管理员审核（通过/驳回）、公开只读已通过评论，以及文章/公告管理。

> 🚀 **最快方式**：项目根目录有 `deploy.sh` 一键部署脚本，前后端一起装。把整个项目传到服务器后执行：
> ```bash
> sudo bash deploy.sh 你的域名.com 你的管理员密码
> ```
> 它会自动装 Node 24 / Caddy / pm2、起后端、配 HTTPS 反代、改前端配置。下面的手动步骤仅作参考。

## 1. 前置要求

- 一台 VPS（香港或海外，免备案）；
- 一个域名，并把该域名解析到 VPS 的 IP（A 记录）；
- VPS 上安装 **Node.js ≥ 22.5**（推荐 24 LTS）。

## 2. 上传并运行

```bash
# 在 VPS 上
mkdir -p /opt/blog-server
# 把本目录（server.js）上传到 /opt/blog-server/（可用 scp / sftp / git）
cd /opt/blog-server

# 建议设置管理员初始密码（不设则用默认 admin/admin123）
export ADMIN_PASSWORD="改成你的强密码"

# 先手动跑一次，确认能启动（会打印“博客后端已启动”）
node server.js
# 看到启动信息后 Ctrl+C 退出
```

首次运行会自动在 `data/` 下创建 `blog.db`（SQLite 数据库）和 `.secret`（签名密钥），并自动创建管理员账户 `admin`。

## 3. 用 pm2 保活

```bash
npm install -g pm2
cd /opt/blog-server
pm2 start server.js --name blog
pm2 save
pm2 startup   # 按提示复制执行它输出的命令，开机自启
```

> 环境变量也可这样带：`ADMIN_PASSWORD=xxx pm2 start server.js --name blog`

## 4. 用 Caddy 配置 HTTPS + 反向代理

安装 Caddy（它会自动申请/续期 Let's Encrypt 证书）：

```bash
sudo apt install -y caddy
```

编辑 `/etc/caddy/Caddyfile`：

```
你的域名.com {
    reverse_proxy localhost:3000
}
```

重载：

```bash
sudo systemctl reload caddy
```

完成后，后端 API 的根地址就是：`https://你的域名.com`

## 5. 防火墙

只对外开放 80/443（Caddy 用），3000 端口只让本机访问即可（Caddy 反代到 localhost:3000，无需对外开 3000）。

## 6. 前端配置

在博客 `assets/js/config.js` 里把 `apiUrl` 改成：

```javascript
apiUrl: 'https://你的域名.com'
```

然后前端照常部署到 GitHub Pages。

## 接口一览（供排查）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /api/register | 注册（account/password/nickname）|
| POST | /api/login | 登录 |
| GET | /api/me | 当前用户（Bearer token）|
| POST | /api/change-password | 改密码 |
| POST | /api/change-nickname | 改昵称 |
| GET | /api/comments?post=xxx | 公开评论（仅已通过）|
| POST | /api/comments | 发评论/回复（存待审核）|
| GET | /api/my-comments | 我的评论（含回复）|
| GET | /api/pending | 待审核列表（管理员）|
| POST | /api/approve | 通过（管理员）|
| POST | /api/reject | 驳回/删除（管理员）|
| DELETE | /api/comments/:id | 删除（自己或管理员）|

> 安全提醒：后端默认 CORS 为 `*`（任何域名都能调）。个人博客够用；如想收紧，可把 `server.js` 里的 `Access-Control-Allow-Origin` 改成你的 GitHub Pages 域名。
