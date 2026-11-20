(function(root){
  'use strict';
  const game=root.IslandMystery,$=game.ui.$,key='island-mystery.online.session.v1';
  const offlineData=game.data,onlineData=Object.freeze({...game.data,survivors:game.onlineRoster});
  const requestId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
  let socket=null,current=null,credentials=null,selected='coast',shownRole=null,pending=false,offset=0,config=null,lastView=null;
  let guest=null,profileReady=false,profileError=null;
  const guestKey='island-mystery.online.guest.v1';
  try{guest=JSON.parse(localStorage.getItem(guestKey));}catch{}
  try{credentials=JSON.parse(localStorage.getItem(key));}catch{}
  const error=message=>{$('online-error').textContent=message;$('action-error').textContent=message;};
  function save(value){credentials=value;try{if(value)localStorage.setItem(key,JSON.stringify(value));else localStorage.removeItem(key);}catch{$('online-error').textContent='재접속 정보를 저장할 수 없습니다. 새로고침하면 복귀할 수 없습니다.';}}
  function call(event,data={}){return new Promise((resolve,reject)=>{if(!socket?.connected)return reject(Error('현재 온라인 서버에 연결할 수 없습니다. 싱글플레이는 계속 이용할 수 있습니다.'));socket.timeout(8000).emit(event,data,(err,result)=>{if(err)return reject(Error('응답을 확인하지 못했습니다. 새로고침 후 제출 여부를 확인하세요.'));if(!result?.ok)return reject(Error(result?.error||'요청을 처리하지 못했습니다.'));resolve(result);});});}
  function panel(){game.ui.screen('welcome');$('welcome').hidden=true;$('online-panel').hidden=false;$('online-bar').hidden=true;game.presentation.screen('welcome');}
  async function connect(silent=false){
    if(silent!==true)panel();$('online-status').textContent='서버 연결 중…';
    if(location.protocol==='file:'){error('현재 온라인 서버에 연결할 수 없습니다. 싱글플레이는 계속 이용할 수 있습니다. 온라인은 start-online.cmd로 서버를 실행한 뒤 접속하세요.');return;}
    try{
      config ||= await fetch('online-config.json').then(r=>{if(!r.ok)throw Error();return r.json();});
      if(!root.io)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='socket.io/socket.io.js';s.onload=resolve;s.onerror=reject;document.head.append(s);});
      if(socket){if(!socket.connected)socket.connect();else{status();if(current)render(current);}return;}
      socket=root.io({autoConnect:false,reconnection:true,reconnectionDelay:500,reconnectionDelayMax:3000});
      socket.on('connect',async()=>{profileError=null;try{const r=await call('profile:auth',guest||{});if(r.token){guest={id:r.id,token:r.token};try{localStorage.setItem(guestKey,JSON.stringify(guest));}catch{error('게스트 토큰 저장 불가 · 이 브라우저를 닫으면 성장 기록에 다시 접근할 수 없습니다.');}}profileReady=true;growing(r.profile);status();}catch(e){profileError=e.message;error(e.message);return;}try{if(credentials)await call('session:resume',credentials);else refreshRooms();}catch(e){save(null);current=null;game.data=offlineData;document.body.dataset.online='false';$('online-forms').hidden=false;$('online-lobby').hidden=true;$('online-chat').hidden=true;for(const id of ['event-dialog','online-role-dialog','vote-dialog'])$(id).close();error(e.message);if(silent!==true)panel();}});
      socket.on('snapshot',render);socket.on('disconnect',()=>{profileReady=false;status();});socket.on('connect_error',()=>{status();error('현재 온라인 서버에 연결할 수 없습니다. 싱글플레이는 계속 이용할 수 있습니다.');});
      socket.on('superseded',()=>{current=null;save(null);game.data=offlineData;error('다른 창에서 같은 참가자로 재접속했습니다.');panel();});socket.connect();
    }catch{error('현재 온라인 서버에 연결할 수 없습니다. 싱글플레이는 계속 이용할 수 있습니다.');$('online-status').textContent='서버 연결 불가';}
  }
  function growing(profile){game.growthUI?.onlineProfile(profile);}
  async function service(event,data={}){if(!['profile:get','profile:customize','leaderboard:list'].includes(event))throw Error('허용되지 않은 프로필 요청');if(!socket?.connected)await connect(true);const until=Date.now()+9000;while(!profileReady&&Date.now()<until&&!profileError)await new Promise(r=>setTimeout(r,40));if(!profileReady)throw Error(profileError||'온라인 서버 연결 불가 · 로컬 기록은 계속 사용할 수 있습니다.');return call(event,data);}
  function status(){const online=Boolean(socket?.connected);$('online-status').textContent=online?'서버 연결됨':'연결이 끊겼습니다. 자동 재접속 중…';$('online-connection').textContent=online?'● 연결됨':'○ 연결 끊김 · 자동 재접속 중';if(current?.view)renderGame();}
  function render(snapshot){game.data=onlineData;if(current?.turnId!==snapshot.turnId)$('vote-dialog').close();if(current?.runId!==snapshot.runId){selected='coast';shownRole=null;lastView=null;}current=snapshot;pending=false;offset=Date.now()-snapshot.serverTime;document.body.dataset.online='true';$('online-forms').hidden=true;$('online-lobby').hidden=Boolean(snapshot.view);$('online-error').textContent=snapshot.error||'';$('action-error').textContent=snapshot.error||'';
    $('room-title').textContent=snapshot.room.name;$('room-code').textContent=snapshot.room.code;$('room-summary').textContent=`실제 참가자 ${snapshot.room.participants.length}/${snapshot.room.maxHumans} · AI ${snapshot.room.aiCount}명 · ${snapshot.room.difficulty} · 토론 ${snapshot.room.discussionSeconds}초`;
    $('lobby-players').replaceChildren(...snapshot.room.participants.map(p=>{const li=document.createElement('li');li.textContent=`${p.id===snapshot.room.host?'방장 · ':''}${p.nickname} · ${p.connected?'접속 중':p.reconnectUntil?'재접속 대기 · 기한 후 좌석 해제':'연결 끊김'} · ${p.ready?'준비 완료':'대기'} · ${game.data.survivors.find(x=>x.id===p.seat).name}`;return li;}));
    $('lobby-reconnect-help').textContent=`대기실에서 연결이 끊기면 ${snapshot.room.lobbyReconnectSeconds}초 동안 좌석을 보관합니다. 기한이 지나면 다시 참가하세요. 진행 중인 게임은 좌석을 유지합니다.`;
    const self=snapshot.room.participants.find(p=>p.id===snapshot.selfId);$('room-ready').textContent=self?.ready?'준비 취소':'준비 완료';$('room-start').hidden=snapshot.room.host!==snapshot.selfId;
    $('room-start').disabled=snapshot.room.participants.length<2||snapshot.room.participants.some(p=>!p.connected||!p.ready)||!snapshot.room.allowAI&&snapshot.room.participants.length<6;
    const invite=new URL(snapshot.invitePath,config?.origin||location.origin).href;$('invite-link').value=invite;$('invite-status').textContent=config?.public?'설정된 공개 서버의 초대 링크입니다.':'개발용 링크입니다. localhost·127.0.0.1 주소는 같은 기기에서만 연결됩니다. 다른 기기는 서버의 LAN 주소가 필요합니다.';
    if(snapshot.view){$('online-panel').hidden=true;$('online-bar').hidden=false;if($('game').hidden){game.ui.screen('game');game.presentation.screen('game');}renderGame();}
    else{panel();$('online-lobby').hidden=false;}
    renderChat();
  }
  function scoped(){const v=JSON.parse(JSON.stringify(current.view));v.selectedLocation=selected;if(current.submitted.includes(current.seat)&&!v.acted.includes(current.seat))v.acted.push(current.seat);return v;}
  function renderGame(){if(!current?.view)return;const v=scoped();game.ui.render(v);game.storyUI.render(v);game.presentation.render(v);game.growthUI?.game(v,current.reward,current.profile);$('online-chat').hidden=false;$('online-bar').hidden=false;$('onboarding').hidden=true;
    const participants=current.room.participants;document.querySelectorAll('#survivors .survivor').forEach((el,i)=>{const member=participants.find(m=>m.seat===v.players[i].id);if(member){const line=document.createElement('p');line.className='small';line.textContent=member.nickname+(member.id===current.selfId?' · 나':'')+(member.connected?'':' · 연결 끊김');el.append(line);}});
    $('save-status').textContent='진행 중인 방은 재시작 시 삭제 · 완료 전적은 서버에 보존';if($('collection-status'))$('collection-status').textContent='온라인 결과 · 서버 게스트 전적에 정산';
    const watching=!v.self.isAlive||v.self.isExiled,submitted=current.submitted.includes(current.seat);$('action-hint').textContent=watching?'관전 중 · 행동과 생존자 채팅은 사용할 수 없습니다.':current.waitingForEvent?'사건 담당자의 선택을 기다립니다.':v.resolved?'모두의 결과를 확인하세요. 서버가 다음 단계로 이동합니다.':submitted?'행동 확정됨 · 동료를 기다립니다.':'한 가지 행동을 확정하세요. 모두 제출하면 서버가 처리합니다.';
    if(!socket?.connected||pending)document.querySelectorAll('#action-list button,#event-options button').forEach(b=>b.disabled=true);
    $('online-progress').textContent=`${v.day}일차 · ${game.config.phaseNames[v.phase]} · 제출 ${current.submitted.length}/${v.players.filter(p=>p.isHuman&&p.isAlive&&!p.isExiled).length}`;
    $('online-rematch').hidden=!v.outcome||current.room.host!==current.selfId;
    $('online-message').disabled=watching||v.phase!=='discussion'||v.resolved||Boolean(v.outcome)||!socket?.connected;$('online-send').disabled=$('online-message').disabled;
    if(v.outcome&&!lastView?.outcome){$('ending-panel').focus();$('ending-panel').scrollIntoView({block:'start'});}
    if(shownRole!==current.runId&&!v.outcome){shownRole=current.runId;$('online-role-title').textContent='당신은 '+game.config.roles[v.self.role].name+'입니다.';$('online-role-description').textContent=game.config.roles[v.self.role].description+' '+v.self.secretGoal;$('online-role-dialog').showModal();}
    lastView=v;
  }
  function renderChat(){const list=$('online-messages'),nearBottom=list.scrollHeight-list.scrollTop-list.clientHeight<50;list.replaceChildren(...current.chat.map(m=>{const li=document.createElement('li');li.dataset.type=m.type;const strong=document.createElement('strong');strong.textContent=m.nickname+' · ';li.append(strong,document.createTextNode(m.text));if(m.type==='chat'&&m.memberId!==current.selfId)for(const [action,label]of [['block','차단'],['report','신고']]){const b=document.createElement('button');b.className='quiet moderation';b.textContent=label;b.addEventListener('click',()=>call('chat:moderate',{action,messageId:m.id}).then(()=>{$('online-chat-error').textContent=action==='report'?'신고가 이 방의 서버 기록에 저장되었습니다. 자동 제재는 아닙니다.':'';}).catch(e=>error(e.message)));li.append(b);}return li;}));if(nearBottom)list.scrollTop=list.scrollHeight;}
  async function dispatch(action){if(!current?.view)return;if(action.type==='SELECT_LOCATION'){selected=action.location;renderGame();return;}if(!['ACT','EVENT_CHOICE'].includes(action.type))return;if(pending)return;pending=true;renderGame();try{const keys=['kind','target','location','facility','resource','clueId','historyId','memoryId','statementId','siteId'];const clean=action.type==='EVENT_CHOICE'?{kind:'event',choiceId:action.choiceId}:Object.fromEntries(keys.filter(k=>action[k]!==undefined).map(k=>[k,action[k]]));await call('game:action',{turnId:current.turnId,requestId:requestId(),action:clean});}catch(e){error(e.message);}finally{pending=false;renderGame();}}
  async function refreshRooms(){try{const r=await call('rooms:list');$('public-rooms').replaceChildren(...r.rooms.map(room=>{const b=document.createElement('button');b.className='quiet full';b.textContent=`${room.name} · ${room.count}/${room.max}`;b.onclick=()=>{$('join-room-code').value=room.code;$('join-nickname').focus();};return b;}));}catch(e){error(e.message);}}
  async function leave(){try{if(current)await call('room:leave');}catch(e){error(e.message);}finally{save(null);current=null;game.data=offlineData;lastView=null;socket?.disconnect();socket=null;document.body.dataset.online='false';game.growthUI?.apply(game.growthStore.load().profile);$('online-panel').hidden=true;$('online-bar').hidden=true;$('online-chat').hidden=true;$('online-forms').hidden=false;$('online-lobby').hidden=true;for(const id of ['event-dialog','online-role-dialog','vote-dialog'])$(id).close();game.ui.screen('welcome');game.presentation.screen('welcome');}}
  $('online-button').addEventListener('click',connect);
  function syncCapacity(){const ai=$('room-ai').checked;$('room-max').disabled=!ai;if(!ai)$('room-max').value='6';}
  $('room-ai').addEventListener('change',syncCapacity);syncCapacity();
  $('create-room-form').addEventListener('submit',async e=>{e.preventDefault();try{const result=await call('room:create',{nickname:$('create-nickname').value,name:$('create-room-name').value,private:$('room-private').value==='true',difficulty:$('room-difficulty').value,allowAI:$('room-ai').checked,maxHumans:Number($('room-max').value),discussionSeconds:Number($('room-discussion').value)});save({code:result.code,memberId:result.memberId,token:result.token});}catch(e){error(e.message);}});
  $('join-room-form').addEventListener('submit',async e=>{e.preventDefault();try{const r=await call('room:join',{nickname:$('join-nickname').value,code:$('join-room-code').value.trim().toUpperCase()});save({code:r.code,memberId:r.memberId,token:r.token});}catch(e){error(e.message);}});
  $('room-ready').addEventListener('click',()=>call('room:ready',{ready:!current.room.participants.find(m=>m.id===current.selfId).ready}).catch(e=>error(e.message)));
  $('room-start').addEventListener('click',()=>call('room:start').catch(e=>error(e.message)));
  $('online-rematch').addEventListener('click',()=>call('room:rematch').catch(e=>error(e.message)));
  $('online-role-close').addEventListener('click',()=>$('online-role-dialog').close());
  for(const id of ['online-leave','lobby-leave'])$(id).addEventListener('click',()=>$('online-leave-dialog').showModal());
  $('online-leave-confirm').addEventListener('click',()=>{$('online-leave-dialog').close();leave();});$('online-leave-cancel').addEventListener('click',()=>$('online-leave-dialog').close());
  $('online-back').addEventListener('click',()=>current?$('online-leave-dialog').showModal():leave());
  for(const [id,value]of [['copy-room-code',()=>current.room.code],['copy-invite',()=>$('invite-link').value]])$(id).addEventListener('click',async()=>{try{await navigator.clipboard.writeText(value());$('invite-status').textContent='복사했습니다. '+(config?.public?'공개 서버 링크입니다.':'개발용 주소는 접속 가능한 기기 범위를 확인하세요.');}catch{$('invite-link').focus();$('invite-link').select();$('invite-status').textContent='자동 복사가 차단되었습니다. 표시된 주소를 직접 복사하세요.';}});
  $('refresh-rooms').addEventListener('click',refreshRooms);
  $('online-chat-form').addEventListener('submit',async e=>{e.preventDefault();try{await call('chat:send',{text:$('online-message').value});$('online-message').value='';$('online-chat-error').textContent='';}catch(e){$('online-chat-error').textContent=e.message;}});
  setInterval(()=>{if(current)$('online-timer').textContent=current.deadline?'남은 시간 '+Math.max(0,Math.ceil((current.deadline-(Date.now()-offset))/1000))+'초':'게임 종료';},500);
  game.online=Object.freeze({active:()=>Boolean(current),service,dispatch,menu:()=>$('online-leave-dialog').showModal(),journal:()=>current?.view&&game.ui.renderJournal(scoped()),results:()=>current?.view&&game.ui.renderResults(scoped())});
  const code=new URLSearchParams(location.search).get('room');if(code){$('join-room-code').value=code.slice(0,30);connect();}else if(credentials)connect();
})(globalThis);
