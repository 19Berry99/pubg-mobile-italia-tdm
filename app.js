const $ = id => document.getElementById(id);
const form = $("playerForm");
const idInput = $("playerId");
const nickInput = $("nickname");
const winsInput = $("wins");
const lossesInput = $("losses");
let players = [];
let deferredInstall = null;

try {
  const stored = JSON.parse(localStorage.getItem("pubgTdmPlayers") || "[]");
  if (Array.isArray(stored)) {
    players = stored.filter(p => p && p.id).map(p => ({
      id: String(p.id),
      nick: String(p.nick || "Player"),
      winsCount: Math.max(0, Math.floor(Number(p.winsCount ?? p.wins ?? 0) || 0)),
      lossesCount: Math.max(0, Math.floor(Number(p.lossesCount ?? p.losses ?? 0) || 0)),
      createdAt: p.createdAt || new Date().toISOString()
    }));
  }
} catch { players = []; }

function save() {
  try { localStorage.setItem("pubgTdmPlayers", JSON.stringify(players)); }
  catch { alert("Impossibile salvare i dati in questo browser. Esporta un backup."); }
}
function stats(p) {
  const total = p.winsCount + p.lossesCount;
  return {
    total,
    winRate: total ? p.winsCount / total * 100 : 0,
    lossRate: total ? p.lossesCount / total * 100 : 0
  };
}
function fmt(n) { return n.toLocaleString("it-IT", { maximumFractionDigits: 1 }); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function sortedPlayers() {
  return [...players].sort((a,b) => {
    const sa = stats(a), sb = stats(b);
    return sb.winRate - sa.winRate || b.winsCount - a.winsCount || a.nick.localeCompare(b.nick, "it");
  });
}

form.addEventListener("submit", e => {
  e.preventDefault();
  const id = idInput.value.trim();
  const winsCount = Number(winsInput.value);
  const lossesCount = Number(lossesInput.value);
  if (!id) return alert("Inserisci il Player ID.");
  if (players.some(p => p.id === id)) return alert("Questo Player ID è già presente.");
  if (!Number.isSafeInteger(winsCount) || !Number.isSafeInteger(lossesCount) || winsCount < 0 || lossesCount < 0)
    return alert("Vittorie e sconfitte devono essere numeri interi pari o superiori a zero.");
  players.push({
    id,
    nick: nickInput.value.trim() || "Player " + (players.length + 1),
    winsCount, lossesCount,
    createdAt: new Date().toISOString()
  });
  save(); render();
  form.reset(); winsInput.value = "0"; lossesInput.value = "0"; idInput.focus();
});

function render() {
  $("playerCount").textContent = players.length;
  $("emptyState").hidden = players.length > 0;
  $("rankingWrap").hidden = players.length === 0;

  $("rankingBody").innerHTML = sortedPlayers().map((p, i) => {
    const s = stats(p);
    const medal = i === 0 ? " 🥇" : i === 1 ? " 🥈" : i === 2 ? " 🥉" : "";
    return `<tr>
      <td class="rank-number">${i + 1}${medal}</td>
      <td><strong>${escapeHtml(p.nick)}</strong><small class="table-id">ID: ${escapeHtml(p.id)}</small></td>
      <td class="win">${p.winsCount}</td><td class="loss">${p.lossesCount}</td>
      <td>${s.total}</td><td><strong class="win">${fmt(s.winRate)}%</strong><div class="mini-bar"><span style="width:${s.winRate}%"></span></div></td>
    </tr>`;
  }).join("");

  $("playerList").innerHTML = sortedPlayers().map(p => {
    const s = stats(p);
    return `<article class="player-card" data-id="${escapeHtml(p.id)}">
      <div class="player-top">
        <div class="player-position">#${sortedPlayers().findIndex(x => x.id === p.id) + 1}</div>
        <div class="player-heading"><div class="player-name">${escapeHtml(p.nick)}</div><div class="player-id">ID: ${escapeHtml(p.id)}</div></div>
        <button class="delete-btn" type="button" data-delete="${escapeHtml(p.id)}" aria-label="Elimina ${escapeHtml(p.nick)}">✕</button>
      </div>
      <div class="stats">
        <div class="stat"><small>Vittorie</small><strong class="win">${p.winsCount}</strong></div>
        <div class="stat"><small>Sconfitte</small><strong class="loss">${p.lossesCount}</strong></div>
        <div class="stat"><small>Partite totali</small><strong>${s.total}</strong></div>
        <div class="stat"><small>Win rate</small><strong class="win">${fmt(s.winRate)}%</strong></div>
      </div>
      <div class="bar" aria-label="Percentuale vittorie"><span style="width:${s.winRate}%"></span></div>
      <form class="edit-stats" data-edit="${escapeHtml(p.id)}">
        <div><label>Vittorie</label><input type="number" min="0" step="1" name="winsCount" value="${p.winsCount}" required></div>
        <div><label>Sconfitte</label><input type="number" min="0" step="1" name="lossesCount" value="${p.lossesCount}" required></div>
        <button class="secondary update-btn" type="submit">Aggiorna statistiche</button>
      </form>
    </article>`;
  }).join("");

  document.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => {
    const p = players.find(x => x.id === btn.dataset.delete);
    if (p && confirm(`Vuoi eliminare ${p.nick}?`)) {
      players = players.filter(x => x.id !== btn.dataset.delete);
      save(); render();
    }
  }));
  document.querySelectorAll("[data-edit]").forEach(editForm => editForm.addEventListener("submit", e => {
    e.preventDefault();
    const p = players.find(x => x.id === editForm.dataset.edit);
    const fd = new FormData(editForm);
    const w = Number(fd.get("winsCount")), l = Number(fd.get("lossesCount"));
    if (!p) return;
    if (!Number.isSafeInteger(w) || !Number.isSafeInteger(l) || w < 0 || l < 0)
      return alert("Inserisci numeri interi pari o superiori a zero.");
    p.winsCount = w; p.lossesCount = l;
    save(); render();
  }));
}

$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(players, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "pubg-tdm-players.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("importFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data) || data.some(p => !p || !p.id)) throw Error();
    const map = new Map(players.map(p => [p.id, p]));
    data.forEach(p => {
      const winsCount = Number(p.winsCount ?? p.wins ?? 0);
      const lossesCount = Number(p.lossesCount ?? p.losses ?? 0);
      if (!Number.isSafeInteger(winsCount) || !Number.isSafeInteger(lossesCount) || winsCount < 0 || lossesCount < 0) throw Error();
      map.set(String(p.id), {id:String(p.id), nick:String(p.nick || "Player"), winsCount, lossesCount, createdAt:p.createdAt || new Date().toISOString()});
    });
    players = [...map.values()];
    save(); render(); alert("Importazione completata.");
  } catch { alert("File JSON non valido."); }
  e.target.value = "";
});
$("clearBtn").addEventListener("click", () => {
  if (confirm("Vuoi cancellare tutti i player salvati in questo browser? Esporta prima un backup, se necessario.")) {
    players = []; save(); render();
  }
});
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; $("installBtn").hidden = false; });
$("installBtn").addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt(); await deferredInstall.userChoice;
  deferredInstall = null; $("installBtn").hidden = true;
});
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
render();
