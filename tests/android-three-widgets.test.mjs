import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root='widgets/android/app/src/main/';
const art=readFileSync(root+'java/com/lightflow/widgets/WidgetArt.kt','utf8');
const controller=readFileSync(root+'java/com/lightflow/widgets/LightFlowWidgets.kt','utf8');
const manifest=readFileSync(root+'AndroidManifest.xml','utf8');

test('three widgets are bulb, compact circular dial and full-size circular dial',()=>{
  assert.match(art,/enum class Kind \{ BULB, COMPACT_DIAL, DIAL \}/);
  assert.doesNotMatch(art,/CAROUSEL|private fun strip\(/);
  assert.match(controller,/Kind\.COMPACT_DIAL, CompactDialWidgetProvider::class\.java/);
  assert.match(controller,/Kind\.BULB, SmallWidgetProvider::class\.java/);
  assert.match(controller,/Kind\.DIAL, LargeWidgetProvider::class\.java/);
  assert.doesNotMatch(controller,/MediumWidgetProvider|widget_medium/);
  assert.doesNotMatch(manifest,/MediumWidgetProvider|widget_medium_info/);
  assert.match(manifest,/CompactDialWidgetProvider/);
});

test('both circular layouts share exactly the same 24-hour schedule and phone-time hand',()=>{
  assert.match(art,/private fun dial\(c:Canvas,w:Float,h:Float,data:Schedule\?,now:ZonedDateTime,compact:Boolean=false\)/);
  assert.match(art,/Kind\.COMPACT_DIAL->dial\(canvas,size\.first\.toFloat\(\),size\.second\.toFloat\(\),schedule,now,compact=true\)/);
  assert.match(art,/Kind\.DIAL->dial\(canvas,size\.first\.toFloat\(\),size\.second\.toFloat\(\),schedule,now\)/);
  assert.match(art,/for\(hour in 0\.\.23\)/);
  assert.match(art,/c\.drawArc\(bounds,-90f\+start\/4f,\(end-start\)\/4f/);
  assert.match(art,/val elapsed=now\.hour\*3600\+now\.minute\*60\+now\.second/);
  assert.match(art,/elapsed\/86400\.0\*360\.0/);
  assert.match(art,/c\.drawCircle\(px,py,side\*\.011f,paint\(text\)\)/);
});

test('compact dial scales labels to 2x2 while preserving all 24 colored intervals',()=>{
  assert.match(art,/Kind\.COMPACT_DIAL->430 to 430/);
  assert.match(art,/Kind\.DIAL->630 to 630/);
  assert.match(art,/val radius=side\*\(if\(compact\) \.330f else \.344f\)/);
  assert.match(art,/hour % 3 == 0/);
  assert.match(art,/if\(compact\) \{/);
  assert.match(art,/DateTimeFormatter\.ofPattern\("d MMM",Locale\("uk"\)\)/);
  assert.match(art,/write\(c,"1\.1",cx,cy\+side\*\.014f,side\*\.145f/);
  assert.match(art,/write\(c,shortStatus,cx,cy\+side\*\.106f/);
  assert.match(art,/write\(c,"за графіком",cx,cy\+side\*\.152f/);
  assert.match(art,/shortStatus=when\(current\?\.off\)/);
  const meta=readFileSync(root+'res/xml/widget_compact_info.xml','utf8');
  assert.match(meta,/android:targetCellWidth="2"/);
  assert.match(meta,/android:targetCellHeight="2"/);
  assert.match(meta,/android:initialLayout="@layout\/widget_compact"/);
});

test('small bulb and full circular widget remain available',()=>{
  assert.match(art,/Kind\.BULB->340 to 340/);
  assert.match(art,/state\.start\+"–"\+state\.end/);
  assert.match(art,/DateTimeFormatter\.ofPattern\("d MMMM",Locale\("uk"\)\)/);
  assert.match(art,/write\(c,"ПІДЧЕРГА"/);
});

test('transparent art, regular refresh and best-effort clock updates are unchanged',()=>{
  assert.match(art,/Bitmap\.createBitmap\(size\.first,size\.second,Bitmap\.Config\.ARGB_8888\)/);
  assert.doesNotMatch(art,/\bbase\(canvas/);
  assert.match(controller,/setImageViewBitmap\(config\.artwork, bitmap\)/);
  assert.match(controller,/WidgetClock\.schedule\(applicationContext\)/);
  assert.match(controller,/PeriodicWorkRequestBuilder<RefreshWorker>\(15, TimeUnit\.MINUTES\)/);
  assert.match(controller,/setAndAllowWhileIdle\(/);
  assert.match(controller,/setViewVisibility\(config\.artwork, View\.INVISIBLE\)/);
  assert.match(controller,/setViewVisibility\(config\.artwork, View\.VISIBLE\)/);
  assert.doesNotMatch(controller,/SharedPreferences|FileManager|DataStore|SQLiteDatabase/);
});

test('new installation version',()=>{
  const gradle=readFileSync('widgets/android/app/build.gradle.kts','utf8');
  assert.match(gradle,/versionName = "0\.5\.1"/);
  assert.match(gradle,/versionCode = 9/);
});
