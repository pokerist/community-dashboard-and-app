# Deployment (Domain + Reverse Proxy + HTTPS)

This guide complements `documentation/DEPLOYMENT_ADMIN_PM2.md`.

Use this when moving from direct-port demo access to a proper client-facing setup.

## Recommended Topology

- `community-admin.<your-domain>` -> Admin dashboard (PM2 app on `127.0.0.1:4002`)
- `community-api.<your-domain>` -> Backend API (PM2 app on `127.0.0.1:4003`)

PM2 stays internal to the server. Public traffic goes through Nginx/Caddy.

## 1) Verify PM2 apps are reachable locally on the server

```bash
pm2 status
curl -I http://127.0.0.1:4002/
curl -I http://127.0.0.1:4003/api
```

If these fail, fix PM2/deploy first before configuring Nginx.

## 2) DNS Records

Create A records pointing to your server IP:
- `community-admin.<your-domain>` -> server IP
- `community-api.<your-domain>` -> server IP

## 3) Nginx Reverse Proxy

Template provided:
- `scripts/deploy/nginx.community-dashboard.conf.example`

Install and enable:
```bash
sudo apt update
sudo apt install -y nginx
sudo cp scripts/deploy/nginx.community-dashboard.conf.example /etc/nginx/sites-available/community-dashboard
```

Edit domains in the file, then enable:
```bash
sudo ln -s /etc/nginx/sites-available/community-dashboard /etc/nginx/sites-enabled/community-dashboard
sudo nginx -t
sudo systemctl reload nginx
```

## 4) HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d community-admin.<your-domain> -d community-api.<your-domain>
```

After that, test:
- `https://community-admin.<your-domain>`
- `https://community-api.<your-domain>/api`

## 5) Update App Configs for Domain-based URLs

### Backend `.env.production`
- `CORS_ORIGIN=https://community-admin.<your-domain>`
- `FRONTEND_URL=https://community-admin.<your-domain>`

### Admin `apps/admin-web/.env.production`
- `VITE_API_BASE_URL=https://community-api.<your-domain>`

### Mobile `apps/community-mobile-native/.env`
- `EXPO_PUBLIC_API_BASE_URL=https://community-api.<your-domain>`

Rebuild/restart after changes:
```bash
./deploy.sh
```

or (manual):
```bash
pm2 restart community-backend
pm2 restart community-admin-web
```

## 6) PM2 Persistence

```bash
pm2 save
pm2 startup
```

Run the command PM2 prints (once) to enable service startup on reboot.

## 7) Optional Hardening (Recommended Next)

### PM2 log rotation
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
```

### Firewall
- Keep only ports `80/443` public if using reverse proxy
- Restrict direct access to `4002/4003` (optional but recommended)

## 8) Post-Deploy Smoke

Server local:
```bash
npm run smoke:admin-stack:linux
```

Public:
```bash
curl -I https://community-admin.<your-domain>
curl -I https://community-api.<your-domain>/api
```

## Notes

- The mobile app should use the **API domain**, not the admin domain.
- Expo Go/device testing still depends on mobile network connectivity and TLS trust on the device.
- FCM direct push requires native build setup; Expo Push path can be used first.
