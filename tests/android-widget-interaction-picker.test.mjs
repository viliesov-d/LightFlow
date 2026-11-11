import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

const root='widgets/android/app/src/main/';
const source=readFileSync(root+'java/com/lightflow/widgets/LightFlowWidgets.kt','utf8');
const manifest=readFileSync(root+'AndroidManifest.xml','utf8');

test('single tap waits longer for slow launchers, then performs one refresh',()=>{
  assert.match(source,/DOUBLE_TAP_WINDOW_MS = 700L/);
  assert.match(source,/LATE_DOUBLE_TAP_MS = 1250L/);
  assert.match(source,/mutableMapOf<Int, TapSession>/);
  assert.match(source,/val now = SystemClock\.elapsedRealtime\(\)/);
  assert.match(source,/sessions\[widgetId\] = session/);
  assert.match(source,/delay\(session, DOUBLE_TAP_WINDOW_MS\)/);
  assert.match(source,/Renderer\.loadingFrame\(context, widgetId, 0\)/);
  assert.match(source,/for \(step in 1\.\.7\)/);
  assert.match(source,/step \* 105L/);
  assert.match(source,/delay\(session, 780L\)/);
  assert.match(source,/RefreshWorker\.refresh\(context, userInitiated = true\)/);
});

test('two taps on same widget cancel all animation and work before opening site',()=>{
  assert.match(source,/now - prev\.startedAt <= LATE_DOUBLE_TAP_MS/);
  assert.match(source,/sessions\.remove\(widgetId\)/);
  assert.match(source,/cancel\(prev\)/);
  assert.match(source,/session\.callbacks\.forEach\(main::removeCallbacks\)/);
  assert.match(source,/Renderer\.cancelLoading\(context, widgetId\)/);
  assert.match(source,/setOnClickPendingIntent\(config\.loading, refreshIntent\(context, widgetId\)\)/);
  assert.match(source,/setOnClickPendingIntent\(config\.ripple, refreshIntent\(context, widgetId\)\)/);
  assert.match(source,/setOnClickPendingIntent\(config\.label, refreshIntent\(context, widgetId\)\)/);
  assert.match(source,/setViewVisibility\(config\.artwork, View\.VISIBLE\)/);
  assert.match(source,/setViewVisibility\(config\.loading, View\.GONE\)/);
  assert.match(source,/Intent\(Intent\.ACTION_VIEW, Uri\.parse\(SITE\)\)/);
  assert.match(source,/PendingIntent\.getActivity\(/);
  assert.match(source,/ActivityOptions\.MODE_BACKGROUND_ACTIVITY_START_ALLOWED/);
  assert.match(source,/launch\.send\(context, 0, null, null, null, null, options\.toBundle\(\)\)/);
  assert.match(source,/WidgetTapGestures\.handle\(context\.applicationContext, widgetId, goAsync\(\)\)/);
  assert.doesNotMatch(source,/siteIntent\(/);
});

const widgets=[
  {name:'small',type:'Small',icon:'bulb',preview:'small',label:'Лампочка'},
  {name:'compact',type:'CompactDial',icon:'compact',preview:'compact',label:'Міні-графік'},
  {name:'large',type:'Large',icon:'large',preview:'large',label:'Великий графік'}
];

for(const {name,type,icon,preview,label} of widgets) {
  test(name+' has unique labeled icon and both picker preview formats',()=>{
    const receiver=new RegExp('android:name="\\.'+type+'WidgetProvider"[^>]*>');
    const match=manifest.match(receiver);
    assert.ok(match,'Missing provider '+type);
    assert.ok(match[0].includes('android:icon="@drawable/icon_widget_'+icon+'"'));
    assert.ok(match[0].includes(label));

    const metadata=readFileSync(root+'res/xml/widget_'+name+'_info.xml','utf8');
    assert.ok(metadata.includes('android:initialLayout="@layout/widget_'+name+'"'));
    assert.ok(metadata.includes('android:previewLayout="@layout/preview_widget_'+preview+'"'));
    assert.ok(metadata.includes('android:previewImage="@drawable/icon_widget_'+icon+'"'));

    const iconXml=readFileSync(root+'res/drawable/icon_widget_'+icon+'.xml','utf8');
    assert.match(iconXml,/<vector\b/);
    assert.match(iconXml,/android:pathData=/);
    assert.match(iconXml,/android:fillColor=/);

    const previewXml=readFileSync(root+'res/layout/preview_widget_'+preview+'.xml','utf8');
    assert.match(previewXml,/<FrameLayout\b/);
    assert.match(previewXml,/<ImageView\b/);
    assert.ok(previewXml.includes('android:src="@drawable/icon_widget_'+icon+'"'));
  });
}

test('horizontal widget is absent from all active picker resources',()=>{
  assert.doesNotMatch(manifest,/MediumWidgetProvider|widget_medium_info|карусель/);
  assert.doesNotMatch(source,/MediumWidgetProvider|R\.layout\.widget_medium/);
  assert.equal(existsSync(root+'res/xml/widget_medium_info.xml'),false);
  assert.equal(existsSync(root+'res/layout/widget_medium.xml'),false);
  assert.equal((manifest.match(/android\.appwidget\.provider/g)||[]).length,3);
});

test('version updated to distinguish new install from stale launcher records',()=>{
  const gradle=readFileSync('widgets/android/app/build.gradle.kts','utf8');
  assert.match(gradle,/versionName = "0\.5\.2"/);
  assert.match(gradle,/versionCode = 10/);
});
