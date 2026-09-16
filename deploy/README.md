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

## 3. Production env (Supabase)

Docker Compose reads **`.env`** for `${VAR}` substitution. Use Supabase for the database (no local Postgres container required).

```bash
cd /var/www/AIES
nano .env.production
```

Set:

```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres?schema=public&sslmode=require
APP_URL=https://aienterprisestudio.com
API_URL=https://aienterprisestudio.com
NEXT_PUBLIC_API_URL=https://aienterprisestudio.com
CORS_ORIGIN=https://aienterprisestudio.com,https://www.aienterprisestudio.com
JWT_SECRET=...
```

Then:

```bash
cp .env.production .env
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

To stop the old local Postgres container (if it was started earlier):

```bash
docker compose -f docker-compose.prod.yml stop postgres
docker rm -f aes-postgres 2>/dev/null || true
```
