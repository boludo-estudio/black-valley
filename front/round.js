/* Black Valley: Jack's final maths in the demo (docs/jack/spec.md, docs/jack/art-brief.md). A round is a list of events
   in Jack's shapes (amounts in hundredths of the bet; positions {reel,row}, row + 1 when the board carries the SDK's
   padding rows); playRound() plays them in order and decides nothing. demoRound() makes a believable round for the DEMO
   menu: random boards, real 25-line pays and cascades, but not the tuned maths. A book from math-sdk plays the same way. */
(()=>{   // own scope: the page's script already owns names like fx, ring, collect
let TURBO=false,AUTO=0;const TK=()=>TURBO?2.2:1;
/* turbo: these shadow the page's helpers inside this scope, so every pause, scene and move of a round runs TK() times faster */
const wait=ms=>new Promise(r=>window.setTimeout(r,ms/TK()));
const setTimeout=(f,ms,...a)=>window.setTimeout(f,(ms||0)/TK(),...a);
const play=(D,fn,s)=>{const k=TK();return window.play(D/k,(T,o)=>fn(T*k,(key,t,f)=>o(key,t/k,f)),s==null?s:s/k)};
{const A0=Element.prototype.animate;Element.prototype.animate=function(k,o){const an=A0.call(this,k,o);if(TURBO)an.playbackRate=TK();return an}}

const ART={W:'wild_lamp',S:'choir',H1:'haskett_bust',H2:'debt_bowler',H3:'debt_trilby',H4:'debt_cap',M1:'canary',M2:'pick',M3:'helmet',M4:'coal',
 L1:'boots',L2:'snaptin',L3:'mug',L4:'waterjack'};
const PAY={W:[2.5,10,50],H1:[2.5,8,40],H2:[2,5,25],H3:[1.5,4,20],H4:[1.2,3,12],M1:[1,2.5,8],M2:[.8,2,6],M3:[.8,2,6],M4:[.6,1.5,5],
 L1:[.5,1.2,4],L2:[.4,1,3],L3:[.4,1,3],L4:[.4,1,3]};
const MINING=['M1','M2','M3','M4'];
const LINES=[[0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],[4,4,4,4,4],[0,1,2,1,0],[4,3,2,3,4],[1,2,3,2,1],[3,2,1,2,3],[2,3,4,3,2],
 [2,1,0,1,2],[0,1,2,3,4],[4,3,2,1,0],[0,0,1,0,0],[4,4,3,4,4],[1,1,2,1,1],[3,3,2,3,3],[2,2,1,2,2],[2,2,3,2,2],[0,1,0,1,0],
 [4,3,4,3,4],[1,0,1,0,1],[3,4,3,4,3],[1,2,1,2,1],[3,2,3,2,3]];
const BONUS={strike:{name:'THE STRIKE',spins:10,re:3,max:20},uprising:{name:'THE UPRISING',spins:8,re:2,max:16},final_stand:{name:'FINAL STAND',spins:6,re:2,max:12}};
const tokTier=v=>v>=2500?3:v>=200?2:1, money=a=>window.BV_WIN?window.BV_WIN(a):(a/100*BET).toFixed(2);
const fmtBal=v=>window.BV_BAL?window.BV_BAL(v):v.toFixed(2);

/* ---------- demo maths: same rules as Jack's game, random numbers (DEMO only) ---------- */
const DW={H1:3,H2:4,H3:4,H4:5,M1:6,M2:6,M3:6,M4:7,L1:8,L2:8,L3:8,L4:8,W:1.6,S:1.1};
const wpick=(t,ex=[])=>{const k=Object.keys(t).filter(x=>!ex.includes(x)),s=k.reduce((a,x)=>a+t[x],0);let r=Math.random()*s;for(const x of k)if((r-=t[x])<0)return x;return k[0]};
const sym=n=>({name:n}),cp=b=>b.map(r=>r.map(s=>({...s})));
function drawSym(reel,noS){return sym(wpick(DW,[...(reel===0?['W']:[]),...(noS?['S']:[])]))}
function drawBoard(nS=0){const b=[0,1,2,3,4].map(r=>[0,1,2,3,4].map(()=>drawSym(r,true)));
 const reels=[0,1,2,3,4].sort(()=>Math.random()-.5).slice(0,nS);reels.forEach(r=>b[r][Math.floor(Math.random()*5)]=sym('S'));
 if(!nS&&Math.random()<.12)b[Math.floor(Math.random()*5)][Math.floor(Math.random()*5)]=sym('S');return b}
function lineWins(b,mult=1){const wins=[];LINES.forEach((L,li)=>{const s0=b[0][L[0]].name;if(!PAY[s0]||s0==='W')return;let n=1;
  while(n<5&&(b[n][L[n]].name===s0||b[n][L[n]].name==='W'))n++;
  if(n>=3)wins.push({symbol:s0,kind:n,win:Math.round(PAY[s0][n-3]*100*mult),positions:L.slice(0,n).map((r,c)=>({reel:c,row:r})),meta:{lineIndex:li+1,multiplier:mult}})});
 return wins}
function gravity(b,dead){const nb=[],ns=[];for(let c=0;c<5;c++){const keep=b[c].filter((s,r)=>!dead.has(c+','+r)),n=5-keep.length,add=[...Array(n)].map(()=>drawSym(c,true));
  ns.push(add);nb.push([...add,...keep])}return {board:nb,newSymbols:ns}}
function tierOf(a,cost=1){const x=a/100;return x<=0?0:x<1?1:x<15*cost?2:x<50?3:x<150?4:5}
/* one spin (base or bonus): returns events + spin win. f = {knock, fire:[reels], pit, village:{n,max}, mult} */
function demoSpin(E,f,gameType,state){let b=drawBoard(f.nS||0);
 if(f.forceLine){const L=LINES[f.forceLine-1],s=f.forceSym||'L1';for(let c=0;c<(f.forceN||4);c++)if(b[c][L[c]].name!=='S')b[c][L[c]]=sym(s)}
 if(f.knock&&b[0][2].name==='S')b[0][2]=sym('L1');
 const startB=cp(b);E.push({type:'reveal',board:cp(b),gameType});
 const burning=[];
 if(f.knock){const spots=[];for(let c=1;c<5;c++)for(let r=0;r<5;r++)if(b[c][r].name!=='S')spots.push({reel:c,row:r});
  const n=f.knock,ch=spots.sort(()=>Math.random()-.5).slice(0,n);
  // the Knock always pays: lean the wilds onto row 2's line so a line forms
  ch.slice(0,2).forEach((p,i)=>{p.reel=i+1;p.row=2});
  const seen=new Set(),pos=ch.filter(p=>{const k=p.reel+','+p.row;if(seen.has(k))return false;seen.add(k);return true});pos.forEach(p=>b[p.reel][p.row]=sym('W'));
  E.push({type:'knock',positions:pos})}
 if(f.fire){f.fire.forEach(c=>{for(let r=0;r<5;r++)if(b[c][r].name!=='S')b[c][r]=sym('W');burning.push(c)});
  if(!lineWins(b).length){b[1].forEach((s,r)=>{if(s.name!=='S')b[1][r]=sym('W')});if(!burning.includes(1))burning.push(1)}
  E.push({type:'fireExpand',reels:[...burning].sort()})}
 let toks=[];
 if(f.village){const spots=[];for(let c=0;c<4;c++)for(let r=0;r<5;r++)if(!['S','W'].includes(b[c][r].name))spots.push([c,r]);
  spots.sort(()=>Math.random()-.5).slice(0,f.village.n).forEach(([c,r])=>{const v=f.village.vals[Math.floor(Math.random()*f.village.vals.length)];b[c][r]={name:'T',prize:v};toks.push({reel:c,row:r,value:v})});
  const cr=[0,1,2,3,4].find(r=>b[4][r].name!=='S')??0;b[4][cr]={name:'C'};E.push({type:'villageTokens',tokens:toks,collector:{reel:4,row:cr}})}
 let spin=0,mult=state.mult||1,step=0;
 for(;;){let wins=lineWins(b,mult);if(!wins.length)break;
  if(f.pit)wins.forEach((w,i)=>{if(MINING.includes(w.symbol)){const m=[2,3,5,10][Math.floor(Math.random()*4)];w.win*=m;w.meta.pitMultiplier=m;E.push({type:'pitMultiplier',winIndex:i,multiplier:m})}});
  const tw=wins.reduce((a,w)=>a+w.win,0);spin+=tw;E.push({type:'winInfo',totalWin:tw,wins});E.push({type:'updateTumbleWin',amount:spin});
  if(state.uprising&&mult<25){mult++;state.mult=mult;E.push({type:'updateGlobalMult',globalMult:mult})}
  step++;if(step>1)burning.length=0;
  const dead=new Set();wins.forEach(w=>w.positions.forEach(p=>{if(!burning.includes(p.reel))dead.add(p.reel+','+p.row)}));
  if(!dead.size||step>7)break;
  const g=gravity(b,dead);b=g.board;E.push({type:'tumbleBoard',explodingSymbols:[...dead].map(k=>{const [c,r]=k.split(',').map(Number);return {reel:c,row:r}}),newSymbols:g.newSymbols,board:cp(b)})}
 if(f.village){const on=[];b.forEach((col,c)=>col.forEach((s,r)=>{if(s.name==='T')on.push({reel:c,row:r,value:s.prize})}));
  if(on.length){const tot=on.reduce((a,t)=>a+t.value,0);spin+=tot;E.push({type:'collect',amount:tot,positions:on.map(t=>({reel:t.reel,row:t.row}))})}}
 return {win:spin,board:b,startB}}
function demoRound(kind){const E=[],st={mult:1};let total=0;BETCOST=1;
 const V=[20,50,100,200,500,1000,2500,5000],FV=[50,100,200,500,1000,2500,5000,10000,25000,50000];
 const base={spin:{},line:{forceLine:6+Math.floor(Math.random()*19),forceN:4},cascade:{forceLine:2,forceN:5,forceSym:'M4'},knock:{knock:3+Math.floor(Math.random()*6)},
  fire:{fire:[[1],[2],[3],[1,3]][Math.floor(Math.random()*4)]},pit:{pit:1,forceLine:3,forceN:4,forceSym:'M1'},village:{village:{n:3+Math.floor(Math.random()*6),vals:V}},
  tease:{nS:2},strike:{nS:3},uprising:{nS:4},final_stand:{nS:5},bigwin:{forceLine:1,forceN:5,forceSym:'H1'},maxwin:{nS:5}}[kind]||{};
 const bought=kind.startsWith('buy_');const bk=bought?kind.slice(4):null;
 let sw=0;
 if(!bought){const r=demoSpin(E,base,'basegame',st);sw=r.win;
  if(kind==='bigwin'){sw=Math.max(sw,2600+Math.floor(Math.random()*9000));E.push({type:'updateTumbleWin',amount:sw})}
  if(sw){E.push({type:'setWin',amount:sw,winLevel:tierOf(sw)})}total=sw;E.push({type:'setTotalWin',amount:total})}
 const bonus=bk||({strike:'strike',uprising:'uprising',final_stand:'final_stand',maxwin:'final_stand'}[kind]);
 if(bonus){const R=BONUS[bonus];let tot=R.spins,bw=0,fs=0;const nS={strike:3,uprising:4,final_stand:5}[bonus];
  E.push({type:'freeSpinTrigger',bonus,totalFs:tot,positions:bought?[]:E[0].board.flatMap((col,c)=>col.map((s,r)=>s.name==='S'?{reel:c,row:r}:null)).filter(Boolean)});
  if(bonus==='uprising'){st.mult=2;st.uprising=1;E.push({type:'updateGlobalMult',globalMult:2})}
  while(fs<tot){fs++;E.push({type:'updateFreeSpin',amount:fs,total:tot});
   const ff=bonus==='final_stand'?{fire:Math.random()<.7?[1+Math.floor(Math.random()*3)]:[1,3],village:{n:3+Math.floor(Math.random()*5),vals:kind==='maxwin'&&fs>3?[25000,50000]:FV}}
    :bonus==='strike'?(Math.random()<.4?{fire:[1+Math.floor(Math.random()*3)]}:Math.random()<.1?{knock:4}:Math.random()<.12?{pit:1}:{})
    :(Math.random()<.12?{knock:4}:Math.random()<.12?{pit:1}:Math.random()<.1?{fire:[2]}:{});
   if(bonus!=='final_stand'&&Math.random()<(bonus==='uprising'?.75:.5)){ff.forceLine=1+Math.floor(Math.random()*25);ff.forceN=3+Math.floor(Math.random()*2);ff.forceSym=['M1','M4','L2','H3','L1'][Math.floor(Math.random()*5)]}   /* the demo shows wins; the real maths decides */
   if(fs===2&&tot<R.max&&Math.random()<.45)ff.nS=3;
   const r=demoSpin(E,ff,'freegame',st);bw+=r.win;
   if(kind==='maxwin'&&total+bw>=2000000){E.push({type:'setWin',amount:r.win,winLevel:6});E.push({type:'freeSpinEnd',amount:2000000-total,winLevel:6});E.push({type:'wincap',amount:2000000});E.push({type:'finalWin',amount:2000000});return E}
   if(r.win)E.push({type:'setWin',amount:r.win,winLevel:tierOf(r.win)});E.push({type:'setTotalWin',amount:total+bw});
   if(ff.nS===3&&tot<R.max){tot=Math.min(R.max,tot+R.re);E.push({type:'freeSpinRetrigger',totalFs:tot,positions:r.startB.flatMap((col,c)=>col.map((s,rr)=>s.name==='S'?{reel:c,row:rr}:null)).filter(Boolean)})}}
  if(kind==='maxwin'){E.push({type:'freeSpinEnd',amount:2000000-total,winLevel:6});E.push({type:'wincap',amount:2000000});E.push({type:'finalWin',amount:2000000});return E}
  E.push({type:'freeSpinEnd',amount:bw,winLevel:tierOf(bw)});total+=bw;E.push({type:'setTotalWin',amount:total})}
 E.push({type:'finalWin',amount:total});E.forEach((e,i)=>e.index=i);return E}
let BETCOST=1;

/* ---------- board look: cells, line paths, plates, particles (all inside #board so the phone page carries them) ---------- */
(function(){const st=document.createElement('style');st.textContent=`
.cell{position:relative}.cell .val{position:absolute;left:0;right:0;bottom:25px;text-align:center;font:900 25px/1 Stencil;color:var(--ink);letter-spacing:.02em;pointer-events:none}
.cell[data-s="collector"] .val{color:var(--amber);bottom:23px;font-size:22px}
.cell.burnt img{filter:grayscale(1) brightness(.6);transition:filter .5s}
.cell.gone img{opacity:0}
#lines{position:absolute;left:-40px;top:-40px;width:820px;height:820px;z-index:6;pointer-events:none;overflow:visible}
#bfx{position:absolute;left:-90px;top:-90px;width:920px;height:920px;z-index:7;pointer-events:none}
#bplates{position:absolute;inset:0;z-index:8;pointer-events:none}
#bplates .tag{position:absolute;font:900 30px/1 Stencil;background:var(--paper);color:var(--ink);padding:6px 12px 2px;outline:4px solid var(--edge);box-shadow:5px 5px 0 var(--ink);transform:translate(-50%,-50%) rotate(-2deg);white-space:nowrap}
#bplates .ln{position:absolute;font:900 26px/1 Stencil;background:var(--ink);color:var(--paper);width:44px;height:38px;display:flex;align-items:center;justify-content:center;outline:4px solid var(--edge);transform:translate(-50%,-50%)}
#bplates .pit{position:absolute;font:900 64px/1 Stencil;color:var(--ink);background:var(--amber);padding:8px 14px 2px;outline:6px solid var(--edge);box-shadow:7px 7px 0 var(--ink);transform:translate(-50%,-50%) rotate(-8deg)}
#bplates .fly{position:absolute;font:900 28px/1 Stencil;background:var(--paper);color:var(--ink);padding:5px 10px 1px;outline:4px solid var(--edge);box-shadow:4px 4px 0 var(--ink);transform:translate(-50%,-50%)}
#tw{position:absolute;left:50%;top:-74px;transform:translateX(-50%) rotate(-1deg);z-index:8;font:900 44px/1 Stencil;background:var(--paper);color:var(--ink);padding:8px 26px 2px;outline:5px solid var(--edge);box-shadow:7px 7px 0 var(--ink);display:none;white-space:nowrap}
#tw small{font:700 18px 'Courier Prime';letter-spacing:.18em;margin-right:14px;vertical-align:6px}
#fsHud{position:absolute;left:50%;top:22px;transform:translateX(-50%);z-index:6;display:none;gap:16px;align-items:center}
#fsHud .nm{font:900 42px/1 Stencil;background:var(--ink);color:var(--paper);padding:8px 16px 2px;outline:5px solid var(--edge);box-shadow:6px 6px 0 var(--ink);transform:rotate(-1.5deg)}
#fsHud .sp{font:900 42px/1 Stencil;background:var(--paper);color:var(--ink);padding:8px 18px 2px;outline:5px solid var(--edge);box-shadow:6px 6px 0 var(--ink);transform:rotate(1deg);white-space:nowrap}
#fsHud .sp small{font:700 18px 'Courier Prime';letter-spacing:.2em;margin-right:10px;vertical-align:5px}
#fsHud .re{font:900 40px/1 Stencil;background:var(--amber);color:var(--ink);padding:8px 14px 2px;outline:5px solid var(--edge);box-shadow:6px 6px 0 var(--ink);opacity:0}
#umeter{position:absolute;left:1378px;top:250px;width:124px;z-index:5;display:none;text-align:center}
#umeter .k{font:700 15px 'Courier Prime';letter-spacing:.1em;background:var(--paper);color:var(--ink);padding:8px 10px;box-shadow:5px 5px 0 var(--ink);display:inline-block;transform:rotate(-2deg)}
#umeter .x{margin-top:16px;font:900 74px/0.9 Stencil;background:var(--amber);color:var(--ink);padding:14px 10px 4px;outline:6px solid var(--edge);box-shadow:9px 9px 0 var(--ink)}
#umeter .bar{margin:22px auto 0;width:66px;height:330px;background:var(--ink);outline:5px solid var(--paper);box-shadow:7px 7px 0 var(--ink);position:relative}
#umeter .bar i{position:absolute;left:8px;right:8px;bottom:8px;background:var(--amber);transition:height .35s cubic-bezier(.2,1.4,.4,1)}
#umeter .bar b{position:absolute;left:-54px;font:700 16px 'Courier Prime';color:var(--paper)}
#bi{position:absolute;left:0;right:0;top:70px;z-index:6;pointer-events:none;display:none;text-align:center}
#bi .w{display:flex;gap:8px;justify-content:center}
#bi .l{font:900 132px/0.9 Stencil;padding:8px 12px 2px;display:inline-block;box-shadow:8px 8px 0 var(--ink);outline:6px solid var(--edge);opacity:0}
#bi .l.i{background:var(--ink);color:var(--paper)}#bi .l.p{background:var(--paper);color:var(--ink)}#bi .l.a{background:var(--amber);color:var(--ink)}
#bi .n{display:inline-block;margin-top:24px;font:900 70px/1 Stencil;background:var(--amber);color:var(--ink);padding:10px 30px 4px;box-shadow:8px 8px 0 var(--ink);outline:6px solid var(--edge);transform:rotate(-2deg);opacity:0}
#bi .n small{font:700 26px 'Courier Prime';letter-spacing:.2em;vertical-align:10px;margin-left:12px}
#mood{position:absolute;inset:0;z-index:1;pointer-events:none;opacity:0;transition:opacity 1.2s}
body.fsOn #logo{opacity:0!important;transition:opacity .3s}body.port #fsHud{top:40px}body.port #fsHud .nm,body.port #fsHud .sp{font-size:50px}
body.port #umeter{left:auto;right:44px;top:1680px;width:230px}body.port #umeter .x{font-size:92px;margin-top:10px}body.port #umeter .bar{display:none}body.port #umeter .k{font-size:20px}
body.port #bi{top:1330px}body.port #bi .l{font-size:96px}body.port #bi .n{font-size:76px}
body.titleOn :is(#fsHud,#umeter,#tw){visibility:hidden!important}body.cine :is(#fsHud,#tw),body.bwPlay :is(#fsHud,#tw){opacity:0}`;document.head.appendChild(st)})();
const BD=$('#board');BD.insertAdjacentHTML('beforeend','<svg id="lines" viewBox="-40 -40 820 820"></svg><canvas id="bfx" width="920" height="920"></canvas><div id="bplates"></div><div id="tw"><small>WIN</small><span>0.00</span></div>');
$('#scene').insertAdjacentHTML('beforeend','<div id="umeter"><div class="k">THE UPRISING</div><div class="x">×2</div><div class="bar"><i></i></div></div>');
$('#stage').insertAdjacentHTML('beforeend','<div id="fsHud"><div class="nm"></div><div class="sp"><small>SPIN</small><span></span></div><div class="re"></div></div><div id="bi"></div>');
$('#valley').insertAdjacentHTML('beforebegin','<div id="mood"></div>');
const LS=$('#lines'),BF=$('#bfx'),bfx=BF.getContext('2d'),PL=$('#bplates');
const cxy=(c,r)=>[c*148+74,r*148+74];
let PB=null;   // the board as the player sees it: PB[reel][row] = {name, prize?}
const figOf=(c,r)=>'abc'[(c*7+r*3)%3];
function cellOf(s,c,r){if(s.name==='T')return `<div class="cell" data-s="token"><img src="a/token_t${tokTier(s.prize)}_${figOf(c,r)}.png" alt=""><b class="val">${money(s.prize)}</b></div>`;
 if(s.name==='C')return `<div class="cell" data-s="collector"><img src="a/collector.png" alt=""><b class="val"></b></div>`;
 return cellHTML(ART[s.name])}
const cellEl=(c,r)=>cols[c].children[r];
function paint(b){PB=cp(b);for(let c=0;c<5;c++){cols[c].innerHTML=b[c].map((s,r)=>cellOf(s,c,r)).join('');grid[c]=b[c].map(s=>ART[s.name]||s.name);
 cols[c].querySelectorAll('.cell').forEach(x=>{if(x.dataset.s==='wild_lamp')x.classList.add('wild')})}}
function setCell(c,r,s){PB[c][r]={...s};const t=document.createElement('div');t.innerHTML=cellOf(s,c,r);const n=t.firstChild,o=cellEl(c,r);o.replaceWith(n);if(s.name==='W')n.classList.add('wild');return n}
const unpad=(b)=>b[0].length===7?b.map(col=>col.slice(1,6)):b;
let PADR=0;const P=p=>({reel:p.reel,row:p.row-PADR});

/* particles on #bfx (board coords + 90): coal chunks, dust, embers, smoke, sparks */
const parts=[];let fxOn=false;
function fxLoop(){if(!fxOn)return;const g=bfx;g.clearRect(0,0,920,920);g.save();g.translate(90,90);fireDraw(g);
 for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.t+=1/60;if(p.t>p.life){parts.splice(i,1);continue}const u=p.t/p.life;p.x+=p.vx;p.y+=p.vy;p.vy+=p.g||0;p.a+=p.va||0;
  if(p.k==='chunk'){g.save();g.translate(p.x,p.y);g.rotate(p.a);g.globalAlpha=1-u*u;g.beginPath();p.pts.forEach((q,j)=>j?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));g.closePath();g.fillStyle=p.c;g.fill();g.lineWidth=2;g.strokeStyle=C.ash;g.stroke();g.restore()}
  else if(p.k==='dust'||p.k==='smoke'){g.globalAlpha=(p.k==='smoke'?.55:.5)*(1-u);g.fillStyle=p.c;g.beginPath();g.arc(p.x,p.y,p.r*(1+u*1.6),0,7);g.fill()}
  else if(p.k==='ember'){g.globalAlpha=1-u;g.fillStyle=u<.5?C.core:C.amber;g.fillRect(p.x,p.y,4,4)}
  else if(p.k==='ring'){g.globalAlpha=1-u;g.strokeStyle=C.amber;g.lineWidth=10*(1-u)+2;g.beginPath();g.arc(p.x,p.y,20+u*70,0,7);g.stroke()}
  else if(p.k==='trail'){g.globalAlpha=.8*(1-u);g.fillStyle=C.amber;g.beginPath();g.arc(p.x,p.y,7*(1-u)+2,0,7);g.fill()}}
 g.globalAlpha=1;g.restore();if(parts.length||FIRE.reels.length)requestAnimationFrame(fxLoop);else{fxOn=false;g.clearRect(0,0,920,920)}}
function fx(){if(!fxOn){fxOn=true;requestAnimationFrame(fxLoop)}}
function shatter(c,r){const [x,y]=cxy(c,r);for(let i=0;i<14;i++){const a=Math.random()*7,s=R(2,7),n=5,sz=R(7,17),pts=[...Array(n)].map((_,j)=>{const t=j/n*7+R(-.3,.3);return [Math.cos(t)*sz*R(.6,1),Math.sin(t)*sz*R(.6,1)]});
  parts.push({k:'chunk',x:x+R(-30,30),y:y+R(-30,30),vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,g:.45,a:0,va:R(-.2,.2),pts,c:i%3?C.ink:C.coal,t:0,life:R(.5,.8)})}
 for(let i=0;i<7;i++)parts.push({k:'dust',x:x+R(-34,34),y:y+R(-34,34),vx:R(-1,1),vy:R(-1.4,-.2),r:R(14,26),c:C.slate,t:0,life:R(.6,.9)});fx()}
function ring(x,y){parts.push({k:'ring',x,y,vx:0,vy:0,t:0,life:.5});fx()}

/* ---------- The Fire: reels burn (ignite -> burning -> burn-out) ---------- */
const FIRE={reels:[],t0:0,out:0};
function fireDraw(g){if(!FIRE.reels.length)return;const T=(performance.now()-FIRE.t0)/1000,ig=clamp(T/.7),o=FIRE.out?clamp((performance.now()-FIRE.out)/700):0,k=(1-o);
 for(const c of FIRE.reels){const x0=c*148,front=740*(1-eo(ig));
  g.save();g.globalCompositeOperation='screen';const gr=g.createLinearGradient(0,740,0,front);gr.addColorStop(0,`rgba(255,176,0,${.42*k})`);gr.addColorStop(1,`rgba(255,176,0,${.08*k})`);g.fillStyle=gr;g.fillRect(x0,front,148,740-front);g.restore();
  // paper flames (the intro's fire) up both edges of the reel, a crown at the front
  const tongue=(x,y,w,h,ph)=>{const pts=[[x,y]];for(let j=0;j<=4;j++){const xx=x+w*j/4;pts.push([xx,y-h*(.55+.45*Math.abs(Math.sin(T*8+ph+j*1.9)))*(j%2?1:.5)])}pts.push([x+w,y]);
   g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fillStyle=C.paper;g.fill();g.lineWidth=4;g.strokeStyle=C.ink;g.stroke()};
  for(let y=740;y>front-10;y-=62){const h=(48+18*Math.sin(y*.05+T*3))*k;if(h<4)continue;tongue(x0-17,y,34,h,y*.13);tongue(x0+131,y,34,h,y*.17+2)}
  tongue(x0+8,Math.max(front,0)+30,132,(ig<1?110:70)*k,1);
  if(!o&&Math.random()<.5)parts.push({k:'ember',x:x0+R(10,138),y:R(front,740),vx:R(-.4,.4),vy:R(-2.6,-1.2),t:0,life:R(.6,1.1)});
  if(o&&o<.9&&Math.random()<.6)parts.push({k:'smoke',x:x0+R(20,128),y:R(80,700),vx:R(-.3,.3),vy:R(-1.6,-.8),r:R(16,30),c:C.slate,t:0,life:R(.8,1.3)})}
 if(o>=1)FIRE.reels=[]}
async function fireExpand(reels){FIRE.reels=reels.slice();FIRE.t0=performance.now();FIRE.out=0;fx();SND.play('fire',{g:.9});SND.play('paper',{g:.5,r:.8});
 $('#board').animate([{transform:'translate(0,0)'},{transform:'translate(-6px,3px)'},{transform:'translate(5px,-2px)'},{transform:'translate(0,0)'}],{duration:260});
 for(let step=0;step<5;step++){await wait(140);const r=4-step;for(const c of reels)if(PB[c][r].name!=='S')setCell(c,r,{name:'W'})}
 await wait(260)}
async function fireOut(){if(!FIRE.reels.length||FIRE.out)return;FIRE.out=performance.now();SND.play('gutter',{g:.6});
 for(const c of FIRE.reels)cols[c].querySelectorAll('.cell').forEach(x=>x.classList.add('burnt'));await wait(520);
 for(const c of FIRE.reels)cols[c].querySelectorAll('.cell').forEach(x=>x.classList.remove('burnt'));await wait(240)}

/* ---------- The Knock: three knocks on the board, each turns a group of cells into lamp wilds ---------- */
async function knockTakeover(pos){hkState='tense';if(HK){const e=HK.state.setAnimation(3,'lookboard',false);e.mixDuration=.3}
 tween(260,u=>DM.forEach(m=>m.tilt=-10*u));tween(500,u=>mistK=.3*u);const groups=[[],[],[]];pos.forEach((p,i)=>groups[i%3].push(P(p)));
 for(let k=0;k<3;k++){$('#board').animate([{transform:'translate(0,0)'},{transform:'translate(9px,-3px) rotate(.5deg)'},{transform:'translate(-4px,2px)'},{transform:'translate(0,0)'}],{duration:200,easing:'ease-out'});
  knockMark(k);knockSnd(k);
  for(const p of groups[k]){const o=cellEl(p.reel,p.row),im=o.querySelector('img');
   im.animate([{transform:'scaleX(1)'},{transform:'scaleX(0)'}],{duration:110}).onfinish=()=>{const n=setCell(p.reel,p.row,{name:'W'});n.querySelector('img').animate([{transform:'scaleX(0) scale(1.3)'},{transform:'scaleX(1) scale(1)'}],{duration:180,easing:'cubic-bezier(.2,1.5,.4,1)'});const [x,y]=cxy(p.reel,p.row);ring(x,y)}}
  await wait(430)}
 SND.syn('chime',{r:1.12});tween(700,u=>DM.forEach(m=>m.tilt=-10*(1-u)));tween(900,u=>mistK=.3*(1-u));
 HK&&HK.state.addEmptyAnimation(3,.4,0);setTimeout(()=>hkState='idle',400);await wait(250)}

/* ---------- The Village Fights Back: tokens drop onto reels 1-4, Glenys the collector onto reel 5 ---------- */
async function villageTokens(tokens,col){const all=[...tokens.map(t=>({...P(t),s:{name:'T',prize:t.value}})),{...P(col),s:{name:'C'}}];
 for(const t of all){const n=setCell(t.reel,t.row,t.s);n.animate([{transform:'translateY(-190px)',opacity:0},{transform:'translateY(12px)',opacity:1,offset:.7},{transform:'translateY(0)'}],{duration:340,easing:'cubic-bezier(.5,0,.7,1)'});
  SND.play(t.s.name==='C'?'stamp':'paper',{g:t.s.name==='C'?.8:.55,r:1.1+Math.random()*.2});if(t.s.name==='C'){const [x,y]=cxy(t.reel,t.row);setTimeout(()=>ring(x,y),300);glWink()}await wait(t.s.name==='C'?420:120)}
 await wait(300)}
async function collect(amount,pos){const col=PB.flatMap((cl,c)=>cl.map((s,r)=>s.name==='C'?[c,r]:null)).filter(Boolean)[0]||[4,2],[cx,cy]=cxy(...col);let got=0;
 const ce=cellEl(...col),cv=ce.querySelector('.val');cheer();
 for(const p0 of pos){const p=P(p0),[x,y]=cxy(p.reel,p.row),v=PB[p.reel][p.row].prize||0,f=document.createElement('div');f.className='fly';f.textContent=money(v);f.style.left=x+'px';f.style.top=(y+36)+'px';PL.appendChild(f);
  cellEl(p.reel,p.row).classList.add('dimc');SND.syn('tink');
  const t0=performance.now(),D=420;await new Promise(res=>(function st(){const u=Math.min(1,(performance.now()-t0)/D),e=ease(u),xx=x+(cx-x)*e,yy=y+36+(cy-y-36)*e-Math.sin(u*Math.PI)*120;
   f.style.left=xx+'px';f.style.top=yy+'px';parts.push({k:'trail',x:xx,y:yy,vx:0,vy:0,t:0,life:.35});fx();if(u<1)requestAnimationFrame(st);else res()})());
  f.remove();got+=v;cv.textContent=money(got);ce.querySelector('img').animate([{transform:'scale(1.18)'},{transform:'scale(1)'}],{duration:200});ring(cx,cy)}
 SND.play('choir',{g:.7,r:1.12});const tag=plate(cx,cy-96,money(amount),'tag');tag.style.background=C.amber;await wait(900);tag.remove();
 document.querySelectorAll('.cell.dimc').forEach(c=>c.classList.remove('dimc'))}

/* ---------- lines: rope-and-chalk paths, line numbers, win tags, The Pit stamp ---------- */
function plate(x,y,txt,cls){const d=document.createElement('div');d.className=cls;d.textContent=txt;d.style.left=x+'px';d.style.top=y+'px';PL.appendChild(d);
 d.animate([{transform:'translate(-50%,-50%) scale(1.6) rotate(-6deg)',opacity:0},{transform:'translate(-50%,-50%) scale(1) rotate(-2deg)',opacity:1}],{duration:220,easing:'cubic-bezier(.2,1.4,.4,1)'});return d}
function linePath(li){const L=LINES[li-1];return 'M -30 '+(L[0]*148+74)+' '+L.map((r,c)=>`L ${c*148+74} ${r*148+74}`).join(' ')+` L 770 ${L[4]*148+74}`}
function drawLines(wins){LS.innerHTML='';const NS='http://www.w3.org/2000/svg',mk=(t,a)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);LS.appendChild(e);return e};
 wins.forEach((w,i)=>{const d=linePath(w.meta.lineIndex),o={d,fill:'none','stroke-linejoin':'round','stroke-linecap':'round'};
  mk('path',{...o,stroke:C.ink,'stroke-width':22});const p=mk('path',{...o,stroke:i%2?C.paper:C.amber,'stroke-width':11,'stroke-dasharray':i%2?'26 12':'none'});
  const len=p.getTotalLength?p.getTotalLength():1400;[...LS.children].slice(-2).forEach(e=>{e.style.strokeDasharray=e===p&&i%2?'26 12':len;e.animate([{strokeDashoffset:len},{strokeDashoffset:0}],{duration:360,easing:'ease-out'})})})}
async function winInfo(e,pit){const wins=e.wins;drawLines(wins);const tags=[];
 wins.forEach(w=>w.positions.forEach(p0=>{const p=P(p0);cellEl(p.reel,p.row).classList.add('hit')}));
 wins.forEach((w,i)=>{const L=LINES[w.meta.lineIndex-1];tags.push(plate(-46,L[0]*148+74,w.meta.lineIndex,'ln'))});
 SND.syn('chime',{r:1+.06*Math.min(5,wins.length-1)});glTap();if(wins.length>2)lightWindows(2);
 await wait(380);
 for(const [i,m] of Object.entries(pit)){const w=wins[i];if(!w)continue;const p=P(w.positions[0]),[x,y]=cxy(p.reel,p.row);SND.play('stamp',{g:.9});
  const s=plate(x,y,'×'+m,'pit');tags.push(s);$('#board').animate([{transform:'translateY(0)'},{transform:'translateY(4px)'},{transform:'translateY(0)'}],{duration:140});await wait(420)}
 wins.forEach(w=>{const p=P(w.positions[w.positions.length-1]),[x,y]=cxy(p.reel,p.row);tags.push(plate(x+30,y-50,money(w.win),'tag'))});
 await wait(Math.min(1100,600+wins.length*90));
 LS.animate([{opacity:1},{opacity:0}],{duration:180}).onfinish=()=>{LS.innerHTML=''};tags.forEach(t=>t.remove());
 document.querySelectorAll('.cell.hit').forEach(c=>c.classList.remove('hit'))}

/* Engine (math-sdk) tumbleBoard: explodingSymbols (may repeat a cell) + newSymbols per reel, top to bottom.
   With a padding row, newSymbols[c][0] is the reel's new hidden top symbol; the cells that drop in are
   newSymbols[c].slice(1) followed by the previous hidden top symbol. */
let TOPPAD=null;
function boardAfterTumble(e,dead){const out=[];
 for(let c=0;c<5;c++){const gone=new Set(dead.filter(p=>p.reel===c).map(p=>p.row));const keep=PB[c].filter((_,r)=>!gone.has(r));
  const ns=(e.newSymbols[c]||[]).map(s=>({...s}));let drop;
  if(!gone.size){out.push(PB[c].map(s=>({...s})));continue}
  if(TOPPAD){drop=ns.slice(1).concat([{...TOPPAD[c]}]);TOPPAD[c]=ns[0]}else drop=ns;
  out.push(drop.slice(-gone.size).concat(keep))}
 return out}

/* ---------- cascades: winners break into coal, the rest fall, new symbols drop in ---------- */
async function tumble(e){const dead=e.explodingSymbols.map(P),b=e.board?unpad(e.board):boardAfterTumble(e,dead);SND.play('coal1',{g:.8,r:.7});SND.play('coal2',{g:.6,r:.62});
 for(const p of dead){cellEl(p.reel,p.row).classList.add('gone');shatter(p.reel,p.row)}
 await wait(260);
 for(let c=0;c<5;c++){const gone=new Set(dead.filter(p=>p.reel===c).map(p=>p.row));if(!gone.size)continue;
  // where each final cell came from: new ones fall from above the reel, survivors fall by the gaps below them
  const keep=[0,1,2,3,4].filter(r=>!gone.has(r)),n=gone.size,from=[...Array(n)].map((_,i)=>i-n).concat(keep);
  cols[c].innerHTML=b[c].map((s,r)=>cellOf(s,c,r)).join('');cols[c].querySelectorAll('.cell').forEach((x,r)=>{if(x.dataset.s==='wild_lamp')x.classList.add('wild');
   const dy=(from[r]-r)*148;if(dy)x.animate([{transform:`translateY(${dy}px)`},{transform:'translateY(6px)',offset:.85},{transform:'translateY(0)'}],{duration:300+Math.abs(dy)*.25,delay:c*40,easing:'cubic-bezier(.5,0,.75,1)',fill:'backwards'})});
  setTimeout(()=>SND.play(c%2?'coal2':'coal1',{g:.4,r:1+c*.04}),360+c*40)}
 PB=cp(b);for(let c=0;c<5;c++)grid[c]=b[c].map(s=>ART[s.name]||s.name);await wait(520)}

/* ---------- spin: the Sherlock recipe; two choirs really landed -> the last reels hold (plain anticipation) ---------- */
function spinTo(b){return new Promise(res=>{SND.syn('spin');document.querySelectorAll('.cell').forEach(c=>c.classList.remove('hit','wild','dimc'));
 let sc=0,hold=-1;for(let c=0;c<5;c++){if(sc>=2&&hold<0)hold=c;if(b[c].some(s=>s.name==='S'))sc++}
 const xt=c=>hold>=0&&c>=hold?900+(c-hold)*700:0;if(hold>=0){$('#tease').classList.add('on');setTimeout(()=>{for(let c=0;c<hold;c++)cols[c].querySelectorAll('.cell').forEach(x=>x.classList.add(x.dataset.s==='choir'?'scat':'dimc'))},440+115*(hold-1))}
 const old=cols.map(st=>st.innerHTML);let left=5;
 cols.forEach((st,c)=>{const filler=Array.from({length:14+(xt(c)?Math.round(xt(c)/70):0)},()=>cellHTML(pick()));st.innerHTML=b[c].map((s,r)=>cellOf(s,c,r)).join('')+filler.join('')+old[c];
  const H=CS*(5+filler.length);st.style.transform=`translateY(${-H}px)`;
  st.animate([{transform:`translateY(${-H}px)`},{transform:`translateY(${-H-24}px)`,offset:.06},{transform:'translateY(22px)',offset:.94},{transform:'translateY(0)'}],
   {duration:440+115*c+xt(c),easing:'cubic-bezier(.45,.05,.4,1)'}).onfinish=()=>{st.style.transform='translateY(0)';SND.play(c%2?'coal2':'coal1',{g:.55,r:.94+c*.03});
   st.innerHTML=b[c].map((s,r)=>cellOf(s,c,r)).join('');st.querySelectorAll('.cell').forEach(x=>{if(x.dataset.s==='wild_lamp')x.classList.add('wild')});
   if(--left===0){$('#tease').classList.remove('on');document.querySelectorAll('.cell.dimc,.cell.scat').forEach(x=>x.classList.remove('dimc','scat'));PB=cp(b);for(let k=0;k<5;k++)grid[k]=b[k].map(s=>ART[s.name]);res()}}})})}

/* ---------- running win plate, bonus HUD, Uprising meter, moods ---------- */
const TW=$('#tw');function twSet(a){TW.style.display='block';TW.querySelector('span').textContent=money(a);TW.animate([{transform:'translateX(-50%) rotate(-1deg) scale(1.12)'},{transform:'translateX(-50%) rotate(-1deg) scale(1)'}],{duration:220})}
const HUD=$('#fsHud');let FS=null;
function hudSet(n,t){HUD.style.display='flex';document.body.classList.add('fsOn');   /* the bonus banner takes the logo's place */
 HUD.querySelector('.nm').textContent=BONUS[FS].name;HUD.querySelector('.sp span').textContent=`${n} / ${t}`}
async function hudRetrigger(add,t){const re=HUD.querySelector('.re');re.textContent=`+${add} SPINS`;SND.play('stamp');SND.play('choir',{g:.7,r:1.12});
 re.animate([{opacity:0,transform:'scale(1.8) rotate(-10deg)'},{opacity:1,transform:'scale(1) rotate(-4deg)',offset:.25},{opacity:1,transform:'scale(1) rotate(-4deg)',offset:.85},{opacity:0}],{duration:1600});
 await wait(500);HUD.querySelector('.sp span').textContent=HUD.querySelector('.sp span').textContent.replace(/\/ \d+/,'/ '+t);HUD.querySelector('.sp').animate([{transform:'rotate(1deg) scale(1.2)'},{transform:'rotate(1deg) scale(1)'}],{duration:260});await wait(700)}
const UM=$('#umeter');
function multSet(m,first){UM.style.display='block';const x=UM.querySelector('.x');x.textContent='×'+m;UM.querySelector('.bar i').style.height=(8+300*(m-2)/23)+'px';
 if(!first){SND.play('stamp',{g:.6,r:1+m*.01});x.animate([{transform:'scale(1.35) rotate(-4deg)'},{transform:'scale(1) rotate(0)'}],{duration:260,easing:'cubic-bezier(.2,1.5,.4,1)'});
  const r=x.getBoundingClientRect();parts.length<200&&0}}
const MOOD=$('#mood');
function moodSet(k){MOOD.style.opacity=k?1:0;
 MOOD.style.background=k==='strike'?'radial-gradient(ellipse 30% 22% at 8% 96%,rgba(255,176,0,.38),transparent),radial-gradient(ellipse 30% 22% at 92% 96%,rgba(255,176,0,.38),transparent)'
  :k==='uprising'?'linear-gradient(to top,rgba(255,176,0,.30),rgba(255,176,0,.04) 60%,transparent)'
  :k==='final_stand'?'linear-gradient(to top,rgba(255,176,0,.42),rgba(199,119,0,.22) 45%,rgba(17,16,16,.25))':'none';
 if(k==='uprising')lightWindows(40);if(!k)windows.forEach(w=>w.setAttribute('fill',C.coal))}

/* ---------- bonus intros: The Strike (picket at the gate), The Uprising (the village rises), Final Stand (face to face) ---------- */
const BI=$('#bi');
function biBuild(name,spins){BI.innerHTML='<div class="w">'+[...name].map((ch,i)=>ch===' '?'<span style="width:34px"></span>':`<span class="l ${i===0?'a':i%3===1?'p':'i'}" data-r="${((i*37%11)-5)*.9}">${ch}</span>`).join('')+`</div><div class="n">${spins}<small>SPINS</small></div>`;BI.style.display='block'}
function brazier(g,x,y,T){poly(g,[[x-36,y],[x+36,y],[x+30,y-80],[x-30,y-80]],C.ink,5);g.fillStyle=C.coal;for(let k=0;k<3;k++)g.fillRect(x-26+k*20,y-70,8,60);
 const pts=[[x-30,y-80]];for(let j=0;j<=5;j++)pts.push([x-30+12*j,y-80-(40+30*Math.abs(Math.sin(T*7+j*1.7)))*(j%2?1:.55)]);pts.push([x+30,y-80]);poly(g,pts,C.paper,4);
 g.save();g.globalCompositeOperation='screen';const gr=g.createRadialGradient(x,y-100,0,x,y-100,320);gr.addColorStop(0,'rgba(255,176,0,.55)');gr.addColorStop(1,'rgba(255,176,0,0)');g.fillStyle=gr;g.fillRect(x-330,y-430,660,660);g.restore()}
const FIG=['owen_idle','glenys_idle','owen_look','glenys_cheer','owen_helmet','glenys_idle','owen_idle','owen_look'];
function introDraw(k,T){const g=cbx,f=cfx;g.setTransform(1,0,0,1,0,0);f.setTransform(1,0,0,1,0,0);f.clearRect(0,0,1920,1080);
 if(k==='strike'){gateSet(g,true,true,false,T);const L=eo(clamp((T-.2)/1)),Rr=eo(clamp((T-.35)/1));
  for(let i=0;i<7;i++)folkDraw(f,FIG[i],-200+L*(260+i*95),1010+(i%2)*12,330,i%2===1,-Math.abs(Math.sin(T*3+i))*4);
  for(let i=0;i<7;i++)folkDraw(f,FIG[i+1],2120-Rr*(260+i*95),1010+(i%2)*12,330,i%2===0,-Math.abs(Math.sin(T*3+i+1))*4);
  brazier(f,420,1040,T);brazier(f,1500,1040,T)}
 if(k==='uprising'){g.fillStyle='#1B1A19';g.fillRect(0,0,1920,1080);g.fillStyle=C.paper;for(let i=0;i<40;i++)g.fillRect((i*397)%1900,(i*211)%420,3,3);
  for(let i=0;i<9;i++){const x=-40+i*230,y=520+(i%3)*30,lit=clamp((T-.3-Math.abs(i-4)*.12)/.3);cHouse(g,x,y,220,lit>0)}
  for(let row=0;row<3;row++){const up=eob(clamp((T-.35-row*.28)/.55));for(let i=0;i<11;i++){const x=60+i*180+row*60+((i*37)%29);folkDraw(f,FIG[(i+row)%8],x,1080+(1-up)*420-row*-10,300+row*60,(i+row)%2===1)}}
  poly(f,tornY(x=>1040+6*Math.sin(x/90),5,71),C.paper,0)}
 if(k==='final_stand'){g.fillStyle='#141313';g.fillRect(0,0,1920,1080);
  g.save();g.globalCompositeOperation='screen';const gr=g.createLinearGradient(760,0,1160,0);gr.addColorStop(0,'rgba(255,176,0,0)');gr.addColorStop(.5,`rgba(255,176,0,${.55*clamp(T/.8)})`);gr.addColorStop(1,'rgba(255,176,0,0)');g.fillStyle=gr;g.fillRect(0,0,1920,1080);g.restore();
  poly(g,tornY(x=>980+6*Math.sin(x/90),5,73),C.paper,0);
  const inL=eo(clamp(T/.9));for(let i=0;i<6;i++)folkDraw(f,FIG[i],-300+inL*(560-i*80),1000-((i%2)*16),300+(i%3)*30,true,0)}
 }
async function bonusIntro(k,spins){const N=BONUS[k].name;setsOn(true);hideChars();CAP.style.display='none';SND.duck(.3,3.2);SND.play('paper',{g:.8});
 if(k==='strike'){SND.play('crowd',{g:.8});SND.play('gate',{g:.7})}if(k==='uprising'){SND.play('crowd',{g:.9});SND.play('choir',{g:.8,r:1.06})}
 if(k==='final_stand'){putChar('glenys',.9,640,1000);putChar('haskett',.95,1300,1000);const d=$('#debt').style;d.visibility='visible';d.zIndex=5;d.transformOrigin='1592px 1012px';d.scale=.9;d.translate='-120px -40px';SND.play('choir',{g:.9,r:1.12})}
 await play(3.2,(T,once)=>{introDraw(k,T);once('t',.5,()=>{biBuild(N,spins);SND.play('stamp')});
  BI.querySelectorAll('.l').forEach((s,i)=>{const u=clamp((T-.55-i*.045)/.22);s.style.opacity=u>0?1:0;s.style.transform=`rotate(${s.dataset.r}deg) scale(${1.7-.7*eob(u)})`});
  const n=BI.querySelector('.n');if(n){const u=clamp((T-1.3)/.25);n.style.opacity=u;n.style.transform=`rotate(-2deg) scale(${1.5-.5*eob(u)})`}once('n',1.3,()=>SND.play('stamp',{g:.7,r:1.1}));
  BI.style.opacity=1-clamp((T-2.85)/.3);if(T<3.2&&T>2.75)wipeAt((T-2.75)/.9,false)},2.75);
 BI.style.display='none';BI.style.opacity=1;setsOn(false);freeChars();moodSet(k);SND.music('bonus');await play(.5,T=>wipeAt(.45+T,false));WP.style.display='none'}

/* ---------- bonus total card, max win ---------- */
async function bonusTotal(k,amount,lvl){if(lvl>=3&&lvl<6)await bigWinP(Math.min(3,lvl-2),amount);
 document.body.classList.add('bwPlay');biBuild(BONUS[k].name,'');const n=BI.querySelector('.n');n.innerHTML=`${money(0)}<small>TOTAL</small>`;BI.style.top='';SND.play('stamp');
 await play(2.6,(T,once)=>{BI.querySelectorAll('.l').forEach((s,i)=>{const u=clamp((T-.05-i*.04)/.2);s.style.opacity=u>0?1:0;s.style.transform=`rotate(${s.dataset.r}deg) scale(${1.6-.6*eob(u)})`});
  const u=clamp((T-.5)/.2);n.style.opacity=u;n.innerHTML=`${money(amount*eo(clamp((T-.55)/1.1)))}<small>TOTAL</small>`;once('c',.55,()=>SND.play('choir',{g:.8,r:1.06}));
  BI.style.opacity=1-clamp((T-2.3)/.3)},2.2);BI.style.display='none';BI.style.opacity=1;document.body.classList.remove('bwPlay')}
BWD[4]=11.5;BWN[4]='MAX WIN';
function bigWinP(tier,amt){document.body.classList.add('bwPlay');return new Promise(res=>{bwTier=tier;bigWin(amt/100*BET);if(TURBO)window.setTimeout(()=>$('#stage').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})),900);   /* turbo: the scene skips to its count's end on its own */(function w(){if(bwOn)requestAnimationFrame(w);else{busy=true;document.body.classList.remove('bwPlay');res()}})()   /* bigWin frees busy at its end; the round still runs */})}

/* ---------- the player ---------- */
let roundOn=false;
async function playRound(E){if(roundOn)return;roundOn=true;busy=true;const pit={};let inFs=false,lastBoardT=0,tumbles=0,spinWin=0;
 $('#win').textContent='0.00';bal-=BET*BETCOST;$('#bal').textContent=fmtBal(bal);
 for(const e0 of E){const e=e0.type==='freeSpinTrigger'&&inFs?{...e0,type:'freeSpinRetrigger'}:e0;   // a trigger inside a bonus is a retrigger
  switch(e.type){
  case 'reveal':{const b=unpad(e.board);PADR=e.board[0].length===7?1:0;TOPPAD=PADR?e.board.map(col=>col[0]):null;tumbles=0;spinWin=0;TW.style.display='none';await fireOut();FIRE.reels=[];await spinTo(b);break}
  case 'knock':await knockTakeover(e.positions);break;
  case 'fireExpand':await fireExpand(e.reels);break;
  case 'villageTokens':await villageTokens(e.tokens,e.collector);break;
  case 'pitMultiplier':pit[e.winIndex]=e.multiplier;break;
  case 'winInfo':await winInfo(e,pit);for(const k in pit)delete pit[k];break;
  case 'updateTumbleWin':spinWin=e.amount;twSet(e.amount);$('#win').textContent=money(e.amount);break;
  case 'updateGlobalMult':multSet(e.globalMult,!inFs||e.globalMult===2);break;
  case 'tumbleBoard':tumbles++;if(tumbles===2)await fireOut();await tumble(e);break;
  case 'collect':await collect(e.amount,e.positions);spinWin+=e.amount;twSet(spinWin);break;
  case 'setWin':await fireOut();if(!inFs&&e.winLevel>=3&&e.winLevel<6)await bigWinP(e.winLevel-2,e.amount);break;   /* in a bonus the big win waits for the total */
  case 'setTotalWin':$('#win').textContent=money(e.amount);break;
  case 'freeSpinTrigger':{FS=e.bonus;inFs=true;if(e.positions.length){e.positions.forEach(p0=>{const p=P(p0);cellEl(p.reel,p.row).classList.add('scat')});SND.play('choir',{g:.8});await wait(1100)}
   TW.style.display='none';await bonusIntro(e.bonus,e.totalFs);hudSet(0,e.totalFs);break}
  case 'updateFreeSpin':hudSet(e.amount,e.total);break;
  case 'freeSpinRetrigger':{const t=+HUD.querySelector('.sp span').textContent.split('/ ')[1];e.positions.forEach(p0=>{const p=P(p0);const c=cellEl(p.reel,p.row);c&&c.classList.add('scat')});await hudRetrigger(e.totalFs-t,e.totalFs);break}
  case 'freeSpinEnd':await fireOut();TW.style.display='none';if(e.winLevel<6)await bonusTotal(FS,e.amount,e.winLevel);HUD.style.display='none';document.body.classList.remove('fsOn');UM.style.display='none';moodSet(null);inFs=false;SND.music('base');break;
  case 'wincap':await fireOut();await bigWinP(4,e.amount);break;
  case 'finalWin':bal+=e.amount/100*BET;$('#bal').textContent=fmtBal(bal);$('#win').textContent=money(e.amount);break}}
 TW.style.display='none';document.querySelectorAll('.cell.scat').forEach(c=>c.classList.remove('scat'));FS=null;roundOn=false;busy=false}
window.playRound=playRound;window.demoRound=demoRound;
/* real books: ?book=URL (a JSON list of rounds or one round's events) plays them in turn on SPIN */
let BOOKS=null,bookI=0;if(RQ.get('book'))fetch(RQ.get('book')).then(r=>r.json()).then(j=>{BOOKS=Array.isArray(j)&&j[0]&&j[0].events?j.map(b=>b.events):Array.isArray(j[0])?j:[j.events||j]});
/* Jack's six modes (game_config bet_modes; names as the player sees them, no buy / bet / pay words). A plain spin draws
   its feature and its choirs from his odds: features per 10,500 (Knock 191, Pit 525, Fire 105, Village 131, x2 in More
   Features), bonuses from the spec's measured odds (3 choirs Strike, 4 Uprising, 5 Final Stand). The three bonus modes
   start their bonus straight away, once, then the mode goes back to Standard. */
const MODES={base:{n:'Standard',c:1,f:1,sc:[309,1434,14621]},more_features:{n:'More Features',c:1.5,f:2,sc:[227,1053,10741]},
 bonus_chance:{n:'Bonus Chance',c:2,f:1,sc:[81,376,3833]},strike:{n:'The Strike',c:60,b:1},uprising:{n:'The Uprising',c:120,b:1},final_stand:{n:'Final Stand',c:250,b:1}};
let MODE='base';
function naturalKind(){const m=MODES[MODE],[s3,s4,s5]=m.sc;let r=Math.random();
 if((r-=1/s5)<0)return 'final_stand';if((r-=1/s4)<0)return 'uprising';if((r-=1/s3)<0)return 'strike';
 let q=Math.random()*10500;for(const [k,w] of [['knock',191],['pit',525],['fire',105],['village',131]])if((q-=w*m.f)<0)return k;
 return Math.random()<1/30?'tease':'spin'}   /* two choirs now and then: the honest anticipation hold */
function roundSpin(kind='spin'){if(window.BV_SPIN)return window.BV_SPIN(kind);if(busy||roundOn)return;if(BOOKS&&kind==='spin'){playRound(BOOKS[bookI++%BOOKS.length]);return}
 const E=demoRound(kind==='spin'?naturalKind():kind);BETCOST=kind.startsWith('buy_')?MODES[kind.slice(4)].c:kind==='spin'?MODES[MODE].c:1;playRound(E)}
$('#spin').onclick=()=>roundSpin();
window.BVGame={playRound,mode:()=>MODE,setBetCost:v=>{BETCOST=v},roundOn:()=>roundOn};   // engine.js drives these
window.roundSpin=roundSpin;   // the page's Space key calls this when it exists
/* rules page for the final game (Jack's spec: 25 lines, cascades, four features, three bonuses, six modes, 20,000x).
   Values are x the total play; no buy / bet / pay / cash / cost words. */
(function(){const x=v=>'×'+(+v.toFixed(2)),nm=k=>ART[k].replace('_',' ').toUpperCase(),pg=$('#rules .pg'),close=$('#rulesX');
 const row=k=>`<div><img src="a/${ART[k]}.png" alt=""><b>${nm(k)}</b><span>${PAY[k].map((v,i)=>`${i+3} ${x(v)}`).join('<br>')}</span></div>`;
 const st=document.createElement('style');st.textContent=`#rules .syms span{display:block;font-size:.95em;line-height:1.3;margin-top:4px}#rules .syms b{display:block;margin-top:6px}
#rules .lines{width:100%;margin-top:10px}body.port #rules .lines{content:url(a/lines/rules_lines_25_portrait.png)}#rules .duo{display:grid;grid-template-columns:120px 1fr;gap:18px;align-items:center;margin:10px 0}#rules .duo img{width:120px;background:var(--ink);padding:6px;box-sizing:border-box}
#rules table{border-collapse:collapse;width:100%;margin:8px 0}#rules td{border-bottom:2px solid var(--ash);padding:8px 6px;vertical-align:top}#rules td:first-child{font:900 1.25em/1.1 Stencil;white-space:nowrap;padding-right:18px}`;document.head.appendChild(st);
 pg.innerHTML=`<h2>BLACK VALLEY</h2><p>South Wales, winter 1984. 5 × 5 reels, 25 fixed lines. A line wins with 3, 4 or 5 matching symbols in a row from the first reel on the left; only the highest win on each line counts. Values are × the total play. RTP 96.50% in every mode. The most any round can win is ×20,000: the round ends there and any bonus spins left are not played.</p>
 <h3>CASCADES</h3><p>Winning symbols break into coal dust and are removed, the symbols above drop and new ones fall in. The board is checked again until there is no win. Choir photos stay where they land.</p>
 <h3>SYMBOLS</h3><div class="syms">${['W','H1','H2','H3','H4','M1','M2','M3','M4','L1','L2','L3','L4'].map(row).join('')}<div><img src="a/choir.png" alt=""><b>CHOIR</b><span>3, 4 or 5 start a bonus</span></div></div>
 <h3>THE LAMP</h3><p>Owen's lamp is wild: it stands in for every symbol except the choir photo, the villager token and Glenys.</p>
 <h3>FEATURES</h3><table>
 <tr><td>THE KNOCK</td><td>Haskett's men knock on the board: 3 to 8 positions on reels 2–5 turn into lamps before anything wins.</td></tr>
 <tr><td>THE FIRE</td><td>1 or 2 of reels 2–4 catch fire and the whole reel is wild for the first cascade, then it burns out and drops like any other.</td></tr>
 <tr><td>THE PIT</td><td>A win on a mining symbol (canary, pick, helmet, coal) gets ×2, ×3, ×5 or ×10.</td></tr>
 <tr><td>THE VILLAGE</td><td>3 to 8 villager tokens land on reels 1–4, each with a value, and Glenys lands on reel 5. After the last cascade she collects every token still on the board.</td></tr></table>
 <div class="duo"><img src="a/token_t2_a.png" alt=""><p>Villager token: its value is printed on its plate (×0.2 to ×50; in Final Stand ×0.5 to ×500).</p></div>
 <div class="duo"><img src="a/collector.png" alt=""><p>Glenys collects the tokens and shows the total.</p></div>
 <h3>BONUSES</h3><table>
 <tr><td>3 CHOIRS<br>THE STRIKE</td><td>10 spins. The Fire, The Knock and The Pit can come on any spin. 3 choirs again add 3 spins (up to 20).</td></tr>
 <tr><td>4 CHOIRS<br>THE UPRISING</td><td>8 spins with a multiplier on every win. It starts at ×2 and goes up by 1 after each winning cascade, up to ×25, and is kept for the whole bonus. 3 choirs again add 2 spins (up to 16).</td></tr>
 <tr><td>5 CHOIRS<br>FINAL STAND</td><td>6 spins. The Fire and the Village come on every spin. 3 choirs again add 2 spins (up to 12).</td></tr></table>
 <h3>MODES</h3><table>
 <tr><td>STANDARD</td><td>×1 the play.</td></tr><tr><td>MORE FEATURES</td><td>×1.5 the play: the four features come twice as often.</td></tr>
 <tr><td>BONUS CHANCE</td><td>×2 the play: the bonuses come more often.</td></tr>
 <tr><td>THE STRIKE<br>THE UPRISING<br>FINAL STAND</td><td>×60, ×120 and ×250 the play: the bonus starts straight away.</td></tr></table>
 <h3>CONTROLS</h3><table><tr><td>BONUS</td><td>The lamp opens the three bonuses and the three modes.</td></tr>
 <tr><td>TURBO</td><td>The lightning button runs every round faster. The results do not change.</td></tr>
 <tr><td>AUTO</td><td>Plays 10, 25, 50 or 100 spins in a row in the current mode; a tap on AUTO stops it. It stops by itself when the balance can't cover a spin.</td></tr></table>
 <h3>THE 25 LINES</h3><img class="lines" src="a/lines/rules_lines_25.png" alt="The 25 lines">
 <h3>BIG WINS</h3><p>Big, Mega and Epic wins light the valley, window by window; a ×20,000 round lights it all. A tap skips any scene.</p>
 <p style="margin-top:22px;color:var(--slate)">Malfunction voids all wins and plays. 18+. Play responsibly.</p>`;pg.prepend(close)})();
/* BONUS: the lamp in GO DOWN's old place opens Jack's six modes (his front end brings its own menu; this one lets the
   game page play every mode). TURBO (lightning) and AUTO sit with sound and rules (beside the spin on phones). */
(function(){const LB=$('#lampBtn');LB.setAttribute('aria-label','Bonus and modes');
 const tx=LB.querySelectorAll('text');tx[0].textContent='BONUS';tx[1].textContent='STANDARD';tx[1].setAttribute('font-size','14');tx[1].setAttribute('letter-spacing','2');
 const st=document.createElement('style');st.textContent=`
#modeMenu{position:absolute;left:26px;top:268px;z-index:12;display:none;flex-direction:column;background:var(--paper);box-shadow:7px 7px 0 var(--ink);outline:4px solid var(--edge);padding:8px 0;min-width:360px}
#modeMenu.on{display:flex}#modeMenu b{font:700 15px/1 'Courier Prime';letter-spacing:.18em;color:var(--slate);padding:8px 20px 4px}
#modeMenu button{font:900 28px/1 Stencil;letter-spacing:.02em;text-align:left;border:0;background:none;color:var(--ink);padding:10px 20px;cursor:pointer;display:flex;justify-content:space-between;gap:18px}
#modeMenu button:hover,#modeMenu button.on{background:var(--amber)}#modeMenu button i{font:700 16px/28px 'Courier Prime';font-style:normal;letter-spacing:.12em;color:var(--coal)}
#modeMenu hr{border:0;border-top:3px solid var(--ink);margin:6px 14px}
.rb.tg svg{width:40px;height:40px}.rb.tg.on{background:var(--amber);box-shadow:0 0 0 5px var(--edge),6px 6px 0 5px var(--ink)}.rb.tg.on svg *{fill:var(--ink);stroke:var(--ink)}
#autoBtn{position:relative}#autoBtn i{position:absolute;right:-12px;bottom:-12px;min-width:34px;padding:4px 6px 2px;background:var(--amber);color:var(--ink);font:900 20px/1 Stencil;font-style:normal;box-shadow:3px 3px 0 var(--ink)}#autoBtn i:empty{display:none}
#autoMenu{position:absolute;right:26px;top:118px;z-index:12;display:none;flex-direction:column;background:var(--paper);box-shadow:7px 7px 0 var(--ink);outline:4px solid var(--edge);padding:8px 0;min-width:220px}
#autoMenu.on{display:flex}#autoMenu b{font:700 15px/1 'Courier Prime';letter-spacing:.18em;color:var(--slate);padding:8px 20px 4px}#autoMenu button{font:900 30px/1 Stencil;text-align:left;border:0;background:none;color:var(--ink);padding:10px 20px;cursor:pointer}#autoMenu button:hover{background:var(--amber)}
#pdock{display:contents}
body.port #modeMenu{left:40px;top:auto;bottom:240px;min-width:520px}body.port #modeMenu button{font-size:38px;padding:16px 26px}body.port #modeMenu b{font-size:22px}
body.port #pdock{display:flex;position:absolute;right:46px;top:1748px;gap:26px;z-index:7}body.port .rb.tg svg{width:54px;height:54px}
body.port #autoMenu{right:40px;top:auto;bottom:220px;min-width:300px}body.port #autoMenu button{font-size:42px;padding:16px 26px}
body:not(.port) #tools{right:400px}
body.fsOn #lampBtn{visibility:hidden!important}
body.titleOn :is(#modeMenu,#autoMenu,#pdock),body.cine :is(#modeMenu,#autoMenu),body.port.cine #pdock,body.bwPlay :is(#modeMenu,#autoMenu){visibility:hidden!important}`;document.head.appendChild(st);
 $('#stage').insertAdjacentHTML('beforeend',`<div id="modeMenu"><b>BONUS</b>${['strike','uprising','final_stand'].map(k=>`<button data-m="${k}"><span>${MODES[k].n.toUpperCase()}</span><i>${BONUS[k].spins} SPINS</i></button>`).join('')}<hr><b>MODE</b>${
  ['base','more_features','bonus_chance'].map(k=>`<button data-m="${k}"><span>${MODES[k].n.toUpperCase()}</span><i>${k==='base'?'':k==='more_features'?'MORE FEATURES':'MORE BONUSES'}</i></button>`).join('')}</div>
 <div id="autoMenu"><b>AUTO SPINS</b>${[10,25,50,100].map(n=>`<button data-n="${n}">${n}</button>`).join('')}</div>`);
 const TB=`<button class="rb tg" id="turboBtn" aria-label="Turbo" aria-pressed="false"><svg viewBox="0 0 44 44"><path d="M25 4 9 25h11l-3 15 18-23H24z" fill="#EEE9DF"/></svg></button>`,
  AB=`<button class="rb tg" id="autoBtn" aria-label="Auto spins" aria-pressed="false"><svg viewBox="0 0 44 44"><path d="M33 15a12 12 0 1 0 3 10" fill="none" stroke="#EEE9DF" stroke-width="4.5" stroke-linecap="round"/><path d="M28 8l9 6-9 5z" fill="#EEE9DF"/><path d="M19 16v12l9-6z" fill="#EEE9DF"/></svg><i></i></button>`;
 const dock=$('.dock'),pd=document.createElement('div');pd.id='pdock';pd.innerHTML=TB+AB;dock.prepend(pd);   /* in the dock on desktop; body.port moves the pair beside the spin */
 const M=$('#modeMenu'),AM=$('#autoMenu'),T=$('#turboBtn'),A=$('#autoBtn');
 const mark=()=>{tx[1].textContent=MODES[MODE].n.toUpperCase();M.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.m===MODE))};mark();
 LB.onclick=e=>{e.stopPropagation();if(busy||roundOn||AUTO)return;AM.classList.remove('on');M.classList.toggle('on');SND.syn&&SND.syn('tick')};
 M.onclick=e=>{const b=e.target.closest('button');if(!b)return;e.stopPropagation();M.classList.remove('on');const k=b.dataset.m;
  if(MODES[k].b){roundSpin('buy_'+k);return}MODE=k;mark()};
 /* turbo: the round's pauses, scenes and moves run 2.2x (sound untouched); remembered per viewer */
 const tset=on=>{TURBO=on;T.classList.toggle('on',on);T.setAttribute('aria-pressed',on);try{localStorage.setItem('bv_turbo',on?1:0)}catch(e){}};
 try{tset(localStorage.getItem('bv_turbo')==='1')}catch(e){}
 T.onclick=e=>{e.stopPropagation();tset(!TURBO);SND.syn&&SND.syn('tick')};
 /* auto: 10 / 25 / 50 / 100 spins in the current mode; a tap on AUTO stops it; it stops when the balance can't cover a spin */
 const amark=()=>{A.querySelector('i').textContent=AUTO||'';A.classList.toggle('on',AUTO>0);A.setAttribute('aria-pressed',AUTO>0)};
 const nap=ms=>new Promise(r=>window.setTimeout(r,ms));
 async function autoRun(){while(AUTO>0){while(busy||roundOn)await nap(120);if(!AUTO)break;if(bal<BET*MODES[MODE].c){AUTO=0;break}
   AUTO--;amark();roundSpin();await nap(200);while(busy||roundOn)await nap(120);await nap(TURBO?150:450)}amark()}
 A.onclick=e=>{e.stopPropagation();M.classList.remove('on');if(window.BV_AUTO_ON&&window.BV_AUTO_ON()){window.BV_AUTO_STOP();return}if(AUTO){AUTO=0;amark();return}AM.classList.toggle('on');SND.syn&&SND.syn('tick')};
 AM.onclick=e=>{const b=e.target.closest('button');if(!b)return;e.stopPropagation();AM.classList.remove('on');if(window.BV_AUTO){window.BV_AUTO(+b.dataset.n);return}AUTO=+b.dataset.n;amark();autoRun()};
 addEventListener('click',e=>{if(!M.contains(e.target)&&!LB.contains(e.target))M.classList.remove('on');if(!AM.contains(e.target)&&!A.contains(e.target))AM.classList.remove('on')});
 setInterval(()=>{LB.disabled=busy||roundOn||AUTO>0},200)})();
/* DEMO menu: one entry per event (Jack's list) */
(function(){const M=$('#demoMenu');if(RQ.get('dev'))document.body.classList.add('dev');   /* the check menu is for review only: hidden unless ?dev=1 */
 ['tbgA','tbonus','tdrop','tup','tk','tk2','tgo'].forEach(id=>{const b=$('#'+id);if(b){b.hidden=true;b.style.setProperty('display','none','important')}})   /* hidden, not removed: the page's scene code still touches them */;M.querySelectorAll('b').forEach(b=>b.remove());
 M.insertAdjacentHTML('afterbegin',`<b>EVENTS</b><button id="r_line">Line win (25 lines)</button><button id="r_casc">Cascade</button><button id="r_knock">The Knock (wild takeover)</button><button id="r_fire">The Fire</button><button id="r_pit">The Pit (multiplier)</button><button id="r_vil">Tokens + collect</button><button id="r_big">Big win</button><button id="r_str">The Strike (3 choirs)</button><button id="r_upr">The Uprising (4 choirs, meter)</button><button id="r_fin">Final Stand (5 choirs)</button><button id="r_max">Max win</button><b>MORE</b>`);
 for(const id of ['tb','tm','te','tin','tlo','tx'])M.appendChild($('#'+id));
 const map={r_line:'line',r_casc:'cascade',r_knock:'knock',r_fire:'fire',r_pit:'pit',r_vil:'village',r_big:'bigwin',r_str:'strike',r_upr:'uprising',r_fin:'final_stand',r_max:'maxwin'};
 for(const id in map)$('#'+id).onclick=()=>roundSpin(map[id])})();
})();
