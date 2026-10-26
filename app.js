const $ = id => document.getElementById(id);
const form = $("playerForm"), idInput=$("playerId"), nickInput=$("nickname"), winsInput=$("wins"), lossesInput=$("losses");
let players = [];
let deferredInstall = null;

try { players = JSON.parse(localStorage.getItem("pubgTdmPlayers") || "[]"); if(!Array.isArray(players)) players=[]; } catch { players=[]; }

function save(){ try { localStorage.setItem("pubgTdmPlayers",JSON.stringify(players)); } catch(e){ alert("Impossibile salvare i dati in questo browser. Esporta un backup."); } }
function syncOther(source){
  const v=Number(source.value);
  if(source.value!=="" && Number.isFinite(v) && v>=0 && v<=100){
    if(source===winsInput) lossesInput.value=(100-v).toFixed(1).replace(/\.0$/,"");
    else winsInput.value=(100-v).toFixed(1).replace(/\.0$/,"");
  }
}
winsInput.addEventListener("input",()=>syncOther(winsInput));
lossesInput.addEventListener("input",()=>syncOther(lossesInput));

form.addEventListener("submit",e=>{
  e.preventDefault();
  const id=idInput.value.trim(), win=Number(winsInput.value), loss=Number(lossesInput.value);
  if(!id){alert("Inserisci il Player ID.");return;}
  if(players.some(p=>p.id===id)){alert("Questo ID è già presente.");return;}
  if(!Number.isFinite(win)||!Number.isFinite(loss)||win<0||win>100||loss<0||loss>100||Math.abs(win+loss-100)>0.01){alert("Le percentuali devono essere valide e totalizzare il 100%.");return;}
  players.push({id,nick:nickInput.value.trim()||"Player "+(players.length+1),win,loss,selected:true,createdAt:new Date().toISOString()});
  save();render();form.reset();winsInput.value="50";lossesInput.value="50";idInput.focus();
});
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function render(){
  $("playerCount").textContent=players.length;
  $("emptyState").hidden=players.length>0;
  $("playerList").innerHTML=players.map((p,i)=>`<article class="player-card">
    <div class="player-top">
      <input class="select-player" type="checkbox" aria-label="Seleziona ${escapeHtml(p.nick)} per il confronto" data-select="${i}" ${p.selected?"checked":""}>
      <div style="min-width:0;flex:1"><div class="player-name">${escapeHtml(p.nick)}</div><div class="player-id">ID: ${escapeHtml(p.id)}</div></div>
      <button class="delete-btn" type="button" data-delete="${i}" aria-label="Elimina player">✕</button>
    </div>
    <div class="stats"><div class="stat"><small>Vittorie TDM</small><strong class="win">${p.win}%</strong></div><div class="stat"><small>Sconfitte TDM</small><strong class="loss">${p.loss}%</strong></div></div>
    <div class="bar" aria-label="Percentuale vittorie"><span style="width:${p.win}%"></span></div>
  </article>`).join("");
  document.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>{players.splice(Number(b.dataset.delete),1);save();render();}));
  document.querySelectorAll("[data-select]").forEach(c=>c.addEventListener("change",()=>{players[Number(c.dataset.select)].selected=c.checked;save();renderComparison();}));
  renderComparison();
}
function renderComparison(){
  const chosen=players.filter(p=>p.selected).sort((a,b)=>b.win-a.win);
  $("comparison").hidden=chosen.length===0;
  $("comparisonList").innerHTML=chosen.map((p,i)=>`<div class="compare-row"><div class="compare-title"><span>${i+1}. ${escapeHtml(p.nick)}</span><strong>${p.win}%</strong></div><div class="bar"><span style="width:${p.win}%"></span></div></div>`).join("");
}
$("exportBtn").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(players,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="pubg-tdm-players.json";a.click();URL.revokeObjectURL(url);
});
$("importFile").addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    const data=JSON.parse(await file.text());
    if(!Array.isArray(data)||data.some(p=>!p.id||!Number.isFinite(Number(p.win))||!Number.isFinite(Number(p.loss))))throw Error();
    const map=new Map(players.map(p=>[p.id,p]));
    data.forEach(p=>map.set(String(p.id),{id:String(p.id),nick:String(p.nick||"Player"),win:Number(p.win),loss:Number(p.loss),selected:p.selected!==false}));
    players=[...map.values()].filter(p=>p.win>=0&&p.win<=100&&p.loss>=0&&p.loss<=100&&Math.abs(p.win+p.loss-100)<0.01);
    save();render();alert("Importazione completata.");
  }catch{alert("File JSON non valido o percentuali non corrette.");}
  e.target.value="";
});
$("clearBtn").addEventListener("click",()=>{if(confirm("Vuoi cancellare tutti i player salvati in questo browser? Esporta prima un backup, se necessario.")){players=[];save();render();}});
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;$("installBtn").hidden=false;});
$("installBtn").addEventListener("click",async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$("installBtn").hidden=true;});
if("serviceWorker" in navigator && location.protocol.startsWith("http")) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
render();
