# Was Agenten sehen — Stand 2026-08-06

Fünf Rollen, drei Fragen je Rolle, eine Rangliste mit Schnittlinie.

**Die Leitfrage des Owners, wörtlich:** *„was Agenten aktuell wie sehen und wie sie bestimmte
tools benutzen usw. Ich hab das Gefühl das in den Projekt eigenen Sessions der Agent doch so ein
paar mehr Info's über andere Slots und was überhaupt so passiert, zur Verfügung stand."*

**Die drei Fragen, und die Lücken dazwischen sind der Befund:**

- **(a) GEWÄHRT** — welche Credential trägt die Rolle, welche Routen beantworten sie, was liefern
  die wirklich zurück?
- **(b) ERREICHBAR** — was könnte die Rolle faktisch anfassen, wenn sie es versuchte? Nicht
  dasselbe wie (a).
- **(c) GEWUSST** — was sagen ihr Gründungsprompt, `CLAUDE.md` und die Doku, dass sie darf?

Ein Fleet, in dem (b) > (a) ist, hat ein Sicherheitsthema. Eines, in dem (c) < (a) ist, verschenkt
gebaute Fähigkeiten.

**Lesehinweise, die diesem Dokument seinen Wert geben:**

1. **Jede Behauptung ist als GEMESSEN oder GELESEN markiert.** GEMESSEN = eine Route mit der
   Credential *dieser Rolle* gerufen und die Antwort gesehen, oder ein Kommando ausgeführt und die
   Ausgabe gesehen. GELESEN = aus dem Code geschlossen. Wo eine Rolle mit einer Credential
   gemessen wurde, die sie nicht hätte, stünde das Gegenteil des Gefragten — das ist nirgends
   passiert.
2. **`server.ts`-Zeilen sind gegen `main` aufgelöst** (Stand `e790478` + 2 Commits), nicht gegen
   den Baum, in dem gemessen wurde. Die beiden Bäume unterscheiden sich um ~17 Zeilen; wer eine
   Zeile prüft und danebenliegt, sucht die Konstante per Namen (`docs/knowledge-currency.md`).
3. **Nicht gelesen wurden:** `fleet.json`, `.env` und die vier nicht publizierten
   Security-Arbeitsdokumente. Alle Aussagen über deren Feldstruktur stammen aus `server.ts`, alle
   über Existenz und Rechte aus `ls`/`stat`.

---

## §1 Die Antwort auf die Leithypothese

**Sie stimmt. Der Mechanismus liegt eine Ebene tiefer als „`fleet.json` liegt halt dort":**

Fleet leitet seinen gesamten Laufzeitzustand aus `import.meta.dir` ab — `STATE_FILE`
(`server.ts:43`, GELESEN). Der Server läuft aus `~/claude-fleet`, **also ist das Haupt-Checkout
das Datenverzeichnis**. Eine Session mit diesem cwd ist nicht privilegiert; sie steht in der
Datenbank.

**Entworfenes Recht oder Nebeneffekt der Dateilage? — Nebeneffekt, und das ist beweisbar:**

- `grep -c 'process.cwd()' server.ts` → **0** (GEMESSEN). Nirgends im Code ist das
  Arbeitsverzeichnis eine Rolle.
- Autorisierung ist ausschließlich Token-Vergleich (`tokenOk`, GELESEN), gespeist aus dem State,
  der aus `STATE_FILE` gelesen wird.
- Der Code weiß, was dort liegt, und sagt es selbst (`server.ts:742`, GELESEN): *„THIS file is the
  credential store — owner token, steward token, every lane selfToken, every share secret"*, mit
  `mode 0600` als einziger Maßnahme — wirkungslos gegen einen Prozess unter derselben UID, und
  genau das ist jede Session.

Es gibt also kein Konstrukt „primäre Session". Die Mehrsicht entsteht, weil das Datenverzeichnis
zufällig auch ein Arbeitsverzeichnis ist.

### 1.1 Was im Haupt-Checkout liegt und in keiner Lane existiert

Ein Worktree bekommt nur **getrackte** Dateien plus drei Kopien (`server.ts:1251`, GELESEN:
`for (const f of [".env", "CLAUDE.md", ".claude/settings.local.json"])`). Alles andere
Gitignorierte fehlt.

| Artefakt | Haupt-Checkout | Lane | warum | was es an Sicht bedeutet |
|---|---|---|---|---|
| `streams/` (`s*.raw`, `prompts.jsonl`) | ja | **nein** | gitignored | **roher Terminal-Output jeder Pane + jeder je gesendete Prompt.** „Was überhaupt so passiert", wörtlich als Datei |
| `fleet.json` (~169 KB, `0600`) | ja | **nein** | gitignored | Owner-Token, Steward-Token, **jeder** Lane-`selfToken`, jedes Share-Secret, `slots{}` aller Slots inkl. `mission`, `tasks`, `autos` |
| `audit.jsonl` (2036 Z.) | ja | **nein** | gitignored | jedes Slot-Event der Maschine |
| `lane-outcomes.jsonl` (104 Z.) | ja | **nein** | gitignored | pro Lane: disposition, model, briefHash, filesTouched, verified, sessionMs |
| `post-land-audits.jsonl` (45 Z.) | ja | **nein** | gitignored | Tier-2-Ergebnisse |
| `steward-journal.jsonl` (124 Z.) · `dispositions.jsonl` (2) · `audit-adjudications.jsonl` (14) · `inspektion-register.jsonl` (26) | ja | **nein** | gitignored | Puls-Historie und Owner-Urteile |
| `e2e-trail/` (708 Einträge) | ja | **nein** | gitignored | Check-Historie |
| `OWNER.md` (15023 B) | ja | **nein** | untracked **und nicht in der Kopierliste** | das Owner-Modell — **keine Lane hat es je gesehen** |
| `graphify-out/` | ja | **nein** | gitignored | Code-Wissensgraph |
| `.env` · `CLAUDE.md` | ja | **JA** | Kopierliste | **kein Differenzierer** |
| git-ODB, `git log`, `main` | ja | **JA** | geteilte ODB | **kein Differenzierer** (widerlegt) |
| tmux-Socket | ja | **JA** | Maschinen-Ressource | **kein Differenzierer** |

*Zeilenzahlen und Dateigrößen GEMESSEN (`wc -l`, `ls -l`); Feldnamen GELESEN aus `server.ts`.*

### 1.2 Die Gegenprobe — worin die Lane mehr sieht

Die Antwort ist nicht einseitig.

Vier der fünf `/api/self`-Routen sind hart auf `s.worktree` gegated (GELESEN) und bleiben einer
Haupt-Checkout-Session auch dann verschlossen, wenn sie sich ein `selfToken` aus `fleet.json` holt:

| Route | 409-Text bei Nicht-Lane | Zeile |
|---|---|---|
| `GET /api/self/drift` | *„not a lane — drift measures a lane against its integration branch"* | 7939 |
| `GET /api/self/gate` | *„not a lane — the gate judges a lane's land"* | 7972 |
| `POST /api/self/criterion` | *„not a lane — a criterion belongs to a lane's founding task"* | 8009 |
| `POST /api/self/verify-intent` | *„not a lane — verify-intent reports a lane's own gate run"* | 8036 |

> **Korrektur 2026-08-07 — die Prämisse „holt sich ein `selfToken` aus `fleet.json`" ist weg.**
> Der Export hängt nicht mehr an `s.worktree`: **jede** Session mit cwd bekommt `FLEET_SELF_TOKEN`
> + `FLEET_SELF_SLOT` in die Pane (`server.ts`, grep `selfExport`) — auch der ⚙ steward, auch eine
> plain session in einem fremden Repo. Die Tabelle darüber bleibt **gültig**: die vier Routen sind
> weiterhin hart auf `s.worktree` gegated und antworten einer Nicht-Lane genau diese vier 409-Texte;
> das war nie die Frage, die der Export beantwortet hat. Was sich ändert, ist nur die Zahl darunter:
> es sind jetzt **zwei von sechs** Routen, die einer Nicht-Lane antworten — `POST /api/self/autos`
> und die neue `GET /api/self` (das eigene Slot-Row: Label, cwd, mission, awaiting, `lane`, idle,
> eigene Autos). Zeilennummern in dieser Tabelle sind seither gewandert; die 409-Texte sind der
> stabile Anker.

> **Nachtrag 2026-08-07 (zweiter) — die Zahl ist wieder gewandert, und die Richtung der Gate-Frage
> ist jetzt nicht mehr einheitlich.** `POST /api/self/watch` ist dazugekommen (der Self-Zwilling
> des Watch-Rückkanals): **drei von sieben** Routen antworten einer Nicht-Lane. Die vier oben
> bleiben unverändert lane-only. Neu ist, dass eine Route **in die Gegenrichtung** gated — sie
> weist eine **LANE** mit 409 ab (*„a lane may not subscribe — lane-waits-on-lane is a coupling
> only the owner can make visible"*), weil ein Lane-wartet-auf-Lane niemand sieht; der ⚙ steward
> zählt dabei nicht als Lane und darf abonnieren. Wer diesen Abschnitt als „die Lane sieht mehr
> über sich selbst" liest, muss ihn ab hier zweiseitig lesen: es gibt jetzt auch eine Frage, die
> *nur* die Nicht-Lane stellen darf.

Nur `POST /api/self/autos` (7919) funktioniert auch für einen Nicht-Lane-Slot. Umgekehrt weist
`/api/dispositions` **jede** Credential ab, die auf irgendein `selfToken` matcht — 403, *„the
disposition rail is owner-only — a lane cannot label its own work"* (`server.ts:8049`, GELESEN;
die 403 selbst GEMESSEN).

**Kurz: die Lane sieht mehr über sich selbst, die Haupt-Checkout-Session mehr über alle anderen.**

### 1.3 Die laterale Fähigkeit, die keine Seite modelliert

`saveState` schreibt das `selfToken` **jedes** aktiven Slots, und die Self-Routen finden den Slot
*anhand des Tokens* (GELESEN). Eine Haupt-Checkout-Session könnte damit als **jede beliebige
andere Lane** auftreten — eine Fähigkeit jenseits von „Owner sein". Der Kommentar bei den
Self-Routen versichert, sie könne „auf keinen anderen Slot als den eigenen gerichtet werden" — das
gilt **pro Token**, nicht gegen einen Leser, der alle Token hat.

---

## §2 Die Messlage

| Rolle | Credential gehalten? | Status |
|---|---|---|
| 1 Lane (`FLEET_SELF_TOKEN`) | **ja**, die eigene | **GEMESSEN** — alle 5 Self-Routen; GETs voll, POSTs nur im Ablehnungspfad (kein Live-Zustand erzeugt) |
| 2 Steward | nein | **GELESEN** + eine token-lose Ablehnung GEMESSEN |
| 3 Projekt-Session | n/a | Metadaten GEMESSEN, Feldstruktur GELESEN |
| 4 Wegwerf-Worker | n/a | **GELESEN**, vollständig |
| 5 Gast | nein | Container-/VM-Zustand GEMESSEN, Routen GELESEN |

*Spalte 2 ist ein Schnappschuss vom 06.08. und seit dem 07.08. überholt: Rolle 2 und Rolle 3 halten
jetzt beide ihr eigenes `FLEET_SELF_TOKEN` (s. die Korrektur in §1.2). Die Status-Spalte bleibt, wie
sie war — sie sagt, was damals gemessen wurde, und das altert nicht.*

**Warum Rolle 4 vollständig ist, ohne dass man suchen muss:** jeder Wegwerf-Spawn geht durch
`runWorker`, dessen `tools` ein Pflichtfeld mit geschlossenem Union-Typ ist (`ToolProfile`).
10 Aufrufstellen, 10 Verträge in `src/protocol.ts`. Ein 11. Worker kann nicht existieren, ohne die
Kompilierung zu brechen. (GELESEN)

---

## §3 Das Bild in drei Spalten

### (a) GEWÄHRT — die HTTP-Grenze ist sauber und zentral

Ein einziges `tokenGate` (`server.ts:8226`, GELESEN), mit dem Kommentar *„everything below carries
authority — token required"*. Über dieser Zeile liegt **keine** Owner-Route — geprüft, indem der
gesamte Handler-Bereich davor durchgegangen wurde: `/intake` (eigenes Secret), der
Share-Hosts-Block, die fünf `/api/self`-Routen, die `/api/dispositions`-Vorprüfung, Login,
`/favicon.ico`, die Share-Routen, statische Dateien. Der Gate ist **strukturell** zentral, nicht
pro Route.

GEMESSEN, mit dem Self-Token dieser Lane gegen Owner-Routen:

```
GET /api/sessions          → 401 {"error":"unauthorized"}
GET /api/tasks             → 401 {"error":"unauthorized"}
GET /api/post-land-audits  → 401 {"error":"unauthorized"}
GET /api/audit             → 401 {"error":"unauthorized"}
GET /api/steward/token     → 401 {"error":"unauthorized"}
GET /api/dispositions      → 403 {"error":"self token: the disposition rail is owner-only …"}
```

GEMESSEN, Self-Route ohne Token und mit falschem Token: durchweg `401 {"error":"unauthorized"}`.

Auch der Steward-Token ist eine **echte Teilmenge, strukturell erzwungen** (GELESEN): jede Anfrage
mit gültigem Steward-Token wird vor dem Owner-Gate abgefangen; was `handleStewardRoute` nicht
beansprucht, endet in `403 „steward token: route not in scope"` (`server.ts:8061`). Zehn Routen,
vier davon schreibend. **Kein Spawn, kein Land, kein Kill, kein Promote** — `mergeJob` hat genau
einen Aufrufer (`server.ts:8987`), und der liegt unter dem Owner-Gate.

### (b) ERREICHBAR — größer als (a), für jede Rolle, ausnahmslos

Die HTTP-Grenze ist die **einzige** Grenze. Jede Rolle läuft als dieselbe UID wie der Server, ohne
Permission-Prompt (GEMESSEN an der argv-Form laufender Panes: `claude --dangerously-skip-permissions
--session-id … --model …`), am **Live-tmux-Socket**.

| Was | Beleg | Status |
|---|---|---|
| `~/claude-fleet/fleet.json` aus einer Lane lesbar | `-rw-------`, gleiche UID, `test -r` → READABLE | **GEMESSEN** (nur Metadaten; Inhalt nie geöffnet) |
| `.env` ebenso, **plus eine 0600-Kopie in jedem Lane-Worktree** | `server.ts:1251` | GEMESSEN / GELESEN |
| Fremde Lane-Worktrees | `drwx------`, gleiche UID → les- und schreibbar | **GEMESSEN** |
| Live-tmux-Socket | `srw-rw----`; `list-sessions` aus der Lane erfolgreich, liefert alle Slots **und die `srv`-Pane des Servers** | **GEMESSEN** |
| `send-keys` / `capture-pane` gegen fremde Panes | aus Socket-Modus + UID **geschlossen** | **NICHT gemessen — bewusst nicht versucht** |

**Urteil: (b) ≫ (a).** Was `/api/self` gewährt, ist eine Teilmenge dessen, was ein Lesen der
Credential-Datei plus ein Owner-Request in einem Schritt aufhebt. **Das Self-Token-Design ist ein
Konventions-Riegel, keine Einsperrung** — es macht das Richtige bequem und das Falsche sichtbar
(`audit()`), nicht unmöglich. Für das Bedrohungsmodell dieses Repos (der Owner administriert eigene
Hardware) ist das konsistent; **als „Sandbox" darf es niemand zitieren.**

### (c) GEWUSST — kleiner als (a), und das ist der eigentliche Befund

Das Wissen einer Lane über ihre eigenen Fähigkeiten hängt vollständig an **einer gitignorierten
Spawn-Zeit-Kopie von `CLAUDE.md`** — jener Datei, die der Server-Kommentar bei der Drift-Route
selbst als solche bezeichnet und deren Befolgung dort ausdrücklich „pure belief" heißt. Ein Repo
ohne `CLAUDE.md`, oder eine Lane in einem fremden `task.repo`, weiß von **keiner einzigen** der
fünf Self-Routen.

Der Gründungsprompt trägt es nicht nach: eine normal dispatchte Lane bekommt ausschließlich den
kompilierten Task-Text (GELESEN), und
`git show main:docs/lane-brief-template.md | grep 'api/self\|FLEET_SELF'` ist **leer** (GEMESSEN).
Der einzige Gründungsprompt, der je eine Self-Route nennt, ist der Clarify-Pfad
(`clarify-prompt.ts:31`).

**Das Muster in einem Satz:** das Repo weiß von dieser Fehlerklasse — `merge-prompt.ts:249` sagt
ausdrücklich, dass im Author-Prompt **kein** Sandbox-Satz stehen darf, weil er falsch wäre. Das
Bewusstsein ist da; es hat die Stellen in §4 nicht erreicht.

---

## §4 Rangliste

### 1. Der Repair-Worker wird zu einem Kommando aufgefordert, das sein eigenes Profil verbietet

**Rolle 4 · Widerspruch (a)↔(c) · Kern GEMESSEN, Wirkung GELESEN**

`merge-prompt.ts:187` weist wörtlich an:

> `3. Stage and commit: git add -A && git commit -m 'repair: fix verification failure'. Do NOT rebase.`

`MERGE_TOOLS` (`server.ts:4007`) listet `git status/diff/log/add/rm/checkout/rebase`, die vier
`graphify`-Verben und `Edit/Write/Read/Grep/Glob`. **Die Zeichenkette `git commit` kommt darin
0× vor** (GEMESSEN, unabhängig zweimal bestätigt). `--permission-mode dontAsk` macht alles
Nicht-Gelistete zum Auto-Deny.

**Wirkung, falls das Deny greift** (GELESEN, `server.ts:5760`): bleibt der Baum nach dem Repair
dirty, macht ein `git reset --hard HEAD` + `break` die Runde zum No-op. Der Kommentar dort sagt es
selbst: *„the repair left uncommitted edits (contract says commit)"*. `FLEET_MERGE_REPAIR_ROUNDS=2`
ist live.

**Was das Register dazu sagt — und was es NICHT sagt (Owner-Messung, 2026-08-06):**
`lane-outcomes.jsonl` hat 104 Zeilen; `repairRounds` ist in **allen 104** gleich `0`, und nur
**5** Zeilen tragen überhaupt `resolvedConflict` — alle fünf mit `verified:true`.

> **Die Reparaturschleife wurde damit nie BETRETEN** — sie läuft nur, wenn eine Konfliktauflösung
> danach die Verifikation reißt. **Die Null im Register beweist den Defekt NICHT; sie ist mit „nie
> ausgelöst" genauso gut erklärt. Der Defekt ist mechanisch belegt und LATENT, nicht in der Praxis
> beobachtet.**

Diese Unterscheidung ist der Punkt: `docs/autonomy-map-2026-08-06.md` §11.1 macht aus derselben
Null die erste Sperre gegen Auto-Land (*„Beide Pfade … sind im Feld ungetestet. Ein Sicherheitsnetz
mit null Belastungsproben ist Dekoration."*). Diese Lesart bleibt richtig — sie wird durch den
Mechanismus hier **verschärft**, nicht bewiesen: der erste echte Repair-Fall würde nicht nur
ungetestet, sondern voraussichtlich wirkungslos laufen.

**Kosten:** ein Sicherheitsnetz, das beim ersten Gebrauch leerläuft, und zwar still — der No-op-Pfad
schreibt kein Rot.

**Ungemessener Teilschritt, benannt statt behauptet:** wie der Bash-Permission-Matcher ein
zusammengesetztes `A && B` gegen Präfixmuster wertet. Dass keine Suite es fängt, ist dagegen sicher
(GELESEN): der e2e-Pfad ersetzt den Agenten durch einen Subprozess ohne jedes Tool-Flag, die
Profile werden ausschließlich als **Strings** geprüft (`e2e/prompts.ts`).

**Schwelle.** Zuerst ein Canary gegen eine Scratch-Instanz: feuert das Deny überhaupt? Nur wenn ja,
`Bash(git commit:*)` ergänzen. Danach zählen: **Merge-Läufe mit `repairRounds ≥ 1` UND
`verify.ok:true`, über die nächsten 20 Läufe, die in Repair gehen.** Bleibt es 0/20, war das Profil
nicht die Ursache — dann den Resolver messen, nicht das Profil nachschärfen. **Stop-Kriterium für
die Messung selbst:** treten in 60 Tagen keine 20 Repair-Eintritte auf, ist der Pfad zu selten, um
ihn zu härten — dann gehört er entfernt, nicht repariert.

### 2. Der Fix für die benannte Steward-Blindheit sitzt auf der Route, die das Ritual nicht ruft

**Rolle 2 · Lücke (c) · GEMESSEN**

`server.ts:7593` hängt `gate: gateView()` an `GET /api/steward/sessions`, mit dem Kommentar
(GELESEN):

> *„the pulse's own note … named this blindness: without it the steward cannot tell a finished pane
> from one waiting on a suite, nor whether starting ANYTHING next is safe — the two judgments the
> Rundgang exists to make."*

`.claude/commands/rundgang.md:10` sagt (GEMESSEN): *„**One call gathers everything**:
`GET /api/steward/digest`"*. Und die Digest-Antwort (`server.ts:7595`) liefert
`now, sinceLastLook, deployGap, bundleStale, continuity, slotHealth, ledgers, digest, digestAt,
digestAge, waitMs, model` — **kein `gate`** (GEMESSEN; die `gate`-Treffer in diesem Block sind
ausschließlich Kommentartext).

**Kosten:** die Blindheit, die der Code als geschlossen dokumentiert, ist beim einzigen Verbraucher
offen. Dass sie real ist, ist messbar: der Suite-Mutex war während dieser Untersuchung
durchgehend belegt (`{"alive":true,"state":"held"}`, `heldMs` > 300 000, GEMESSEN über
`/api/self/gate`).

**Schwelle:** Anteil der Rundgang-Journaleinträge, die `gate`/`suiteLock` zitieren, **über 10
Pulse**. Unter 50 % ist nicht die Route der Träger, sondern das Ritual — dann aufhören, nicht
nachschärfen.

**GEBAUT — 2026-08-07** (Queue-Zeile `7d380d5e`). `gate: gateView()` hängt jetzt auch an
`GET /api/steward/digest`, route-berechnet neben `sinceLastLook`/`deployGap`/`bundleStale` — also
unabhängig davon, ob der Digest-Worker lebt. **Dieselbe** `gateView()` wie die Sessions-Route und
das Owner-Board: eine berechnete Antwort, keine zweite von Hand gebaute, und ein Pin in
`e2e/steward-core.ts` hält die beiden Antworten aneinander fest. Der GEMESSEN-Befund oben („kein
`gate`") beschreibt damit den Stand vor diesem Datum; die Zeilenrefs auf `server.ts:7593/7595`
waren schon bei der Untersuchung an ihrem Baum verankert und sind nicht nachgezogen worden.
Die Schwelle bleibt offen — sie zählt Journaleinträge über 10 Pulse und war von der bauenden Lane
nicht erhebbar.

### 3. Die Lane erfährt zwei ihrer fünf Fähigkeiten nirgends

**Rolle 1 · Lücke (c) · GEMESSEN**

| Fähigkeit | existiert | in `CLAUDE.md` |
|---|---|---|
| `POST /api/self/verify-intent` | `server.ts:8032` | `grep -c` → **0** |
| `suiteLock` im Payload von `/api/self/gate` | `server.ts:7968`, Feld live vorhanden | `grep -c` → **0** |

*Beide Zählungen GEMESSEN, das Feld durch einen echten Aufruf bestätigt. `rulebookDrifted:false`
war zum Messzeitpunkt ebenfalls gemessen — die geprüfte Kopie war also die Quelle.*

**Kosten, zwei konkrete:**

1. **Die Lane sagt nie, dass sie gerade eine Suite fährt.** `gate.reports` bleibt leer, der Owner
   sieht eine stumme Pane statt „running". Der Produzent des Signals weiß nicht, dass er senden
   darf — genau die Beobachtbarkeit, für die die Route gebaut wurde.
2. **Die Lane prüft nie, ob der Mutex gehalten wird**, bevor sie ihre Suite startet, und deutet die
   Wartezeit als Hänger. `docs/suite-contention.md` beschreibt diesen Fall als stille
   Land-Verzögerung.

**Ein dritter Fakt, den keine Lane erfährt, obwohl er sie betrifft** (GELESEN, `server.ts:7958`,
gepinnt in `e2e/self-token.ts`): **`/api/self/drift` schreibt ein Audit-Event pro FRISCHER Antwort,
dem eigenen Slot zugeschrieben.** `CLAUDE.md` verkauft drift als Lesebequemlichkeit; tatsächlich
ist der Aufruf eine **Messung an der Lane**. Das ist Schritt A der Autonomie-Landkarte — er läuft
bereits, und die gemessene Population weiß nicht, dass sie gemessen wird.

**Weitere (c)-Lücken derselben Rolle, kleiner:** `POST /api/self/criterion` steht in `CLAUDE.md`
nur im CLARIFY-Zweig (eine normale Lane, der mitten in der Arbeit das Kriterium unklar wird, weiß
nicht, dass sie eines vorschlagen kann); `perpetual: true` → 403 owner-only ist nirgends genannt;
der Self-Token **überlebt einen Server-Neustart** (in `e2e/self-token.ts` gepinnt, in `CLAUDE.md`
nicht — eine Lane könnte nach einem Deploy fälschlich annehmen, ihre Credential sei tot); ein
Nicht-Lane-Self-Token bekommt **409, nie 401** (die Unterscheidung „erkannte Credential, falscher
Scope" ist nicht benannt).

**Schwelle:** Anteil der Lanes, die mindestens einmal `verify-intent` posten, **über 20 gelandete
Lanes**. Unter 20 % ist `CLAUDE.md` als Träger widerlegt — dieselbe Zahl und dieselbe Logik wie
Schwelle A/B in `docs/autonomy-map-2026-08-06.md` §11.2 — dann gehört es in den Gründungsbrief,
nicht in eine schärfere Regelzeile.

### 4. Das Owner-Modell erreicht keinen einzigen Agenten

**Rollen 2+3 · Lücke (c) · GEMESSEN**

`OWNER.md` (15023 B) existiert nur im Haupt-Checkout: untracked **und** nicht in der Kopierliste
(`server.ts:1251`). Es fehlt in einer frischen Lane (GEMESSEN) und im Steward-Worktree (GEMESSEN).
`.claude/commands/steward.md` nennt es als Ladepflicht — der Steward liefe per Ritual „ohne
Owner-Modell".

Der Steward-Worktree ist zusätzlich verrottet (GEMESSEN): Branch `steward-live`, **52 Commits
hinter main**, mit einer `CLAUDE.md` vom 05.08. gegen die vom 06.08. im Haupt-Checkout.
`docs/steward.md` nennt den Branch `steward` — live heißt er `steward-live`.

**Kosten:** `docs/ungoverned-artifacts.md` deckt die Rulebook-Seite dieses Pfads ab, die
**Credential-Seite behandelt kein einziges Dokument** — alle `docs/*.md` auf `main` wurden danach
durchsucht, null Treffer (GEMESSEN). Das Dokument, das (a) und (b) je Rolle festhalten würde
(`trust-perimeter.md`), liegt außerhalb des Repos und ist für jede Rolle unerreichbar — bewusst,
weil dieses Repo öffentlich ist, aber die Folge ist dieselbe.

**Schwelle:** Anzahl der Lane-Reports, die eine `OWNER.md`-Vorgabe zitieren, **über 15 Lanes** nach
Aufnahme in die Kopierliste. Unter 3 ist das Owner-Modell nicht der fehlende Input, und die Kopie
kostet nur Kontext — dann zurücknehmen.

---

## ─────────── SCHNITTLINIE ───────────

Die Frage war *„was sehen Agenten und wie benutzen sie Tools"* — nicht *„auditiere mein
Perimeter"*. Alles Folgende ist gesehen und **bewusst nicht als nächster Schritt empfohlen**; es
gehört berichtet, nicht programmiert. (`docs/scope-inflation.md` §7.)

### Gesehen, bewusst nicht empfohlen

**Zuerst die gute Nachricht, damit sie nicht untergeht:** die Lücke, die als Messlatte galt —
`--allowedTools` ist additiv zur ambienten Allow-Liste, geklammerte Muster binden erst mit
`--setting-sources ""` — **existiert im heutigen Code nicht.** `MERGE_TOOLS` (`server.ts:4007`) und
`REVIEW_TOOLS` (`server.ts:4018`) tragen beide `--setting-sources ""`, und `e2e/prompts.ts` pinnt
genau das als Check. `TEXT_ONLY_TOOLS` (`server.ts:3003`) braucht es nicht: `--tools ""` ist ein
Fähigkeitsschnitt, an den sich nichts anlagern kann. (GELESEN)

- **Der `Read(**)`-Widerspruch.** Das Repo behauptet beides: `server.ts:3230` — *„(Read(\*\*) is
  machine-wide even anchored)"* — gegen `drills/drill-3-sealed-ground-truth.md` — *„cwd-anchored
  `Read(**)`, so the anchors actually bind"*. **Keine der beiden Zeilen trägt eine Messung.** Nicht
  empfohlen, weil es einen Canary-Lauf braucht und die Antwort an Rang 1–4 nichts ändert. **Aber:**
  die Drill-Zeile nennt selbst ihre Ausnahmebedingung — *„Verify this again if the harness ever runs
  the reviewer with a different cwd"* — und die ist erfüllt: `analysis` (`server.ts:2161`) und
  `refine` (`server.ts:2304`) laufen mit cwd = Haupt-Checkout, also im Credential-Store. Selbst
  unter der wohlwollenden Lesart ist der Anker an ein Verzeichnis gebunden, das den Tresor enthält.
- **`analysis` ist der einzige Worker, der sich von selbst startet** (`ANALYSIS_TICK_MS`, default
  60 s, `server.ts:2051`) — unabhängig von `dispatchOn`. Sein Prompt sagt *„read files to verify"*,
  `refine` sagt *„You may look at anything; you may change nothing"*. **Kein Wort zu `.env` oder
  `fleet.json`, obwohl beide in seinem cwd liegen.** Der Prompt begrenzt hier nicht — er lädt ein.
- **Drei weitere Prompt↔Profil-Mismatches derselben Familie wie Rang 1**, aber billiger: der
  ②-Reviewer wird um `git <subcommand>` gebeten und hat nur `status/diff/log` (`git show`, `blame`
  → Deny; Folge sind Fehlalarme, keine Fehl-Freigaben, weil der Pfad fail-closed ist);
  `merge-prompt.ts:109-110` behauptet, alles außer „plain `git <subcommand>`" sei „auto-denied" und
  verbietet `--exec` im Fließtext — tatsächlich matcht `Bash(git rebase:*)` es, und der Code weiß es
  (`REVIEW_TOOLS` lässt `git rebase` genau deshalb weg, `MERGE_TOOLS` behält es).
- **Credentials stehen in argv.** Self- und Steward-Token werden im tmux-Kommandostring exportiert
  (`server.ts:1502`) — während `server.ts:7842` für den Guest-Hook die Gegenregel formuliert:
  *„a credential goes in on STDIN and never in argv — argv is world-readable in `ps`"*. Die **Form**
  ist der Befund; kein Wert wurde notiert oder verwendet.
- **Die fünf `TEXT_ONLY`-Worker laden die ambiente Konfiguration weiterhin — mitsamt der Hooks.**
  `--tools ""` schneidet Fähigkeiten, `--strict-mcp-config` die MCP-Connectors; **Hooks deckt
  keines von beiden ab.** Drei `Stop`-Hooks laufen also am Ende jeder Wegwerf-Antwort mit, deren
  Ausgabe der Server als JSON-Kontrakt parst. Die Hook-Skripte wurden nicht gelesen — uncosted
  observation, aber die Struktur ist klar. Asymmetrie ohne Begründung im Code: `TEXT_ONLY_TOOLS`
  trägt `--strict-mcp-config`, `MERGE_TOOLS`/`REVIEW_TOOLS` nicht.
- **Welche Worker etwas über ANDERE Slots sehen** (GELESEN), der Vollständigkeit halber:
  `digest` bekommt `stewardSlotsView` für **alle** Slots (`server.ts:7115`) inkl. `mission`
  wörtlich — aber keinen Transcript-Inhalt, und sein Prompt sagt das korrekt. `analysis` bekommt
  Branchname + erste Zeile des Auftrags jeder offenen Lane. `cleanReview` bekommt bis zu 8 andere
  Lanes mit je bis zu 40 in-flight-Dateipfaden. Die anderen sieben sehen nur ihren eigenen Slot.
- **Der Gast ist besser isoliert, als die Doku vermuten lässt — und die Doku beschreibt ihn
  falsch.** Ein Gast ist **kein** Claude-Code-Prozess auf dieser Maschine, sondern eine eigene
  vollständige Fleet-Instanz in einem Container (GEMESSEN): keine Bind-Mounts, kein Docker-Socket,
  alle Capabilities leer, Egress-Firewall gegen private Bereiche, `FLEET_CMD=claude` **ohne**
  `--dangerously-skip-permissions`. Die drei `dangerously`-Treffer in den Gast-Skripten sind
  ausnahmslos Kommentare, die die Abwesenheit *begründen* (GEMESSEN). Die ambiente Allow-Liste wird
  nicht geerbt. **Aber:** die Grenze ist der Container und sonst nichts — Tool-Scoping gibt es in
  keinem Gast-Skript (`allowedTools` und `setting-sources` je **0×** in allen sechs, GEMESSEN), und
  die VM darunter mountet das Owner-Home **read-write**. `docs/container.md` sagt *„isolated in its
  filesystem and its credentials"* und erwähnt dieses Mount nicht — ein Escape landet nicht in einer
  leeren VM. Die `CLAUDE.md`-Zeile „Gäste sind Slots unter `~/.claude-fleet-guest/<n>/`" beschreibt
  die Konfigurationsdatei und liest sich wie der Gast.
- **Der Share-Payload ist größer als seine UI und größer als `SHARING.md`** (GELESEN): kompletter
  Diff bis 400 KB, 50 Commits, uncommittete Dateinamen, und die gesamte Konversation samt
  Tool-Aufrufen und deren JSON-Inputs. Ein als „view only" beschrifteter Gast kann per
  `POST /s/<id>/summary` einen echten Worker auf Maschine und Subscription des Owners starten und
  Kommentare persistieren. **Was die Suiten NICHT halten:** der reduzierte Transcript-Schnitt für
  Gäste (die Suite prüft nur `Array.isArray` und `typeof number`) — eine Regression in der
  Filterzeile liefe grün durch; der `brief`-Payload wird nur negativ geprüft; die
  Share-ID-Enumeration ist ungetestet, und der Pfad „kein Cookie angeboten" kehrt **vor** dem
  Fehlversuchs-Zähler zurück.
- **`state.sh` lügt in einer Lane still mit Nullen** (GELESEN aus dem Skripttext, **nicht
  ausgeführt** — es druckt `.env`-Werte): `rows()` fängt `FileNotFoundError` und gibt `[]` zurück,
  also erscheint „outcomes 0", und der Vergleich `cwd` gegen `$PWD` meldet den echten Live-Server
  als „stray pid … not the fleet". Das Skript ist fürs Haupt-Checkout geschrieben und degradiert
  nicht sichtbar, sondern falsch.
- **Zwei verrottete Zeilenrefs** (GEMESSEN): `docs/ungoverned-artifacts.md` §1 zitiert die
  Kopierliste als `server.ts:868-877`, tatsächlich `1251`. `docs/steward.md` nennt den
  Steward-Branch `steward`, live ist es `steward-live`.
- **Steward-(c)-Lücken, die die Schwelle nicht überschreiten** (alle GEMESSEN gegen die vier
  Ritualdateien): `GET /api/dispositions` — **0 Erwähnungen in allen vier Ritualen und 0 in
  `main:docs/`**; die dichteste Aufzeichnung des Owner-Geschmacks bleibt ungelesen, und der Puls
  leitet Urteil jeden Lauf neu aus Lane-Zuständen ab. `mission` — **0 echte Treffer** in allen vier
  Ritualen (Doc-Treffer sind die Teilzeichenkette in „permission"), obwohl es in derselben Antwort
  liegt. `POST /api/steward/send` — kein Ritual nennt sie, alle drei **verbieten** Senden; ob
  Lücke oder Absicht, steht nirgends als Entscheidung. `transcriptFact`, `doneLookingSince`,
  `stalledSince` — nur in Attic-Docs; „gerade still" vs. „seit einer Stunde still" braucht zwei
  Abfragen. Die Freitext-Asymmetrie (10 000 Zeichen in die **eigene** Pane, in fremde Panes
  strukturell **kein** Freitext) ist eine echte Designgrenze, die dem Steward niemand nennt.

---

## §5 Was NICHT geprüft wurde

- **Inhalt von `fleet.json`, `.env` und den vier nicht publizierten Security-Dokumenten** — nie
  geöffnet. Alle Feldaussagen aus `server.ts`, alle Existenz-/Rechteaussagen aus `ls`/`stat`.
- **Kein `send-keys`, kein `capture-pane`** gegen irgendeine Pane. Dass es ginge, ist geschlossen,
  nicht gemessen.
- **Kein erfolgreicher POST**, kein Share, keine Einladung, kein Worker-Start, keine Suite, kein
  Serverstart. Alle Erfolgsformen sind GELESEN.
- **Die `**`-Semantik ist offen** — die eine Frage, deren Antwort die Reichweiten-Rangliste der
  Worker verschieben würde, und ohne Canary nicht zu klären.
- **Der Bash-Permission-Matcher gegen `A && B`** (Rang 1) — nicht verifizierbar ohne Lauf.
- **Die drei `Stop`-Hook-Skripte** — nur als vorhanden bestätigt, nicht gelesen.
- **`src/client.ts`** — nicht geprüft, welche dieser Felder das Owner-Board zeichnet.
  `docs/autonomy-map-2026-08-06.md` §6.4 hält für `stalled`/`stalledSince` bereits fest, dass sie
  dort **nicht** vorkommen.
- **Die Steward-Routen wurden nie authentifiziert gerufen** — alle Feldnamen und Ablehnungstexte
  sind aus dem Handler gelesen. Verhielte sich eine Route anders, als ihr Code liest, bliebe es
  unentdeckt.

### Methoden-Offenlegung

Die Gast-Spur hat zwei read-only-Kommandos **innerhalb** der Gast-Container und der VM ausgeführt
(`ps`, `/proc`, `ls`) — das geht über „beschreiben, nicht zugreifen" hinaus. Keine Gast-Inhalte,
keine Transcripts. Der Befund zum VM-Mount hängt daran; ohne diese Kommandos wäre er eine Vermutung
geblieben.
