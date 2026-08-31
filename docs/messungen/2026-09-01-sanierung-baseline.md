---
frage: Besteht der Baum der Generalsanierung (49038af..acf3614, Code-Delta null — nur docs/AGENTS.md) drei konsekutive serielle ./e2e-isolated.sh-Läufe als P0-Baseline?
urteil: NEIN wie gefordert — 1 von 3 grün. Lauf 1 (6f173d7) ALL PASS in 1639 s; Läufe 2+3 rot mit derselben 4-5-Check-Familie (pi-unfenced Event-Zustellung bleibt send-uncertain; plus einmal subject-gone). Die Familie steht NICHT im Flake-Register (grep pi-unfenced/kill-switch/send-uncertain in docs/verify-tiering.md leer) — per Beweisordnung §11.7 gilt sie als echt, bis das Gegenteil bewiesen ist; Nicht-Determinismus ist NICHT bewiesen (die Wiederholung fiel identisch).
bereich: [sanierung, baseline, verify, watch-delivery]
belege: [Scratchpad baseline/run1-3.log der Session 37da4ca0, kept instance fleet-e2e-instance-80791 (Lauf 2), kept instance fleet-e2e-instance-26770 (Lauf 3), docs/verify-tiering.md]
nicht-gemessen: Ursache der Familie (kept instances nicht seziert); ob Live-Fleet-Last (Program-MAIN Slot 10 aktiv ab ~21:00, codex-Slots 2/5 durchgehend) der Diskriminator ist; ein vierter Lauf bei stiller Maschine
stand: 2026-09-01
---

# P0-Baseline der Generalsanierung — 3 serielle e2e-isolated-Läufe, 2026-08-31

Maschine: der Live-Host, bun 1.3.9. Läufe strikt seriell aus dem Haupt-Checkout
(Suite-Mutex + ein Skript). Zwischen den Läufen bewegte sich main NUR um docs/AGENTS.md
(6f173d7 → 00d9b58 → acf3614) — **Code-Delta über alle drei Läufe: null.**

| Lauf | Start | HEAD | dirty beim Stagen | Exit | Dauer | Ergebnis |
|---|---|---|---|---|---|---|
| 1 | 20:45:42 | 6f173d7 | nein | 0 | 1639 s | **ALL PASS** |
| 2 | 21:13:01 | 00d9b58 | **ja** | 1 | 1583 s | 4 FAILURES |
| 3 | 21:39:24 | acf3614 | ja (nur untracked Doc) | 1 | 1584 s | 5 FAILURES |

## Die Failure-Familie (Läufe 2+3, 4 Checks identisch)

- `after kill-switch release the pending event reaches live pi-unfenced once as delivered, never
  acked by tmux` — Event bleibt `send-uncertain`, `deliveredAt:null`
- `the fixed completion notification has exactly one matching prompt-log row on pi-unfenced` (0 Zeilen)
- `the pi-unfenced event remains one-shot across later ticks and never records the old skip`
- `rollback live falsifier: recycled slot identity leaves the successor owner's draft byte-for-byte`
- nur Lauf 3 zusätzlich: `subject-gone: the torn-down lane's undelivered event is terminal as
  itself, unackable, and frees its budget`

Gemeinsame Wurzelform: EINE Zustellung, die nie ankommt, zieht die Nachbar-Checks mit — dieselbe
Kaskadenform wie die dokumentierten Familien in verify-tiering §11.2c, aber **diese Checks stehen
dort NICHT**. Kein Freifahrtschein.

## Messbedingungen, ehrlich

- **Lauf 2 ist als Messung KONTAMINIERT:** die gründende Session hat während des Stagens einen
  Cherry-Pick im Checkout aufgelöst (AGENTS.md mit Konfliktmarkern, HANDOFF-Commit) — Verstoß
  gegen das eigene Fenster-Prinzip, im Protokoll als Lektion vermerkt. Die Failure-Signaturen
  sind allerdings nicht AGENTS.md-förmig.
- Lauf 3 lief bei unberührtem Baum (dirty nur durch eine untracked Doc-Datei von Slot 10);
  **fiel identisch** → §11.7: Nicht-Determinismus damit NICHT bewiesen.
- Umgebungs-Delta zwischen Lauf 1 (grün) und Läufen 2+3 (rot): ab ~21:00 arbeitete die neue
  Program-MAIN (Slot 10, opus, high) aktiv im Haupt-Checkout; die GLM-Lane landete 21:10 und
  wurde abgeräumt. Die codex-Slots 2/5 liefen während ALLER drei Läufe.

## Nächste Schritte (Empfehlung an die Program-MAIN, Beweisordnung §11.7)

1. **Ein vierter serieller Lauf bei wirklich stiller Maschine** (Fenster-Checkliste des Plans
   anwenden; Slot-10-Arbeit pausieren): grün ⇒ Last-These bestätigt, Familie als
   lastsensitiv ins Register (verify-tiering) EINTRAGEN und Baseline mit 3 stillen Läufen
   wiederholen; rot ⇒ echter Umgebungs- oder Coderegress — die kept instances 80791/26770
   sezieren (server.log der Instanz, erster FAIL zuerst).
2. Bis dahin gilt: **die P0-Baseline ist NICHT abgeschlossen** — kein P4/P5-Slice stützt sich
   auf ein Audit-Grün, solange diese Familie unerklärt ist. P1 (docs-only, DOC_RULE-Gate ohne
   Suite) ist davon nicht blockiert.

---

## Nachtrag 2026-08-31, Slot 10 (Program-MAIN) — Lauf 4 beantwortet das offene Verdikt zur Haelfte

**Lauf 4: ALL PASS, 3349 PASS / 0 FAIL, 1544 s**, HEAD `ce24b0d`, Baum sauber vor UND nach dem
Lauf, keine konkurrierende Suite, Last 1,53 beim Start, Slot 10 (diese Session) waehrend des
gesamten Laufs **absichtlich untaetig**. Dieselbe Check-Zahl wie der gruene Lauf 1.

| Lauf | HEAD | dirty | Slot 10 | PASS | Ergebnis |
|---|---|---|---|---|---|
| 1 | `6f173d7` | nein | noch nicht aktiv | 3349 | ALL PASS |
| 2 | `00d9b58` | ja | arbeitet | 3345 | 4 FAILURES |
| 3 | `acf3614` | ja (nur untracked Doc) | arbeitet | 3344 | 5 FAILURES |
| 4 | `ce24b0d` | nein | **untaetig** | 3349 | ALL PASS |

**Bewiesen:** Code-Delta ueber alle vier Laeufe null (nur `docs/`/`AGENTS.md`), zwei gruen und
zwei rot ⇒ **Nicht-Determinismus ist nach der Beweisordnung §11.7 direkt bewiesen; die Familie ist
KEIN Codregress.** Die Familie ist als **§11.2j** ins Register eingetragen (`docs/verify-tiering.md`),
wo sie vorher fehlte.

**NICHT bewiesen — und die Empfehlung von oben ist damit nur zur Haelfte eingeloest:** der
Diskriminator. Ueber alle vier Laeufe ko-variieren ZWEI Variablen perfekt (Baum dirty ·
Program-MAIN arbeitet im Haupt-Checkout). Lauf 4 hat beide gleichzeitig entfernt und kann sie
deshalb nicht trennen. Die Last-These bleibt die plausiblere (alle Mitglieder sind Live-Pane-/
tmux-Zustellungsaussagen; eine untrackte Markdown-Datei in der gestagten Kopie hat keinen Pfad zur
tmux-Zustellung), **plausibel ist aber nicht gemessen**. Der isolierende Lauf waere: dirty machen,
Controller untaetig lassen — ein Lauf, ~26 min, bisher nicht gefahren.

**Ehrlich zur Fenster-Checkliste:** eine "stille Maschine" war nicht herstellbar und wurde nicht
behauptet. Zum Startzeitpunkt waren 13 Agenten-Sessions lebendig, sieben davon in diesem Checkout.
Herstellbar war: keine konkurrierende Suite, sauberer Baum, Controller untaetig. Genau das ist
gemessen worden, und genau so ist die Bedingung zu zitieren.

**Stand der P0-Baseline: weiterhin NICHT abgeschlossen.** Gruen sind Lauf 1 und Lauf 4, aber nicht
DREI KONSEKUTIVE. Naechster Schritt dieser Session: zwei weitere Laeufe unter den Bedingungen von
Lauf 4 (sauberer Baum, Controller untaetig, keine Nachbarsuite). Drei konsekutive gruene Laeufe
schliessen P0; ein Rot darin faellt zurueck auf §11.2j und auf die Sektion der beiden aufbewahrten
Instanzen. **P4/P5 bleiben bis dahin zu; P1 ist docs-only und davon frei.**
