# Datensparmodus — gemessenes Budget und Lane-Aufteilung

Angelegt 2026-07-26. Anlass: Fleet vom Handy über Mobilfunk gefahren, ~500 MB in 20 Minuten.
Dieses Dokument ist der gemeinsame Bezugspunkt für die vier Lanes `data-saver-a` … `data-saver-d`
— wer hier arbeitet, liest es zuerst und trägt sein Ergebnis unten nach.

## 1 — Was gemessen wurde

Alles am Live-Server (`100.64.0.1:8790`) am 2026-07-26, mit den echten Panes.
Keine Schätzung außer da, wo es ausdrücklich dabeisteht.

| Quelle | Messung | pro 20 min, ein Tab |
|---|---|---|
| `/api/sessions`, alle 2 s (`src/client.ts`, `setInterval(… , 2000)`) | **112 410 B pro Antwort**, unkomprimiert → 3,37 MB/min | **≈ 67 MB** |
| WS-Live-Bytes | 96 173–186 259 B/min über *alle* Panes; Handy = 1 Pane (`isMobile()`) | ≈ 1,5 MB |
| WS-Reconnect-Seed, Handy-Pfad (resize + `capture-pane -S -3000`) | **10 351–158 952 B pro Reconnect** (s8/s2/s3/s1) | × Anzahl Abbrüche |
| WS-Reconnect-Seed, Owner-Pfad gleicher Breite (`REPLAY_TAIL`) | **bis 2 000 000 B pro Reconnect** — alle Stream-Files liegen bei 2,3–4,7 MB, der Deckel greift also immer voll | × Anzahl Abbrüche |
| Seitenladen | `app.js` 591 666 B + `index.html` 58 808 B, `Cache-Control: no-store`, kein gzip | 650 KB pro Load |
| Chat-View erstes Öffnen | 155 750–314 111 B (`/transcript?after=0`) | einmalig pro Öffnen |
| Board-Polls alle 3 s | **0** — `renderBoard()` bricht bei `isMobile()` ab | 0 |

### Der dominierende Posten

Von den 112 410 B sind **107 521 B das `tasks`-Array**: 39 Einträge mit vollem Prompt-Text,
der größte allein 15 068 B, **23 davon `status: "done"`**. Das geht 30×/Minute an jeden
verbundenen Client. `slots` — der eigentliche Zweck des Endpunkts — sind 3 648 B.

### Kompressibilität (gemessen, nicht geschätzt)

- roher Terminal-Stream (2-MB-Tail von `s2.raw`): **12,3×**
- `app.js`: 591 666 → 158 128 B (**3,7×**)
- `/api/sessions`-Payload: 112 410 → 41 934 B (nur 2,7× — die Task-Texte sind unique;
  deshalb ist Kompression hier *kein* Ersatz für Lane A, sondern ihre Ergänzung)

## 2 — Offene Lücke, ehrlich benannt

Die Messung vom 26.07. erklärt ~70 MB / 20 min, nicht 500. Die Differenz war **nicht gemessen**.
Plausibel, aber unbewiesen: mehrere gleichzeitig offene Clients (jeder zahlt die
3,37 MB/min separat), Reconnect-Churn auf schlechtem Funk, Tab-Reloads.
Lane B hat den Zähler gebaut, der das zu einer Messung macht — abgelesen am **2026-08-07**
(`GET /api/transport`, read-only; Fenster 55 Snapshots à 30 s = **27,1 min**, ein entferntes
Gerät, echte Owner-Nutzung). Vollbericht: `briefs/data-saver-messung-2026-08-07.md`.

**Eine Zahl pro Hypothese, gemessen:**

| Hypothese | Messwert |
|---|---|
| **H1** — mehrere gleichzeitig offene Clients | **1** entferntes Gerät (`peerCount`), **1,01 sichtbare Dashboard-Tabs** (0,504 req/s ÷ 2 s Konstante). Marginaler sichtbarer Tab: 260 KB/min allein für `/api/sessions`, 327–335 KB/min ganzer Tab. Hidden-Tab: **0**. Grenze: der Zähler schlüsselt nach *Adresse*, nicht nach Tab |
| **H2** — Reconnect-Churn | **17 WS-Opens** in 27,1 min (0,63/min), `openNow` verließ nie 1. Davon 2 Seitenladen + 7 Panewechsel = 9/17 = 53 % nachweislich Nutzeraktion ⇒ **höchstens 8/17 = 47 % echter Churn — eine OBERGRENZE, kein Messwert** (ein Panewechsel auf einem Pane in Terminal-Ansicht hinterlässt exakt dieselbe Spur wie ein Abbruch). 46 % der 1,98 MB WS-Bytes sind Reseed, 52,5 KB pro Reseed (vor Deflate) |
| **H3** — Tab-Reloads | **2**. Exakt, nicht geschlossen (`index.html` ist `no-store`, jeder Load erreicht den Server). Kaltladen heute 211 342 B gzip, Warmladen ~23 KB gegen 650 474 B im Juli ohne gzip = **3,1× / 28×** besser |

**Was das für die 430 MB heißt.** Gegen die Stückkosten aus §1 braucht jede der drei Hypothesen
eine unplausible Ereigniszahl:

```
H1 zusätzliche gleichzeitige Clients : 6,4 weitere Clients (je 67,4 MB / 20 min)
H2 Reconnects, Handy-Pfad            : 2705 Reseeds = einer alle 0,4 s
H3 Tab-Reloads                       :  661 Loads   = einer alle 1,8 s
=> heutige gemessene Raten, bepreist mit Juli-Stückkosten, erreichen höchstens 85 MB von 430 MB.
```

Die Lücke deckt **ohne vierte Hypothese** der eine Mechanismus, der bereits gemessen war:
112 410 B × 30/min = 3,37 MB/min ⇒ 128 min für 430 MB, 2,5 h für 500 MB. Und **vor Lane D
pausierte nichts**, wenn der Tab in den Hintergrund ging (`f323fb4^:src/client.ts` nennt
`document.hidden` an genau 3 Stellen, alle drei in `armReload()`) — ein Handy mit offenem, aber
unbeachtetem Tab zahlte den vollen Takt weiter.

**Der Satz unten fällt nicht, er verengt sich.** Die drei genannten Hypothesen sind als Erklärung
der 430 MB **quantitativ unplausibel**; die naheliegende Erklärung ist **Wanduhrzeit auf dem
bereits gemessenen Poll**. Das ist **Arithmetik auf Juli-Stückkosten plus heutigen Raten, keine
Messung des Juli** — und mobile Browser drosseln Hintergrund-Timer auf eine Weise, die diese
Ablesung nicht rekonstruieren konnte.
**Also weiterhin: niemand schreibt eine Ursache für die 430 MB hin, die er nicht gemessen hat.**

### Drei Blindstellen des Zählers — OFFEN, und gemessen *unbeantwortbar*

Nicht unbeantwortet, sondern von der heutigen Konstruktion nicht beantwortbar. Wer eine davon als
gelöst hinschreibt, hat dieses Kapitel falsch fortgeschrieben.

1. **`wsBytes` ist VOR-Deflate** — eine Decke, nie der Draht. Bun meldet die komprimierte
   Framegröße nicht zurück (steht so im Typ, s. Lane B unten).
2. **`countHttp` bekommt nur Body-Bytes.** Request- und Response-Header zählt niemand; bei
   ~90 req/min grob **45 KB/min ≈ 13 % oben drauf, unsichtbar**.
3. **Nicht-Persistenz.** `const transportSince = Date.now()` (`server.ts#transportSince`) und die Maps
   daneben sind reiner Prozessspeicher; ein Schreiber auf Platte existiert nicht. Jeder
   `srv`-Neustart nullt den Zähler — das längste verfügbare Fenster war deshalb **53,8 min**.
   Für die nächste 500-MB-Frage bräuchte es einen Zähler, der einen Deploy überlebt.

## 3 — Lane-Aufteilung

Vier Lanes, geschnitten nach *Kollisionsfläche*, nicht nach Kapitelnummer.

| Lane | Inhalt | Hauptregionen |
|---|---|---|
| **A — payload** | `tasks` aus dem 2-s-Poll: Digest statt Volltext, Volltext on demand | `server.ts` `/api/sessions`-Handler; `src/client.ts` `refresh()` / `renderQueue()` |
| **B — transport** | gzip für JSON + statische Assets, `perMessageDeflate`, `Cache-Control` statt `no-store`, **plus** der Byte-Zähler | `server.ts` `json()`, Asset-Serving, `websocket: {` |
| **C — reconnect** | `REPLAY_TAIL`, Owner-Seed line-aligned wie der Guest-Pfad, Backoff statt fixer 1500 ms | `server.ts` `REPLAY_TAIL` + `websocket.open`; `src/client.ts` `connect()`/`onclose` |
| **D — mode** | der eigentliche Schalter: Poll-Intervall, Pause bei `document.hidden`, Seed-Zeilen, Chat-Poll | `src/client.ts` Intervalle + Settings |

**Warum der Byte-Zähler in B steckt und keine eigene Lane ist:** er umschließt exakt
dieselben drei Sendepfade wie die Kompression (`json()`, Asset-Response, `ws.send`).
Getrennt wären das garantierte Drei-Wege-Konflikte ohne jeden Gegenwert.

### Landing-Reihenfolge: A → B → C → D

D fasst `refresh()` in `src/client.ts` an — dieselbe Funktion, die A umschreibt. Das ist
der einzige eingeplante Konflikt; D landet zuletzt und rebased auf A.
Außerdem hängt Ds *Nutzen* an A: nach A ist der Poll ~5 KB, ein 15-s-Intervall spart dann
kaum noch etwas und kostet bis zu 15 s Nachlauf beim Aktivitätspunkt. D soll das messen
und die Intervalle danach wählen, nicht vorher festlegen.

### Erwartete Wirkung

A allein: 3,37 → ~0,15 MB/min (**−95 % des gemessenen Dauerverbrauchs**).
A+B: dazu 12,3× auf dem Terminal-Strom und 0 statt 650 KB pro Reload.
C: deckelt den einzigen unbegrenzten Posten im Budget.

## 4 — Was beim Arbeiten gilt

- Verifikation ist **dieselbe Messung wie oben**, nicht ein Gefühl:
  `curl -s -H "cookie: fleet=<token>" http://100.64.0.1:8790/api/sessions | wc -c` × Pollrate.
  Vorher/Nachher-Zahl gehört in den Report.
- Die Decke wird seit `e901287` auch maschinell gehalten: `e2e/tasks.ts` prüft „the 16-slot
  sessions payload stays under 14 KB with a 15 KB task queued and bounded event facts" als
  Schwellen-Check (kein Byte-Exakt-Vergleich, darum flake-frei; Herleitung:
  `docs/messungen/k3-payload-decke-klaerung-2026-08-25.md`).
- Zwei fremde Lanes waren am 2026-07-26 in `server.ts` unterwegs (Hunks bei 4755–4819
  und 6008–6029). Keine Überschneidung mit den Regionen oben, aber 6029 liegt nur ~79
  Zeilen vor dem `websocket: {`-Block von B/C — beim Landen hinschauen.
- Kein Punkt dieses Plans darf Verhalten ändern, außer D. A, B und C sind reine
  Transport-/Payload-Arbeit und müssen für den Nutzer unsichtbar sein.

## 5 — Ergebnisse

Die Vorher/Nachher-Zahl jeder Lane gehört in **ihre Commit-Message**, nicht hierher:
vier Lanes, die denselben Absatz anfassen, sind ein Vier-Wege-Konflikt für null Gegenwert.
Diese Liste wird beim Landen aus den Commit-Messages gefüllt. Alle vier sind gelandet; die
Zeilen unten sind aus den Commit-Bodies gezogen, jede nennt ihren SHA — der Body ist das
Register, die Zusammenfassung hier nur der Zeiger.

- **A — payload** (`e901287`, `perf(payload): /api/sessions carries task digests, the prompt
  texts move to their own route`): `/api/sessions` sendet `TaskDigest` statt Volltext, die
  Prompt-Texte ziehen auf `GET /api/tasks` (owner-only) um; der Client cacht sie nach id, weil
  ein Task-Text nach Anlage unveränderlich ist. Derselbe Live-Task-Satz durch die neue Form:
  **112 410 → 8 281 B (13,6×), 3,37 → 0,25 MB/min pro Tab.** Pro Task 2 757 → 87 B. `refresh()`
  bewusst nicht angefasst, damit D billig darauf rebased.
- **B — transport** (`0fa9d2f`, `perf(transport): gzip, a cacheable app.js, real per-message
  deflate + the byte ledger`): gzip auf jeder HTTP-Antwort, `app.js?v=<mtime>` immutable statt
  `no-store`, echtes Per-Message-Deflate, plus der Byte-Zähler (`GET /api/transport`). Gemessen
  vorher→nachher: **`app.js` 591 666 → 158 128 B (3,74×)**, zweiter Load **0 B** aus dem Cache;
  `index.html` 58 808 → 13 783 B (4,27×); **Seitenladen 650 474 → 171 911 B erstmalig, 13 783 B
  danach**; WS-Burst 27 656 → 1 546 B Draht (17,7×). Befund fürs nächste Mal: `perMessageDeflate:
  true` allein tut **nichts** (0,99×) — `send()` muss `compress` pro Aufruf setzen.
- **C — reconnect** (`a70e1d0`, `perf(reconnect): the owner reseed follows the guest path — a
  capture, not a 2 MB raw tail`): der Owner-Zweig von `websocket.open` seedet jetzt wie der
  Gast-Pfad aus `capture-pane`, nicht aus einem 2-MB-Roh-Tail; Client-Retry 1,5/3/6/12 s
  gedeckelt auf 15 s statt fix 1500 ms. Ein Reconnect aller zwölf Panes: **10 578 939 →
  695 829 B, 15,2× weniger** (pro Pane 11,5×–27×). Der 2-MB-Deckel band auf 3 von 12 Panes voll.
  Kontinuität trägt `seedUntil` pro Socket — ein Overlap ist eine doppelte Zeile, eine Lücke eine
  Zeile, die nie ankommt.
- **D — mode** (`739fae9`, `feat(data-saver): the mode switch — pause while hidden, stretch the
  polls, cap the seed`): die einzige der vier, die Verhalten ändert. Bedingungslos: ein
  Hintergrund-Tab pollt **nichts** — **3,28 MB/min (0,46 MB/min nach A) → 0**, Rückkehr = genau
  eine Nachhol-Runde. Pro Gerät schaltbar (🐢, `localStorage "fleet.datasaver"`): Poll 2 → 10 s
  (nach A **9,18 → 1,84 MB / 20 min** bei 15,9 KB Payload, bzw. 2,93 → 0,59 MB bei A-Zielgröße
  5 KB), Chat 1 → 3 s (0,22 → 0,07 MB), Brief 3 → 10 s (1,83 → 0,55 MB), Seed 3000 → 500 Zeilen
  (`?seed=N`, serverseitig auf [50, `SEED_LINES`] geklemmt — ein Client kann nur *weniger*
  Scrollback verlangen). Das Terminal ist in beiden Modi unangetastet.

*SHA-Hinweis: die Historie wurde vor der Veröffentlichung umgeschrieben. Die vier SHAs oben sind
die von `main` aus erreichbaren. `briefs/data-saver-messung-2026-08-07.md` nennt für C und D die
Zwillinge der alten Historie (`7722de4`, `f323fb4`); A/B hießen dort `bc4e975`/`da0857e`. Die
Commit-Bodies sind byte-identisch (geprüft 2026-08-08).*
