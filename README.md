# 🏰 Dominion Realms — Complete Game v1.0

Браузерная MMO-стратегия в реальном времени.
**Этап 6 из 6 — Финальная сборка.**

---

## 🚀 Быстрый старт

```bash
# Локально
docker-compose up -d
cd backend && npm install && npm run start:dev
cd frontend && npm install && npm run dev
# → http://localhost:3000
```

**Деплой онлайн → [deploy/DEPLOY.md](deploy/DEPLOY.md)**

---

## Что реализовано

| Система | Статус |
|---------|--------|
| Auth (JWT + refresh tokens) | ✅ |
| Поселения + специализация | ✅ |
| Ресурсы + тик каждую минуту | ✅ |
| 14 зданий + очередь строительства | ✅ |
| 11 типов войск + обучение | ✅ |
| Движение армий с таймерами | ✅ |
| Боевая система с формулой | ✅ |
| Разведка + контрразведка | ✅ |
| Захват поселений | ✅ |
| Карта мира (Canvas, drag, zoom) | ✅ |
| Отчёты о боях и разведке | ✅ |
| Исследования (tech tree) | ✅ |
| Альянсы + роли + дипломатия | ✅ |
| Чат WebSocket (глобальный + альянс) | ✅ |
| Личные сообщения | ✅ |
| Рейтинги (4 категории) | ✅ |
| Квесты (tutorial / daily / long-term) | ✅ |
| Достижения (20+, 4 редкости) | ✅ |
| События мира (8 типов) | ✅ |
| Рынок ресурсов | ✅ |
| Сезонная система | ✅ |
| Уведомления | ✅ |
| Админ-панель | ✅ |
| PWA manifest | ✅ |
| Деплой Railway + Vercel | ✅ |

---

## Стек

- **Backend**: NestJS + TypeScript + PostgreSQL + Redis + BullMQ
- **Frontend**: Next.js 14 + React + Zustand + Tailwind
- **Realtime**: Socket.IO
- **Deploy**: Railway + Vercel

---

*Dominion Realms © 2024 — Все этапы завершены ✅*
