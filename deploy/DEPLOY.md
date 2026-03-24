# 🚀 Dominion Realms — Деплой за 20 минут

## Вариант 1: Railway (Backend + БД) + Vercel (Frontend)
Бесплатно для старта, без кредитной карты.

---

## ШАГ 1 — GitHub репозиторий

```bash
# Инициализируй git в папке проекта
cd dominion-realms-phase6
git init
git add .
git commit -m "Initial commit"

# Создай репозиторий на github.com
# Затем:
git remote add origin https://github.com/ТВО_ИМЯ/dominion-realms.git
git push -u origin main
```

---

## ШАГ 2 — База данных (Railway)

1. Зайди на **railway.app** → New Project → Provision PostgreSQL
2. После создания: кликни на сервис PostgreSQL → Variables
3. Скопируй `DATABASE_URL` (выглядит как `postgresql://postgres:...@...railway.app:5432/railway`)
4. Запусти SQL из файла `backend/src/database/init.sql` через вкладку **Query** в Railway

Аналогично для Redis:
1. New Service → Redis
2. Скопируй `REDIS_URL`

---

## ШАГ 3 — Backend на Railway

1. Railway → New Project → Deploy from GitHub repo
2. Выбери твой репозиторий, папка: **backend**
3. Settings → Variables → добавь все переменные:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...    ← из шага 2
REDIS_URL=redis://...            ← из шага 2
JWT_SECRET=СГЕНЕРИРУЙ_СЛУЧАЙНУЮ_СТРОКУ_32_СИМВОЛА
JWT_REFRESH_SECRET=ЕЩЁ_ОДНА_СЛУЧАЙНАЯ_СТРОКА_32_СИМВОЛА
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=30d
FRONTEND_URL=https://dominion-realms.vercel.app
PORT=3001
```

4. Settings → Start Command: `npm run start`
5. После деплоя скопируй URL типа `https://dominion-backend.railway.app`

**Генератор секретов (запусти в терминале):**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## ШАГ 4 — Frontend на Vercel

1. Зайди на **vercel.com** → New Project → Import GitHub repo
2. Root Directory: **frontend**
3. Environment Variables:

```env
NEXT_PUBLIC_API_URL=https://dominion-backend.railway.app/api/v1
NEXT_PUBLIC_WS_URL=https://dominion-backend.railway.app
NEXT_PUBLIC_APP_NAME=Dominion Realms
```

4. Deploy → готово!
5. Получишь URL типа `https://dominion-realms.vercel.app`

---

## ШАГ 5 — Обновить FRONTEND_URL на Railway

Вернись в Railway → Backend → Variables → обнови:
```
FRONTEND_URL=https://dominion-realms.vercel.app
```
Redeploy.

---

## ШАГ 6 — Создать первый аккаунт (администратор)

```bash
# Зарегистрируйся через игру как обычный игрок
# Затем в Railway → PostgreSQL → Query:

UPDATE users SET role = 'super_admin'
WHERE email = 'твой@email.com';
```

---

## ШАГ 7 — Засеять карту (первый запуск)

```bash
# В Railway PostgreSQL → Query:

# Проверь что мир создался:
SELECT * FROM worlds;

# Если тайлов нет, запусти через API:
curl -X POST https://dominion-backend.railway.app/api/v1/worlds/seed \
  -H "Authorization: Bearer ТВОй_JWT_ТОКЕН"
```

---

## Локальный запуск (для разработки)

```bash
# 1. Запусти БД
docker-compose up -d

# 2. Backend
cd backend
cp .env.example .env
# Отредактируй .env если нужно
npm install
npm run start:dev

# 3. Frontend (в другом терминале)
cd frontend
cp .env.example .env
npm install
npm run dev

# Открывай localhost:3000
```

---

## Бесплатные лимиты

| Сервис | Бесплатно | Достаточно для |
|--------|-----------|----------------|
| Railway | $5/мес кредитов | ~50-100 игроков |
| Vercel | Unlimited запросов | Любой трафик |
| Railway PostgreSQL | 1GB | ~500 игроков |
| Railway Redis | 256MB | ~1000 игроков |

**Когда вырастешь:**
- Hetzner VPS CX11: €3.79/мес — Docker + Nginx + всё сам
- Supabase: бесплатный PostgreSQL 500MB
- Upstash: бесплатный Redis 10K команд/день

---

## Мониторинг

Railway автоматически даёт:
- Логи в реальном времени
- Метрики CPU/RAM/Network
- Алерты при падении

Добавь в backend `.env`:
```env
# Опционально для error tracking
SENTRY_DSN=https://...@sentry.io/...
```

---

## Домен (опционально)

Vercel: Settings → Domains → Add `dominion-realms.com`
Railway: Settings → Networking → Custom Domain

---

## ✅ Чеклист перед запуском

- [ ] `init.sql` выполнен на Railway PostgreSQL
- [ ] Переменные окружения заполнены
- [ ] `FRONTEND_URL` совпадает с Vercel URL
- [ ] Первый аккаунт получил `super_admin`
- [ ] Открыл `https://dominion-realms.vercel.app` — работает форма входа
- [ ] Зарегистрировался — создалось поселение
- [ ] Dashboard показывает ресурсы

🏰 Готово — игра онлайн!
