// Cấu hình PM2 cho hệ thống Quản lý Cấp lệnh VR-SB trên Ubuntu Server
// Chạy bằng: pm2 start deploy/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'caplenhvr-sb',
      script: 'server.ts',
      interpreter: 'node',
      cwd: '/var/www/caplenhvr-sb',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '750M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        APP_URL: 'http://caplenhvr-sb.online',
        DOSSIER_STORAGE_DIR: '/var/www/caplenhvr-sb/data/ho-so-chuyen',
      },
      time: true,
      merge_logs: true,
      out_file: '/var/log/caplenhvr-sb/out.log',
      error_file: '/var/log/caplenhvr-sb/error.log',
    },
  ],
};
