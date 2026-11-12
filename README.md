# LightFlow ⚡

Безкоштовні онлайн-віджети графіка відключень електроенергії. Починаємо з **Черкаської області, черги 1.1**.

- **Android (малий):** лампочка та години поточного інтервалу.
- **Android (міні-графік):** малий круговий графік 2×2, як великий, зі збереженням 24 часових секторів і читабельними позначками.
- **Android (великий):** 24-годинний круговий графік, дата, підчерга 1.1 та стрілка часу.
- **iPhone:** три віджети через Scriptable (лампочка, міні-графік і велике 24-годинне коло) та LightFlow як вебзастосунок з іконкою на головному екрані.
- **Платформи:** Android (нативний APK), iPhone (безкоштовні Scriptable-віджети + Safari Add to Home Screen; без IPA та перепідписування).
- **Прозорі Android-віджети:** без фонових прямокутників і рамок, з підписами та графіками поверх шпалер.
- **Без офлайн-режиму:** телефони завжди звертаються до API; Cloudflare KV — лише серверне сховище.
- **Вартість:** безкоштовні тарифи в межах квот, без платного Firebase та Apple Developer Program.

> ⚠️ Графік не підтверджує фактичної наявності електроенергії. Офіційне джерело: [АТ «Черкасиобленерго»](https://www.cherkasyoblenergo.com/media). LightFlow не є офіційним продуктом компанії.

## Стан розробки

- ✅ A1: парсер офіційних публікацій ГПВ та перевірка інтервалів.
- ✅ A2: Cloudflare Worker, Cron кожні 4 хв, KV та JSON API.
- ✅ B: онлайн-сайт із круговим 24-годинним графіком, рухомою стрілкою часу та точним списком відключень.
- ✅ C (код): три віджети iPhone через Scriptable та вебзастосунок з власною іконкою; три нативні Android-віджети на Kotlin (версія 0.5.2: лампочка, малий і великий кругові графіки; виправлено подвійний тап).
- ✅ C (збірка): Android APK успішно зібрано GitHub Actions.
- ⏳ D: перевірити три Scriptable-віджети та вебзастосунок на реальному iPhone; на Android — одинарне/подвійне натискання, меню віджетів і фонове оновлення.

**Сайт:** https://lightflow-api.lightflow-viliesov.workers.dev/

**iPhone:** [Інструкція Scriptable](widgets/ios/README.md) · [код скрипта](widgets/ios/LightFlow.js).

**Android:** [Інструкція встановлення](widgets/android/README.md) · [збірки APK](https://github.com/viliesov-d/LightFlow/actions/workflows/android-apk.yml).

> На віджетах відображається **плановий** стан. ОС можуть затримувати оновлення та тимчасово показувати попереднє відображення. Сам LightFlow не зберігає графіки локально в телефоні.

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

## Розгортання або оновлення

Cloudflare Worker уже розгорнуто. Для відтворення налаштування дивись: [docs/cloudflare-setup.md](docs/cloudflare-setup.md).

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
