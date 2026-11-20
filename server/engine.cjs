const path=require('node:path'),crypto=require('node:crypto');
for(const name of ['data','config','social','dialogue','discussion','perception','schema','challenges','progression','story-data','story','missions','codex','ai','state'])require(path.join(__dirname,'../js',name+'.js'));
const game=globalThis.IslandMystery;
game.data=Object.freeze({...game.data,survivors:game.onlineRoster});
game.onlineRandom=()=>crypto.randomInt(0,4294967296)/4294967296;
module.exports=game;
