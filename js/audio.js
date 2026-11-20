(function (root) {
  'use strict';
  const game = root.IslandMystery;
  let unlocked = false, desired = 'menu', current = null, previous = null, frame = 0, generation = 0, failures = new Set();
  const effects = new Set(), lastPlayed = new Map();
  const config = () => game.settings.get();
  const gain = () => config().master * config().musicVolume;
  function status() { const el = document.getElementById('audio-status'); if (el) el.textContent = failures.size ? '일부 음원 사용 불가 · 게임은 계속됩니다' : !unlocked ? '첫 클릭 또는 키 입력 후 소리가 시작됩니다' : !config().music ? '배경음악 꺼짐' : '음악 · ' + ({menu:'미지의 섬',morning:'첫 빛',afternoon:'탐사',discussion:'불씨 사이',voting:'선택의 무게',night:'검은 수풀',survivors:'귀환',saboteur:'남겨진 신호',none:'마지막 기록'}[desired]); }
  function stop(a) { if (a) { a.pause(); a.removeAttribute('src'); a.load(); } }
  function clearEffects() { for (const a of effects) stop(a); effects.clear(); }
  function suspend() { cancelAnimationFrame(frame); generation++; stop(previous); previous = null; if (current) { current.pause(); current.volume = 0; } clearEffects(); }
  function playTrack() {
    status();
    if (!unlocked || document.hidden || !config().music || failures.has(desired)) return;
    if (current?.dataset.track === desired && !current.paused) { current.volume = gain(); return; }
    cancelAnimationFrame(frame); stop(previous);
    previous = current; const token = ++generation;
    const audio = new Audio(game.assets.bgm[desired]); audio.dataset.track = desired; audio.loop = true; audio.volume = 0; audio.preload = 'auto'; current = audio;
    audio.addEventListener('error', () => { if (token !== generation) return; failures.add(desired); stop(previous); previous = null; audio.pause(); status(); }, {once:true});
    audio.play().then(() => {
      if (token !== generation) return;
      const start = performance.now(), oldVolume = previous?.volume || 0;
      function fade(now) {
        if (token !== generation) return;
        const t = Math.max(0,Math.min(1,(now-start)/700)); audio.volume = gain()*t; if (previous) previous.volume = oldVolume*(1-t);
        if (t<1) frame=requestAnimationFrame(fade); else { stop(previous); previous=null; }
      }
      frame=requestAnimationFrame(fade);
    }).catch(() => { if(token===generation){stop(previous);previous=null;status();} });
  }
  function scene(id) { const next=game.assets.bgm[id]?id:'menu'; if (desired===next && current?.dataset.track===next && !current.paused) return; desired=next; playTrack(); }
  function unlock() { if(unlocked) return; unlocked=true; playTrack(); }
  function sfx(id) {
    if (!unlocked || document.hidden || !config().effects || !game.assets.sfx[id]) return false;
    const now=performance.now(); if(now-(lastPlayed.get(id)??-10000)<180 || effects.size>=3) return false;
    lastPlayed.set(id,now); const a=new Audio(game.assets.sfx[id]); a.volume=config().master*config().effectsVolume; effects.add(a);
    const release=()=>effects.delete(a); a.addEventListener('ended',release,{once:true}); a.addEventListener('error',release,{once:true}); a.play().catch(release); return true;
  }
  game.settings.subscribe(() => { if(!config().music) suspend(); else playTrack(); for(const a of effects)a.volume=config().master*config().effectsVolume; if(!config().effects)clearEffects(); status(); });
  document.addEventListener('pointerdown',unlock,{once:true}); document.addEventListener('keydown',unlock,{once:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();else playTrack();});
  document.addEventListener('click',e=>{if(e.target.closest('button:not(:disabled)'))sfx('click');});
  root.addEventListener('pagehide',()=>{suspend();stop(current);current=null;});
  game.audio = Object.freeze({ scene,sfx,unlock,status, diagnostics:()=>({unlocked,desired,playing:!!current&&!current.paused,currentTime:current?.currentTime||0,volume:current?.volume||0,activeEffects:effects.size,failures:[...failures],activeTracks:Number(!!current&&!current.paused)+Number(!!previous&&!previous.paused)}) });
})(globalThis);
