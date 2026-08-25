# Autonomie-Tueren im Release-Land-Audit-Deploy-Kreis (2026-08-25)

Untersuchter Baum: `fe2776444fc688c508dddb82a3ef25a305f9b673`.

Die Abstraktion eines autonomen Kreises soll existieren: Release, Ausfuehrung, Integration,
integrierter Nachweis und Live-Schaltung sind verschiedene Akte mit verschiedenen Autoritaets- und
Fehlergrenzen; ohne eine explizite Tuerkarte liest sich eine vorhandene Route faelschlich wie ein
geschlossener Kreis.

## Ergebnis

Im untersuchten Schnitt bleiben **23 gruppierte Tueren**: **13 A**, **7 B**, **3 C**. Eine
gruppierte Tuer kann mehrere woertliche Ablehnungen derselben Autoritaets- oder
Wiederherstellungsklasse tragen; die vollstaendige Einzelstellen-Liste steht weiter unten.

- **A — by-design Owner-Tuer:** Identitaet, Program-/Repo-Grenze, Freigabe, Promotion,
  Konfigurations- oder irreversible Urteilsgrenze. Diese Tuer darf nicht durch einen Tick
  verschwinden; fuer Autonomie braucht sie eine ausdrueckliche Owner-Promotion.
- **B — mechanische Luecke:** Die Entscheidung ist bereits gefallen oder gar keine
  Geschmacksentscheidung; ein enger, gebundener Mechanismus koennte fortsetzen, wiederholen oder
  einen Reparaturakt erzeugen, ohne eine Invariante zu lockern.
- **C — verwaiste Tuer:** Route/Watch/Verb existiert, aber keine autonome Akteursklasse zieht sie im
  heutigen Vertrag.

Der aktuelle Symbolname fuer den im Auftrag genannten `handleSelfRelease` ist
`releaseTaskForMain` (`server.ts:6425`); die Self-Route ruft ihn bei `server.ts:18744-18751`.

## Der belegte Kreis

| Abschnitt | Belegter Uebergang | Wer handelt heute? |
|---|---|---|
| Release | `releaseTaskForMain` schreibt nur `pending -> queued`; die Antwort ist ein Queue-Fakt (`server.ts:6409-6418`, `server.ts:6485-6493`). | gebundene MAIN |
| Dispatch | Ein Timer ruft allein `tickDispatch()` (`server.ts:16476`); der Tick nimmt nur `auftrag + queued` (`server.ts:8127-8134`). | Maschine, sofern die Owner-Schalter offen sind |
| Lane-Ende | Jeder mutierende Brief verlangt Commit, genau einen Fleet-Report und Idle (`server.ts:7418-7451`). | Worker |
| Signal | `done-looking` ist `alive + idle + kein git op + kein blockierter Merge + clean + ahead>0` (`lane-signals.ts:48-62`). Der Tick startet nur den beratenden Reviewer (`server.ts:9742-9745`, `server.ts:9798-9823`) bzw. liefert einen vorher registrierten Watch (`server.ts:10128-10135`, `server.ts:10198-10223`). | Maschine signalisiert; MAIN urteilt |
| Self-Land | `selfLandTaskForMain` ist ausdruecklich **kein** Tick-Auto-Land (`server.ts:6564-6567`). `ast-grep` findet genau einen Caller: die MAIN-Self-Route (`server.ts:18759-18768`). Der MAIN-Brief fordert Diff-Pruefung, Land-Aufruf, Merge-Watch und danach Audit-Watch (`server.ts:14702-14712`). | MAIN, nur mit Owner-Promotion |
| Land -> Audit | `recordLand` plant synchron den Audit (`server.ts:11329-11335`); `schedulePostLandAudit` startet den Drain oder koalesziert (`server.ts:11532-11542`). | Maschine |
| Audit -> Deploy | Der Audit schreibt und signalisiert nur einen Fakt; nichts liest das Ergebnis fuer Land, Dispatch oder Deploy (`server.ts:11385-11392`). Deploy ist laut Quellvertrag an keine Automation verdrahtet (`server.ts:17444-17453`). | heute kein autonomer End-to-End-Akteur |
| Deploy | `ast-grep` findet genau zwei `deployVerb`-Caller: Steward-Route (`server.ts:18136-18140`) und Owner-Route (`server.ts:19469-19473`). | Owner real; Steward technisch berechtigt, vertraglich stillgelegt |

`dispatchTask` selbst ist nicht die Verluststelle: der Gruendungsabschnitt sagt fuer Fehler
ausdruecklich „Never rejects — every failure requeues“ (`server.ts:7360-7363`).

## Live-Stand dieser Deployment-Instanz

| Fakt | Beobachtung am 2026-08-25 | Konsequenz |
|---|---|---|
| Dispatcher-Repo | `watchdog.sh:124`, `watchdog.sh:148` setzen `FLEET_DISPATCH_REPO`. | Konfigurationshaelfte von D04 ist live offen. |
| Fremdharness-Automation | `watchdog.sh:138`, `watchdog.sh:148` setzen `FLEET_HARNESS_AUTOMATION=1`. | Globaler Schalter von D06 ist live offen; der Adapter muss trotzdem `automatable:true` tragen. |
| Analyse | `watchdog.sh:148` setzt `FLEET_ANALYSIS_MS=0`. | Die Analyse-Wartezeilen in `tickDispatch` sind live nicht aktiv. |
| Clean-Review | `watchdog.sh:148` setzt `FLEET_CLEAN_REVIEW=off`. | D23 existiert im Code, ist live **not-applicable**. |
| Tier-2-Audit | `watchdog.sh:148` setzt `FLEET_POSTLAND_AUDIT_CMD`; `GET /api/self/gate` meldete `postlandAudit:true`. | D13 ist live offen. |
| Red-Audit-Ping | `watchdog.sh:148` setzt `FLEET_AUDIT_PING_MS=60000`. | D15 ist live aktiv, einschliesslich der falschen Empfaenger-/Autoritaetsnaht. |
| Runtime-Schalter | `dispatchOn` und `autosOn` werden nicht von `GET /api/self/gate` projiziert. | Live-Zustand von D05/D06 ist **unknown**, nicht „on“. |
| Host-Commit | Alle registrierten Adapter deklarieren `hostCommits:false` (`server.ts:475`, `server.ts:594`, `server.ts:672`, `server.ts:735`, `server.ts:778`, `server.ts:892`, `server.ts:1065`). | D07 existiert als Recovery-/Erweiterungstuer, ist fuer heutige Adapter **not-applicable**. |

## A — by-design Owner-Tueren

### D01 — Program-MAIN-Bindung ist fehlend oder mehrdeutig

- **Ort/Text:** `server.ts:6396-6402`:
  - `ambiguous Program-MAIN binding: ${matches.length} active programs name slot ${s.id} openedAt ${s.openedAt} — the owner must resolve which one this session is MAIN of`
  - `not the current bound MAIN of an active program — attention is raised by a program's own main session`
  - Am Lane-Ende wird dieselbe fehlende Live-Bindung ueber den gemeinsamen Receiver-Resolver zu
    `no exact clarification receiver evidence` (`server.ts:5936-5979`, `server.ts:6144-6145`).
- **Wirkung/Kosten:** Release und Land brechen vor jeder Row-Pruefung ab; fertige Arbeit bleibt
  ausserhalb der Integration.
- **Fehlender Akteur:** keiner der autonomen Akteure darf binden. MAIN braucht den Owner;
  Steward/Supervisor/Controller duerfen die Identitaet nicht erfinden (`AGENTS.md:54-57`).

### D02 — Land verlangt die exakt gebundene Session-Identitaet

- **Ort/Text:** `server.ts:6589-6590`: `this session's id does not match the bound MAIN identity
  (${sessionIdMatch}) — landing is the one act bound to the exact recorded occupant; ask the owner
  to re-bind the Program-MAIN`.
- **Wirkung/Kosten:** Ein durch `/clear`, Resume oder Respawn neu gemintetes MAIN kann weiter lesen
  und releasen, aber nicht landen.
- **Fehlender Akteur:** MAIN fehlen Rebind-Rechte; Owner-Tuer aus Identitaetsgruenden.

### D03 — Rollen- und Program-Grenze

- **Ort/Text:**
  - Release fremder/ungebundener Row, `server.ts:6436-6437`: `task belongs to no program of this
    MAIN — a Program-MAIN releases only rows of program ${program.id}`.
  - Land fremder/ungebundener Row, `server.ts:6594-6597`: `task belongs to no program of this MAIN
    — a Program-MAIN lands only rows of program ${program.id}`.
  - Lane-Release, `server.ts:18749-18750`: `a lane may not release a queue row — releasing is the
    bracket above lanes`.
  - Lane-/Steward-Land, `server.ts:18764-18767`: `a lane may not land — ... its own MAIN
    adjudicates ...` / `the steward may not land — it is a standing role across programs, not the
    MAIN of one`.
- **Wirkung/Kosten:** Unbracketed work and cross-program work retain the board/Owner as their only
  promotion path.
- **Fehlender Akteur:** absichtlich keiner; Controller proposes only, Supervisor nudges only,
  Steward is cross-program, Lane executes only (`AGENTS.md:54-57`).

### D04 — Repo- und Dispatch-Zielgrenze

- **Ort/Text:**
  - `server.ts:6453-6460`: `this session's checkout is not a git repository — the release target
    repo cannot be derived`; `no dispatch repo is configured — a released row would have nowhere
    to run`; `task targets ${...} and this MAIN is bound in ${...} — a release never reaches across
    repositories`.
  - `server.ts:6613-6617`: `this session's checkout is not a git repository — the land target repo
    cannot be derived`; `the lane is in ${...} and this MAIN is bound in ${...} — a land never
    reaches across repositories`.
  - `server.ts:6713`: `the integration branch is the lane branch itself`.
- **Wirkung/Kosten:** Der Kreis darf kein fremdes Repo oder eine falsche Integrationstopologie
  nominieren; eine falsche Deployment-Konfiguration kann deshalb nicht still Code bewegen.
- **Fehlender Akteur:** MAIN hat bewusst keine Cross-Repo-Promotion; Owner/Operator korrigiert
  Program, Repo oder Integrationstopologie.

### D05 — Runtime-Release-Schalter des Dispatchers

- **Ort/Text:** `server.ts:8127-8129` hat **keinen Wartetext**: exakt
  `if (dispatchBusy || !dispatchOn || !DISPATCH_REPO) return;`. `dispatchOn` startet `false` und ist
  owner-toggled (`server.ts:2963`); nur die Owner-Route `/api/dispatch` schreibt ihn
  (`server.ts:20888-20894`, unter `tokenGate` ab `server.ts:19122-19123`).
- **Wirkung/Kosten:** Eine von MAIN erfolgreich releaste Row kann unbegrenzt `queued` bleiben, ohne
  dass der Tick einen Row-Hinweis schreibt.
- **Fehlender Akteur:** MAIN/Steward/Supervisor/Controller haben keinen Schalter; dies ist die
  by-design globale Release-/Stop-Tuer des Owners.

### D06 — Globaler Kill-Switch und Harness-Automation

- **Ort/Text:**
  - `canDeliver` antwortet exakt mit Gate `kill-switch`, wenn `autosOn` aus ist
    (`server.ts:7111`); `tickDispatch` gibt bei diesem Gate ohne Row-Text zurueck
    (`server.ts:8273-8278`). Nur `/api/autos/switch` schreibt den Schalter
    (`server.ts:20896-20903`).
  - Derselbe Schalter haelt auch bereits erzeugte Worker-/Merge-/Audit-/Deploy-Events als `pending`
    (`server.ts:10226-10253`).
  - Release: `harness ${spawnH.id} is not automatable — no unattended path may drive it
    (FLEET_HARNESS_AUTOMATION off)` (`server.ts:6471-6473`).
  - Queue: `waiting: harness ${rowH.id} is not automatable — no unattended path may drive it
    (FLEET_HARNESS_AUTOMATION off)` (`server.ts:8198-8202`).
- **Wirkung/Kosten:** Unattended Prompt-Zustellung bleibt aus; eine released Row kann ohne
  Operator-Promotion nicht starten.
- **Fehlender Akteur:** kein autonomer Akteur darf die globale oder Adapter-Policy erweitern;
  Owner/Operator-Tuer.

### D08 — Program hat keine Self-Land-Promotion

- **Ort/Text:** `server.ts:6622-6624`: `no self-land promotion on this program (${...}) — the owner
  grants it with POST /api/programs/${program.id}/promotion`.
- **Wirkung/Kosten:** Jede routine-clean/green Lane faellt auf den Owner-Board-Land zurueck;
  `nextAction` sagt genau das (`server.ts:2388-2395`).
- **Fehlender Akteur:** MAIN darf die eigene Promotion nicht schreiben; die einzige Writer-Route
  ist owner-only (`server.ts:15592-15638`).

### D09 — Repo hat keinen Owner-konfigurierten Verify-Eintrag

- **Ort/Text:** `server.ts:6631-6632`: `repo has no owner-configured verify entry — the global
  command skips (exit 42) outside the fleet repo, and skipped is never green`.
- **Wirkung/Kosten:** Eine bestehende Self-Land-Promotion ist fuer dieses Repo wirkungslos; kein
  Candidate kann die Tuer erreichen.
- **Fehlender Akteur:** Owner/Operator muss die repo-spezifische Messung konfigurieren; MAIN darf
  `unknown` nicht in gruen umdeuten.

### D11 — Unveraenderter Non-Land-Verdikt verbraucht den Fortschrittsweg

- **Ort/Text:** `server.ts:6680-6686`: `no progress since the last verdict — repair or escalate:
  ${pending.status} on the same candidate ${candidate.slice(0, 8)}, and nothing has been recorded
  since`.
- **Wirkung/Kosten:** Identische Gate-Wiederholungen werden gestoppt. MAIN darf bei belegtem
  Fortschritt reparieren; ohne Fortschritt endet der Kreis an einer Eskalationsentscheidung.
- **Fehlender Akteur:** bei echter Eskalation Owner; das ist die absichtliche Grenze, nicht ein
  fehlender Retry-Tick.

### D12 — `green-only` darf ungesehene Konfliktaufloesung nicht bestaetigen

- **Ort/Text:** `server.ts:6738-6741`: `${carry.hold.detail} — a "${policy.selfLand}" promotion
  never lands an unreviewed conflict resolution; the owner grants the "guarded" rung for that`.
- **Wirkung/Kosten:** Eine semantisch von einem Agenten gewaehlte Aufloesung bleibt unlanded, selbst
  wenn der Baum gruen ist.
- **Fehlender Akteur:** Owner erteilt `guarded` oder bestaetigt selbst; Geschmack/Promotion bleibt A.

### D13 — Tier-2-Audit ist eine Owner-konfigurierte Kosten-/Betriebsentscheidung

- **Ort/Text:** `server.ts:11532-11534` hat **keinen Laufzeittext**: exakt
  `if (!POSTLAND_AUDIT_CMD) return;`. Der Entscheidungsgrund und Default-off stehen bei
  `server.ts:11394-11403`. Liegt beim Boot noch eine persistierte Queue vor, lautet der sichtbare
  Wartetext `post-land audit queue: ${pending} pending land(s) across ${resumed.length} repo(s), but
  FLEET_POSTLAND_AUDIT_CMD is unset — left on disk, unaudited (unconfigured is not skipped).`
  (`server.ts:16445-16452`).
- **Wirkung/Kosten:** Ohne Konfiguration existiert nach einem Land kein integrierter Nachweis; ein
  leerer Trail bedeutet dann nicht „gruen“.
- **Fehlender Akteur:** Owner/Operator konfiguriert den teuren Befehl. Live ist diese Tuer offen.

### D14 — Rotes Audit braucht Owner-Urteil; Rollback bleibt Owner-Akt

- **Ort/Text:**
  - Audit-Watch: `This notification does not adjudicate, undo, or deploy anything`
    (`lane-signals.ts:248-254`).
  - Audit-Log: `this audit gates nothing; ↩ undo-land is the rollback`
    (`server.ts:11787-11792`).
  - Einziger Adjudication-Writer: Owner-Route unter dem Token-Gate
    (`server.ts:11896-11924`, `server.ts:19463-19468`).
  - Auto-Undo ist ausdruecklich ausgeschlossen (`server.ts:11385-11390`).
- **Wirkung/Kosten:** Ein real roter integrierter Baum bleibt auf main, bis ein Mensch klassifiziert,
  untersucht und gegebenenfalls rollbackt. Der Audit kann mehrere Lands koaleszieren und attribuiert
  den Verursacher nicht (`docs/verify-tiering.md:299-319`).
- **Fehlender Akteur:** endgueltiges Urteil und irreversible Rueckbewegung bleiben Owner-Policy;
  Supervisor sieht `redUnadjudicated`, darf aber nur MAIN nudgen (`server.ts:15134-15166`,
  `AGENTS.md:57`).

### D23 — Der optionale Clean-Review-Gate stoppt auch einen gruen verifizierten Kandidaten

- **Ort/Text:** Im Owner-konfigurierten Modus `gate` erzeugt jedes Reviewer-Verdikt ungleich `ok`
  exakt `clean rebase + green verify, but the advisory reviewer flagged a look: ${cleanReview.reason}
  — not auto-landed; review the diff, then land.` (`server.ts:14074-14081`). Die drei Modi und ihre
  Env-Policy stehen bei `server.ts:10522-10530`.
- **Wirkung/Kosten:** Der unveraenderte zweite Self-Land-Aufruf trifft D11. MAIN kann den Tree aendern
  und neu messen; ein Ausnahme-Land desselben Kandidaten bleibt bewusster menschlicher Review-/
  Geschmack-Akt.
- **Fehlender Akteur:** absichtlich keiner; Owner konfiguriert bzw. ueberstimmt diese Taste-Grenze.
  Live setzt `watchdog.sh:148` den Modus auf `off`, daher ist die Tuer heute not-applicable, aber als
  Code-/Policy-Tuer vorhanden.

## B — mechanische, invariantenverträglich automatisierbare Luecken

### D07 — Host-Commit-Signal zeigt auf eine Owner-Route statt auf MAIN

- **Ort/Text:** `lane-signals.ts:210-215`: `the next step is a host commit via POST
  /api/slots/${slot}/commit` und `Read the pane before you commit, review, or land`.
  `commitLane` hat laut `ast-grep` genau einen Caller, die Owner-Route unter `tokenGate`
  (`server.ts:20106-20135`). Self-Land akzeptiert `host-commit-looking` nicht
  (`server.ts:6687-6693`).
- **Wirkung/Kosten:** Ein kuenftiger host-committed Adapter bleibt `dirty>0/ahead===0` und erreicht
  nie `done-looking`, bis der Owner den reversiblen Save-Akt ausfuehrt.
- **Fehlender Akteur:** eine occupant-/task-/program-gebundene MAIN-Self-Commit-Route. Diese kann
  dieselbe `commitLane`-Mechanik nutzen, ohne Land- oder Cross-Repo-Rechte zu erweitern.
- **Adapterentscheidung:** fuer alle heutigen Adapter **not-applicable**; fuer einen spaeteren
  Adapter mit `hostCommits:true` **unsupported** im autonomen MAIN-Kreis.

### D10 — Verlorene/behaltene Lane oder unlesbare Kandidaten-/Ref-Mechanik hat keinen Recovery-Aktor

- **Ort/Text:**
  - `this row names no live lane slot — the lane it ran in is gone, so nothing can be landed for it`
    (`server.ts:6607-6609`).
  - `the lane's HEAD could not be read — the candidate commit is unknown, and an unknown candidate
    is never landed` (`server.ts:6636-6638`).
  - `cannot resolve the repo's integration branch` (`server.ts:6711-6712`).
  - `${laneSync.error} — nothing was merged or landed` (`server.ts:6716-6717`).
  - Der Dispatch-Tail setzt die Row auf `queued` und loest ihre Slot-Verknuepfung auch dann, wenn
    `removeWorktreeSafe` die Lane behalten muss: `lane kept (slot ${other.id} holds it)` bzw.
    `lane kept (${fail.error.split("\n")[0]})` (`server.ts:7492-7505`).
- **Wirkung/Kosten:** Der Commit kann noch im Repo existieren, aber der taskgebundene Self-Land-Weg
  hat keinen Wiederanbindungs-/Salvage-Schritt; eine beim Dispatch behaltene Lane kann zugleich als
  `queued` Row erneut antreten. Ein mechanischer Identitaets-/Ref-Fehler wird zum Menschenfall.
- **Fehlender Akteur:** MAIN-Reconcile/Retry oder ein Supervisor-Nudge mit gebundenem Recovery-Akt;
  kein Geschmack und keine neue Promotion ist notwendig.

### D16 — `unknown` Audit wird weder gepingt noch erneut gemessen

- **Ort/Text:** Die Audit-Klassifikation erzeugt unter anderem
  `audit timed out after ${POSTLAND_AUDIT_TIMEOUT_MS}ms — no verdict`,
  `the audit command declined to run (exit 42)` und
  `the audit command could not be started (exit ${exitCode})`
  (`server.ts:11745-11756`). Weitere `unknown`-Texte sind
  `could not resolve ${main} — nothing to audit` (`server.ts:11692-11699`) und
  `audit could not run: ${...}` (`server.ts:11762-11764`); `snapshotIntegrationTree` reicht seinen
  konkreten Fehlertext unveraendert durch (`server.ts:11700-11703`). Danach wird die Queue konsumiert
  (`server.ts:11564-11573`).
  `tickAuditPing` sucht ausschliesslich `r.result === "red"` (`server.ts:9930-9935`); der
  Steward-Vertrag nennt als offene Ledger-Signaturen red, fehlende Row und Shadow, aber kein
  `unknown` (`.claude/commands/rundgang.md:17`).
- **Durabilitaetsstellen/Text:** Kann der Queue-Mirror nicht geschrieben oder beim Boot nicht gelesen
  werden, existieren nur die Logtexte `post-land audit queue save failed: ${...}`
  (`server.ts:11509-11523`) und `post-land audit queue unreadable — pending audits are lost, the trail
  is unaffected: ${...}` (`server.ts:16431-16462`). Kein Event oder Task wird erzeugt.
- **Wirkung/Kosten:** Eine fehlgeschlagene Messung hat weder begrenzten Retry noch einen sicher
  zuständigen Empfaenger. Der integrierte Baum bleibt ungemessen und kann trotzdem deployt werden.
- **Fehlender Akteur:** Steward oder Supervisor fuer einen begrenzten Re-Audit-/Investigation-Akt;
  das aendert kein Land und erfindet kein Gruen.

### D18 — Deploy-Ablehnung speichert keinen Intent und plant keinen Retry

- **Ort/Text:**
  - `a deploy is already building — one at a time` (`server.ts:17661-17663`).
  - `a post-land audit is running on ${...} — killing srv now would leave a red that measured
    nothing` / `a post-land audit is starting — killing srv now would leave a red that measured
    nothing` (`server.ts:17600-17605`).
  - `a deploy is already in flight (${pending.id}) — its verdict is written by the next boot`
    (`server.ts:17676-17681`).
- **Wirkung/Kosten:** Die Ablehnung ist korrekt, aber der angeforderte Deploy verschwindet. Wenn der
  mechanische Blocker endet, ruft nichts den Verb erneut; ein neuer Owner-/Steward-Akt ist noetig.
- **Fehlender Akteur:** gebundener Steward-Retry oder persistenter Deploy-Intent, der erst nach
  Audit-Terminal und ohne parallelen Build feuert.

### D19 — Deploy-Preflight/Build/Restart-Fehler erzeugt keine Reparaturarbeit

- **Ort/Text:**
  - `HEAD is unreadable — a deploy whose target cannot be named cannot be verified either`
    (`server.ts:17689-17692`).
  - `the build failed — the running server was left alone` (`server.ts:17696-17711`; Timeout-/Exit-
    Details stehen in derselben Row).
  - `the restart command failed (exit ${exitCode}) — the server is still running the old code`
    (`server.ts:17636-17651`).
  - Der ueberlebte Marker wird mit `no boot ever claimed this deploy — the process that wrote the
    marker is still running, so the restart did not take` geschlossen (`server.ts:17676-17687`).
  - Ein abwesender oder zerrissener Marker wird still zu `null` — `there is no deploy this process
    can account for` (`server.ts:17529-17535`). Der Boot-Pfad loescht den Marker vor dem Append; sein
    eigener Kommentar benennt den Restfehler als `a missing record` (`server.ts:17581-17591`).
- **Wirkung/Kosten:** Der alte Server bleibt korrekt am Leben, aber kein Task, Nudge oder gebundener
  Reparaturzyklus entsteht; landed bleibt nicht live.
- **Fehlender Akteur:** Steward/Supervisor als mechanischer Triage- und Task-Erzeuger, danach MAIN
  fuer die Reparatur. Ein automatischer Restart trotz rotem Build waere **nicht** die vorgeschlagene
  Automation.

### D21 — Ein fertiger Worker kann seinen einzigen Report nicht ablegen

- **Ort/Text:** `openFleetReport` verweigert bei belegtem Event-Budget exakt `fleet-report receiver
  has no FleetEvent delivery budget` (`server.ts:6144-6150`). Fehlt die live Program-MAIN-Bindung,
  kommt vorher einer der Receiver-Texte aus D01; bei programlosen Legacy-Lanes sind ausserdem
  `lane-watch evidence names multiple receiver occupants` und `only legacy lane-watch evidence
  exists without slotOpenedAt` moeglich (`server.ts:5956-5979`).
- **Wirkung/Kosten:** Der mutierende Brief verlangt genau diesen einen Report und danach Idle
  (`server.ts:7431-7451`). MAIN wartet laut eigenem Brief ohne Polling auf Report/Event
  (`server.ts:14694-14701`); ein 409 erzeugt selbst kein Ersatz-Event. Eine saubere, fertige Lane kann
  deshalb unbeachtet bleiben, obwohl ihr Git-Zustand landbar ist.
- **Fehlender Akteur:** MAIN zum Acknowledge/Entlasten und erneuten Anfordern oder Supervisor fuer
  eine gebundene Report-Debt-Eskalation; der Worker hat nach dem fehlgeschlagenen einzigen POST
  keinen serverseitig garantierten Retry.

### D22 — `send-uncertain` ist ein dauerhafter Event-Endzustand ohne Reconciliation

- **Ort/Text:** Vor dem Tmux-Send wird das Event als `send-uncertain` persistiert
  (`server.ts:10226-10262`). Ein nicht als `SendRefused` klassifizierter Fehler loggt exakt
  `fleet_event_send_uncertain` mit `${event.id}${rollback} ${...}` und bleibt unreplayed
  (`server.ts:10279-10294`); auch `acceptance unobservable` bleibt so stehen
  (`server.ts:10296-10300`). Das betrifft Worker-Report, Lane-, Merge-, Audit- und Deploy-Event
  ueber denselben Transport (`server.ts:10263-10275`).
- **Wirkung/Kosten:** Der Fakt kann im Ledger existieren, waehrend der vorgesehene MAIN-/Steward-
  Empfaenger nie aufgeweckt wird. Blindes Replay ist zurecht verboten, aber es gibt weder
  Acceptance-Reconciliation noch eine zweite Benachrichtigungskante.
- **Fehlender Akteur:** Supervisor zum Benennen der dauerhaften Delivery-Debt und MAIN/Steward als
  Pull-Empfaenger; mechanisch automatisierbar ist eine explizite Reconciliation, nicht ein blindes
  erneutes Tippen.

## C — verwaiste oder falsch verdrahtete Tueren

### D15 — Red-Audit-Ping benachrichtigt eine Akteursklasse, die den genannten Verb nicht ziehen kann

- **Ort/Text:** Der Ping sagt `Lege das Urteil ab mit POST
  /api/post-land-audits/adjudicate {at, verdict, note}` (`server.ts:9885-9900`). Sein Empfaenger ist
  irgendeine aktive Non-Lane-/Non-Steward-Session, nicht zwingend die gebundene Program-MAIN
  (`server.ts:9941-9948`). Die genannte Route liegt aber unter dem Owner-`tokenGate`
  (`server.ts:19122-19123`, `server.ts:19463-19468`).
- **Wartetexte:** `pending — no eligible main session is active` (`server.ts:9944-9948`) bzw.
  `pending — no deliverable main session (${why})` (`server.ts:9998-10001`).
- **Wirkung/Kosten:** Live (`FLEET_AUDIT_PING_MS=60000`) kann der Server einen Empfaenger aus
  MAIN/Supervisor/Controller zu einem owner-only POST auffordern. Mit dem Self-Token kann dieser die
  Tuer strukturell
  nicht oeffnen; eine ungebundene Plain Session kann auch keine Program-Attention erheben.
- **Fehlender Akteur:** owner-gebundene Zustellung oder eine MAIN-Self-Route, die nur einen
  Adjudikationsvorschlag/Attention erzeugt. Steward ist als Ping-Empfaenger explizit ausgeschlossen;
  Supervisor kann nur nudgen; Controller hat keine Owner-Route (`AGENTS.md:54-57`).

### D17 — Der Steward-Deploy-Verb existiert, aber der live Steward-Vertrag verbietet seinen Aufruf

- **Ort/Text:** Code gewaehrt `POST /api/deploy` mit Steward-Token (`server.ts:18136-18140`) und
  nennt den Steward den Akteur, der den Gap sieht (`server.ts:17658-17661`). Gleichzeitig sagt die
  Route selbst: `NOT WIRED TO ANYTHING. No tick calls this, no auto, no dispatch path`
  (`server.ts:17450-17453`). Der aktuelle Steward-Vertrag sagt bei `deployGap`/`bundleStale`
  `only the owner's hands can restart or rebuild` (`.claude/commands/rundgang.md:12`) und
  `Anything you want to nudge, commit, or land is a decision ... not an action to take`
  (`.claude/commands/rundgang.md:44`).
- **Wirkung/Kosten:** Nach einem gruenen Audit kann Code unbegrenzt gelandet, aber nicht live sein;
  die vorhandene technische Steward-Autoritaet hat keinen Akteur.
- **Fehlender Akteur:** Steward. MAIN darf Deploy als externen Effekt laut portablem Vertrag nicht
  entscheiden (`AGENTS.md:55`, `AGENTS.md:69-71`); Supervisor ist explizit land/deploy-unfaehig
  (`server.ts:14782-14791`); Controller hat keine Owner-Route (`AGENTS.md:54`).
- **Klassifikationsgrenze:** C, nicht B: die Route ist bereits gebaut. Ob der Steward-Vertrag sie
  promotioniert, bleibt wegen des externen Effekts eine Owner-Policy-Entscheidung.

### D20 — Deploy-Verdikt-Watch existiert, wird aber von keinem Initiator automatisch registriert

- **Ort/Text:** Erfolgreicher Start antwortet nur: `the restart kills this process — the verdict is
  written by the next boot; read it at GET /api/deploys` (`server.ts:17714-17725`). Ein Deploy-Watch
  kann existieren und `deployWatchMessage` liefern (`server.ts:5556-5564`,
  `lane-signals.ts:257-265`), aber `mintDeployEvents` bedient nur bereits bewaffnete Watches
  (`server.ts:5734-5750`). `ast-grep` findet ausser den zwei HTTP-Routen keinen `deployVerb`-Caller.
- **Weitere verwaiste Verdict-Stellen:** `judgeDeploy` kann `the deploy gap is unknown — the repo
  could not be read, so nothing was verified`, `still behind: ...`, `bundle staleness is unknown —
  the bundle or src/ could not be stat'd` oder `the bundle is older than src/ — the build did not
  reach public/` schreiben (`server.ts:17549-17577`). Keine dieser Stellen armiert den Watch.
- **Wirkung/Kosten:** `ok:false` oder `ok:null` kann nur im Ledger liegen; kein autonomer Caller
  bekommt zwingend den Boot-Verdikt und repariert/retryt.
- **Fehlender Akteur:** der Deploy-Initiator, praktisch Steward: nach dem 202-Body `kind:"deploy"`
  registrieren und den Terminal-Event auswerten; alternativ Server-seitig Watch/Empfaenger mit dem
  Deploy-Intent mitschreiben.

## Vollstaendige Release- und Dispatch-Ablehnungs-/Warteleiter

Diese Tabelle verhindert, dass normale idempotente oder selbstheilende Zustaende als Owner-Tuer
gezaehlt werden. `Dxx` verweist auf die gruppierte Tuer oben; „kein Tuerfund“ bedeutet, dass die
Anfrage stale/ungueltig ist oder der vorhandene Kreis den Zustand ohne Owner-Entscheidung klaert.

| Ort | Exakter Text/Verhalten | Einordnung |
|---|---|---|
| `server.ts:6428-6429` | `bound.error` mit den beiden Texten aus D01 | D01 A |
| `server.ts:6431-6432` | `unknown task` | kein Tuerfund: stale ID |
| `server.ts:6436-6437` | `task belongs to no program of this MAIN — ...` | D03 A |
| `server.ts:6440-6441` | `a ${t.kind} is advisory — the dispatcher never runs this` | kein Tuerfund: falsche Row-Art; MAIN kann neuen `auftrag` anlegen |
| `server.ts:6445-6446` | `task is ${t.status} — only a pending row can be released` | kein Tuerfund: idempotente/stale Zustandsanfrage |
| `server.ts:6453-6460` | Git-Repo nicht ableitbar / kein Dispatch-Repo / Cross-Repo | D04 A |
| `server.ts:6471-6473` | Harness nicht automatable | D06 A |
| `server.ts:6479-6481` | `program release cap reached (${openReleased}/${PROGRAM_MAX_RELEASED} released rows not yet started) — let the tick start one first` | kein eigener Owner-Tuerfund; Backpressure, die bei offenem Tick selbst sinkt |
| `server.ts:8127-8129` | stiller Return bei busy/off/no repo | busy transient; off/no repo D04/D05 A |
| `server.ts:8167-8169` | `waiting: ${lanes}/${DISPATCH_MAX_LANES} lanes busy in ${basename(repo)} — land or close one` | kein neuer Fund; wartet auf vorhandenen Lane-Land/Close-Weg, sonst Folge von D08/D17 |
| `server.ts:8182-8187` | `waiting: ${programLanes}/${DISPATCH_MAX_LANES_PER_PROGRAM} lanes busy in program "${title}" — land or close one of ITS lanes` | wie vorige Zeile |
| `server.ts:8198-8202` | Harness-Wartetext | D06 A |
| `server.ts:8204-8205` | `waiting: no free slot` | normale Flottenkapazitaet; kein eigener Policy-Fund |
| `server.ts:8226-8228` | `waiting: not analysed yet — the analyst runs on its own` | selbstheilend, wenn Analyse eingeschaltet; live nicht aktiv |
| `server.ts:8242-8244` | `waiting: the analysis is older than the tree — re-analysing` | selbstheilend, wenn Analyse eingeschaltet; live nicht aktiv |
| `server.ts:8270-8271` | `waiting: collides with running work (${hit}) — same files, says the analyst` | wartet auf terminale kollidierende Lane; kein Owner-Urteil aus diesem Text allein |
| `server.ts:8277-8278` | `canDeliver` verweigert; Tick laesst Row queued | `kill-switch` D06 A; quiet-hours/busy sind zeitlich selbstheilend |
| `server.ts:7334-7339` | `dispatch failed: ${...}`; Eintrittsstatus wird wiederhergestellt | autonome Rows bleiben `queued` und werden erneut versucht; persistente Repo-/Spawn-Ursache faellt unter D04/D10 |
| `server.ts:7523-7536` | `slot changed during spawn — requeued`, `dispatch held (${gate}${detail}) — requeued`, `${readiness.reason} — requeued` | Retry ist eingebaut; wird eine nicht entfernbar Lane behalten, D10 B |
| `server.ts:7593-7595` | `dispatch failed: ${...}`; Tail requeued | Retry ist eingebaut; kein eigener Owner-Tuerfund |
| `server.ts:6144-6150` | Receiver-Resolver-Fehler oder `fleet-report receiver has no FleetEvent delivery budget` | D01 A bzw. D21 B |
| `server.ts:10226-10300` | Event bleibt bei `kill-switch` pending oder terminal `send-uncertain` | D06 A bzw. D22 B |

## Vollstaendige Self-Land-Ablehnungsleiter

| Ort | Exakter Text/Verhalten | Einordnung |
|---|---|---|
| `server.ts:6579-6580` | `bound.error` | D01 A |
| `server.ts:6589-6590` | Session-ID passt nicht; Owner-Rebind verlangt | D02 A |
| `server.ts:6592-6593` | `unknown task` | kein Tuerfund: stale ID |
| `server.ts:6596-6597` | Task gehoert nicht zum Program | D03 A |
| `server.ts:6601-6602` | `a ${t.kind} is advisory — it never produced a lane, so there is nothing to land` | kein Tuerfund: unlandbare Kategorie |
| `server.ts:6603-6604` | `already landed — this row is done; a landed row is not landed twice` | kein Tuerfund: idempotenter Schutz |
| `server.ts:6605-6606` | `task is ${t.status} — only a running row has a lane to land` | kein Tuerfund: falsche Phase |
| `server.ts:6607-6609` | Row hat keine live Lane | D10 B |
| `server.ts:6613-6617` | MAIN-Repo nicht ableitbar / Cross-Repo | D04 A |
| `server.ts:6622-6624` | keine/`off` Self-Land-Promotion | D08 A |
| `server.ts:6631-6632` | kein Owner-konfigurierter Verify-Eintrag | D09 A |
| `server.ts:6636-6638` | HEAD/Candidate unbekannt | D10 B |
| `server.ts:6646-6648` | `already landed — ${candidate.slice(0, 8)} already carries a fleet/land note, so this candidate is on the integration branch` | kein Tuerfund: Duplicate-Schutz |
| `server.ts:6680-6686` | kein Fortschritt seit identischem Verdict | D11 A am Eskalationsrand |
| `server.ts:6691-6693` | `the lane is not done-looking (${signal ?? "no signal"}) — it must be alive, idle, clean and ahead of its base; let it finish, or commit its work, then call again` | normaler MAIN-Wait/Retry; bei `host-commit-looking` D07 B |
| `server.ts:6698` | `{ running: true }` bei bestehendem Merge/Land | kein Tuerfund: Single-flight/idempotent |
| `server.ts:6706-6707` | `a commit is in progress on this lane — try again in a moment` | transient |
| `server.ts:6711-6712` | Integration Branch nicht aufloesbar | D10 B |
| `server.ts:6713` | Integration Branch ist Lane Branch | D04 A/ungueltige Topologie |
| `server.ts:6716-6717` | Ref-Sync-Fehler; nichts gelandet | D10 B |
| `server.ts:6738-6741` | ungesehene Aufloesung unter zu schwacher Promotion | D12 A |

Nicht als verwaist gezaehlt ist der eigentliche MAIN-Land-Aufruf: Es gibt keinen Server-Tick, aber
der Program-MAIN-Vertrag benennt genau diesen urteilsbehafteten Akt und seine beiden Watches
(`server.ts:14702-14712`). Das ist ein vorhandener Akteur, kein C-Fund. Ebenso ist das Audit selbst
nach einem Land bei konfiguriertem Tier 2 vollautomatisch; die Luecken beginnen beim Umgang mit
seinem Ausnahmeverdikt und beim Uebergang zum Deploy.

## Asynchrone Merge-, Audit- und Deploy-Terminalleiter

Die HTTP-Ablehnungsleiter endet vor dem eigentlichen `mergeJob`. Diese zweite Tabelle erfasst die
Terminaltexte dahinter; reparierbare MAIN-/Worker-Arbeit ist keine zusaetzliche Owner-Tuer, wird aber
explizit abgegrenzt.

| Ort | Exakter Terminaltext/Verhalten | Einordnung |
|---|---|---|
| `server.ts:13827-13828` | `the pre-pass rebase onto ${main} halted: ${pre.halted}. No agent was started and nothing was landed — resolve it in the session, then re-run ⏫.` | MAIN-/Worker-Reparatur; kein neuer Owner-Akt |
| `server.ts:13854-13870` | `${main} moved and the rebase conflicts ... — handed to this lane's own session ... It resolves and commits; then re-run ⏫ ...` | vorhandener Worker->MAIN-Kreis; kein neuer Owner-Akt |
| `server.ts:13916-13934` | Resolver `blocked` oder `agent ... but the lane is not clean/not rebased ... — lane kept` | MAIN-/Worker-Reparatur; unveraendert danach D11 |
| `server.ts:14022-14026` | Konflikt `resolved`, Detail endet in `review the diff, then land` und nennt red/skipped Gate im selben Text | unter `guarded` MAIN-Review; sonst D12 A |
| `server.ts:14047-14052` | `clean rebase, but verify NEVER STARTED ...`, `verify TIMED OUT ...` oder `verify SKIPPED itself ... — ... it did not auto-land` | kein Gruen; neuer Mess-/Repair-Commit ist MAIN-Arbeit, unveraendert D11 A |
| `server.ts:14053-14061` | `clean rebase, but verify failed (${verify.cmd}) — not auto-landed; review the output, then land if intended.` | MAIN repariert; Ausnahme-Land bleibt Owner-Urteil ueber D11 |
| `server.ts:14074-14081` | `clean rebase + green verify, but the advisory reviewer flagged a look: ${...} — not auto-landed; review the diff, then land.` | D23 A; live `CLEAN_REVIEW_MODE=off`, daher heute not-applicable |
| `server.ts:14089-14120` | `${landSync.error} — nothing was landed`, `rebase ok, but fast-forwarding ${main} failed: ${adv.error} — lane kept`, oder `landed on ${main} (recorded), but lane teardown failed: ${land.error}` | D10 B; letzter Fall hat main bereits bewegt und blockiert nicht den Audit-Trigger |
| `server.ts:11692-11764` | alle `unknown`-Gruende aus D16; Queue wird danach konsumiert | D16 B |
| `server.ts:11787-11792` | `POST-LAND AUDIT RED/UNKNOWN: ... — this audit gates nothing; ↩ undo-land is the rollback.` | red D14 A; unknown D16 B |
| `server.ts:17661-17692` | Deploy-Busy/Audit-running/In-flight/HEAD-unreadable | D18/D19 B |
| `server.ts:17696-17725` | Build-Fehler oder `restarting` mit Boot-Verdikt spaeter | D19 B bzw. D20 C |
| `server.ts:17549-17577`, `server.ts:17636-17651` | Boot-/Restart-Verdikt `false|null` mit den Gruenden aus D19/D20 | D19 B; ohne bewaffneten Empfaenger D20 C |

## Akteursmatrix am offenen Ende

| Akteur | Land | Audit-Ausnahme | Deploy |
|---|---|---|---|
| MAIN | Self-Land nur mit Promotion; gewoehnliche Reparaturen ja | kann Watch lesen und Owner-Attention erheben, aber nicht adjudizieren/undoen | laut portablem Vertrag externer Effekt, also Owner-Grenze |
| Steward | darf nicht landen | sieht Ledger; Vertrag erlaubt nur Surface/Proposal, Ping schliesst Steward aus | Route existiert, Vertrag ruft sie nicht: D17 C |
| Supervisor | sieht Program-/Audit-/Deploy-Fakten und darf MAIN nudgen | keine Adjudication-/Rollback-Route | explizit kein Deploy (`server.ts:14787-14791`) |
| Controller | proposes/uebersetzt Owner-Intent | keine Owner-Route | keine Owner-Route; nur Transition-Watch ueber Supervisor |

## Adapter- und Surface-Entscheidung

| Surface | Entscheidung | Beleg |
|---|---|---|
| Self-Protokoll/Wire | **apply** fuer MAIN-Release, -Land und Watches; **unsupported** fuer Rebind, Audit-Adjudikation und Deploy. | `server.ts:18664-18670`, `server.ts:18744-18768`; Owner-/Steward-Routen `server.ts:19463-19473` |
| Server/Lifecycle | **apply**, aber mit D01-D23 als expliziten Stops/Restluecken. | Kreis und Ablehnungsleitern oben |
| Owner-Client | **apply** fuer Dispatch-Schalter und Self-Land-Promotion; **unsupported** als Aktionssurface fuer `autosOn`, Audit-Adjudikation und Deploy. Der Client zeigt Deploy nur als `restart srv`/`run bun run build`-Text. | `src/client.ts:6300-6381`, `src/client.ts:7440-7453`, `src/client.ts:1615-1642`; keine entsprechenden POST-Caller im `rg`-Sweep |
| Reverse-State | **apply** fuer Program-Phase, Gate, Audit und Supervisor-Sicht; **unsupported** fuer MAINs Live-Werte von `dispatchOn`/`autosOn`. | `server.ts:14668-14672`, `server.ts:18866-18876`; Self-Gate projiziert die beiden Schalter nicht |
| Rollen-Dokumentation | MAIN-Schleife **apply**; Steward-Deploy **unsupported**, weil technische Route und live Vertrag widersprechen. | `server.ts:14685-14721`; `.claude/commands/rundgang.md:1`, `.claude/commands/rundgang.md:12` |
| Harness-Adapter | Host-Commit fuer alle heutigen Adapter **not-applicable**; unattended Harness-Policy ansonsten **apply** ueber dasselbe Gate. | `server.ts:475`, `server.ts:594`, `server.ts:672`, `server.ts:735`, `server.ts:778`, `server.ts:892`, `server.ts:1065`; `server.ts:6461-6473` |
| Probes | Statische Pins und `GET /api/self/gate` **apply**; ein lane-sichtbarer Probe fuer Runtime-Dispatch/Autos ist **unsupported**. | `AGENTS.md:127-159`, `server.ts:18866-18876` |

## Verifiziert, inferiert, nicht untersucht

**Verifiziert:** fokussierte Quellbereiche um alle genannten Symbole; `rg`-Call-Sites;
`ast-grep`-Caller fuer `selfLandTaskForMain`, `deployVerb`, `schedulePostLandAudit`,
`drainPostLandAudits`, `tickDispatch` und `commitLane`; die Rollen-/Actor-Vertraege; die live
Watchdog-Flags; die relevanten Owner-Client-POSTs; `GET /api/self/gate` mit `postlandAudit:true`.

**Inferiert aus diesen Belegen:** Die mit B bezeichneten Mechanismen koennen gebunden automatisiert
werden, weil sie weder Program/Repo/Identitaet erweitern noch `unknown` zu gruen machen. Die genaue
Gestalt eines solchen Fixes ist nicht beschlossen. D17 ist C, weil Code-Autoritaet und live
Steward-Vertrag gegeneinander stehen; welche Seite der Owner promotioniert, bleibt offen.

**Nicht untersucht:** historische Ledgermengen. Runtime-Werte von `dispatchOn` und `autosOn` waren
ueber den Lane-Self-Sensor nicht beobachtbar und bleiben `unknown`.

Ein temporaerer gerichteter Graphify-AST-Graph ueber `server.ts` und `lane-signals.ts` bestaetigte
die relevanten Knoten/Caller (826 Knoten, 2078 Kanten), meldete aber 103 dangling Endpoint-Kanten
und 44 kollabierte gerichtete Kanten. Deshalb ist er nur Suchhilfe; die Vollstaendigkeitsaussage
stuetzt sich auf die direkten `rg`-/`ast-grep`-Call-Site-Sweeps und gelesenen Quellbereiche, nicht auf
eine fehlende Graphkante.

## Offene Owner-Grenze

Der kleinste autonomie-wirksame Entscheidungsschnitt ist nicht „Auto-Land einschalten“ — das ist
fuer eine promotete Program-MAIN bereits vorhanden. Offen ist, ob der Owner (1) den vorhandenen
Steward-Deploy-Verb in dessen live Vertrag promotioniert, (2) fuer `unknown`/red Audit einen
gebundenen Investigation-/Retry-Aktor schafft und (3) finaler Adjudikation und Rollback weiterhin
ausnahmslos menschlich laesst. Ohne diese drei Entscheidungen bleibt der Kreis nach dem Land offen,
obwohl jede einzelne Route fuer sich funktionsfaehig aussieht.
