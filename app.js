
const SUPABASE_URL = "https://envopjqpvrqfzzwrvbxs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudm9wanFwdnJxZnp6d3J2YnhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMTY3MzIsImV4cCI6MjEwODc5MjczMn0.6EegRloTJFGJysON9-9ZSZY1AaWHnxO-6A-RcyZMhXQ";

const $ = id => document.getElementById(id);

let players = [];
let currentSession = null;
let isAdmin = false;
let deferredInstall = null;

const client = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const form = $("playerForm");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function fmt(value) {
  return Number(value).toLocaleString("it-IT", {
    maximumFractionDigits: 2
  });
}

function stats(player) {
  const total = player.wins + player.losses;
  return {
    total,
    winRate: total ? player.wins / total * 100 : 0
  };
}

function sortedPlayers() {
  return [...players].sort((a, b) => {
    const rateDifference =
      stats(b).winRate - stats(a).winRate;

    return rateDifference ||
      b.wins - a.wins ||
      a.nickname.localeCompare(b.nickname, "it");
  });
}

function showMessage(id, message, error = false) {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error", error);
}

function updateAuthUI() {
  $("loginForm").hidden = Boolean(currentSession);
  $("logoutBtn").hidden = !currentSession;
  $("playerEditor").hidden = !isAdmin;
  $("managementPanel").hidden = !isAdmin;

  if (isAdmin) {
    $("authStatus").textContent =
      "Accesso amministratore attivo";
  } else if (currentSession) {
    $("authStatus").textContent =
      "Account autenticato, ma senza permessi SONIC";
  } else {
    $("authStatus").textContent =
      "Classifica pubblica · Accesso riservato agli amministratori";
  }

  if (!isAdmin) {
    $("playerList").innerHTML = "";
  }
}

async function checkAdmin() {
  isAdmin = false;

  if (currentSession?.user) {
    const { data, error } =
      await client.rpc("is_sonic_admin");

    if (!error && data === true) {
      isAdmin = true;
    }
  }

  updateAuthUI();
}

async function loadPlayers() {
  showMessage("rankingMessage", "Caricamento classifica...");

  const { data, error } = await client
    .from("sonic_players")
    .select("player_id,nickname,wins,losses,win_rate,created_at");

  if (error) {
    showMessage(
      "rankingMessage",
      "Errore nel caricamento della classifica. Riprova più tardi.",
      true
    );
    console.error(error);
    return;
  }

  players = (data || []).map(row => ({
    id: String(row.player_id),
    nickname: String(row.nickname || "Player"),
    wins: Number(row.wins) || 0,
    losses: Number(row.losses) || 0,
    createdAt: row.created_at
  }));

  render();
  showMessage("rankingMessage", "");
}

function render() {
  const ranking = sortedPlayers();

  $("playerCount").textContent = players.length;
  $("emptyState").hidden = players.length > 0;
  $("rankingWrap").hidden = players.length === 0;

  $("rankingBody").innerHTML = ranking.map((player, index) => {
    const result = stats(player);
    const medal = index === 0 ? " 🥇" :
      index === 1 ? " 🥈" :
      index === 2 ? " 🥉" : "";

    return `
      <tr>
        <td class="rank-number">${index + 1}${medal}</td>
        <td>
          <strong>${escapeHtml(player.nickname)}</strong>
          <small class="table-id">ID: ${escapeHtml(player.id)}</small>
        </td>
        <td class="win">${player.wins}</td>
        <td class="loss">${player.losses}</td>
        <td>${result.total}</td>
        <td>
          <strong class="win">${fmt(result.winRate)}%</strong>
          <div class="mini-bar">
            <span style="width:${result.winRate}%"></span>
          </div>
        </td>
      </tr>`;
  }).join("");

  if (isAdmin) {
    $("playerList").innerHTML = ranking.map((player, index) => {
      const result = stats(player);

      return `
        <article class="player-card" data-id="${escapeHtml(player.id)}">
          <div class="player-top">
            <div class="player-position">#${index + 1}</div>
            <div class="player-heading">
              <div class="player-name">${escapeHtml(player.nickname)}</div>
              <div class="player-id">ID: ${escapeHtml(player.id)}</div>
            </div>
            <button class="delete-btn" type="button"
              data-delete="${escapeHtml(player.id)}">✕</button>
          </div>

          <div class="stats">
            <div class="stat"><small>Vittorie</small><strong class="win">${player.wins}</strong></div>
            <div class="stat"><small>Sconfitte</small><strong class="loss">${player.losses}</strong></div>
            <div class="stat"><small>Partite totali</small><strong>${result.total}</strong></div>
            <div class="stat"><small>Win rate</small><strong class="win">${fmt(result.winRate)}%</strong></div>
          </div>

          <div class="bar">
            <span style="width:${result.winRate}%"></span>
          </div>

          <form class="edit-stats" data-edit="${escapeHtml(player.id)}">
            <div>
              <label>Vittorie</label>
              <input type="number" name="wins" min="0" step="1"
                value="${player.wins}" required>
            </div>
            <div>
              <label>Sconfitte</label>
              <input type="number" name="losses" min="0" step="1"
                value="${player.losses}" required>
            </div>
            <button class="secondary update-btn" type="submit">
              Aggiorna statistiche
            </button>
          </form>
        </article>`;
    }).join("");

    document.querySelectorAll("[data-delete]").forEach(button => {
      button.addEventListener("click", async () => {
        const id = button.dataset.delete;
        const player = players.find(p => p.id === id);
        if (!player) return;

        if (!confirm(`Vuoi eliminare ${player.nickname}?`)) return;

        button.disabled = true;

        const { error } = await client
          .from("sonic_players")
          .delete()
          .eq("player_id", id);

        if (error) {
          alert("Eliminazione non riuscita. Verifica i permessi.");
          button.disabled = false;
          console.error(error);
          return;
        }

        await loadPlayers();
      });
    });

    document.querySelectorAll("[data-edit]").forEach(editForm => {
      editForm.addEventListener("submit", async event => {
        event.preventDefault();

        const id = editForm.dataset.edit;
        const data = new FormData(editForm);
        const wins = Number(data.get("wins"));
        const losses = Number(data.get("losses"));

        if (
          !Number.isSafeInteger(wins) ||
          !Number.isSafeInteger(losses) ||
          wins < 0 || losses < 0
        ) {
          alert("Inserisci numeri interi pari o superiori a zero.");
          return;
        }

        const button = editForm.querySelector("button[type=submit]");
        button.disabled = true;

        const { error } = await client
          .from("sonic_players")
          .update({ wins, losses })
          .eq("player_id", id);

        if (error) {
          alert("Aggiornamento non riuscito. Verifica i permessi.");
          console.error(error);
          button.disabled = false;
          return;
        }

        await loadPlayers();
      });
    });
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  if (!isAdmin) {
    alert("Solo gli amministratori possono aggiungere giocatori.");
    return;
  }

  const id = $("playerId").value.trim();
  const nickname = $("nickname").value.trim();
  const wins = Number($("wins").value);
  const losses = Number($("losses").value);

  if (!id || !nickname) {
    showMessage("playerMessage", "Inserisci Player ID e nickname.", true);
    return;
  }

  if (
    !Number.isSafeInteger(wins) ||
    !Number.isSafeInteger(losses) ||
    wins < 0 || losses < 0
  ) {
    showMessage(
      "playerMessage",
      "Vittorie e sconfitte devono essere numeri interi non negativi.",
      true
    );
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  const { error } = await client
    .from("sonic_players")
    .upsert({
      player_id: id,
      nickname: nickname.slice(0, 50),
      wins,
      losses
    }, { onConflict: "player_id" });

  if (submitButton) submitButton.disabled = false;

  if (error) {
    showMessage(
      "playerMessage",
      "Salvataggio non riuscito. Controlla l'ID e i permessi.",
      true
    );
    console.error(error);
    return;
  }

  form.reset();
  $("wins").value = "0";
  $("losses").value = "0";
  showMessage("playerMessage", "Giocatore salvato correttamente.");
  await loadPlayers();
});

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const email = $("adminEmail").value.trim();
  const password = $("adminPassword").value;

  $("loginBtn").disabled = true;
  showMessage("loginMessage", "Accesso in corso...");

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password
  });

  $("loginBtn").disabled = false;

  if (error) {
    showMessage(
      "loginMessage",
      "Accesso non riuscito. Controlla email e password.",
      true
    );
    console.error(error);
    return;
  }

  currentSession = data.session;
  await checkAdmin();

  if (!isAdmin) {
    showMessage(
      "loginMessage",
      "Account valido, ma non autorizzato come amministratore SONIC.",
      true
    );
    return;
  }

  $("adminPassword").value = "";
  showMessage("loginMessage", "");
  await loadPlayers();
});

$("logoutBtn").addEventListener("click", async () => {
  const { error } = await client.auth.signOut();

  if (error) {
    alert("Impossibile completare la disconnessione.");
    console.error(error);
    return;
  }

  currentSession = null;
  isAdmin = false;
  updateAuthUI();
  showMessage("loginMessage", "Disconnessione completata.");
});

$("exportBtn").addEventListener("click", () => {
  const backup = players.map(player => ({
    id: player.id,
    nick: player.nickname,
    winsCount: player.wins,
    lossesCount: player.losses,
    createdAt: player.createdAt
  }));

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sonic-tdm-players.json";
  link.click();
  URL.revokeObjectURL(url);
});

$("importFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  if (!isAdmin) {
    alert("Solo gli amministratori possono importare giocatori.");
    event.target.value = "";
    return;
  }

  try {
    const data = JSON.parse(await file.text());

    if (!Array.isArray(data)) {
      throw new Error("Il file deve contenere una lista di giocatori.");
    }

    const map = new Map();

    for (const item of data) {
      const id = String(item.id ?? item.player_id ?? "").trim();
      const nickname = String(item.nick ?? item.nickname ?? "Player").trim();
      const wins = Number(item.winsCount ?? item.wins ?? 0);
      const losses = Number(item.lossesCount ?? item.losses ?? 0);

      if (
        !id || !nickname ||
        !Number.isSafeInteger(wins) ||
        !Number.isSafeInteger(losses) ||
        wins < 0 || losses < 0
      ) {
        throw new Error("Uno o più giocatori contengono dati non validi.");
      }

      map.set(id, {
        player_id: id,
        nickname: nickname.slice(0, 50),
        wins,
        losses
      });
    }

    const records = [...map.values()];
    if (!records.length) {
      alert("Il file non contiene giocatori da importare.");
      return;
    }

    const { error } = await client
      .from("sonic_players")
      .upsert(records, { onConflict: "player_id" });

    if (error) throw error;

    alert(`Importazione completata: ${records.length} giocatori elaborati.`);
    await loadPlayers();
  } catch (error) {
    alert("Importazione non riuscita. Controlla il formato del file e i permessi.");
    console.error(error);
  } finally {
    event.target.value = "";
  }
});

$("clearBtn").addEventListener("click", async () => {
  if (!isAdmin) return;

  if (!confirm("ATTENZIONE: vuoi eliminare TUTTI i giocatori dalla classifica SONIC?")) {
    return;
  }

  const { error } = await client
    .from("sonic_players")
    .delete()
    .not("player_id", "is", null);

  if (error) {
    alert("Cancellazione non riuscita. Verifica i permessi.");
    console.error(error);
    return;
  }

  await loadPlayers();
});

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

async function initialize() {
  if (SUPABASE_ANON_KEY === "INCOLLA_QUI_LA_TUA_CHIAVE_ANON") {
    showMessage(
      "rankingMessage",
      "Configurazione incompleta: inserisci la chiave pubblica anon di Supabase in app.js.",
      true
    );
    return;
  }

  const { data, error } = await client.auth.getSession();

  if (error) {
    showMessage("loginMessage", "Impossibile verificare la sessione.", true);
    console.error(error);
  }

  currentSession = data?.session ?? null;

  await checkAdmin();
  await loadPlayers();
}

client.auth.onAuthStateChange((_event, session) => {
  currentSession = session;

  setTimeout(async () => {
    await checkAdmin();
    await loadPlayers();
  }, 0);
});

updateAuthUI();
initialize();
