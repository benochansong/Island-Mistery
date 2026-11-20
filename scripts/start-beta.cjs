// Deliberately local-only. Does not read the developer's .env or expose a public server.
const path=require('node:path');
process.env.APP_ENV='beta';process.env.NODE_ENV='development';process.env.HOST='127.0.0.1';process.env.PORT='4178';process.env.PROFILE_DATASET='beta';process.env.PROFILE_DB=path.join(__dirname,'../data/beta/profiles.sqlite');delete process.env.APP_ORIGIN;delete process.env.APP_DOMAIN;
const app=require('../server/index.cjs').createServer();app.listen().then(()=>console.log('ISLAND MYSTERY — BETA 0.9.0\nLocal beta: http://127.0.0.1:4178\nBeta records are isolated. Ctrl+C stops the server.'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit()));
