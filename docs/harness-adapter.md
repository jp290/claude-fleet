# Harness-Adapter & Betriebs-Konfiguration — Nachschlage-Referenz

**Herkunft:** Nachschlage-Teil von `CLAUDE.md` §Deploy, umgezogen 2026-08-18 (Kontextlast-Kette,
Inventar: `docs/rulebook-inventar-2026-08-18.md`). Die Betriebs-Regeln und Gefahrensätze stehen
weiter in `CLAUDE.md`; hier liegt die Tiefe. **Bei Widerspruch gilt der Code, nie dieses Dokument.**

## PATH (launchd-Spawn-Umgebung)

- launchd-Kontext hat weder ~/.local/bin (claude) noch ~/.bun/bin (bun) noch brew im PATH — watchdog.sh muss
  alle drei exportieren, denn Server-PATH wird in jede Pane gebacken. Symptom sonst: "zsh: command not found:
  claude/bun" in neuen Slots.

## Land-Pfad-Flags

- Land-path flags (in `watchdog.sh`'s srv-spawn env — die Deploy-Identität dagegen in `.env`, s. o.; grep die
  const in server.ts für den Kontrakt): `FLEET_MERGE_REPAIR_ROUNDS` (default 2, the resolver↔verify repair
  loop) is ON. `FLEET_CLEAN_REVIEW` (der ② clean-path-Reviewer) steht seit 2026-07-28 auf **`off`** —
  First-principles-Entscheid „nur eine Harness": die K2-Shadow-Serie ist beendet (45 Rows, 37 valide, alle
  „pass", 0 Widerspruch, 8 invalid — der Richter lieferte nie Information; Register: `lane-outcomes.jsonl`,
  Konzept: `docs/attic/judge-calibration.md`). Der Code (drei Werte `off|shadow|1`) bleibt; Wieder-Einschalten
  wäre ein env-Flip, braucht aber erst eine bestandene Feuerprobe. **`FLEET_HARNESS_AUTOMATION=1` steht seit
  2026-08-07 (Owner-Entscheid, `4955444`) in derselben Zeile** und beantwortet genau eine Frage: darf ein
  UNBEAUFSICHTIGTER Pfad einen Slot mit fremdem Harness anfassen (Autos, Dispatch, Steward-Send, done-looking
  → `/api/self/watch`, auto-③)? Zwei Bedingungen, nicht eine: der Flag ist die Zustimmung des Operators,
  `automatable: true` am Adapter ist der Anspruch des einzelnen Harness — ein morgen dazukommender Adapter
  erbt die Erlaubnis also NICHT (die Container-Zeile `c3531b41` ist genau dieser Fall). **Was der Flag NICHT
  öffnet, und das ist der Grund, warum er entscheidbar war: kein Tick landet.** Beide
  `mergeJob(`-Aufrufstellen sind Routen (seit 2026-08-24 zwei: die Owner-Merge-Route und
  `server.ts#selfLandTaskForMain`; `e2e/pins.ts` liest zusätzlich die Tick-Bodies), also tippt jeder
  geöffnete Pfad einen PROMPT in eine Pane und keiner schreibt auf main. Der Default-Adapter fragt den Flag nie (sonst wäre eine Variable ein
  versehentlicher fleet-weiter Kill-Switch). Am Tag des Einschaltens war die Wirkung **null** — kein Slot fuhr
  einen fremden Harness (an `fleet.json` geprüft); er bewaffnet eine Fähigkeit, statt Verhalten zu ändern. Die
  Suiten setzen ihn explizit auf `0` (`e2e-isolated.sh`), damit `§6c` nicht an der Shell des Operators hängt.
- **`FLEET_LANDS` (seit 2026-09-05, Dual-Host S2) — darf DIESE Fleet die Integrationsbranch überhaupt
  schreiben?** Default OFFEN (nicht gesetzt = landen wie bisher), `0/off/false/no` sperrt,
  `1/on/true/yes` öffnet ausdrücklich, ein unerkannter Wert loggt eine Zeile und bleibt OFFEN — ein
  Tippfehler darf den kanonischen Host nicht stranden. Gesperrt antworten BEIDE Türen auf den
  Land-Pfad (Owner-Merge-Route und `server.ts#selfLandTaskForMain`) mit
  `409 this instance does not land — it follows a canonical main`, und zwar vor jedem Schreibakt: kein
  Job, kein `mergeLast`, keine `lane-outcomes`-Zeile, keine Land-Note. Der Wert steht als `lands` auf
  `GET /api/sessions` (einmal, neben `instance`) und auf `GET /api/self/gate`; das Board blendet die
  ⏏-Knöpfe aus. Gedacht für den FOLGER-Host, der `main` per `fleet-sync.sh` fast-forwarded — der
  kanonische Host setzt die Variable nie. Nicht in `watchdog.sh`: die Sperre ist eine
  Host-Entscheidung des Folgers und gehört in dessen `.env`.

## Instanz-Identität und Umschalter (Dual-Host)

- **`FLEET_INSTANCE` (seit 2026-09-04) — wie heißt DIESE Fleet?** Ein Wort des Operators, nie aus
  der Maschine abgeleitet (kein Hostname, keine Adresse, kein cwd — das Repo ist öffentlich, und ein
  Hostname in einer Antwort ist ein Hostname im Screenshot). Charset und Normalisierer:
  `src/protocol.ts#INSTANCE_NAME_RE` / `#instanceNameFrom`. Fehlend oder ungültig faltet auf `null`,
  ausdrücklich NICHT auf ein Default-Wort: zwei unbenannte Instanzen mit demselben erfundenen Namen
  sind genau die Verwechslung, gegen die das Feld existiert. Sichtbar als `instance` einmal pro
  `GET /api/sessions` und auf jeder Report-Zeile (`FleetReport.provenance.instance`).
- **`FLEET_INSTANCES` (seit 2026-09-05, Dual-Host S3) — welche ANDEREN Fleets darf das Board
  verlinken?** JSON-Array aus `{name,url}`; `name` gegen dasselbe `INSTANCE_NAME_RE`, `url` gegen
  `src/protocol.ts#INSTANCE_URL_RE` — Schema (`http`/`https`), Host, optionaler Port, ein optionaler
  Schrägstrich am Ende wird abgeschnitten, **sonst nichts**: kein `@` (Userinfo), kein Pfad, keine
  Query, kein Fragment, kein IPv6-Literal. Das ist kein Schmuck, sondern die Garantie selbst — der
  String landet im `location.assign` des Boards, und der Charset ist der Grund, warum ein Umschalten
  keine Credential tragen KANN. Ungültige Einträge werden **einzeln verworfen und geloggt**
  (`[fleet] FLEET_INSTANCES: dropped — entry #<i> …`); ein kaputter Eintrag kostet die guten nicht,
  und ein unparsbarer Gesamtwert lässt das Board laufen (eine Zeile, kein Umschalter). Die Liste ist
  in BYTES gedeckelt (`src/protocol.ts#INSTANCE_LINKS_MAX_BYTES`), weil die reale Schranke die
  14-KiB-Messung von `/api/sessions` ist (`e2e/tasks.ts`). Projiziert als `instances`, **weggelassen
  wenn leer** — anders als `lands`, wo Abwesenheit „ja" heißen musste; hier sagen ein alter Server
  und ein neuer unkonfigurierter dasselbe.
- **Was der Umschalter NICHT ist: Föderation.** Kein Proxy, kein geteiltes Token, kein
  Outbound-Request — `server.ts` hat weiterhin genau ein `fetch(`, den `Bun.serve`-Handler. Ein Klick
  ist der BROWSER, der auf eine andere Origin geht; jede Instanz behält Login und Cookie, weil ein
  Cookie per Origin gilt. Dieselbe `FLEET_INSTANCES`-Zeile darf auf BEIDEN Hosts stehen: das Board
  entscheidet über den Origin-Vergleich, welcher Eintrag „you are here" ist. Der Kopfzeilen-Chip
  zeigt den eigenen `instance.name`; ohne Namen UND ohne Liste ist die Kopfzeile unverändert.

## Tool-Scoping

- **Agenten-Tool-Scoping: `--allowedTools` ist ADDITIV zur Allow-Liste in `~/.claude/settings.json`.** Ein
  blankes `Read`/`Grep`/`Glob` dort bedeutet JEDE Datei der Maschine, und geklammerte Muster (`Read(**)`)
  allein sind darum **nachweislich wirkungslos** — der Canary außerhalb des Worktrees wurde weiter gelesen.
  Erst `--setting-sources ""` lässt die Anker binden (empirisch, 2026-07-25, `MERGE_TOOLS` in server.ts). Für
  Agenten, die gar keine Tools brauchen, ist `--tools ""` das richtige Mittel: ein Fähigkeits-Schnitt, den
  settings.json nicht aufweiten kann (`TEXT_ONLY_TOOLS`). Und beim Probieren: **eine Modell-Weigerung („das
  mache ich nicht") beweist NICHTS** — nur eine mechanische Harness-Verweigerung zählt, wörtlich zitiert.

## Post-Land-Audit (Stufe 2)

- **Stufe 2, der Post-Land-Audit, ist seit 2026-07-25 LIVE** (`FLEET_POSTLAND_AUDIT_CMD` in `watchdog.sh`):
  nach jedem Land, das main bewegt, läuft die volle `./e2e-isolated.sh` gegen den Integrations-Tip — **neben**
  dem Land-Pfad. Das Env-Kommando ist fleet's Suite; sein Repo-Guard exitet ausserhalb claude-fleet mit 42, und
  bis 2026-09-02 war Stufe 2 damit in jedem fremden Repo für immer `unknown` (private-repo-p: drei Lands). Seither
  wählt ein Repo sein eigenes Kommando über den Repo-Worker `audit` (§Repo-Worker unten) — z. B. ein Wrapper um
  `sh scripts/verify.sh`. Ein Grün eines fremden Verify prüft man wie jedes: `ms` + `checks{ran}` — ein Skript,
  das keine `PASS `-Zeilen druckt, liefert ehrlich `ran:0` bei exit 0 (docs/verify-tiering.md §13). Sie gated nichts und macht nichts rückgängig; Ergebnis grün/rot/unknown auf
  `post-land-audits.jsonl` (`GET /api/post-land-audits`).
  **Seit 2026-09-04 (Owner) ist Stufe 2 PROPORTIONAL**: ein Eintrag, dessen JEDER Cover ein Land mit
  dem Docs-only-Stempel des Land-Gates ist, läuft mit derselben kurzen Kette wie sein Gate
  (install+pins) statt mit der vollen Suite — entschieden am koaleszierten Eintrag
  (`server.ts#entryRunsShortChain`, gefahren in `server.ts#runPostLandAudit`), also kippt EIN
  Code-Land im Burst den ganzen Tip zurück auf die volle Suite. Die Zeile trägt dann
  `proportional:true` + `steps:["install","pins"]` und `cmdSource:"proportional"`; fehlt der Stempel,
  war es die volle Kette — Abwesenheit ist nie Harmlosigkeit. Ein proportionaler Eintrag wird dem
  Helfer-Portal weder angeboten noch für es zurückgehalten (`server.ts#helperJobsView`,
  `server.ts#helperClaim`), weil der Daemon die volle Suite fährt und damit etwas anderes messen
  würde als die Frage. **Seit 2026-09-13 wartet ein Eintrag auf einen VOLLEN Helfer**
  (`server.ts#helperSaturation`): ist jedes claim-fähige Gerät voll und kennt der Server dessen
  Claims, läuft die Gnadenfrist bis zum frühesten Claim-`expiresAt` plus zwei Sweep-Intervalle,
  gedeckelt bei `FLEET_VERIFY_WAIT_MS`; dieselbe Lesung liefert einer Lane `waitPolicy.unclaimedMs`
  am Suite-Offer. Jeder lokale Lauf nennt seinen Grund in `server.log` (`post-land audit LOCAL: …`).
  **`FLEET_AUDIT_SHARDS=n` (2..8) teilt einen Helfer-Audit in n parallele Jobs** (`server.ts#AuditShardRun`):
  ein offerierbarer Eintrag erscheint als n Audit-Jobs mit `shard:"k/n"`, jeder läuft auf dem Daemon mit
  `FLEET_E2E_SHARD=k/n` (`helper-daemon/daemon.ts#shardEnv`) und belegt dort einen Suite-Slot. Der ERSTE
  Shard-Claim baut das eine Bundle und friert Covers und Sha ein; alle n Shards messen damit denselben Baum.
  Die Zeile entsteht erst, wenn jeder Shard terminal ist (`server.ts#writeShardedAuditRow`, dieselben Senken
  wie ein ungeteilter Helfer-Audit): **grün nur, wenn alle n grün berichten**; ein Rot macht die Zeile rot
  (vereinigte `fails`); ein verfallener, nie geclaimter oder unmessbarer Shard macht sie `unknown`, nie grün.
  `ms` läuft vom ersten Claim bis zum letzten Ergebnis, `checks.ran` ist die Summe, `shards[]` nennt je Shard
  `k, jobId, result, ms, ran, failed, exitCode`. Angeboten und geclaimt wird ein Shard nur von einem Gerät,
  dessen letzter Heartbeat `features:["audit-shard"]` trägt (die Liste kommt aus dem Daemon-CODE und wird
  bei jedem Beat ersetzt, ein zurückgerollter Daemon verliert sie also sofort). Ohne ein solches Gerät hält
  die Gnadenfrist nichts fest, und der lokale Lauf bleibt ungeteilt. Fehlt der Wert, ist er 1 oder
  unlesbar (dann eine Logzeile), ist alles wie vorher. Bekannte Grenze: nur der Shard, der die Zeile
  schreibt, erhält `artifactAt`, also hängt höchstens EIN `suite.log` an der Zeile. Rollout-Reihenfolge:
  Deploy, Daemon-Update, erst dann `.env`; zurück geht es über `.env`.
  Anlass, am Ledger nachgelesen: 76f3376 und 10ba7af (2026-09-04), je EINE
  Docs-Datei, bekamen je ein volles `./e2e-isolated.sh` — 1562 s bzw. 1530 s, beide ROT, 9 bzw. 1
  von 3633 Checks gefallen, beide als Flake adjudiziert. Beide liefen zufaellig auf dem Helfer, es
  kostete also 52 Minuten der ANDEREN Maschine plus Claim-Fenster; lokal waere es dieselbe Zeit am
  Suite-Mutex dieser Maschine gewesen. Achtung: `undo-land`, der als Rollback dazu genannt
  wird, gilt für genau EIN Land und nur bis zum nächsten (`server.ts`, grep `undoableFor`) — im Burst ist er
  beim Alarm schon weg. **Seit `0b98fdb` ist ein rotes Ergebnis beurteilbar**:
  `POST /api/post-land-audits/adjudicate {at, verdict, note}` (Owner,
  `verdict ∈ real|flake|stale-test|unknowable`, Urteile auf `audit-adjudications.jsonl`, neuestes gewinnt).
  Das Rot bleibt dabei rot — die Adjudikation sagt nur, dass jemand geurteilt hat, und genau das unterscheidet
  „hingesehen, war Rauschen" von „niemand hat hingesehen". Der Rundgang führt seither nur noch
  **un-adjudizierte** Rote als Section-1-Kandidat. Einen Knopf im Board gibt es dafür noch nicht.

## auto-③

- auto-③ (der Reviewer läuft von selbst auf einer `done-looking` Lane) ist **AN per Default** — anders als
  `FLEET_CLEAN_REVIEW`, und bewusst: er entfernt eine Wartezeit, gated nichts und ist an keinen
  Land-/Merge-/Dispatch-Pfad verdrahtet. Knöpfe: `FLEET_AUTO_REVIEW_MS` (Tick, default 15000; **`0` schaltet
  den Tick komplett ab**) und `FLEET_AUTO_REVIEW_IDLE_MS` (Idle-Schwelle, default 60000). Konsequenz, die man
  wissen muss: **ab dem ersten srv-Restart nach dem Land spawnen unaufgefordert echte claude-Sessions**
  (`SUMMARY_MODEL`, max 2 gleichzeitig, genau einmal pro Git-State, nie auf `⚙ steward` oder einem
  Nicht-Lane-Slot). Ein Harness ohne `FLEET_REVIEW_CMD`-Stand-in MUSS `FLEET_AUTO_REVIEW_MS=0` setzen, sonst
  startet die Suite einen echten Agenten — `e2e-claude-gate.sh` und `e2e-clean-review.sh` tun das deshalb.
- **Zwei Türen, zwei Schalter (2026-09-14).** Der fleet-weite Schalter `FLEET_AUTO_REVIEW_MS` und das
  Zeilenfeld `Task.review` sind ZWEI Türen zu demselben Reviewer, und keine öffnet die andere.
  `review: "advisory"` an einer Task-Zeile (gesetzt beim Filen `POST /api/tasks`, über beide Brief-Türen
  oder den ③-Haken am Board, `POST /api/tasks/:id/review`; `"none"` löscht das Feld) lässt ③ auf der Lane
  DIESER Zeile laufen, sobald sie done-looking ist — **auch bei `FLEET_AUTO_REVIEW_MS=0`**. Dann läuft
  `server.ts#tickAutoReview` im Opt-in-Modus auf eigener Periode `FLEET_REVIEW_OPTIN_TICK_MS` (default
  15000; `0` schließt diese Tür ebenfalls) und überspringt jede Lane, deren Zeile nicht fragt, VOR jedem
  Git-Read — der Kill-Switch bleibt für alle anderen zu. Ist der fleet-weite Tick an, bedient er die
  Opt-in-Zeilen mit. Das Verdikt steht wie immer auf der Outcome-Zeile (`review`) und wird zusätzlich als
  FleetEvent `lane-review` gefilet (`server.ts#fileLaneReview`): an die live gebundene Program-MAIN der
  Zeile (Pane), sonst — kein Program, keine live MAIN oder kein Zustellbudget — in die Owner-Inbox 📥. Das
  Event trägt `diffSha` (`git patch-id --stable` des gelesenen Diffs), `head`, `model`,
  `describedThisDiff` (`null` = nicht feststellbar) und die Findings. Ein Diff bekommt genau EIN Verdikt:
  ein Amend/Rebase ohne Diff-Änderung spawnt keinen zweiten Reviewer. **Es gated nichts** — kein Land,
  kein Dispatch, kein Report-Urteil liest es; ein Land ohne oder gegen das Verdikt bleibt möglich. Ein
  `required`-Modus (MAIN-Selbstlandung verweigert ohne Verdikt) ist bewusst NICHT gebaut: erst `advisory`
  messen.

## Modell-Tiers

- Modell-Tiers: `DEFAULT_MODEL` (`server.ts`, override `FLEET_MODEL`) = Sessions/Lanes ohne eigenen Pin;
  `SUMMARY_MODEL` (override `FLEET_SUMMARY_MODEL`) = alle Wegwerf-Worker (summarize, Commit-Msg, enhance,
  Merge-Resolver, ② review, digest). Beide werden gegen `MODEL_RE` validiert.
- Ein lebender Slot wechselt sein Modell/Effort im DATENSATZ über `POST /api/slots/:id/model` (Owner,
  kein Respawn; `docs/self-api.md` §model) — Heal, `↻ restart` und Nachfolge spawnen danach damit. Die
  Nachfolge (`POST /api/self/succeed`) nimmt dasselbe Paar optional als Override. Beides wird nach der
  Harness des Slots validiert: `supports.model`/`supports.effort` + `effortLevels` des Adapters (codex
  übersetzt Effort in `--thinking`, siehe §Harness-Adapter), nie nach dem Server-Env.

## Repo-Worker

- **Der Worker eines Repos wird AM REPO gespeichert, nicht im Env — seit `b64cd54` (2026-08-08), zuerst nur
  `commitMsg`, seit 2026-09-02 auch `audit`.** `FLEET_COMMIT_CMD` ist damit nur noch der DEFAULT; ein persistierter Eintrag pro Repo gewinnt
  darüber (`POST /api/repo-worker {repo, worker, cmd}`, **owner-only**; lesen: `GET /api/repo-workers` →
  `{keys, workers}`, wobei `keys` sagt, was überhaupt konfigurierbar IST — „kein Override" wird so von „nie
  verdrahtet" unterscheidbar). Zwei Konsequenzen:
  - **(1) Zustand nie behaupten, sondern die Route fragen** — der Wert liegt in `fleet.json`, nicht im Env,
    also sieht der `config sensor` von `./state.sh` ihn nicht.
  - **(2)** Der gespeicherte Wert ist ein absoluter PFAD auf ein Executable, nie eine Kommandozeile
    (`WORKER_CMD_RE`; `runWorker` spawnt in Array-Form ohne Shell) — Argumente, Metazeichen, `..` und relative
    Pfade werden mit 400 abgewiesen, und eine abgewiesene Schreibung lässt den vorhandenen Wert UNVERÄNDERT.
    Der Schnitt ist bewusst ein Worker: `merge`/`repair` (ihre Ausgabe WIRD Code) und `review`/`cleanReview`
    (Urteile, auf die ein Land gated) sind ausdrücklich NICHT konfigurierbar, und der Pin in `e2e/pins.ts`
    hält `REPO_WORKER_KEYS` und die `workerCmdFor`-Aufrufstellen als dieselbe MENGE. Damit ist
    `worker-deepseek.py` einschaltbar — für DIESES Repo, ohne die Diffs von
    `private-repo-a`/`private-repo-b` an einen Dritten zu schicken; das Einschalten selbst bleibt ein
    Owner-Akt.
  - **`audit` (2026-09-02) ist kein Modell-Worker, sondern das Stufe-2-Kommando DIESES Repos** — dieselbe
    Tür, dieselbe Validierung (absoluter Pfad auf ein Executable, keine Argumente; wer Argumente braucht,
    schreibt ein Wrapper-Skript). Aufgelöst wird an JEDER Entscheidungsstelle von Stufe 2 durch
    `server.ts#auditCmdFor`: Repo-Worker vor `FLEET_POSTLAND_AUDIT_CMD` vor nichts. Konsequenzen: (a) ein
    Land in einem Repo mit Repo-Worker wird auch dann enqueued und auditiert, wenn das Env-Kommando fehlt;
    (b) die Ledger-Zeile trägt `cmdSource: "repo-worker" | "env"` (historische und Remote-Zeilen ohne Feld);
    (c) das Skript läuft im temp-Snapshot des Integrations-Tips (`git archive`; **kein `.git` — ausser
    bei einem docs-only Land, dessen proportionale Kette seit 2026-09-05 einen eigenen Index ohne
    Commit bekommt, `server.ts#snapshotIntegrationTree`**), mit dem
    FLEET_*-freien Kind-Env wie das Env-Kommando, seriell hinter dem Drain — ein fremdes Verify hat den
    Suite-Mutex von `e2e-stage.sh` NICHT, die Serialisierung leistet allein der Server; (d) exit 42 aus einem
    Repo-Worker bleibt `unknown` (unconfigured ≠ skipped ≠ grün); (e) **das Helfer-Portal bietet einen
    Audit-Job eines Repos mit Repo-Worker NIE an** — der Daemon kennt nur `cfg.suiteCmd`, ein Claim auf die
    Job-ID antwortet 409; der Job bleibt lokal. **Seit 2026-09-13 ebenso nie ein Repo, dessen Baum den
    Guard des Env-Kommandos nicht erfüllt** (`server.ts#auditCmdPreconditions`, Arm `foreign-tree` von
    `server.ts#helperClaimBar`): trägt das Kommando ein `[ -f <datei> ] ||`, braucht der Repo-Toplevel diese
    Datei(en) plus `package.json` (der Daemon installiert immer zuerst), sonst kein Listeneintrag, Claim 409,
    kein Bundle — und der Drain fährt den Eintrag sofort lokal, wo der Guard ihn als `unknown exit 42`
    bucht. Anlass: private-repo-p wurde am 2026-09-02 zweimal gebündelt und auf den Second-host geklont, um mit
    `exit 127` nichts zu messen. Ein Kommando OHNE Guard erklärt keine Vorbedingung und wird wie bisher
    angeboten. (f) Boot: ein pendender Queue-Eintrag eines Repos ohne
    Kommando wird GEPARKT (geladen, damit der nächste Save eines anderen Repos ihn nicht verwirft; nicht
    gedraint, nicht als `waiting` gezeigt, nicht angeboten) und beim ersten Boot mit Kommando gedraint.
    Beweis: `e2e/repo-worker-audit.ts` via `./e2e-postland-audit.sh` — kein Gate fährt sie.

## Harness-Adapter

Die Adapter-Liste ist `HARNESSES` in `server.ts` (aktuell claude, pi, pi-zai, pi-ox, pi-unfenced,
container, codex; `pi-unfenced` ist serverseitig `automatable:false`, `allowsLanes:false`,
`singleton:true` — genau EINE Main-Session, warnt im Picker vor unbeschränkten Rechten).

### `pi-ox`: festes, derzeit anonym erreichbares Ox-Alpha-Profil in Pi

`pi-ox` ist bewusst **kein** nativer OpenCode-Harness. Pi besitzt TUI, Session-ID, Resume,
Liveness, Git und den normalen Lane-Lifecycle; der Adapter pinnt nur den Provider und das eine am
2026-08-22 live geprüfte kostenlose Modell. Eine Task-Auswahl lautet exakt
`{"harness":"pi-ox","model":"x-preview-f-free"}`. Der Spawn trägt immer
`--provider opencode --model 'x-preview-f-free' --models opencode/x-preview-f-free --api-key public
--no-approve --no-extensions --no-skills --no-prompt-templates --no-themes --verbose`;
ein anderer Modellname, irgendein `effort`, `harness:"opencode"` oder Container-Feld wird am
Request-Rand abgewiesen. Es gibt keinen Provider-/Modell-Fallback.

Der vollständige einknotige Canary-Katalog deklariert Basis-URL, OpenAI-Completions-Wire, derzeitige
Nullkosten, 1.000.000 Kontext, 131.072 Max-Tokens, Text-/Bild-Eingabe und Compat-Felder. Diese Werte
sind Katalogbeobachtungen, keine End-to-End-Beweise der Grenzkontexte oder des Bildpfads: der reale
Canary belegt kleine Text-Turns, einen Read-Tool-Roundtrip, Session-Fortsetzung und die damalige
Nullkosten-Nutzung; der synthetische JSONL-Proof belegt nur Parser, Reverse-State und den
1M-Nenner. Jeder Spawn leitet aus der validierten Fleet-Session-UUID einen eigenen
`PI_CODING_AGENT_DIR` unterhalb der Adapter-Basis ab; parallele `pi-ox`-Prozesse teilen damit weder
Settings, Extensions, Sessions, Retry-/Proxy- noch Compaction-Zustand. Restart und Resume verwenden
dieselbe UUID und damit denselben Root. Der Katalog wird dort über eine temporäre Datei und ein
atomares Rename ersetzt. Eine fehlende oder ungültige Session-UUID sowie jeder Schreibfehler stoppt
vor Pi statt auf einen geteilten Root oder andere Config auszuweichen. Default-Basis ist
`~/.config/claude-fleet/pi-ox-agent`; `FLEET_PI_OX_AGENT_DIR` darf sie auf einen anderen sicheren
absoluten Pfad ohne `..` legen. `~/.pi/agent`, die `pi-zai`-Ablage und globale OpenCode-Konfiguration
bleiben unberührt. Pi-Lifecycle, OpenAI-Completions-Wire, Session/Resume, exakte Modellwahl, Lanes,
Automatisierung, Built-in-Tools, das unabhängig geladene `AGENTS.md`, Fleet-Briefzustellung und
Reverse-State sind `apply`; Clientdarstellung und Task-Wire verwenden unverändert die generischen
Harness-Felder. Transcript, Effort, Self-Schedule und Container sind `unsupported`. Ebenfalls
`unsupported` sind für dieses unattended Profil project-local Pi-Settings,
`.pi/SYSTEM.md`/`.pi/APPEND_SYSTEM.md` sowie project- und adapter-globale Pi-Extensions, Skills,
Prompt-Templates und Themes; `pi-ox` lädt also keine Pi-Plugins. `--no-approve` verhindert den
eingabefressenden `Trust project folder?`-Selector, während die vier Discovery-Sperren insbesondere
verhindern, dass eine Extension Provider oder Modell nachträglich umbiegt. `--verbose` hält den
Readiness-Marker auch bei einer späteren globalen `quietStartup`-Einstellung sichtbar. Ein
separater OpenCode-Lifecycle ist `not-applicable`. Provider-Grenzkontext und Bild-Eingabe bleiben
`unknown`, bis ein eigener realer Canary sie belegt.

Der lokale Katalog verzeichnet die damaligen Providerkosten von null, aber `/models` liefert nur
Identität und keinen maschinenlesbaren Preis. Es wird daher kein erfundener Live-Kostensensor
behauptet. Der Owner hat Automatisierung nach dem realen Canary ausdrücklich freigegeben:
`automatable:true`. Der literale öffentliche Key ist kein Account-/Billing-Credential; zusammen
mit exaktem Provider, Modell und Cycle-Set gibt es keinen monetären oder modellseitigen Fallback.
Withdrawal, API-Ausfall oder geänderte Zugangskonditionen müssen am anonymen gepinnten Request
scheitern. Verfügbarkeit und Providerbedingungen bleiben veränderlich; lokale Rechen- und
Netzwerkkosten werden nicht als null behauptet.

- **Harness-Adapter (2026-08-07, `a64b681`):** `FLEET_CMD` muss nicht claude sein. Drei Env-Knöpfe, alle
  optional, alle wirkungslos solange `FLEET_CMD` mit `claude` beginnt:
  - `FLEET_HARNESS_COMMS` — Komma-Liste von `comm`-Präfixen, die beweisen, dass der Agent läuft (z. B.
    `pi,claude` für eine Bridge, die Claude Code unter sich spawnt). **LEER = „unprobed"**: der
    Lebendigkeits-Gate wird gewaivt wie bisher (das ist der Grund, warum alle `FLEET_CMD=true`-Suiten
    weiterlaufen — `true` hinterlässt per Design keinen Prozess). Gesetzt = der Gate wird echt, und ein toter
    fremder Agent blockt Autos/Dispatch/Steward-Send. **Korrektur 2026-08-07 (`4955444`): diese Variable ist
    seither nur noch die Antwort des DEFAULT-Adapters, nicht die des Fleets.** Die Probe löst pro Slot auf
    (`commsFor(s)` — Adapter-comms, sonst dieser Wert), und ein Slot mit benanntem Harness deklariert seine
    comms selbst und **verliert damit auch den „unprobed"-Waiver**. Das war ein echter Defekt und keine
    Politur: auf einem claude-Fleet ist der Wert fest `["claude"]`, also meldete eine gesunde Pi-Pane
    `no-agent` — das Board sagte etwas Unwahres —, und der naheliegende Ausweg „`FLEET_HARNESS_COMMS=pi`
    setzen" konnte hier **strukturell nie** feuern, weil die Variable nur auf dem `!IS_CLAUDE`-Zweig gelesen
    wird.
  - `FLEET_HARNESS_MODEL_FLAG` — wie die Harness ihr Modell genannt bekommt (z. B. `--model`). Fehlt = es wird
    gar kein Modell-Flag angehängt. Nie raten: ein falsches Flag lässt die Harness mit Usage-Error sterben,
    und die Pane fällt auf `exec $SHELL` durch.
  - **VIER Probe-Mengen, nicht drei** (seit `4955444`) — wer eine anfasst, muss wissen welche:
    **`commsFor(s)`** ist die, die canDeliver und der git-Tick fragen (Adapter-comms des Slots, sonst der
    Default), `HARNESS_COMMS` ist nur noch dessen Fallback (mit „unprobed"-Waiver für undeklariert),
    `AUTHOR_COMMS` = `HARNESS_COMMS ∪ {claude}` (nur `wakeAuthor`, nimmt den Waiver NIE, weil dort Prosa in
    die Pane geht), und literal `["claude"]` auf **`CLAUDE_HARNESS.worker`** (`server.ts#CLAUDE_HARNESS`; der
    Summarizer spawnt claude beim Namen, egal was `FLEET_CMD` ist). **Korrektur 2026-08-08 (`2a86cec`): das
    war bis dahin eine freistehende Funktion `claudeAliveAt`, 1700 Zeilen von der Zeile entfernt, die sie
    beschrieb** — richtig, solange der Worker claude BAUT, falsch in dem Moment, in dem die Zeile aus einem
    Adapter kommt. Sie ist jetzt literal geblieben, aber neben ihrer Ursache. Weiterhin VIER Mengen, eine ist
    umgezogen. Und der Worker-Spawn geht bewusst NICHT durch `spawnCmd`: das wäre die falsche Konsistenz — es
    würde dem Merge-Resolver das `FLEET_CMD=true` der Suiten unterschieben. Die Union in `AUTHOR_COMMS` ist
    genau das Vor-Adapter-Verhalten und NICHT optional: ohne sie stirbt der ②-Autorenpfad unter jedem
    undeklarierten `FLEET_CMD` — gemessen, 13 rote Checks in `e2e-isolated.sh`.
  - **EIN ADAPTER JE HARNESS bleibt die Vorgabe — eine universelle Front-End-Bruecke (Pi) ist der Sonderfall,
    nicht der Ersatz** (Owner-Frage 2026-08-08 „ein adapter koennte trotzdem besser sein, check das ab";
    geprueft und bestaetigt). Der entscheidende Grund ist die FAKTSCHICHT, nicht der Geschmack: `paneAgentAt`
    geht genau EINE Ebene tief (Pane-PID + direkte Kinder). Direkt gemessen an Codex:
    `zsh(pane) → node(1) → natives codex(2)`, also greift `comms:["codex","node"]` auf Ebene 1. Ueber eine
    Bruecke waere es `zsh → pi(1) → node(2) → codex(3)` — und `PI_HARNESS` deklariert `comms:["pi"]`, die
    Sonde saehe also nur die Bruecke. Stirbt der Agent dahinter, meldet das Board weiter `alive`: genau die
    Unwahrheit, die `4955444` fuer Pi beseitigt hat, kaeme durch die Hintertuer zurueck. (Die Ebene-3-Kette
    ist gerechnet, nicht gemessen — es gibt keine Codex-Bruecke.) Zweitens ist der Adapter der ORT, an dem
    Politik steht: `automatable`, `modelRe`, `pinsSession`, die Sandbox-Flags, die `note` am Picker — durch
    eine Bruecke kollabiert das auf deren Defaults, und Fleet verliert die Stelle, an der es „dieser Harness
    darf noch nicht unbeaufsichtigt" sagt. Drittens ist der Preis klein und bekannt: der Codex-Adapter war
    108 Zeilen `server.ts` + 14 Checks + 4 Pins, eine Lane, ein Land. **Wofuer eine Bruecke trotzdem taugt:**
    Provider zu erreichen, die man nicht einzeln integrieren will — und Pi kann etwas, das Codex nicht kann
    (`pinsSession: true`; Codex hat kein `--session-id` beim Fresh-Spawn — **aber seit `813149d`,
    2026-08-15, ueberlebt eine Codex-Conversation den Pane-Respawn trotzdem:** der Server bindet die
    Conversation-ID lazy aus dem Rollout (`tickCodexRecovery` — exaktes cwd, `thread_source:"user"`,
    Zeitfenster des aktuellen Pane-Lebens, genau EIN Kandidat, nie Rezenz) und heilt mit
    `codex resume '<exakte-id>'`, nur wenn der Rollout zur ID noch existiert. 0/≥2 Kandidaten oder
    fehlender Rollout = `pending`/`ambiguous`/`lost`, typisiert an der Slot-Row (`codexRecovery`),
    nie ein stiller Fresh-Start und nie `--last`. Live bewiesen 2026-08-15 an MAIN- und Lane-Fall
    (Codewort-Recall ueber den Pane-Tod). Grenze, gewollt: gebunden wird nur, was unter dem AKTUELLEN
    Pane-Leben entstand — **und seit `511c2c2` (2026-08-15, v1.1) schliesst die attended Flaeche
    genau diese Luecke:** der `cx`-Chip oeffnet ein One-Shot-Inventar
    (`GET /api/slots/:id/codex-candidates`, Owner-only, OHNE Pane-Zeitfenster, first-line-only,
    `sessionsRoot:false` = unknown ≠ 0 Kandidaten, fremd Gebundenes separat als `boundElsewhere`),
    und `POST /api/slots/:id/codex-bind {sessionId}` bindet eine ausdruecklich gewaehlte exakte ID
    nach voller Re-Validierung — idempotent (`existing:true`), 409 ohne Mutation bei
    Konflikt/verschwundener/fremder ID, NIE ein Spawn/Send/Kill aus der Route (lebende Pane bleibt
    byte-identisch; ein toter Slot resumed ueber den bestehenden ensureSlot-Heal). Live bewiesen
    2026-08-15: voller attended Kreis auf einem Wegwerf-Slot (Codewort-Recall nach Recycle+Bind+
    Pane-Tod) und die manuell resumte MAIN-Conversation nichtdestruktiv gebunden
    (`docs/codex-recovery.md` §Attended bind)).
  - Modell-Charset ist **nicht** env-konfigurierbar, mit Absicht: eine operator-gelieferte Regex, die `'`
    durchlässt, würde die Single-Quote-Klammer in `slotCmd` öffnen. Fremde Slots validieren gegen
    `HARNESS_MODEL_RE` (`/`, `:`, `*`, `@` erlaubt), claude-Slots weiter gegen `MODEL_RE` — zwei Charsets, nie
    eine aufgeweitete.
  - **Box und Docker-Kontext gehören seit `69c94da` (2026-08-08) dem SLOT, nicht dem Fleet.** `container` +
    `containerContext` sind Spawn-Optionen wie `model` (`POST /api/slots/:id/open`, `…/open-worktree`,
    `/api/lanes`), am Slot persistiert, überleben einen Pane-Respawn, und `GET /api/sessions` trägt das
    aufgelöste Paar — aber nur auf Slots, deren Harness `supports.container` hat; claude/pi/codex weisen die
    Felder mit **400** ab statt sie zu droppen. Das Env ist nur noch der DEFAULT, und die Asymmetrie ist
    Absicht: ein Tippfehler in `watchdog.sh` würde beim Boot jeden Container-Slot töten, einer im Request ist
    ein Klick. Absenz → neutraler Default, **nie** der ambient aktive Docker-Kontext, beide Hälften fallen
    unabhängig zurück. Bewusst NICHT gebaut: eine Fehlermeldung für Image↔Kontext-Kopplung — Fleet fragt
    `docker` per Stufe-1-Entscheid nichts, kann das also nicht wissen; es meldet dockers eigener Fehler in der
    Pane. Tiefe: `docs/container.md`, Abschnitt „Per slot, not per fleet".
  - **Lanes starten seit 2026-09-14 OHNE Browser-MCP, außer die Aufgabe verlangt einen** (Schnitt C2 aus
    `docs/messungen/2026-09-14-ram-optimierung-astra.md` §F4: 203 MiB je Claude-Pane, 3 von 193
    Lane-Verzeichnissen riefen in 14 Tagen überhaupt ein Playwright-Tool). `browser: true` ist eine
    Spawn-Option wie `effort` — `POST /api/lanes`, `…/open-worktree`, `Task.spawn` (beide Create-Türen) und
    die Dispatch-/Wellen-Tür (Body-Feld gewinnt, sonst die Zeile); am Slot persistiert (`Slot.browser`), also
    trägt Heal, ↻ Restart, Server-Neustart und `succeedLane` das Profil weiter. Gelesen wird es NUR für einen
    Slot mit Worktree (`server.ts#ensureSlot`, `browserMcp: !s.worktree || occupant.browser`): MAINs,
    Controller und Plain-Sessions behalten ihre ambienten MCPs. Je Adapter disponiert (`Harness.browserProfile`,
    auch in `GET /api/harnesses`): **claude `apply`** — Text-Lane bekommt `--strict-mcp-config`
    (`server.ts#agentCmd`), das lädt NULL MCP-Server; es entfallen also bewusst auch figma-/github-Plugin
    und die claude.ai-Connectoren (am 2026-09-14 alle drei unauthentisiert bzw. 400). **codex `apply`** —
    `-c` mit der VOLLEN `mcp_servers.playwright`-Definition samt `enabled=false`
    (`server.ts#CODEX_TEXT_LANE_MCP`, frische und resume-Form); alle anderen Codex-MCPs bleiben. **pi-Familie
    `not-applicable`**, **container `unsupported`**: dort ist `browser: true` ein **400**. Fleet schreibt dafür
    weder `~/.claude/settings.json` noch `~/.codex/config.toml` (Pin in `e2e/pins.ts`). Gemessen am
    2026-09-14 auf eigenem tmux-Socket, Kinder nach Executable-/Skriptposition gezählt: claude ambient 2 →
    strict 0; codex frisch ambient 2 → Override 0; `codex resume <id>` mit Override 0.
  - **`composer` — Annahme wird BEOBACHTET, nicht geechot (ACP-25, 2026-08-22).** Ein Adapter darf
    deklarieren, wo seine TUI den Composer malt (`{kind:"glyph", re}` = letzte Zeile mit diesem Glyph;
    `{kind:"rules"}` = Region zwischen den letzten zwei Vollbreiten-Linien). `sendText` liest den
    Frame mit `capture-pane -e` VOR dem Paste (Residuum ohne dim-Placeholder ⇒ Owner-Entwurf ⇒ 409
    `delivery:"refused"`, nichts getippt) und NACH dem Enter (leer + Agent alive ⇒ `observed`; noch
    Text ⇒ `SendNotAccepted` → 409 `acceptance:"not-observed"`, kein Replay, kein zweites Enter; kein
    Composer im Fenster ⇒ `unobservable`). Ohne Deklaration: `not-applicable`. Gemessen an den echten
    Binaries: claude 2.1.240 (`❯`, Placeholder `\e[2m`), codex-cli 0.147.0 (`›` — das Transcript-Echo
    nutzt DENSELBEN Glyph, darum „letzte"), pi 0.84.0 (rules). Der Default-Adapter deklariert `❯` nur
    bei echtem `IS_CLAUDE`; die Stand-ins der Suiten antworten `unobservable`. `FleetEvent` wird erst
    nach `observed`/`not-applicable` `delivered`; `submitted` in der `/send`-Receipt ist durch
    `submitRequested` + `acceptance` ersetzt. Reiner Leser: `composer.ts`; Real-TUI-Beweis:
    `./acceptance-probe.sh` (kein Gate, kostet Modell-Turns). Befund, der nicht gefixt ist: codex
    zeigt beim Start einen **Update-Prompt** (`✨ Update available … Press enter to continue`), den
    `readiness.blocks` nicht kennt — ein dritter Paste-fressender Screen.
  - **ACP-26 — Rollback nur für Fleets eigenen Event-Payload (2026-08-24).** Zwei echte
    `post-land-audit`-Zeilen belegten denselben Schaden gegen denselben Controller-Okkupanten:
    `f426d94b8bb603d354c6e570` (`delivery:"pane"`, idle 60 s, attempts 1) und
    `df8ca5c5b526e30582e56249` (Legacy ohne `delivery`, idle 15 s, attempts 2573) blieben jeweils
    vollständig im Owner-Composer, während `deliveredAt:null` korrekt blieb; der Owner sah beide
    Texte direkt. Nach `not-observed` darf deshalb ausschließlich der FleetEvent-Aufruf von
    `sendText` den Rückbau anfordern. Er liest die komplette Composer-Region FRISCH und sendet exakt
    N×`BSpace` nur wenn Slot + `openedAt` + `sessionId` vor und nach dem Read unverändert, der Agent
    frisch als lebend beobachtet und die Region Fleets vollständigen Payload byte-exakt
    rekonstruiert. Append, Prepend, Edit, zusätzliche Leerzeichen, der Claude-Paste-Placeholder,
    fehlender Composer und Capture-Fehler senden **keine** Taste. Nie `Ctrl-C`/`Ctrl-U`, nie zweites
    Enter, nie Replay: auch `cleared` bleibt `send-uncertain`, `attempts` steigt nicht erneut und
    `deliveredAt` bleibt `null`; die Event-Zeile bleibt über `/api/self/events` die Wahrheit.
    Ein direkter Owner-`/send`, Supervisor-Nudge und alle übrigen Aufrufer sind **not-applicable**
    für diesen Event-eigenen Rückbau, daher ändern Studio und Client-Protokoll sich nicht.

    Adapterentscheidung aus den gemessenen Composer-Formen: **Claude apply** für vollständig
    sichtbare Einzeiler; eingeklappte Mehrzeiler (`[Pasted text #N +M lines]`) sind **unsupported**
    und bleiben unberührt. **Codex apply** (Glyph-Region einschließlich des beobachteten
    `$FLEET_SELF_TOKEN`-Mention-Popup-Falls; nach einer Leerzeile ist nur der gemessene Mention-/
    Modellstatus-Suffix Chrome — jede andere Folgezeile macht den Read unobservable). **Pi apply**,
    **pi-zai apply** und **pi-ox apply**, weil alle drei denselben Pi-0.84-Rule-Composer und dieselbe
    Pi-Prozess-Liveness verwenden; ihre verschiedenen Pre-Send-Readiness-Regeln bleiben unberührt.
    Ein Adapter ohne `composer`-Deklaration ist **not-applicable**. Reiner Vergleich:
    `composerRows` + `composerHoldsExactly`; Lebenszyklus-Falsifizierer: `e2e/watch.ts` und der
    Raw-Mode-Stand-in in `e2e-isolated.sh`.

## Die Faktschicht `agent`

- **`GET /api/sessions` trägt pro Slot `agent`** (`alive|no-agent|no-pane|unprobed|null`) — **und seit
  `4955444` ist es die FAKTSCHICHT: pro Slot aufgelöst, bedingungslos, nach dem Binary gefragt, das der Slot
  wirklich fährt.** Nicht zu verwechseln mit dem GATE daneben (`aliveInfo`), das dieselbe Probe nimmt und
  zusätzlich die Automations-Policy trägt — die beiden dürfen nie zusammenfallen, sonst lügt entweder das
  Board oder ein Gate öffnet aus Versehen (gepinnt in `e2e/pins.ts`). `no-agent` ist der Fall, den vorher
  nichts benennen konnte: Pane lebt, nimmt Tasten an, kein Agent dahinter — was ein unauflösbares Modell
  hinterlässt. Cache (git-Tick), also Bericht, nie Gate; jedes Gate behält seine eigene frische Probe. `null`
  = Tick war noch nicht da, das ist KEINE Antwort. Ein Board-Knopf existiert dafür noch nicht.
  **Genau zwei Leser nehmen für `done-looking` die Faktschicht statt des Gates:** die Self-Land-Tür
  und die Projektion, die sie nennt (`server.ts#laneSignalView`, `liveness:"fact"`) — Landen treibt
  den Harness nicht, darum landet eine MAIN auch eine Lane auf `pi-zai` (`automatable:false`).
  Alle Tick-Konsumenten (Watch, auto-③, Stalled) lesen weiter das Gate.
- **tmux-Ziele sind seit 2026-09-01 EXAKT (`server.ts#sessTarget` → `=sN`, `server.ts#paneTarget` →
  `=sN:`; `server.ts#existingTmuxTarget` und `server.ts#paneAgentAt` formen intern).** Mechanismus: tmux
  3.6a löst ein nacktes `-t s1` erst exakt, dann als PRÄFIX auf — ist `s1` weg, trifft `has-session -t s1`
  still `s10`. Gemessen 2026-09-01 (Controller Slot 10): `ensureSlot` hielt Slot 1 für lebend, adoptierte
  s10s Pane, erzeugte NIE ein `s1`, und der Gründungsbrief für Slot 1 landete in der Controller-Pane;
  ein `kill` von Slot 1 hätte über `kill-pane` den Controller getötet. Session-Verben (`has-session`,
  `kill-session`) nehmen `=name`, Pane-/Window-Verben brauchen `=name:` — `=name` ohne Doppelpunkt findet
  dort keine Pane. `%`-/`@`-IDs sind ohnehin exakt. Gepinnt in `e2e/pins.ts` (kein `tmux()`-Aufruf mit
  nacktem Namen als `-t`), live bewiesen in `e2e/slots.ts` (Köder `s10`, Slot 1 öffnen → exaktes `s1`).

**Land-Historie ACP-26R (2026-08-24):** der erste Land-Versuch des Kandidaten `d0fa215` endete
`verify RED, exit 127, 936 ms` — nicht der Baum, sondern der frisch eingetragene
Fleet-Repo-Verify-Befehl in `FLEET_VERIFY_CMD_REPOS` trug die `\`-Fortsetzungen des Regelbuchs als
LITERALE Newlines (JSON-Strings kennen keine Shell-Continuations; Zeilen 2–4 liefen als eigene
Kommandos, `--target: command not found`). Der Eintrag ist seither einzeilig; der Kandidat war im
roten Lauf NIE gemessen. Regel daraus: ein per-Repo-Verify-Wert ist IMMER eine einzige Zeile.
