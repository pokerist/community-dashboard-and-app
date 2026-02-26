const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_PORT = process.env.BACKEND_PORT || '4003';
const FRONTEND_PORT = process.env.FRONTEND_PORT || '4002';

module.exports = {
  apps: [
    {
      name: 'community-backend',
      cwd: ROOT,
      script: fs.existsSync(path.join(ROOT, 'dist', 'main.js'))
        ? path.join(ROOT, 'dist', 'main.js')
        : path.join(ROOT, 'dist', 'src', 'main.js'),
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env_file: path.join(ROOT, '.env.production'),
      env_production: {
        NODE_ENV: 'production',
        PORT: BACKEND_PORT,
      },
      time: true,
    },
    {
      name: 'community-admin-web',
      cwd: path.join(ROOT, 'apps', 'admin-web'),
      script: 'npm',
      args: `run preview -- --host 0.0.0.0 --port ${FRONTEND_PORT}`,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env_production: {
        NODE_ENV: 'production',
      },
      time: true,
    },
  ],
};
