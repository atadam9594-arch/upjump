import { mkdir, readFile, writeFile } from 'node:fs/promises';

const source = new URL('../public/index.html', import.meta.url);
const output = new URL('../dist/crazygames/', import.meta.url);
const html = await readFile(source, 'utf8');
const marker = '/* CRAZYGAMES_BUILD */ false';
if (!html.includes(marker)) throw new Error('CrazyGames build marker missing');
await mkdir(output, { recursive: true });
await writeFile(new URL('index.html', output), html
  .replace(marker, '/* CRAZYGAMES_BUILD */ true')
  .replace(/\s*<button id="fullscreenBtn"[\s\S]*?<\/button>/, ''));
console.log('CrazyGames Basic Launch build ready in dist/crazygames/');
