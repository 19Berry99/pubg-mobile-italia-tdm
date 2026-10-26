PUBG MOBILE ITALIA — TDM CALCULATOR
Versione iniziale web app installabile (PWA).

CONTENUTO
- index.html: struttura dell'app
- styles.css: grafica responsive
- app.js: inserimento, archivio locale, confronto, import/export JSON
- manifest.webmanifest: metadati installazione
- sw.js: cache offline di base
- icon.svg: icona app

COME PROVARLA
Per test locale, apri la cartella con un server web locale; l'installazione PWA richiede HTTPS oppure localhost.
Non basta aprire index.html direttamente dal file manager per provare l'installazione.

PUBBLICAZIONE SEMPLICE
1. Estrai lo ZIP.
2. Carica tutti i file nella cartella principale di un hosting statico che supporta HTTPS.
3. Apri l'indirizzo HTTPS dal Chrome su Android.
4. Nel menu Chrome scegli "Installa app" o "Aggiungi a schermata Home" (il testo varia in base alla versione).
5. Verifica che la pagina si apra in modalità app.

DATI E LIMITI
- I profili sono salvati nel localStorage del browser/dispositivo.
- Esporta regolarmente un JSON per fare backup.
- Questa versione NON legge automaticamente statistiche da PUBG Mobile.
- Il collegamento automatico richiede una fonte dati/API compatibile e autorizzata. Non inserire password PUBG.
- L'app non è affiliata a KRAFTON o PUBG MOBILE.
