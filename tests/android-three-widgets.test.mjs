import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const base='widgets/android/app/src/main/';
const art=readFileSync(base+'java/com/lightflow/widgets/WidgetArt.kt','utf8');
const widgets=readFileSync(base+'java/com/lightflow/widgets/LightFlowWidgets.kt','utf8');

test('all three branded widgets are drawn as bounded Canvas bitmaps',()=>{
  for(const feature of ['Kind.BULB','Kind.CAROUSEL','Kind.DIAL'])
    assert.ok(art.includes(feature));
  assert.match(art,/Bitmap\.createBitmap\(size\.first,size\.second,Bitmap\.Config\.ARGB_8888\)/);
  assert.match(art,/340 to 340/);
  assert.match(art,/840 to 260/);
  assert.match(art,/630 to 630/);
  assert.match(widgets,/setImageViewBitmap\(config\.artwork, bitmap\)/);
  assert.doesNotMatch(widgets,/R\.id\.period\d+|R\.id\.smallStatus|R\.id\.largeStatus/);
});

test('small widget has only a bulb and the current state interval',()=>{
  const small=art.split('private fun bulb(')[1].split('private fun strip(')[0];
  assert.match(small,/val lightning=Path\(\)/);
  assert.match(small,/state\.start\+"–"\+state\.end/);
  assert.doesNotMatch(small,/LightFlow|Черкаська|Відключення|Світло за графіком/);
});

test('carousel segments occupy 66 percent and shift with phone-time progress',()=>{
  const medium=art.split('private fun strip(')[1].split('private fun dial(')[0];
  assert.match(medium,/val segmentWidth=w\*\.66f/);
  assert.match(medium,/now\.hour\*60f\+now\.minute\+now\.second\/60f/);
  assert.match(medium,/left=center-progress\*segmentWidth/);
  assert.match(medium,/val x=left\+\(index-i\)\*\(segmentWidth\+gap\)/);
  assert.match(medium,/moveTo\(center,h\*\.82f\)/);
});

test('24-hour dial draws each hour and uses seconds from phone time for pointer',()=>{
  const large=art.split('private fun dial(')[1].split('fun draw(')[0];
  assert.match(large,/for\(hour in 0\.\.23\)/);
  assert.match(large,/val elapsed=now\.hour\*3600\+now\.minute\*60\+now\.second/);
  assert.match(large,/elapsed\/86400\.0\*360\.0/);
  assert.match(large,/DateTimeFormatter\.ofPattern\("d MMMM",Locale\("uk"\)\)/);
  assert.match(large,/\"1\.1\"/);
  assert.match(large,/when\(current\?\.off\)/);
});

test('clock pulses are inexact and do not request exact alarm privileges',()=>{
  const manifest=readFileSync(base+'AndroidManifest.xml','utf8');
  assert.match(widgets,/setAndAllowWhileIdle\(/);
  assert.match(widgets,/5 \* 60 \* 1000L/);
  assert.match(widgets,/WidgetClock\.cancel\(context\)/);
  assert.match(widgets,/widgetId: Int/);
  assert.doesNotMatch(manifest,/SCHEDULE_EXACT_ALARM|USE_EXACT_ALARM/);
  assert.doesNotMatch(widgets,/SharedPreferences|DataStore|FileManager|SQLiteDatabase/);
});

test('Android version is bumped for 3-widget release',()=>{
  const gradle=readFileSync('widgets/android/app/build.gradle.kts','utf8');
  assert.match(gradle,/versionName = "0\.3\.0"/);
  assert.match(gradle,/versionCode = 4/);
});
