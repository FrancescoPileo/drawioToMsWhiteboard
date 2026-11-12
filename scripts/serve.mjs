import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT || 4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.drawio':'application/xml','.md':'text/plain; charset=utf-8','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const filename=path.resolve(root,relative||'index.html');
    if(filename!==root && !filename.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    if(relative.split('/').some(p=>p.startsWith('.')) || relative.startsWith('node_modules/')){res.writeHead(403);res.end();return;}
    if(!(await stat(filename)).isFile()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(await readFile(filename));
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`drawioToMsWhiteboard: http://localhost:${port}`));
