(function(root){
  'use strict';
  const game=root.IslandMystery,P=game.progression,key='island-mystery.growth.v1';
  function load(){try{const raw=root.localStorage.getItem(key);if(!raw)return {available:true,profile:P.empty()};if(raw.length>5000000)throw Error();const p=JSON.parse(raw);if(!P.valid(p))throw Error();return {available:true,profile:p};}catch{return {available:false,profile:null,error:'성장 기록을 읽을 수 없습니다. 원본은 덮어쓰지 않았습니다.'};}}
  function transaction(fn){const run=()=>{const loaded=load();if(!loaded.available)throw Error(loaded.error);const result=fn(loaded.profile);try{root.localStorage.setItem(key,JSON.stringify(result.profile));}catch{throw Error('성장 기록 저장 실패 · 공간과 브라우저 권한을 확인하세요. 재접속 후 다시 정산할 수 있습니다.');}return result;};return root.navigator?.locks?root.navigator.locks.request(key,()=>run()):Promise.resolve().then(run);}
  const record=result=>transaction(p=>P.settle(p,result));
  const customize=input=>transaction(p=>({profile:P.customize(p,input)}));
  game.growthStore=Object.freeze({key,load,record,customize});
})(globalThis);
