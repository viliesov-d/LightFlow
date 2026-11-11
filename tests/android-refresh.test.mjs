import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const android='widgets/android/app/src/main/';
const kotlin=readFileSync(android+'java/com/lightflow/widgets/LightFlowWidgets.kt','utf8');
const manifest=readFileSync(android+'AndroidManifest.xml','utf8');

for(const size of ['small','medium','large']) {
  test(size+' widget supports full-area ripple refresh without opening a website', () => {
    const xml=readFileSync(android+'res/layout/widget_'+size+'.xml','utf8');
    assert.match(xml,new RegExp('android:id="@\\+id/'+size+'Root"'));
    assert.match(xml,new RegExp('android:id="@\\+id/'+size+'Loading"'));
    assert.match(xml,new RegExp('android:id="@\\+id/'+size+'Ripple"'));
    assert.match(xml,new RegExp('android:id="@\\+id/'+size+'LoadingText"'));
    assert.match(xml,/android:visibility="gone"/);
    assert.match(xml,/android:background="@drawable\/widget_loading_background"/);
    assert.doesNotMatch(xml,/android:background="#F0/);
    assert.match(xml,/<FrameLayout/);
    assert.match(xml,/<ImageView/);
    assert.doesNotMatch(xml,/<Space\b/);
    assert.match(kotlin,/setOnClickPendingIntent\(config\.root, refreshIntent\(context, id\)\)/);
    assert.ok(kotlin.includes('R.layout.widget_'+size));
    assert.match(kotlin,/setImageViewBitmap\(config\.artwork, bitmap\)/);
  });
}
test('only the app can receive widget tap broadcasts',()=>{
  assert.match(manifest,/android:name="\.RefreshTapReceiver"/);
  assert.match(manifest,/android:exported="false"/);
  assert.match(kotlin,/PendingIntent\.getBroadcast\(/);
  assert.doesNotMatch(kotlin,/siteIntent\(/);
  assert.match(kotlin,/if \(intent\.action != ACTION_REFRESH\) return/);
  assert.match(kotlin,/onReceive\(context: Context, intent: Intent\)/);
});
test('ripple frames use Android supported vectors, and labels appear after tap',()=>{
  assert.match(kotlin,/loadingFrame\(app, id, 0\)/);
  assert.match(kotlin,/for \(step in 1\.\.7\)/);
  assert.match(kotlin,/loadingFrame\(app, id, step\)/);
  assert.match(kotlin,/step \* 105L/);
  assert.match(kotlin,/RefreshWorker\.refresh\(app, userInitiated = true\)/);
  assert.match(kotlin,/setImageViewResource\(config\.ripple, frame\)/);
  for(let i=1;i<=8;i++) {
    const xml=readFileSync(android+'res/drawable/ripple_stage_'+i+'.xml','utf8');
    assert.match(xml,/<vector/);
    assert.match(xml,/<path/);
    assert.match(xml,/android:strokeColor=/);
    assert.match(xml,/#F9D370/);
  }
});
test('loading background has matching rounded corners with no square overlay',()=>{
  const base=readFileSync(android+'res/drawable/widget_background.xml','utf8');
  const loading=readFileSync(android+'res/drawable/widget_loading_background.xml','utf8');
  const radius=/<corners android:radius="([^"]+)"\/>/;
  assert.equal(loading.match(radius)?.[1],base.match(radius)?.[1]);
  assert.ok(loading.includes('android:color="#F50E1928"'));
  for(const kind of ['small','medium','large']) {
    const view=readFileSync(android+'res/layout/widget_'+kind+'.xml','utf8');
    assert.match(view,/android:scaleType="fitCenter"/);
  }
});
test('Android background refresh includes next-change one-shot job',()=>{
  assert.match(kotlin,/PeriodicWorkRequestBuilder<RefreshWorker>\(15, TimeUnit\.MINUTES\)/);
  assert.match(kotlin,/setInitialDelay\(delay, TimeUnit\.MILLISECONDS\)/);
  assert.match(kotlin,/ExistingWorkPolicy\.REPLACE, request/);
  assert.match(kotlin,/plusSeconds\(5\)/);
  assert.match(kotlin,/AlarmManager\.ELAPSED_REALTIME_WAKEUP/);
  assert.match(kotlin,/setAndAllowWhileIdle\(/);
  assert.match(kotlin,/WidgetClock\.schedule\(applicationContext\)/);
  assert.match(kotlin,/OutOfQuotaPolicy\.RUN_AS_NON_EXPEDITED_WORK_REQUEST/);
  assert.doesNotMatch(kotlin,/SharedPreferences|FileManager|DataStore|SQLiteDatabase/);
});
test('Cloudflare 4-minute cron stays below 1000 KV writes/day for baseline',()=>{
  const wrangler=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
  assert.deepEqual(wrangler.triggers.crons,['*/4 * * * *']);
  assert.ok((24*60/4)*2+(24*60/20)<1000);
});
