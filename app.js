
const SUPABASE_URL = "https://envopjqpvrqfzzwrvbxs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudm9wanFwdnJxZnp6d3J2YnhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMTY3MzIsImV4cCI6MjEwODc5MjczMn0.6EegRloTJFGJysON9-9ZSZY1AaWHnxO-6A-RcyZMhXQ";

const $ = id => document.getElementById(id);

const client = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

let players = [];
let isAdmin = false;
let currentSession = null;
let deferredInstall = null;

const form = $("playerForm");
const idInput = $("playerId");
const nickInput = $("nickname");
const winsInput = $("wins");
const lossesInput = $("losses");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function stats(p) {
  const wins = Number(p.wins) || 0;
  const losses = Number(p.losses) || 0;
  const total = wins + losses;

  return {
    total,
    winRate: total ? wins / total * 100 : 0
  };
}

function fmt(n) {
  return n.toLocaleString("it-IT", {
    maximumFractionDigits: 1
  });
}

function sortedPlayers() {
  return [...players].sort((a, b) => {
    const sa = stats(a);
    const sb = stats(b);

    return sb.winRate - sa.winRate ||
      b.wins - a.wins ||
      a.nickname.localeCompare(b.nickname, "it");
  });
}

function setMessage(id, message) {
  const el = $(id);
  if (el) el.textContent = message;
}

function updateAuthUI() {
  $("loginForm").hidden = Boolean(currentSession);
  $("logoutBtn").hidden = !currentSession;

  $("authStatus").textContent = isAdmin
    ? "Amministratore connesso"
    : currentSession
      ? "Utente non autorizzato"
      : "Non connesso";

  $("playerEditor").hidden = !isAdmin;
  $("managementPanel").hidden = !isAdmin;

  if (currentSession && !isAdmin) {
    setMessage(
      "loginMessage",
      "Questo account non è autorizzato a gestire la classifica."
    );
  }
}

async function checkAdmin() {
  isAdmin = false;

  if (currentSession) {
    const { data, error } = await client.rpc("is_sonic_admin");

    if (!error) isAdmin = data === true;
  }

  updateAuthUI();
}

async function loadPlayers() {
  setMessage("rankingMessage", "Caricamento classifica...");

  const { data, error } = await client
    .from("sonic_players")
    .select("id, player_id, nickname, wins, losses, win_rate, created_at")
    .order("win_rate", { ascending: false })
    .order("wins", { ascending: false });

  if (error) {
    console.error("Errore caricamento classifica:", error);
    setMessage(
      "rankingMessage",
      "Impossibile caricare la classifica. Verifica la configurazione Supabase."
    );
    return;
  }

  players = (data || []).map(p => ({
    id: String(p.player_id),
    nickname: p.nickname || "Player",
    wins: Number(p.wins) || 0,
    losses: Number(p.losses) || 0,
    createdAt: p.created_at
  }));

  setMessage(
    "rankingMessage",
    players.length ? "" : "La classifica è pronta."
  );

  render();
}

async function login(event) {
  event.preventDefault();

  const email = $("adminEmail").value.trim();
  const password = $("adminPassword").value;

  $("loginBtn").disabled = true;
  setMessage("loginMessage", "Accesso in corso...");

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    currentSession = data.session;
    await checkAdmin();

    if (isAdmin) {
      setMessage("loginMessage", "Accesso amministratore riuscito.");
      await loadPlayers();
    }

    $("adminPassword").value = "";
  } catch (error) {
    setMessage("loginMessage", "Accesso non riuscito: " + error.message);
  } finally {
    $("loginBtn").disabled = false;
  }
}

async function logout() {
  const { error } = await client.auth.signOut();

  if (error) {
    setMessage("loginMessage", "Errore durante l'uscita: " + error.message);
    return;
  }

  currentSession = null;
  isAdmin = false;
  updateAuthUI();
  setMessage("loginMessage", "Hai effettuato la disconnessione.");
}

async function savePlayer(event) {
  event.preventDefault();

  if (!isAdmin) {
    alert("Devi accedere con un account amministratore.");
    return;
  }

  const playerId = idInput.value.trim();
  const nickname = nickInput.value.trim() || "Player";
  const wins = Number(winsInput.value);
  const losses = Number(lossesInput.value);

  if (!playerId) {
    setMessage("playerMessage", "Inserisci il Player ID.");
    return;
  }

  if (
    !Number.isSafeInteger(wins) ||
    !Number.isSafeInteger(losses) ||
    wins < 0 ||
    losses < 0
  ) {
    setMessage(
      "playerMessage",
      "Vittorie e sconfitte devono essere numeri interi non negativi."
    );
    return;
  }

  setMessage("playerMessage", "Salvataggio in corso...");

  const { error } = await client
    .from("sonic_players")
    .upsert(
      {
        player_id: playerId,
        nickname,
        wins,
        losses
      },
      { onConflict: "player_id" }
    );

  if (error) {
    console.error("Errore salvataggio:", error);
    setMessage(
      "playerMessage",
      "Salvataggio non riuscito: " + error.message
    );
    return;
  }

  form.reset();
  winsInput.value = "0";
  lossesInput.value = "0";

  setMessage("playerMessage", "Giocatore salvato correttamente.");
  await loadPlayers();
}

async function deletePlayer(playerId) {
  if (!isAdmin) return;

  const player = players.find(p => p.id === playerId);
  if (!player) return;

  if (!confirm("Vuoi eliminare il profilo di " + player.nickname + "?")) {
    return;
  }

  const { error } = await client
    .from("sonic_players")
    .delete()
    .eq("player_id", playerId);

  if (error) {
    alert("Eliminazione non riuscita: " + error.message);
    return;
  }

  await loadPlayers();
}

async function updateStats(event) {
  event.preventDefault();

  if (!isAdmin) return;

  const editForm = event.currentTarget;
  const playerId = editForm.dataset.edit;
  const fd = new FormData(editForm);
  const wins = Number(fd.get("wins"));
  const losses = Number(fd.get("losses"));

  if (
    !Number.isSafeInteger(wins) ||
    !Number.isSafeInteger(losses) ||
    wins < 0 ||
    losses < 0
  ) {
    alert("Inserisci numeri interi non negativi.");
    return;
  }

  const { error } = await client
    .from("sonic_players")
    .update({ wins, losses })
    .eq("player_id", playerId);

  if (error) {
    alert("Aggiornamento non riuscito: " + error.message);
    return;
  }

  await loadPlayers();
}

function render() {
  const ranking = sortedPlayers();

  $("playerCount").textContent = players.length;
  $("emptyState").hidden = players.length !== 0;
  $("rankingWrap").hidden = players.length === 0;

  $("rankingBody").innerHTML = ranking.map((p, i) => {
    const s = stats(p);
    const medal = i === 0 ? " 🥇" :
      i === 1 ? " 🥈" :
      i === 2 ? " 🥉" : "";

    return `
      <tr>
        <td class="rank-number">${i + 1}${medal}</td>
        <td>
          <strong>${escapeHtml(p.nickname)}</strong>
          <small class="table-id">ID: ${escapeHtml(p.id)}</small>
        </td>
        <td class="win">${p.wins}</td>
        <td class="loss">${p.losses}</td>
        <td>${s.total}</td>
        <td>
          <strong class="win">${fmt(s.winRate)}%</strong>
          <div class="mini-bar">
            <span style="width:${s.winRate}%"></span>
          </div>
        </td>
      </tr>`;
  }).join("");

  if (!isAdmin) {
    $("playerList").innerHTML = "";
    return;
  }

  $("playerList").innerHTML = ranking.map((p, i) => {
    const s = stats(p);

    return `
      <article class="player-card">
        <div class="player-top">
          <div class="player-position">#${i + 1}</div>
          <div class="player-heading">
            <div class="player-name">${escapeHtml(p.nickname)}</div>
            <div class="player-id">ID: ${escapeHtml(p.id)}</div>
          </div>
          <button class="delete-btn" type="button"
            data-delete="${escapeHtml(p.id)}"
            aria-label="Elimina ${escapeHtml(p.nickname)}">✕</button>
        </div>

        <div class="stats">
          <div class="stat"><small>Vittorie</small><strong class="win">${p.wins}</strong></div>
          <div class="stat"><small>Sconfitte</small><strong class="loss">${p.losses}</strong></div>
          <div class="stat"><small>Partite totali</small><strong>${s.total}</strong></div>
          <div class="stat"><small>Win rate</small><strong class="win">${fmt(s.winRate)}%</strong></div>
        </div>

        <div class="bar"><span style="width:${s.winRate}%"></span></div>

        <form class="edit-stats" data-edit="${escapeHtml(p.id)}">
          <div>
            <label>Vittorie</label>
            <input type="number" min="0" step="1" name="wins"
              value="${p.wins}" required>
          </div>
          <div>
            <label>Sconfitte</label>
            <input type="number" min="0" step="1" name="losses"
              value="${p.losses}" required>
          </div>
          <button class="secondary update-btn" type="submit">
            Aggiorna statistiche
          </button>
        </form>
      </article>`;
  }).join("");

  document.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => {
      deletePlayer(button.dataset.delete);
    });
  });

  document.querySelectorAll("[data-edit]").forEach(editForm => {
    editForm.addEventListener("submit", updateStats);
  });
}

function exportPlayers() {
  const data = players.map(p => ({
    id: p.id,
    nick: p.nickname,
    winsCount: p.wins,
    lossesCount: p.losses,
    createdAt: p.createdAt || new Date().toISOString()
  }));

  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sonic-tdm-players.json";
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importPlayers(event) {
  if (!isAdmin) {
    alert("Devi accedere come amministratore.");
    event.target.value = "";
    return;
  }

  const file = event.target.files[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());

    if (!Array.isArray(data)) {
      throw new Error("Il file deve contenere una lista JSON.");
    }

    for (const p of data) {
      const playerId = String(p.id ?? p.player_id ?? "").trim();
      const nickname = String(p.nick ?? p.nickname ?? "Player");
      const wins = Number(p.winsCount ?? p.wins ?? 0);
      const losses = Number(p.lossesCount ?? p.losses ?? 0);

      if (
        !playerId ||
        !Number.isSafeInteger(wins) ||
        !Number.isSafeInteger(losses) ||
        wins < 0 ||
        losses < 0
      ) {
        throw new Error("Un profilo contiene dati non validi.");
      }

      const { error } = await client
        .from("sonic_players")
        .upsert(
          { player_id: playerId, nickname, wins, losses },
          { onConflict: "player_id" }
        );

      if (error) throw error;
    }

    await loadPlayers();
    alert("Importazione completata.");
  } catch (error) {
    alert("Importazione non completata: " + error.message);
  } finally {
    event.target.value = "";
  }
}

async function clearPlayers() {
  if (!isAdmin) return;

  if (!confirm("Vuoi eliminare tutti i profili dalla classifica condivisa?")) {
    return;
  }

  for (const player of [...players]) {
    const { error } = await client
      .from("sonic_players")
      .delete()
      .eq("player_id", player.id);

    if (error) {
      alert("Operazione interrotta: " + error.message);
      await loadPlayers();
      return;
    }
  }

  await loadPlayers();
}

async function initialize() {
  $("loginForm").addEventListener("submit", login);
  $("logoutBtn").addEventListener("click", logout);
  form.addEventListener("submit", savePlayer);
  $("exportBtn").addEventListener("click", exportPlayers);
  $("importFile").addEventListener("change", importPlayers);
  $("clearBtn").addEventListener("click", clearPlayers);

  client.auth.onAuthStateChange((_event, session) => {
    currentSession = session;

    setTimeout(async () => {
      await checkAdmin();
      await loadPlayers();
    }, 0);
  });

  const { data, error } = await client.auth.getSession();

  if (error) {
    setMessage("rankingMessage", "Errore di autenticazione Supabase.");
    return;
  }

  currentSession = data.session;
  await checkAdmin();
  await loadPlayers();
}

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstall = event;
  $("installBtn").hidden = false;
});

$("installBtn").addEventListener("click", async () => {
  if (!deferredInstall) return;

  deferredInstall.prompt();
  await deferredInstall.userChoice;

  deferredInstall = null;
  $("installBtn").hidden = true;
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}

if (window.supabase) {
  initialize().catch(error => {
    console.error(error);
    setMessage("rankingMessage", "Errore inizializzazione: " + error.message);
  });
} else {
  setMessage(
    "rankingMessage",
    "Libreria Supabase non caricata. Ricarica la pagina e riprova."
  );
}
