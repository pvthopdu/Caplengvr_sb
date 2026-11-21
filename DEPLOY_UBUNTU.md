# Hướng dẫn triển khai lên Ubuntu Server & Tên miền `http://caplenhvr-sb.online`

Hệ thống **Quản lý Cấp lệnh vào/ra cảng bến TNĐ (VR-SB)** chạy thống nhất trên một tiến trình Node.js (`server.ts`, cổng `3000`) kết hợp Nginx Reverse Proxy cổng `80` cho tên miền `http://caplenhvr-sb.online`.

---

## 1. Yêu cầu hạ tầng & Trỏ tên miền DNS
1. **Máy chủ (VPS / Server):** Ubuntu `22.04 LTS` hoặc `24.04 LTS` (RAM tối thiểu 2GB, ổ cứng còn trống ≥ 10GB để lưu hồ sơ chuyến `data/ho-so-chuyen`).
2. **Trỏ DNS tên miền `caplenhvr-sb.online`:**
   Tại trang quản trị tên miền, tạo các bản ghi sau trỏ về địa chỉ IP công cộng (IPv4) của Ubuntu Server:
   - `A` | `@` | `<IP_SERVER_UBUNTU>` | TTL: `300` (hoặc Auto)
   - `A` | `www` | `<IP_SERVER_UBUNTU>` | TTL: `300`

---

## 2. Bước bắt buộc trên Firebase Authentication (Đăng nhập Gmail)
Hệ thống dùng Firebase Auth đăng nhập bằng Gmail. Khi đổi sang tên miền `caplenhvr-sb.online`, bạn **bắt buộc** khai báo tên miền vào danh sách cho phép của Firebase:
1. Mở [Firebase Console](https://console.firebase.google.com/) → chọn dự án (mặc định đọc từ `firebase-applet-config.json`).
2. Vào **Authentication** → **Settings** → **Authorized domains**.
3. Bấm **Add domain** và thêm cả 2 dòng:
   - `caplenhvr-sb.online`
   - `www.caplenhvr-sb.online`

---

## 3. Đưa mã nguồn lên Ubuntu Server
Đăng nhập SSH vào Ubuntu Server và chép mã nguồn vào `/var/www/caplenhvr-sb`:
```bash
sudo mkdir -p /var/www/caplenhvr-sb
sudo chown -R "$USER":"$USER" /var/www/caplenhvr-sb
# Tải mã nguồn vào /var/www/caplenhvr-sb (git clone hoặc scp/rsync)
```

---

## 4. Chạy cài đặt tự động (Node.js 22 LTS + Build + Nginx + PM2)
Trong thư mục `/var/www/caplenhvr-sb`, cấp quyền thực thi và chạy script cài đặt:
```bash
cd /var/www/caplenhvr-sb
chmod +x deploy/setup-ubuntu.sh
./deploy/setup-ubuntu.sh /var/www/caplenhvr-sb
```

### Cấu hình biến môi trường `.env`
Mở `/var/www/caplenhvr-sb/.env` để kiểm tra và điền `GEMINI_API_KEY` (nếu sử dụng Trợ lý AI):
```env
GEMINI_API_KEY="AIza..."
APP_URL="http://caplenhvr-sb.online"
PORT="3000"
FIREBASE_PROJECT_ID=""
DOSSIER_STORAGE_DIR="/var/www/caplenhvr-sb/data/ho-so-chuyen"
SESSION_SECRET="<chuỗi_bí_mật_ngẫu_nhiên_64_ký_tự>"
```
Sau khi sửa `.env`, tải lại dịch vụ PM2:
```bash
pm2 restart caplenhvr-sb --update-env
```

---

## 5. Cài đặt PM2 tự khởi động khi Reboot Server
Chạy lệnh sau và copy dòng lệnh `sudo env PATH=...` mà PM2 hiển thị để thực thi lại:
```bash
pm2 startup
pm2 save
```

*(Tùy chọn: Nếu muốn dùng `systemd` thay cho PM2, sử dụng file mẫu `deploy/caplenhvr-sb.service`.)*

---

## 6. Kiểm tra sau triển khai
1. Kiểm tra API & tình trạng server nội bộ:
   ```bash
   curl -s http://127.0.0.1:3000/api/health
   ```
2. Kiểm tra qua tên miền chính thức:
   ```bash
   curl -I http://caplenhvr-sb.online/api/health
   ```
3. Mở trình duyệt truy cập **`http://caplenhvr-sb.online`** trên cả máy tính, máy tính bảng và điện thoại di động:
   - Thử đăng nhập tài khoản Google/Gmail.
   - Kiểm tra tạo/đồng bộ hồ sơ để xác nhận thư mục hồ sơ được tạo tại `/var/www/caplenhvr-sb/data/ho-so-chuyen/<Ma_Ho_So>/`.

---

## 7. Nâng cấp HTTPS miễn phí (Khuyến nghị sau khi trỏ DNS xong)
Sau khi tên miền `http://caplenhvr-sb.online` đã truy cập ổn định, bạn có thể bật chứng chỉ SSL (HTTPS) tự động bằng Let's Encrypt (hệ thống backend đã tự động nhận `X-Forwarded-Proto: https` để nâng cấp cookie bảo mật):
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d caplenhvr-sb.online -d www.caplenhvr-sb.online
```
Khi chuyển sang HTTPS, cập nhật thêm `APP_URL="https://caplenhvr-sb.online"` trong `.env` và `pm2 restart caplenhvr-sb --update-env`.
