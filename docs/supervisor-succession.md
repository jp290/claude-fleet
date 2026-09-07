# Supervisor-Nachfolge — was eine neue Supervisor-Session mechanisch bekommt, was sie kostet, und wie der Owner sie auslöst

**Lies das als:** Betriebsdokument für genau eine Frage — *wie erzeugt oder übergibt man die
owner-seitige Supervisor-Session kontext-sparsam?* Es ist kein Arbeitsregister. Lebende Fakten
bleiben `./state.sh`, `./register.sh`, `GET /api/programs` und die `supervisor-view` selbst; jede
Zahl hier ist ein Zeiger dorthin, nie eine Kopie.

**Methode und ihre Grenze.** Jede Struktur-Aussage trägt `datei#symbol` (Konvention seit 2026-08-25,
owner-promoviert: Zeilenverweise in `server.ts` rotten binnen Stunden, ein Symbolname übersteht jede
Einfügung und löst mit einem `rg -n '<symbol>' server.ts` auf — Beleg
`docs/messungen/video-codebase-klarheit-2026-08-25.md` §2.1, 96 % Fehlschussquote bei
Zeilenverweisen). Drei Etiketten, nie vermischt:

- **GEMESSEN** — ich habe die Zahl in dieser Lane erzeugt (Kommando genannt) oder aus einem Ledger
  gelesen.
- **GELESEN** — der Code-Pfad existiert und ich habe ihn in dieser Lane gelesen.
- **~GESCHÄTZT** — Rechnung aus gemessenen Größen; trägt immer eine Tilde.

Ich habe **keine Pane gelesen**, keine Suite über den doc-proportionalen lokalen Beweis hinaus
gefahren und keinen Server-Code geändert. Nichts aus der HANDOFF-Prosa steht hier ohne
Code-Gegencheck; wo Handoff und Code auseinandergehen, gilt der Code (§5).

---

## 1. IST — was eine Supervisor-Nachfolgerin heute mechanisch bekommt

### 1.1 Die Identität

`SupervisorBinding` ist ein **Singleton** neben `programs` (`server.ts#SupervisorBinding` Typ,
`server.ts#supervisor` der Zustand, `server.ts#supervisorBootstrapInflight` der Inflight-Riegel) mit
exakt der Occupant-Form von `Program.main`: `{slot, openedAt, sessionId, boundAt}`. Zwei
Eigenschaften tragen alles darüber:

- **Occupancy, nicht Name.** `isBoundSupervisor` (`server.ts#isBoundSupervisor`) joint auf
  `slot + openedAt`. Ein recycelter Slot erbt die Bindung strukturell nie, und ein Label
  「🧿 Supervisor」 verleiht keinerlei Autorität — anders als `⚙ steward`, das ein magischer
  Label-String ist (`STEWARD_LABEL`, `server.ts#STEWARD_LABEL`).
- **Tolerantes Laden, nie halb.** Der Loader (`server.ts#STATE_FILE`, der Startup-Ladeblock direkt
  nach `claimInstanceLock`) akzeptiert die Bindung nur vollständig; abwesend ODER malformed lädt als
  `null`. Begründung im Code: eine halbe Bindung wäre nicht ein schwächerer Fakt, sondern ein
  anderer.

Die Bindung überlebt den Prozess-Neustart (Teil des persistierten States, ausgeliefert an
`GET /api/programs` als `{programs, supervisor}`, `server.ts#handleOwnerProgramRoute`).

### 1.2 Der Gründungsbrief — und was er NICHT enthält

Beide Briefe teilen sich einen Rumpf, `supervisorBriefBody()` (`server.ts#supervisorBriefBody`); der
Bootstrap-Brief (`buildSupervisorBrief`, `server.ts#buildSupervisorBrief`) und der Nachfolge-Brief
(`buildSupervisorSuccessionBrief`, `server.ts#buildSupervisorSuccessionBrief`) unterscheiden sich in
**zwei Zeilen**: der Kopfzeile (`[fleet Supervisor]` vs.
`[fleet Supervisor succession] … everything handed over is in HANDOFF.md`) und dem optionalen
`carry` (max. `MAX_SUCCESSION_CARRY = 500` Zeichen, `server.ts#MAX_SUCCESSION_CARRY`).

Der Rumpf sagt vier Dinge und nichts weiter:

1. **Rolle** — Portfolio aus typisierten Fakten zusammenhalten, aufzeigen und fragen, nudgen; jede
   Entscheidung *innerhalb* eines Programms bleibt bei dessen Program-MAIN, jede Promotion beim
   Owner.
2. **Strukturelle Unfähigkeiten, ausdrücklich benannt** — kein Confirm/Activate, kein Land, kein
   Deploy, kein Code.
3. **Kanal-Liste** — `GET /api/self`, `POST /api/self/programs` (propose-only),
   `POST /api/self/attention`, `GET /api/self/supervisor-view`, `POST /api/self/nudge`,
   `POST /api/self/supervisor-watch/:id/complete` (STN-1, beantwortet genau einen von einem
   Controller registrierten Transition-Watch — **im Baum von heute ein sechster Kanal, den diese
   Liste bislang nicht führte**; nachgetragen bei dieser Umstellung, `server.ts#supervisorBriefBody`).
   (Zu `attention` siehe §5.2 — der Brief nennt hier einen Kanal, den die gebundene
   Supervisor-Session heute nicht bedienen kann.)
4. **Startordnung** — `./state.sh`, dann `./register.sh`, dann beobachten und den Owner nur
   ansprechen, wenn etwas ihn braucht.

**Was der Brief bewusst nicht trägt** (Kommentar über `server.ts#supervisorBriefBody`): kein
Verhaltens-Rulebook. Und, für die Kostenrechnung entscheidend: **kein Programm-JSON.** Der
Program-MAIN-Brief serialisiert `programContent(program)` verbatim in den Text
(`server.ts#buildProgramMainBrief` im Bootstrap-Brief, `server.ts#buildProgramMainSuccessionBrief`
im Nachfolge-Brief); der Supervisor-Brief tut das nicht — er sitzt *quer* zu
allen Programmen und liest ihren Inhalt bei Bedarf über `GET /api/self/programs`
(`server.ts#"/api/self/programs"`, dessen Disjunkt ausdrücklich `isBoundSupervisor(s)` enthält).

### 1.3 ContextPlan-Anker — Zeiger, nie Inhalt

Beide Rails hängen denselben Anker-Block an: `programMainContextFacts(frame, harness)`
(`server.ts#programMainContextFacts`) → `planContext` → `renderContextAnchorBlock`
(`server.ts#renderContextAnchorBlock`). Der
Renderer emittiert **eine Zeile je Anker** und gibt `""` zurück, wenn nichts ausgewählt wurde — kein
zweiter leerer Pfad. Die Zeile im Brief sagt es selbst: *"fresh advisory pointers; no source content
is copied"*.

**GEMESSEN** an den beiden Supervisor-Zeilen in `context-receipts.jsonl` (Rows mit
`programId:null` **und** `taskId:null` — beides zusammen ist die Supervisor-Signatur; `programId:null`
allein trägt auch eine gewöhnliche Lane):

| Ereignis | `at` | slot | `deliveredBytes` | selected | omitted |
|---|---|---|---|---|---|
| Bootstrap | 1786914428689 | 5 | **1177** | `portable-core`, `verify-e2e` | `land-mechanics`, `task-queue`, `harness-adapter`, `private-deploy-overlay` (alle `trigger-not-matched`) |
| Succession | 1786914566269 | 7 | **1418** | dieselben zwei | dieselben vier |

Zum Vergleich, aus demselben Ledger: eine Program-MAIN-Zustellung derselben Woche wog **5302 B** —
der Unterschied ist im Wesentlichen das eingebettete Programm-JSON.

### 1.4 Die typisierten Sinne (`GET /api/self/supervisor-view`, `server.ts#supervisorView`)

Read-only, occupancy-gated (`isBoundSupervisor`, sonst **409** `NOT_SUPERVISOR` — nicht 401, die
Session hat ja ein gültiges Token), **nie auf dem 2-s-Poll** (Kommentar über
`server.ts#supervisorView`: `/api/sessions` ist die größte Nutzlast des Servers und hat Bytes an
Headroom). Fünf Faktgruppen aus
Quellen, die ohnehin existieren:

| Gruppe | Quelle | Deckel |
|---|---|---|
| `portfolio` | `programs` + `health` + `promotion` + Rückweg-Budget + Task-Zählung je Status/Phase | 50 Programme |
| `operations` | `lane-outcomes.jsonl` + offene `fleetEvents` (Transport-Schulden, `ownerAckOnly` als Zahl) | 20 Zeilen je Liste |
| `integration` | `deploys.jsonl`, `post-land-audits.jsonl` + Adjudikationen, `deployFacts` (derselbe Git-Tick-Cache wie das Board) | 5 Zeilen je Liste |
| `attention` | offene/`send-uncertain` `attentionRequests` | 20 Zeilen, Text auf 200 Zeichen |
| `provenance` | `context-receipts.jsonl` | 20 Zeilen |

Die `portfolio`-Zeile trägt mehr als ihre Kurzform: **jedes Feld unter ihr ist eine reine
Projektion, die der Owner-GET `GET /api/programs` aus DEMSELBEN Helfer bekommt** — zwei Sichten
eines MAIN dürfen nicht Verschiedenes über ihn sagen, und genau darum ist je Fakt ein Helfer und
nicht ein Rendering je Sicht:

| Feld | Helfer | Was es sagt, und was es NICHT sagt |
|---|---|---|
| `health.occupancy` | `server.ts#programOccupancy` | `live`/`stale`/`unbound` — nennt die Bindung noch einen lebenden Occupant. Seit V1a wohnt sie hier statt top-level; es gibt genau eine Kopie. |
| `health.sessionIdMatch` | `server.ts#sessionIdMatchOf` | `exact`/`divergent`/`unknown` — ist dieser Occupant noch der GEBUNDENE. Nur beim live gebundenen Occupant verglichen. **Kein Land-Urteil:** die Tür vergleicht die Werte direkt (beide `null` = Treffer, ein `null` = Ablehnung, beides hier `unknown`) und verlangt zusätzlich `active`, eine eindeutige Bindung und eine Policy. |
| `promotion` | — (roher Record, sonst `null`) | Der Owner-Record VERBATIM. Die fünf angezeigten Zustände sind `src/client.ts#promotionState`s Vokabular; hier wird nichts übersetzt. `null` behauptet **nicht**, dass jemand auf den Owner wartet. |
| `deliveryBudget` / `deliveryBudgetNote` | `server.ts#programReturnPath` | Der Rückweg in diese MAIN (V1b): `free === 0` ist exakt die Ablehnungsbedingung der drei mintenden Türen. Zuordnung nur über die eindeutige live `slot+openedAt`-Bindung — sonst `unknown` mit Grund und **ohne Zahl**. |
| `tasks.byStatus` / `tasks.phases` | `program-phase.ts#phaseOf` | Zählungen, nie Zeilenkörper — die Bodies trägt die Program-MAIN-eigene Sicht. |

Referenz und Ablehnungen im Detail: `docs/self-api.md` §land → *Die Identität ist sichtbar, bevor
die Tür sie prüft (V1a)* und §fleet-report → *Das Zustellbudget ist sichtbar, bevor du dagegen
läufst (V1b)*.

Dazu `unknown: string[]` — jede Lücke wird als Satz benannt statt weggelassen: nicht projizierte
Programme, unattribuierbare Outcome-Zeilen, malformed-Zähler je Ledger, ein
`deployGap: null` ausdrücklich als *"not measured yet, which is not an all-clear"* — und eine
konstante Zeile: *"1 lineage gap: no persisted Supervisor lineage exists"* (§5.1).

### 1.5 Die eine Stimme (`POST /api/self/nudge`, `server.ts#supervisorNudge`)

**Der Empfänger wird ABGELEITET, nie benannt** (Kommentar über `server.ts#supervisorNudge`): der
Body nennt eine `programId`, der Empfänger ist deren gebundener Program-MAIN-Occupant. Ein Nudge
kann strukturell keine Pane erreichen, die das Portfolio nicht ohnehin nennt. Fünf Verweigerungen,
alle 409 und alle vor jedem Transport: unbekanntes Programm · Programm nicht `active` · kein
gebundener MAIN · Occupant weg/ersetzt · `awaiting === "owner"` (*"escalate, never nudge past it"*).
Danach `canDeliver` mit der attended Waiver-Menge, **ohne** Nachlass auf `alive` — in eine
agentenlose Pane zu pasten wäre Prosa in eine Shell. Text max. 2000 Zeichen
(`MAX_SUPERVISOR_NUDGE_TEXT`, `server.ts#MAX_SUPERVISOR_NUDGE_TEXT`).

Was er **nicht** ist (Kommentar über `server.ts#supervisorNudge`): keine Persistenz, kein
`FleetEvent`, kein Watch, kein Tick, kein Retry. Der Receipt an den Aufrufer, die Journal-Zeile
(`logPrompt(..., "supervisor", ...)`, Source-Union bei `server.ts#logPrompt`) und das Audit-Ereignis
`supervisor_nudge` **ohne Text** (innerhalb `server.ts#supervisorNudge`) sind der ganze Datensatz.

### 1.6 Reichweite über Programme

`GET /api/self/programs` gibt dem gebundenen Supervisor **jedes** Programm mit vollem Inhalt
(`server.ts#"/api/self/programs"`) — Intent, successCriterion, nonGoals, openQuestions; `POST`
bleibt propose-only (`status: "proposed"`, `proposedBy.kind: "session"`, im selben Routenblock
`server.ts#"/api/self/programs"`). Die Reichweite
folgt der **Bindung**, nicht einer Proposer-Identität — sie überlebt also die Nachfolge.

---

## 2. Kontext-Kosten — was wie viel Fenster kostet

Umrechnung durchgehend **~4 B/Token** (Prosa-Näherung, kein gemessener Tokenizer-Lauf); Prozente
gegen ein **1M-Fenster** (Fable/Opus). Alle Byte-Zahlen der Tabelle sind GEMESSEN
(`wc -c`, bzw. Ledger-Feld), die Token/Prozent-Spalten sind daraus ~gerechnet.

| Artefakt | Bytes | ~Tokens | ~% von 1M | Wer zahlt |
|---|---:|---:|---:|---|
| Supervisor-Bootstrap-Brief | 1 177 | ~295 | ~0,03 % | einmalig, zugestellt |
| Supervisor-Nachfolge-Brief (mit carry) | 1 418 | ~355 | ~0,04 % | einmalig, zugestellt |
| Program-MAIN-Brief zum Vergleich | 5 302 | ~1 330 | ~0,13 % | — |
| `./state.sh` (ein Abruf) | 4 923 | ~1 230 | ~0,12 % | bei Abruf |
| `./register.sh` (ein Abruf) | 37 177 | ~9 290 | **~0,93 %** | bei Abruf |
| `HANDOFF.md`, **oberster Abschnitt** | 3 484 | ~870 | ~0,09 % | bei Abruf |
| `HANDOFF.md`, **ganze Datei** | 217 792 | ~54 400 | **~5,4 %** | nur wer den Vertrag bricht |
| `AGENTS.md` (Ziel zweier Anker) | 9 572 | ~2 390 | ~0,24 % | bei Abruf |
| `CLAUDE.md` (Regelbuch, **kein** Anker im Plan) | 106 668 | ~26 670 | **~2,7 %** | bei Abruf |
| `GET /api/self/supervisor-view` | 18 539 | ~4 630 | ~0,46 % | bei Abruf (GEMESSEN 2026-08-17 aus der Pane des gebundenen Supervisors, Slot 7) |

**Der zugestellte Teil ist mikroskopisch: ~0,04 % des Fensters.** Die gesamte Nachfolge-Zustellung
kostet weniger als ein Drittel eines `state.sh`-Abrufs. Wer an der Bootstrap-Nachricht spart, spart
an der falschen Stelle — die Kosten liegen ausnahmslos im *Abrufen*.

**Abgeleitete Wahrheit kostet nur beim Abruf, und das ist ihr eigentlicher Wert.** `state.sh`,
`register.sh` und die `supervisor-view` halten **0 Bytes** im Fenster, bis jemand sie zieht; sie
altern nie im Kontext, weil sie beim Ziehen neu abgeleitet werden. Der Preis ist pro Zug fällig, und
er ist ungleich verteilt: `register.sh` ist mit ~0,93 % **siebenmal so teuer wie `state.sh`** — ein
reflexhaftes „erst beide Skripte" ist für einen Supervisor, der nur die Portfolio-Lage braucht,
die teuerste Zeile seiner Startordnung.

**`supervisor-view` habe ich NICHT gemessen** und schätze sie hier auch nicht: die Route antwortet
einer Lane mit 409 (`server.ts#"/api/self/supervisor-view"`), und eine Schätzung aus den Deckeln allein (50 + 4×20 + 2×5
Zeilen, Freitext auf 200 Zeichen) spannt eine Größenordnung auf, die als Zahl seriöser aussähe, als
sie ist. **Das ist die erste Messung, die der nächste bindende Supervisor nachtragen sollte** — ein
`curl … | wc -c` aus seiner eigenen Pane, ein Kommando, eine Zeile in dieser Tabelle.

**Fixkosten zum Vergleich** (aus `CLAUDE.md` §„Kontext-Schwelle für eine MAIN-Session", dort an
Session 38 gemessen): Erdung bis „ich weiß, wo ich bin" **~7,6 %**, Handoff schreiben + Nachfolge
spawnen **~2–4 %**. Die Supervisor-Zustellung ist damit rund **zwei Größenordnungen** kleiner als
die Erdung, die sie auslöst. Wer Supervisor-Kontext sparsam machen will, macht die **Startordnung**
sparsam, nicht den Brief.

**Und die Umrechnungsfalle, weil sie hier sofort zuschlägt** (`CLAUDE.md` §„WENN DU EINE GPT-LANE
BRIEFST"): **Fixkosten fallen in Bytes an, nicht in Prozent.** Dieselbe Erdung, die auf 1M ~7,6 %
kostet (~76 000 Tokens), wäre auf einem 258 400er GPT-Fenster **~29 %**. `register.sh` allein wäre
dort ~3,6 %, `CLAUDE.md` ~10 %. Jede Prozentzahl dieses Abschnitts gilt für ein 1M-Fenster und darf
nicht übertragen werden.

---

## 3. Sparsamkeits-Design — der kleinste hinreichende Nachfolge-Bootstrap

Das Prinzip, das der gebaute Rail schon verkörpert: **zustellen, was die Session ohne Fleet nicht
wissen kann; anzeigen, was sie sich holen kann; weglassen, was sie sich verdienen muss.**

### 3.1 In den Gründungsbrief (zugestellt, ~1,4 KB)

- **Rolle und ihre Grenze** — nur, weil sie aus keinem Fakt ableitbar ist. Fleet hat keinen
  Rollen-Typ (`docs/attic/working-circle-analysis-2026-08-16.md` §1.1); die Rolle existiert nur als dieser
  Text.
- **Die strukturellen Unfähigkeiten** — sie ersparen einen Versuch samt 409 und, teurer, das
  Nachdenken darüber.
- **Die Kanalliste** — ein Name je Kanal, kein Schema. Die Antwort ist selbstbeschreibend.
- **Startordnung als *Ordnung*, nicht als Inhalt.**
- **`carry` ≤ 500 Zeichen** — der eine Satz, den die Vorgängerin weiß und kein Ledger trägt. Der
  echte Transfer ist `HANDOFF.md`, und der Brief sagt genau das.
- **Anker-Block: Zeiger, nie Inhalt.**

### 3.2 In die typisierten Sinne (Pull, 0 Bytes bis zum Abruf)

Portfolio · Operations · Integration · Attention · Provenance. Alles, was ein Ledger schon trägt,
gehört hierher und nie in den Brief: es altert, es ist gedeckelt abrufbar, und der Abruf ist ein
Entscheid der Session statt einer Vorab-Wette des Servers.

### 3.3 Bewusst WEGGELASSEN (nach ContextPlan-Muster: Auslassung mit benanntem Grund)

| Weggelassen | Grund |
|---|---|
| Programm-Inhalte im Brief | Ein Supervisor sitzt quer zu allen Programmen; `n × programContent` wäre unbeschränkt. Reichweite ist gebaut (`GET /api/self/programs`), Zustellung wäre eine Wette. |
| `HANDOFF.md`-Inhalt | Zeiger statt Kopie. Zustellung kostete ~5,4 %; die oberste Sektion, die die Nachfolgerin selbst liest, kostet ~0,09 %. |
| Verhaltens-Rulebook | Ausdrücklicher Non-Goal des Cuts (Kommentar über `server.ts#supervisorBriefBody`): ein Rulebook vor der ersten Beobachtung wäre Prosa, die der nächste Cut als Vertrag erbt. Bleibt owner-promotet und später. |
| `CLAUDE.md` | Kein Pack, kein Anker, ~2,7 %. `AGENTS.md` ist der dünne Zeiger, und er ist Anker-Ziel. |
| Nudge-/Prompt-Historie | Existiert im Journal; die Session braucht sie nicht, um zu starten. |
| `land-mechanics`, `task-queue`, `harness-adapter`, `private-deploy-overlay` | Vom Plan selbst als `trigger-not-matched` verworfen (GEMESSEN, §1.3) — ein Supervisor landet nicht, dispatcht nicht und wählt keinen Harness. |
| Lineage der Vorgängerinnen | Existiert nicht (§5.1). Die Auslassung ist hier ehrlich, nicht sparsam. |

### 3.4 Zwei benennbare Sparhebel, die heute noch offen sind

- **Die Startordnung des Briefs schreibt `register.sh` vor** (`server.ts#supervisorBriefBody`) — die teuerste Zeile
  (~0,93 %) für eine Rolle, die keine Queue-Zeile dispatcht. Ein Supervisor-Brief, der
  `GET /api/self/supervisor-view` **vor** `register.sh` stellt und letzteres nur bei konkretem
  Bedarf nennt, wäre der billigste real verfügbare Schnitt. **Nicht getan** — der Brief-Rumpf ist
  Server-Code, diese Lane ist doc-only; das gehört als owner-promoteter Cut vorgeschlagen, nicht
  hier eingebaut.
- **`carry` wird bei einer Supervisor-Nachfolge nicht erzwungen.** 500 Zeichen sind der billigste
  Kontext im ganzen System (~0,01 %) und die einzige Stelle, an der „woran ich gerade war" ohne
  Handoff-Lektüre ankommt.

---

## 4. Owner-Runbook — was HEUTE zu tun ist

Host literal `http://100.64.0.1:8790`. Owner-Token aus `fleet.json` als
`authorization: Bearer …`. Die Supervisor-Bindung ist jederzeit lesbar:

```sh
curl -s -H "authorization: Bearer $TOK" http://100.64.0.1:8790/api/programs \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["supervisor"], d["supervisorHealth"])'
```

`supervisorHealth` (seit 2026-09-07, `server.ts#supervisorHealth`) ist die **Lebendprobe neben dem
Record** und wird pro Lesung abgeleitet, nie persistiert: `occupancy` ist `unbound` (nie ernannt) ·
`live` (der Slot trägt noch dasselbe `openedAt`) · `stale` (ernannt, Occupant weg oder ersetzt), und
`sessionIdMatch` ist die zweite Hälfte derselben Frage, exakt in der Vokabel von `programHealth`.
Vorher trug die Route den Record OHNE seine Liveness — eine Bindung auf einen längst recycelten Slot
las sich wie eine funktionierende Ernennung. Gemessen an genau diesem Fall: `{slot:5,
openedAt:1787497726285}` vom 21.08. gegen einen Slot, der zu diesem Zeitpunkt eine Lane war.

### 4.1 Frische Supervisor-Session erzeugen

```sh
curl -s -X POST http://100.64.0.1:8790/api/supervisor/bootstrap \
  -H "authorization: Bearer $TOK" -H "content-type: application/json" \
  -d '{"cwd":"/Users/owner/claude-fleet","harness":"claude","model":"claude-fable-5","label":"🧿 Supervisor"}'
```

**Owner-only** (`server.ts#"/api/supervisor/bootstrap"`): ein Self-Token ist hier gar keine Kredenz
(401), ein Steward-Token ist ein gewöhnlicher Auth-Fehlschlag — wer den Fleet supervisiert,
entscheidet der Owner. Vorbedingungen, jede mit eigener Antwort:

| Bedingung | Naht | Antwort, wenn verletzt |
|---|---|---|
| `cwd` ist ein Git-Repo, HEAD + Branch lesbar | `preflightProgramMain`, `server.ts#preflightProgramMain` | 400 |
| Fremdes Repo: getrackte, nicht-leere `AGENTS.md` | ebd. | 400 |
| Harness/Modell/Effort gültig für den Adapter | `bootstrapSupervisor`, `server.ts#bootstrapSupervisor` | 400 |
| `label` fehlt | Default `SUPERVISOR_LABEL = "🧿 Supervisor"` (`server.ts#SUPERVISOR_LABEL`, gesetzt in `server.ts#bootstrapSupervisor`) | — |
| Kein freier Slot | `server.ts#bootstrapSupervisor` | 409 `no free slot` |
| Bindung existiert und ihr Occupant lebt | `server.ts#bootstrapSupervisor` | **200** `{ok:true, existing:true}` — idempotent, kein zweiter Supervisor |
| Bindung existiert, Occupant tot (*stale*) | `server.ts#bootstrapSupervisor` | **200** — die tote Bindung wird ÜBERSCHRIEBEN, die Antwort nennt sie als `replaced`, eine Trail-Zeile `supervisor_rebound` ebenso. (Die frühere Fassung dieser Zeile nannte ein 409 ohne Clear-Weg; das ist seit der Rebind-Naht überholt, §5.1.) |
| Ein Bootstrap läuft bereits | `server.ts#bootstrapSupervisor` (Riegel `server.ts#supervisorBootstrapInflight`) | 409 |

Danach: Slot öffnen, 4 s Boot-Ruhe, `canDeliver`-Gate, `waitForFoundingReadiness`, Brief senden,
**dann erst** binden (`server.ts#bootstrapSupervisor`). Die Bindung wird strukturell nur nach
erfolgreichem Send gesetzt: **korrigiert gegenüber der Vorfassung**, die hier von einer "alten
Bindung" sprach, die es beim ERSTEN Bootstrap nie geben kann (existiert bereits eine Bindung, kehrt
die Funktion vorher zurück, siehe Tabelle oben). Für den Bootstrap-Pfad gilt: Prozessverlust *vor*
dem Send lässt `supervisor` unverändert `null` — als wäre der Aufruf nie geschehen. Verlust *nach*
dem Send, aber vor `saveStateNow`, verliert die In-Memory-Bindung beim Neustart wieder auf `null`,
während die belieferte Nachfolgerin eine gewöhnliche ungebundene Session bleibt — der Owner
entscheidet dann. Die *Nachfolge* (§4.2) hat dagegen eine echte alte Bindung und einen im Code
benannten Kommentar dazu (`server.ts#succeedSupervisor`, „Same one-way crash boundary as the
Program-MAIN rail").

### 4.1b Eine LAUFENDE Session als Supervisor binden

`POST /api/supervisor/bootstrap` ÖFFNET die Session, die es ernennt. Soll die Rolle an eine Session
gehen, die es schon gibt — einen arbeitenden Controller, den `⚙ steward`, die Session, die gerade
liest — gab es dafür bis 2026-09-07 keine Tür: der Owner bekam eine zusätzliche Pane ohne Kontext.

```sh
curl -s -X POST http://100.64.0.1:8790/api/supervisor/bind \
  -H "authorization: Bearer $TOK" -H "content-type: application/json" \
  -d '{"slot":7}'
```

**Owner-only** (`server.ts#"/api/supervisor/bind"`), gleiche Begründung wie beim Bootstrap: ein
Self-Token ist hier gar keine Kredenz (401). Der Body ist **geschlossen und nennt genau einen Slot** —
kein Label-Match, kein „erste idle Session", kein Wildcard. Eine Rolle, die ihren eigenen Halter
finden kann, ist keine Autorisierung.

| Bedingung | Naht | Antwort, wenn verletzt |
|---|---|---|
| Body trägt ein weiteres Feld | `server.ts#bindSupervisor` | 400 `a bind names a slot and nothing else — [label] is not read` |
| `slot` fehlt oder ist keine ganze Zahl | ebd. | 400 `slot must be an integer …` |
| Slot existiert nicht | ebd. | 409 `unknown slot N` |
| Slot ist leer | ebd. | 409 `carries no session — a Supervisor is bound to an occupant, not to a slot` |
| Slot ist eine **Lane** | ebd. | 409 `is a lane — a lane executes one task in one worktree and is never the Supervisor` |
| Bindung lebt und ist genau dieser Occupant | ebd. | **200** `{ok:true, existing:true}` — idempotent, kein zweiter Brief, keine zweite Trail-Zeile |
| Bindung lebt und ist eine ANDERE Session | ebd. | 409 `a LIVE Supervisor binding is never displaced …` — die Vorgängerin nachfolgt oder retired zuerst |
| Bindung existiert, Occupant tot | ebd. | **200**, überschrieben, `replaced` im Body + Trail `supervisor_rebound` |
| Ein Bootstrap/Bind läuft bereits | Riegel `server.ts#supervisorBootstrapInflight` (geteilt mit Bootstrap und Nachfolge) | 409 |
| Zustell-Gate zu (`canDeliver`) | ebd. | 409 `Supervisor bind delivery held (…)` |

Die Tür **liefert**, bevor sie bindet: eine still verliehene Rolle ist dieselbe Fehlerklasse wie eine
still verlorene. Der Text ist die **gemeinsame** `supervisorBriefBody()` der beiden Founding-Türen
unter einer eigenen ersten Zeile (`server.ts#buildSupervisorBindBrief`) — eine zweite Kopie des
Rollentexts wäre eine zweite Antwort auf „was ist ein Supervisor". Was diese Tür NICHT tut: sie
öffnet keinen Slot, hängt keinen Context-Anchor-Block an und prägt **keinen Context-Receipt** — die
Session hat ihren eigenen Kontext und einen Receipt darüber, wie sie ihn bekam; ein Founding-Receipt
hier würde eine Gründung behaupten, die nie stattfand. Die Bindung wird strukturell erst NACH dem
erfolgreichen Send geschrieben (Pin in `e2e/pins.ts`); ein Send-Ausgang, den tmux offen lässt, ist
409 mit unveränderter Bindung und einer `uncertain`-Zeile im Prompt-Journal.

Trail: `supervisor_bound` (die Ernennung, mit Slot + `openedAt`) und zusätzlich `supervisor_rebound`,
wenn eine tote Bindung überschrieben wurde.

### 4.2 Nachfolge auslösen (aus der Pane des Supervisors)

```sh
curl -s -X POST http://100.64.0.1:8790/api/self/succeed \
  -H "content-type: application/json" -H "x-fleet-self-token: $FLEET_SELF_TOKEN" \
  -d '{"carry":"das Erste, was ich als Nächstes täte"}'
```

Vorbedingungen der Reihe nach (`handleSelfSucceed`, `server.ts#handleSelfSucceed`):

1. **Kein Lane, kein Steward** — `successionScopeError` (`server.ts#successionScopeError`).
2. **Keine zweite Nachfolge derselben Session** — `successionStarted`/`successionInflight`, 409.
3. **`HANDOFF.md` existiert, ist sauber und hat einen Commit jünger als diese Session**
   (`handoffCommittedAfterOpen`, `server.ts#handoffCommittedAfterOpen`; 409 mit der Begründung
   *„otherwise the successor would have nothing to read"*). **Das ist der einzige harte Zwang des
   ganzen Rails** — der Brief verweist auf `HANDOFF.md`, also muss die Datei existieren.
4. **Nicht gleichzeitig Program-MAIN eines aktiven Programms** — sonst 409 *„ambiguous succession:
   this session is both the Supervisor and Program-MAIN"* (innerhalb `server.ts#handleSelfSucceed`).
   Zwei Autoritäten auf einer Session haben keine definierte Übertragungsreihenfolge, und der Code
   erfindet keine.
5. **Freier Slot** — sonst 409, und die Vorgängerin bleibt stehen.

Der Weg danach ist `succeedSupervisor` (`server.ts#succeedSupervisor`) und Zeile für Zeile der
Bootstrap-Pfad, mit derselben Ein-Weg-Crash-Grenze (hier trägt sie einen eigenen Kommentar, s.o.).
Die Vorgängerin räumt der Grace-Timer (`MIGRATE_GRACE_MS`, Default 120 s,
`server.ts#MIGRATE_GRACE_MS`, persistierte Deadline — der nächste Boot wird Executor, wenn dieser
Prozess stirbt); sofort räumen geht mit `POST /api/self/retire`.

### 4.3 Wenn der Attention-Kanal nicht trägt

Der Gründungsbrief nennt `POST /api/self/attention` als Weg zum Owner. **Eine Session, die *nur*
Supervisor ist, bekommt dort 409** (§5.2). Bis das ein Cut schließt gilt:

- **Der Supervisor spricht in seiner eigenen Pane** — der Owner liest sie ohnehin. Kein
  typisierter Kanal, keine Zustellgarantie, keine Quittung.
- **Ein Programm-Vorschlag ist der einzige typisierte owner-gerichtete Schreibweg, den er hat**
  (`POST /api/self/programs`, propose-only) — er landet in der Owner-Ansicht als `proposed` und
  wartet auf Promotion. Für „bitte entscheide X" ist das ein grober, aber echter Kanal.
- **Ein Nudge ist kein Ersatz.** Er erreicht nur einen Program-MAIN und weigert sich ausdrücklich,
  an einem `awaiting:"owner"` vorbeizugehen.

---

## 5. Bekannte Lücken — ehrlich, mit ihren Kosten

### 5.1 Keine Supervisor-Lineage (der Stale-Clear-Weg ist geschlossen)

Die Bindung ist ein **Singleton**, kein Verlauf: `supervisor = {…}` wird bei Bootstrap
(`server.ts#bootstrapSupervisor`) und Nachfolge (`server.ts#succeedSupervisor`) **überschrieben**.
Frühere Occupants sind nicht rekonstruierbar; die `supervisor-view` sagt es über sich selbst
(`unknown`-Zeile *„1 lineage gap"*, `server.ts#supervisorView`). Der einzige forensische Rest sind die
`context-receipts.jsonl`-Zeilen mit `programId:null` **und** `taskId:null` — das ist die Signatur, an
der ich §1.3 gemessen habe, aber sie ist ein Nebenprodukt, kein Register.

**Die zweite Hälfte dieser Lücke ist geschlossen, und der Absatz sagt, wie.** Stirbt der Prozess
zwischen Send und `saveStateNow`, oder wird der Slot recycelt, bleibt eine *stale* Bindung stehen —
das gilt weiter. Was nicht mehr gilt: dass sie den Fleet dauerhaft ohne Supervisor lässt. Zwei
Owner-Türen überschreiben sie und NENNEN, was sie ersetzt haben (`replaced` + Trail-Zeile):
`bootstrapSupervisor` seit der Rebind-Naht, `bindSupervisor` (§4.1b) seit 2026-09-07. Ein Eingriff in
`fleet.json` ist dafür nicht mehr nötig.

**Und seit 2026-09-07 wird eine tote Bindung beim BOOT benannt statt still autoritativ.** Der Loader
liest den Record vor der Slot-Schleife und musste ihn deshalb aus seiner FORM allein rehydrieren; die
Lebendprobe läuft jetzt danach (`server.ts`, direkt hinter `backfillProgramMainSessionId`) und
schreibt eine Log-Zeile plus die Trail-Zeile `supervisor_binding_stale`. **Der Record wird dabei nicht
gelöscht** — „nie ernannt" (`supervisor: null`) und „der Ernannte ist weg" (stale) sind zwei
verschiedene Zustände des Fleets, und nur der zweite sagt, dass eine Ernennung ohne Nachfolge endete.

**Was als Kosten bleibt:** der Verlauf. Die Bindung ist ein Singleton, frühere Occupants sind nicht
rekonstruierbar, und ein Rebind ersetzt lautstark, ohne eine Lineage anzulegen — anders als
`Program.lineage` auf der Program-MAIN-Schiene. Geerbt vom Program-MAIN-Modell und in beiden
Cut-Reviews benannt.

### 5.2 Der Attention-Kanal stirbt mit dem Programm-Abschluss

`openAttention` verlangt `boundProgramForMain(s)` — ein **aktives** Programm, dessen `main` genau
diese Session ist (`server.ts#boundProgramForMain`, angewandt in `server.ts#openAttention`; die
Route selbst bei `server.ts#"/api/self/attention"`). Die Supervisor-Bindung ist ein *anderer*
Singleton und erfüllt dieses Prädikat nie. Die einzige Session, die heute beides war, war die
erste — solange ihr Programm `active` war.

**Das ist ein Widerspruch zwischen zugestelltem Text und Code**, und der Code gilt: der Brief
(`server.ts#supervisorBriefBody`) verspricht *„POST /api/self/attention (reach the owner)"*,
`openAttention` antwortet dem gebundenen Supervisor mit 409
*„not the current bound MAIN of an active program"*. **Kosten:** die Rolle, die den Owner
ansprechen soll, hat dafür keinen typisierten Kanal — und merkt es erst am 409. Der billigste
Schnitt wäre, `openAttention` das Occupancy-Prädikat `isBoundSupervisor` als zweiten Disjunkt zu
geben, genau wie `GET /api/self/programs` es tut (`server.ts#"/api/self/programs"`) — mit
`programId: null` als ehrlichem cross-program-Scope, derselben Konvention, die der
Supervisor-Receipt schon benutzt. **Vorschlag, nicht Änderung:** diese Lane ist doc-only, und die
Naht ist owner-promotet.

### 5.3 Die Rollen-Schicht hat keinen Träger

`ContextPlanInput` (`context-plan.ts#ContextPlanInput`) kennt keine Rolle; `mode` ist eine Berechtigungsform,
keine Disziplin (`docs/attic/working-circle-analysis-2026-08-16.md` §2.2 Zeile 5, §4 G3). Die
Supervisor-Rolle existiert deshalb **ausschließlich** als Prosa in `supervisorBriefBody()` — nicht
versioniert, nicht ausgewählt, nicht durch einen Receipt als geliefert beweisbar, während die
Pack-Auswahl daneben beides rigoros ist. **Kosten:** jede spätere Verhaltens-Promotion ist eine
Text-Änderung im Server ohne Liefer-Evidenz — genau die Eigenschaft, die `ContextReceipt` anderswo
beseitigt hat. Der bewusste Non-Goal von Cut 1/2 (§3.3) ist damit nicht nur eine Vertagung, sondern
wartet auf einen Träger, den es noch nicht gibt.

### 5.4 Zwei geerbte Grenzen, hier nur benannt

- **`done-looking` ist ein Git/Idle-Prädikat, kein Bericht** (G5 der Analyse). Ein Supervisor, der
  darauf nudgte, nudgte Sessions mitten in einer Suite. Der Nudge-Pfad umgeht das heute, weil sein
  Empfänger aus dem Programm abgeleitet ist und nicht aus einem Signal.
- **Transport ist ein Tastendruck in einen Composer** (G1). Der Nudge erbt das: `sendText` in eine
  attended Pane kann einen ungesendeten Owner-Entwurf mitsenden.

---

## 6. Was ich NICHT geprüft habe

- **Keine Pane gelesen.** Alle Live-Verlaufsangaben (Slot 5 → Slot 7, Nudge-Roundtrip) stammen aus
  `HANDOFF.md` bzw. `context-receipts.jsonl` — die Byte- und Occupant-Zahlen habe ich am Ledger
  gegengeprüft, den *Ablauf* nicht beobachtet.
- **`GET /api/self/supervisor-view` nie aufgerufen** — als Lane 409. Die Payload-Größe in §2 ist
  eine Fremdmessung des gebundenen Supervisors (18 539 B, 2026-08-17), nicht meine.
- **`src/client.ts` nicht gelesen** — keine Aussage hier betrifft die Board-Oberfläche.
- **`e2e/` nicht auditiert.** Wo ich „GELESEN" sage, meine ich: der Pfad existiert — nicht, dass eine
  Sonde ihn verteidigt.
- **Keine Suite über den doc-proportionalen lokalen Beweis hinaus gefahren**; keine Aussage über
  Laufzeitverhalten, die ich nicht in der Quelle gelesen habe.
- **`context-packs.ts` nur über die Receipt-Zeilen und `docs/attic/working-circle-analysis-2026-08-16.md`
  §2.1** — die Pack-Definitionen selbst habe ich nicht gelesen.
- **Verweise sind `datei#symbol`, nicht `datei:zeile`** (umgestellt 2026-08-25, s. Methode-Absatz
  oben); ein Symbolname überlebt jedes weitere `server.ts`-Land, eine Zeilennummer nicht.
