# Rollen-Architektur — EVIDENZDOSSIER (gemessen 2026-08-21)

Status: **Messung, kein Entwurf.** Dieses Dokument enthaelt ausschliesslich Befunde, die gegen
`server.ts` (19 323 Zeilen), `src/protocol.ts`, `capability-map.ts` und die Live-Sensoren des
laufenden Servers erhoben wurden. Es schlaegt nichts vor. Es ist die Eingabe fuer den
Architektur-Entwurf und fuer dessen Kritik.

Baum: `de1f6c6` (HEAD des Haupt-Checkouts zur Messzeit). Live-Server: `bootHead 0ce32dc`,
`behindCount 4`, `codeBehind:false` — der laufende Prozess ist fuer alle hier zitierten Stellen
codegleich mit der Platte, bis auf vier Commits, die keine Route bewegen.

Jede Zeilenangabe ist `server.ts:<zeile>`, wo nichts anderes steht. Wo eine Zahl steht, wurde sie
gezaehlt, nicht geschaetzt.

---

## 1. Der ausloesende Befund

**Eine gebundene Program-MAIN kann strukturell keine Arbeit anlegen und keine starten.**

| Faehigkeit | Route | Tier | Fuer eine Program-MAIN erreichbar? |
|---|---|---|---|
| Task anlegen | `POST /api/tasks` (`:18486`) | Owner | **nein** |
| Task starten | `POST /api/tasks/:id/dispatch` (`:18567`) | Owner | **nein** |
| Lane oeffnen | `POST /api/lanes` (`:17547`) | Owner | **nein** |
| Slot oeffnen | `POST /api/slots/:id/(open\|open-worktree\|…)` (`:18959`) | Owner | **nein** |
| Task anlegen (pending) | `POST /api/steward/tasks` (`:16208`) | Steward | **nein** (anderes Credential) |
| Frage an den Owner | `POST /api/self/attention` (`:16638`) | Self, non-lane, **gebundene MAIN eines aktiven Programs** (`boundProgramForMain`, sonst 409) | ja |

Es existiert **keine** Self-Route, die eine Task **anlegt** oder **startet**. Gezaehlt: 22
Self-Routen (§4). Genau **eine** davon schreibt ueberhaupt in eine Task, und ihr Zuschnitt ist
der Praezedenzfall, den ein Entwurf kennen muss:

```
POST /api/self/criterion (:16769)   // LANE-only (:16773)
  → tasks.find(x => x.slot === s.id && x.status === "sent")     // NUR die eigene Gruendungs-Task (:16780)
  → t.criterion = {text, proposedAt, confirmedAt: null}          // NUR dieses eine Feld (:16786)
  → if (t.criterion?.confirmedAt) 409                            // nach Owner-Promotion unaenderbar (:16784)
  → audit("criterion_proposed", s.id, t.id)                      // eigene Quittung (:16787)
```

Ein Self-Prinzipal darf also heute schon einen Task-Zustand schreiben — aber nur an dem Objekt,
das ihn selbst gegruendet hat, nur an einem typisierten Feld, nur bis zur Owner-Promotion, und
mit eigener Quittung. Die Luecke der Program-MAIN ist damit **kein neuer Mechanismus**, sondern
derselbe Mechanismus eine Objektebene hoeher.

**Die Umkehrung ist der eigentliche Befund:** der Steward — die ausdruecklich *beobachtende*,
nicht handelnde Rolle — hat eine Task-Produzenten-Route (`:16208`), die Koordinationsrolle hat
keine. Und diese Route **verweigert ausdruecklich die Program-Bindung**:

```
if (body.programId !== undefined)
  return json({ error: "only the owner may attach work to a program" }, 400);   // :16212
```

Folge im Betrieb: jede Queue-Handlung einer Program-MAIN lief bisher ueber das **Owner-Token**,
das im Haupt-Checkout in `fleet.json` liegt und dort fuer jede Session lesbar ist. Der Ausweg
ohne Owner-Token ist der manuelle Worktree — Handarbeit.

---

## 2. Die Prinzipale, wie sie heute wirklich sind

Es gibt **VIER Credential-Klassen** plus die Gast-/Share-Flaeche. Ein „Rollen"-Begriff existiert
in keiner davon als Feld.

> **KORRIGIERT 2026-08-21** (der Opus-Kritiker hat die vierte gefunden, Gegenprobe bestaetigt ihn):
> die urspruengliche Fassung zaehlte drei und uebersah ausgerechnet den bestehenden
> **Nicht-Owner-Produzenten von `pending auftrag`-Zeilen**.

| Prinzipal | Traeger | Mechanismus | Reichweite |
|---|---|---|---|
| **Owner** | ein Token in `fleet.json` | `tokenGate` (`:12501`); alles unterhalb `:17000` | vollstaendig |
| **Steward** | ein zweites Token in `fleet.json` (`:2608`, `:14353`) | Ganz-Prinzipal-Router `handleStewardRoute` (`:16067`), Fallback **403** „route not in scope" (`:16843`) | 14 Routen |
| **Self** | ein Token **pro Slot** (`Slot.selfToken`, `:1841`), in die Pane gebacken (`:4332`) | jede Route sucht selbst `slots.find(x => secretEq(given, x.selfToken))` | 22 Routen |
| **Intake** | `FLEET_INTAKE_SECRET` (`:2535`), **nie** das Owner-Token | `handleIntake` (`:13777`), Route `:16362` — **VOR** dem Share-Host-Gate, also auch am oeffentlichen Tunnel erreichbar | genau eine Handlung: eine Task anlegen |
| Share/Gast | Share-Secret + Cookie | eigener Gate oberhalb aller vier | nur lesend, Input wird verworfen |

**Was Intake erzeugt, ist exakt die Zeilenform, um die es in der Rollenfrage geht** (`:13806`):

```
{ source: "intake", kind: "auftrag", status: "pending", repo: null, from, originId: id }
```

Ein Nicht-Owner-Prinzipal, der `pending auftrag`-Zeilen mintet, **existiert also bereits** — hinter
eigenem Secret, mit Rate-Limit, Lockout und Timing-safe-Vergleich, und der Owner promotet. Heute
ist er abgeschaltet (`INTAKE_SECRET` leer ⇒ 404, `:13778`).

**Zwei Praezedenzfaelle, die in ENTGEGENGESETZTE Richtungen zeigen** — das ist die eigentliche
Information: der Steward, die vertrauteste Nicht-Owner-Quelle, defaultet auf `notiz` (`:16244`);
Intake, die am wenigsten vertraute und einzige oeffentlich erreichbare, schreibt `auftrag`. Wer
den Default fuer einen neuen Produzenten waehlt, muss sagen, welchem der beiden er folgt und
warum.

Drei Konstruktionsdetails, die fuer einen Entwurf tragend sind:

- **Autoritaet ist POSITIONELL.** Der Kommentar `// everything below carries authority — token
  required` (`:16999`) plus `tokenGate` (`:17000`) macht die **Zeilennummer** zur
  Berechtigungsregel. An mindestens sieben Stellen steht das explizit als Begruendung im Code
  („owner-only by POSITION", z. B. `:17148`, `:17198`, `:17293`, `:17340`, `:17668`, `:18233`,
  `:18479`). Es gibt keinen Ort, an dem steht „diese Faehigkeit verlangt Rolle X".
- **Der Steward-Router ist der einzige existierende Praezedenzfall fuer eine typisierte
  Teilmenge.** Ein Credential wird abgefangen, eine Funktion entscheidet ueber die
  Routen-Teilmenge, alles andere ist 403 (nicht 401 — bewusst unterscheidbar, `:16838`).
- **Der Self-Token rotiert beim Recycling des Slots** (`:4494`), und `successionStarted`
  (`:5118`) bindet eine Nachfolge an genau den Token des Vorgaengers. Identitaet ist also am
  Slot-Sitz befestigt, nicht an einer Rolle.

---

## 3. Wie „Rolle" heute entsteht

Es gibt **kein `role`-Feld** auf `Slot`. Rolle wird an genau drei Stellen ad hoc abgeleitet:

1. **Lane vs. Nicht-Lane:** `s.worktree !== null`.
2. **Steward:** `s.label === STEWARD_LABEL`, und `STEWARD_LABEL` ist der Literalstring `"⚙ steward"`
   (`:2607`). **21 Vorkommen** in `server.ts`; die zusammengesetzte Rollen-Probe
   `s.worktree && s.label !== STEWARD_LABEL` allein **9-mal**. Eine Rolle wird also durch
   Zeichenkettenvergleich auf ein Anzeigelabel bestimmt; ein Rename des Slots wechselt die Rolle.
3. **Program-MAIN:** `program.main = {slot, openedAt, sessionId, boundAt}` (`:1940`) plus
   `program.status === "active"` (`:5299`). Das ist die einzige der drei, die eine echte
   Identitaets-Triple traegt (Slot + openedAt + sessionId) und damit einen Occupant-Wechsel
   ueberlebt bzw. korrekt bricht.

**Nicht als Maschinenfakt existent:** Fleet Controller, Supervisor, Builder, Critic, Resolver,
Canary, Director. Der 🧿-Supervisor ist heute ein Label plus eine Bootstrap-Route
(`POST /api/supervisor/bootstrap`, `:16828`, **owner-gated**) plus eine Lese-Sicht
(`GET /api/self/supervisor-view`, `:16518`, jede Session). `capability-map.ts` fuehrt fuer die
Rolle `supervisor` ausdruecklich `recipient: "unsupported"` — eine gemessene Abwesenheit.

Die Rollennamen, die in `src/protocol.ts` typisiert sind, sind genau vier und decken nur die
Capability-/Frage-Ebene ab:

```
export type CapabilityRole = "session" | "program-main";                       // protocol.ts:255
export type QuestionRole  = "lane" | "program-main" | "supervisor" | "other-session";  // :305
```

---

## 4. Die Authority-Karte (vollstaendig gezaehlt)

75 Routen-Literale plus 42 parametrisierte Regex-Routen. Verteilung:

- **Self-Tier (22 Routen, `:16408`–`:16816`)** — jede prueft ihren Token selbst; drei
  Scope-Regeln, die einander widersprechen und beide Absicht sind:
  - **lane-only** (Nicht-Lane → 409): `fleet-report` (`:16613`), `drift` (`:16676`),
    `gate` (`:16716`), `criterion` (`:16769`), `verify-intent` (`:16796`)
  - **non-lane-only** (Lane → 409): `watch` (`:16587`), `attention` (`:16638`),
    `clarifications/:id/reply` (`:16623`), `succeed`/`retire` (`:16658`/`:16664`)
  - **jede Session mit cwd:** `self`, `flakes`, `autos`, `programs`, `program-execution`,
    `supervisor-view`, `nudge`, `main-direct` (4 Routen), `clarifications`, `events/:id/ack`
- **Steward-Tier (14 Routen, `:16068`–`:16290`)**: `sessions`, `deploys`, **`deploy`**,
  `digest`, `dispositions` (nur GET), `autos`, **`tasks`**, `send`, `journal` (GET+POST),
  `slots/:id/brief`, `slots/:id/transcript`.
- **Owner-Tier (40 Literale + alle `/api/slots/:id/*`, `/api/tasks/:id/*`,
  `/api/attention/:id/*`, ab `:17027`)**: alles, was Slots oeffnet/toetet, Lanes anlegt, Tasks
  anlegt/aendert/startet, landet, committet, reviewt, Dateien schreibt, Pins setzt,
  Attention beantwortet.

Eine Faehigkeit hat heute **keine deklarierte Rolle, keine deklarierte Zustandswirkung und keine
deklarierte Quittung** — ausser den zwei, die `capability-map.ts` fuehrt (§9).

---

## 5. Das Produzent/Promoter-Muster, das es schon gibt

Vier Stellen implementieren dasselbe Muster: *ein Agent schlaegt vor, nur der Owner macht es
verbindlich.* Es ist der einzige belegte Weg, auf dem heute Agentenarbeit in verbindlichen
Zustand uebergeht.

| Vorschlag | Promotion | Erzwingung |
|---|---|---|
| `POST /api/steward/tasks` (`:16208`) | Owner promotet (`queue`) | `status` **hart** auf `"pending"` gesetzt, `queue`-Feld verworfen; `programId` → 400 |
| `POST /api/self/criterion` (`:16769`) | `POST /api/tasks/:id/criterion-confirm` (`:18791`) | Schreibrecht auf EIN Feld der EIGENEN Gruendungs-Task; bestaetigt → 409 (`:16784`) |
| `POST /api/tasks/:id/refine` (`:18646`) | `…/refine-confirm` (`:18671`) | Audit-Paar `task_refine` / `task_refine_confirm` |
| `POST /api/self/programs` (`:16478`) | `/api/programs/:id/confirm` + `/activate` (`:13721`, owner-gated `:16819`) | ein Program ist erst nach Owner-Confirm Wahrheit |

Zusaetzlich existiert die Deckelung als Muster: `STEWARD_MAX_PENDING` (Default 10, `:2611`), Ref-Dedup
(`:16226`), max 5 Autos je Slot, max 5 armed Watches je Slot.

**Und ein zweites, gegenlaeufiges Muster:** `POST /api/deploy` liegt im Steward-Tier (`:16081`)
mit der ausdruecklichen Begruendung „VERB 2 fuer den Prinzipal, der die Luecke SIEHT". Das ist
der einzige Fall, in dem eine Nicht-Owner-Rolle eine wirksame Maschinenhandlung ausloest.

---

## 6. Wo das Landen wohnt

- `mergeJob(` hat **genau eine Aufrufstelle**: `:18048`, innerhalb der Route
  `/^\/api\/slots\/(\d+)\/merge$/` (`:17752`). Sie liegt unter dem Owner-Gate.
- Kein Tick, kein Auto, kein Dispatch-Pfad ruft sie. Der Code sagt es selbst (`:527`, `:15392`).
- Das Land-Gate ist eine **Maschine**, kein Agent: `VERIFY_CMD` aus `watchdog.sh:91`, dreiwertig
  (`ok:true` / `ok:false` / `ok:null` bei Skip), mit getrennten Budgets `timeoutMs` (arbeiten)
  und `waitMs` (in der Mutex-Schlange).
- Stufe 2 (`post-land-audits.jsonl`) laeuft **nach** dem Land und gated nichts.
- `undo-land` deckt genau EIN Land und nur bis zum naechsten (`:17706`).

---

## 7. Die Quittungen (was heute wirklich mitgeschrieben wird)

Neun append-only Ledger, alle im Haupt-Checkout, alle gitignored:

| Ledger | Zeile | Was es bindet |
|---|---|---|
| `audit.jsonl` | `:84` | ~40 typisierte `AuditEvent`-Arten: wer hat was ausgeloest (ab `:2838`) |
| `lane-outcomes.jsonl` | `:88` | Lane-**Ende**: disposition, verified, confirmedByHuman, releasedBy, shadow |
| `context-receipts.jsonl` | `:91` | Zustellung eines Kontext-Envelopes |
| `dispositions.jsonl` | `:98` | Owner-Urteil ueber Worker-Ausgaben (accepted/edited/ignored/wrong) |
| `analysis-verdicts.jsonl` | `:106` | Analyst-Urteile (advisory) |
| `post-land-audits.jsonl` | `:109` | Tier-2 je Land |
| `audit-adjudications.jsonl` | `:114` | menschliches Urteil ueber ein rotes Audit |
| `steward-journal.jsonl` | `:85` | Rundgang-/Inspektions-Register |
| `deploys.jsonl` | Verb 2 | Build/Restart/Verdikt des naechsten Boots |
| `git notes --ref=fleet/land` | — | Integrations-Provenienz am Commit |

**Die Luecke, die ein Entwurf kennen muss — KORRIGIERT 2026-08-21** (der Architekt hat die
urspruengliche Fassung widerlegt, die Gegenprobe bestaetigt ihn):

`lane-outcomes.jsonl` entsteht normalerweise am **Lane-Ende**. Die frueher hier stehende
Behauptung „eine MAIN-Session in ihrem eigenen Repo erzeugt darin nie eine Zeile" ist **falsch**:
es gibt eine freiwillige Meldeschiene, und sie wird benutzt. Nachgezaehlt an der Datei:
**415 Zeilen, davon 27 mit `origin:"main-direct"`** (23 claude-fleet, 4 private-repo-h).
Schreibstelle `server.ts:11063`; die Route ist `POST /api/self/main-direct/finalize|abandon`
(`:16555`/`:16561`), lane-verboten (`:11004`: „a lane uses lane provenance, not main-direct
provenance"). Der Steward-Digest filtert diese Zeilen ausdruecklich heraus (`:16050`).

Richtig bleibt die operative Kernaussage in engerer Form: **ein Direkt-Commit OHNE diese
freiwillige Meldung ist fuer jedes land-seitige Ledger unsichtbar** — kein Note, keine
Outcome-Zeile, kein Tier-2-Lauf. Die Meldung ist ein Akt der Session, kein Mechanismus des
Land-Pfads. `state.sh`s Land-Health-Zahlen zaehlen nur Lanes (`origin !== "main-direct"`).

---

## 8. Harness-Degradation, wie sie heute funktioniert

Ein Choke-Point: `canDeliver(s, opts)` (`:5943`), sechs benannte Gates in fester Reihenfolge:

```
kill-switch → harness (harnessAutomatable) → not-alive (frische ps-Probe)
            → blocked-screen (paneReadiness) → quiet-hours → busy (idleMs)
```

Zwei Waiver, die man kennen muss: `harness:false` fuer owner-initiierte Akte (Land, ⏫ author,
💾 commit, gebriefte Zustellung) und `alive:false` fuer Aufrufer, die sich keine Probe leisten
koennen. Sie sind absichtlich getrennt.

Adapter-Fakten, live vom laufenden Server (`GET /api/harnesses`):

| Harness | resume | transcript | model | effort | selfSchedule | automatable | effortLevels |
|---|---|---|---|---|---|---|---|
| `claude` | ja | **ja** | ja | **nein** | **ja** | ja | — |
| `pi` | ja | **nein** | ja | ja | **nein** | ja | off/minimal/low/medium/high/xhigh/max |
| `pi-zai` | ja | **nein** | ja | ja | **nein** | **nein** | low/high/max |
| `pi-unfenced` | ja | **nein** | ja | ja | **nein** | **nein** | off…max (keine Lanes) |
| `container` | ja | **nein** | ja | **nein** | **nein** | **nein** | — |
| `codex` | ja | **nein** | ja | ja | **nein** | ja | low/medium/high/xhigh/max/ultra |

Drei Konsequenzen, gemessen:

- **Der direkte claude-Adapter kennt das reale `--effort`-Flag nicht** (`supports.effort:false`),
  obwohl die CLI es hat. Fuer eine claude-Lane laesst sich heute kein expliziter High-Fakt
  behaupten. (Offene Queue-Zeile `e952c2b2`.)
- **Ein GPT-/pi-Slot liefert `ctx: null`** — kein Fuellstands-Sensor. `ctx:null` heisst
  *unmessbar*, nie *leer*.
- **`transcript:false` + `selfSchedule:false`** heisst: eine pi-Rolle kann sich weder selbst
  terminieren noch laesst sich ihre Antwort aus einem Transcript ernten. Die Ernte ist die Pane.
- **`automatable:false` (pi-zai)** heisst: unbeaufsichtigte Pfade liefern nicht zu; nur der
  Owner-Pfad mit `harness:false`-Waiver erreicht so einen Slot.

Es gibt **keinen Mechanismus, der eine nicht-unterstuetzte Faehigkeit meldet.** Sie faellt
still weg.

---

## 9. Die Capability-Registry, die es schon gibt

`capability-map.ts` (256 Zeilen) ist die einzige ausfuehrbare Faehigkeits-Wahrheit. Ihr Schema
je Eintrag: `name · summary · roles · authority · stateEffect · adapter{route,method,credential,
roleCondition} · returns · probe{kind,assertion} · gaps`. Sie rendert
`docs/system-capabilities.generated.md`; `e2e/pins.ts` haelt das Dokument byteweise gegen die
Quelle und jeden benannten HTTP-Adapter gegen `server.ts`.

**Sie fuehrt heute zwei Funktionen** — `describe_self` (Adapter vorhanden) und
`get_project_context` (Adapter `null`, mit zwei ausdruecklich abgelehnten Nachbarn) — von den
acht, die `SYSTEM.md` als Zielvokabular nennt, und deckt damit 2 von ~117 Routen ab.
`UNMODELED_CAPABILITY_DIMENSIONS` benennt drei bewusst offene Achsen: `uiGesture`,
`traceEffect`, `harnessSupport`.

Ihr Wert fuer einen Entwurf ist das **Schema und der Pin**, nicht der Umfang: es ist der Ort, an
dem eine typisierte Rolle-zu-Faehigkeit-Abbildung ausfuehrbar werden koennte, ohne dass ein
zweites Register entsteht.

---

## 10. Was NICHT gemessen ist (ehrliche Grenzen dieses Dossiers)

- **`src/client.ts` (9 549 Zeilen) wurde nicht gelesen.** Welche dieser Faehigkeiten eine
  UI-Geste hat, ist hier unbeantwortet.
- **Die Ticks wurden nicht vollstaendig auditiert.** Belegt ist nur: keiner ruft `mergeJob`.
  Welche Ticks unter welchem Gate zustellen, ist einzeln nachzusehen.
- **Die Container-/Docker-Flaeche** wurde nicht angefasst.
- **Kein Laufzeit-Beweis:** dieses Dossier ist Code-Lesung plus zwei Live-GETs
  (`/api/sessions`, `/api/harnesses`). Es wurde keine Suite gefahren, keine Route geprobt.
- **Die Zahl „~117 Routen"** ist die Summe aus 75 Literalen und 42 Regex-Routen; Doppelnennungen
  derselben Pfade unter GET und POST sind darin enthalten.

---

## 11. Zielbild-Vokabular gegen den Code (Symbolprobe, 2026-08-21)

`rg` ueber alle `*.ts` ausser `node_modules`, exakte Symbolnamen:

| Symbol aus `SYSTEM.md` | im Code? | wo |
|---|---|---|
| `AgentInstance` | **nein** | — |
| `ContextEnvelope` | **nein** | — |
| `actId` | **nein** | — |
| `attemptId` | **nein** | — |
| `traceId` | **nein** | — |
| `LandCandidate` | **ja** | `src/protocol.ts:334` (+ `:318`, `:341`, `:342`, `:343`, `:351`), `land-candidate.ts` |
| `PromotionPolicy` | **ja** | `land-candidate.ts`, `src/protocol.ts:351`, `e2e/merge.ts` |

**Die vier Kernobjekte aus `SYSTEM.md` sind reines Zielbild — keine Zeile Code.** Das ist der
groesste einzelne Abstand zwischen Zielbild und Ist-Stand.

**Die Promotion-Haelfte dagegen ist gebaut, gepinnt und ungenutzt.** `land-candidate.ts`
(69 Zeilen) ist eine reine, seiteneffektfreie Projektion: `projectPromotionPolicyFacts(record,
current)` liefert `PromotionPolicyFacts` mit `candidate · candidateFreshness · verifyFreshness ·
riskClasses (6 Werte) · conflicts · repairRounds`. `sameCandidate()` bindet `candidateSha` UND
`diffHash`; ohne beobachtete Ist-Identitaet ist Freshness ehrlich `unknown`, ein alter
persistierter Verdikt kann nie als `fresh` rendern.

Der Modulkopf sagt seinen eigenen Status woertlich: *„Nothing here decides eligibility and nothing
in a land path imports this module."* Die einzigen Aufrufstellen sind `e2e/merge.ts:541`, `:551`,
`:690` — also **nur Tests**. Es ist fertige Maschinerie fuer die Frage „wo wohnt das Landen", die
noch an nichts angeschlossen ist.

---

## 12. Der Interventions-Weg, wie er heute existiert

Vier Kanten, drei davon gebaut:

| Kante | Route | Zustand |
|---|---|---|
| Supervisor → Program-MAIN | `POST /api/self/nudge` (`:16525`) → `supervisorNudge` (`:13446`) | **existiert, fast vollstaendig** |
| Critic/Lane → Program-MAIN | `POST /api/self/clarifications` (`:16600`), `POST /api/self/fleet-report` (`:16613`) | **existiert, typisiert** |
| Program-MAIN → Owner | `POST /api/self/attention` (`:16638`) | **existiert** |
| Program-MAIN → eigene Lane (unaufgefordert) | — | **fehlt ganz** |

`supervisorNudge` traegt bereits: Prinzipal-Pruefung (`isBoundSupervisor`, sonst 409) · Ziel aus
`program.main` abgeleitet, nie aus dem Body · Program muss `active` sein · **Occupant-Identitaet
neu geprueft** (`live.id === main.slot && live.openedAt === main.openedAt`), sonst 409 „the bound
Program-MAIN occupant is gone or was replaced" · `awaiting === "owner"` → 409 „escalate, never
nudge past it" · `canDeliver` mit attended Waiver-Satz (`alive` NICHT gewaivt) · `sendId` vor dem
Transport gemintet · Receipt + **eine `audit("supervisor_nudge")`-Zeile**.

> **KORRIGIERT 2026-08-21** (der Unterbau-Auditor hat es gefunden, Gegenprobe bestaetigt ihn):
> hier stand „Receipt + eine Journal-Zeile". **Falsch.** `writeStewardJournal` hat drei
> Aufrufstellen (`:14850`, `:16313`, `:18882`) und **keine davon liegt im Nudge**. Der Nudge
> quittiert ausschliesslich ueber `audit()`. Konsequenz, die ueber die Korrektur hinausgeht:
> **eine VERWEIGERTE Zustellung schreibt ueberhaupt keine Zeile** — es gibt also keinen
> zaehlbaren Sachverhalt, auf dem eine Regel wie „zwei aufeinanderfolgende Fehlzustellungen"
> aufsetzen koennte. Dieser Fehler ist aus diesem Dossier in den Architektur-Entwurf (H.1)
> gewandert und dort als „Kurator-Messung bestaetigt" gefuehrt worden — gefunden hat ihn erst
> der dritte, unabhaengige Leser. Und was es ausdruecklich nicht hat, laut
eigenem Kommentar: *„no persistence, no FleetEvent, no watch, no tick, no retry."*

Die einzige MAIN→Lane-Kante ist `POST /api/self/clarifications/:id/reply` (`:16623`) — eine
ANTWORT auf eine Frage der Lane. `POST /send` (`:19117`) ist owner-only, `/api/steward/send`
gehoert dem Steward. **Eine MAIN kann ihre Lane beantworten, aber nicht ansprechen.**

Receipt- und Ack-Maschinerie existiert, wird vom Nudge aber bewusst nicht benutzt:
`FleetEventBase` (`:1247`) traegt die Occupant-Bindung (`receiverSlot`/`receiverOpenedAt`/
`receiverSessionId`, `:1250`–`:1254`), `status` aus `pending | send-uncertain | delivered |
acknowledged | receiver-gone` (`:1245`), `attempts`, `deliveredAt`, `acknowledgedAt`,
`delivery: "pane"|"inbox"`. Ack-Route: `POST /api/self/events/:id/ack` (`:16648`).

**Was strukturell fehlt:** ein typisiertes Decision-Objekt · Staleness-Bindung an die ARBEIT
(nur Occupant-Identitaet existiert; `attemptId`/`actId`/`traceId` haben null Treffer) · und ein
Laufzeit-`RouteOverride`: **keine Route aendert Modell oder Effort eines LEBENDEN Slots** —
`open`/`restart` setzen beides nur beim Spawn.

Das Rohmaterial fuer die Unterscheidung *Prompt-Problem gegen Adapter-Defekt* ist dagegen da:
`canDeliver` liefert einen typisierten Gate-Namen (`kill-switch | harness | not-alive |
blocked-screen | quiet-hours | busy`). Was fehlt, ist der Schritt, der aus einem wiederholten
`harness`- oder `blocked-screen`-Refusal ein Verdikt macht statt eines weiteren Versuchs.

---

## 13. Wissens-Aufnahme: was der Unterbau heute traegt

**Traegt bereits:**

- **Anker statt Kopie ist die eingebaute Doktrin.** `context-packs.ts:1`: *„Context packs are
  metadata pointers into existing sources, never a second knowledge store."* `ContextPackSource
  = {path, anchor}`, mit dem Kommentar *„An identifier, heading, or symbol only. Source prose
  remains in the source file."*
- **Geschlossene Vokabulare** (`context-packs.ts:6`–`:45`): 8 `scope`, 4 `audience`,
  6 `triggers`, 2 `hardness`, 6 `harnesses`, 3 `modes`, 8 `requiredCapabilities`, 2 `evidence`,
  3 `status`.
- **Zwei Traeger, und der zweite ist der Studio/Fleet-Schnitt.** Fleets sechs Seeds im Code, und
  `.fleet/context-packs.json` — ein Manifest, das ein ZIELREPO ueber sich selbst deklariert
  (`context-manifest.ts:1`: *„Fleet stores no pack content, authors no pack, and owns no
  registry"*), gelesen am Commit, den das Receipt behauptet, ≤65 536 B, ≤64 Packs, ≤64
  Quellpfade. Die Scopes `repo-contract` und `product-quality` existieren fuer genau diesen Fall.
- **Quittung und Auslassung:** `context-receipts.jsonl` (`:91`), `contextReceiptSelections`
  (`:6421`), geschrieben `:6376` und `:13101`; `ContextPlanOmissionReason` typisiert, WARUM etwas
  nicht zugestellt wurde.
- **Das Rulebook-Ziel ist mechanisch:** `CLAUDE.md` ist ein Generat aus sieben Fragmenten
  (`rulebook.ts`), `FRAGMENTS_FOR` partitioniert nach Publikum, *„PARTITION, never overlap: a rule
  lives in exactly one fragment"*, byte-exakter Render, gepinnt in `e2e/pins.ts` §6b.

**Traegt nicht:**

1. **Kein nicht-normativer Zustand.** `CONTEXT_PACK_STATUSES = active | superseded | retired`
   (`:45`) — kein `proposed`, kein `canary`.
2. **Fremdes Material hat keine darstellbare Form.** Jede Quelle ist ein getrackter Pfad in
   diesem Baum, `evidence: "tree-anchor"`.
3. **Kein Lizenz-, Provenienz-, Attributions- oder Upstream-Feld existiert irgendwo im Baum**
   (Suche ueber alle `*.ts` ausser `node_modules`; alle „provenance"-Treffer gehoeren dem
   Land-Pfad). Bei einem oeffentlichen Repo ist das die riskanteste Luecke.
4. **`owner: "owner"` ist ein Literalfeld an jedem Pack** (`:62`) — ein von einem Agenten
   VORGESCHLAGENES Pack ist nicht ausdrueckbar.
5. **Ein Pack traegt keine Behauptung**, nur einen Zeiger. Kein Feld fuer die atomare Praxis,
   die erwartete Wirkung oder das Gegenbeispiel.
6. **`evidence` ist ein Frische-Beweis, keine Verhaltensprobe** — es beantwortet „zeigt der
   Zeiger noch auf dasselbe", nicht „wirkt die Praxis".
7. **Rolle und Act fehlen als Selektoren.**

---

## 14. Die Zuordnungs-Sichtbarkeit ist bereits gebaut

Gemessen 2026-08-21, weil ein Entwurf sonst eine Anzeigeflaeche vorschlaegt, die es gibt.

Je Dispatch wird EINE Receipt-Zeile geschrieben (`server.ts:6376` → `CONTEXT_RECEIPT_FILE`,
`:91`). Sie traegt:

- `selected` — je Pack `id`, `useWhen`, `anchors`, `sourceHash`, gebaut von
  `contextReceiptSelections` (`:6421`). `useWhen` wird von der SELEKTION kopiert, nie aus dem Seed
  nachgelesen: „the row must describe the block that was delivered".
- **`omitted` — je Eintrag `{id, why}` mit typisiertem `why`.**
- Dazu `repo`, `head`, `taskId`, `originId`, `programId`, `slot`, `branch`, `harness`, `model`,
  `effort`, `mode`, `triggers`, `deliveredBytes`, `renderer`, `briefHash`, `briefSource` und
  einen `hash` ueber `{anchorBlock, planFacts}`.

Das `why`-Vokabular ist geschlossen und deterministisch (`context-plan.ts:15`–`:22`):
`manifest-invalid · source-unavailable · status-not-active · harness-unsupported ·
mode-unsupported · trigger-not-matched · capability-missing`.

Die Auswahl selbst ist rein: `contextOmissionFor(pack, ctx)` (`context-plan.ts:78`) entscheidet
aus `{sourceTree, harness, mode, triggers, capabilities}` — kein Modell, kein Ermessen.

Lesefiaeche: `GET /api/context-receipts` (`server.ts:17316`), Owner-Tier, read-only.

**Konsequenz:** „welche Packs wurden ausgewaehlt oder ausgelassen und warum" ist heute schon
beantwortbar. Was FEHLT, ist nicht die Sichtbarkeit, sondern ein Status, den ein
nicht-normativer Kandidat tragen koennte — `status-not-active` existiert als Auslassungsgrund,
aber `proposed`/`canary` existieren nicht als Zustand (§13.1).

---

## 15. Der Uebergang `pending → queued` — die entscheidende Messung

Die Kernbehauptung jedes Produzent/Promoter-Entwurfs steht und faellt hiermit. Nachgemessen:

**`releaseTask(t, by)` (`server.ts:2262`) hat GENAU EINE Aufrufstelle: `:18865`.** Sie liegt
unter dem Owner-Gate (`:17000`) und uebergibt hart `"owner"`. Der Parameterwert `"machine"`
existiert in der Signatur und hat **null Aufrufer**.

Die drei Stellen, die `status = "queued"` schreiben, sind damit vollstaendig aufgeklaert:

| Stelle | Was sie tut | Kann sie eine `pending`-Zeile freigeben? |
|---|---|---|
| `:2263` in `releaseTask` | DIE Freigabe, `releasedBy` gestempelt | ja — aber nur vom einen Aufrufer `:18865` (Owner-Tier) |
| `:6303` Requeue nach fehlgeschlagenem Post-Spawn-Gate | stellt eine `sent`-Zeile zurueck | **nein** — die Zeile war bereits freigegeben |
| `:14413` Boot-Abgleich verwaister `sent`-Zeilen | stellt eine `sent`-Zeile zurueck | **nein** — dieselbe Begruendung |

Der Code sagt es selbst (`:2258`–`:2261`): die zwei Maschinen-Schreibungen sind *„deliberately
NOT used by releaseTask … Both restore a row to a state it was ALREADY released into;
re-stamping them would book the owner's decision as the machine's."*

**Konsequenz:** eine `pending`-Zeile wird heute ausschliesslich durch einen Owner-Akt startbar.
Ein Produzent, der `pending`-Zeilen anlegt, kann strukturell kein Start-Recht erlangen — die
Freigabe ist eine einzige Funktion mit einer einzigen owner-seitigen Aufrufstelle.

**Und die Gegenrichtung, die derselbe Befund sichtbar macht:** `releaseTask(t, "machine")` ist
eine gebaute, unbenutzte Naht. Der Kommentar nennt ihren Zweck woertlich — *„the transition a
future UNATTENDED promote will make"*. Wer je Verb 3 (Auto-Promote) baut, hat den Stempelplatz
bereits; was fehlt, ist die Policy, nicht die Mechanik.

---

## 16. Harness-Paritaets-Canary (pi + claude-bridge/claude-opus-5, effort high, 2026-08-21)

Ein echter `pi`-Sitz hat sich selbst vermessen. Er hat den Architektur-Entwurf ausdruecklich NICHT
gelesen; Gegenstand war die Maschine, nicht das Dokument. Sechs Proben, Rohbefunde:

| Probe | Befund |
|---|---|
| P1 Self-Credentials in der Pane | vorhanden. Zusaetzlich sichtbar: `PI_PROVIDER=claude-bridge`, `PI_MODEL=claude-opus-5`, `PI_REASONING_LEVEL=high` |
| P2 `GET /api/self` | **200**, vollstaendige Selbst-Sicht, identisch zur dokumentierten claude-Form; `lane:null` weist ihn korrekt als Nicht-Lane aus |
| P3 `POST /api/self/autos` | **200 + persistierte Zeile** — obwohl die Registry `selfSchedule:false` fuehrt |
| P4 Verweigerungen | **jede benennt ihren Grund woertlich.** `gate` → 409 „not a lane — the gate judges a lane's land"; `drift` → 409 „not a lane — drift measures a lane against its integration branch"; `supervisor-view` → 409 „not the bound Supervisor"; `flakes` und `program-execution` → 200. Keine stumme Verweigerung |
| P5 Kontext | **angezeigt: 5,9 % / 1,0M** in der pi-Statuszeile. Eigene Schaetzung: ~22k, also Faktor ~2,7 zu niedrig — und der Canary hat selbst offengelegt, dass er die angezeigte Zahl VOR seiner Schaetzung gesehen hatte |
| P6 Ernte | Nur zwei Wege von aussen: `capture-pane`, solange die Pane lebt — oder die pi-eigene Session-Datei unter `~/.pi/agent/sessions/…jsonl`. Fleets Transcript-Leser erwartet Claude-Code-Format unter `projDir()` und liest sie nicht |

### Der Befund, der die „Degradation"-Spalte betrifft

**Zwei `supports.*`-Flags sind POLITIK-Werte, keine Faehigkeitsmessungen — und der Code sagt das
selbst.** Der Canary hat nachgelesen statt sein eigenes Ergebnis zu feiern:

- `server.ts:557`–`:560` zu `selfSchedule:false`: *„FALSE deliberately, and NOT a claim that the
  env is absent … The flag means 'do not advertise this'."* Was unvermessen ist, ist ob Pis
  eigenes Werkzeug es je benutzt.
- `server.ts:541`–`:551` zu `transcript:false`: kein Harness-Defizit, sondern die Weigerung,
  `transcriptFile()`s newest-by-mtime-Fallback eine fremde Konversation als die eigene ausgeben zu
  lassen.

**Konsequenz fuer jeden Entwurf, der eine `harnessSupport`-Dimension auf diese Matrix stellt:** wer
`supports.*` als Faehigkeitsspalte liest, liest zwei Vorsichts-Flags als zwei Unfaehigkeiten. Die
Matrix beantwortet „was behauptet Fleet ueber diesen Harness", nie „was kann er".

### `ctx: null` ist fuer pi nachweislich falsch

Der Harness zeigt seinen Fuellstand an (5,9 %/1,0M). Fleet fragt ihn nur nicht. Die Regel „bei
`ctx: null` zaehlt die Selbstauskunft der Lane" steht damit auf schwachem Grund — **zwei
unabhaengige Selbstauskuenfte an einem Tag lagen daneben, und zwar in ENTGEGENGESETZTE
Richtungen**: der Architekt schaetzte „ueber zwei Drittel voll" bei angezeigten 11,2 %, der Canary
~22k bei angezeigten ~59k. Selbstauskunft ist kein Ersatz fuer einen Sensor. (Offene Queue-Zeile:
`ad2ee96a` CTX-01.)

### Die einzige wirklich fehlende Faehigkeit — und sie faellt ohne ein Wort

Woertlich aus dem Bericht: *„Nichts hat mir gesagt, dass mein Ergebnis nirgendwo ankommt — kein
Hinweis, kein Warnfeld, keine 409. `POST /api/self/autos` nimmt meinen Check-in an, als haette er
einen Adressaten; `/api/self` listet `events:[]`, ohne zu sagen, dass fuer mich nie eines entsteht;
die Pane schreibt weiter, als laese jemand mit."*

Die Verweigerungen, die es GIBT, sind vorbildlich benannt (P4). Die Faehigkeit, die wirklich
fehlt — die Ernte — ist die einzige, die still ausfaellt.

### Ein Fehler des Kurators, den der Canary gefunden hat

Die Probe P1 war von mir falsch geschrieben: `${VAR:+gesetzt}${VAR:-FEHLT}` druckt bei GESETZTER
Variable „gesetzt" UND den Wert (`:-` greift nur bei ungesetzt). Der Self-Token des Slots stand
dadurch im Klartext in der Pane. Behoben: der Slot wurde beendet, sein Token existiert nicht mehr
(`selfToken` wird beim Recycling rotiert, `server.ts:4494`; der Slot-Eintrag ist aus `fleet.json`
verschwunden). Richtige Form waere `[ -n "$V" ] && echo gesetzt || echo FEHLT`.

---

## 17. Owner-Korrektur der Zielrichtung (2026-08-21, autoritativ)

**Die Lesart, gegen die die Abschnitte 1–16 erhoben wurden, war zu eng.** Der Owner korrigiert
nicht ein Detail, sondern die Richtung: **intelligence-first bounded autonomy.** Nach Bestaetigung
und Aktivierung eines Programs soll dessen eindeutig gebundene Project-MAIN reversible Produkt-
und Reihenfolge-Entscheidungen treffen, eigene begrenzte Tasks **anlegen UND starten**, Worker
anstupsen/wiederholen/ersetzen, Modelle waehlen und gewoehnliche Critic-Reparaturen aufloesen —
ohne Rueckkehr zum Owner. Kanonisches Beispiel: **Camera Impact** — innerhalb einer freigegebenen
Qualitaetsachse entscheidet und handelt die MAIN.

Drei grobe Klassen, ausdruecklich grob: **(A)** reversible Entscheidungen im bestaetigten Scope →
MAIN handelt · **(B)** begrenzte Ausfuehrung/Ressourcen/Routing → MAIN handelt in expliziten
Grenzen · **(C)** Scope-Erweiterung, irreversible Richtung, externe Wirkung/Kosten, Deploy/Submit,
erklaertes Geschmacks-Gate → Owner.

**Was das mit den bisherigen Befunden macht:** die Messungen bleiben gueltig, ihre BEWERTUNG
aendert sich. Der Satz „die MAIN darf die Schlange fuettern, nicht den Zaun oeffnen" ist damit
ueberholt. Und der Befund aus §15 kehrt seine Bedeutung um: **`releaseTask(t, "machine")` ist
nicht mehr nur eine unbenutzte Naht, sondern der gebaute Stempelplatz fuer genau diese
Korrektur** — der Kommentar (`server.ts:2251`–`:2261`) nennt ihn woertlich *„the transition a
future UNATTENDED promote will make"*.

### Die Ebenen-Trennung, die dabei nicht fallen darf

**Context Packs sind beratende Wissens-/Ambitions-Eingaben und duerfen Autoritaet weder gewaehren
noch entziehen noch heimlich gaten.** Gemessen 2026-08-21: das gilt heute schon.
`ContextPackCapability` kommt ausschliesslich in `context-packs.ts`, `context-plan.ts`,
`context-manifest.ts` und `context-pack-validator.ts` vor — **nie im Auth-Pfad von `server.ts`**.
`requiredCapabilities` entscheidet, ob ein ZEIGER zustellenswert ist, nie was ein Prinzipal darf.
Die Aufgabe ist Erhalt, nicht Bau. Randnotiz: `capability-map.ts` (Faehigkeits-Register) ist eine
ANDERE Ebene als `context-packs.ts` (Wissens-Zeiger) — beide duerfen nie verschmelzen.

---

## 18. Owner-Prinzip: Autonomie und Reparatur (2026-08-21, normativ)

**Jede gebundene Session besitzt und verwaltet ihren erklaerten Scope und wird an Ergebnissen,
Belegen und Grenz-Einhaltung gemessen — nicht an der Befolgung eines zentral geskripteten
Mikro-Workflows.** Kein hoeherer Manager, und **keine neue Regel fuer jeden Fehler.** Besitz:
Project-MAIN → ihr Program · Lane → ihre Task · Supervisor → Fleet-Gesundheit · globaler
Controller → Portfolio und Owner-Uebersetzung. *Ihre Kontexte sollen sie BEFAEHIGEN, nicht
gehorsam machen.*

Scheitert Autonomie, wird zuerst die **kleinste stromaufwaerts liegende Ursache** klassifiziert und
**nur diese** geaendert, danach canaryt, und wirkungslose Anweisung wird zurueckgezogen.
Wiederholte Fehlschlaege koennen eine Promotion in geteilten Kontext rechtfertigen; **eine
einzelne Anekdote bleibt Evidenz, nie eine globale Regel.**

### Die Taxonomie ist trennscharf — diese Session hat von fast jeder Klasse eine Instanz erzeugt

| Ursache | Ort | Gemessene Instanz von heute |
|---|---|---|
| fehlendes/irrefuehrendes Wissen | Brief / Pack | Dieses Dossier trug fuenf Fehler. Einer wanderte in den Entwurf (H.1) und stand dort als „bestaetigt"; gefunden hat ihn erst der dritte unabhaengige Leser |
| Handlung nicht auffindbar | Capability / Adapter | `POST /api/self/autos` antwortete dem pi-Canary mit 200, obwohl die Registry `selfSchedule:false` fuehrt — das Flag heisst laut Code *„do not advertise this"* (§16) |
| falsche Autoritaetsgrenze | Program-/Rollen-Vertrag | der Anlass des ganzen Auftrags (§1) |
| schlechte Modell-Passung | Routing | heute keine Instanz |
| Ergebnis unbeobachtbar | Sensor / Receipt | eine VERWEIGERTE Nudge-Zustellung schreibt keine Zeile (§12) · `ctx:null` ist fuer pi falsch (§16) · *„nichts hat mir gesagt, dass mein Ergebnis nirgendwo ankommt"* |
| gewoehnlicher Urteilsfehler | Feedback / Reparatur in derselben Rolle | der Architekt geriet in eine Markdown-Korrekturschleife; meine Sonde gab einen Self-Token im Klartext aus. **Beides brauchte keine neue Regel** — eines einen Zuruf, eines eine Rotation |

**Konsequenz fuer dieses Dossier selbst:** die Befunde von heute sind Evidenz. Keiner von ihnen
wird durch diese Session zu einer Regelbuch-Zeile promotet — dafuer braucht es Wiederholung, nicht
Schaerfe.
