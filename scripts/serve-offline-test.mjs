// Local acceptance-test fixture, never part of the static deployment.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('out'),port=Number(process.env.OFFLINE_TEST_PORT??3200);
let mode='original';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/__test__/worker-mode'&&req.method==='POST'){
   mode=url.searchParams.get('mode')??'original';res.writeHead(204);res.end();return;
  }
  const local=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!local.startsWith(root+path.sep)&&local!==root){res.writeHead(403);res.end();return;}
  let file=local;
  if((await stat(file)).isDirectory())file=path.join(file,'index.html');
  let body=await readFile(file);
  if(url.pathname==='/sw.js'&&mode!=='original'){
   let source=body.toString().replace(/const CACHE_NAME = (.*);/,(_,name)=>'const CACHE_NAME = '+JSON.stringify(JSON.parse(name)+'-'+mode)+';');
   if(mode==='fail')source=source.replace("self.addEventListener('install'","ASSETS.push(BASE+'/missing-for-test.js');\nself.addEventListener('install'");
   body=Buffer.from(source);
  }
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Offline test app: http://127.0.0.1:${port}`));
