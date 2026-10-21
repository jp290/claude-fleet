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

## Ein fremdes Repo als Fleet-Projekt aufnehmen

Diese Reihenfolge bereitet die Gruendung vor dem ersten `bootstrap-main` vor. Sie beschreibt
den gebauten Serververtrag; Konfigurations-, Trust- und Loeschakte bleiben beim Owner oder
seiner konkreten Delegation. Sie fuehrt keinen dieser Akte selbst aus. Fuer spaetere Lane-Karten
gilt der Nachbar `AGENTS.md` §Rows for a repo that is not claude-fleet.

1. **Repo und Regelrahmen zuerst.** Den Ziel-Checkout als Git-Repo mit lesbarem HEAD und
   Branch benennen. Eine nicht leere Root-`AGENTS.md` muss bereits **committiert in HEAD** liegen;
   eine Datei nur im Arbeitsbaum oder Index reicht nicht. `server.ts#preflightProgramMain`
   prueft `git cat-file -s HEAD:AGENTS.md` und verweigert sonst mit
   `target repository requires a tracked, non-empty root AGENTS.md` (400). Nicht-Git-CWD und
   unlesbarer HEAD/Branch haben eigene Refusals. Die Datei traegt die eigenen Repo-Regeln und
   Verify-Anweisung; Fleet-Prozesszustand gehoert nicht ins Produktrepo. Ein Game-Maker braucht
   zusaetzlich einen eigenen linked Worktree des Produktrepos, keinen primaeren Checkout und
   keinen Fleet-Worktree (`server.ts#gameMakerMachineError`).

2. **Harness-Trust vor der Gruendung klaeren.** Bei Claude muss der Zielordner im Harness
   bereits vertrauenswuerdig sein. `server.ts#CLAUDE_TRUST_DIALOG` erkennt
   den sichtbaren Selektor; `server.ts#canDeliver` verweigert ihn als
   `blocked-screen: claude trust dialog`. `server.ts#bootstrapProgramMainReserved`
   rollt die Gruendung dann zurueck und antwortet mit
   `Program-MAIN delivery held (...)` (500). Der Server akzeptiert den Dialog nicht selbst.
   Die Abhilfe ist eine autorisierte Trust-Bestaetigung im Harness fuer den exakten Zielpfad.
   Der in der Aufnahme berichtete Eintrag `projects[<pfad>].hasTrustDialogAccepted` in
   `~/.claude.json` ist ein Harness-Konfigurationsweg, **kein von Fleet gelesener oder
   validierter Schluessel**; seine Wirksamkeit muss am verschwundenen Dialog beobachtet werden.
   Diese Anleitung verlangt keine automatische Aenderung der Datei.

3. **Den eigenen Verify-Befehl vor Arbeitsfreigabe konfigurieren.** Der Operator hinterlegt
   einen nicht leeren Befehl pro Repo in `FLEET_VERIFY_CMD_REPOS` und startet den Server nach
   einer Env-Aenderung autorisiert neu. `server.ts#VERIFY_CMD_REPOS`
   liest einmal beim Modulstart ein JSON-Objekt; ungueltiges JSON, falsche Form oder leere
   Befehle werden mit Warnung ignoriert. Schluessel sind kanonische Repo-Toplevels;
   `server.ts#verifyRepoKey` findet fuer linked Worktrees auch den Eintrag
   des primaeren Repos ueber die gemeinsame Git-Ablage. **Ohne Eintrag ist das Gate nicht
   pauschal unbekannt:** `server.ts#verifyCmdFor` faellt auf
   `FLEET_VERIFY_CMD` zurueck; fehlt auch der, ist Verify unkonfiguriert. Die globale Fleet-Standardkette
   bricht ohne `fleet-e2e.ts` mit `SKIPPED` ab. Nach Gruendung liest die erste Lane
   `GET /api/self/gate` und prueft `verify.cmd` sowie den Fremdrepo-Befehl in `localProof.note`.
   Das ist ein Vorab-Abgleich, kein bereits bestandener Verify und keine Bootstrap-Voraussetzung.

4. **Parallelitaet bewusst setzen.** Vor dem Release den effektiven Repo-Deckel mit
   `GET /api/repo-lane-caps` lesen. `server.ts#repoLaneCap` nimmt ohne
   Eintrag `FLEET_DISPATCH_MAX_LANES`; der Code-Fallback ist **3**, kein festes 1
   (`server.ts#DISPATCH_MAX_LANES`). Eine Betriebs-Env kann 1 setzen.
   Fuer einen autorisierten anderen Deckel nimmt `POST /api/repo-lane-cap`
   (`server.ts#fetch`) `{repo,maxLanes}`: Git-Toplevel muss lesbar sein, der Wert ganzzahlig
   zwischen 1 und `REPO_MAX_LANES_MAX`. Sonst 400, ohne bestehende Werte zu aendern;
   0/null entfernt den Eintrag und stellt den Maschinendefault wieder her. Die Antwort nennt
   `effective` und `source`; Speicherung wirkt ohne Neustart. Repo-Deckel hebt Program-
   Deckel oder fehlende freie Slots nicht auf. Ein zu kleiner Deckel haelt Dispatch wartend,
   verhindert aber keine MAIN-Gruendung.

5. **Wissen nach Heimat und Leser vorbereiten.** Die Zuordnung in
   [Projektwissen und Loeschwege](messungen/2026-10-08-projektwissen-fremdrepo-schichten.md#ergebnis-vier-eindeutige-heimaten)
   ist eine begruendete Empfehlung: Entscheide im Program-Record, Arbeitsregeln im Repo-
   `AGENTS.md`, erklaerendes Projektverstaendnis im privaten Projektkonzept, operative Auswahl
   als Pack-Zeiger. Fuer Startwissen prueft `server.ts#repoManifestContextPlan`
   das **Zielrepo-Manifest am receiptierten HEAD** und dessen getrackte
   Quellen/Anker. Fehlende oder unlesbare Quellen und ungueltige Packs werden als Omission
   ausgewiesen (`context-manifest.ts#planRepoContext`), nicht
   durch Fleet-Wissen ersetzt. Program-Packs kann erst die gebundene aktive MAIN schreiben
   (`server.ts#boundProgramForMain`); die Self-Tuer
   `/api/self/program-context-packs` (`server.ts#fetch`) prueft maximal 5 Packs mit je 4
   getrackten Quellen am Integration-HEAD. Ungueltige Pfade/Anker ergeben 400 mit `issues`
   (`context-plan.ts#validateProgramContextPacks`). Sie erreichen
   Program-Lanes, nicht den MAIN-Gruendungsbrief. Beliebige private Projektkonzepte sind
   heute keine automatisch zustellbaren Program-Packs: expliziten privaten Lesezeiger mit
   Fassung/Hash im autorisierten Auftrag vorsehen. `ebene:projekt` ist keine Projekt-
   Zugriffssperre (`server.ts#konzeptKontextFor`;
   `konzept-ledger.ts#konzeptRequest`).

6. **Erst jetzt das aktive Program gruenden und Zustellung belegen.** Der Owner bestaetigt
   den Vorschlag und aktiviert ihn (`server.ts#handleOwnerProgramRoute`). Danach nimmt
   `POST /api/programs/:id/bootstrap-main` `cwd`, Harness,
   Modell und Effort; nicht aktive Programs ergeben 409, ungueltige Spawn-Felder 400
   (`server.ts#bootstrapProgramMainReserved`). Kein freier MAIN-Platz
   oder eine laufende Gruendung ergibt 409. Eine bereits lebende MAIN ergibt `existing:true`,
   ohne zweite Gruendung. Nach Boot-/Delivery-/Readiness-Pruefung muss Briefzustellung und
   Context-Receipt gelingen, bevor die Bindung als Erfolg gilt. Antwort und exakte neue
   Identitaet/Program-Zuordnung lesen; ein offener Slot allein belegt keine Gruendung.
   Danach prueft die MAIN die vorbereiteten Wissenszeiger und die erste Lane den eigenen
   Gate-Vertrag, bevor weitere Arbeit freigegeben wird.

7. **Die Loeschpflicht schon bei der Aufnahme auffindbar machen.** Im autorisierten
   Projektinventar Leser, Ablagen, zulaessige Aufbewahrung und den spaeteren Loeschnachweis
   benennen. Der Server verweigert `complete` bei offenen Pflichten ohne `{force:true}`, fuehrt aber
   **keine Vertraulichkeit-Loeschung** aus (`server.ts#handleOwnerProgramRoute`).
   `context-plan.ts#planProgramContext` unterdrueckt nach Abschluss
   lediglich weitere Pack-Zustellung; `konzept-ledger.ts#konzeptOpOf`
   hat keinen DELETE-Weg, `verwerfen` appendiert einen Status.
   Repo/Git-Kopien, ehemalige Worktrees, Scratch, Harness-Transkripte/Memory, Konzeptfassungen,
   Fleet-State und Ledger samt Rotationen sowie Backups/weitere Hosts/Provider gehoeren ins
   Inventar der genannten Wissensnotiz. Jeder Loeschakt braucht eigene Autorisierung und
   Nachpruefung; `complete`, leere Packs oder ein entfernter Checkout beweisen ihn nicht.

**Start-Pack und Grenze.** `projekt-aufnahme` ist ein aktiver Hinweis mit Trigger
`orchestration`: `server.ts#BOOTSTRAP_CONTEXT_TRIGGERS` liefert ihn
Orchestratorin und neuer MAIN **im Fleet-Repo** beim Start; normale Lane-Dispatches setzen
diesen Trigger nicht. `server.ts#programMainContextPlan` und
`server.ts#orchestratorFoundingContext` lesen das Manifest ihres CWD-Repos.
Eine MAIN im Fremdrepo bekommt deshalb dessen eigene Packs, nicht diesen Fleet-Manifest-Eintrag.
Die Orchestratorin muss die benoetigten Aufnahmehinweise vorab weitergeben; automatische
Zustellung dieses Fleet-Abschnitts ueber Repo-Grenzen waere ein eigener Serverschnitt.

**Folgeschnitt: Abhilfe am Fehler statt weiterer Fehlversuche.** Die AGENTS-400 sollte
`HEAD:AGENTS.md` und „nicht leer committen, dann erneut gruenden“ nennen. Die Trust-500 sollte
den Zielpfad und die autorisierte Harness-Bestaetigung nennen. Bei fremdem Verify-Fallback
waere ein Hinweis auf fehlenden Repo-Eintrag und den tatsaechlich gewaehlten globalen Befehl
sinnvoll; am Dispatch-Warten sollten effektiver Deckel, Herkunft und `/api/repo-lane-cap`
sichtbar sein. Wissen und Vertraulichkeit-Loeschung sind keine vorhandenen Bootstrap-400er: dort fehlt
jeweils eine Funktion bzw. ein Nachweis, den ein besserer Fehlertext allein nicht ersetzt.

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

## Nachfolge ohne kalten Wiederaufruf

Für eine Claude-Session empfehlen wir: **im noch warmen Turn nachfolgen, sobald die effektive
Übergabe-Schwelle erreicht ist und nichts mehr in Flug ist, das nur in dieser Session lebt.**
Den eigenen Füllstand mit `./ctl.sh ctx` messen. Die effektive Schwelle steht als
`succession.thresholdPct` im Slot-Brief beziehungsweise Board (`GET /api/slots/:id/brief`,
`server.ts#successionFacts`, `docs/self-api.md` §succeed). Sind diese Fakten nicht zugestellt,
die wirksame Einstellung beim eigenen Empfänger klären; fehlende Werte bleiben `unknown`,
eine ausgeschaltete Schwelle ist kein Auslöser. Die Owner-Einstellung dieser Belegung geht vor dem Fleet-Default
(`server.ts#patchHandover`). Der Pack setzt keine Schwelle und erteilt keine zusätzliche
Nachfolge-Befugnis: die eigene Rollenkarte und Nachfolge-Schiene gelten, insbesondere das
Lane-Ende des jeweiligen Harness. Codex kompaktiert nativ; diese Cache-Messung begründet dort
keinen Arbeitsstopp und keine Nachfolge.

Die [Usage-Messung vom 07.10.](messungen/2026-10-07-cache-lebensdauer-nachfolge.md) findet auf
diesem Host **rund 60 Minuten Cache-Lebensdauer** im Claude-Hauptgespräch: 3 043 von 3 043
Pausen zwischen 5 und 60 Minuten waren Treffer; ab 62 Minuten waren 270 von 270 Wiederaufnahmen
kalt. Direkt an der Kante: letzter Treffer bei 60,13, erster Miss bei 60,21 Minuten
(25 Paare aus 22 Sessions im Band 58–62 Minuten). Das ist eine beobachtete Übergangszone,
keine garantierte Frist. Ein gemeinsam genutzter Sockel kann warm bleiben, obwohl der
Gesprächsverlauf neu geschrieben wird. Als Planungspuffer **vor 55 Minuten seit der letzten
Usage** fertig sein; die fünf Minuten Reserve sind eine Empfehlung, kein gemessener Timer.
Ist die Schwelle schon erreicht und die Übergabe möglich, gleich im laufenden Turn handeln,
nicht erst bis zu diesem Puffer warten. Werkzeuglaufzeit zählt zur Cache-Pause, wenn kein
neuer Modellaufruf den Cache auffrischt.

Vorher dauerhaft machen:

- Änderungen committen; Ergebnis, Beleg, offene Arbeit und nächste Handlung an einem für die
  Nachfolgerin lesbaren Ort festhalten. Offene Pflichten tragen ihre IDs und ihre maßgebliche
  Quelle. Eine stehende Übergabe im ohnehin laufenden Turn aktualisieren; für die ungebundene
  Schiene und die Standard-Program-MAIN `intent` oder Zeiger auf einen committeten Abschnitt (bei
  der Program-MAIN neben dem Program-Record, der bei Widerspruch gilt), für Game-Maker den
  vollständigen Checkpoint. Es gelten die vier Fälle oben, kein zusätzlicher HANDOFF-Commit für Standard-MAINs.
- Laufende Subagenten beenden lassen und ihre Ergebnisse dauerhaft sichern: sie überleben den
  Tod der Vorgängerin nicht. Ein angekündigtes Ergebnis oder ein Tool-Handle im Gespräch genügt
  nicht als Übergabe. Eine selbstständige Fleet-Lane ist kein solcher Subagent; ihren Report
  und ihren Rückweg als dauerhafte Pflicht erhalten.
- Watches, Autos, nicht quittierte Events und offene Reports prüfen. Auf der ungebundenen
  Schiene setzt Fleet die armierten Watches und Autos mit ihrem Ziel bei der Nachfolgerin neu; der
  Linien-Record nennt je Pflicht `rearmed` oder `notRearmed` (`docs/self-api.md` §Der Linien-Record).
  Bei einer gebundenen Standard-Program-MAIN persistiert Fleet übertragbare Pflichten im
  `handover`; verlorene stehen in `handover.lost` (§Nachfolge oben). Vor dem Ende Quelle und
  Rückweg der noch laufenden Arbeit lesbar machen, nach dem Schnitt Übertragung beziehungsweise
  Wiederarmierung belegen. Eine Watch allein ist kein Beweis, dass ihr Ergebnis ankommt.

**Warten an der Schwelle kostet den alten Verlauf nochmals.** Bei 40 % eines 1M-Fensters,
also 400 000 gecachten Input-Token, kostet deren vollständiger 1h-Neuschrieb für Opus 5.5
3,20 USD statt 0,08 USD Cache-Read: **3,12 USD Mehrkosten, Faktor 40**. Das sind
[API-Listenpreis-Äquivalente](https://platform.claude.com/docs/en/about-claude/pricing)
(07.10.2026), keine gemessene Abo-Rechnung. Ein weiterhin warmer Sockel senkt den Neuschrieb;
Output, neuer Input und Erdung der Nachfolgerin kommen hinzu. Gemessen wurden bei kalten
Wiederaufnahmen ab 62 Minuten median 199 779 Write-Token, bei warmen Pausen von 5–60 Minuten
614. Wer nach einer Stunde nur noch zur Übergabe geweckt wird, bezahlt den großen alten
Verlauf und anschließend den Aufbau der Nachfolgerin. Ist die Übergabe noch blockiert,
Pflicht und Grund schon warm sichern; keine Keepalive-Pings daraus ableiten. Für eine bereits
kalte ungebundene Session, Orchestratorin oder Standard-Program-MAIN gibt es die Owner-Nachfolge
ohne Turn der Vorgängerin (oben); die Session erhält dadurch keine Owner-Befugnis.

Das ist gemessenes Wissen und eine Handlungsempfehlung für die bestehende Nachfolge. Der
Server-Hinweis `tickMigrate` prüft Füllstand, Schwelle und Zustellbarkeit und schweigt bei einer
frischen stehenden Übergabe (`server.ts#standingHandoverFresh`); er implementiert keinen
Cache-Ablauf und keinen Abschluss laufender Subagenten. Den Cache-Ablauf übernimmt je Session der
Owner-Schalter keepCache (`server.ts#tickKeepCache`, `docs/self-api.md` §keepCache): vor Ablauf der
gemessenen Stunde wird eine ruhende Session über ihrer Schwelle ohne eigenen Turn nachgefolgt oder,
solange Arbeit absehbar ist, mit einem kurzen Turn warm gehalten. Einen laufenden Subagenten liest
auch er nicht; solange einer läuft, ruht die Pane nicht, und keiner der beiden Akte greift.
Ohne Schalter warmt derselbe Tick eine gebundene claude-Program-MAIN und die Orchestratorin nach
50 min Ruhe mit einem kurzen Turn, abschaltbar je Belegung (`docs/self-api.md` §Default-Warm-Turn).

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

## Zwei Eigenarten, die eine Orchestratorin bezahlt hat (gemessen 2026-10-02)

**Die Nachfolge-Schwelle ist die effektive Einstellung, nicht eine Zahl auf der Karte.** Die Orchestratorin Slot 9
übergab am 2026-10-02 ~00:50 bei gemessenen 30 %, weil ihre Rollenkarte („Entscheidung bei 25 %
gemessen, keine neue Tiefenarbeit ab 30 %") das so sagte. Damals galt `FLEET_MIGRATE_PCT='40'`, und
der Owner fand die frühe Nachfolge „[Zitat entfernt]“. Seit der Owner-Promotion am selben Tag gilt: Die
Fleet-Defaults sind `FLEET_MIGRATE_PCT` (MAINs und Orchestratorin) bzw. `FLEET_LANE_MIGRATE_PCT`
(Lanes); eine Owner-Einstellung für die konkrete Belegung geht ihnen inzwischen vor
(`server.ts#patchHandover`). Die wirksame Zahl steht im Slot-Brief/Board
(`GET /api/slots/:id/brief` → `succession.thresholdPct`), der eigene Füllstand in dessen
`succession.fill` beziehungsweise `./ctl.sh ctx`. Die historische
45-%-Handlungsmarke ersetzt keine heutige Einstellung. **Das gilt für claude, nicht für
codex** (Owner-Korrektur 2026-09-30): eine codex-Orchestratorin verdichtet nativ, ihr gemessener
Füllstand ist Anzeige, und weder Schwelle noch 45 % lösen bei ihr einen Arbeitsstopp oder eine
Nachfolge aus. Eine bewusste Nachfolge schuldet trotzdem den vollen Linien-Record der Karte.

**Fünf armierte Watches heißen: kein Report kann dich erreichen.** `server.ts#slotDeliveryBudget`
rechnet `free = cap − offene Events − armierte Watches`, und `cap` ist
`FLEET_EVENT_MAX_OPEN_PER_SLOT = WATCH_MAX_PER_SLOT = 5`. Wer fünf Watches armiert (gemessen: vier
Lane-Watches + eine Merge-Watch nach einer Nachfolge), hat `free = 0`. Ein `fleet-report` einer
handgegründeten Lane an diese Session bekommt dann 409 `fleet-report receiver has no FleetEvent
delivery budget` — obwohl die Lane-Watch auf genau diese Lane der Empfängerbeleg ist, den der Report
braucht. Eine Route zum Entfernen einer Watch gibt es nicht; eine Watch gibt ihr Budget erst frei,
wenn sie feuert. Regel daraus: **höchstens vier Watches armieren, einen Platz für Zustellungen frei
halten**, und Merge-/Audit-Ausgänge lieber über einen Hintergrund-Wächter auf
`GET /api/slots/:id/merge` (`running:false`) lesen als über eine fünfte Watch. Offene Events mit
`./ctl.sh events --ack` quittieren, sonst halten auch sie Budget.
