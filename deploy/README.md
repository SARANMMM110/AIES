# AI Enterprise Studio — VPS deploy (Docker)

Single domain: **https://aienterprisestudio.com**  
API path: **https://aienterprisestudio.com/api/** (no `api.` subdomain)  
Server: `root@158.220.126.210` · app dir: `/var/www/AIES`

**Ports:** only **80** and **443** are public (nginx). App ports **3000** (web) and **4000** (api) stay inside Docker — do not open them in UFW.

## 1. DNS

| Type | Name | Value |
|------|------|-------|
| A | `@` | `158.220.126.210` |
| A | `www` | `158.220.126.210` |

No `api` A record needed.

## 2. Firewall (already done if you followed earlier steps)

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

## 3. Production env (fixes POSTGRES_PASSWORD error)

Docker Compose reads **`.env`** for `${VAR}` substitution — `.env.production` alone is not enough.

```bash
cd /var/www/AIES
cp .env.production.example .env.production
nano .env.production
# set POSTGRES_PASSWORD (same value in DATABASE_URL), JWT_SECRET, SEED_ADMIN_PASSWORD

cp .env.production .env
```

Example values (use your own secrets):

```bash
POSTGRES_PASSWORD=YourStrongDbPasswordHere
DATABASE_URL=postgresql://aes:YourStrongDbPasswordHere@postgres:5432/ai_enterprise_studio?schema=public
JWT_SECRET=z_L0kUpnrVLqFKzwFPx4u4v9P0sh-O-onjX8ubHCCS65EjsGgoGv6pMZOxfbNcU2
APP_URL=https://aienterprisestudio.com
API_URL=https://aienterprisestudio.com
NEXT_PUBLIC_API_URL=https://aienterprisestudio.com
CORS_ORIGIN=https://aienterprisestudio.com,https://www.aienterprisestudio.com
```

## 4. First boot (HTTP)

```bash
cd /var/www/AIES
git pull   # after pushing the single-domain nginx/env fixes
cp deploy/nginx/aienterprisestudio.bootstrap.conf deploy/nginx/aienterprisestudio.conf
mkdir -p deploy/certbot/www deploy/certbot/conf
docker compose -f docker-compose.prod.yml up -d --build
```

Check:

```bash
docker compose -f docker-compose.prod.yml ps
curl -s http://127.0.0.1/api/health
curl -I http://aienterprisestudio.com
```

Optional seed:

```bash
docker compose -f docker-compose.prod.yml exec api \
  sh -c 'cd /app/packages/database && npx tsx prisma/seed.ts'
```

## 5. SSL

```bash
bash deploy/issue-ssl.sh admin@aienterprisestudio.com
# or:
docker compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  -d aienterprisestudio.com -d www.aienterprisestudio.com \
  --email admin@aienterprisestudio.com --agree-tos --no-eff-email

cp deploy/nginx/aienterprisestudio.ssl.conf deploy/nginx/aienterprisestudio.conf
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## 6. Verify

- https://aienterprisestudio.com
- https://aienterprisestudio.com/api/health

## Updates

```bash
cd /var/www/AIES
git pull
cp .env.production .env   # keep in sync if you edit secrets
docker compose -f docker-compose.prod.yml up -d --build
```
