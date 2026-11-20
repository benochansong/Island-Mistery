(function(root){
  'use strict';
  const game=root.IslandMystery,KEY='island-mystery.codex.v1';
  const empty=()=>({version:1,runs:[],clues:[],events:[],sites:[],endings:[],missions:[],characters:[]});
  function load(){try{const raw=root.localStorage.getItem(KEY);if(!raw)return {available:true,data:empty()};if(raw.length>2000000)throw Error('too large');const d=JSON.parse(raw);if(d.version!==1||!['runs','clues','events','sites','endings','missions','characters'].every(k=>Array.isArray(d[k])&&d[k].length<=1000&&d[k].every(x=>typeof x==='string')&&new Set(d[k]).size===d[k].length))throw Error('invalid');return {available:true,data:d};}catch{return {available:false,data:empty()};}}
  function record(view){if(!view.outcome||!view.endingDetail)return true;const result=load();if(!result.available)return false;const d=result.data;if(d.runs.includes(view.runId))return true;
    const merge=(key,items)=>{d[key]=[...new Set([...d[key],...items])];};
    merge('runs',[view.runId]);d.runs=d.runs.slice(-1000);merge('clues',view.self.storyClues.map(c=>c.id));merge('events',view.storyHistory.map(e=>e.eventId));merge('sites',view.unlockedSites);merge('endings',[view.endingDetail.id]);merge('missions',view.self.mission?.complete?[view.self.mission.id]:[]);merge('characters',view.players.map(p=>p.id));
    try{root.localStorage.setItem(KEY,JSON.stringify(d));return true;}catch{return false;}}
  game.codex=Object.freeze({load,record});
})(globalThis);
