import { readdir, unlink } from 'node:fs/promises';
import path from 'node:path';

// Next standalone copies loaded .env files independently of tracing exclusions.
// Runtime secrets must be injected by Docker, never distributed in the build.
const directory=path.resolve('.next/standalone');
let removed=0;
for(const entry of await readdir(directory,{withFileTypes:true})) {
  if(entry.isFile() && /^\.env(?:\.|$)/.test(entry.name)) {
    const filename=path.resolve(directory,entry.name);
    if(path.dirname(filename)!==directory)throw new Error('Invalid standalone environment path');
    await unlink(filename);removed++;
  }
}
console.log(`Standalone secret check passed (${removed} environment file${removed===1?'':'s'} removed).`);
