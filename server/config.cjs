function config(env=process.env){
  const production=env.NODE_ENV==='production';
  const origin=env.APP_ORIGIN||(env.APP_DOMAIN?'https://'+env.APP_DOMAIN:'');
  if(production&&!origin)throw Error('Production requires APP_ORIGIN or APP_DOMAIN.');
  if(origin){const u=new URL(origin);if(!['http:','https:'].includes(u.protocol)||u.origin!==origin||u.username||u.password||production&&u.protocol!=='https:')throw Error('APP_ORIGIN must be a bare HTTPS origin in production.');}
  const integer=(name,fallback,min,max)=>{const v=Number(env[name]??fallback);if(!Number.isInteger(v)||v<min||v>max)throw Error('Invalid '+name);return v;};
  return {databasePath:env.PROFILE_DB||require("node:path").join(__dirname,"../data/profiles.sqlite"),dataset:env.PROFILE_DATASET==="test"?"test":"local",production,origin,host:env.HOST||'127.0.0.1',port:integer('PORT',4174,1,65535),actionMs:integer('ACTION_TIMEOUT_MS',60000,1000,300000),eventMs:integer('EVENT_TIMEOUT_MS',30000,1000,120000),resultMs:integer('RESULT_DELAY_MS',2500,500,10000),lobbyReconnectMs:integer('LOBBY_RECONNECT_MS',120000,1000,600000),idleMs:integer('ROOM_IDLE_MS',600000,1000,86400000),maxRooms:integer('MAX_ROOMS',100,1,1000)};
}
module.exports={config};
