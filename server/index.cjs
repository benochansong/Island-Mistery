const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {Server}=require('socket.io'),{Rooms}=require('./rooms.cjs'),{config}=require('./config.cjs');
const root=path.resolve(__dirname,'..');
function createServer(overrides={}){
  const cfg={...config(),...overrides};
  const allowed=new Set(['index.html']);
  for(const dir of ['js','css','assets','assets/backgrounds','assets/characters','assets/audio/bgm','assets/audio/sfx'])for(const f of fs.readdirSync(path.join(root,dir)))if(/\.(js|css|svg|jpg|wav)$/.test(f))allowed.add(dir+'/'+f);
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.wav':'audio/wav'};
  const server=http.createServer((req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    if(cfg.production)res.setHeader('Strict-Transport-Security','max-age=31536000');
    let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';}catch{res.writeHead(400);return res.end();}
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
    if(name==='health'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ok:true,mode:'memory',version:'0.7.0'}));}
    if(name==='online-config.json'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({origin:cfg.origin||null,public:cfg.production,persistence:'memory'}));}
    if(!allowed.has(name)){res.writeHead(404);return res.end('Not found');}
    res.setHeader('Content-Type',types[path.extname(name)]);if(req.method==='HEAD')return res.end();fs.createReadStream(path.join(root,name)).on('error',()=>res.destroy()).pipe(res);
  });
  const io=new Server(server,{maxHttpBufferSize:16384,serveClient:true,transports:['websocket','polling'],allowRequest(req,done){const origin=req.headers.origin;const accepted=!origin||origin===(cfg.origin||'http://'+req.headers.host)||!cfg.production&&origin==='https://'+req.headers.host;done(null,accepted);}});
  const rooms=new Rooms(io,cfg),ips=new Map();
  io.use((socket,next)=>{const ip=socket.handshake.address;if((ips.get(ip)||0)>=30)return next(Error('연결이 너무 많습니다.'));ips.set(ip,(ips.get(ip)||0)+1);next();});
  io.on('connection',socket=>{
    let requests=[];
    const on=(event,fn)=>socket.on(event,(data,ack)=>{if(typeof ack!=='function')return;try{const now=Date.now();requests=requests.filter(t=>t>now-10000);if(requests.length>=80)throw Error('요청이 너무 빠릅니다.');requests.push(now);if(!data||typeof data!=='object'||Array.isArray(data))throw Error('요청 형식이 올바르지 않습니다.');const result=fn(data);ack({ok:true,...result});}catch(e){ack({ok:false,error:e.message});}});
    on('rooms:list',()=>({rooms:rooms.publicRooms()}));
    for(const [event,method]of [['room:create','create'],['room:join','join'],['session:resume','resume'],['room:leave','leave'],['room:ready','ready'],['room:start','start'],['room:rematch','rematch'],['game:action','request'],['chat:send','chat'],['chat:moderate','moderate']])on(event,data=>rooms[method](socket,data));
    socket.on('disconnect',()=>{rooms.disconnect(socket);const ip=socket.handshake.address;const n=(ips.get(ip)||1)-1;if(n)ips.set(ip,n);else ips.delete(ip);});
  });
  return {server,io,rooms,config:cfg,listen:()=>new Promise(resolve=>server.listen(cfg.port,cfg.host,()=>resolve(server.address()))),close:()=>new Promise(resolve=>{rooms.close();io.close(()=>server.close(()=>resolve()));})};
}
if(require.main===module){const app=createServer();app.listen().then(a=>console.log(`Island Mystery online: http://${a.address}:${a.port}\nMemory rooms: restart clears online games. Single-player saves are separate.`));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit()));}
module.exports={createServer};
