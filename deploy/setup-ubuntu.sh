#!/usr/bin/env bash
set -euo pipefail

# Kịch bản cài đặt tự động trên Ubuntu 22.04 / 24.04 LTS
# Tên miền: http://caplenhvr-sb.online
# Thư mục ứng dụng mặc định: /var/www/caplenhvr-sb

DOMAIN="caplenhvr-sb.online"
APP_DIR="${1:-/var/www/caplenhvr-sb}"
STORAGE_DIR="${APP_DIR}/data/ho-so-chuyen"

echo "=== 1. Cập nhật gói hệ thống & cài đặt công cụ cần thiết ==="
sudo apt-get update -y
sudo apt-get install -y curl git nginx ca-certificates gnupg

echo "=== 2. Kiểm tra & cài đặt Node.js 22 LTS (hỗ trợ chạy trực tiếp server.ts) ==="
NEED_NODE=0
if ! command -v node >/dev/null 2>&1; then
  NEED_NODE=1
else
  NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
  if [ "${NODE_MAJOR}" -lt 22 ]; then
    NEED_NODE=1
  fi
fi

if [ "${NEED_NODE}" -eq 1 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "Node.js hiện tại: $(node -v) | npm: $(npm -v)"

echo "=== 3. Cài đặt PM2 quản lý tiến trình ==="
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

echo "=== 4. Chuẩn bị thư mục lưu trữ hồ sơ chuyến & nhật ký ==="
cd "${APP_DIR}"
mkdir -p "${STORAGE_DIR}"
sudo mkdir -p /var/log/caplenhvr-sb
sudo chown -R "$USER":"$USER" "${APP_DIR}" /var/log/caplenhvr-sb

if [ ! -f "${APP_DIR}/.env" ]; then
  cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
  SESSION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
  sed -i "s|^APP_URL=.*|APP_URL=\"http://${DOMAIN}\"|" "${APP_DIR}/.env"
  sed -i "s|^DOSSIER_STORAGE_DIR=.*|DOSSIER_STORAGE_DIR=\"${STORAGE_DIR}\"|" "${APP_DIR}/.env"
  sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=\"${SESSION_KEY}\"|" "${APP_DIR}/.env"
  echo "[Lưu ý] Đã tạo tệp .env từ .env.example. Hãy điền GEMINI_API_KEY vào ${APP_DIR}/.env nếu dùng tính năng AI."
fi

echo "=== 5. Cài đặt dependencies & build giao diện tối ưu (production) ==="
npm ci --include=dev
npm run build

echo "=== 6. Cấu hình Nginx cho tên miền ${DOMAIN} ==="
sudo cp "${APP_DIR}/deploy/nginx-caplenhvr-sb.online.conf" "/etc/nginx/sites-available/${DOMAIN}"
sudo ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
if [ -f /etc/nginx/sites-enabled/default ]; then
  sudo rm -f /etc/nginx/sites-enabled/default
fi
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

echo "=== 7. Khởi động ứng dụng qua PM2 ==="
if [ "${APP_DIR}" != "/var/www/caplenhvr-sb" ]; then
  sed "s|/var/www/caplenhvr-sb|${APP_DIR}|g" "${APP_DIR}/deploy/ecosystem.config.cjs" > "${APP_DIR}/deploy/ecosystem.local.cjs"
  pm2 startOrRestart "${APP_DIR}/deploy/ecosystem.local.cjs"
else
  pm2 startOrRestart "${APP_DIR}/deploy/ecosystem.config.cjs"
fi
pm2 save
echo "Để PM2 tự khởi động cùng Ubuntu, hãy chạy lệnh do 'pm2 startup' in ra."

echo "=== 8. Mở cổng tường lửa UFW (nếu đang bật) ==="
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow OpenSSH >/dev/null 2>&1 || true
  sudo ufw allow 'Nginx Full' >/dev/null 2>&1 || true
fi

echo "=== HOÀN TẤT TRIỂN KHAI ==="
echo "Kiểm tra nội bộ: curl -s http://127.0.0.1:3000/api/health"
echo "Truy cập tên miền: http://${DOMAIN}"
echo "QUAN TRỌNG: Nhớ thêm '${DOMAIN}' vào Firebase Console -> Authentication -> Settings -> Authorized domains."
