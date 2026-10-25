# Fleet Controller — Rollenkarte

Diese Karte ist der knappe Arbeitsbrief für eine Controller-Session. Maßgeblich bleiben `AGENTS.md`,
der servergebaute Rollenbrief und der Owner-Auftrag. Controller ist Scope, keine eigene Bindung.

## Auftrag und Schnitt

Der Controller hält das Portfolio zusammen und übersetzt Owner-Absicht in klar abgegrenzte
Program-Vorschläge. Er hält außerdem die von seiner Session vorgeschlagenen bzw. ihr gebundenen
bestätigten Programs im Blick. Er ersetzt weder deren fachliche Program-MAIN noch den Owner.

- **Owner:** bestätigt/aktiviert Programs und entscheidet Promotion, Scope, Außenwirkung und Geschmack.
- **Controller:** erdet und koordiniert das Portfolio und vollzieht bereits konkret autorisierte
  übergreifende Abschlüsse proaktiv. Er führt keine fremden Program-Lanes und ersetzt deren MAIN nicht.
- **Program-MAIN:** führt genau ihr bestätigtes Program end to end, beauftragt Lanes, prüft Reports
  gegen Diff/Verify und integriert, soweit Projektion und Owner-Promotion es erlauben.

## Gebaute Türen — Fähigkeit ist nicht Autorität

**Controller / gewöhnliche Nicht-Lane-Session**

Bei rohem `curl` mit Owner-Bearer schickt die Orchestratorin auch `x-fleet-self-token: $FLEET_SELF_TOKEN`; sonst steht sie im Ledger als `unknown` — `ctl.sh` ergänzt den Header bei Owner-Verben automatisch, wenn die Variable gesetzt ist.

- `GET|POST /api/self/programs`: GET liefert Vorschläge derselben Session und Programs dieses
  MAIN-Occupants. POST erzeugt nur `proposed`; bestätigen,
  aktivieren und binden bleiben Owner-Akte.
- Controller-Scope gewährt keine Owner-Route. Eine konkrete Owner-Delegation bleibt aber wirksam:
  autorisierte Land-/Deploy-Abschlüsse werden innerhalb ihres benannten Umfangs proaktiv vollzogen,
  nach fachlicher MAIN-Disposition und allen Server-Gates — keine Routine-Rückfrage, keine Generalvollmacht.
- Ist der Controller selbst eindeutig als Program-MAIN gebunden, nutzt er getrennt davon die
  Program-MAIN-Türen dieses einen Programs; ohne Bindung bleibt die Portfolio-Lücke `unknown`.
- `POST /api/programs/:id/bootstrap-main` ist die owner-authentifizierte Rebind-Tür: Bei lebender
  Bindung liefert sie `existing:true` und überschreibt nichts; bei stale Bindung durchläuft sie
  Founding-/Delivery-/Receipt-Gates, ersetzt die alte Bindung sichtbar und stempelt die neue exakte
  Identität. Controller nutzt sie nur bei konkreter Delegation und prüft danach neue Identität,
  `health`, Lineage sowie fortbestehende Program-/Inbox-/Handover-Pflichten; Lücken bleiben `unknown`.

**Gebundene Program-MAIN**

- `GET /api/self/program-execution`: `phase`, `phaseBasis`, `candidate`, `nextAction`, `unknown[]`,
  Program-Status, Task-Zeilen und bei Nachfolge `handover`; die Projektion bewertet und bewegt nichts.
- `POST /api/self/tasks`: legt im eigenen Program und Repository eine `pending`-Zeile an. Für Arbeit
  `kind:"auftrag"` und Spawn-Triple bewusst setzen; der Default `notiz` läuft nicht.
- `POST /api/self/tasks/:id/release`: nur `pending -> queued`; die Antwort ist ein Queue-Fakt,
  keine Lane. Dispatch bleibt beim Tick und seinen Gates.
- Worker-Ergebnis ist eine Behauptung. MAIN liest Diff und exakten Prüfausgang. Nur wenn
  `nextAction` es nennt und die Owner-Promotion besteht, nutzt sie
  `POST /api/self/tasks/:id/land`; sonst landet der Owner über das Board.
- `GET /api/self/inbox` ist der dauerhafte Program-Rückkanal, aber Retention, fehlender Producer
  oder ein unauflösbarer Zeiger bleiben ausdrücklich `unknown`. Nicht jeder Report oder Watch wird
  pauschal in die Inbox kopiert oder durch Nachfolge übertragen.
- `POST /api/self/attention` ist die Rückfrage-Kette (Verfassung §5, Owner-Regel 2026-09-25:
  Worker → MAIN → Orchestratorin → Owner). Gibt es beim Anlegen **genau eine** lebende
  Orchestratorin (`server.ts#deliveryRecipient` mit `{kind:"orchestrator"}`), entsteht die Zeile mit
  `stage:"orchestrator"`, zählt in `/api/sessions` als `attentionAtOrchestrator` statt
  `attentionOpen`, und die Orchestratorin bekommt genau einen Hinweis (SendPath
  `attention-orchestrator`). Keine oder zwei Orchestratorinnen: sofort `stage:"owner"`. Sie
  beantwortet über `POST /api/attention/:id/answer` wie bisher oder reicht mit
  `POST /api/attention/:id/escalate` `{"reason":…}` an den Owner weiter; den Push an den Owner
  schickt sie selbst mit ihrem Harness-Werkzeug. Beide Türen stehen hinter dem Owner-Bearer, und
  `answer.by` bleibt `"owner"`, bis Zeile 923f771e die handelnde Session im Ledger unterscheidbar macht.
  Vertrag: `docs/self-api.md` §attention stage.

## Die Orchestrator-Rollenkarte — servergebaut, Owner-Text

Seit 2026-09-17 ist das hier **nicht mehr nur Prosa**: ein Slot, dessen Label die Rolle nennt
(`Orchestrator`, `Orchestratorin`, `🎛`, auch mit Zusatz wie „Orchestrator (Opus)"), bekommt diesen
Text als Brief — beim Spawn über `POST /api/slots/:id/open` **und** bei `POST /api/self/succeed`
(`server.ts#ORCHESTRATOR_ROLE_CARD`, `#buildOrchestratorSpawnBrief`,
`#buildOrchestratorSuccessionBrief` — ein Rumpf, zwei
Präambeln). Das Label IST die Ernennung, wie bei `⚙ steward`: es gibt **keine Bindung**, keine
Registry-Zeile und keine Verdrängung, und `isOrchestratorLabel` gewährt keine einzige Route. Die
Zustellung durchläuft dieselben drei Gründungsschritte wie jede andere (Boot-Grace, Delivery-Gate,
begrenztes Readiness-Warten) und schreibt eine Zeile in `context-receipts.jsonl`
(`programId: null` — eine Orchestratorin sitzt QUER zu den Programs). Scheitert sie, bleibt die
Session trotzdem offen: `roleCard` in der Antwort sagt, was passiert ist — die Tür schuldet dem
Owner die Pane, nicht die Karte.

Die Karte steht ausschließlich in [docs/rollenkarten.md](rollenkarten.md#orchestratorin).
`server.ts#ORCHESTRATOR_ROLE_CARD` übernimmt ihren Text bytegleich; `bun e2e/pins.ts` prüft das.
Dahinter hängt jeder der beiden Briefe genau eine KONTEXT-Zeile, gewählt nach dem Harness der
Session (`server.ts#orchestratorRoleCard`): codex bekommt die native Verdichtung ohne Schwelle,
jeder andere Harness die Schwelle unten — beide Zeilen stehen bytegleich in
[rollenkarten.md §Kontext je Harness](rollenkarten.md#kontext-je-harness).
Die Nachfolge
ändert daran nichts: sie nennt weiter den **Linien-Record** als die eine Übergabe (§Nachfolge unten,
`e3e5084a`); die Karte ist ein zusätzlicher TEXT, kein zweiter Kanal.

Der Einstieg für Orchestratorin und Standard-MAIN im Fleet-Repo ist genau `./state.sh --brief`.
Die Rollenwahl stammt aus `/api/self`: die Orchestratorin liest zusätzlich die gehaltene
Owner-Betriebssicht (vorhandenes Owner-Leserecht bleibt nötig), die MAIN nur ihre eigene
`program-execution`. Ein abschließender Self-GET prüft die genaue Besetzung und Zuordnung erneut.
Die Ausgabe nennt Abrufzeiten und HTTP-Anzahl: drei GETs bei einem erfolgreichen Rollenstart,
getrennte Beobachtungen, kein atomarer Zustand. Ein Rollen- oder Identitätswechsel verwirft die
Lage; fehlende Rechte, Quellen und Records erscheinen als `unknown` mit Grund.

Linien-Absicht, offene Pflichten, Nachrichten-/Inbox-/Attention-Zeilen und die nächsten Detailtüren
stehen im Einstieg. Volltexte bleiben an den bestehenden Türen; Lesen quittiert und armiert
nichts. Pflichtgruppen und Grenzen werden nicht hinter einem Zeilen-Cap versteckt: über zwölf
Zeilen nennt jede Gruppe einen Overflow samt Detailtür und druckt ihre Zeilen weiter. Der eigene
Linien-Record steht über dem Budget von 80 Zeilen / 10 000 Byte, nie darin: `intent` ganz (bis 2000
Zeichen) und bis zu zehn `line-obligation`-Zeilen, die mit Ziel (Re-Arm-Body) vor den reinen IDs.
Eine Lane-Zeile nennt `./ctl.sh task <id>` als Tür.
`./register.sh --brief` bleibt für bestehende Leser erreichbar, ist aber kein zweiter Pflichtabruf.
`./state.sh --full` und `./register.sh --full` wählen die vollständige Diagnose; ein unbekanntes
Flag endet mit exit 2. Game-Maker, Fremdrepo- und Lane-Einstieg behalten ihren Vertrag.

## Taking on a foreign repo as a Fleet project

This order prepares the founding before the first `bootstrap-main`. It describes the server contract as built;
configuration, trust and deletion acts stay with the owner or a concrete delegation from the owner. It performs
none of them itself. For later lane cards the neighbour holds: `AGENTS.md` §Rows for a repo that is not claude-fleet.

1. **Repo and rules first.** Name the target checkout as a git repo with a readable HEAD and branch. A non-empty
   root `AGENTS.md` must already be **committed in HEAD**; a file only in the working tree or the index is not
   enough. `server.ts#preflightProgramMain` checks `git cat-file -s HEAD:AGENTS.md` and otherwise refuses with
   `target repository requires a tracked, non-empty root AGENTS.md` (400). A non-git cwd and an unreadable
   HEAD or branch have their own refusals. The file carries the repo's own rules and verify instruction; Fleet's
   process state doesn't belong in the product repo. A game maker also needs its own linked worktree of the product
   repo, not the primary checkout and not a Fleet worktree (`server.ts#gameMakerMachineError`).

2. **Settle harness trust before the founding.** For Claude the target folder must already be trusted in the
   harness. `server.ts#CLAUDE_TRUST_DIALOG` recognises the visible dialog; `server.ts#canDeliver` refuses it as
   `blocked-screen: claude trust dialog`. `server.ts#bootstrapProgramMainReserved` then rolls the founding back and
   answers `Program-MAIN delivery held (...)` (500). The server doesn't accept the dialog itself. The remedy is an
   authorised trust confirmation in the harness for the exact target path. The entry
   `projects[<path>].hasTrustDialogAccepted` in `~/.claude.json`, as reported during onboarding, is a harness
   configuration route, **not a key Fleet reads or validates**; check that it works by seeing the dialog gone. This
   guide asks for no automatic change to that file.

3. **Configure the repo's own verify command before work is released.** The operator stores a non-empty command per
   repo in `FLEET_VERIFY_CMD_REPOS` and restarts the server, authorised, after an env change.
   `server.ts#VERIFY_CMD_REPOS` reads a JSON object once at module start; invalid JSON, a wrong shape or empty
   commands are ignored with a warning. Keys are canonical repo toplevels; `server.ts#verifyRepoKey` also finds the
   primary repo's entry for linked worktrees through the shared git directory. **Without an entry the gate is not
   simply unknown:** `server.ts#verifyCmdFor` falls back to `FLEET_VERIFY_CMD`; if that is missing too, verify is
   unconfigured. Fleet's global default chain stops with `SKIPPED` without `fleet-e2e.ts`. After the founding the
   first lane reads `GET /api/self/gate` and checks `verify.cmd` and the foreign repo's command in `localProof.note`.
   That is an early comparison, not a verify that has passed, and no precondition for bootstrap.

4. **Set parallelism on purpose.** Before the release, read the effective repo cap with `GET /api/repo-lane-caps`.
   Without an entry `server.ts#repoLaneCap` takes `FLEET_DISPATCH_MAX_LANES`; the code fallback is **3**, not a fixed
   1 (`server.ts#DISPATCH_MAX_LANES`). An operating env can set 1. For another authorised cap,
   `POST /api/repo-lane-cap` (`server.ts#fetch`) takes `{repo,maxLanes}`: the git toplevel must be readable and the
   value an integer between 1 and `REPO_MAX_LANES_MAX`. Otherwise 400, and existing values stay. 0 or null removes
   the entry and restores the machine default. The answer names `effective` and `source`; the setting works without
   a restart. A repo cap doesn't lift a program cap or a lack of free slots. A cap that is too small keeps dispatch
   waiting but doesn't stop a MAIN founding.

5. **Prepare knowledge by home and reader.** The mapping in
   [Project knowledge and deletion routes](messungen/2026-10-08-projektwissen-fremdrepo-schichten.md#ergebnis-vier-eindeutige-heimaten)
   is a reasoned recommendation: decisions in the program record, working rules in the repo's `AGENTS.md`,
   explanatory understanding of the project in the private project concept, the operative selection as a pack
   pointer. For start knowledge, `server.ts#repoManifestContextPlan` checks the **target repo's manifest at the
   receipted HEAD** and its tracked sources and anchors. Missing or unreadable sources and invalid packs are
   reported as omissions (`context-manifest.ts#planRepoContext`), not replaced by Fleet knowledge. Only the bound,
   active MAIN can write program packs (`server.ts#boundProgramForMain`); the self door
   `/api/self/program-context-packs` (`server.ts#fetch`) checks at most 5 packs with 4 tracked sources each at the
   integration HEAD. Invalid paths or anchors give 400 with `issues`
   (`context-plan.ts#validateProgramContextPacks`). They reach program lanes, not the MAIN founding brief. Arbitrary
   private project concepts are not automatically deliverable program packs today: provide an explicit private
   reading pointer with version and hash in the authorised order. `ebene:projekt` is no project access lock
   (`server.ts#konzeptKontextFor`; `konzept-ledger.ts#konzeptRequest`).

6. **Only now found the active program and prove delivery.** The owner confirms the proposal and activates it
   (`server.ts#handleOwnerProgramRoute`). Then `POST /api/programs/:id/bootstrap-main` takes `cwd`, harness, model
   and effort; a program that is not active gives 409, invalid spawn fields 400
   (`server.ts#bootstrapProgramMainReserved`). No free MAIN slot or a founding in progress gives 409. A MAIN that
   already lives gives `existing:true` without a second founding. After the boot, delivery and readiness checks, the
   brief delivery and the context receipt must succeed before the binding counts as a success. Read the answer and
   the exact new identity and program assignment; an open slot alone proves no founding. Then the MAIN checks the
   prepared knowledge pointers and the first lane its own gate contract, before more work is released.

7. **Make the deletion duty findable at onboarding.** In the authorised project inventory, name the readers, the
   places data is kept, the permitted retention and the later proof of deletion. The server refuses `complete` while
   duties are open unless `{force:true}`, but runs **no Vertraulichkeit deletion** (`server.ts#handleOwnerProgramRoute`). After
   completion `context-plan.ts#planProgramContext` only stops further pack delivery; `konzept-ledger.ts#konzeptOpOf`
   has no DELETE route, and `verwerfen` appends a status. Repo and git copies, former worktrees, scratch, harness
   transcripts and memory, concept versions, Fleet state and the ledger with its rotations, and backups, other
   hosts and providers all belong in the inventory of that knowledge note. Every deletion act needs its own
   authorisation and a check afterwards; `complete`, empty packs or a removed checkout prove nothing.

**Start pack and its limit.** `projekt-aufnahme` is an active hint with trigger `orchestration`:
`server.ts#BOOTSTRAP_CONTEXT_TRIGGERS` delivers it to the orchestrator and to a new MAIN **in the Fleet repo** at
start; normal lane dispatches don't set that trigger. `server.ts#programMainContextPlan` and
`server.ts#orchestratorFoundingContext` read the manifest of their cwd repo. So a MAIN in the foreign repo gets that
repo's own packs, not this Fleet manifest entry. The orchestrator has to pass on the onboarding hints it needs;
automatic delivery of this Fleet section across repo borders would be a server cut of its own.

**Follow-up cut: the remedy at the error instead of more failed tries.** The AGENTS 400 should name
`HEAD:AGENTS.md` and "commit it non-empty, then found again". The trust 500 should name the target path and the
authorised harness confirmation. For a foreign verify fallback, a hint would help that the repo entry is missing and
which global command was actually chosen; while dispatch waits, the effective cap, its source and
`/api/repo-lane-cap` should be visible. Knowledge and Vertraulichkeit deletion are no existing bootstrap 400s: each lacks a
function or a proof that a better error text alone doesn't replace.

## Werkzeuge

`ctl.sh` fügt keine Autorität hinzu; jedes Verb behält Credential, Scope und Server-Gate seiner Route.
Wo ein Verb `<slot>` nimmt (`ctx`, `watch lane|merge`, `land`, `wait merge`), darf seit S5 auch der Lane-Name stehen (`4A`): `ctl.sh` löst ihn über das `name`-Feld von `GET /api/sessions` auf, nie selbst; ein freier Name ist Exit 1 („no lane named …"), eine falsche Form Exit 2 vor jedem Request, und `watch` braucht für einen Namen das Owner-Token.
- **`ctl.sh get <pfad>`** liest EINE GET-Route unter `/api/` mit dem Credential, das diese Route verlangt: Owner-Token, fuer `/api/self` das Self-Token. `--keys` druckt statt des Koerpers die Feldform der obersten zwei Ebenen — die Antwort auf „[Zitat entfernt]“, ohne ein Ledger in den Kontext zu ziehen (das `suite.log` der Artefakt-Route sind 700+ KB). GET-only und `/api/`-only, beide Verweigerungen benannt statt still: eine Methode oder ein Body wird als solche abgelehnt, ein Pfad ausserhalb `/api/` ebenso, eine ganze URL mit dem Hinweis auf die Basis. Das Verb fuegt weder Route noch Berechtigung hinzu — was der Aufrufer nicht darf, beantwortet der Server weiter mit 401/403, und die Meldung nennt dann die QUELLE des Tokens (`FLEET_CTL_TOKEN`, `fleet.json`, die Pane-Env), nie seinen Wert. Die Routen, die es oeffnet und die in 14 Tagen kaum jemand las, stehen als Block „[Zitat entfernt]“ in der Ausgabe von `state.sh`.
- **`ctl.sh merges`** liest persistierte und laufende Land-Fakten; ohne Owner-Token bleibt die Live-Hälfte `unknown`.
- **`ctl.sh lock`** liest den Suite-Mutex; `--reap` ist der ausdrücklich schreibende, identitätsgeprüfte Sonderfall.
- **`ctl.sh ctx`** liest den gemessenen Kontextfüllstand; nicht messbar bleibt `unknown`, nie null Prozent.
- **`ctl.sh report`** liest den neuesten für den eigenen Occupant sichtbaren Task-Report; es ist kein Archiv.
- **`ctl.sh task <taskId>`** liest EINE Queue-Zeile samt Lane über `GET /api/lane?task=<id>` statt über `fleet.json`, `/api/sessions` und die Rohledger. Den Join macht der Server (`server.ts#resolveTaskLane`): eine lebende `sent`-Zeile über ihren Slot, sonst die `taskId` der Outcome-Zeilen (neueste zuerst), sonst `tasks-archive.jsonl` für eine Zeile, die `fleet.json` verlassen hat — das Archiv kennt die Zeile, nie die Branch. Die Slotnummer einer beendeten Zeile wird nie gelesen: sie gehört inzwischen womöglich einer anderen Lane. Die Route liefert dasselbe Dossier wie `?branch=` plus `resolved` (`result` `lane` mit `via` und allen Branches, `no-lane` mit Grund, oder **404** `unknown-task` mit den drei durchsuchten Quellen). Das Verb druckt je eine Zeile mit benannter Quelle: Status, Kartengültigkeit, Startplan-Grund einer wartenden Zeile (`releaseVerdict` + Wartenotiz des Ticks), Kopf des jüngsten Reports, Outcome, Audit; `--full` hängt Zeilentext und Reporttext an. Exit 1 nur für eine unbekannte Id; eine bekannte Zeile ohne Lane ist eine Antwort. Owner-Credential, nur lesend, bewertet keinen Report. Eine Wellen-Folgezeile findet ihre beendete Lane nicht — die Outcome-Zeile nennt nur den Kopf.
- **`ctl.sh audits`** liest den Tier-2-Trail über `GET /api/post-land-audits` statt aus `post-land-audits.jsonl`: je Zeile Zeit, `result`, `mainSha`, `covers`, `checks`, `fails` und die Adjudikation, die die Route an die Zeile hängt (`adj none`, wenn keine existiert — das Verb urteilt nicht). Die erste Zeile ist die Live-Hälfte aus `GET /api/sessions` (`postLandAuditLive`): `null` heißt Leerlauf, ein fehlendes Feld oder eine verweigerte Lesung `UNKNOWN`; ein offener Shard-Lauf eines Helfers steht dort als `RUNNING (sharded)` mit dem Stand je Shard (`k/n reported|running|open|closed`), nicht als `WAITING` (`server.ts#postLandAuditLiveView`). `--last N` (Default 10, mit Filter 1000 = Deckel der Route), `--fail <text>` zählt über alle gelieferten Zeilen und nennt Nenner und wie viele davon überhaupt eine `fails`-Liste tragen, `--sha <sha>` findet die Zeile, die auf dem Tip lief ODER den Land (`covers[].mainAfter`) mitprüfte; eine unbekannte sha ist Exit 1 mit „UNKNOWN to the trail", ein leeres Ledger die Zeile „ledger empty". Owner-Credential, nur lesend.
- **`ctl.sh watch`** armiert Lane-/Merge-/Audit-Watches; das ist keine stehende Controller-Pflicht und gewährt kein Land.
- **`ctl.sh events`** liest eigene Events; `--ack` quittiert nur bereits zugestellte passende Zeilen.
- **`ctl.sh inbox [--ack <id>|--ack-all]`** liest mit Self-Credential den Program-Rückkanal der gebundenen MAIN; `--ack` quittiert genau einen Eintrag, `--ack-all` die beim Lesen ungelesenen. Unbekannte Ids und Scope-Verweigerungen bleiben mit Status und Servertext sichtbar; Lane- und ungebundene Sessions erhalten keine Inbox-Autorität.
- **`ctl.sh comment <taskId> <textfile>`** hängt über die bestehende Owner-Tür einen Task-Kommentar an. Leere Texte und mehr als 2000 Zeichen werden vor dem POST abgelehnt; Server-Verweigerungen werden benannt, das Credential wird nie ausgegeben.
- **`ctl.sh file <cardjson>`** liest einen JSON-Task-Body mit `text` und `card{ziel, surface, done, verify, verboten}` sowie optionalen Filing-Feldern wie `kind`, `repo` und Spawn-Tripel. Mit Self-Credential geht er an `/api/self/tasks`, sonst mit Owner-Credential an `/api/tasks`; ein Self-Refusal wechselt nicht auf Owner. Die Zeile bleibt pending. Falsche Listenformen und Größenüberschreitungen werden vor dem POST benannt, semantische Karten- und Scope-Prüfungen bleiben beim Server; kein Dispatch, Release oder Land.
- **`ctl.sh land`** startet mit Owner-Credential einen Land; Controller-Scope gewährt dieses Credential nicht. Mit `--wait` endet die Warteschleife an genau DREI Fakten und benennt jedes Mal welchen: dem Verdikt, dem abgebauten Slot (der Land hat die Lane mitgenommen) oder dem RECYCELTEN Sitz — der Tick hat die freigewordene Slot-Nummer schon mit einer anderen Lane besetzt, und die Antwort kommt dann aus `lane-outcomes.jsonl`, das nach BRANCH schlüsselt und den Slot überlebt (`disposition`; ohne Zeile eine benannte Nicht-Antwort). Exit 0 heißt weiterhin nur „[Zitat entfernt]“ — auf dem recycelten Pfad sagt das das Ledger, nicht der freie Sitz. Das vierte Ende, Schweigen bis `FLEET_CTL_WAIT_MAX_SEC` (3600 s), war der Normalfall, sobald ein Platz frei wurde (gemessen 2026-09-08 02:22), und ist keines mehr.
- **`ctl.sh dispatch`** startet mit Owner-Credential eine Queue-Zeile; Controller-Scope gewährt dieses Credential nicht.
- **`ctl.sh wait merge`** wartet einmalig auf einen konkreten Merge-Terminalfakt statt in der Pane zu pollen. Es bindet an die LANE, die es beim ersten Poll auf diesem Slot sieht, nicht an die Slot-Nummer: wechselt der Sitz die Hand, endet der Wait mit einer benannten Nicht-Antwort und Exit 3 — derselbe Code wie ein verbrauchtes Budget, weil es dieselbe Aussage ist (über die gemeinte Lane wurde nichts gemessen), nur innerhalb einer Poll-Periode statt nach einer Stunde.
- **`ctl.sh wait change`** wartet einmalig auf eine benannte State-Änderung; es ist kein permanenter Portfolio-Monitor.
- **`ctl.sh send --main`** schickt eine Textdatei per Owner-`/send` an die MAIN eines Programs: `main.slot` wird aus `GET /api/programs` und `/api/sessions` unmittelbar vor dem POST gelesen, nie aus dem Gedächtnis. Abgesagt ohne POST wird bei fehlender oder staler Bindung, fremdem Occupant (openedAt ≠ Bindung — der recycelte Slot), Lane-Slot und fehlendem Agenten; ein nacktes `send <slot>` gibt es nicht. Welcher Text und wann bleibt Entscheidung der Aufruferin. Der POST selbst traegt das gebundene `openedAt`, damit das Fenster zwischen Lesen und Senden serverseitig zu ist (unten). In einer Fleet-Pane (Self-Token, kein Owner-Token übergeben) geht der Text stattdessen ins Postfach des Programs (`POST /api/self/messages`, `to:{kind:"program"}`); kommt er von der Orchestratorin, tippt Fleet den Hinweis sofort in die gebundene MAIN.
`send --lane <slot> <textfile>` nutzt ebenfalls Owner-Credential und liest den Lane-Occupant frisch aus `/api/sessions` (auch per Lane-Name): Nicht-Lanes, fehlende Pins und fehlende Agenten werden vor dem POST abgelehnt, Texte über 1 000 000 Zeichen ebenso. Der POST trägt das gelesene `openedAt`; ein 409 wegen Occupant-Wechsel bleibt wörtlich, eine erfolgreiche Quittung muss den Pin bestätigen.
- **Owner-`POST /send {slot, text, submit?, openedAt?}` — zwei Ablehnungen, beide ohne getippten Byte** (Anlass: 2026-09-14 12:08, ein `/send` an eine recycelte Slot-Nummer toetete eine gerade spawnende Lane):
  (1) **Occupant-Pin.** Wer den Occupant gelesen hat, gibt dessen `openedAt` mit; ist der Slot seither neu besetzt, antwortet die Route **409** mit `occupant: {slot, openedAt, sessionId, label, lane}` des aktuellen Occupants. Ein nicht-positives oder nicht-numerisches `openedAt` ist **400**. Ohne das Feld bleibt die Route unverpinnt wie bisher.
  (2) **Kein lebender Agent.** Deklariert der Harness Comms, prueft `sendText` den Agent-Prozess der Pane (`requireAgent`, nur diese Route): eine frische Pane (< `SEND_BOOT_FRESH_MS`) bekommt das begrenzte Boot-Warten (`SEND_BOOT_WAIT_MS`, Audit-Zeile `send_boot_timeout`), eine etablierte genau eine Probe. Ist danach kein Agent `alive`, antwortet die Route **409** mit `agent` (`no-agent`/`no-pane`) und `receipt.delivery:"refused"`, nichts im Journal. Ein Harness ohne deklarierte Comms (`unprobed`, z. B. `FLEET_CMD=true`) bleibt zustellbar. In eine Pane ohne Agent tippt der Owner ueber das Terminal selbst, nicht ueber die Compose-Route.
- **Jeder Send hinterlaesst eine Ledger-Zeile** (`audit.jsonl`, Event `send`) — geschrieben von
  `sendText` selbst und darum fuer JEDEN Kanal, nicht nur fuer diese Route: `path` (hier `owner`),
  `bytes` (tatsaechlich in die Pane gepastete UTF-8-Bytes; `0`, wenn eine der beiden Ablehnungen
  oben vor dem Paste greift — „nichts im Journal" heisst also nicht „keine Spur"), `acceptance`
  (das beobachtete Urteil oder das Wort des Wurfs) und `ctxPct` nur dann, wenn der Fuellstand der
  Empfaengerin messbar ist; ein fehlendes Feld ist „nicht messbar", nie 0 %. Daraus je Slot und
  LOKALEM Tag `inbound: {sends, bytes}` auf `/api/sessions` — nur ZUGESTELLTE Bytes, weggelassen,
  wenn heute nichts ankam.
- **`ctl.sh reply <messageId> <textfile|->`** antwortet mit Self-Credential in einem Aufruf: Die Adresse ist das `from` der beantworteten Nachricht aus der eigenen Sicht `GET /api/self/messages` (eine Id-Vorsilbe genügt, eigene Ausgangszeilen zählen nicht), `replyTo` ist ihre Id, der Schlüssel Id plus Texthash (dieselbe Antwort zweimal bleibt eine Nachricht). Danach `POST …/read` und mit `--log <datei>` eine angehängte Zeile (`--line` ersetzt sie). Über 2000 Zeichen, eine unbekannte Id oder eine fehlende Log-Datei: nichts wird gesendet. Lehnt der Server ab, wird nichts quittiert und nichts protokolliert.
- **`ctl.sh status`** liest in einem Aufruf, wo alles steht, eine Zeile je Fakt: Sitze (Slot, Name, Kontext, Ruhe seit, Branch) aus `GET /api/sessions`, laufende Merge-Checks (Prozesstabelle, nur Laufzeit und Branch-Argument, und `GET /api/branches`) und die drei jüngsten Urteile aus `merge-checks.jsonl`, Lands aus `GET /api/self/merges`, Audit jetzt und zuletzt samt Adjudikation (ein wartendes mit dem, was es hält, aus `pending` von `GET /api/post-land-audits`: `quiet until HH:MM`, `waiting for helper`, `disk-space-held`), Helfer und ihre Jobs, ungelesene Nachrichten (`--full` mit Text). Post und Lands über die Self-Türen; Sitze, Audit, Helfer und Branch-Sicht haben keine Self-Tür und gehen wie bei `get` mit dem Owner-Token (`FLEET_CTL_TOKEN`, `FLEET_TOKEN`, sonst `fleet.json`). Eine nicht lesbare Quelle (auch: keine Antwort, unerwartete Form, `ps` gescheitert) steht als UNKNOWN mit Route und Status da und macht Exit 1.
- **`ctl.sh commit main`** (auch `commit-main` geschrieben) wartet begrenzt (`--budget`, Sekunden) auf `merges` exit 0 und committet dann den bereits gestagten Index im Haupt-Checkout mit `-m <msgfile>`; sonst benannte Absage „a land is running (slot N) — nothing committed". Eine ungefragte Live-Hälfte (kein Owner-Token) ist `unknown` und sagt ebenfalls ab; das Verb staget nichts und umgeht keinen Hook. **Seit W5d** pusht dasselbe Verb den Commit anschließend ff-only auf `FLEET_HUB_REMOTE` (gelesen aus der `.env` des Checkouts; ohne die Variable wird nichts gepusht und nichts behauptet). Eine Ablehnung der Nabe ist **Exit 3** — ein eigener Code, nicht die 1 von „[Zitat entfernt]“: der Commit steht, er ist nur nicht auf der Nabe, und die Zeile nennt die beiden git-Kommandos, die das auflösen. Das ist der Preis dafür, dass ein Direkt-Commit unter zwei landenden Hosts sonst den nächsten Land dieses Hosts strandet (gemessen 2026-09-22: 1 h 54 min Verzug, 8 von 60 Commits).

## Arbeitsweise ohne Dauerpolling

1. Aktuelle Program-/Board-/Projektionsfakten lesen; fehlende Sicht als `unknown` benennen.
2. Den nächsten begrenzten Portfolio-Akt ausführen: koordinieren, bereits autorisierte Abschlüsse
   vollziehen oder eine echte Owner-Grenze vorlegen. Vorschläge werden erst durch Owner-Akte Programs.
3. Program-Arbeit der gebundenen MAIN überlassen. Ihr typisierter Report bzw. ein terminales Event
   kommt serverseitig; der Controller pollt weder Panes noch Projektionen auf Bewegung.
4. Merge-/Audit-Rückwege gehören zur landenden Program-MAIN.
5. Ausnahme, Widerspruch oder fällige Owner-Grenze knapp mit Quelle und Wirkung melden; nicht durch
   fremdes Landen, Deployen, Pane-Injektion oder erfundene Autorität beheben.

## Nachfolge — vier Fälle

- **Standard, exakt gebundene aktive Program-MAIN:** kein neuer `HANDOFF.md`-Commit als Gate. Fleet
  verschiebt die Bindung, persistiert Watch-/Auto-Pflichten und historische Attention-Zeilen im
  `handover`; offene Lane-Rückfragen und sofort fällige FleetEvents gehen an die Nachfolgerin.
  Nicht übertragbare Zeilen stehen mit ID und Grund in `handover.lost`; der Brief zeigt nur Vorschauen. Die Nachfolgerin liest Program-/Task-/Report-/Inbox-/
  Handover-Fakten und optional HANDOFF-Rest. Nichts wird neu armiert; Lücken bleiben `unknown`.
  **Eine MAIN mehrerer Programs** (je Projekt eine MAIN, Owner 2026-10-06; `docs/self-api.md`
  §Bindung) übergibt ALLE in einer Nachfolge: das erste Program trägt Founding-Marker und Receipt,
  jedes weitere wird im selben Schnitt umgebunden und bekommt seinen eigenen `handover`, seine
  Lineage (`succeed`), seine offenen Attention- und Rückfragezeilen. Ein FleetEvent geht mit dem
  Program, zu dem sein Objekt gehört (Report, Rückfrage, Lane; `server.ts#fleetEventProgramId`),
  und ein nicht übertragbares steht in dessen eigenem `handover.lost`; ein Event ohne beweisbares
  Program (etwa ein Watch der MAIN selbst) trägt das erste Program. Ein Program, das der Owner
  währenddessen abschließt oder umbindet, geht nicht mit und behält seinen Record. Ein Verbund mit
  einem Game-Maker-Program wird mit Namen abgelehnt (409). Nach einem Absturz zwischen Kill und
  Bindungsschnitt stehen die mitgehenden Programs stale; steht eine gebundene Nachfolgerin, bindet
  der Owner sie mit `bootstrap-main {slot}` an sie, sonst gründet er das erste Program neu und bindet
  die übrigen an dessen MAIN.
- **Ungebundene Legacy-Session, damit auch ein ungebundener Controller:** kein `HANDOFF.md`-Commit mehr
  als Gate (seit e3e5084a). Die Nachfolge schreibt einen Linien-Record (`docs/self-api.md` §Linien-Record):
  Pflichten nur per ID, dazu `intent` (≤ 2000 Zeichen) ODER `pointer` auf einen committeten, datierten
  Abschnitt. Der Brief nennt den Record; die Nachfolgerin liest ihn in `GET /api/self` → `lineage`.
  `carry` bleibt ein optionaler Satz und ist neben `intent`/`pointer` verweigert.
- **Game-Maker-Program-MAIN:** behält den frischen, committed `## Current game checkpoint` mit der
  geschlossenen Sieben-Felder-Form und einer im Repository vorhandenen Build-SHA. Kein `carry`;
  Nachfolge startet mit Launch, realer Eingabe, frischer Wahrnehmung und Build-Vergleich.

**In allen vier Fällen bleibt die Linie auf ihrem Slot** (seit 2026-09-22, `server.ts#respawnInPlace`;
Owner 2026-09-21: „[Zitat entfernt]“):
die Vorgängerin endet, die Nachfolgerin öffnet auf DEMSELBEN Slot mit neuem `openedAt` — keine
Grace-Frist mit zwei lebenden Sessions, kein „no free slot". Bindung und Linien-Record wandern direkt
nach dem Open, vor dem Brief; eine abgewiesene Zustellung lässt die Nachfolgerin gebunden stehen
(Audit `main_succession`), ein gescheiterter Respawn lässt den Slot leer und nennt im Audit Grund und
cwd zum Wiederöffnen. In beiden Fällen bleibt eine Nachfolge-Schuld mit dem gebauten Brief (und dem
Linien-Record, falls keine Nachfolgerin öffnete), dazu eine Owner-Inbox-Zeile; nachgesendet wird über
`POST /api/succession-debts/:id/resend` (`docs/self-api.md` §succeed). Während einer laufenden Nachfolge
verweigert der Deploy den srv-Restart. Das Band (`GET /api/slots/:id/succession`) zeigt die Linie damit dort, wo der Owner
sie zuletzt sah, eine Session weiter.

`POST /api/self/succeed` vererbt Harness und standardmäßig Modell/Effort, sofern der Body sie nicht
gültig überschreibt; die Lane hat ihre eigene Schiene (`server.ts#succeedLane`), der Steward wird
abgewiesen. Nach jedem externen Await wird die exakte
Occupant-Identität erneut geprüft. Keine Aussage hier behauptet, alle Reports, Watches oder offenen
Fragen würden automatisch übertragen.

**Owner-Nachfolge ohne Turn der Vorgängerin** (Owner 2026-10-06: „[Zitat entfernt]“
;
`server.ts#handleOwnerSucceed`). `POST /api/slots/:id/succeed` (Owner-Credential) beendet eine
RUHENDE Session und öffnet auf demselben Slot und cwd eine frische auf der ungebundenen Schiene
(`server.ts#succeedGeneric`, dieselbe wie oben); in die Pane der Vorgängerin wird nichts getippt.
Die Übergabe besteht aus zwei Dingen, die schon da sind: der **stehenden Übergabe**, die die Session
selbst in ohnehin laufenden Turns schreibt (`POST /api/self/handover`, `intent` ODER `pointer`, landet
als Kanal im Linien-Record), und dem **Transkript-Rest** seit deren Zeitstempel
(`server.ts#freshTranscriptTail`: nur Eingänge und Antworttexte, ohne Werkzeuge, neueste zuerst unter
24 000 Zeichen). Der Brief nennt Schreibzeit und Alter der Übergabe und hängt den Rest an. „Ruht"
ist dasselbe Prädikat wie bei `sleep` (keine Pane-Ausgabe binnen `MERGE_IDLE_MS`); eine laufende Pane
wird mit 409 `busy` abgewiesen. Ungebundene Sessions, die Orchestratorin und seit dem zweiten Schnitt
(2026-10-07) die exakt gebundene Standard-Program-MAIN: sie geht über `server.ts#succeedProgramMain`
(Program-Record im Moment des Kills, Bindungsschnitt), und ihre stehende Übergabe reist wörtlich als
Abschnitt hinter dem Founding-Brief — der Record gilt, wo beide sich widersprechen. Seit 2026-10-11
gilt das auch für `POST /api/self/succeed` der Standard-Program-MAIN (`server.ts#selfStandingHandoverLines`);
vorher kam die stehende Übergabe auf der Self-Tür nicht an. Auf der ungebundenen Schiene der Self-Tür
wird sie seit demselben Tag zum Kanal des Linien-Records, wenn der Body weder `intent` noch `pointer`
noch `carry` nennt (ein Body-Kanal gewinnt ganz), und der Brief nennt ihre Schreibzeit. Lane, Game-Maker
und Steward antworten mit benanntem 409 (`reason`) und behalten ihre eigene Schiene. Die
Schwellen-Hinweise der ungebundenen und der Standard-Program-Schiene nennen die stehende Übergabe als
Alternative, wenn gerade Arbeit läuft; steht eine frische (der Transkript-Rest seit ihr erreicht eine
Nachfolgerin noch ganz, `server.ts#standingHandoverFresh`), kommt kein weiterer Hinweis. Lese-Tür für
den Knopf: `GET /api/slots/:id/succeed` (`docs/self-api.md` §handover).

**Harness-Wechsel geht NICHT über `succeed`** (`server.ts#handleSelfSucceed`: „that harness is not
overridable here" — nur Modell/Effort innerhalb des geerbten Harness). Der Weg, gegangen am 2026-09-23
für die Orchestratorin von claude/Opus 5.5 auf codex/gpt-6-sol (Owner: „[Zitat entfernt]“
): `POST /api/slots/:id/open`
auf einem freien Slot mit `harness`/`model`/`effort` und einem Label, das `server.ts#isOrchestratorLabel`
erkennt — dann liefert `server.ts#deliverOrchestratorSpawnCard` die Rollenkarte. Einen Linien-Record
schreibt dieser Weg nicht; die Übergabe trägt deshalb ein committeter `HANDOFF.md`-Abschnitt (echte
Nachfolge nach Regel A), auf den die Vorgängerin die Nachfolgerin per `/send` zeigt, bevor sie endet.
Codex lädt `AGENTS.md`, nicht `CLAUDE.md`: der Hinweis nennt die benötigten Regelbuch-Abschnitte namentlich.

## Succession without a cold resume

For a Claude session we recommend: **succeed in the still-warm turn as soon as the effective handover threshold is
reached and nothing is in flight that lives only in this session.** Measure your own fill with `./ctl.sh ctx`. The
effective threshold is `succession.thresholdPct` in the slot brief and on the board (`GET /api/slots/:id/brief`,
`server.ts#successionFacts`, `docs/self-api.md` §succeed). If those facts weren't delivered, clarify the effective
setting with your own receiver; missing values stay `unknown`, and a threshold that is switched off is no trigger.
The owner's setting for this occupancy goes before the Fleet default (`server.ts#patchHandover`). This pack sets no
threshold and grants no extra authority to succeed: your own role card and succession rail hold, in particular the
lane end of the harness. Codex compacts natively; this cache measurement gives no work stop and no succession there.

The [usage measurement of 07.10.](messungen/2026-10-07-cache-lebensdauer-nachfolge.md) finds **about 60 minutes of
cache life** on this host in the main Claude conversation: 3 043 of 3 043 pauses between 5 and 60 minutes were hits;
from 62 minutes on, 270 of 270 resumes were cold. Right at the edge: the last hit at 60.13, the first miss at 60.21
minutes (25 pairs from 22 sessions in the 58–62 minute band). That is an observed transition zone, not a guaranteed
deadline. A shared base can stay warm even though the conversation is rewritten. As a planning buffer, **be done
before 55 minutes since the last usage**; the five minutes of reserve are a recommendation, not a measured timer. If
the threshold is already reached and the handover is possible, act in the running turn; don't wait for that buffer.
Tool run time counts toward the cache pause when no new model call refreshes the cache.

Make these durable first:

- Commit changes. Put the result, the evidence, the open work and the next act where your successor can read them.
  Open duties carry their IDs and their authoritative source. Update a standing handover in the turn that is running
  anyway; for the unbound rail and the standard program MAIN that is `intent` or a pointer to a committed section
  (for the program MAIN next to the program record, which wins in a contradiction), for a game maker the full
  checkpoint. The four cases in `docs/controller.md` §Nachfolge — vier Fälle hold; no extra HANDOFF commit for standard MAINs.
- Let running subagents finish and secure their results: they don't survive your death. An announced result or a
  tool handle in the conversation is no handover. An independent Fleet lane is no such subagent; keep its report
  and its way back as a durable duty.
- Check watches, autos, unacknowledged events and open reports. On the unbound rail Fleet re-sets armed watches and
  autos with their target for the successor; the line record names `rearmed` or `notRearmed` for each duty
  (`docs/self-api.md` §Der Linien-Record). For a bound standard program MAIN, Fleet persists transferable duties in
  the `handover`; lost ones stand in `handover.lost` (§Nachfolge — vier Fälle). Before the end, make the source and the way
  back of work still running readable; after the cut, show the transfer or re-arming. A watch alone is no proof
  that its result arrives.

**Waiting at the threshold pays for the old history once more.** At 40 % of a 1M window, that is 400 000 cached
input tokens, rewriting them in full for 1 h costs $3.20 for Opus 5.5 instead of $0.08 of cache read: **$3.12
extra, a factor of 40**. These are [API list-price equivalents](https://platform.claude.com/docs/en/about-claude/pricing)
(07.10.2026), not a measured subscription bill. A base that stays warm lowers the rewrite; output, new input and
the successor's grounding come on top. Measured on cold resumes from 62 minutes: a median of 199 779 write tokens;
on warm pauses of 5–60 minutes: 614. Whoever is woken after an hour only to hand over pays for the large old
history and then for building the successor. If the handover is still blocked, secure the duty and its reason while
the cache is warm; don't derive keepalive pings from this. For an unbound session, orchestrator or standard program
MAIN that is already cold, there is the owner succession without a turn of the predecessor (§Nachfolge — vier Fälle); it
gives the session no owner authority.

This is measured knowledge and a recommendation for the existing succession. The server hint `tickMigrate` checks
fill, threshold and deliverability and stays silent for a fresh standing handover (`server.ts#standingHandoverFresh`);
it implements no cache expiry and doesn't wait for running subagents. The cache expiry is handled per session by the
owner switch keepCache (`server.ts#tickKeepCache`, `docs/self-api.md` §keepCache): before the measured hour runs
out, an idle session above its threshold is succeeded without a turn of its own or, while work is foreseeable, kept
warm with a short turn. It doesn't read a running subagent either; while one runs, the pane isn't idle, and neither
act applies. Without the switch, the same tick warms a bound claude program MAIN and the orchestrator with a short
turn after 50 min idle, switchable off per occupancy (`docs/self-api.md` §Default-Warm-Turn).

### When, and what comes first

- **Fleet names the moment.** Hand over when Fleet's hint comes. The number behind it lives only in Fleet's
  setting for your slot (`succession.thresholdPct` and `capPct`, which the brief shows and
  `GET /api/slots/<n>/handover` answers). Keep no threshold of your own: a number in a note or a pack goes stale
  silently and overrides the setting the owner sees and changes.
- **Not earlier.** A handover before the hint throws away context the successor has to buy again. A plannable
  chain that is already running (land, audit, deploy) runs to its end even if it carries past the hint. Start no
  chain whose plausible cost carries past `capPct`.
- **The handover is yours to trigger.** It is part of finishing the work, not a task someone orders. Don't
  announce it and wait for a yes. It describes the finished state, so close what is in flight first, and it
  carries only what git doesn't: intent, what is in flight, corrections, the order and its why.
- **A phase change asks for a fresh session.** When a phase is done, or the owner corrects a base assumption, a
  long session keeps writing addenda to addenda and derives its proposals from old plan sentences instead of his
  words. Then write the state as one page at the top of the plan, move the history out, and succeed in the same
  slot, because mailbox and the openers of your strands hang on the slot. Don't wait for the hint for this.
- **Read your mailbox before you build and before you hand over.** A message from your counterpart can arrive
  seconds after your start, and the delivery hint comes later than the message. Read
  `GET /api/self/messages?unread=1` after you have read your start and before each large step (test instance,
  commit, message to the owner). Before `succeed`, write what is unread into your strand's state file and commit
  it. A successor reads the messages of her line, but the board's mailbox tab shows only the current occupancy.
- **Subagents die with you.** A background subagent lives in your session's process and ends with it, and its
  scratchpad is session-owned. Work that should outlive a succession runs as a lane. If a subagent is running,
  prepare the handover, wait for its result, check it, forward it, then succeed. Have subagents write results
  into a durable folder, never only into the scratchpad.

## Kontext-Hinweis des Servers

Der Tick `server.ts#tickMigrate` (nur registriert bei `FLEET_MIGRATE_PCT > 0`) stupst ausschließlich
Slots der claude-Harness an; codex/pi/pi-zai sind nicht zuständig, nicht 0 %. Seit K9 S3 entscheidet
`server/succession.ts`: die Schwelle je Art Session (`thresholdOf`, Orchestratorin 45/50, Program-MAIN,
Bau-Session und andere 40/45, Lane 37/42; die Env verschiebt die Basis außer bei der Orchestratorin), die
Stufe (`thresholdStep`: Hinweis an der Basis, fällig an der Obergrenze oder kalt darüber) und EIN Text
(`hintText`): Füllstand, Schwelle, „Fleet übergibt nicht selbst“, dann die stehende Übergabe und
`succeed`; nur eine Lane bekommt ihren eigenen Ausgang (commit, `handoff`-Report, `succeed`). Der
Hinweis kommt auch mitten in der Arbeit. Er ist ein Server-Prädikat, nicht das Gate; das Gate bleibt
`handleSelfSucceed`.

## Two traits an orchestrator has paid for (measured 2026-10-02)

**The succession threshold is the effective setting, not a number on the card.** Orchestrator slot 9 handed over on
2026-10-02 at about 00:50, at a measured 30 %, because its role card ("decision at 25 % measured, no new deep work
from 30 %") said so. `FLEET_MIGRATE_PCT='40'` held then, and the owner found the early succession „[Zitat entfernt]“. Since
the owner promoted the setting the same day: the Fleet defaults are `FLEET_MIGRATE_PCT` (MAINs and orchestrator) and
`FLEET_LANE_MIGRATE_PCT` (lanes); an owner setting for the concrete occupancy goes before them
(`server.ts#patchHandover`). The effective number is in the slot brief and on the board
(`GET /api/slots/:id/brief` → `succession.thresholdPct`), your own fill in `succession.fill` or `./ctl.sh ctx`.
The historical 45 % mark replaces no setting of today. **This holds for claude, not for codex** (owner correction
2026-09-30): a codex orchestrator compacts natively, its measured fill is a display, and neither the threshold nor
45 % starts a work stop or a succession there. A deliberate succession still owes the card's full line record.

**Five armed watches mean: no report can reach you.** `server.ts#slotDeliveryBudget` computes
`free = cap − open events − armed watches`, and `cap` is `FLEET_EVENT_MAX_OPEN_PER_SLOT = WATCH_MAX_PER_SLOT = 5`.
Whoever arms five watches (measured: four lane watches and one merge watch after a succession) has `free = 0`. A
`fleet-report` from a hand-founded lane to this session then gets 409 `fleet-report receiver has no FleetEvent
delivery budget`, although the lane watch on exactly that lane is the receiver record the report needs. There is no
route to remove a watch; a watch gives its budget back only when it fires. The rule: **arm at most four watches and
keep one place free for deliveries**, and read merge and audit outcomes through a background waiter on
`GET /api/slots/:id/merge` (`running:false`) rather than a fifth watch. Acknowledge open events with
`./ctl.sh events --ack`, or they hold budget too.
