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

Die Messung erklärt ~70 MB / 20 min, nicht 500. Die Differenz ist **nicht gemessen**.
Plausibel, aber unbewiesen: mehrere gleichzeitig offene Clients (jeder zahlt die
3,37 MB/min separat), Reconnect-Churn auf schlechtem Funk, Tab-Reloads.
Lane B baut den Zähler, der das beim nächsten Mal zu einer Messung macht.
**Bis dahin: niemand schreibt eine Ursache für die 430 MB hin, die er nicht gemessen hat.**

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
- Zwei fremde Lanes waren am 2026-07-26 in `server.ts` unterwegs (Hunks bei 4755–4819
  und 6008–6029). Keine Überschneidung mit den Regionen oben, aber 6029 liegt nur ~79
  Zeilen vor dem `websocket: {`-Block von B/C — beim Landen hinschauen.
- Kein Punkt dieses Plans darf Verhalten ändern, außer D. A, B und C sind reine
  Transport-/Payload-Arbeit und müssen für den Nutzer unsichtbar sein.

## 5 — Ergebnisse

Die Vorher/Nachher-Zahl jeder Lane gehört in **ihre Commit-Message**, nicht hierher:
vier Lanes, die denselben Absatz anfassen, sind ein Vier-Wege-Konflikt für null Gegenwert.
Diese Liste wird beim Landen aus den Commit-Messages gefüllt.

- A —
- B —
- C —
- D —
