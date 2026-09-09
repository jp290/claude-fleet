# Program-Lebenszyklus — Architektur und Codex-Briefe je Schnitt (2026-09-04)

Ausarbeitung des Plans `docs/program-lebenszyklus-2026-09-04.md` (Fassung mit den GLM-Korrekturen,
`1342496`) zu acht baufaehigen Schnitten. Jede Behauptung ueber bestehenden Code ist am Baum
dieser Lane gelesen (Symbol-Anker, keine Zeilennummern); wo Plan und Code sich widersprechen, gilt
der Code, und der Widerspruch steht als eigener Absatz „ABWEICHUNG VOM PLAN" im betroffenen
Schnitt. Der Plan selbst wurde nicht geaendert.

Grundlagen (alle im Baum): der Plan · `docs/messungen/2026-09-04-architektur-zusammenarbeit.md`
(B-A1…B-A8) · `docs/messungen/2026-09-04-plan-gegencheck-glm.md` · `docs/messungen/2026-09-04-datenschichten-audit.md`
(B1/B2/B3) · `AGENTS.md` §Portable operating contract · `docs/self-api.md`.

**Leseanleitung.** §0 ist der Kern (Invarianten, Typen, Migration, Routen-Konvention) und gilt
fuer alle Schnitte. §1–§8 sind je EIN fertiger Codex-Brief. Ein Codex-Worker (gpt-5.6-sol,
Harness codex, liest `AGENTS.md` automatisch, kennt das Repo sonst nicht) bekommt NUR seinen
Abschnitt; darum wiederholt jeder Abschnitt die Typtexte, die er braucht, das Verify-Kommando und
die Verbote. Reihenfolge und Kollisionsmatrix stehen in §9.

---

## §0 KERN — gilt fuer alle Schnitte

### 0.1 Invarianten, je ein pruefbarer Satz mit dem Pin, der ihn haelt

Pin-Form am Bestand abgelesen (`e2e/pins.ts`): `pin(name, ok, detail)` ueber den Quelltext, der
via `read("server.ts")`/`serverU` als String vorliegt; ein Regelname `RULE_X` buendelt mehrere
Pins (`` pin(`${RULE_X} — <Teilsatz>`, …) ``). Textuelle Pins pruefen Reihenfolge und Anwesenheit
von Literalen in einem `function <name>(…)`-Body, nie Verhalten — Verhalten beweist ein e2e-Check.

| # | Invariante (pruefbarer Satz) | Pin in `e2e/pins.ts` (Regelname, Form) | Schnitt |
|---|---|---|---|
| I1 | Kein Inbox-Eintrag traegt einen Empfaenger: `ProgramInboxEntry` hat weder `receiver` noch `requester`; `readBy` ist eine Quittung, kein Schluessel, und keine Route filtert an ihm. | `RULE_INBOX — the entry interface names no receiver or requester key, and both inbox routes derive the program through boundProgramForMain only` (Interface-Text aus `server/types.ts`, Handler-Body enthaelt `boundProgramForMain(` und weder `fleetEventReceiver(` noch `receiverSlot`) | 3a-i |
| I2 | Inbox-Eintraege zaehlen nicht gegen `FLEET_EVENT_MAX_OPEN_PER_SLOT`: `slotDeliveryBudget` liest weiter nur `fleetEvents` und `watches`. | `RULE_INBOX — slotDeliveryBudget reads fleetEvents and watches and never an inbox` (Body enthaelt `fleetEvents.filter(` und `watches.filter(` und nicht `inbox`) | 3a-i |
| I3 | Der Inbox-Loader ist geschlossen, versioniert, default-absent: unbekannter Key, `v !== 1`, unbekannter `kind` ⇒ ABSENT plus Audit-Zeile, nie Reparatur. | `RULE_INBOX — loadProgramInbox is closed and versioned like loadProgramLineage` (Text enthaelt `Object.keys(r).some((k) => !["v", "entries", "dropped"]` und `r.v !== 1`) | 3a-i |
| I4 | Eine Attention-Antwort tippt nichts in eine Pane: `answerAttention` schreibt Inbox-Eintrag und `answered` in EINEM `saveStateNow` und ruft kein `sendText`. | ersetzt den bestehenden Pin `attention answer persists send-uncertain before sendText …` (Body von `answerAttention` enthaelt `appendProgramInbox(` vor `request.status = "answered"`, danach genau ein `await saveStateNow()`, und kein `sendText(`) | 3a-ii |
| I5 | Die Inbox-Nudge ist EIN Timer und EINE Zeile: genau ein `setInterval(…tickInboxNudge…)`, opt-out ueber `FLEET_INBOX_NUDGE_MS=0`. | `RULE_INBOX — the inbox nudge is one positive-only timer` (Form des bestehenden Pins `the audit ping is opt-in …`) | 3a-ii |
| I6 | Ein Report einer Program-Lane mintet kein FleetEvent: `basis:"program"` ⇔ `receiver === null && eventId === null && provenance.programId !== null`, geprueft in `fleetReportFrom`. | `RULE_INBOX — fleetReportFrom binds basis "program" to a null receiver, a null eventId and a programId` (Text enthaelt `r.basis === "program"` und `r.eventId === null`) | 3b |
| I7 | Die Autoclose-Autoritaet fuer einen Program-adressierten Report kommt aus `Program.lineage`, nie aus einem Watch: `laneAutoCloseRefusal` enthaelt `lineage.entries.some(`. | `RULE_INBOX — the auto-close authority of a program-addressed report is read from Program.lineage` | 3b |
| I8 | Ein rotes Audit erreicht das Program des Lands an beiden Schreibstellen: `writeAuditInboxEntries(` steht genau zweimal in `server.ts`, je direkt nach `await mintAuditEvents(row);`. | `RULE_INBOX — both audit writers hand a red row to the program inbox` (Zaehlung 2, Positionen nach den zwei `mintAuditEvents(row)`-Aufrufen) | 3c |
| I9 | Die Watch-Dedupe entwaffnet nur LANE-Watches: der Dedupe-Block in `openFleetReport` enthaelt `watchKind(w) === "lane"` und nicht `"merge"`. | `RULE_INBOX — the report dedupe disarms lane watches only` | 3d |
| I10 | Game-Maker-Succession bleibt beim Checkpoint: `handleSelfSucceed` ruft `gameMakerCheckpointError(` weiter vor `succeedProgramMain(`, und `handoffFresh(` wird nur unter `!isGameMaker(` gelesen. | `RULE_HANDOFF — game-maker succession keeps the committed checkpoint as its one channel` | 4 |
| I11 | Das Handoff-Gate ist fail-closed ohne Komparator: `handoffFresh` vergleicht `at > s.openedAt` UND `by.openedAt === s.openedAt`; ein Restore ohne `openedAt` (⇒ `SERVER_BOOT_AT`) macht keinen aelteren Handoff frisch. | `RULE_HANDOFF — freshness needs both the time and the exact writing occupant` (Body enthaelt beide Vergleiche) | 4 |
| I12 | Lokale `fails[]` haben das Remote-Format: der lokale Pfad reicht seine Namen durch `helperFailNames(` (Cap `HELPER_FAILS_KEEP`, `HELPER_FAIL_NAME_MAX`). | `RULE_FAILS — the local audit row's fails pass through helperFailNames` (Body von `runPostLandAudit` enthaelt `helperFailNames(localFailNames(`) | 1 |
| I13 | D2 bleibt Projektion: `programExecutionView` enthaelt kein `saveState`, `saveStateNow`, `appendEvent`, `sendText`, `spawnCmd` (bestehender Pin), und der `/api/sessions`-Poll-Block liest kein Ledger (`readLedger(` kommt dort nicht vor). | bestehender Pin `ProgramExecutionView is a read-only projection …` + neu `RULE_D2 — programsStale is derived from programOccupancy and the poll reads no ledger` | 2 |
| I14 | Der Adjudikations-Actor wird gemessen, nicht gestempelt: `writeAuditAdjudication(body, req)` ruft `tokenChannel(req)`. | `RULE_ACTOR — the adjudication rail measures its token channel` | 5a |

Die Pin-Verdrahtung: ein neuer Block je Regelname am Ende von `e2e/pins.ts` VOR `console.log(rows.join("\n"))`, im Muster des Blocks `RULE_RECEIVER` (Body per Regex aus `server` schneiden, dann `indexOf`-Ordnung und `includes`-Anwesenheit pinnen). Ein Pin, dessen Anker nicht gefunden wird, muss als ER SELBST fallen (`detail: "<symbol> not found in server.ts"`), nie gruen ueber einen leeren String.

### 0.2 Typen — exakter TypeScript-Text, Zieldatei je Block

**`server/types.ts`, neben `ProgramLineage` (Anker: `interface ProgramLineage`), Schnitt 3a-i:**

```ts
// THE PROGRAM INBOX — durable, pull-based, bound to the Program and to nothing shorter-lived.
// An entry is a POINTER to a row that already exists (attention, fleet-report, audit ledger); it
// copies no text. It names NO receiver: whoever is the bound MAIN of this Program at read time
// reads it (boundProgramForMain), and a succession changes nothing here. `readBy` is a RECEIPT
// of who read it — never a key, never a filter.
type ProgramInboxKind = "attention-answer" | "fleet-report" | "audit-red";
interface ProgramInboxEntry {
  id: string;                       // 24 hex, minted by appendProgramInbox
  kind: ProgramInboxKind;
  at: number;                       // when the entry was written
  ref: string;                      // attention id | fleet-report id | String(audit row `at`)
  readBy: { slot: number; openedAt: number; sessionId: string | null } | null;
  readAt: number | null;            // null exactly when readBy is null
}
interface ProgramInbox { v: 1; entries: ProgramInboxEntry[]; dropped: number }
const PROGRAM_INBOX_MAX = 100;
const PROGRAM_INBOX_KINDS: ProgramInboxKind[] = ["attention-answer", "fleet-report", "audit-red"];
const PROGRAM_INBOX_ENTRY_KEYS = ["id", "kind", "at", "ref", "readBy", "readAt"];
type ProgramInboxRead = { ok: true; inbox: ProgramInbox } | { ok: false; error: string };
```

`loadProgramInbox(value: unknown): ProgramInboxRead` in der Disziplin von `loadProgramLineage`
(gleiche Datei, direkt darunter): Objekt-Check, genau die Keys `v, entries, dropped`, `v === 1`,
`entries` Array ≤ `PROGRAM_INBOX_MAX`, `dropped` ganzzahlig ≥ 0; je Eintrag genau
`PROGRAM_INBOX_ENTRY_KEYS`, `id` `/^[0-9a-f]{24}$/`, `kind ∈ PROGRAM_INBOX_KINDS`, `at` > 0,
`ref` nicht-leerer String ≤ 200, `readBy` null oder Occupant-Tripel (`slot` 1..`MAX_SLOTS`,
`openedAt` > 0, `sessionId` string|null), `(readBy === null) === (readAt === null)`. Jeder Fehler
ist ein Satz wie in `loadProgramLineageEntry` (`entry ${index} …`). Export in der Export-Liste am
Dateiende neben `loadProgramLineage`.

**`server/types.ts`, `interface Program`, Schnitt 3a-i und 4 (je ein Feld):**

```ts
  // THE PROGRAM INBOX (see ProgramInbox). Absent = no entry was ever written, the honest legacy
  // shape. Never backfilled at load; an unreadable record loads as ABSENT and is reported.
  inbox?: ProgramInbox;
  // THE PROGRAM HANDOFF (Standard Programs only; a game-maker Program hands over through the
  // committed checkpoint, gameMakerCheckpointError). One record, replaced whole by the bound MAIN
  // through POST /api/self/handoff; `by` is the writing occupant and the succession gate compares
  // it against the live one. Absent = the git HANDOFF.md gate applies unchanged.
  handoff?: ProgramHandoff;
```

**`server/types.ts`, neben `ProgramInbox`, Schnitt 4:**

```ts
interface ProgramHandoff {
  v: 1;
  text: string;                     // prose for the successor; ≤ MAX_PROGRAM_HANDOFF chars
  at: number;                       // server-stamped write time
  by: { slot: number; openedAt: number; sessionId: string | null };
}
const MAX_PROGRAM_HANDOFF = 16_000;
type ProgramHandoffRead = { ok: true; handoff: ProgramHandoff } | { ok: false; error: string };
```

`loadProgramHandoff(value): ProgramHandoffRead`: genau die Keys `v, text, at, by`, `v === 1`,
`text` nicht-leer ≤ `MAX_PROGRAM_HANDOFF`, `at` > 0, `by` Occupant-Tripel wie oben.

**`server/types.ts`, `interface FleetReport`, Schnitt 3b (Typaenderung, zwei Felder):**

```ts
// THE FOURTH BASIS. "program" means the report was filed to the PROGRAM, not to an occupant:
// receiver is null, no FleetEvent was minted (eventId null), and the bound MAIN of
// provenance.programId reads it through the program inbox. The three older values keep their
// exact meaning; "program-main" is no longer minted for reports and stays for persisted rows.
type FleetReportBasis = FleetReportEventPayload["basis"] | "program";
interface FleetReport {
  …
  receiver: { slot: number; openedAt: number; sessionId: string | null } | null;
  basis: FleetReportBasis;
  // null exactly when basis is "program" — a program-addressed report has no transport event.
  eventId: string | null;
  …
}
```

`fleetReportFrom` ergaenzt: `r.basis === "program" ? (r.receiver === null && r.eventId === null && typeof provenance.programId === "string") : (<bisherige Paar-Regel> && typeof r.eventId === "string" && /^[0-9a-f]{24}$/.test(r.eventId))`; die Decision-Pruefung verlangt fuer `program` nur `occupant(d.by, false)` (kein Receiver-Vergleich), sonst unveraendert. `FleetReportEventPayload["basis"]` in `lane-signals.ts` bleibt unveraendert (es wird kein Event geminted); die Testkopie der Union in `e2e/watch.ts` (Anker: `basis: "program-main" | "lane-watch" | "program-main+lane-watch" | "owner-inbox"; eventId: string;`) wird auf den neuen Typ erweitert.

**`server.ts`, `interface PostLandAuditRow` (der Typ lebt in `server.ts`, NICHT in `server/types.ts` — Anker `interface PostLandAuditRow`), Schnitt 1:** nur der Kommentar am Feld `fails?: string[]` aendert sich zu `// validated and capped names: remote rows carry what the helper reported, local rows what localFailNames read from the complete output; absent on unknown rows and on rows written before either existed`.

**`server.ts`, `interface AuditAdjudication` (Anker), Schnitt 5a:** `actor?: LandActor;` (der bestehende Typ `LandActor`, Owner-Arm mit `via`/`suspect`); `by` bleibt.

### 0.3 Migration — was der Loader mit ALTEN `fleet.json`-Zeilen tut

Die Program-Hydration ist der Block in `server.ts` um `const promotion = loadPromotion(x.promotion);` … `programs = capPrograms(loaded);` (Anker `loadProgramStudioBinding(x.studio)`): Zeilen werden aus DEKLARIERTEN Feldern neu gebaut, ein Feld, das dort nicht genannt ist, ueberlebt keinen Neustart. Darum:

- **`inbox` (3a-i):** `Object.prototype.hasOwnProperty.call(x, "inbox")` ⇒ `loadProgramInbox`; `ok` ⇒ tragen, sonst ABSENT plus `console.error` und `audit("program_inbox_unreadable", undefined, `${id} ${error}`)` (Muster `unreadableLineages`). Kein Key ⇒ kein Feld, kein Backfill. Der Speicherpfad (`saveState`, Anker `events: fleetEvents, clarifications, fleetReports, attentionRequests, tasks, programs, studios`) serialisiert `programs` unveraendert als Objekte — dort ist nichts zu tun.
- **`handoff` (4):** dieselbe Regel mit `loadProgramHandoff` und `program_handoff_unreadable`.
- **`FleetReport.basis`/`eventId` (3b):** alte Zeilen tragen `program-main|lane-watch|program-main+lane-watch|owner-inbox` mit `eventId: string` und laden byte-gleich; eine Zeile mit `basis:"program"`, aber `eventId !== null` oder `receiver !== null`, wird VERWORFEN (Rückgabe `null`, wie jede andere halbe Zeile in `fleetReportFrom`), nie repariert.
- **`FleetReport.decision` (3b):** fuer `program`-Zeilen ist `by` ein gueltiger Occupant ohne Receiver-Gleichheit; fuer alle anderen Basen bleibt die Gleichheitsregel byte-gleich.
- **`AuditAdjudication.actor` (5a):** `adjudicationsByAudit` liest `actor` ueber `loadLandActor(r.actor)` NUR, wenn der Key vorhanden ist; fehlt er, bleibt das Feld absent (historische Zeilen sagen „unbekannt", nie `cookie`).
- **`AuditPingState.status` (3c):** die Loader-Liste `["pending", "delivered", "adjudicated"]` (Anker im Boot-Block `const pap = (persisted as { auditPings?: unknown }).auditPings;`) bekommt `"program-inbox"`; ein alter Server, der diese Datei liest, verwirft solche Marker still (er kennt den Wert nicht) und pingt einmal mehr — akzeptiert, weil der Marker nur eine Doppelzustellung verhindert.
- **`Slot.openedAt` fehlt (4):** der Restore setzt `s.openedAt = … : SERVER_BOOT_AT` (Anker im Slot-Restore-Block); das Handoff-Gate vergleicht `by.openedAt === s.openedAt` und faellt damit zu (I11).
- **Alte `basis`-Werte in Events** (`FleetReportEventPayload.basis`) bleiben unberuehrt, weil kein Schnitt Events fuer Program-Zeilen mintet.

Regel fuer alle: **fail-closed, nie erfinden** — kein Loader schreibt ein Feld, das die Zeile nicht hatte; jede Unlesbarkeit ist eine Audit-Zeile.

### 0.4 Routen-Konvention, Scope, Ablehnungen

Alle neuen Routen liegen im Self-Dispatcher von `server.ts` (Anker `if (url.pathname === "/api/self/watch" && req.method === "POST")`), in der dort gelesenen Form:

```ts
const given = req.headers.get("x-fleet-self-token") ?? "";
const s = given ? slots.find((x) => x.cwd && x.selfToken && secretEq(given, x.selfToken)) : undefined;
if (!s) { await Bun.sleep(400); return json({ error: "unauthorized" }, 401); } // flat cost, same as tokenGate
```

Scope-Vokabular wie in `CLAUDE.md` §Self-scheduling: **Lane-only** (`!s.worktree` ⇒ 409) · **Nicht-Lane-only** (`s.worktree && s.label !== STEWARD_LABEL` ⇒ 409) · **Program-gebunden** (`boundProgramForMain(s)` muss `ok` sein ⇒ sonst 409 mit dessen eigenem Satz). Jede Ablehnung ist **409, nie 401**, damit niemand nach einem Token sucht, das er schon hat; ihr Satz sagt, warum die Frage fuer diesen Aufrufer nicht stellbar ist (Stil: „dieser Watch koennte nie feuern").

| Route | Methode | Scope | Body | Ablehnungen (HTTP + woertlicher `error`) | Schnitt |
|---|---|---|---|---|---|
| `/api/self/inbox` | GET | Program-gebunden (Nicht-Lane) | — | 409 `a lane has no program inbox — a lane files its result, its MAIN reads the inbox` (`s.worktree && s.label !== STEWARD_LABEL`) · 409 `<boundProgramForMain().error>` (woertlich: `not the current bound MAIN of an active program — attention is raised by a program's own main session` bzw. `ambiguous Program-MAIN binding: …`) | 3a-i |
| `/api/self/inbox/:id/read` | POST | wie GET | keiner (wird nicht gelesen) | dieselben zwei · 404 `unknown inbox entry` · 409 `inbox entry belongs to another Program — this MAIN reads program <id>` | 3a-i |
| `/api/self/handoff` | GET · POST | Program-gebunden (Nicht-Lane) | POST `{text}` | 409 `a lane lands — it does not hand over` (Lane) · 409 `<boundProgramForMain().error>` · 409 `a game-maker Program hands over through the committed "## Current game checkpoint" section — this route takes no handoff for it` · 400 `text must be a non-empty string of at most ${MAX_PROGRAM_HANDOFF} chars` · 400 `body must contain only text` · GET 404 `this Program has no handoff on record` | 4 |
| `/api/self/fleet-report` | GET | unveraendert; Sicht um Program-Zeilen erweitert | — | unveraendert | 3b |
| `/api/self/fleet-report/:id/accept\|reject` | POST | unveraendert | — | neu: 409 `fleet report belongs to another Program — only the bound MAIN of program <id> may judge it` | 3b |
| `/api/programs` (Owner), `/api/sessions` (Owner-Poll), `/api/self/program-execution` | GET | unveraendert | — | keine neuen | 2 |
| `/api/post-land-audits/adjudicate` (Owner, by position) | POST | unveraendert | unveraendert | keine neuen; die Zeile traegt `actor` | 5a |
| `/api/slots/:id/model` (Owner) | POST | unveraendert | `{model?, effort?, push?}` | 400 `push must be a boolean` · 409 `model push held (<gate>)` | 5b |

Antwort-Form jeder neuen Route: `{ ok: true, … }` oder `{ error }`; keine Route bewegt `Task.status`, landet oder deployt. Ein `slot`-/`programId`-Feld im Body wird strukturell nicht gelesen (Program aus der Bindung, Slot aus dem Token — die Regel von `releaseTaskForMain`).

### 0.5 Standardblock je Brief (wird in §1–§8 woertlich wiederholt)

**VERBOTE.** Nicht anfassen: `send`/`sendText` als Kanal fuer Menschen und Notfall · Watches als Laufzeit (sie duerfen mit dem Occupant sterben) · der Game-Maker-Checkpoint (`gameMakerCheckpointError`, `readGameCheckpoint`) · Auto-Park eines Programs (Owner-Route bleibt; ein Tick MELDET nur) · `clarificationReceiverFor` (Fragen brauchen einen lebenden Antwortenden) · `postLandAuditChecks`, `helperFailNames` (Format und Cap sind die Vorlage, nicht die Baustelle). Keine untracked Dateien im Worktree (blockieren den Land; Scratch in `$TMPDIR`). Nie `bun server.ts` mit Default-Env (LIVE-Socket `claudefleet`, Port 8790): Testinstanzen nur ueber die Suiten oder `FLEET_HOST=127.0.0.1 FLEET_PORT=88NN FLEET_SOCK=fleetlaneNN FLEET_CMD=true FLEET_TOKEN=<test> bun server.ts` aus einer KOPIE des Baums; aufraeumen mit `tmux -L fleetlaneNN kill-server`, nie `pkill -f`. `rg` respektiert `.gitignore` und sieht `fleet.json`, `CLAUDE.md`, die Ledger nicht — dafuer `rg -uu` oder `grep`. `CLAUDE.md` wird nie editiert (generiert). Keine Hostnamen, IPs, Tokens, Klarnamen in Docs oder Tests (oeffentliches Repo). Nichts ausserhalb des Worktrees anfassen (launchd, `~/.claude`, andere Repos).

**ARBEITSWEISE.** `server.ts` hat ~24 600 Zeilen — nie ganz lesen: `rg -n '<symbol>' server.ts server/*.ts lane-signals.ts program-phase.ts`, dann 40–120 Zeilen um den Treffer; Aufrufstellen mit `ast-grep --pattern '<symbol>($$$)' --lang ts server.ts`. Bevor du eine Sonde schreibst: die Fixture-Form der Familie lesen (`check(name, ok, detail)` aus `e2e/harness.ts`; Fixtures, die eine Section ueberleben, reisen durch `e2e/ctx.ts`; Pane-Env nur ueber `paneEnv()`; Zustandsplantagen ueber `readState()`/`writeFileSync(fleet.json)` bei gestopptem Server, dann `restartSrv()`). Ein Check ohne benannte Mutation ist keiner: schreib in den Kommentar ueber jedem Check „BREAKS IF: …".

**VERIFY (volle Kette, ein Kommando; danach die genannten Suiten):**

```
bun install --frozen-lockfile && bun e2e/pins.ts && \
bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun \
  e2e/pins.ts src/client.ts src/share.ts src/helper.ts server.ts fleet-e2e.ts fleet-e2e-claude-gate.ts \
  fleet-e2e-clean-review.ts fleet-e2e-security.ts fleet-e2e-postland-audit.ts fleet-e2e-harness.ts \
  merge-prompt.ts && \
bun run build && ./e2e-clean-review.sh && ./e2e-security.sh && ./e2e-claude-gate.sh
```

Frag vorher `GET /api/self/gate` (Header `x-fleet-self-token: $FLEET_SELF_TOKEN`) nach `localProof.steps`; bei `null` die volle Kette. Wer `e2e/` anfasst, faehrt zusaetzlich die Vorschau `./e2e-isolated.sh` (oder bietet sie per `POST /api/self/suite-offer` an, wenn `helper` online ist — `AGENTS.md` §Verify) und beurteilt sie am Tail (`ALL PASS`). Wer den Tier-2-Audit-Pfad anfasst, faehrt `./e2e-postland-audit.sh`.

**ABSCHLUSS.** Committen (Bodies sind das Befund-Register: was gelesen, was ausgefuehrt, Mechanismus, Bestandteile), `git status --porcelain` leer, `GET /api/self/drift` (bei `wouldConflict:true` erst auf main rebasen), dann genau EIN `POST /api/self/fleet-report` `{status, text}` mit zitiertem Verify-Tail, dann idle.

---

## §1 Schnitt 1 — D4 · lokale Audit-Zeile traegt `fails[]` (schliesst B-A4)

**ZIEL.** Eine LOKAL gelaufene rote Post-Land-Audit-Zeile traegt `fails[]` mit den Namen der gefallenen Checks, im Format und Cap der Remote-Zeilen.

**DONE-KRITERIUM.** In `e2e/repo-worker-audit.ts` produziert ein lokaler roter Lauf eine Zeile mit `fails` gleich GENAU den Namen der `FAIL  `-Zeilen der Ausgabe (Detail-Suffix abgeschnitten, gecappt auf `HELPER_FAILS_KEEP`), und `bun e2e/pins.ts` haelt I12. Verify: die volle Kette aus §0.5, dann `./e2e-postland-audit.sh` (Audit-Pfad angefasst), dann `./e2e-isolated.sh` als Vorschau (e2e angefasst); jede Suite am Tail `ALL PASS`.

**DATEIEN.** `server.ts#runPostLandAudit` (Anker; Nachbarn `postLandAuditChecks`, `postLandAuditTrailFile`, `helperFailNames`, `HELPER_FAILS_KEEP`) · `server.ts#auditPingMessage` (die Zeile `Fehlgeschlagene Checks (vom Remote-Helper gemeldet)`) · `server.ts#PostLandAuditRow` (Kommentar am Feld `fails`) · `e2e/repo-worker-audit.ts` (Stand-in-Skript `fakeaudit-rw`, Modi in `case "$mode"`; Anker `(RW.4)`) · `e2e/pins.ts` (neuer Block `RULE_FAILS`) · `docs/verify-tiering.md` §6 oder die Stelle, die `fails` als remote-only beschreibt (`rg -n 'remote-only' docs/`).

**MECHANISMUS.** Der Remote-Pfad scannt nicht: `helperResult` nimmt `body.fails` vom Helper und `helperFailNames` validiert/cappt (Array von Strings, `slice(0, HELPER_FAILS_KEEP)`, `printableShort(name, HELPER_FAIL_NAME_MAX)`). Der lokale Pfad hat in `runPostLandAudit` die VOLLSTAeNDIGE Ausgabe (`completeOutput = `${gotOut}\n${gotErr}``) vor dem Byte-Cap (`retainRunOutput(…, POSTLAND_AUDIT_OUT_CAP)`) und wirft sie weg. Neu, direkt neben `postLandAuditTrailFile`:

```ts
// the LOCAL twin of the helper's `fails`: names read from the complete output, one per FAIL line,
// the harness's detail suffix (`  (…)`) cut off. Capped and validated through helperFailNames so
// a local and a remote row read the same.
function localFailNames(text: string): string[] {
  const names: string[] = [];
  for (const line of text.replaceAll("\r", "").split("\n")) {
    const m = /^FAIL  (.*)$/.exec(line);
    if (!m) continue;
    const cut = m[1]!.indexOf("  (");
    names.push(cut >= 0 ? m[1]!.slice(0, cut) : m[1]!);
  }
  return names;
}
```

In `runPostLandAudit`, im Zweig nach `checks = postLandAuditChecks(completeOutput, exitCode, undefined, true);` und nur wenn `!timedOut && outputReadable && result === "red"` (die Klassifikation steht direkt darunter — die `fails`-Berechnung gehoert HINTER `else { result = "red"; … }`): `fails = helperFailNames(localFailNames(completeOutput));`. Die Row: `…, out, ...(fails !== undefined ? { fails } : {}), ...(trail ? { trail } : {}), checks, covers`. `postLandAuditChecks` bekommt weiterhin `undefined` als drittes Argument — sein Abgleich-Zweig (`fails === undefined || fails.length !== summarizedFailures`) bleibt byte-gleich, sonst aendert sich `checks` auf lokalen Zeilen. `auditPingMessage`: das Label wird `row.remote ? "Fehlgeschlagene Checks (vom Remote-Helper gemeldet):" : "Fehlgeschlagene Checks (aus der vollstaendigen Ausgabe gelesen):"`. Die Namensform des Harness: `e2e/harness.ts#check` druckt `` `${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}` `` — zwei Leerzeichen, Detail in Klammern nach zwei Leerzeichen; daran haengt der Regex.

**ROUTEN.** Keine.

**E2E-CHECKS (`e2e/repo-worker-audit.ts`, neue Section `(RW.9)` nach `(RW.4)`; das Stand-in-Skript bekommt zwei Modi):**
- Skript-Modus `red`: druckt `PASS  repo-worker verify: tree builds`, `FAIL  repo-worker verify: unit tests  (2 of 9 assertions)`, `FAIL  repo-worker verify: (parenthesised) name  (detail with  (nested) parens)`, `2 FAILURES`, `exit 1`. Modus `redmany`: 60 Zeilen `FAIL  many N`, `60 FAILURES`, `exit 1`.
- Check `(RW) a local red row carries fails: exactly the FAIL names of the complete output, detail suffix cut, in order` — erwartet `fails` gleich `["repo-worker verify: unit tests", "repo-worker verify: (parenthesised) name"]`, `result === "red"`, `checks.failed === 2`. BREAKS IF: die `fails`-Zuweisung fehlt (Feld absent) · der Regex behaelt das Detail (Name endet auf `)`) · `fails` wird vor der Klassifikation berechnet und auch auf gruenen Zeilen geschrieben (Kontrollcheck unten).
- Check `(RW) …capped at HELPER_FAILS_KEEP through helperFailNames` — `redmany` ⇒ `fails.length === 50`. BREAKS IF: der lokale Pfad reicht die Namen nicht durch `helperFailNames`.
- Check `(RW) control: a green local row and an unknown (exit 42) row carry no fails key` — `!("fails" in row)` fuer beide. BREAKS IF: `fails: []` wird auf gruenen Zeilen geschrieben (ein leeres Array laese sich als „gemessen: keine").
- Check `(RW) the audit ping names local fails as read from the output, not as helper-reported` — es gibt HEUTE KEINE Sonde fuer den Ping-Text (`rg -n 'Unbeurteiltes Audit' e2e/*.ts` ist leer; `FLEET_AUDIT_PING_MS` kommt in `e2e/verify-queue.ts` nur als `"0"` vor); die Fixture ist neu: `restartSrv({ FLEET_AUDIT_PING_MS: "1000" })`, eine offene Nicht-Lane-Session mit `cwd` (sie ist der Kandidat von `tickAuditPing`), die rote Zeile aus dem `red`-Lauf, dann `tmuxOut("capture-pane", …)` der Pane auf die Zeile `Fehlgeschlagene Checks (aus der vollstaendigen Ausgabe gelesen):`; am Ende `restartSrv()` ohne die Env. BREAKS IF: das Label bleibt „vom Remote-Helper gemeldet".

**PINS (`e2e/pins.ts`, Block `RULE_FAILS`).** (a) `function localFailNames(` existiert; (b) Body von `runPostLandAudit` enthaelt `helperFailNames(localFailNames(` (I12); (c) der Aufruf steht textuell NACH `result = "red"` im selben Body (Ordnung per `indexOf`); (d) `postLandAuditChecks(completeOutput, exitCode, undefined, true)` steht unveraendert im Body (der Abgleich-Zweig bleibt byte-gleich).

**VERBOTE.** §0.5 woertlich; zusaetzlich: `postLandAuditChecks` und `helperFailNames` nicht aendern; `helperResult` nicht anfassen; `POSTLAND_AUDIT_OUT_CAP` bleibt.

**KOLLISIONSFLAeCHE.** `runPostLandAudit` wird auch von Schnitt 3c erweitert (Aufruf `writeAuditInboxEntries(row)` nach `mintAuditEvents`) — verschiedene Zeilen derselben Funktion; Schnitt 1 landet ZUERST (kollisionsfrei mit 2, parallel moeglich). `auditPingMessage` wird von 3c gelesen (`auditSubjectOf`), nicht geaendert.

**GROeSSE.** Code ~35 Zeilen (Funktion 12, Aufruf 4, Row 1, Label 2, Kommentar 3, Pins 15) · Test ~90 Zeilen (Skript-Modi 12, vier Checks) · Docs ~10. Summe ~135.

---

## §2 Schnitt 2 — D2 · Program-Status-Projektion (schliesst B-A1 Sicht)

**ZIEL.** Jedes aktive Program traegt in `GET /api/self/program-execution`, `GET /api/programs` und als Zaehler `programsStale` im Owner-Poll eine abgeleitete Status-Projektion aus den vier Quellen, die der Controller heute von Hand zusammenliest — ohne neue Wahrheit, ohne Schreibzugriff.

**DONE-KRITERIUM.** `e2e/programs.ts` beweist `status.main.occupancy ∈ live|stale|unbound` je Program, `lastLand`/`lastAudit` aus geplanteten Ledger-Zeilen (Join ueber `mainAfter`) und `programsStale` im Poll (weggelassen bei 0); die zwei bestehenden Pins an `programExecutionView` und I13 bleiben gruen. Verify: volle Kette §0.5, dann `./e2e-isolated.sh` als Vorschau (e2e angefasst).

**ABWEICHUNG VOM PLAN.** (1) Der Plan schreibt `occupancy: bound|stale|none`; der Code hat das Vokabular `live|stale|unbound` in `server.ts#programOccupancy`, das `GET /api/programs` und die Supervisor-Sicht schon benutzen. Es gilt der Code: die Projektion traegt `live|stale|unbound`, ein zweites Vokabular fuer dieselbe Dreiwertigkeit waere eine zweite Antwort. (2) `inbox {unread, oldestAt}` kann in diesem Schnitt nicht gebaut werden, weil `Program.inbox` erst in Schnitt 3a-i entsteht — der Plan nennt 2 als Messbasis fuer 3a; das Feld wird in 3a-i ergaenzt, hier steht es NICHT (kein `inbox: null`-Platzhalter: ein Feld ohne Quelle ist eine Messung von nichts). (3) `deploy {codeBehind}` ist im Code ein FLEET-Fakt (`deployGap()` misst `BOOT_HEAD..HEAD` dieses Checkouts, gecacht in `deployFacts` durch `refreshDeployFacts` auf dem git-Tick), kein Program-Fakt; die Projektion traegt `deploy` nur, wenn `lastLand.repo` per `repoCanon` DIESES Checkout ist, und liest dann den Cache (kein git-Spawn in der View, Pin I13), sonst `deploy: null`.

**DATEIEN.** `server.ts#programExecutionView` (Anker; der Rueckgabe-Block `program: {…}, authority: {…}, tasks: {…}, lanes: {…}, outcomes: {…}, receipts: {…}`) · `server.ts#programOccupancy`, `#programHealth`, `#programReturnPath` (Wiederverwendung) · `server.ts#newestOutcomeByTask` (Muster fuer die Outcome-Ableitung) · `server.ts#adjudicationsByAudit`, `#readLedger`, `POSTLAND_AUDIT_FILE`, `LANE_OUTCOME_FILE` · die Owner-Route `GET /api/programs` (Anker `return json({ programs: programs.map((p) => ({ ...publicProgram(p), health: programHealth(p),`) · der Poll-Block in `/api/sessions` (Anker `? { attentionOpen: attentionRequests.filter(`) · `server.ts#deployFacts` (Cache) · `e2e/programs.ts` · `e2e/pins.ts` (`RULE_D2`) · `docs/self-api.md` §tasks (Unterabschnitt `Die abgeleitete phase`) um einen Absatz `status`.

**MECHANISMUS.** Eine reine Funktion `programStatusView(p: Program, ctx: { outcomeRows, auditRows, judged })` neben `programHealth`, nichts persistiert:

```ts
interface ProgramStatusView {
  main: { slot: number | null; occupancy: ProgramOccupancy; sessionIdMatch: SessionIdMatch };
  attention: { open: number };                       // open|send-uncertain rows with a.programId === p.id
  lanes: { running: number; queued: number; waiting: number };
  lastLand: { sha: string; branch: string | null; verifyOk: boolean | null; at: number; repo: string | null } | null;
  lastAudit: { at: number; result: "green" | "red" | "unknown"; fails: string[] | null;
    adjudicated: AdjudicationVerdict | null } | null;
  deploy: { codeBehind: boolean | null } | null;
}
```

- `main`: `programHealth(p)` plus `p.main?.slot ?? null`.
- `attention.open`: derselbe Filter wie `programPhaseInput` (`a.status === "open" || a.status === "send-uncertain"`, `a.programId === p.id`).
- `lanes.running`: `slots.filter((s) => s.cwd && s.programId === p.id).length`; `queued`: Tasks `programId === p.id && status === "queued"`; `waiting`: davon die mit `note?.startsWith("waiting:")` (die Wait-Note schreibt `tickDispatch`).
- `lastLand`: Outcome-Zeilen `row.programId === p.id && row.disposition === "landed"`, neueste nach `ts`; `sha = mainAfter ?? headSha`, `verifyOk = row.verified` (three-valued, `null` bleibt `null`), `repo = row.repo ?? null`.
- `lastAudit`: die Menge `landed = Set(mainAfter aller gelandeten Zeilen des Programs)`; Audit-Zeilen (`validAuditRow`), deren `mainSha` oder ein `covers[].mainAfter` in `landed` liegt; neueste nach `at`; `fails = row.fails ?? null`; `adjudicated = judged.get(row.at)?.verdict ?? null`.
- `deploy`: `lastLand && repoCanon(lastLand.repo) === repoCanon(import.meta.dir) ? { codeBehind: deployFacts?.gap.codeBehind ?? null } : null`.
- `programExecutionView` liest die zwei zusaetzlichen Ledger (`POSTLAND_AUDIT_FILE`, `adjudicationsByAudit()`) im bestehenden `Promise.all` und haengt `status: programStatusView(p, …)` an jedes projizierte Program; ein `malformed > 0` der Audit-Ledger-Lesung wird als `unknown`-Zeile gemeldet (Muster der Outcome-Zeile dort).
- `GET /api/programs` (Owner): `status` neben `health` — aber OHNE Ledger: dort nur `main`, `attention`, `lanes` (in-memory), `lastLand/lastAudit/deploy: undefined` weggelassen; die Ledger-Joins gehoeren auf die Pull-Route der MAIN, nicht auf eine Owner-Liste, die das Board pollt.
- Poll: `...(stale > 0 ? { programsStale: stale } : {})` mit `stale = programs.filter((p) => p.status === "active" && programOccupancy(p) === "stale").length` — direkt unter `attentionOpen`, gleiche Weglass-Regel (12-KiB-Budget, `e2e/tasks.ts`).

**ROUTEN.** Keine neuen; drei bestehende erweitert (Tabelle §0.4).

**E2E-CHECKS (`e2e/programs.ts`, nach `Program-MAIN self view: only the bound occupant sees the Program by slot+openedAt`):**
- `program status: the bound occupant projects live, a killed binding projects stale, an unbound program projects unbound` — drei Programs, Bindung per geplantetem `main` (Muster `ambiguousRow.main = { ...bound }`), Slot des zweiten per Owner-`/kill`. BREAKS IF: `programOccupancy` vergleicht nur `slot.id` (ein recycelter Slot mit neuem `openedAt` laese `live`).
- `program status: programsStale rides /api/sessions as the count of stale ACTIVE programs and is omitted at zero` — vorher/nachher `readState`/`GET /api/sessions`; ein `complete`-Program mit staler Bindung zaehlt NICHT. BREAKS IF: der Filter vergisst `status === "active"` · das Feld steht bei 0 als `0`.
- `program status: lastLand and lastAudit join by mainAfter, newest first, and carry fails and the adjudication verdict` — zwei Outcome-Zeilen (eine `landed` mit `mainAfter: A`, eine aeltere mit `B`) und zwei Audit-Zeilen (`covers[].mainAfter` A rot mit `fails`, B gruen) per `appendFileSync` in `lane-outcomes.jsonl`/`post-land-audits.jsonl` unter `ROOT`, plus eine Adjudikation via Owner-Route. BREAKS IF: Join ueber `branch` statt `mainAfter` · aelteste statt neueste Zeile · `fails` weggelassen.
- `program status: the owner list carries the in-memory half only and no ledger fields` — `GET /api/programs` hat `status.main` und keine `lastLand`-Eigenschaft. BREAKS IF: jemand haengt die Ledger-Joins an die Owner-Liste.
- `program status: a MAIN of another program does not see this program's status` — bestehende Scope-Regel (Sicht nur fuer `p.main` = Occupant). BREAKS IF: die Projektion wird ueber `programs` statt `boundPrograms` gebaut.

**PINS (`RULE_D2`).** (a) `programsStale` im Poll-Block wird aus `programOccupancy(p) === "stale"` abgeleitet (Text zwischen `attentionOpen` und `tasks: tasks.map(taskDigest)` enthaelt `programOccupancy(` und `p.status === "active"`); (b) derselbe Block enthaelt kein `readLedger(`; (c) `function programStatusView(` enthaelt keines der Mutations-Primitive des bestehenden Pins; (d) die Owner-Route `GET /api/programs` ruft `programStatusView(` ohne Ledger-Argument — pinne, dass zwischen `url.pathname === "/api/programs"` und dem folgenden `return json` kein `readLedger(` steht.

**VERBOTE.** §0.5 woertlich; zusaetzlich: keine Park-Regel, kein Tick, der auf `stale` reagiert; `programOccupancy` nicht „vereinfachen" (Doktrin `slot.id && openedAt`); keine Zeilennummern in `docs/self-api.md`.

**KOLLISIONSFLAeCHE.** `programExecutionView` bekommt in 3a-i das Feld `status.inbox` — 2 landet vor 3a-i. Kein Symbol mit Schnitt 1 gemeinsam (parallel).

**GROeSSE.** Code ~140 (View 70, Owner-Route 6, Poll 4, Typ 15, Pins 30, Doc 15) · Test ~130. Summe ~270.

---

## §3 Schnitt 3a — D1 · Datenmodell, Routen, Attention-Writer, Nudge (schliesst B-A2, B1)

Zwei Briefe, seriell: **3a-i** (Datenmodell + Loader + Routen + Pins + Succession-Beweis) und **3a-ii** (Attention-Antwort in die Inbox, Reconcile bei Succession, Ein-Zeilen-Nudge). Der Plan fuehrt beides als EIN Schnitt; zusammen waeren es ~750 Zeilen Diff — geteilt, weil 3a-i ohne Schreiber landbar ist (wie `lineage` und `studio` als Inventar-Schnitte gelandet sind) und 3a-ii die `e2e/attention.ts`-Familie umbaut.

### §3-i Schnitt 3a-i — Inbox-Datenmodell, Loader, `GET /api/self/inbox`, `POST /api/self/inbox/:id/read`

**ZIEL.** `Program.inbox` existiert als geschlossenes, versioniertes Feld mit Loader, Append-Primitiv und zwei Self-Routen; ein Eintrag ueberlebt eine Succession und ist fuer einen recycelten Slot ohne Bindung unsichtbar.

**DONE-KRITERIUM.** `e2e/programs.ts` beweist: geplantete Eintraege sind fuer die gebundene MAIN lesbar, `read` stempelt die Quittung, nach `POST /api/self/succeed` liest die Nachfolgerin dieselben Eintraege (ungelesene bleiben ungelesen), und derselbe Slot mit neuem `openedAt` ohne Bindung bekommt 409; Pins I1–I3 gruen. Verify: volle Kette §0.5, dann `./e2e-isolated.sh` als Vorschau.

**DATEIEN.** `server/types.ts` (`interface Program`, `interface ProgramLineage`, `loadProgramLineage` als Muster, Export-Liste am Dateiende) · `server.ts` Program-Hydration (Anker `loadProgramStudioBinding(x.studio)` … `programs = capPrograms(loaded)`; `unreadableLineages` als Muster) · `server.ts#boundProgramForMain` (Wiederverwendung, unveraendert) · `server.ts#programExecutionView` (Feld `status.inbox` aus Schnitt 2 ergaenzen) · Self-Dispatcher (Anker `"/api/self/watch"`; die neuen Routen direkt VOR `"/api/self/fleet-report"`) · `e2e/programs.ts` · `e2e/pins.ts` (`RULE_INBOX`) · `docs/self-api.md` neuer Abschnitt `## inbox — GET /api/self/inbox, POST /api/self/inbox/:id/read` (Form wie §watch: curl, Felder, Deckel, alle Ablehnungen).

**TYPEN.** Exakt §0.2 (`ProgramInboxKind`, `ProgramInboxEntry`, `ProgramInbox`, `PROGRAM_INBOX_MAX`, `PROGRAM_INBOX_KINDS`, `PROGRAM_INBOX_ENTRY_KEYS`, `ProgramInboxRead`, `loadProgramInbox`; `Program.inbox?`).

**MECHANISMUS.**
- **Loader** in `server/types.ts` nach `loadProgramLineage`, Fehlersaetze in dessen Form. Hydration: `if (Object.prototype.hasOwnProperty.call(x, "inbox")) { const read = loadProgramInbox(x.inbox); if (read.ok) inbox = read.inbox; else unreadableInboxes.push({ id: x.id, error: read.error }); }`; `loaded.push({ …, ...(inbox ? { inbox } : {}) })`; nach `programs = capPrograms(loaded)` je unlesbarem Record `console.error` + `audit("program_inbox_unreadable", …)`.
- **Append-Primitiv** in `server.ts` neben `appendProgramLineage`:

```ts
// THE ONE WRITER. Every kind's producer calls this and nothing else touches `inbox`. Capped like
// the lineage: past PROGRAM_INBOX_MAX the oldest READ entries go first, then the oldest unread,
// and `dropped` counts them — a pointer that fell off says so instead of vanishing.
function appendProgramInbox(program: Program, kind: ProgramInboxKind, ref: string): ProgramInboxEntry {
  const entry: ProgramInboxEntry = { id: randomBytes(12).toString("hex"), kind, at: Date.now(), ref,
    readBy: null, readAt: null };
  const inbox = program.inbox ?? { v: 1 as const, entries: [], dropped: 0 };
  let entries = [...inbox.entries, entry];
  while (entries.length > PROGRAM_INBOX_MAX) {
    const readIdx = entries.findIndex((e) => e.readBy !== null);
    entries = readIdx >= 0 ? entries.filter((_, i) => i !== readIdx) : entries.slice(1);
    inbox.dropped++;
  }
  program.inbox = { v: 1, entries, dropped: inbox.dropped };
  audit("program_inbox_append", undefined, `${program.id} ${kind} ${ref}`);
  return entry;
}
```

  Der Aufrufer speichert (`saveStateNow`) — das Primitiv nicht, damit der Schreiber sein Ereignis und den Eintrag in EINEM Schnitt persistiert. In 3a-i gibt es keinen Aufrufer; der Compiler darf das nicht bemaengeln (kein `noUnusedLocals` in der tsc-Zeile), der Pin I1 verlangt die Funktion.
- **Lesehelfer** `programInboxView(program, s)`: `{ program: program.id, unread, dropped, entries: entries.map((e) => ({ ...e, subject: inboxSubject(e) })) }`, neueste zuerst; `inboxSubject`: `attention-answer` ⇒ die `AttentionRequest`-Zeile (`attentionRequests.find`), `fleet-report` ⇒ die `FleetReport`-Zeile, `audit-red` ⇒ `null` in DIESEM Schnitt (Join kommt in 3c) — ein nicht aufloesbarer `ref` ist `subject: null` plus eine `unknown`-Zeile im Antwortobjekt (`"entry <id> names a <kind> row that is no longer present (retention)"`).
- **Routen** (Form §0.4): GET → Scope-Pruefungen, `boundProgramForMain(s)`, `json(programInboxView(program, s))`. POST read → dieselben Pruefungen, Eintrag per `id` in `program.inbox.entries` suchen (404 `unknown inbox entry`), gehoert der Eintrag zu einem anderen Program ⇒ 409 (tritt strukturell nur bei fremder Id auf, wird trotzdem benannt), bereits gelesen ⇒ `{ ok: true, existing: true, entry }` (Lesen ist eine Quittung, kein Lock: ein zweiter Occupant, der einen gelesenen Eintrag liest, ueberschreibt nicht), sonst `readBy = { slot: s.id, openedAt: s.openedAt, sessionId: s.sessionId }`, `readAt = Date.now()`, `audit("program_inbox_read", s.id, `${program.id} ${entry.id}`)`, `await saveStateNow()`, `{ ok: true, existing: false, entry }`.
- **`programExecutionView`:** `status.inbox = { unread, oldestAt }` (aus Schnitt 2s `programStatusView`; `oldestAt` = kleinstes `at` der ungelesenen, sonst `null`).
- **Teardown:** `teardownSlotOccupant` fasst `programs[]` nicht an und bleibt so — das ist die Eigenschaft, die der Succession-Check beweist.

**ROUTEN.** Tabelle §0.4, Zeilen `/api/self/inbox` und `/api/self/inbox/:id/read`. Antworten: GET `{ program, unread, dropped, entries: [{id, kind, at, ref, readBy, readAt, subject}], unknown: string[] }`; POST `{ ok, existing, entry }`.

**E2E-CHECKS (`e2e/programs.ts`; Anker: die Program-aware-Succession-Fixture `// --- Program-aware succession: HANDOFF gate first …` und der Check `Program-MAIN lineage: succession closes the predecessor's entry …`):**
- `program inbox legacy: a persisted Program without the key loads without it and gains no backfill` — `readState()` nach Restart: `!("inbox" in row)`. BREAKS IF: der Loader schreibt `inbox: {v:1, entries:[], dropped:0}`.
- `program inbox unreadable: a record with an unknown key loads as ABSENT and is reported once` — Plantage `inbox: { v: 1, entries: [], dropped: 0, extra: 1 }`; Audit-Zeile `program_inbox_unreadable`. BREAKS IF: der Loader repariert feldweise.
- `program inbox scope: the bound MAIN reads the planted entries newest first, a lane and an unbound session are 409 by name` — zwei geplantete Eintraege (`attention-answer` mit `ref` einer geplanteten Attention-Zeile, `fleet-report` mit `ref` einer geplanteten Report-Zeile); `subject` je aufgeloest. BREAKS IF: die Route filtert an `readBy` oder am Requester-Tripel der Attention statt an der Bindung.
- `program inbox read: the receipt names this occupant, a second read is existing:true and rewrites nothing` — BREAKS IF: `readBy` wird beim zweiten Lesen ueberschrieben.
- `program inbox survives succession: the successor reads the same entries and the unread one is still unread` — direkt nach dem bestehenden Succession-Erfolgs-Check mit dem Token der Nachfolgerin (`paneEnv(`s${successorSlot}`, "FLEET_SELF_TOKEN")`). BREAKS IF: irgendein Teardown-Pfad die Inbox an das Occupant-Tripel bindet oder `succeedProgramMain` sie leert.
- `program inbox recycled slot: the same slot id with a new openedAt and no binding sees no inbox (409)` — Vorgaenger-Slot nach der Grace-Frist recyceln (Owner `/open` auf dieselbe Nummer), GET mit dem neuen Token ⇒ 409 mit dem `boundProgramForMain`-Satz. BREAKS IF: `boundProgramForMain` vergleicht nur `slot`.
- `program inbox cap: past PROGRAM_INBOX_MAX the oldest READ entry is dropped first and dropped counts it` — Plantage 100 Eintraege (99 ungelesen, 1 gelesen an Position 0) + ein Append ueber… es gibt keinen Schreiber in 3a-i: pruefe die Cap-Regel als Unit an `appendProgramInbox` ueber den Loader-Pfad (Plantage mit 101 Eintraegen ⇒ Loader-Fehler `entries must hold at most 100 rows` ⇒ ABSENT + Audit). Der Append-Cap wird in 3a-ii mit dem ersten Schreiber geprueft; sag das im Commit-Body.

**PINS (`RULE_INBOX`, I1–I3).** Zusaetzlich: `appendProgramInbox(` ist der EINZIGE Ort, der `program.inbox =` schreibt (Zaehlung der Zuweisungen `\.inbox = ` in `server.ts` === 1).

**VERBOTE.** §0.5 woertlich; zusaetzlich: kein Schreiber in diesem Schnitt (kein Aufruf von `appendProgramInbox`), kein Tick, kein `sendText`; `attentionRequests`/`fleetReports`-Retention unveraendert.

**KOLLISIONSFLAeCHE.** `programExecutionView` (Schnitt 2 zuerst); der Self-Dispatcher (3b/4 fuegen dort ebenfalls Routen ein — je eigener Block, seriell landen); `server/types.ts#Program` (Schnitt 4 fuegt `handoff?` hinzu — 3a-i vor 4).

**GROeSSE.** Code ~230 (Typen+Loader 90, Hydration 15, Append 20, View+Routen 70, Pins 35) · Test ~150 · Docs ~60. Summe ~440 — an der Grenze; wenn die Doc-Zeilen mitzaehlen, den `docs/self-api.md`-Abschnitt als eigenen Folge-Commit derselben Lane fuehren (ein Land), nicht als zweite Lane.

### §3-ii Schnitt 3a-ii — Attention-Antwort in die Inbox, Reconcile bei Succession, Ein-Zeilen-Nudge

**ZIEL.** Eine Owner-Antwort auf eine Attention wird ein Inbox-Eintrag des Programs statt eines Pane-Pastes; eine offene Attention ueberlebt die Succession ihrer MAIN; die gebundene MAIN bekommt am Idle-Punkt genau EINE Zeile „N ungelesen".

**DONE-KRITERIUM.** `e2e/attention.ts` beweist: die Antwort erzeugt genau einen Inbox-Eintrag und stellt die Zeile auf `answered`, die Requester-Pane bleibt unberuehrt; eine Antwort an eine Attention, deren Requester per Succession ging, wird angenommen; ein Owner-Kill refused weiter mit `requester session ended`; die Nudge kommt als genau eine Zeile je Ungelesen-Menge. Pins I4, I5 gruen. Verify: volle Kette §0.5, dann `./e2e-isolated.sh` als Vorschau.

**ANNAHME (Plan-Luecke, keine Code-Abweichung).** Der Plan sagt „Attention-Antwort landet als Inbox-Eintrag statt als `send`", nicht, was mit einer Attention eines NICHT mehr aktiven Programs geschieht. Festgelegt: die Antwort wird 409 `the Program of this attention is <status> — no bound MAIN can read an answer to it` (eine Frage eines abgeschlossenen Programs ist keine offene Frage mehr). `send-uncertain` bleibt im `AttentionStatus`-Typ fuer persistierte Alt-Zeilen und wird nicht mehr geminted.

**DATEIEN.** `server.ts#answerAttention` (Anker; Nachbarn `refuseAttentionRequest`, `attentionAnswerMessage`) · `server.ts#reconcileAttention` und sein Aufrufer `dropWatchesFor` (Aufrufer `teardownSlotOccupant`, der `why: Exclude<SlotEnding, "unknown">` schon traegt) · `server.ts#attentionFor` · `server.ts#tickBacklogNudge` (Muster fuer den neuen Tick: `backlogSessionKey`, `canDeliver`, `BACKLOG_IDLE_MS`, `logPrompt`, `saveHistory`) · die Timer-Zeile des Audit-Pings (Anker `if (AUDIT_PING_MS > 0) setInterval(`) · `e2e/attention.ts` · `e2e/pins.ts` (Pin `attention answer persists send-uncertain before sendText …` ersetzen; `RULE_INBOX` I4/I5) · `docs/self-api.md` §inbox (ergaenzen: welche Kinds wer schreibt) · `AGENTS.md` §Role contract Zeile „Project MAIN" (Back-channel: `GET /api/self/inbox` aufnehmen — Pin `RULE_ANCHORS` verlangt, dass zitierte Pfade existieren; eine Route ist kein Pfad, aber schreib sie in derselben Form wie die Nachbarn).

**MECHANISMUS.**
- **`answerAttention(id, body)`:** Validierung bis `if (request.status === "refused") …` unveraendert. Danach: `const program = programs.find((p) => p.id === request.programId); if (!program || program.status !== "active") return 409 (ANNAHME oben)`. Der Requester-Liveness-Block (`refuseAttention(request, "requester session ended")`) und `canDeliver` ENTFALLEN — der Eintrag hat keinen Empfaenger. Dann: `const at = Date.now(); request.status = "answered"; request.answer = { text: answer, at, by: "owner" }; request.refusedReason = null; request.closedAt = at; const entry = appendProgramInbox(program, "attention-answer", request.id); audit("attention_answered", request.requester.slot, `${request.id} kind=${request.kind} inbox=${entry.id}`); pruneAttention(); await saveStateNow(); return json({ ok: true, existing: false, request, inbox: entry.id });`. Der `send-uncertain`-Zweig (`if (request.status === "send-uncertain" && …)`) bleibt fuer Alt-Zeilen: identischer Text ⇒ wird jetzt auf demselben Weg beantwortet (Inbox), verschiedener Text ⇒ 409 wie heute.
- **`reconcileAttention(teardownSlotId?, why?)`:** Signatur um `why?: SlotEnding` erweitern; `dropWatchesFor(slotId, why)` reicht es durch; `teardownSlotOccupant` ruft `dropWatchesFor(s.id, why)`. Neue Regel im Loop: `const program = programs.find((p) => p.id === a.programId); const survives = why === "handoff" && program?.status === "active"; if (!gone || survives) continue;` — eine Succession (`killSlot(s, "handoff")` aus `scheduleSuccessionRetirement`/`handleSelfRetire`) laesst offene Zeilen eines aktiven Programs stehen; Owner-Kill (`"owner"`), Land (`"landed"`) und alle anderen Enden refusen wie heute. Boot-Reconcile (Aufruf ohne `why`) refused wie heute — ein Restore ist keine Succession.
- **`attentionFor(s)`:** `attentionRequests.filter((a) => attentionBound(a, s) || (bound.ok && a.programId === bound.program.id))` mit `bound = boundProgramForMain(s)` — die Nachfolgerin sieht die offenen Fragen ihrer Vorgaengerin (und deren Antworten). `openAttention`s Dedupe/Cap bleiben am Requester-Tripel (eine Nachfolgerin darf dieselbe Frage neu stellen; der Cap zaehlt ihre eigenen).
- **`tickInboxNudge`** (neben `tickBacklogNudge`, gleiche Bauart): fuer jedes aktive Program mit `programOccupancy === "live"` und `unread > 0`: `s = slotFrom(main.slot)`; Key `${backlogSessionKey(s)}|${unreadIds.sort().join(",")}`; `inboxNudgeTried: Map<number, { key, lastAt }>`; gleiche Key ⇒ nichts; `now - lastAt < INBOX_NUDGE_COOLDOWN_MS (10 min)` ⇒ nichts; `s.lastOutput === 0` ⇒ unbeobachtet, nichts; `canDeliver(s, { now, idleMs: BACKLOG_IDLE_MS, quietHours: true })`; Identitaet nach dem Await neu pruefen; Text EINE Zeile: `[fleet inbox] ${unread} ungelesene Eintraege in der Inbox deines Programs ${program.id} — GET /api/self/inbox, dann POST /api/self/inbox/<id>/read (x-fleet-self-token aus $FLEET_SELF_TOKEN).`; `sendText(s, text, true)`, History/`logPrompt` wie der Backlog-Tick; danach `return` (ein Empfaenger je Tick). Timer: `const INBOX_NUDGE_MS = Math.max(0, Number(process.env.FLEET_INBOX_NUDGE_MS ?? 60_000) | 0); if (INBOX_NUDGE_MS > 0) setInterval(() => { void tickInboxNudge(); }, INBOX_NUDGE_MS);` neben dem Audit-Ping-Timer.

**ROUTEN.** Keine neuen; `POST /api/attention/:id/answer` (Owner) aendert Verhalten wie oben (Antwort `{ ok, existing, request, inbox }`).

**E2E-CHECKS (`e2e/attention.ts`; die Familie um `attention answer full circle` — die Checks `… full circle`, `… unresolved send persists send-uncertain …`, `attentionOpen counts a send-uncertain row …`, `… send-uncertain retry with different text …`, `… identical retry re-attempts the send …` werden ERSETZT, nicht ergaenzt; im Commit-Body je alter Check-Name die neue Entsprechung nennen):**
- `attention answer: the owner's answer becomes exactly one program inbox entry, the row is answered, and the requester pane receives no paste` — Pane per `tmuxOut("capture-pane", …)` vor/nach gleich; `GET /api/self/inbox` der MAIN zeigt einen Eintrag `attention-answer` mit `subject.answer.text`. BREAKS IF: `sendText` bleibt · der Eintrag fehlt · zwei Eintraege.
- `attention answer idempotency: identical text is existing:true and mints no second entry; different text is 409` — BREAKS IF: `existing` mintet erneut.
- `attention answer legacy send-uncertain row: identical text lands in the inbox, different text stays 409` — Plantage einer `send-uncertain`-Zeile. BREAKS IF: der Legacy-Zweig entfernt wird (Alt-Zeilen unbeantwortbar).
- `attention answer inactive program: 409 by name and nothing written` — Program auf `complete` (Owner-Route). BREAKS IF: die Antwort erzeugt einen Eintrag an einem toten Program.
- `attention survives succession: after POST /api/self/succeed the open row is still open, the successor lists it, and the owner's answer reaches the successor's inbox` — Fixture aus `e2e/programs.ts` (Succession mit `respawnScreen`) hier nachbauen oder die Attention-Zeile dort pflanzen; die Retirement-Grace abwarten (`MIGRATE_GRACE_MS` — im Test-Env pruefen, `rg -n 'MIGRATE_GRACE_MS' e2e/*.ts`). BREAKS IF: `reconcileAttention` ignoriert `why` · `attentionFor` filtert nur am Tripel.
- `attention owner kill still refuses: a killed requester's open rows read requester session ended, and a recycled slot inherits nothing` — der bestehende Check `attention reconcile: …` bleibt als dieser Check (Owner-`/kill` ⇒ `why: "owner"`). BREAKS IF: `survives` prueft nicht `why === "handoff"`.
- `inbox nudge: one line per unread set reaches the bound MAIN pane, a second tick repeats nothing, a new entry after the cooldown earns one more line` — Pane-Capture zaehlt `[fleet inbox]`-Zeilen; `FLEET_INBOX_NUDGE_MS` per `restartSrv({ FLEET_INBOX_NUDGE_MS: "1000" })` klein stellen; Cooldown im Test nicht wartbar ⇒ pruefe „gleiche Menge ⇒ 0 weitere Zeilen" und „Nudge aus (`0`) ⇒ keine Zeile". BREAKS IF: der Key vergisst die Ungelesen-Menge (jeder Tick nudgt) · der Timer fehlt.
- `inbox append cap: the 101st entry drops the oldest READ entry first and dropped counts it` — 100 Antworten sind zu teuer; Plantage 100 Eintraege (Position 0 gelesen), dann EINE Antwort ⇒ `entries.length === 100`, `dropped === 1`, der gelesene Eintrag fehlt. BREAKS IF: der Cap wirft den aeltesten ungelesenen zuerst.

**PINS.** I4 (ersetzt den Send-Uncertain-Pin: `answerAttention`-Body enthaelt `appendProgramInbox(` vor `request.status = "answered"`, genau ein `await saveStateNow()` NACH `"answered"`, kein `sendText(`; `pruneAttention` behaelt `a.status === "answered" || a.status === "refused"`), I5 (ein Timer, Form des Audit-Ping-Pins), plus: `dropWatchesFor(s.id, why)` in `teardownSlotOccupant` und `reconcileAttention(slotId, why)` in `dropWatchesFor` (Text).

**VERBOTE.** §0.5 woertlich; zusaetzlich: Clarifications (`replyClarification`, `reconcileClarifications`) unveraendert — eine Frage einer Lane braucht einen lebenden Antwortenden; `openAttention` (Cap, Dedupe, Provenance) unveraendert; keine zweite Nudge-Zeile mit Inhalt (der Inhalt ist Pull).

**KOLLISIONSFLAeCHE.** `teardownSlotOccupant`/`dropWatchesFor` (3d fasst `openFleetReport` an, nicht diese) · `attentionFor` (sonst niemand) · der Timer-Block (5b fasst ihn nicht an). 3a-ii nach 3a-i.

**GROeSSE.** Code ~170 (answer 30, reconcile 15, attentionFor 8, Tick 70, Timer 4, Pins 40) · Test ~190 · Docs ~40. Summe ~400.

---

## §4 Schnitt 3b — D1 · Report adressiert das Program, inkl. Autoclose (schliesst B-A1)

**ZIEL.** Ein Fleet-Report einer Lane mit AKTIVEM Program wird an das Program adressiert (`basis:"program"`, Inbox-Eintrag, kein FleetEvent, kein Budget), wird von der gebundenen MAIN gelesen und beurteilt, und der scharfe Autoclose (`FLEET_LANE_AUTOCLOSE=1`) liest seine Autoritaet aus `Program.lineage`.

**DONE-KRITERIUM.** `e2e/watch.ts` (Q3 umgezogen) beweist: drei Reports von Program-Lanes stehen als `basis:"program"`, `receiver:null`, `eventId:null` in `GET /api/self/fleet-report` der gebundenen MAIN und als drei ungelesene `fleet-report`-Eintraege in ihrer Inbox, ihr `GET /api/self` traegt kein `fleet-report`-Event, `slotDeliveryBudget` der MAIN ist unveraendert; die Autoclose-Sonde in `e2e/watch.ts` (Section `D2`, Anker `restartSrv({ FLEET_LANE_AUTOCLOSE: "1" })`) schliesst eine Program-adressierte Lane nach der Entscheidung der gebundenen MAIN. Pins I6, I7 gruen. Verify: volle Kette §0.5, dann `./e2e-isolated.sh` als Vorschau.

**ANNAHME (Plan-Praezisierung).** Der Plan schreibt an einer Stelle „bei staler Bindung geht der Report in die Program-Inbox" und an anderen „Report adressiert das Program", „das Cap wird nicht mehr von Reports belegt", „ein Lane-Abschluss erzeugt genau EINEN Inbox-Eintrag". Diese drei Saetze gehen nur zusammen auf, wenn JEDE Lane mit aktivem Program `program` bekommt — lebende wie stale Bindung. So ist es hier gebaut; `program-main` wird fuer Reports nicht mehr vergeben (bleibt im Typ fuer Alt-Zeilen, wie `program-main+lane-watch`). `clarificationReceiverFor` bleibt fuer Clarifications unveraendert.

**ABWEICHUNG VOM PLAN.** Der Plan sagt „die Entscheidung wird von der an das Program GEBUNDENEN MAIN getroffen (`boundProgramForMain`)". Fuer die ENTSCHEIDUNG gilt das (Route `accept|reject`). Fuer die AUTOCLOSE-Pruefung reicht das nicht: `laneAutoCloseRefusal` laeuft Ticks spaeter, wenn die entscheidende MAIN schon succeedet sein kann; „ist `decision.by` heute gebunden" waere dann falsch-negativ. Der Code hat die passende Quelle: `Program.lineage` (persistierte Autoritaetsgeschichte, `loadProgramLineage`). Die Regel wird: `decision.by` ist ein Eintrag der Lineage, dessen Haltezeit `decision.at` einschliesst. Ein Program ohne Lineage (`unknown`) ⇒ Refusal „no lineage to check the verdict against" — fail-closed, wie jede Klausel dort.

**DATEIEN.** `server/types.ts#FleetReport`, `#fleetReportFrom` (Typtext §0.2) · `server.ts#openFleetReport` (Anker; Nachbarn `fleetReportMessage`, `NO_RECEIVER_EVIDENCE`) · `server.ts#fleetReportsFor` · `server.ts#decideFleetReport` · `server.ts#laneAutoCloseRefusal` (Klausel `if (r.receiver === null) return "an owner-inbox report …"`) · `server.ts#pruneFleetReports` · `server.ts#latestReportFor` (unveraendert, pruefen) · `src/protocol.ts` (`basis`-Union des Event-Payloads bleibt; pruefe `rg -n '"owner-inbox"|"lane-watch"' src/client.ts src/protocol.ts` — jede geschlossene Fallunterscheidung im Client bekommt `program`) · `e2e/watch.ts` (Testtyp `FleetReportRow`, Anker `basis: "program-main" | "lane-watch" | "program-main+lane-watch" | "owner-inbox"; eventId: string;`; Section `RESULT-RAIL B-D`, Q3; Section `D1`/`D2`) · `e2e/pins.ts` (`RULE_INBOX` I6/I7; der bestehende Pin `FleetEvent watchId is null exactly …` zaehlt `watchId: null`-Mints === 2 — der Literal in `openFleetReport` bleibt im Nicht-Program-Zweig, also unveraendert) · `docs/self-api.md` §fleet-report (Empfaenger-Ableitung: neuer erster Absatz „Program zuerst"; §Annahme; §Der automatische Lane-Schluss: Lineage-Regel).

**MECHANISMUS.**
- **`openFleetReport`:** nach der Body-Validierung: `const program = s.programId ? programs.find((p) => p.id === s.programId) : undefined; if (program?.status === "active") { <Program-Zweig> } else { <heutiger Zweig byte-gleich> }`. Program-Zweig: `report = { …, receiver: null, basis: "program", eventId: null }`; KEIN `fleetEvents`-Push, KEIN `slotDeliveryBudget`; `const entry = appendProgramInbox(program, "fleet-report", id); fleetReports = [...fleetReports, report]; audit("fleet_report_open", s.id, `${id} receiver=program:${program.id} status=${status} basis=program inbox=${entry.id}`); pruneFleetReports(); await saveStateNow(); return json({ ok: true, report, inbox: entry.id });`. Eine Lane, deren `programId` ein NICHT aktives Program nennt, faellt in den heutigen Zweig (Watch-Evidenz oder 409 `no exact clarification receiver evidence`) — unveraendert.
- **`fleetReportFrom`:** §0.2/§0.3.
- **`fleetReportsFor(s)`:** `const bound = boundProgramForMain(s); return fleetReports.filter((r) => bound(r.worker) || bound(r.receiver) || (r.basis === "program" && bound.ok && r.provenance.programId === bound.program.id));` — die Tripel-Wache fuer den recycelten Slot ist damit `boundProgramForMain` (Doktrin `slot && openedAt`).
- **`decideFleetReport`:** vor dem `report.receiver === null`-409: `if (report.basis === "program") { const bound = boundProgramForMain(s); if (!bound.ok) return json({ error: bound.error }, 409); if (bound.program.id !== report.provenance.programId) return json({ error: `fleet report belongs to another Program — only the bound MAIN of program ${report.provenance.programId} may judge it` }, 409); }` und den Occupant-Vergleich fuer `program` ueberspringen; `decision.by` bleibt das entscheidende Occupant-Tripel (Quittung); das Event-Settle entfaellt bei `eventId === null`.
- **`laneAutoCloseRefusal`:** die Klausel `if (r.receiver === null) return "an owner-inbox report carries no MAIN verdict to close on";` wird `if (r.basis === "owner-inbox") …` (gleicher Satz); dann `if (r.basis === "program") { if (!program.lineage) return "no lineage to check the verdict against"; const held = program.lineage.entries.some((e) => e.slot === d.by.slot && e.openedAt === d.by.openedAt && e.boundAt <= d.at && (e.endedAt === null || e.endedAt >= d.at)); if (!held) return "a report's verdict does not name a MAIN this Program's lineage records as holding authority at decision time"; } else { <heutiger Tripel-Vergleich> }`. Provenance-Klausel unveraendert. Damit ist der Nebenbefund geschlossen: ein Beobachter, der eine fremde Lane per Watch empfing, kann keine Program-Lane mehr schliessen, weil Program-Lanes keine Watch-Basis mehr bekommen.
- **`pruneFleetReports`:** `terminal` = `(r.basis === "program" ? !!r.decision : (!event || FLEET_EVENT_TERMINAL.includes(event.status)))` — eine unbeurteilte Program-Zeile altert nicht weg, solange sie die Entscheidung schuldet (der Cap `FLEET_REPORT_KEEP` gilt weiter fuer terminale).
- **Client:** jede `switch`/Map ueber `basis` bekommt den Fall `program` (Badge-Text „Program"); `bun run build`; Hinweis im Commit-Body, dass die Demo (`~/claude-fleet-demo`) gegen `src/client.ts` baut und dort `bun run typecheck` zu fahren ist — nicht aus der Lane, als Meldung.

**ROUTEN.** Tabelle §0.4 (`/api/self/fleet-report` GET-Sicht, `accept|reject` neue Ablehnung). Antwort von `POST /api/self/fleet-report` im Program-Fall `{ ok, report, inbox }`.

**E2E-CHECKS (`e2e/watch.ts`, Section `RESULT-RAIL B-D`):**
- Q3 wird: `Q3 fleet-report scope: the bound MAIN reads all three program rows (basis program, receiver null, eventId null), its inbox holds three unread fleet-report entries, its /api/self carries no fleet-report event, the worker sees its row, a foreign MAIN sees neither` — BREAKS IF: ein Event wird trotzdem geminted · `fleetReportsFor` filtert nur am Tripel · der Inbox-Eintrag fehlt.
- `fleet-report program budget: three program reports leave the MAIN's delivery budget untouched (/api/sessions events count and armed watches unchanged)` — BREAKS IF: `slotDeliveryBudget` oder die Budget-Pruefung im Program-Zweig bleibt.
- `fleet-report inactive program: a lane whose program is complete falls back to watch evidence or the named 409` — Program per Owner `complete` ⇒ heutiger Zweig. BREAKS IF: der Program-Zweig prueft `status` nicht.
- `fleet-report decision on a program row: the bound MAIN accepts, a foreign MAIN is 409 by name, the recycled same slot is 409, first decision wins` — BREAKS IF: `decideFleetReport` vergleicht `by` mit `receiver` (null) statt mit der Bindung.
- `fleet-report durability: program rows reconstruct field-for-field, a program row with an eventId or receiver is discarded` — Plantage (Muster `D1 durability`). BREAKS IF: `fleetReportFrom` laesst die halbe Zeile durch.
- Section `D2` (Autoclose): `D2 autoclose program row: a program-addressed lane closes after the bound MAIN's accept, and a verdict by an occupant the lineage never held is refused by name` — zweite Plantage: `decision.by` auf ein Tripel ausserhalb der Lineage ⇒ Lane bleibt stehen, Refusal-Satz im Trail/`laneAutoCloseRefusal`-Ausgabe (Muster der bestehenden D2-Checks). BREAKS IF: die Lineage-Regel fehlt (jede Entscheidung schliesst) · die Regel vergleicht nur `slot`.
- `fleet-report retention: an undecided program row survives the FLEET_REPORT_KEEP prune, a decided one is terminal` — BREAKS IF: `pruneFleetReports` zaehlt eventlose Zeilen als terminal.

**PINS (`RULE_INBOX` I6, I7).** Zusaetzlich: `openFleetReport` enthaelt `basis: "program"` und im selben Body genau EIN `slotDeliveryBudget(` (der Nicht-Program-Zweig); `decideFleetReport` enthaelt `report.basis === "program"` vor `report.receiver === null`.

**VERBOTE.** §0.5 woertlich; zusaetzlich: `clarificationReceiverFor`, `openClarification`, `replyClarification` unveraendert; `armProgramMainLandWatch` unveraendert (Land-Watches sind ein anderer Fakt); `FleetReportEventPayload` in `lane-signals.ts` unveraendert; kein Umbau der Owner-Inbox (`owner-inbox` bleibt fuer programlose Task-Lanes).

**KOLLISIONSFLAeCHE.** `openFleetReport` wird auch von 3d geaendert (Dedupe-Block am Ende) — 3b vor 3d, oder 3d in derselben Lane als zweiter Commit; `fleetReportFrom`/`FleetReport` (niemand sonst); `laneAutoCloseRefusal` (niemand sonst); `e2e/watch.ts` Section B-D (3d fuegt dort Checks hinzu — seriell).

**GROeSSE.** Code ~150 (types 25, open 40, reportsFor 8, decide 15, autoclose 20, prune 5, client 10, Pins 30) · Test ~170 · Docs ~50. Summe ~370.

---

## §5 Schnitt 3c — D1 · rotes Audit adressiert das Program des Lands (schliesst B-A5)

**ZIEL.** Eine rote Post-Land-Audit-Zeile erzeugt fuer jedes aktive Program, dessen Land sie deckt, einen Inbox-Eintrag `audit-red`; `tickAuditPing` tippt nur noch fuer Lands ohne Program in die ruhigste Session.

**DONE-KRITERIUM.** `e2e/repo-worker-audit.ts` beweist: ein roter lokaler Lauf nach dem Land einer Program-Lane legt einen `audit-red`-Eintrag in die Inbox dieses Programs, dessen `subject` Covers, Checks, `fails` und Tail traegt; `auditPings[at].status === "program-inbox"` und keine Pane bekommt den Ping; ein roter Lauf nach einem programlosen Land pingt wie heute. Pin I8 gruen. Verify: volle Kette §0.5, dann `./e2e-postland-audit.sh` (Audit-Pfad), dann `./e2e-isolated.sh` als Vorschau.

**ABWEICHUNG VOM PLAN.** (1) Der Plan setzt eine Bruecke `covers[].branch → Task → programId` voraus; `Task` traegt keinen `branch` (`server/types.ts#Task`: `slot`, `programId`, `repo`, kein Branch), und die Lane ist beim Audit meist schon abgebaut. Die Bruecke, die der Code hat, ist das Outcome-Ledger: `LaneOutcome` traegt `branch`, `mainAfter`, `programId` (alle auf gelandeten Zeilen gesetzt; `programExecutionView` liest genau so). Gebaut wird `programsForAuditRow(row)` ueber `LANE_OUTCOME_FILE`. (2) Der Plan gibt der MAIN keine Adjudikations-Tuer; `POST /api/post-land-audits/adjudicate` ist owner-only by position (B-A8 beschreibt die Folge). Dieser Schnitt oeffnet keine: der Inbox-Eintrag informiert die MAIN; das Urteil bleibt Owner-Akt (per Attention `review-ready`/`blocked` anfragbar). Das steht als Satz im `subject`.

**DATEIEN.** `server.ts#runPostLandAudit` (Zeile `await mintAuditEvents(row);`) · `server.ts#helperResult` (dieselbe Zeile im Remote-Pfad) · `server.ts#tickAuditPing` (Kandidatenwahl, `setAuditPing`, `AuditPingState`/`AuditPingStatus`) · `server.ts#auditPingMessage` (Zerlegung in `auditSubjectOf(row)` + Rendering) · Boot-Loader der `auditPings` (Anker `const pap = (persisted as { auditPings?: unknown }).auditPings;`) · `server.ts#programInboxView`/`inboxSubject` (aus 3a-i: der `audit-red`-Join) · `server.ts#readLedger`, `LANE_OUTCOME_FILE`, `POSTLAND_AUDIT_FILE`, `validAuditRow` · `e2e/repo-worker-audit.ts` · `e2e/pins.ts` (I8) · `docs/self-api.md` §inbox (Kind `audit-red`) und die Stelle, die den Audit-Ping beschreibt (`rg -n 'FLEET_AUDIT_PING_MS' docs/`).

**MECHANISMUS.**
- **`programsForAuditRow(row: PostLandAuditRow): Promise<Map<string, AuditCover[]>>`:** liest `LANE_OUTCOME_FILE`; fuer jede `cover` die neueste Zeile mit `disposition === "landed" && branch === cover.branch && mainAfter === cover.mainAfter && typeof programId === "string"`; Map `programId → covers`. Covers ohne Treffer bleiben „programlos".
- **`writeAuditInboxEntries(row)`:** `if (row.result !== "red") return;` `const byProgram = await programsForAuditRow(row); let addressed = 0; for (const [id] of byProgram) { const p = programs.find((x) => x.id === id); if (!p || p.status !== "active") continue; appendProgramInbox(p, "audit-red", String(row.at)); addressed++; } const all = byProgram.size > 0 && [...byProgram.values()].reduce((n, c) => n + c.length, 0) === row.covers.length && addressed === byProgram.size; if (all) setAuditPing(row.at, { status: "program-inbox", lastResult: `delivered to program inbox: ${[...byProgram.keys()].join(",")}` }); if (addressed || all) await saveStateNow();`. Aufruf an BEIDEN Stellen direkt nach `await mintAuditEvents(row);` (I8).
- **`tickAuditPing`:** der Kandidaten-`find` schliesst `auditPings[String(r.at)]?.status !== "program-inbox"` aus (neben `delivered`/`adjudicated`); `AuditPingStatus` um `"program-inbox"`; Loader-Liste ergaenzen (§0.3). Ein Audit, das nur TEILWEISE Program-adressiert ist (gemischte Covers), pingt weiter — jemand muss das programlose Land sehen.
- **`auditSubjectOf(row)`:** die Feldableitung aus `auditPingMessage` herausloesen (`at, mainSha, result, exitCode, covers[], checks, ranIsLowerBound, fails[], tail (15 Zeilen), remote: boolean`); `auditPingMessage` rendert daraus (byte-gleicher Text — der bestehende Ping-Check bleibt gruen); `inboxSubject` liefert fuer `audit-red` `{ ...auditSubjectOf(row), adjudicated, door: "adjudication is the owner's: POST /api/post-land-audits/adjudicate — raise attention if it needs a decision" }`; die Zeile kommt per `readLedger(POSTLAND_AUDIT_FILE)` und `rows.find((r) => r.at === Number(entry.ref))`; `GET /api/self/inbox` liest das Ledger nur, wenn ein `audit-red`-Eintrag vorhanden ist.

**ROUTEN.** Keine neuen; `GET /api/self/inbox` liefert fuer `audit-red` das `subject`.

**E2E-CHECKS (`e2e/repo-worker-audit.ts`, neue Section `(RW.10)`; Fixture: ein aktives Program per Owner-Routen, eine Lane mit `programId` + `taskId` (Plantage wie `e2e/watch.ts` B-D), ein Commit in der Lane, Land per `POST /api/slots/:id/merge` (Muster `(RW.2)`), Stand-in im Modus `red` aus Schnitt 1):**
- `(RW) a red audit after a program lane's land lands in that program's inbox as audit-red, with covers, fails and the 15-line tail in the subject` — BREAKS IF: `programsForAuditRow` joint ueber `branch` allein (ein zweites Land derselben Branch-Namen wuerde falsch zugeordnet) · `writeAuditInboxEntries` fehlt an der lokalen Stelle.
- `(RW) …and no pane is pinged: auditPings[at].status is program-inbox and the quietest session's pane carries no [fleet post-land audit] line` — BREAKS IF: `tickAuditPing` kennt den Status nicht.
- `(RW) control: a red audit after a programless land is pinged as today` — BREAKS IF: der Tick ueberspringt zu viel.
- `(RW) mixed covers: one program land and one programless land in the same run write the inbox entry AND ping` — BREAKS IF: `all` wird als `addressed > 0` gerechnet.
- `(RW) remote path: a helper-reported red row reaches the same inbox` — Muster `e2e/helper-daemon.ts` (Claim + `POST /api/helper/result` mit `fails`); BREAKS IF: der zweite Aufruf in `helperResult` fehlt (I8 faengt es textuell, der Check verhaeltnismaessig).
- Der Ping-Text hat keine bestehende Sonde (siehe Schnitt 1); die Byte-Gleichheit nach der Zerlegung wird als PIN gehalten, nicht als Check: `auditPingMessage` enthaelt `auditSubjectOf(` und die zwoelf Label-Literale (`[fleet post-land audit] Unbeurteiltes Audit-Ereignis`, `Audit-Baum (Land-SHA):`, `covers:`, `result:`, `checks.ran`, `NICHTS wurde gemessen`, `Fehlgeschlagene Checks`, `Letzte bis zu 15 Zeilen`, `--- audit output ---`, `--- end audit output ---`, `Lege das Urteil ab mit POST /api/post-land-audits/adjudicate`, `verdict ∈ real|flake|stale-test|unknowable`) stehen in derselben Reihenfolge wie heute (`indexOf`-Kette).

**PINS (`RULE_INBOX` I8).** Zusaetzlich: `tickAuditPing` enthaelt `"program-inbox"`; die Loader-Liste enthaelt `"program-inbox"`; `auditPingMessage` ruft `auditSubjectOf(`.

**VERBOTE.** §0.5 woertlich; zusaetzlich: keine Self-Route fuer Adjudikation; `postLandAuditChecks`, `helperFailNames`, `remoteVerdictOf` unveraendert; `mintAuditEvents` unveraendert (Audit-Watches bleiben Laufzeit).

**KOLLISIONSFLAeCHE.** `runPostLandAudit` (Schnitt 1 zuerst) · `helperResult` (niemand sonst) · `inboxSubject` (3a-i zuerst) · `programsForAuditRow` wird von 5a wiederverwendet — wer zuerst landet, definiert die Funktion; der andere ruft sie.

**GROeSSE.** Code ~140 (Bridge 25, Writer 30, Tick 6, Loader 1, Subject 40, Pins 25) · Test ~200 (die Land-Fixture ist der teure Teil) · Docs ~30. Summe ~370.

---

## §6 Schnitt 3d — D1 · Lane-Watch-Dedupe beim Report (schliesst B-A3)

**ZIEL.** Ein Lane-Abschluss erzeugt genau EINE Zustellung an die MAIN: beim Anlegen eines Fleet-Reports wird jeder armed LANE-Watch desselben Empfaengers auf genau diese Lane entwaffnet, sodass `tickWatches` (FACT 1) kein `lane-ready`-Zwillings-Event mehr mintet.

**DONE-KRITERIUM.** `e2e/watch.ts` beweist: MAIN armt einen Lane-Watch auf die Lane, die Lane filet ihren Report, der Watch ist `armed:false` mit `lastResult`, der den Report nennt, und die Lane wird danach done-looking, ohne dass ein `lane-ready`-Event entsteht; ein `merge`-Watch derselben MAIN auf dieselbe Lane bleibt armed. Pin I9 gruen; der bestehende Pin `FleetEvent watchId is null exactly for clarification-request and fleet-report …` bleibt gruen. Verify: volle Kette §0.5, dann `./e2e-isolated.sh` als Vorschau.

**ABWEICHUNG VOM PLAN.** Der Plan sagt „der Empfaenger liegt in `openFleetReport` bereits als `bound.receiver` vor". Nach Schnitt 3b gilt das nur noch fuer programlose Lanes (`lane-watch`); fuer Program-Lanes gibt es kein `bound.receiver`. Der Empfaenger fuer die Dedupe ist dann `program.main` (Slot + `openedAt`), sofern die Bindung lebt (`programOccupancy(program) === "live"`); bei staler Bindung gibt es keinen Watch-Halter, der die Lane meint, und nichts wird entwaffnet.

**NACHTRAG 2026-09-09, gemessen an `42692a0a` (Schnitt 3b ist GELANDET) — er aendert die FORM des Blocks, nicht sein Ziel.** Der MECHANISMUS-Block unten ist gegen ein `openFleetReport` mit EINEM Ausgang geschrieben. Heute hat die Funktion ZWEI: der Program-Zweig (`if (program?.status === "active")`) legt seine Report-Zeile an, ruft `appendProgramInbox`, `saveStateNow` und **kehrt mit einem eigenen `return json({ ok: true, report, inbox: entry.id })` zurueck**; erst darunter liegt der alte Pfad mit `clarificationReceiverFor(s)`/`bound` und dem `FleetEvent`. Ein Block „am Ende, vor `saveStateNow`" traefe also nur noch den LEGACY-Pfad — und damit genau den Fall, der fuer dieses Program nicht mehr vorkommt. Vier Folgerungen, alle am Baum `42692a0a` gelesen:

1. **Der Block wird eine HELFERFUNKTION, die BEIDE Zweige aufrufen**, je unmittelbar vor ihrem eigenen `await saveStateNow()` — etwa `function disarmLaneWatchesForReport(s: Slot, holder: { slot: number; openedAt: number } | null, reportId: string): void` mit dem Schleifenkoerper von unten. Zwei Kopien desselben Blocks sind ausdruecklich NICHT gewollt: die zweite driftet.
2. **Die `holder`-Ternaere kann nicht an einer Stelle stehen**, denn `bound` existiert nur im Legacy-Zweig (`program` dagegen in beiden). Der Program-Zweig uebergibt `programOccupancy(program) === "live" ? program.main! : null`, der Legacy-Zweig `bound?.receiver ?? null`.
3. **Es gibt heute DREI Basen, nicht zwei:** `program` · die gebundene (`bound.basis`) · und `owner-inbox` (Lane ohne Program, ohne Watch-Beleg, mit `taskId` — `bound` ist dann `null`). `owner-inbox` hat per Konstruktion keinen Watch-Halter, es wird dort nichts entwaffnet; das gehoert als KONTROLLE in die Checkliste (`dedupe control: an owner-inbox report disarms nothing`), nicht als Sonderfall in den Block.
4. **Anker-Korrekturen:** `watchKind` ist NICHT in `server.ts` definiert, sondern in `server/types.ts:233` und dort importiert — der Pin I9 bleibt trotzdem ein Text-Pin auf `openFleetReport`. Die 3b-Checks, neben die deine gehoeren, heissen im Baum `Q3 fleet-report …` (`e2e/watch.ts:2867` Program-Zweig, `:2024` Legacy-Zweig; die `inactive program`-Kontrolle bei `:3132`), nicht „Section B-D". Eine Dedupe existiert noch nicht: `rg -n watch_superseded server.ts e2e/` ist leer.

**DATEIEN.** `server.ts#openFleetReport` (beide Zweige, nach `fleetReports = [...]`) · `server.ts#dropWatchesFor` (Muster fuer Entwaffnung mit `lastResult` + `audit("watch_skip", …)`) · `server.ts#pruneSpentWatches` · `server.ts#watchKind` · `e2e/watch.ts` (Section B-D; Fixture fuer done-looking: `rg -n 'laneWatchSignal|done-looking' e2e/watch.ts`) · `e2e/pins.ts` (I9) · `docs/self-api.md` §watch (Absatz: ein Watch auf eine Lane, die selbst berichtet, wird entwaffnet — kein Timer, kein Poll).

**MECHANISMUS.** In `openFleetReport`, nach dem Anlegen der Report-Zeile und VOR `saveStateNow`:

```ts
// ONE delivery per lane end. A lane that files its own terminal report makes the server
// predicate about it (lane-ready) redundant for the same receiver: disarm that receiver's armed
// LANE watches on exactly this lane, with the reason attached, so FACT 1 never mints the twin.
// Merge watches stay: a land is a different fact from a report.
const holder = report.basis === "program"
  ? (programOccupancy(program) === "live" ? program.main! : null)
  : bound?.receiver ?? null;
if (holder) {
  for (const w of watches) {
    if (!w.armed || watchKind(w) !== "lane" || !("target" in w) || w.target !== s.id
      || w.targetCwd !== s.cwd || w.targetBranch !== s.worktree!.branch
      || w.slot !== holder.slot || w.slotOpenedAt !== holder.openedAt) continue;
    w.armed = false;
    w.lastResult = `the lane filed its own fleet-report ${id} — this watch is redundant and will not fire`;
    audit("watch_superseded", w.slot, `${w.id} report=${id} lane=${s.id}`);
    pruneSpentWatches(w.slot);
  }
}
```

Legacy-Watches (`slotOpenedAt === undefined`) werden nicht angefasst (unattribuiert). `firedAt` bleibt `null` (der Watch hat nicht gefeuert). Der Owner sieht den Grund in `GET /api/self` und im Poll (`watches`).

**ROUTEN.** Keine.

**E2E-CHECKS (`e2e/watch.ts`, Section B-D, nach den 3b-Checks):**
- `dedupe: the MAIN's armed lane watch on a lane that files its report is disarmed with the report id, and no lane-ready twin is minted when the lane later looks done` — Lane idle + ahead>0 herstellen (bestehende done-looking-Fixture), zwei Ticks warten, `GET /api/self` der MAIN: Events enthalten kein `lane-ready` fuer diesen `subjectSlot`. BREAKS IF: der Dedupe-Block fehlt (Zwilling erscheint) · er vergleicht `slot` ohne `slotOpenedAt` (ein Vormieter-Watch wuerde entwaffnet).
- `dedupe control: a merge watch of the same MAIN on the same lane stays armed, and a lane watch of a FOREIGN session stays armed` — BREAKS IF: `watchKind(w) === "lane"` fehlt · der Halter-Vergleich fehlt.
- `dedupe programless lane: the lane-watch receiver's own watch is disarmed the same way` — BREAKS IF: nur der Program-Zweig entwaffnet.
- `dedupe budget: after the report the receiver's armedReservations dropped by one and deliveryDebts is unchanged` (ueber `programReturnPath` in `GET /api/programs` oder `/api/sessions` `watches`). BREAKS IF: `pruneSpentWatches` fehlt (kein Verhaltensfehler, aber der Spent-Tail waechst — als Detail im Check).

**PINS (`RULE_INBOX` I9).** `openFleetReport` enthaelt `watchKind(w) === "lane"` und `watch_superseded`, nicht `watchKind(w) === "merge"`; `w.firedAt` wird im Block NICHT gesetzt.

**VERBOTE.** §0.5 woertlich; zusaetzlich: `tickWatches` unveraendert (die Dedupe sitzt beim Schreiber, nicht im Tick); Merge-/Audit-/Deploy-/Job-/Transition-Watches unberuehrt; `dropWatchesFor` unveraendert.

**KOLLISIONSFLAeCHE.** `openFleetReport` (3b zuerst; ideal: 3d als zweiter Commit derselben Lane wie 3b) · `e2e/watch.ts` Section B-D (3b zuerst).

**GROeSSE.** Code ~35 (Block 18, Pin 12, Doc 5) · Test ~90. Summe ~125.

---

## §7 Schnitt 4 — D3 · Handoff am Program statt in git (schliesst B3-S; ohne Game-Maker)

**ZIEL.** Eine Standard-Program-MAIN uebergibt ueber `POST /api/self/handoff` in `Program.handoff`; das Succession-Gate akzeptiert einen frischen Program-Handoff ohne git-Commit; der Gruendungsbrief der Nachfolgerin rendert ihn mit Alter und Autorin; Game-Maker-Programs bleiben beim committeten Checkpoint, Sessions ohne Program bei `HANDOFF.md`.

**DONE-KRITERIUM.** `e2e/programs.ts` beweist: Succession einer gebundenen Standard-MAIN ohne neuen `HANDOFF.md`-Commit gelingt mit frischem Program-Handoff, der Brief traegt Text, Alter und Autorin; ein Handoff mit `at < openedAt` oder fremdem `by` ist 409; nach einem Restore ohne `openedAt` ist derselbe Handoff 409 (fail-closed); die bestehenden Game-Maker- und Supervisor-Successions-Checks bleiben gruen. Pins I10, I11 gruen. Verify: volle Kette §0.5, dann `./e2e-isolated.sh` als Vorschau.

**ABWEICHUNG VOM PLAN.** Der Plan sagt „das Succession-Gate prueft `handoff.at > session.openedAt` STATT Commit juenger als die Session". Im Code steht der git-Gate-Await (`await handoffCommittedAfterOpen(s)`) VOR der Bindungs-Klassifikation, und `e2e/pins.ts` pinnt diese Reihenfolge (`RULE_GM_FOUNDING — self succession captures the exact occupant before its first await and revalidates after HANDOFF before classification`). Der Await bleibt also, wo er ist; nur die REFUSAL wandert hinter die Klassifikation und wird `if (!handoffReady && !programHandoffFresh)`. Damit gilt: Standard-Program-MAIN ⇒ Program-Handoff ODER git reicht; Game-Maker ⇒ git-Gate + Checkpoint wie heute; generisch/Supervisor ⇒ git-Gate wie heute. „Statt" wird „oder", weil der Pin die Reihenfolge haelt und weil eine MAIN, die gewohnheitsmaessig committet, nicht ploetzlich 409 sehen darf.

**DATEIEN.** `server/types.ts` (`ProgramHandoff`, `MAX_PROGRAM_HANDOFF`, `loadProgramHandoff`, `Program.handoff?`, Exporte) · `server.ts` Program-Hydration (`handoff` neben `inbox`) · `server.ts#handleSelfSucceed` (Anker `if (!handoffReady)` und `const bound = programs.filter`) · `server.ts#buildProgramMainSuccessionBrief` (Standard-Zweig, Schritt `3. Read only the top HANDOFF.md section.`) · `server.ts#migrateMessage` (`(1) HANDOFF.md schreiben UND committen`) · Self-Dispatcher (Route neben `/api/self/succeed`) · `e2e/programs.ts` (Succession-Fixture, Anker `Program-MAIN succession success setup`) · `e2e/pins.ts` (`RULE_HANDOFF` I10/I11) · `docs/self-api.md` §succeed (Absatz) + neuer §handoff · Rulebook: der Absatz „`POST /api/self/succeed` — Erst `HANDOFF.md` schreiben UND committen" in `CLAUDE.md` ist GENERIERT aus `rulebook/` (gitignored, nicht in der Lane) — den neuen Wortlaut im Fleet-Report als Text melden, nicht editieren.

**TYPEN.** §0.2 (`ProgramHandoff`, Loader). Hydration wie `inbox` (§0.3, `program_handoff_unreadable`).

**MECHANISMUS.**
- **Route `POST /api/self/handoff`** (Form §0.4): Lane ⇒ 409 `a lane lands — it does not hand over`; `boundProgramForMain(s)` ⇒ sonst 409 mit dessen Satz; `isGameMaker(program)` ⇒ 409 (Satz §0.4); Body genau `{text}`; `program.handoff = { v: 1, text, at: Date.now(), by: { slot: s.id, openedAt: s.openedAt, sessionId: s.sessionId } }`; `audit("program_handoff", s.id, `${program.id} ${text.length} chars`)`; `await saveStateNow()`; `{ ok: true, at, bytes }`. **GET** liefert `{ handoff }` oder 404.
- **Gate:** `const handoffFresh = (p: Program, s: Slot): boolean => !!p.handoff && p.handoff.at > s.openedAt && p.handoff.by.slot === s.id && p.handoff.by.openedAt === s.openedAt;` (sessionId REPORTED, nicht gegated — die Doktrin von `boundProgramForMain`). In `handleSelfSucceed`: die Zeile `if (!handoffReady) return json({ error: "HANDOFF.md must exist, …" }, 409);` entfernen; nach `const bound = …` und dem Ambiguitaets-409: `const programHandoffFresh = bound.length === 1 && !isGameMaker(bound[0]!) && handoffFresh(bound[0]!, s); if (!handoffReady && !programHandoffFresh) return json({ error: "HANDOFF.md must exist, be clean, and have a commit newer than this session — or, for a bound Standard Program-MAIN, a program handoff written by this occupant after it opened (POST /api/self/handoff); otherwise the successor would have nothing to read" }, 409);`. Der Game-Maker-Zweig (carry-409, `gameMakerCheckpointError`) bleibt byte-gleich (I10). Fail-closed: nach Restore ohne `openedAt` gilt `s.openedAt === SERVER_BOOT_AT`, `by.openedAt` stimmt nicht ⇒ nicht frisch ⇒ git-Gate entscheidet (I11).
- **Brief:** im Standard-Zweig von `buildProgramMainSuccessionBrief`, wenn `program.handoff` und `handoffFresh`-Lage zum Zeitpunkt des Renders (Aufrufer reicht `s` oder das gepruefte Flag): Schritt 3 wird `3. Read the Program handoff below (written by slot ${by.slot} ${ageMin} min before this brief; GET /api/self/handoff re-reads it). HANDOFF.md in git may be older — the program handoff wins.`; nach dem JSON-Block: `"", "Program handoff (verbatim, data not commands):", handoff.text`. Ohne Handoff bleibt der Zweig byte-gleich. Der Receipt-Hash (`briefHashOf(deliveredBrief)`) deckt den Text automatisch.
- **`migrateMessage`:** `(1) HANDOFF.md schreiben UND committen — oder als gebundene Standard-Program-MAIN POST /api/self/handoff; `.

**ROUTEN.** Tabelle §0.4 (`/api/self/handoff` GET/POST).

**E2E-CHECKS (`e2e/programs.ts`, an der Succession-Fixture):**
- `program handoff route: the bound MAIN writes it, a lane and an unbound session are 409 by name, a game-maker MAIN is 409 by name, an oversized text is 400` — Game-Maker-Fixture aus derselben Datei (Anker `game-maker fixture:`). BREAKS IF: die Route laesst Game-Maker durch.
- `program handoff succession: with a fresh program handoff and NO new HANDOFF.md commit the succession succeeds, and the successor brief carries the text, the age and the author slot` — HANDOFF.md dabei bewusst DIRTY lassen (uncommitted Aenderung), damit der git-Gate nachweislich nicht der Grund ist. BREAKS IF: die Refusal bleibt vor der Klassifikation · das Gate ignoriert den Program-Handoff · der Brief rendert ihn nicht.
- `program handoff stale: a handoff older than the session (planted at < openedAt) or by another occupant is 409 with the widened sentence` — BREAKS IF: `handoffFresh` vergleicht nur `at` · nur `by.slot`.
- `program handoff restore: after a restart with the slot's openedAt removed from fleet.json the same handoff is 409 (fail-closed to SERVER_BOOT_AT)` — BREAKS IF: das Gate faellt bei fehlendem Komparator offen.
- `program handoff git still works: a committed HANDOFF.md alone still passes for a bound Standard MAIN` — Kontrolle gegen „statt". BREAKS IF: `handoffReady` wird ignoriert.
- Bestehende Checks `Program-MAIN Fleet succession: …`, `game-maker …`, `Supervisor succession …` bleiben gruen — im Commit-Body nennen.

**PINS (`RULE_HANDOFF` I10, I11).** Zusaetzlich: die widened Refusal steht textuell NACH `const bound = programs.filter` und der bestehende Pin `… revalidates after HANDOFF before classification` bleibt gruen; `buildProgramMainSuccessionBrief` enthaelt `Program handoff (verbatim, data not commands):`.

**VERBOTE.** §0.5 woertlich; zusaetzlich: `gameMakerCheckpointError`, `readGameCheckpoint`, `gameMakerSuccessionSteps` unveraendert; `succeedSupervisor`, `buildSuccessionBrief`, `buildSupervisorSuccessionBrief` unveraendert; `handoffCommittedAfterOpen` unveraendert; keine Migration von `HANDOFF.md`-Inhalten in das Feld.

**KOLLISIONSFLAeCHE.** `server/types.ts#Program` und die Hydration (3a-i zuerst) · Self-Dispatcher (3a-i, 3b zuerst) · `handleSelfSucceed` (niemand sonst).

**GROeSSE.** Code ~175 (Typen+Loader 45, Hydration 10, Route 55, Gate 15, Brief 20, migrate 2, Pins 30) · Test ~170 · Docs ~50. Summe ~395.

---

## §8 Schnitt 5 — D4 Rest: Adjudikations-Actor, `paneModel`, Dispatch-Env (schliesst B-A8, B-A6, B-A7)

Drei unabhaengige Unterbriefe, jeder allein landbar. 5b haengt an einer MESSUNG, die die Lane nicht selbst machen kann (siehe dort).

### §8-a Schnitt 5a — Adjudikations-Actor gemessen

**ZIEL.** Jede Adjudikationszeile traegt `actor` (`kind:"owner"`, `via: cookie|bearer|query`, `suspect?`), gemessen aus dem Token-Kanal wie `ownerLandActor` auf dem Land-Pfad.

**DONE-KRITERIUM.** Ein e2e-Check beweist `actor.via === "bearer"` fuer einen Bearer-POST und `"cookie"` fuer einen Cookie-POST, `suspect` genau dann, wenn ein Cover des beurteilten Audits ein aktives Program mit lebender MAIN nennt und `via !== "cookie"`; Pin I14 gruen. Verify: volle Kette §0.5, dann `./e2e-isolated.sh` als Vorschau.

**DATEIEN.** `server.ts#writeAuditAdjudication` (Signatur, `rec`) · sein Aufrufer (Anker `url.pathname === "/api/post-land-audits/adjudicate"`) · `server.ts#adjudicationsByAudit` (Loader: `actor` via `loadLandActor` nur bei vorhandenem Key) · `server.ts#AuditAdjudication` (Feld) · `server.ts#tokenChannel`, `#ownerLandActor` (Muster), `#programsForAuditRow` (aus 3c; wenn 3c noch nicht gelandet ist: hier definieren, gleicher Name, gleiche Signatur) · `e2e/outcomes.ts` (Anker `client: the dossier flags an un-adjudicated red tier-2 audit`) oder `e2e/security.ts` (wo Adjudikation heute geprueft wird: `rg -n 'adjudicate' e2e/*.ts`) · `e2e/pins.ts` (`RULE_ACTOR`) · `docs/self-api.md` (Absatz bei „Aktor-Provenienz").

**MECHANISMUS.** `writeAuditAdjudication(body, req)`: `const via = tokenChannel(req) ?? "cookie"; const byProgram = await programsForAuditRow(target as PostLandAuditRow); const ambient = via !== "cookie" && [...byProgram.keys()].some((id) => { const p = programs.find((x) => x.id === id); return !!p && p.status === "active" && programOccupancy(p) === "live"; }); const actor: LandActor = ambient ? { kind: "owner", via, suspect: "owner-token-outside-board" } : { kind: "owner", via }; rec = { …, by: "owner", actor, … }`; Audit-Zeile um `landActorDetail(actor)` ergaenzen; bei `suspect` zusaetzlich `audit("owner_token_ambient_use", …)` in der Form des Land-Pfads (`rg -n 'owner_token_ambient_use' server.ts`).

**E2E-CHECKS.** `adjudication actor: a bearer adjudication records via bearer, a cookie one via cookie, and a bearer verdict on a program-covered audit with a live MAIN is suspect` — Cookie-Request per `headers: { cookie: `fleet=${TOKEN}` }` (das ist, was `tokenChannel` liest: `/(?:^|;\s*)fleet=([^;]+)/`; die Owner-Cookie-Form liefert `e2e/auth.ts` (Check `login URL sets cookie + redirects`, `set-cookie` der Login-URL), die Header-Form `headers: { cookie: … }` steht in `e2e/intake.ts`). BREAKS IF: `via` fest „cookie" · `suspect` ohne Live-Pruefung.
`adjudication loader: a historical row without actor loads without one, never as cookie` — BREAKS IF: der Loader stempelt einen Default.

**PINS (`RULE_ACTOR` I14).** `writeAuditAdjudication(` hat den Parameter `req: Request` und enthaelt `tokenChannel(req)`; `adjudicationsByAudit` enthaelt `loadLandActor(`; `by: "owner"` bleibt im Body.

**VERBOTE/KOLLISION/GROeSSE.** §0.5; `ownerLandActor` unveraendert. Kollision: `programsForAuditRow` mit 3c (Namensgleichheit vereinbart). ~60 Code + ~50 Test.

### §8-b Schnitt 5b — `paneModel` als Ruecklese und `push` an der Model-Route

**VORAUSSETZUNG (blockierend).** Der Plan sagt „der git-Tick liest das Modell aus dem Footer der Pane (dort steht es)". Am Code ist das NICHT belegbar: `tickGit` liest keinen Pane-Text, `paneAgentAt` liest `ps`, `paneReadiness` liest `capture-pane` nur fuer Harnesses mit `readiness`-Deklaration; kein Symbol in `server.ts` parst ein Modell aus einem Screen (GLM-Gegencheck, gezielte Suche). Ob und wie die claude-Pane das Modell im Footer zeigt, ist eine Messung an einer LEBENDEN Pane, die ein Codex-Worker in einer Lane nicht machen darf (Live-tmux ist gemeinsame Realitaet). Der Brief braucht als Eingabe EINE Zeile: das Footer-Muster (eine `capture-pane`-Zeile einer claude-Pane, Modellname durch `<model>` ersetzt). Fehlt sie: Report `needs-main` mit genau dieser Frage, kein Code.

**MESSUNG NACHGELIEFERT (Controller Slot 6, 2026-09-04 20:2x, `tmux -L claudefleet capture-pane -p -t s<N>`,
zweitletzte nicht-leere Zeile, Mehrfach-Leerzeichen auf drei gekuerzt).** Vier lebende claude-Panes
(Slots 1, 3, 7, 11) zeigen dasselbe Muster, drei Felder mit `  |  ` getrennt, davor zwei Leerzeichen:
```
  main  |  ctx [##--------] 25%  |  Opus 5 (1M context)   /rc
  main  |  ctx [###-------] 31%  |  Opus 5 (1M context)   new task? /clear to save 306.7k tokens
  fleet/260904163327-dcac  |  ctx [###-------] 38%  |  Opus 5 (1M context)   /rc
```
Frueher am Tag an weiteren Panes gesehen: `  fleet/260904181121-2f70  |  ctx [#---------] 10%  |  Fable 5.1`
und `  main  |  ctx [----------] --%  |  Fable 5` (Slot 15, `--%` heisst „nicht messbar", NICHT null Prozent).
Der Modellname ist das DRITTE Feld bis zum naechsten Lauf von drei oder mehr Leerzeichen; der
Klammerzusatz `(1M context)` gehoert zum Namen. Daraus folgt fuer `modelFooter`: eine Zeile, die mit
`  ` beginnt, Feld 1 = Branch, Feld 2 = `ctx [...] NN%` oder `--%`, Feld 3 = Modellname; Capture-Gruppe
auf Feld 3 bis zum Drei-Leerzeichen-Lauf oder Zeilenende. Die Pane einer pi-zai-Lane zeigt STATTDESSEN
eine Statuszeile der Form `↑94k ↓30k R2.8M CH98.9% 9.4%/1.0M (auto)   glm-5.3 •` — der Modellname steht
dort am Zeilenende vor dem `•`; ein zweites Muster, das dieser Schnitt NICHT abdecken muss (claude-only),
das der Adapter aber deklarieren koennte. Der Effort steht in KEINEM Footer (bekannt, Regelbuch).
Damit ist die Voraussetzung erfuellt; 5b ist nicht mehr needs-main.

**ZIEL.** Der Server traegt je Slot einen SENSOR `paneModel` (Lesung, nicht Zustand) und die Owner-Route `POST /api/slots/:id/model` kann optional `/model <id>` in die Pane schicken und stempelt `modelPushedAt`.

**DONE-KRITERIUM.** `e2e/programs.ts` (oder `e2e/slots.ts`) beweist per `plantScreen` mit einer Footer-Zeile nach dem Muster, dass `/api/sessions` `paneModel` mit dem gepflanzten Wert traegt, ohne Muster `null` bleibt; `push:true` schreibt genau eine `/model <id>`-Zeile in die Pane und `modelPushedAt`; Default-Body bleibt byte-gleich (bestehende `./e2e-claude-gate.sh`-Checks gruen). Verify: volle Kette §0.5 (enthaelt `./e2e-claude-gate.sh`), dann `./e2e-isolated.sh` als Vorschau.

**DATEIEN.** `server.ts#Harness` (Anker `readiness?: { accept: RegExp; …}`: neues optionales Feld `modelFooter?: RegExp` mit EINER Capture-Gruppe; nur am claude-Adapter gesetzt, nach der Messung) · `server.ts#tickGit` (nach `agentInfo.set`: fuer Harnesses mit `modelFooter` hoechstens alle 30 s je Slot `capture-pane -p` und Regex ⇒ `paneModelInfo: Map<number, { model: string | null; at: number }>`, Prozess-Map wie `gitInfo`, NICHT persistiert) · `/api/sessions`-Zeile je Slot (`paneModel` weggelassen bei null — 12-KiB-Budget) · die Model-Route (Anker `if (slotMatch[2] === "model")`: `push?: boolean`; `canDeliver(s, { now, idleMs: 0, harness: false })`, `sendText(s, `/model ${s.model}`, true)`, `modelPushedAt` in derselben Prozess-Map, Audit `slot_model_push`) · `e2e/harness.ts#plantScreen` (Fixture) · `e2e/pins.ts` (Pin: die Route liest `push` nur als Boolean und der Default-Pfad enthaelt kein `sendText`) · `docs/self-api.md` §model.

**RISIKO (GLM, hier als Verbot).** `/model` per `sendText` in die Pane eines laufenden Agenten ist kein definiertes Befehlsinterface; der Agent kann die Zeile als Benutzereingabe lesen. Darum: `push` ist opt-in, laeuft nur durch `canDeliver` (Composer leer, Agent alive), und der Default bleibt byte-gleich. Kein Tick schickt je `/model`.

**E2E-CHECKS.** `paneModel sensor: a planted footer line yields paneModel on /api/sessions, a screen without it yields no field` (BREAKS IF: Regex-Gruppe falsch · Feld bei null als `null` statt weggelassen) · `model push: push:true types exactly one /model line and stamps modelPushedAt; without push the pane is untouched` (BREAKS IF: Default schickt · doppelte Zeile) · `model push held: an occupied composer is 409 by name and stamps nothing`.

**GROeSSE.** ~90 Code + ~80 Test — nach Vorliegen des Musters.

### §8-c Schnitt 5c — `FLEET_DISPATCH_MAX_LANES_PER_PROGRAM=1` in der srv-Spawn-Zeile

**ZIEL.** Der Program-Deckel wird zum ersten Mal bindend: `watchdog.sh` setzt `FLEET_DISPATCH_MAX_LANES_PER_PROGRAM=1` neben `FLEET_DISPATCH_MAX_LANES=2`; der Poll zeigt den Wert.

**DONE-KRITERIUM.** `bun e2e/pins.ts` haelt: die srv-Spawn-Zeile (`spawnLine` im Pin `watchdog.sh yields a VERIFY_CMD, an AUDIT_CMD and an srv-spawn line`) enthaelt `FLEET_DISPATCH_MAX_LANES_PER_PROGRAM=1` und der Wert ist ≤ dem von `FLEET_DISPATCH_MAX_LANES`; `/api/sessions` traegt `dispatch.maxLanesPerProgram` und `e2e/tasks.ts` beweist die Weglass-/Budgetregel nicht verletzt. Verify: volle Kette §0.5 (`watchdog.sh` und `server.ts` angefasst; kein e2e-Lifecycle ⇒ Vorschau optional).

**ABWEICHUNG VOM PLAN.** Der Plan nennt „Verify per `./state.sh`" — `state.sh` zeigt keinen Dispatch-Deckel (`rg -n 'DISPATCH' state.sh` leer). Die pruefbare Flaeche ist der Pin plus das Poll-Feld. Und: der Plan sagt „plus `launchctl kickstart`" — das ist ein Deploy-Akt ausserhalb des Worktrees (launchd ist gemeinsame Realitaet, `CLAUDE.md` §Lane discipline); die Lane landet die Zeile und MELDET im Fleet-Report, dass der Watchdog neu gestartet werden muss (Rulebook-Fragment `deploy`, im Quell-Checkout lesbar). Kein `launchctl` aus der Lane.

**DATEIEN.** `watchdog.sh` (die `exec bun server.ts`-Zeile) · `server.ts` `/api/sessions` (`dispatch: { available, on, maxLanes, repo }` ⇒ `+ maxLanesPerProgram: DISPATCH_MAX_LANES_PER_PROGRAM`) · `e2e/pins.ts` (neben dem watchdog-Pin) · `e2e/tasks.ts` (Payload-Budget-Check lesen, ggf. Erwartung anpassen) · `docs/self-api.md` §dispatch (ein Satz) · `docs/attic/`-Notiz nicht noetig.

**E2E/PINS.** Pin: `spawnLine.includes("FLEET_DISPATCH_MAX_LANES_PER_PROGRAM=1")` und `Number(per) <= Number(repo)`; Check in `e2e/tasks.ts`: `dispatch.maxLanesPerProgram` ist eine Zahl ≥ 1 (der isolierte Server laeuft ohne die Env ⇒ Default `= maxLanes`; BREAKS IF: das Feld fehlt). Verhalten des Deckels ist in `tickDispatch` schon gebaut („inert until smaller") — kein neuer Verhaltens-Check.

**GROeSSE.** ~8 Code + ~15 Test/Pin.

---

## §9 Reihenfolge, Kollisionsmatrix, Summen, Abweichungen

**Reihenfolge (Plan §3, bestaetigt):** 1 ∥ 2 → 3a-i → 3a-ii → 3b → 3d → 3c → 4 → 5a/5b/5c (die drei unabhaengig, jederzeit). 3b/3c/3d sind untereinander parallel moeglich, aber alle drei beruehren `openFleetReport` bzw. den Audit-Pfad — im Zweifel seriell: 3b, dann 3d (gern in derselben Lane als zweiter Commit), dann 3c.

| Symbol / Datei | Schnitte, die es anfassen | Regel |
|---|---|---|
| `runPostLandAudit` | 1, 3c | 1 zuerst |
| `programExecutionView` | 2, 3a-i | 2 zuerst |
| `server/types.ts#Program` + Hydration | 3a-i, 4 | 3a-i zuerst |
| Self-Dispatcher (`/api/self/*`) | 3a-i, 4 | seriell, je eigener Block |
| `openFleetReport` | 3b, 3d | 3b zuerst |
| `e2e/watch.ts` Section B-D / D2 | 3b, 3d | 3b zuerst |
| `teardownSlotOccupant` / `dropWatchesFor` / `reconcileAttention` | 3a-ii | allein |
| `programsForAuditRow` | 3c, 5a | wer zuerst landet, definiert; gleicher Name |
| `inboxSubject` | 3a-i (attention, report), 3c (audit) | 3a-i zuerst |
| `handleSelfSucceed` | 4 | allein |
| `e2e/pins.ts` | alle | je Schnitt ein eigener Block am Ende; Rebase-Konflikte sind trivial (Append) |
| `docs/self-api.md` | 3a-i, 3a-ii, 3b, 3c, 3d, 4, 5a, 5c | je eigener Abschnitt/Absatz; Pin B3 verlangt `## fleet-report` und `## tasks` weiterhin |

**Geschaetzte Diff-Groessen (Code+Test+Docs):** 1: ~135 · 2: ~270 · 3a-i: ~440 · 3a-ii: ~400 · 3b: ~370 · 3c: ~370 · 3d: ~125 · 4: ~395 · 5a: ~110 · 5b: ~170 (nach Messung) · 5c: ~25. **Summe ~2 810 Zeilen** in elf Lanes (Plan: acht Schnitte; 3a und 5 sind hier geteilt, weil sie sonst die ~400-Zeilen-Grenze reissen bzw. eine blockierende Messung enthalten).

**ABWEICHUNGEN VOM PLAN (je ein Satz, Sammelliste fuer den Fleet-Report):**
1. §2: `occupancy` heisst `live|stale|unbound` (Code-Vokabular von `programOccupancy`), nicht `bound|stale|none`.
2. §2: `inbox {unread, oldestAt}` kann in Schnitt 2 nicht projiziert werden (Feld entsteht in 3a-i) und wird dort ergaenzt.
3. §2: `deploy {codeBehind}` ist ein Fleet-Checkout-Fakt (`deployGap`/`deployFacts`), kein Program-Fakt; nur fuer Lands in diesem Checkout, sonst `null`.
4. §3: Schnitt 3a ist zweigeteilt (Datenmodell/Routen · Attention-Writer/Nudge), weil er sonst ~750 Zeilen traegt und die `e2e/attention.ts`-Familie umbaut.
5. §4: die Autoclose-Autoritaet eines Program-Reports wird aus `Program.lineage` gelesen (persistierte Autoritaetsgeschichte), nicht aus einer Live-Bindung, weil der Tick nach der Succession der entscheidenden MAIN laufen kann.
6. §5: die Bruecke `covers[].branch → Program` ist das Outcome-Ledger (`branch`+`mainAfter`+`programId`), nicht `Task` — `Task` traegt keinen Branch.
7. §5: der Plan oeffnet der MAIN keine Adjudikations-Tuer; die Owner-Route bleibt, der Inbox-Eintrag sagt es.
8. §6: nach 3b gibt es fuer Program-Lanes kein `bound.receiver`; der Dedupe-Halter ist `program.main` bei lebender Bindung.
9. §7: das Handoff-Gate wird „git ODER Program-Handoff", nicht „statt" — der bestehende Pin haelt die Await-Reihenfolge, und eine committende MAIN darf nicht 409 sehen.
10. §8-b: die Footer-Ruecklese ist am Code nicht belegbar; der Schnitt braucht als Eingabe das gemessene Footer-Muster einer lebenden claude-Pane.
11. §8-c: `./state.sh` zeigt keinen Dispatch-Deckel; Verify ist Pin + Poll-Feld; `launchctl kickstart` ist ein Deploy-Akt ausserhalb der Lane und wird gemeldet, nicht ausgefuehrt.
12. §0.2: `PostLandAuditRow` lebt in `server.ts`, nicht in `server/types.ts` (Zieldatei des Briefs korrigiert).

**Was nicht geprueft wurde.** Keine Suite lief (Docs-Lane, Verify `bun e2e/pins.ts`); `src/client.ts` nur per Symbolsuche gestreift (Badge-Fallunterscheidungen fuer `basis` sind eine Aufgabe im Brief 3b, nicht hier belegt); die Ledger sind gitignored und in dieser Lane nicht lesbar — alle Zahlen stammen aus den Grundlagen-Notizen; der Live-Footer einer claude-Pane wurde nicht angesehen (§8-b); `docs/verify-tiering.md` und `docs/self-api.md` wurden nur an den zitierten Ankern gelesen.
