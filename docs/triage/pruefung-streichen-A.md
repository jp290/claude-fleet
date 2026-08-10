# Verifikat Paket A

Geprüft gegen `/Users/owner/claude-fleet` auf HEAD `c9a1dc720477` (Commit vom 2026-08-09 13:37 +0200). Dies ist eine Belegprüfung der acht vorgegebenen `streichen`-Verdikte, kein neues Queue-Urteil. Der Owner entscheidet über jede Löschung.

Alle acht IDs stehen im heutigen `fleet.json` weiterhin auf `pending`. Das Paket selbst enthält entgegen der Auftragsankündigung nur **eine** als `mittel` markierte Zeile (`b8716d0e`); die übrigen sieben sind als `hoch` markiert.

## Übersicht

| Zeile | Ergebnis | Einzeiler |
|---|---|---|
| `b8716d0e` | BESTAETIGT | Sieben Doc-Commits, drei verbliebene gepinnte Quellen und die dauerhaft abgelegte Drift-Regel sind jeweils nachweisbar. |
| `05320523` | BESTAETIGT | Der Brief bewahrt Blindheit, Transcript-Route und offenen Vorab-Look; `23e6033` baute den Maschinen-Fakt in den Digest. |
| `10ac2528` | BESTAETIGT | Attic plus `c366c66` bewahren Recorder, Viewer, späteren Analyzer und Volumen-Voraussetzung; der Formfehler ist ausdrücklich dokumentiert. |
| `34a12839` | BESTAETIGT | Kill/Boot/Orphan/Attach-Kontrollfluss widerlegt eine automatische Worktree-Wiederbelebung; Re-Attach ist ein expliziter Request. |
| `56be77a3` | BESTAETIGT | Der historische Confused-Deputy-Befund, der Live-Abgleich und der verbleibende Owner-Griff sind in Attic und Commit erhalten. |
| `7366e599` | BESTAETIGT | Die komplette Runtime-Env-Richtung steht im Attic; die Queue-Zeile erklärt sich selbst zur konditionalen Notiz. |
| `983e063f` | BESTAETIGT | `613faa3…` ist in HEAD und implementiert Migrations-Tick, Self-Succeed/Retire, Handoff-Brief und Ending `handoff`. |
| `cd85c924` | WIDERLEGT | Die zitierten Bereiche sparen genau die Zeilen aus, die „Dream Mode lief“ und „Arena lief nie“ sichern; die Pauschalaussage „kein Wissensrest“ trägt so nicht. |

## `b8716d0e` — BESTAETIGT

### Gelesen

- Commit `7941c3fbd978d519510ef57b8abc27313565889d` existiert, ist Vorfahr von HEAD und legt `briefs/work-waves-2026-08-07.md` an.
- Der entscheidende dauerhafte Satz steht dort in Zeilen 195–196:

  > **Beleg-Verfall melden, nicht Zeilen bewerten.** Zitierte Refs mechanisch nachprüfen und *nur bei Abweichung* filen.

- Die drei angegebenen Quellen stehen in `docs/triage/batch-A-verben.md` tatsächlich als:

  > `QUELLE: docs/autonomy-verbs-2026-08-06.md:75-92 @1e46b8b`

  > `QUELLE: docs/autonomy-verbs-2026-08-06.md:94-111 @1e46b8b`

  > `QUELLE: docs/autonomy-verbs-2026-08-06.md:113-159 @1e46b8b`

### Gemessen

- `git rev-list --count 1e46b8b..HEAD -- docs/autonomy-map-2026-08-06.md docs/autonomy-verbs-2026-08-06.md` ergibt **7**. Die sieben SHAs sind `d139698`, `3b22aa8`, `08dc17a`, `23e6033`, `3280a10`, `4311c92` und `ece2957`.
- Die Überschriften des eingefrorenen `batch-A-verben.md` enthalten von den ursprünglich als betroffen genannten IDs genau `f0a710db`, `08f44054` und `acb5839d`.
- `git show 1e46b8b:docs/autonomy-verbs-2026-08-06.md` löst alle drei gepinnten Bereiche auf die behaupteten Abschnitte „Verb 3“, „Verb 4“ und „Verb 5“ auf.
- Die Queue-Zeile ist heute weiterhin `kind:"note", status:"pending"`.

### Begründung

Jeder tragende Teil des Worker-Verdikts ist belegt: Der alte Ein-Commit-Stand ist überholt, die Zahl sieben stimmt, die drei noch relevanten Quellen sind korrekt gepinnt, und die dauerhafte mechanische Regel ist außerhalb der Queue erhalten. Der Beleg trägt daher die behauptete Wissenssicherung.

## `05320523` — BESTAETIGT

### Gelesen

- Commit `c02a0d4931709e7a509e24ce7ec3ef07059ef58c` existiert, ist Vorfahr von HEAD und fügt `briefs/steward-kritik-2026-08-07.md` hinzu.
- Der Brief bewahrt den historischen Befund in Zeilen 104–107:

  > am 2026-08-05 filete der Rundgang um 12:42 ein Urteil über Slot 3, dessen Lane um 11:11 — 90 Minuten früher — einen Schlussbericht abgegeben hatte, der genau dasselbe sagte und **vier Hand-Aufträge an den Owner** enthielt

- Ursache und Route stehen in Zeilen 123–127:

  > Er verhindert aber auch, dass ein **fertiger Schlussbericht** gelesen wird, bevor über die Lane gefiled wird. Die Route dafür existiert und ist im Steward-Scope (`GET /api/steward/slots/:id/transcript` …); das Ritual nennt sie nicht.

- Dass der Vorab-Look weiterhin eine eigene offene Entscheidung ist, sagt der Brief in Zeilen 346–349 ausdrücklich:

  > Was `05320523` bräuchte, ist eine Ausnahme für **Lane-Filings** (vor einem Filing über eine Lane deren letzte Nachricht ziehen …) — das ist eine eigene Entscheidung mit eigener Begründung

- Commit `23e6033960331de49924aa52fcc21e3c3d01d90a` ist Vorfahr von HEAD. Sein Body benennt „`gate: gateView()` auf `GET /api/steward/digest`“; der heutige Code enthält in `server.ts:11709-11717` denselben begründeten Digest-Eintrag, endend mit:

  > `gate: gateView(),`

### Gemessen

- `gateView()` sammelt heute tatsächlich Suite-Lock und Verify-Intents (`server.ts:8719-8735`): `const lock = suiteLockView();` und `return { lock, reports: ... }`.
- Die Queue-Zeile ist weiterhin `kind:"note", status:"pending"`.
- Historische Lane-Transkripte und Live-Journale wurden nicht rekonstruiert; das Worker-Verdikt beansprucht diese Prüfung ausdrücklich nicht.

### Begründung

Die getrackte Auswertung enthält sowohl das erhaltene Wissen als auch die noch offene Ritualentscheidung. Der zweite, maschinelle Teil wurde durch `23e6033` gebaut und ist im aktuellen Digest-Code vorhanden. Damit trägt die Belegkette die Aussage „zweite Ablage, nicht Wissensträger“.

## `10ac2528` — BESTAETIGT

### Gelesen

- `docs/attic/backlog-2026-07.md:961-975` beschreibt den Recorder und sagt wörtlich:

  > **Deliberately a RECORDER, not an analyzer:** … Analysis needs VOLUME — it is a later consumer, not built here

- Die späteren Teile stehen in Zeilen 983–984:

  > **Future items (separate lanes):** (a) an ANALYZER that reads the trail once volume exists; (b) a client VIEW over `/api/lane-outcomes`

- Das Attic ist beim Viewer allein historisch veraltet („future item“). Der zusätzlich zitierte, in HEAD enthaltene Commit `c366c6652cb76a904778d4ad450fb9a3144b3a98` korrigiert genau das in seinem Body mit:

  > `18 Recorder + Viewer (07dafa0)`

- Der Formfehler ist in `briefs/work-waves-2026-08-07.md:220-225` erhalten; entscheidend sind Zeilen 223–224:

  > **`10ac2528` und `63626cdb` stehen weiter als startbare `lane`-Zeilen da, die sich im ersten Satz selbst als „NOTIZ — kein Arbeitsauftrag“ deklarieren.**

### Gemessen

- Das heutige `fleet.json` bestätigt `10ac2528` als `kind:"lane", status:"pending"`.
- `lane-outcomes.jsonl` hat heute 219 Zeilen. Das ist nur eine Zustandsmessung; sie beantwortet die Owner-Frage „genug wofür?“ nicht und wird nicht als Schwellenurteil benutzt.

### Begründung

Die kombinierte Belegkette trägt alle Aussagen des Verdikts: Recorder und Viewer sind als gelandet dokumentiert, der Analyzer ist ausdrücklich später und volumenabhängig, und die falsche `lane`-Form ist eigens festgehalten. Dass das Attic den Viewer noch als „future“ bezeichnet, wird nicht verschwiegen, aber durch den ebenfalls zitierten `c366c66`-Body aufgelöst.

## `34a12839` — BESTAETIGT

### Gelesen

- `killSlot` leert zuerst die Slot-Zuordnung und lässt nur den Worktree auf Platte:

  > `s.cwd = null; // clear first so the self-heal loop can't resurrect it mid-kill` (`server.ts:3074`)

  > `s.worktree = null; // the worktree itself stays on disk — land removes it, kill never does` (`server.ts:3090`)

  > `await tmux("kill-session", "-t", sess(s.id));` (`server.ts:3102`)

- Der Boot-Abgleich iteriert über `tmux list-sessions`, akzeptiert nur Namen nach `/^s(\d+)$/` und adoptiert nur dann:

  > `if (s && !s.cwd) { ... s.cwd = p.out || HOME; ... }` (`server.ts:10021-10027`)

- Orphans werden als Worktree-Zeilen mit `slot: holder?.id ?? null` ausgegeben (`server.ts:12945-12962`). Der folgende Pfad benennt seine Semantik ausdrücklich:

  > `re-seats an orphaned worktree into a slot (attach)` (`server.ts:12974-12975`)

  und führt sie nur unter `POST /api/lanes` mit `body.attach` aus (`server.ts:12976-13015`).
- Der Owner-Nachtrag in `docs/triage/batch-E-harness.md:153-156` sagt:

  > „die beiden war glaube ich selbst weil ich auf zwei geister-slots gedrueckt habe wo 'on-disk' daneben stand“ … Meine Zuschreibung an den srv-Neustart war eine Vermutung und ist hiermit zurückgezogen.

### Gemessen

- `ast-grep 0.45.1` mit dem TS-Muster `await openSlot($$$ARGS)` findet fünf Aufrufe in `server.ts` (`2789`, `3470`, `3750`, `13009`, `14277`), **keinen** im Boot-Bereich. Der einzige Orphan-Aufruf ist der explizite Attach-Pfad bei `13009`.
- Die Queue-Zeile ist weiterhin `kind:"lane", status:"pending"`.
- Das damalige `audit.jsonl` wurde nicht rekonstruiert; für die Code-Aussage ist es nicht erforderlich.

### Begründung

Der gelesene Kontrollfluss und die unabhängige Strukturmessung tragen die Widerlegung des behaupteten automatischen Mechanismus. Eine Koordinate im Worker-Beleg ist unpräzise: `server.ts:9613-9630` enthält heute den Boot-/Instance-Lock-Kommentar, nicht den eigentlichen State-Restore; dieser beginnt bei `9684`, die Slotbelegung bei `9808`. Das kippt die Aussage nicht, weil Kill, tmux-Adoption, Orphan-Projektion, explizites Attach und die vollständige `openSlot`-Messung übereinstimmen.

## `56be77a3` — BESTAETIGT

### Gelesen

- Der Body des in HEAD enthaltenen Commits `c366c6652cb76a904778d4ad450fb9a3144b3a98` bewahrt die damalige Live-Messung:

  > In fleet.json auf Platte haben die Slots 3, 4, 6 und 13 cwd = das Fleet-Install-Verzeichnis … und Slot 6 ist gleichzeitig aktiv geteilt (mode "interact").

- Der historische Befund und die frühere Reaktion stehen in `docs/attic/backlog-2026-07.md:994-1005`:

  > Slot 11 was **actively shared in interactive mode** when found — revoked and verified … Slot 6 still points there; move it, or accept the exposure knowingly. No cheap code fix …

- Der verbleibende Owner-Griff wird in `docs/attic/backlog-2026-07.md:1280` und `:1297` erneut ausdrücklich geführt:

  > Slot 11's live exposure is closed; slot 6 still points at the fleet repo cwd — move it, or accept the exposure knowingly, your call

### Gemessen

- `56be77a3` ist heute weiterhin `kind:"note", status:"pending"`.
- Den heutigen Slot-/Share-Zustand habe ich bewusst nicht als Beleg benutzt. Das Verdikt behauptet nur die dauerhafte Ablage des historischen Befunds und weist dieselbe Live-Grenze ausdrücklich aus.

### Begründung

Commit und Attic ergänzen sich genau wie behauptet: Der Commit hält die breitere Messung vom 07.08. fest; das Attic hält Muster, erfolgten Widerruf und verbleibende Owner-Entscheidung fest. Der Beleg trägt die Wissenssicherungs-Aussage ohne einen unbelegten Anspruch über den heutigen Share-Zustand.

## `7366e599` — BESTAETIGT

### Gelesen

- `docs/attic/backlog-2026-07.md:478-490` enthält die komplette technische Richtung:

  > **Phase 1.5 lane runtime env** — bake `FLEET_LANE_SLOT` + per-slot `PORT` … and, for fleet-on-fleet lanes, safe `FLEET_SOCK`/`FLEET_PORT` overrides into the pane env at spawn

  sowie die nichttriviale Restore-Bedingung:

  > self-heal recreation must re-bake the same env — tag before ensure, or derive env from the persisted lane field.

- Der Body von `c366c66` führt `7366e599` unter den fünf angelegten Notizen auf, die ein Dispatcher nie startet.
- Die Queue-Zeile selbst sagt ausdrücklich „NOTIZ — kein Arbeitsauftrag“ und „bauen, wenn [die Kollisionsklasse] sich meldet“.

### Gemessen

- `7366e599` ist heute weiterhin `kind:"note", status:"pending"`.
- Eine Textmessung in `server.ts` ergibt weiterhin 0 Vorkommen von `FLEET_LANE_SLOT`; die tatsächlich gebackenen Self-Variablen stehen heute bei `server.ts:2888` als `FLEET_SELF_TOKEN` und `FLEET_SELF_SLOT`. Das ist nur eine Textmessung des benannten Symbols, keine Behauptung über ungetrackte Betriebslogs.
- Ungetrackte Betriebs-/Server-Logs wurden nicht auf einen neuen Kollisionsfall untersucht, genau wie im Worker-Verdikt ausgewiesen.

### Begründung

Der zitierte Attic-Abschnitt bewahrt nicht nur Schlagwörter, sondern Variablen, Portband, Spawn-Stelle und Self-Heal-Invariante. Zusammen mit der ausdrücklich konditionalen Notiz trägt das den behaupteten Wissenssicherungsgrund. Ob seitdem ein ungetrackter Triggerfall auftrat, ist eine getrennte und vom Verdikt nicht beanspruchte Tatsache.

## `983e063f` — BESTAETIGT

### Gelesen

- Commit `613faa3c03d020d03bcd80ed88ac490048a4fe6b` existiert, ist Vorfahr von HEAD und beschreibt im Body exakt drei Teile: `tickMigrate`, `POST /api/self/succeed`/`retire` mit Nachfolger und Handoff-Brief sowie `SlotEnding "handoff"`.
- Der heutige Code enthält alle verlangten Bausteine:

  > `async function tickMigrate(): Promise<void>` (`server.ts:5951`)

  > `async function handleSelfSucceed(s: Slot, req: Request): Promise<Response>` (`server.ts:3441`)

  > `await openSlot(free, predecessor.cwd, ...)` und `const brief = buildSuccessionBrief(carry);` (`server.ts:3470-3478`)

  > `if (url.pathname === "/api/self/succeed" ... ) ... return handleSelfSucceed(s, req);` (`server.ts:12108-12112`)

  > `export type SlotEnding = "landed" | "reopen" | "shelved" | "handoff" | ...` (`slotstats.ts:36`)

### Gemessen

- `git merge-base --is-ancestor 613faa3c03d020d03bcd80ed88ac490048a4fe6b HEAD` endet mit Status 0: Der Commit ist wirklich in der heutigen Historie gelandet, nicht nur als fremder Commit auffindbar.
- Die Queue-Zeile steht dennoch weiterhin auf `kind:"lane", status:"pending"` und trägt die Note `lane closed before landing — review and requeue if still wanted`.
- `FLEET_MIGRATE_PCT` wurde nicht auf Live-Aktivierung geprüft; der verlangte Ausgang ist gebaut, und genau darauf begrenzt sich das Verdikt.

### Begründung

Hier ist der Zwischenzeit-Befund eindeutig: Die Queue-Zeile ist operativ noch offen, ihr geforderter Codezustand aber bereits gelandet. Commit-Body, Ancestor-Messung und aktueller Code tragen das `streichen`-Verdikt vollständig.

## `cd85c924` — WIDERLEGT

### Gelesen

Die zitierten Bereiche existieren und tragen große Teile des Worker-Arguments:

- `docs/attic/backlog-2026-07.md:830-850` nennt das Item ausdrücklich ein „decision item“ mit „no build implied“ und beschreibt fehlenden Index/Embedding/Retrieval-Code.
- `docs/attic/backlog-2026-07.md:898-905` parkt Phase 2 wegen der ungelösten Embedding-Quelle:

  > a local embedding server is exactly the peer-process this item rejects … and an external API collides with this machine's allowlisted-network doctrine. Until (b) has an answer … Phase 2 is parked

- `docs/attic/backlog-2026-07.md:932-949` empfiehlt Option A und bewahrt Secret-/Indexgrenze sowie Owner-Fragen.

Die Pauschalaussage des Workers lautet aber, die Queue-Notiz füge gegenüber **den zitierten Bereichen** „keinen dauerhaften Wissensrest“ hinzu. Genau zwei ihrer Tatsachen fehlen dort:

1. Option A / Dream Mode ist tatsächlich gelaufen.
2. Die Arena hat noch nie eine Episode gefahren.

Die entscheidenden Attic-Zeilen existieren zwar, wurden aber vom Belegbereich ausgespart: `:858-866` liegt zwischen den zitierten Blöcken `:830-850` und `:882-950`. Dort steht:

> The learning engine HAS run — both dream passes … Still true: **the arena** has never run an episode — `docs/arena-episodes.md` does not exist

Der Commit-Body von `c366c66` nennt Item 17 als offen, enthält diese beiden Tatsachen jedoch ebenfalls nicht.

### Gemessen

- `docs/arena-episodes.md` fehlt heute; `steward-arena.sh` existiert.
- Textmessungen über die Code-Dateien ergeben je 0 Treffer für `FTS5`, `sqlite-vec` und `api/knowledge`.
- Eine strukturelle `ast-grep`-Messung in `server.ts` findet weder den String-Literal-Ausdruck `"/api/knowledge"` noch `"/api/knowledge/search"`.
- `cd85c924` ist weiterhin `kind:"note", status:"pending"`.

### Begründung

Die zugrunde liegende Redundanzthese lässt sich mit **korrigierten** Attic-Zeilen wahrscheinlich belegen; der Worker hat diese Zeilen aber gerade nicht zitiert. Nach dem verlangten engen Prüfmaßstab trägt sein angegebener Beleg den umfassenden Satz „kein dauerhafter Wissensrest“ nicht. Eigene Gegenwartsmessungen ersetzen außerdem keinen historischen Nachweis für „nie eine Episode“. Daher `WIDERLEGT`, nicht `NICHT PRUEFBAR`.

## Meine schwächste Aussage

Am ehesten könnte `cd85c924 — WIDERLEGT` kippen. Der Mangel ist keine sachliche Gegenposition zur Redundanzthese, sondern eine exakt begrenzte Beleglücke: Die fehlenden Tatsachen stehen im selben Attic-Dokument nur acht Zeilen nach dem ersten zitierten Bereich, bei `:858-866`. Wenn der Owner eine Dateizitation trotz ausdrücklich angegebener Zeilenbereiche als Verweis auf das ganze Item wertet oder den Beleg schlicht auf `:830-950` korrigiert, würde ich dieses Urteil auf `BESTAETIGT` ändern. Nach der hier vorgegebenen Regel, den genannten Zeilenbereich genau zu lesen und zu prüfen, bleibt `WIDERLEGT` jedoch die strengere und reproduzierbare Aussage.
