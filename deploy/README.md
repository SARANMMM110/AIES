# AI Enterprise Studio — VPS deploy (Docker)

Target domain: **aienterprisestudio.com**  
API: **api.aienterprisestudio.com**  
Server: `root@158.220.126.210`

## 1. DNS (at your domain registrar)

Create these records pointing to `158.220.126.210`:

| Type | Name | Value |
|------|------|-------|
| A | `@` | `158.220.126.210` |
| A | `www` | `158.220.126.210` |
| A | `api` | `158.220.126.210` |

Wait until they resolve before requesting SSL.

## 2. Server prerequisites

```bash
ssh root@158.220.126.210
apt-get update
apt-get install -y ca-certificates curl git ufw
curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
mkdir -p /opt/aes
```

## 3. Upload the project

From your local machine (PowerShell / Git Bash), in the project root:

```bash
rsync -avz --exclude node_modules --exclude .next --exclude dist --exclude .git --exclude .env \
  ./ root@158.220.126.210:/opt/aes/
```

Or clone from git if the repo is pushed to a remote.

## 4. Production env

On the VPS:

```bash
cd /opt/aes
cp .env.production.example .env.production
nano .env.production   # set strong POSTGRES_PASSWORD, JWT_SECRET, admin password
```

## 5. First boot (HTTP)

```bash
cd /opt/aes
cp deploy/nginx/aienterprisestudio.bootstrap.conf deploy/nginx/aienterprisestudio.conf
mkdir -p deploy/certbot/www deploy/certbot/conf
docker compose -f docker-compose.prod.yml up -d --build
```

Check:

```bash
curl -I http://158.220.126.210
curl http://127.0.0.1:80   # via nginx
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api web
```

Optional seed:

```bash
docker compose -f docker-compose.prod.yml exec api \
  sh -c 'cd /app/packages/database && npx tsx prisma/seed.ts'
```

## 6. SSL (Let's Encrypt)

```bash
docker compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  -d aienterprisestudio.com -d www.aienterprisestudio.com -d api.aienterprisestudio.com \
  --email admin@aienterprisestudio.com --agree-tos --no-eff-email

cp deploy/nginx/aienterprisestudio.ssl.conf deploy/nginx/aienterprisestudio.conf
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## 7. Verify

- https://aienterprisestudio.com
- https://api.aienterprisestudio.com/api/health

## Updates

```bash
cd /opt/aes
# pull / rsync latest code
docker compose -f docker-compose.prod.yml up -d --build
```
