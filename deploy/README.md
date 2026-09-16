# AI Enterprise Studio — Native VPS deploy (no Docker)

Domain: **https://aienterprisestudio.com**  
API: **https://aienterprisestudio.com/api/**  
App dir: `/var/www/AIES`  
DB: **Supabase** (Session pooler — IPv4)

## 0. Stop Docker (if you used it)

```bash
cd /var/www/AIES
docker compose -f docker-compose.prod.yml down 2>/dev/null || true
docker rm -f aes-nginx aes-api aes-web aes-certbot aes-postgres 2>/dev/null || true
```

## 1. One-time server setup

```bash
cd /var/www/AIES
git pull
bash deploy/native-setup.sh
```

## 2. Env (Supabase Session pooler)

```bash
cd /var/www/AIES
nano .env.production
cp .env.production .env
```

Required:

```bash
APP_URL=https://aienterprisestudio.com
API_URL=https://aienterprisestudio.com
NEXT_PUBLIC_API_URL=https://aienterprisestudio.com
CORS_ORIGIN=https://aienterprisestudio.com,https://www.aienterprisestudio.com
JWT_SECRET=...long-secret...

# Supabase → Connect → Session pooler (port 5432). NOT db.*.supabase.co
DATABASE_URL=postgresql://postgres.hiybersyslkgeqslfkqo:YOUR_PASSWORD@aws-0-YOUR_REGION.pooler.supabase.com:5432/postgres?sslmode=require
```

## 3. Build, migrate, start

```bash
cd /var/www/AIES
bash deploy/native-deploy.sh
```

## 4. Seed admin (once)

```bash
cd /var/www/AIES
pnpm db:seed
```

## 5. SSL

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d aienterprisestudio.com -d www.aienterprisestudio.com
# Or after cert exists:
# cp deploy/nginx/host.ssl.conf /etc/nginx/sites-available/aienterprisestudio
# nginx -t && systemctl reload nginx
```

## 6. Verify

```bash
pm2 status
curl -s http://127.0.0.1:4000/api/health
curl -I http://127.0.0.1/
curl -s https://aienterprisestudio.com/api/health
```

## Updates later

```bash
cd /var/www/AIES
git pull
cp .env.production .env   # if secrets changed
pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate
pm2 restart aes-api aes-web
```

## Useful PM2

```bash
pm2 logs
pm2 restart all
pm2 save
```
