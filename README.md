# LightFlow ⚡

Безкоштовні онлайн-віджети графіка відключень електроенергії. Починаємо з **Черкаської області, черги 1.1**.

- **Маленький віджет:** статус світла **за опублікованим графіком**.
- **Великий віджет:** статус + часові інтервали на добу.
- **Платформи:** Android (нативний APK), iPhone (Scriptable).
- **Без офлайн-режиму:** телефони завжди звертаються до API; Cloudflare KV — лише серверне сховище.
- **Вартість:** безкоштовні тарифи в межах квот, без платного Firebase та Apple Developer Program.

> ⚠️ Графік не підтверджує фактичної наявності електроенергії. Офіційне джерело: [АТ «Черкасиобленерго»](https://www.cherkasyoblenergo.com/media). LightFlow не є офіційним продуктом компанії.

## Стан розробки

- ✅ A1: парсер публікацій ГПВ, вибір найновішої редакції, перевірка інтервалів.
- ✅ A2 (код): Cloudflare Worker з Cron Trigger, KV, публічним API, обробкою помилок та тестами.
- ⏳ A2 (розгортання): потрібне створення безкоштовного Cloudflare-акаунта, KV namespace і перевірка доступу до офіційного сайту з інфраструктури Cloudflare.
- ⏳ B/C: сайт та віджети Android/iPhone.

## API v1

Після розгортання:
- `GET /health` — технічний стан сервера.
- `GET /api/v1/schedule` — графік на сьогодні (часова зона `Europe/Kyiv`).
- `GET /api/v1/schedule?date=YYYY-MM-DD` — сьогодні або завтра.
- `OPTIONS` — CORS для вебсайту та Scriptable.

Приклад перевіреної відповіді **з демонстраційним статусом**:

```json
{
  "region": "cherkasy",
  "queue": "1.1",
  "date": "2026-11-10",
  "timezone": "Europe/Kyiv",
  "kind": "schedule",
  "state": "scheduled_off",
  "checkedAt": "2026-11-10T09:30:00.000Z",
  "publishedAtLocal": "2026-11-09T23:06:00",
  "sourceUrl": "https://www.cherkasyoblenergo.com/media/onovleno-hrafik-pohodynnykh-vidklyuchen-hpv-na-10-lystopada",
  "outages": [
    {"start":"00:00","end":"02:00"},
    {"start":"04:00","end":"08:00"},
    {"start":"10:00","end":"14:00"},
    {"start":"16:00","end":"20:00"},
    {"start":"22:00","end":"24:00"}
  ],
  "totalOutageMinutes": 960,
  "nextChangeLocal": "14:00",
  "reason": null
}
```

Значення `state`: `scheduled_on`, `scheduled_off`, `future_schedule`, `unknown`. Якщо джерело недоступне понад 20 хвилин або оновлену публікацію не вдається перевірити, API повертає `unknown` **без інтервалів**.

## Розгортання

Повна інструкція: [docs/cloudflare-setup.md](docs/cloudflare-setup.md).

```bash
npm install
npm test
node scripts/probe-source.mjs
npx wrangler login
npx wrangler kv namespace create SCHEDULES
# Вставити ID namespace у wrangler.jsonc
npx wrangler deploy
```

Cron `*/5 * * * *` щоп'ять хвилин читає список останніх публікацій і валідує графіки для поточної та наступної дати; самі телефони не запитують офіційний сайт. Перед використанням необхідно перевірити правила автоматичного отримання даних на джерелі.

Тести засновані на контрольованих HTML-прикладах. Додаткова необов'язкова CI-діагностика перевіряє доступ до актуального сайту.
