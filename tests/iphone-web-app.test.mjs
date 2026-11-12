import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {createWorker} from '../src/worker.mjs';
import {appManifest} from '../src/app-assets.mjs';

test('iPhone LightFlow web app has a standalone manifest and a PNG touch icon',async()=>{
  const worker=createWorker();
  const manifestRes=await worker.fetch(new Request('https://lightflow.test/manifest.webmanifest'),{});
  assert.equal(manifestRes.status,200);
  assert.match(manifestRes.headers.get('content-type'),/application\/manifest\+json/);
  const manifest=await manifestRes.json();
  assert.equal(manifest.name,'LightFlow');
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.start_url,'/');
  assert.equal(manifest.scope,'/');
  assert.equal(manifest.icons.length,1);
  assert.equal(manifest.icons[0].src,'/apple-touch-icon.png');

  const icon=await worker.fetch(new Request('https://lightflow.test/apple-touch-icon.png'),{});
  assert.equal(icon.status,200);
  assert.equal(icon.headers.get('content-type'),'image/png');
  const bytes=Buffer.from(await icon.arrayBuffer());
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16),192);
  assert.equal(bytes.readUInt32BE(20),192);
  const parts=[];
  let offset=8;
  while(offset<bytes.length){
    const size=bytes.readUInt32BE(offset);
    const kind=bytes.toString('ascii',offset+4,offset+8);
    if(kind==='IDAT')parts.push(bytes.subarray(offset+8,offset+8+size));
    offset+=12+size;
    if(kind==='IEND')break;
  }
  const raw=inflateSync(Buffer.concat(parts));
  assert.ok(raw.length>192*192*3,'Icon must decompress to actual pixels');
});

test('homepage is marked as an iPhone web app without offline schedule caching',async()=>{
  const worker=createWorker();
  const resp=await worker.fetch(new Request('https://lightflow.test/'),{});
  const html=await resp.text();
  assert.match(html,/<link rel="manifest" href="\/manifest\.webmanifest">/);
  assert.match(html,/<link rel="apple-touch-icon" href="\/apple-touch-icon\.png">/);
  assert.match(html,/<meta name="apple-mobile-web-app-capable" content="yes">/);
  assert.match(html,/<meta name="apple-mobile-web-app-title" content="LightFlow">/);
  assert.match(html,/круговий графік|Круговий графік/);
  assert.doesNotMatch(html,/navigator\.serviceWorker\.register/);
  assert.equal(appManifest.icons[0].sizes,'192x192');
});

test('static iOS assets do not depend on SCHEDULES storage',async()=>{
  const worker=createWorker();
  for(const uri of ['/manifest.webmanifest','/apple-touch-icon.png']){
    const r=await worker.fetch(new Request('https://lightflow.test'+uri),{});
    assert.equal(r.status,200);
    assert.equal(r.headers.get('x-content-type-options'),'nosniff');
  }
  const api=await worker.fetch(new Request('https://lightflow.test/api/v1/schedule'),{});
  assert.equal(api.status,503);
});
