const {DatabaseSync}=require('node:sqlite'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),game=require('./engine.cjs');
const P=game.progression,hash=x=>crypto.createHash('sha256').update(x).digest('hex');
class Profiles{
  constructor(filename,dataset='local'){
    if(filename!==':memory:')fs.mkdirSync(path.dirname(path.resolve(filename)),{recursive:true});
    this.db=new DatabaseSync(filename);this.dataset=dataset;this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS guests(id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, profile TEXT NOT NULL); CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY, party TEXT NOT NULL, ended INTEGER NOT NULL, dataset TEXT NOT NULL); CREATE TABLE IF NOT EXISTS results(game_id TEXT NOT NULL, guest_id TEXT NOT NULL, dataset TEXT NOT NULL, eligible INTEGER NOT NULL, reason TEXT NOT NULL, result TEXT NOT NULL, receipt TEXT NOT NULL, PRIMARY KEY(game_id, guest_id)); CREATE INDEX IF NOT EXISTS result_dataset ON results(dataset, eligible);');
  }
  authenticate(data){
    if(data.id!==undefined||data.token!==undefined){if(typeof data.id!=='string'||typeof data.token!=='string'||data.token.length>100)throw Error('프로필 인증 실패');const row=this.db.prepare('SELECT token_hash FROM guests WHERE id=?').get(data.id);if(!row||!crypto.timingSafeEqual(Buffer.from(row.token_hash,'hex'),Buffer.from(hash(data.token),'hex')))throw Error('프로필 인증 실패 · 토큰을 복구하거나 새 게스트를 사용하세요.');return {id:data.id,profile:this.get(data.id)};}
    if(this.db.prepare('SELECT COUNT(*) AS n FROM guests').get().n>=10000)throw Error('서버 게스트 보관 한도에 도달했습니다.');
    const id=crypto.randomUUID(),token=crypto.randomBytes(32).toString('base64url'),p=P.customize(P.empty(),{nickname:data.nickname||'게스트'});this.db.prepare('INSERT INTO guests VALUES (?,?,?)').run(id,hash(token),JSON.stringify(p));return {id,token,profile:p};
  }
  get(id){const row=this.db.prepare('SELECT profile FROM guests WHERE id=?').get(id);if(!row)throw Error('프로필을 찾을 수 없습니다.');const p=JSON.parse(row.profile);if(!P.valid(p))throw Error('서버 프로필 검증 실패');return p;}
  view(id){const p=this.get(id);delete p.receipts;return p;}
  customize(id,input){if(Object.keys(input).some(k=>!['nickname','type','id'].includes(k)))throw Error('프로필의 외형만 변경할 수 있습니다.');const p=P.customize(this.get(id),input);this.db.prepare('UPDATE guests SET profile=? WHERE id=?').run(JSON.stringify(p),id);return this.view(id);}
  settle(room,now=Date.now()){
    if(!room.state?.outcome)return;
    const party=hash(room.members.map(m=>m.profileId).sort().join(':')),ended=new Date(now).toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try{
      if(this.db.prepare('SELECT id FROM matches WHERE id=?').get(room.runId)){this.db.exec('COMMIT');return;}
      const repeats=this.db.prepare('SELECT COUNT(*) AS n FROM matches WHERE party=? AND ended>? AND dataset=?').get(party,now-86400000,this.dataset).n;
      const reason=room.members.length!==6?'AI 혼합 경기':room.state.challenge?.id!=='classic'?'특별 도전':room.state.difficulty!=='normal'?'기본 난이도 아님':room.members.some(m=>m.abandoned||m.actionsSubmitted<3)?'이탈 또는 유효 행동 부족':room.state.day<2?'너무 짧은 경기':repeats>=3?'24시간 내 동일 구성 반복':'인정';
      this.db.prepare('INSERT INTO matches VALUES (?,?,?,?)').run(room.runId,party,now,this.dataset);
      for(const m of room.members){
        if(m.abandoned||!m.actionsSubmitted)continue;
        const r=P.result(room.state,m.seat,'online',ended);if(!r)continue;r.id=room.runId;r.competitive=reason==='인정';r.competitiveReason=reason;
        const settled=P.settle(this.get(m.profileId),r);
        this.db.prepare('INSERT INTO results VALUES (?,?,?,?,?,?,?)').run(room.runId,m.profileId,this.dataset,+r.competitive,reason,JSON.stringify(r),JSON.stringify(settled.receipt));
        this.db.prepare('UPDATE guests SET profile=? WHERE id=?').run(JSON.stringify(settled.profile),m.profileId);
      }
      this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  receipt(run,id){const row=this.db.prepare('SELECT receipt,reason FROM results WHERE game_id=? AND guest_id=?').get(run,id);return row?{...JSON.parse(row.receipt),competitiveReason:row.reason}:null;}
  leaderboard(input={}){
    const kind=input.kind||'casual',role=input.role||'all';if(!['casual','competitive'].includes(kind)||!['all',...Object.keys(game.config.roles)].includes(role))throw Error('랭킹 필터 오류');
    const rows=this.db.prepare('SELECT guest_id,result FROM results WHERE dataset=? AND (?=0 OR eligible=1)').all(this.dataset,+(kind==='competitive')),groups=new Map();
    for(const row of rows){const r=JSON.parse(row.result);if(role!=='all'&&r.role!==role)continue;let g=groups.get(row.guest_id);if(!g){const p=this.get(row.guest_id);g={nickname:p.nickname,title:p.equipped.title,games:0,wins:0,roles:{},mixed:0,humanOnly:0,difficulties:{},explores:0,evidence:0,achievements:Object.keys(p.achievements).length};groups.set(row.guest_id,g);}g.games++;g.wins+=+r.won;g.mixed+=+(r.ai>0);g.humanOnly+=+(r.ai===0);g.explores+=r.explores;g.evidence+=r.metrics.evidence;g.difficulties[r.difficulty]=(g.difficulties[r.difficulty]||0)+1;const stat=g.roles[r.role]||={games:0,wins:0};stat.games++;stat.wins+=+r.won;}
    const list=[...groups.values()].sort((a,b)=>(b.wins+1)/(b.games+2)-(a.wins+1)/(a.games+2)||b.games-a.games).slice(0,50).map((r,i)=>({...r,rank:i+1,winRate:Math.round(r.wins*100/r.games)}));
    return {scope:this.dataset==='test'?'테스트 전용 데이터':'로컬 서버 게스트 기록',global:false,kind,role,rows:list,policy:'글로벌 랭킹 비활성 · 게스트 토큰 식별. 승률에 가상 1승/1패를 더해 작은 표본을 보정하여 정렬. 경쟁 통계는 기본 모드·보통 난이도·인간 6명·2일 이상·각자 행동 3회·명시적 이탈 없음. 동일 구성의 24시간 내 네 번째 경기부터 제외.'};
  }
  close(){this.db.close();}
}
module.exports={Profiles};
