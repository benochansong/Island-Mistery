// Original deterministic synthesis. No third-party samples or melodies.
const fs = require('node:fs'), path = require('node:path');
const folder = path.resolve(__dirname, '../assets/audio'), rate = 22050, tau = Math.PI * 2;
let seed = 517; const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
const freq = midi => 440 * 2 ** ((midi - 69) / 12);
function wav(file, duration, sample) {
  const n = Math.floor(duration * rate), data = Buffer.alloc(44 + n * 2);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8); data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) { const t = i / rate, fade = Math.min(1, t / .025, (duration - t) / .07); data.writeInt16LE(Math.round(Math.max(-.95, Math.min(.95, sample(t) * fade)) * 32767), 44 + i * 2); }
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data);
}
const pieces = {
  menu:[50,57,60,64,62,57,53,57], morning:[60,64,67,74,72,67,64,69], afternoon:[57,60,64,67,62,64,60,55],
  discussion:[50,53,57,60,56,57,53,52], voting:[45,52,53,57,45,56,53,52], night:[38,45,48,49,50,45,41,40],
  survivors:[60,64,67,72,76,74,71,72], saboteur:[45,48,51,52,46,48,43,45], none:[50,53,57,55,52,50,48,45]
};
for (const [name, notes] of Object.entries(pieces)) {
  let air = 0;
  wav(path.join(folder,'bgm',name+'.wav'), 12, t => {
    const slot = Math.floor(t / 1.5), local = t % 1.5, f = freq(notes[slot]);
    const bell = (Math.sin(tau*f*local)+.28*Math.sin(tau*f*2.003*local)) * Math.exp(-local*2.6) * .16;
    const root = freq(notes[0]-12), pad = (Math.sin(tau*root*t)+.38*Math.sin(tau*root*1.5*t))*.06*(.7+.3*Math.sin(t*.5));
    air = air * .985 + noise() * .015;
    const nature = name==='morning' && t%3<.2 ? Math.sin(tau*(1700*(t%3)+350*(t%3)**2))*Math.sin(Math.PI*(t%3)/.2)*.025 : 0;
    const pulse = name==='voting' ? Math.sin(tau*62*t)*Math.exp(-(t%.75)*13)*.08 : 0;
    return (bell+pad+air*.15+nature+pulse)*Math.min(1,t/.6,(12-t)/.6);
  });
}
const sounds = {click:[74,.09],map:[65,.24],explore:[57,.65],resource:[79,.35],clue:[84,.9],danger:[43,.6],unlock:[72,1.1],dialogue:[67,.12],evidence:[81,.65],vote:[48,.3],result:[60,.9],exile:[40,1.1],repair:[76,.3],damage:[35,.5],win:[72,1.4],lose:[45,1.4]};
for (const [name,[note,duration]] of Object.entries(sounds)) wav(path.join(folder,'sfx',name+'.wav'),duration,t=> {
  const f=freq(note), ascending=['resource','clue','unlock','win'].includes(name), step=ascending?Math.floor(t/duration*3)*4:0;
  const tonal=Math.sin(tau*freq(note+step)*t)*Math.exp(-t/duration*3)*.3;
  return tonal + (['damage','danger','repair'].includes(name)?noise()*.08*Math.exp(-t*14):.025*Math.sin(tau*f*2*t));
});
console.log('Wrote 9 original ambient loops and 16 original effects (PCM WAV).');
