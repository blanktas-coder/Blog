#!/usr/bin/env bash
# ============================================================
# 博客一键部署脚本（Ubuntu 24，root 运行）
# 用法：sudo bash deploy.sh 你的域名.com 你的管理员密码
# 例：  sudo bash deploy.sh blog.example.com MyStr0ngPass
# 不传参数时用下面的默认值
# ============================================================
set -e

DOMAIN="${1:-example.com}"
ADMIN_PASSWORD="${2:-ChangeMe123}"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"

# 必须 root 运行（要装软件、写 /etc、起服务）
if [ "$EUID" -ne 0 ]; then
  echo "请用 root 或 sudo 运行：sudo bash deploy.sh $DOMAIN $ADMIN_PASSWORD"
  exit 1
fi

echo "=================================================="
echo " 博客部署开始"
echo "   域名:      $DOMAIN"
echo "   项目目录:  $APP_DIR"
echo "   管理员密码: $ADMIN_PASSWORD"
echo "=================================================="

# 1. 检查项目文件
if [ ! -f "$APP_DIR/index.html" ] || [ ! -f "$APP_DIR/server/server.js" ]; then
  echo "错误：没找到 index.html 或 server/server.js。请在项目根目录运行本脚本。"
  exit 1
fi

# 2. 安装 Node.js 24（若版本 < 22.5）
need_node=0
if command -v node >/dev/null 2>&1; then
  MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
  MINOR=$(node -v | sed 's/v[0-9]*\.\([0-9]*\).*/\1/')
  if [ "$MAJOR" -ge 23 ] || { [ "$MAJOR" -eq 22 ] && [ "$MINOR" -ge 5 ]; }; then
    need_node=0
  else
    need_node=1
  fi
else
  need_node=1
fi
if [ "$need_node" -eq 1 ]; then
  echo "==> 安装 Node.js 24 ..."
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
echo "==> Node 版本: $(node -v)"

# 3. 安装 pm2
if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> 安装 pm2 ..."
  npm install -g pm2
fi

# 4. 安装 Caddy
if ! command -v caddy >/dev/null 2>&1; then
  echo "==> 安装 Caddy ..."
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

# 5. 启动/重启后端（pm2 保活）
echo "==> 启动后端 ..."
cd "$APP_DIR/server"
pm2 delete blog-backend >/dev/null 2>&1 || true
ADMIN_PASSWORD="$ADMIN_PASSWORD" pm2 start server.js --name blog-backend
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# 6. 写 Caddy 配置（静态前端 + 反代 /api 到后端）
echo "==> 配置 Caddy ..."
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
    root * $APP_DIR
    encode gzip
    handle /api/* {
        reverse_proxy localhost:3000
    }
    file_server
}
EOF
systemctl reload caddy

# 7. 前端 apiUrl 设为绝对地址（这样 GitHub Pages 前端和 VPS 前端都能访问后端：
#    VPS 前端 = 同域走 Caddy /api 反代；GitHub Pages 前端 = 跨域走后端 CORS）
echo "==> 设置前端 apiUrl ..."
sed -i "s#apiUrl: '[^']*'#apiUrl: 'https://$DOMAIN'#" "$APP_DIR/assets/js/config.js"

# 8. 若 ufw 已启用，放行 22/80/443
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  echo "==> 配置防火墙 ..."
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
fi

echo ""
echo "=================================================="
echo " ✅ 部署完成"
echo "   网站:   https://$DOMAIN"
echo "   后端:   http://localhost:3000"
echo "   管理员: admin / $ADMIN_PASSWORD（请尽快登录修改密码）"
echo "=================================================="
echo " 如网站打不开，依次检查："
echo "   1. 域名 A 记录是否指向本机公网 IP"
echo "   2. 云控制台安全组是否放行 22/80/443"
echo "   3. 后端日志: pm2 logs blog-backend"
echo "   4. Caddy 状态: systemctl status caddy"
echo "=================================================="
