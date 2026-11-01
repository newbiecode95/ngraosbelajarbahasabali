import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile,writeFile } from 'node:fs/promises';

const base=process.env.PROBE_URL||'http://localhost:3000';
const manifest=JSON.parse(await readFile('docs/background-music/assets.json','utf8'));
const assets=[];
for(const asset of manifest.assets){
  const response=await fetch(base+asset.path);
  assert.equal(response.status,200);
  const bytes=Buffer.from(await response.arrayBuffer());
  const hash=createHash('sha256').update(bytes).digest('hex');
  assert.equal(bytes.length,asset.bytes);assert.equal(hash,asset.sha256);
  const cacheControl=response.headers.get('cache-control');
  assert(cacheControl.includes('max-age=31536000')&&cacheControl.includes('immutable'));
  const partial=await fetch(base+asset.path,{headers:{Range:'bytes=0-63'}});
  assert.equal(partial.status,206);assert.equal((await partial.arrayBuffer()).byteLength,64);
  assert.equal(partial.headers.get('content-range'),`bytes 0-63/${asset.bytes}`);
  assets.push({path:asset.path,bytes:bytes.length,sha256:hash,contentType:response.headers.get('content-type'),cacheControl,rangeStatus:partial.status});
}
const health=await (await fetch(base+'/api/health')).json();assert.equal(health.status,'ok');
await writeFile('docs/background-music/http-assets.json',JSON.stringify({base,assets,health},null,2)+'\n');
console.log(JSON.stringify({verified:true,base,assets:assets.length,byteRangeStreaming:true,immutableCache:true}));
