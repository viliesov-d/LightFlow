import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Home-screen launchers may only inflate classes supported by Android RemoteViews.
const ALLOWED=new Set([
  'AdapterViewFlipper','FrameLayout','GridLayout','GridView',
  'LinearLayout','ListView','RelativeLayout','StackView','ViewFlipper',
  'AnalogClock','Button','Chronometer','ImageButton','ImageView',
  'ProgressBar','TextClock','TextView'
]);
const ROOT='widgets/android/app/src/main/res/';
const sizes=['small','medium','large'];

for(const name of sizes) {
  test(name+' widget has safe, minimal Android RemoteViews layout',()=>{
    const xml=readFileSync(ROOT+'layout/widget_'+name+'.xml','utf8');
    const tags=[...xml.matchAll(/<([A-Z][a-zA-Z0-9._]*)\b/g)].map(m=>m[1]);
    assert.ok(tags.length>0);
    for(const tag of tags) assert.ok(ALLOWED.has(tag),
      tag+' is not supported by Android RemoteViews in '+name);
    for(const id of [name+'Root',name+'Artwork',name+'Loading',
                     name+'Ripple',name+'LoadingText']) {
      assert.ok(xml.includes('android:id="@+id/'+id+'"'),id+' missing');
    }
    assert.match(xml,/android:visibility="gone"/);
    assert.doesNotMatch(xml,/<Space\b/);
  });
  test(name+' widget is listed in AppWidgetManifest',()=>{
    const metadata=readFileSync(ROOT+'xml/widget_'+name+'_info.xml','utf8');
    assert.ok(metadata.includes('android:initialLayout="@layout/widget_'+name+'"'));
  });
}

test('the 3 named providers are registered and use different supported layouts',()=>{
  const manifest=readFileSync('widgets/android/app/src/main/AndroidManifest.xml','utf8');
  for(const type of ['Small','Medium','Large']) {
    assert.ok(manifest.includes('android:name=".'+type+'WidgetProvider"'));
  }
  assert.match(manifest,/android:name="\.WidgetClockReceiver"/);
  assert.match(manifest,/android:name="\.RefreshTapReceiver"/);
});
