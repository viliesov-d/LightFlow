/** A lightweight online-only entry page for the LightFlow API. */
const HTML = String.raw`<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#151c27">
  <title>LightFlow — графік відключень</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #0d1420; color:#f5f7fb; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height:100vh; padding: 40px 18px; }
    main { width: min(100%, 620px); margin: 0 auto; }
    .head {display:flex;align-items:center;gap:12px;margin-bottom:32px}
    .bolt {display:grid;place-items:center;width:44px;height:44px;border-radius:13px;background:#27354b;color:#f4d16d;font-size:25px}
    h1 { margin:0;font-size:22px;line-height:1.2;letter-spacing:-.04em }
    .sub { font-size:13px;color:#aab7cb;margin-top:5px }
    .card {border:1px solid #344253;border-radius:22px;padding:24px;background:#1c2736;box-shadow:0 16px 60px #0003}
    .kicker {font-size:13px;color:#aab7cb;margin-bottom:16px}
    .state {display:flex;align-items:center;gap:12px;margin-bottom:12px}
    .dot {width:15px;height:15px;border-radius:100%;background:#9aa7b7;box-shadow:0 0 0 5px #9aa7b71c;flex:none}
    .dot.on {background:#4bd7a0;box-shadow:0 0 0 5px #4bd7a028}
    .dot.off {background:#ff8e81;box-shadow:0 0 0 5px #ff8e8128}
    #status {font-size:26px;font-weight:750;letter-spacing:-.03em}
    .muted {font-size:13px;color:#aab7cb;line-height:1.6}
    h2 {margin:24px 0 12px;font-size:14px;font-weight:650}
    .timeline {display:flex;gap:2px;height:30px;background:#2c3a4b;border-radius:6px;overflow:hidden}
    .segment {flex:1;background:#55677d}
    .segment.on {background:#45be97}
    .segment.off {background:#e67972}
    .times {display:flex;justify-content:space-between;color:#9caabd;font-size:11px;margin-top:7px}
    .legend {display:flex;gap:16px;margin-top:13px;color:#aab7cb;font-size:12px}
    .swatch {width:10px;height:10px;border-radius:3px;display:inline-block;margin-right:5px}
    .footer {display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:22px;flex-wrap:wrap}
    button {color:#ffffff;border:1px solid #64778c;background:#25364a;border-radius:11px;padding:10px 14px;font:inherit;font-size:13px;cursor:pointer}
    a {color:#a5ccff;text-decoration:none}
    .links {display:flex;gap:16px;margin-top:22px;flex-wrap:wrap;font-size:13px}
    .notice {font-size:12px;color:#9aabc0;line-height:1.7;margin-top:22px}
  </style>
</head>
<body>
<main>
  <header class="head">
    <div class="bolt" aria-hidden="true">⚡</div>
    <div><h1>LightFlow</h1><div class="sub">Черкаська область · черга 1.1</div></div>
  </header>
  <section class="card" aria-live="polite">
    <div class="kicker">Стан електропостачання за графіком</div>
    <div class="state"><span id="dot" class="dot" aria-hidden="true"></span><span id="status">Перевіряємо…</span></div>
    <div id="details" class="muted">Отримуємо інформацію із сервера.</div>
    <h2>Графік на сьогодні</h2>
    <div id="timeline" class="timeline" aria-label="Графік відключень на 24 години"></div>
    <div class="times"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
    <div class="legend"><span><i class="swatch" style="background:#e67972"></i>Відключення</span><span><i class="swatch" style="background:#45be97"></i>За графіком зі світлом</span></div>
    <div class="footer"><span id="checked" class="muted">Немає підтвердженого оновлення</span><button id="reload" type="button">Оновити</button></div>
  </section>
  <div class="links"><a href="/api/v1/schedule">Дані API (JSON)</a><a href="/health">Стан сервера</a><a href="https://www.cherkasyoblenergo.com/media" rel="noopener noreferrer">Офіційне джерело</a></div>
  <p class="notice">LightFlow показує лише планові відключення, а не фактичну наявність електроенергії. Якщо підтверджені дані відсутні або застаріли, статус буде невідомим. Сайт працює тільки з інтернетом і не зберігає графіки на телефоні.</p>
</main>
<script>
(function () {
  const el = id => document.getElementById(id);
  const minutes = value => { const [h,m] = value.split(':').map(Number); return h*60+m; };
  function draw(outages) {
    const root = el('timeline');
    root.replaceChildren();
    for (let i=0;i<48;i++) {
      const start=i*30;
      const off=outages.some(x => start>=minutes(x.start) && start<minutes(x.end));
      const piece=document.createElement('span');
      piece.className='segment '+(off?'off':'on');
      piece.title=String(Math.floor(start/60)).padStart(2,'0')+':'+String(start%60).padStart(2,'0');
      root.append(piece);
    }
  }
  function unknown(message) {
    el('status').textContent='Статус невідомий';
    el('dot').className='dot';
    el('details').textContent=message;
    el('timeline').replaceChildren();
    el('checked').textContent='Немає актуального графіка';
  }
  async function load() {
    el('reload').disabled=true;
    try {
      const response=await fetch('/api/v1/schedule', {cache:'no-store'});
      if(!response.ok) throw Error('Сервер тимчасово недоступний');
      const data=await response.json();
      if(data.kind!=='schedule' || !Array.isArray(data.outages) ||
         (data.state!=='scheduled_on' && data.state!=='scheduled_off')) {
        unknown('Немає перевіреного графіка. Спробуйте оновити сторінку пізніше.');
        return;
      }
      const off=data.state==='scheduled_off';
      el('status').textContent=off?'Відключення за графіком':'Світло має бути';
      el('dot').className='dot '+(off?'off':'on');
      el('details').textContent=(data.nextChangeLocal?'Наступна зміна о '+data.nextChangeLocal+'. ':'')+'Це розклад, не підтверджений фактичний стан.';
      const formatter=new Intl.DateTimeFormat('uk-UA',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Kyiv'});
      el('checked').textContent=data.checkedAt?'Перевірено: '+formatter.format(new Date(data.checkedAt)):'Невідомий час перевірки';
      draw(data.outages);
    } catch {
      unknown('Не вдалося з’єднатися із сервером. Перевірте інтернет.');
    } finally { el('reload').disabled=false; }
  }
  el('reload').addEventListener('click',load);
  load();
  setInterval(load, 5*60*1000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
})();
</script>
</body>
</html>`;

export function landingResponse() {
  return new Response(HTML, {status: 200, headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  }});
}
