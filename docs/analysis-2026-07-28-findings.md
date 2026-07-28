# Session 10 — was fünf Agenten gemessen haben

**2026-07-28.** Begleitband zu `analysis-2026-07-28-register.md` (dem Behauptungs-Register mit
Belegart und Verdikt pro Zeile). Hier stehen die **Messungen**, nicht der Plan: ein Plan rottet mit
jedem Land, eine Messung nicht. Jede Zahl ist von einem Agenten erhoben und, wo es hieß, vom
Hauptsession-Modell nachgeprüft.

Methode, weil sie das Ergebnis erklärt: drei Agenten arbeiteten **blind** (sahen die vorherige
Analyse nicht, nannten ihr *eigenes* Kriterium zuerst), zwei **sehend** (griffen benannte
Behauptungen und das Auswahlkriterium an). Die Erweiterung kam ausnahmslos von den blinden.

---

## 1. Nicht extrahieren — gemessen, nicht gemutmaßt

`docs/structural-plan.md` schlägt vor, die Ledger-Schicht aus `server.ts` zu extrahieren. Die
Messung widerlegt das:

- `server.ts` hat 7.109 Zeilen, davon **4.777 Code** (2.179 reine Kommentarzeilen, 153 leer).
  6× die Hausgrenze, nicht 9×.
- **68 Top-Level-veränderliche Bindungen.** Die einzige Naht mit *null* geteiltem Zustand ist
  Transport+Static: **238 Zeilen = 3,3 %** der Datei.
- `server.ts` wuchs 26.→27.07. von **6.201 auf 7.109 Zeilen (+908 in zwei Tagen)**. Die beste
  Extraktion ist ein halber Tag Wachstum.
- Die Ledger-Disziplin **existiert bereits in-file**: `appendEvent` + `readLedger` + `readEventLog`
  = 48 Zeilen. Fünf der sechs Trails laufen hindurch. Der Rest sind **vier Bypass-Aufrufstellen,
  ~10 Zeilen** (`laneOwnerPrompts:3476`, `continuityView:5524`, Boot `:4862`, `logPrompt:378`).
- **Eine der vier von M2 versprochenen Verbesserungen wäre eine Rechte-Regression:** „eine
  Projektion für Route und Client" — `/api/lane-outcomes` liefert dem Owner Rohzeilen,
  `ledgersView` dem Steward eine Whitelist, und `server.ts:5537` begründet das ausdrücklich.
- **Reihenfolgefalle:** die Below-the-line-Notiz „`prompts.jsonl` joining `appendEvent` (one line)"
  ist keine Zeile. `prompts.jsonl` steht bei **3.440.064 B = 69 %** der 5-MB-Rotationsschwelle, und
  die zwei Ein-Generationen-Leser sind nur harmlos, **weil der Schreiber nie rotiert**. Erst die
  Leser umstellen, dann den Schreiber.

**Acht Invarianten überleben nur durch Ko-Lokation** und wären nach einem Schnitt unerzwingbar:
drei synchrone Reservierungen vor dem ersten `await` (`laneSpawn:6341`, `mergeStart:6477`,
`auditDraining:3163`), `auditDraining`s Same-Turn-Microtask-Fenster (`:3193`), die **54**
`saveState`-Aufrufstellen über 21 persistierte Felder, das `saveState`↔Boot-Restore-Paar,
die Intent-vor-Tat-Ordnung, die Boot-Sequenz, die elf Cache-Invalidierungen in `openSlot`, und
`tickGit`s Intra-Pass-Ordnung.

**Der Ausbau-Pfad, der hier nachweislich funktioniert:** sechs Module wurden erfolgreich extrahiert
(`continuity.ts`, `lane-signals.ts`, `merge-prompt.ts`, `enhance-prompt.ts`, `src/backoff.ts`,
`src/md.ts`) — **alle mit null Modulzustand, null I/O, null Rück-Import**. `server.ts` besitzt
Zustand und Datei, das Modul besitzt die Ableitung. **Ableitungen hinaus, niemals Zustand.**

## 2. Löschbar: ~1.800 Zeilen (8 %), 7 Dateien, 14 Flaggen, 4 Routen

Jede Zeile mit **negativer Evidenz**, nicht bloß fehlender positiver.

| Was | Zeilen | Beweis |
|---|---|---|
| `steward-arena.sh` + `docs/steward-arena.md` | 487 | **Bereits kaputt**: `:155` kopiert 2 von 4 lokalen Modulen, stirbt seit ≥07-26 an der Modulauflösung. Null Referenzen im Repo. `:154` formuliert die Invariante, die `:155` verletzt |
| Interventions-Outcome-Messung (Produzent, Tally, Prädikat, Route, Boot-Restore, ~300 e2e-Zeilen) | ~590 | `grep -c 'steward_send' audit.jsonl` = **0** über ein unrotiertes Log seit 07-21. Der einzige Produzent (`outcomePending.push`, `server.ts:5130`) hat **nie** gelaufen. `GET /api/steward/outcomes` hat **keinen** Aufrufer |
| Transport-Byte-Ledger (`/api/transport`) | ~100 | 0 Aufrufer außer e2e. **`transportWs` NICHT löschen** — `send(data, compress ?? true)` (`:4359`) ist der einzige Ort, an dem per-message deflate wirklich eingeschaltet wird |
| `/api/repo-base` + `repoBases` | ~35 | live `{}`, kein Client-Aufrufer |
| Sechs Nur-Schreib-Felder | ~15 | `Auto.created`, `Auto.lastRun`, `PostLandAuditRow.startedAt`/`cmd`, `OutcomeReview.dirty`, `LandRecord.repo`. Die ersten beiden reiten auf `/api/sessions`, das alle 2 s pollt |
| Fünf tote Docs | ~550 | Prämisse erledigt. **Erst bergen:** Axiome A4/A8/A9/A10 aus `autonomy-plan.md` (vier Docs zitieren sie nach Nummer) und §6 aus `gate-coverage.md` |

**`Slot.mission` (~84 Z.)** ist mechanisch der sauberste Kandidat (`grep -aic mission src/client.ts`
= 0, kein UI-Schreibweg) — aber **zwei Tage alt**. Eine Owner-Entscheidung, keine Lane.

### NICHT löschen — die wichtigere Liste

- **Zehn nie gefeuerte `AuditEvent`-Literale.** `land_recovered`, `land_recover_fail`,
  `land_note_fail`, `repo_undo_land`, `share_auth_lock` u. a. sind Recovery- und Fail-closed-Pfade:
  **nie gefeuert = sie tun ihre Arbeit.**
- **`VERIFY_SKIP_EXIT = 42`.** Null Vorkommen im Ledger ist die *Erfolgsbedingung*.
- **Die sieben `*_CMD`-Testnähte.** Ohne sie beginnt jede Suite echte Modell-Sessions zu starten.
- **`e2e-postland-audit.sh` / `fleet-e2e-postland-audit.ts`.** Kaputt, *weil* niemand sie fährt —
  **Aufrufer geben, nicht löschen**. Sie sind der einzige Beweis des Tier-2-Pfads.
- **Das Share-Subsystem** (`src/share.ts`, live `shares: []`). Unbenutzt ≠ entfernbar.
- **`runCleanReview`s Nicht-`ok`-Zweige.** Live `shadow`; der `gate`-Zweig ist das erklärte Ziel
  der K2-Messreihe.

## 3. 37 Muss-übereinstimmen-Paare — davon 31 still, 27 billig ableitbar

**Kein Bündel Einzelfixes: ein Mechanismus, den dieses Repo bereits viermal gebaut hat,** ohne zu
merken, dass es einer ist — `e2e/security.ts:73` extrahiert Routen aus `server.ts`-Quelltext und
verlangt Gleichheit; `lane-signals.ts:48` generiert die Prosa aus dem Prädikat; `server.ts:5433`
speist Validator und Prompt aus einem Array; `e2e/harness.ts:63` ersetzt eine Env-Whitelist durch
eine **Regel**. Drei dieser Listen sind nie still gedriftet.

**Sechs Paare sind jetzt gebrochen:**
1. `steward-arena.sh:155` (s. o.)
2. **`BACKGROUND_MARKS`** (`server.ts:1779`): **2 Marker gegen 8 `summaryViaSession`-Aufrufstellen.**
   `summarizerSids` ist in-memory und stirbt beim Restart → danach wird ein fremdes Resolver-,
   Commit- oder Digest-Transcript dem Owner als **eigene Unterhaltung des Slots** serviert.
3. Der Render-Key (`src/client.ts:2604`) lässt `git.behind` aus, das bei `:2386` gerendert wird
4. `docs/verify-tiering.md:322/360` sagt, Tier-2 sei auskommentiert — produktiv läuft es
5. **102 von 117 geprüften Doc-`file:line`-Referenzen sind tot** (15 treffen, 98 daneben, 4 falsch),
   Abweichungen bis **+2463 Zeilen**; am schlimmsten `docs/security-model.md`, wo **jeder** geprüfte
   Anker daneben zeigt
6. `CLAUDE.md`s NUL-Byte-Regel (s. §5)

**Die Gegenprobe entscheidet die Konvention: 38 von 38 Symbol-Ankern** der Form
`` (`server.ts`, grep `runCleanReview`) `` lösen auf. **Null tot.** Zeilennummern in eine täglich
um ~450 Zeilen wachsende Datei sind nicht pflegbar; Symbolanker sind es.

**Die Form des Fixes:** (1) `e2e/pins.ts` — reine Textprüfungen über das Repo, Millisekunden,
gehört als *erster* Schritt in `watchdog.sh:71`. (2) `src/protocol.ts` — die geteilten Konstanten
und Interfaces; danach macht tsc, das ohnehin gatet, jede dieser Drifts zu einem Compile-Fehler.
(3) Eine Konvention statt eines Werkzeugs für die Doc-Referenzen.

## 4. Konfigurationsfläche: 42 Flaggen, 31 ohne jeden Sensor

Konfiguration erreicht den Server aus **sechs** Orten mit sechs Lebensdauern: `watchdog.sh`s
srv-Spawn-Zeile (einmalig vor `while true` expandiert → **eingefroren bis `launchctl kickstart`**,
und nur 2 der 10 Werte tragen einen entsprechenden Kommentar), die **globale tmux-Server-Umgebung**,
`.env`, `server.ts`-Defaults, `fleet.json`, die Wrapper.

- **`FLEET_CMD=claude --dangerously-skip-permissions` steht in keiner Datei, die man prüfen würde.**
  `watchdog.sh` setzt es **null Mal**. Der Live-Wert kommt aus der tmux-Server-Umgebung (Prozess
  vom 2026-07-12); `.env` trägt denselben Wert als unsichtbares Backup darunter (echte Env gewinnt,
  empirisch geprüft). Überlebt jedes `kill-session` und jedes kickstart.
- **`FLEET_SOCK`/`FLEET_PORT`-Defaults *sind* der Live-Socket und -Port**, und Produktion läuft auf
  den Defaults. Der einzige Schutz ist die Konvention, dass jedes der sieben Spawn-Skripte sie setzt.
- **9 Variablen werden gelesen und von *nichts* gesetzt** — hartkodierte Defaults im Env-Var-Kostüm.
- **30 der 42 werden von Test-Wrappern gesetzt.** Das ist die Randbedingung, die „eine
  Konfigurationsdatei" ausschließt; sieben `*_CMD`-Haken müssen pro Prozess auf ein Skript im
  `$$`-Scratch zeigen können, und `auditChildEnv` muss *jedes* `FLEET_*` als **Regel** strippen.
- **`deployGap` wird grün über eine `watchdog.sh`-Änderung, die nicht live ist:** die Datei endet
  nicht auf `.md`, setzt also `codeBehind:true`; das Ritual bootet srv, `BOOT_HEAD` stempelt neu →
  grün, während die laufende `sh`-Schleife die alten Strings hält.

**Der billigste hohe Gewinn ist deshalb nicht Zusammenlegen, sondern Sichtbarkeit:** `state.sh`
leitet HEAD, Lanes, Ledger, Prozesse und Hygiene ab — und **null Konfiguration**.

## 5. Verifikations-Substrat: 8.903 Zeilen

- **Der Produktions-Agenten-Spawn-Pfad hatte null Testabdeckung.** Jeder Konsument ist
  `FLEET_*_CMD ? summaryViaSubprocess : summaryViaSession`; jeder Wrapper setzt den Stand-in,
  `watchdog.sh` setzt keinen → 100 % der unbeaufsichtigten Spawns nahmen den ungetesteten Zweig.
  *(Teilweise geschlossen durch die Lane vom 28.07.: Tool-Profil ist jetzt ein erforderlicher
  typisierter Parameter, also ein Compile-Fehler statt einer Lücke.)*
- **Der Trail deckte nur `e2e-isolated` ab.** `FLEET_E2E_SUITE` wird von **nichts** gesetzt, und
  keiner der vier Einzeldatei-Harnesses importiert `writeTrailRow` — die **158 Checks, die den
  Pre-Land-Gate ausmachen, hinterließen null Beobachtung.**
- **26 Checks (`outcomes.ts` ×21, `slots.ts` ×5) sind Regex über `src/client.ts`-Quelltext**, nicht
  über Verhalten — einer prüft **Einrückungstiefe** als Stellvertreter für Kontrollfluss. Der
  Post-Land-Alarm, das gesamte Sicherheitsnetz für ein Tier-2, das nichts gatet, hängt daran.
  **Nicht löschen — umbenennen** (`client-source:`) und nach `src/` ziehen, damit sie echte Tests
  werden.
- **Die vier Einzeldatei-Harnesses sind nur deshalb Einzeldateien, weil die `cp`-Listen `e2e/`
  nicht enthalten.** Ihre Trennung ist eine Server-Boot-Differenz, keine Code-Organisationsfrage —
  also: Plumbing falten, Runner getrennt lassen. Das gibt dem Gate zum ersten Mal einen Trail.

## 6. Der Per-Check-Trail hat sich bewährt

Am 28.07. adjudizierte er den ersten roten Post-Land-Audit **in einer Abfrage statt in einem
Sieben-Minuten-Wiederholungslauf**: Baum `c0439f15` (vom Vortag, ohne die fragliche Änderung)
zeigte denselben `FIX1`-Check auf **4 Läufen 0/1/0/1** — Nicht-Determiniertheit per Konstruktion
bewiesen, an einem Baum, der die Änderung gar nicht enthielt.

## 7. Was auch nach fünf Agenten ungeprüft ist

- **Die Assertion-Rümpfe der e2e-Module** wurden nur teilweise gelesen. Ein Check, dessen *Name*
  mehr behauptet als sein Körper prüft, wäre in weiten Teilen dieses Durchgangs unsichtbar geblieben.
- **`server.ts:4923-5765` (Steward-Region, 842 Zeilen)** hat kein Agent in der Tiefe gelesen —
  Produktionscode mit eigenem Token.
- `index.html`/CSS, `lane-signals.ts`, `continuity.ts`, `merge-prompt.ts`, `enhance-prompt.ts`.
- **Es wurde nichts ausgeführt.** Alles ist statisches Lesen plus Ledger-Messung.
