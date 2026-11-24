// Build a separate CrazyGames ZIP without changing the standalone deployment.
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {deflateRawSync} from 'node:zlib';
const root=resolve('public'),out=resolve(process.argv[2]||'dist');await mkdir(out,{recursive:true});
const table=Array.from({length:256},(_,i)=>{let n=i;for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function crc(b){let n=0xffffffff;for(const v of b)n=table[(n^v)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
async function files(dir){let a=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())a.push(...await files(p));else a.push(p);}return a;}
const data=[],central=[];let offset=0;
for(const p of (await files(root)).sort()){const path=relative(root,p).replaceAll('\\','/');if(path.startsWith('downloads/')||path.startsWith('_')||path==='release.json')continue;
let raw=await readFile(p);if(path==='index.html'){let html=raw.toString('utf8');html=html.replace('</head>','<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n</head>');raw=Buffer.from(html);}
const name=Buffer.from(path),compressed=deflateRawSync(raw),c=crc(raw),l=Buffer.alloc(30),d=Buffer.alloc(46);
l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt16LE(8,8);l.writeUInt32LE(c,14);l.writeUInt32LE(compressed.length,18);l.writeUInt32LE(raw.length,22);l.writeUInt16LE(name.length,26);
d.writeUInt32LE(0x02014b50);d.writeUInt16LE(20,4);d.writeUInt16LE(20,6);d.writeUInt16LE(8,10);d.writeUInt32LE(c,16);d.writeUInt32LE(compressed.length,20);d.writeUInt32LE(raw.length,24);d.writeUInt16LE(name.length,28);d.writeUInt32LE(offset,42);
data.push(l,name,compressed);central.push(d,name);offset+=l.length+name.length+compressed.length;}
const dir=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(central.length/2,8);end.writeUInt16LE(central.length/2,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);
const zip=Buffer.concat([...data,dir,end]);await writeFile(join(out,'upjump-crazygames.zip'),zip);if(zip.length>20*1024*1024||central.length/2>1500)throw Error('Portal bundle budget exceeded');console.log('CrazyGames ZIP:',zip.length,'bytes');
