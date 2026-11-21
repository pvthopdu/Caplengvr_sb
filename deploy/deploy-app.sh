#!/usr/bin/env bash
set -euo pipefail

# Kịch bản thiết lập & triển khai TỰ ĐỘNG ỨNG DỤNG (KHÔNG cài đặt thêm phần mềm hệ thống)
# Phù hợp cho máy chủ Ubuntu đã có sẵn Node.js / Nginx / PM2 hoặc systemd.
#
# Cách dùng mặc định (cổng 3008, tên miền caplenhvr-sb.online):
#   chmod +x deploy/deploy-app.sh
#   ./deploy/deploy-app.sh
#
# Tùy biến cổng / tên miền:
#   PORT=3008 DOMAIN=caplenhvr-sb.online ./deploy/deploy-app.sh
#   ./deploy/deploy-app.sh --port 3008 --domain caplenhvr-sb.online --skip-nginx

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_PORT="${PORT:-3008}"
DOMAIN="${DOMAIN:-caplenhvr-sb.online}"
SKIP_NGINX=0

while [ $# -gt 0 ]; do
  case "$1" in
    --port)
      APP_PORT="${2:?Thiếu giá trị cho --port}"
      shift 2
      ;;
    --domain)
      DOMAIN="${2:?Thiếu giá trị cho --domain}"
      shift 2
      ;;
    --dir)
      APP_DIR="$(cd "${2:?Thiếu đường dẫn cho --dir}" && pwd)"
      shift 2
      ;;
    --skip-nginx)
      SKIP_NGINX=1
      shift
      ;;
    *)
      if [ -d "$1" ]; then
        APP_DIR="$(cd "$1" && pwd)"
      fi
      shift
      ;;
  esac
done

STORAGE_DIR="${APP_DIR}/data/ho-so-chuyen"
LOGS_DIR="${APP_DIR}/logs"
ENV_FILE="${APP_DIR}/.env"
LOCAL_PM2_CONFIG="${APP_DIR}/deploy/ecosystem.local.json"
LOCAL_NGINX_CONFIG="${APP_DIR}/deploy/nginx-${DOMAIN}.local.conf"

echo "=== KIỂM TRA MÔI TRƯỜNG HIỆN CÓ (KHÔNG CÀI ĐẶT PHẦN MỀM MỚI) ==="
if ! command -v node >/dev/null 2>&1; then
  echo "[LỖI] Máy chủ chưa có lệnh 'node'. Vui lòng cài Node.js (>= 18) trước khi chạy script này."
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "[LỖI] Máy chủ chưa có lệnh 'npm'."
  exit 1
fi

NODE_VER="$(node -v)"
NODE_MAJOR="$(echo "${NODE_VER}" | sed -E 's/^v([0-9]+).*/\1/')"
NODE_MINOR="$(echo "${NODE_VER}" | sed -E 's/^v[0-9]+\.([0-9]+).*/\1/')"
echo "Thư mục ứng dụng : ${APP_DIR}"
echo "Tên miền         : http://${DOMAIN}"
echo "Cổng dịch vụ     : ${APP_PORT}"
echo "Node.js hiện có  : ${NODE_VER} | npm: $(npm -v)"

USE_NATIVE_TS=0
if [ "${NODE_MAJOR}" -gt 22 ] || { [ "${NODE_MAJOR}" -eq 22 ] && [ "${NODE_MINOR}" -ge 18 ]; }; then
  USE_NATIVE_TS=1
fi

echo "=== 1. TẠO THƯ MỤC LƯU HỒ SƠ CHUYẾN & NHẬT KÝ ==="
cd "${APP_DIR}"
mkdir -p "${STORAGE_DIR}" "${LOGS_DIR}"

echo "=== 2. TẠO / CẬP NHẬT TỆP BIẾN MÔI TRƯỜNG (.env) ==="
if [ ! -f "${ENV_FILE}" ]; then
  cp "${APP_DIR}/.env.example" "${ENV_FILE}"
  SESSION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
  sed -i "s|^APP_URL=.*|APP_URL=\"http://${DOMAIN}\"|" "${ENV_FILE}"
  sed -i "s|^PORT=.*|PORT=\"${APP_PORT}\"|" "${ENV_FILE}"
  sed -i "s|^DOSSIER_STORAGE_DIR=.*|DOSSIER_STORAGE_DIR=\"${STORAGE_DIR}\"|" "${ENV_FILE}"
  sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=\"${SESSION_KEY}\"|" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  echo "[OK] Đã tạo mới ${ENV_FILE} với PORT=${APP_PORT} và SESSION_SECRET ngẫu nhiên."
else
  # Đảm bảo cập nhật PORT và DOSSIER_STORAGE_DIR khớp cấu hình chạy, giữ nguyên GEMINI_API_KEY & SESSION_SECRET
  if grep -q '^PORT=' "${ENV_FILE}"; then
    sed -i "s|^PORT=.*|PORT=\"${APP_PORT}\"|" "${ENV_FILE}"
  else
    echo "PORT=\"${APP_PORT}\"" >> "${ENV_FILE}"
  fi
  if grep -q '^APP_URL=' "${ENV_FILE}"; then
    sed -i "s|^APP_URL=.*|APP_URL=\"http://${DOMAIN}\"|" "${ENV_FILE}"
  else
    echo "APP_URL=\"http://${DOMAIN}\"" >> "${ENV_FILE}"
  fi
  if grep -q '^DOSSIER_STORAGE_DIR=' "${ENV_FILE}"; then
    sed -i "s|^DOSSIER_STORAGE_DIR=.*|DOSSIER_STORAGE_DIR=\"${STORAGE_DIR}\"|" "${ENV_FILE}"
  else
    echo "DOSSIER_STORAGE_DIR=\"${STORAGE_DIR}\"" >> "${ENV_FILE}"
  fi
  chmod 600 "${ENV_FILE}" 2>/dev/null || true
  echo "[OK] Đã đồng bộ PORT=${APP_PORT} vào ${ENV_FILE} (giữ nguyên các khóa API cũ)."
fi

echo "=== 3. CÀI THƯ VIỆN NODE & BUILD GIAO DIỆN PRODUCTION ==="
if [ -f "${APP_DIR}/package-lock.json" ]; then
  npm ci --include=dev --no-audit --no-fund
else
  npm install --include=dev --no-audit --no-fund
fi
if [ ! -f "${APP_DIR}/node_modules/express/index.js" ]; then
  echo "[Cảnh báo] node_modules/express chưa đầy đủ, đang cài lại sạch node_modules..."
  rm -rf "${APP_DIR}/node_modules"
  npm install --include=dev --no-audit --no-fund
fi
npm run build

echo "=== 4. CẤU HÌNH KHỞI CHẠY DỊCH VỤ (CỔNG ${APP_PORT}) ==="
if [ "${USE_NATIVE_TS}" -eq 1 ]; then
  PM2_SCRIPT="server.ts"
  PM2_ARGS=""
  EXEC_CMD="$(command -v node) ${APP_DIR}/server.ts"
else
  PM2_SCRIPT="node_modules/tsx/dist/cli.mjs"
  PM2_ARGS="server.ts"
  EXEC_CMD="$(command -v node) ${APP_DIR}/node_modules/tsx/dist/cli.mjs ${APP_DIR}/server.ts"
fi

if command -v pm2 >/dev/null 2>&1; then
  rm -f "${APP_DIR}/deploy/ecosystem.local.cjs"
  node -e "
    const fs = require('fs');
    const appCfg = {
      name: 'caplenhvr-sb',
      script: process.argv[1],
      interpreter: 'node',
      cwd: process.argv[3],
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '750M',
      env: {
        NODE_ENV: 'production',
        PORT: Number(process.argv[4]),
        APP_URL: 'http://' + process.argv[5],
        DOSSIER_STORAGE_DIR: process.argv[6],
      },
      time: true,
      merge_logs: true,
      out_file: process.argv[7] + '/out.log',
      error_file: process.argv[7] + '/error.log',
    };
    if (process.argv[2]) {
      appCfg.args = process.argv[2];
    }
    fs.writeFileSync(process.argv[8], JSON.stringify({ apps: [appCfg] }, null, 2) + '\n');
  " "${PM2_SCRIPT}" "${PM2_ARGS}" "${APP_DIR}" "${APP_PORT}" "${DOMAIN}" "${STORAGE_DIR}" "${LOGS_DIR}" "${LOCAL_PM2_CONFIG}"
  pm2 startOrRestart "${LOCAL_PM2_CONFIG}" --update-env
  pm2 save
  echo "[OK] Đã khởi động/cập nhật ứng dụng qua PM2 (caplenhvr-sb -> cổng ${APP_PORT})."
elif command -v systemctl >/dev/null 2>&1 && [ -d /etc/systemd/system ]; then
  SERVICE_USER="$(id -un)"
  SERVICE_GROUP="$(id -gn)"
  TMP_SERVICE="/tmp/caplenhvr-sb.service"
  cat > "${TMP_SERVICE}" <<EOF
[Unit]
Description=He thong Quan ly Cap lenh VR-SB - So Xay dung Quang Ngai
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}
Environment=APP_URL=http://${DOMAIN}
Environment=DOSSIER_STORAGE_DIR=${STORAGE_DIR}
EnvironmentFile=-${ENV_FILE}
ExecStart=${EXEC_CMD}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=caplenhvr-sb

[Install]
WantedBy=multi-user.target
EOF
  sudo cp "${TMP_SERVICE}" /etc/systemd/system/caplenhvr-sb.service
  rm -f "${TMP_SERVICE}"
  sudo systemctl daemon-reload
  sudo systemctl enable --now caplenhvr-sb
  sudo systemctl restart caplenhvr-sb
  echo "[OK] Đã khởi động ứng dụng qua systemd (caplenhvr-sb -> cổng ${APP_PORT})."
else
  # Chạy nền trực tiếp bằng Node (không cần PM2/systemd)
  PID_FILE="${LOGS_DIR}/server.pid"
  if [ -f "${PID_FILE}" ]; then
    OLD_PID="$(cat "${PID_FILE}" || true)"
    if [ -n "${OLD_PID}" ] && kill -0 "${OLD_PID}" 2>/dev/null; then
      kill "${OLD_PID}" || true
      sleep 1
    fi
  fi
  NODE_ENV=production PORT="${APP_PORT}" APP_URL="http://${DOMAIN}" DOSSIER_STORAGE_DIR="${STORAGE_DIR}" \
    nohup ${EXEC_CMD} > "${LOGS_DIR}/out.log" 2> "${LOGS_DIR}/error.log" < /dev/null &
  echo $! > "${PID_FILE}"
  echo "[OK] Đã khởi chạy nền trực tiếp bằng Node (PID $(cat "${PID_FILE}") -> cổng ${APP_PORT})."
fi

echo "=== 5. CẤU HÌNH REVERSE PROXY NGINX (GIỮ NGUYÊN CÁC WEBSITE KHÁC) ==="
sed -e "s|127.0.0.1:3000|127.0.0.1:${APP_PORT}|g" \
    -e "s|server_name caplenhvr-sb.online www.caplenhvr-sb.online;|server_name ${DOMAIN} www.${DOMAIN};|g" \
    "${APP_DIR}/deploy/nginx-caplenhvr-sb.online.conf" > "${LOCAL_NGINX_CONFIG}"

if [ "${SKIP_NGINX}" -eq 0 ] && command -v nginx >/dev/null 2>&1 && [ -d /etc/nginx/sites-available ]; then
  sudo cp "${LOCAL_NGINX_CONFIG}" "/etc/nginx/sites-available/${DOMAIN}"
  sudo ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
  sudo nginx -t
  sudo systemctl reload nginx
  echo "[OK] Đã nạp cấu hình Nginx cho http://${DOMAIN} -> 127.0.0.1:${APP_PORT} (không xóa các site hiện có)."
else
  echo "[Thông báo] Bỏ qua nạp Nginx tự động. Tệp cấu hình sẵn sàng tại: ${LOCAL_NGINX_CONFIG}"
fi

echo "=== 6. KIỂM TRA SỨC KHỎE DỊCH VỤ ==="
sleep 2
if command -v curl >/dev/null 2>&1; then
  curl -s "http://127.0.0.1:${APP_PORT}/api/health" || true
  echo ""
fi

echo "=== HOÀN TẤT ==="
echo "- Thư mục hồ sơ: ${STORAGE_DIR}"
echo "- Tệp .env     : ${ENV_FILE} (điền GEMINI_API_KEY nếu cần tính năng AI)"
echo "- Truy cập     : http://${DOMAIN} (nội bộ: http://127.0.0.1:${APP_PORT})"
echo "- Nhớ thêm '${DOMAIN}' & 'www.${DOMAIN}' vào Firebase Console -> Authentication -> Settings -> Authorized domains."
