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

**Das Portfolio-Gedächtnis ist eine Owner-Zuteilung, keine Rollenfolge** (seit 2026-09-24, Zeile
41641179). Beide Briefe tragen nach den Schritten den Pointer `YOUR PORTFOLIO MEMORY …`
(`server.ts#memoryPortfolioPointer`, ≤ 512 B) auf `GET /api/self/memory?view=portfolio` — die
Faltung der Projekte, die ein vom Owner gesetzter Read-Grant nennt, jede Summe auf Projekt und
Quellversion rückführbar. Das Label „Orchestrator" gewährt ihn nicht (409 `no-grant`); der Owner
setzt ihn mit `PATCH /api/slots/:id/memory-grant`, er ist reines Leserecht, und die generische
Nachfolge trägt ihn gleich oder verengt (`succeed` mit `memoryGrant`), nie weiter. Die Briefe
kopieren keine Portfolio-Tabelle: die manuelle projektübergreifende Übersicht im Übergabetext
entfällt, gelesen wird sie aus der Tür. Vertrag: `docs/self-api.md` §memory.

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
Zeilen nennt jede Gruppe einen Overflow samt Detailtür und druckt ihre Zeilen weiter.
`./register.sh --brief` bleibt für bestehende Leser erreichbar, ist aber kein zweiter Pflichtabruf.
`./state.sh --full` und `./register.sh --full` wählen die vollständige Diagnose; ein unbekanntes
Flag endet mit exit 2. Game-Maker, Fremdrepo- und Lane-Einstieg behalten ihren Vertrag.

## Werkzeuge

`ctl.sh` fügt keine Autorität hinzu; jedes Verb behält Credential, Scope und Server-Gate seiner Route.
Wo ein Verb `<slot>` nimmt (`ctx`, `watch lane|merge`, `land`, `wait merge`), darf seit S5 auch der Lane-Name stehen (`4A`): `ctl.sh` löst ihn über das `name`-Feld von `GET /api/sessions` auf, nie selbst; ein freier Name ist Exit 1 („no lane named …"), eine falsche Form Exit 2 vor jedem Request, und `watch` braucht für einen Namen das Owner-Token.
- **`ctl.sh get <pfad>`** liest EINE GET-Route unter `/api/` mit dem Credential, das diese Route verlangt: Owner-Token, fuer `/api/self` das Self-Token. `--keys` druckt statt des Koerpers die Feldform der obersten zwei Ebenen — die Antwort auf „[Zitat entfernt]“, ohne ein Ledger in den Kontext zu ziehen (das `suite.log` der Artefakt-Route sind 700+ KB). GET-only und `/api/`-only, beide Verweigerungen benannt statt still: eine Methode oder ein Body wird als solche abgelehnt, ein Pfad ausserhalb `/api/` ebenso, eine ganze URL mit dem Hinweis auf die Basis. Das Verb fuegt weder Route noch Berechtigung hinzu — was der Aufrufer nicht darf, beantwortet der Server weiter mit 401/403, und die Meldung nennt dann die QUELLE des Tokens (`FLEET_CTL_TOKEN`, `fleet.json`, die Pane-Env), nie seinen Wert. Die Routen, die es oeffnet und die in 14 Tagen kaum jemand las, stehen als Block „[Zitat entfernt]“ in der Ausgabe von `state.sh`.
- **`ctl.sh merges`** liest persistierte und laufende Land-Fakten; ohne Owner-Token bleibt die Live-Hälfte `unknown`.
- **`ctl.sh lock`** liest den Suite-Mutex; `--reap` ist der ausdrücklich schreibende, identitätsgeprüfte Sonderfall.
- **`ctl.sh ctx`** liest den gemessenen Kontextfüllstand; nicht messbar bleibt `unknown`, nie null Prozent.
- **`ctl.sh report`** liest den neuesten für den eigenen Occupant sichtbaren Task-Report; es ist kein Archiv.
- **`ctl.sh task <taskId>`** liest EINE Queue-Zeile samt Lane über `GET /api/lane?task=<id>` statt über `fleet.json`, `/api/sessions` und die Rohledger. Den Join macht der Server (`server.ts#resolveTaskLane`): eine lebende `sent`-Zeile über ihren Slot, sonst die `taskId` der Outcome-Zeilen (neueste zuerst), sonst `tasks-archive.jsonl` für eine Zeile, die `fleet.json` verlassen hat — das Archiv kennt die Zeile, nie die Branch. Die Slotnummer einer beendeten Zeile wird nie gelesen: sie gehört inzwischen womöglich einer anderen Lane. Die Route liefert dasselbe Dossier wie `?branch=` plus `resolved` (`result` `lane` mit `via` und allen Branches, `no-lane` mit Grund, oder **404** `unknown-task` mit den drei durchsuchten Quellen). Das Verb druckt je eine Zeile mit benannter Quelle: Status, Kartengültigkeit, Startplan-Grund einer wartenden Zeile (`releaseVerdict` + Wartenotiz des Ticks), Kopf des jüngsten Reports, Outcome, Audit; `--full` hängt Zeilentext und Reporttext an. Exit 1 nur für eine unbekannte Id; eine bekannte Zeile ohne Lane ist eine Antwort. Owner-Credential, nur lesend, bewertet keinen Report. Eine Wellen-Folgezeile findet ihre beendete Lane nicht — die Outcome-Zeile nennt nur den Kopf.
- **`ctl.sh audits`** liest den Tier-2-Trail über `GET /api/post-land-audits` statt aus `post-land-audits.jsonl`: je Zeile Zeit, `result`, `mainSha`, `covers`, `checks`, `fails` und die Adjudikation, die die Route an die Zeile hängt (`adj none`, wenn keine existiert — das Verb urteilt nicht). Die erste Zeile ist die Live-Hälfte aus `GET /api/sessions` (`postLandAuditLive`): `null` heißt Leerlauf, ein fehlendes Feld oder eine verweigerte Lesung `UNKNOWN`. `--last N` (Default 10, mit Filter 1000 = Deckel der Route), `--fail <text>` zählt über alle gelieferten Zeilen und nennt Nenner und wie viele davon überhaupt eine `fails`-Liste tragen, `--sha <sha>` findet die Zeile, die auf dem Tip lief ODER den Land (`covers[].mainAfter`) mitprüfte; eine unbekannte sha ist Exit 1 mit „UNKNOWN to the trail", ein leeres Ledger die Zeile „ledger empty". Owner-Credential, nur lesend.
- **`ctl.sh watch`** armiert Lane-/Merge-/Audit-Watches; das ist keine stehende Controller-Pflicht und gewährt kein Land.
- **`ctl.sh events`** liest eigene Events; `--ack` quittiert nur bereits zugestellte passende Zeilen.
- **`ctl.sh inbox [--ack <id>|--ack-all]`** liest mit Self-Credential den Program-Rückkanal der gebundenen MAIN; `--ack` quittiert genau einen Eintrag, `--ack-all` die beim Lesen ungelesenen. Unbekannte Ids und Scope-Verweigerungen bleiben mit Status und Servertext sichtbar; Lane- und ungebundene Sessions erhalten keine Inbox-Autorität.
- **`ctl.sh comment <taskId> <textfile>`** hängt über die bestehende Owner-Tür einen Task-Kommentar an. Leere Texte und mehr als 2000 Zeichen werden vor dem POST abgelehnt; Server-Verweigerungen werden benannt, das Credential wird nie ausgegeben.
- **`ctl.sh file <cardjson>`** liest einen JSON-Task-Body mit `text` und `card{ziel, surface, done, verify, verboten}` sowie optionalen Filing-Feldern wie `kind`, `repo` und Spawn-Tripel. Mit Self-Credential geht er an `/api/self/tasks`, sonst mit Owner-Credential an `/api/tasks`; ein Self-Refusal wechselt nicht auf Owner. Die Zeile bleibt pending. Falsche Listenformen und Größenüberschreitungen werden vor dem POST benannt, semantische Karten- und Scope-Prüfungen bleiben beim Server; kein Dispatch, Release oder Land.
- **`ctl.sh land`** startet mit Owner-Credential einen Land; Controller-Scope gewährt dieses Credential nicht. Mit `--wait` endet die Warteschleife an genau DREI Fakten und benennt jedes Mal welchen: dem Verdikt, dem abgebauten Slot (der Land hat die Lane mitgenommen) oder dem RECYCELTEN Sitz — der Tick hat die freigewordene Slot-Nummer schon mit einer anderen Lane besetzt, und die Antwort kommt dann aus `lane-outcomes.jsonl`, das nach BRANCH schlüsselt und den Slot überlebt (`disposition`; ohne Zeile eine benannte Nicht-Antwort). Exit 0 heißt weiterhin nur „[Zitat entfernt]“ — auf dem recycelten Pfad sagt das das Ledger, nicht der freie Sitz. Das vierte Ende, Schweigen bis `FLEET_CTL_WAIT_MAX_SEC` (3600 s), war der Normalfall, sobald ein Platz frei wurde (gemessen 2026-09-08 02:22), und ist keines mehr.
- **`ctl.sh dispatch`** startet mit Owner-Credential eine Queue-Zeile; Controller-Scope gewährt dieses Credential nicht.
- **`ctl.sh wait merge`** wartet einmalig auf einen konkreten Merge-Terminalfakt statt in der Pane zu pollen. Es bindet an die LANE, die es beim ersten Poll auf diesem Slot sieht, nicht an die Slot-Nummer: wechselt der Sitz die Hand, endet der Wait mit einer benannten Nicht-Antwort und Exit 3 — derselbe Code wie ein verbrauchtes Budget, weil es dieselbe Aussage ist (über die gemeinte Lane wurde nichts gemessen), nur innerhalb einer Poll-Periode statt nach einer Stunde.
- **`ctl.sh wait change`** wartet einmalig auf eine benannte State-Änderung; es ist kein permanenter Portfolio-Monitor.
- **`ctl.sh send --main`** schickt eine Textdatei per Owner-`/send` an die MAIN eines Programs: `main.slot` wird aus `GET /api/programs` und `/api/sessions` unmittelbar vor dem POST gelesen, nie aus dem Gedächtnis. Abgesagt ohne POST wird bei fehlender oder staler Bindung, fremdem Occupant (openedAt ≠ Bindung — der recycelte Slot), Lane-Slot und fehlendem Agenten; ein nacktes `send <slot>` gibt es nicht. Welcher Text und wann bleibt Entscheidung der Aufruferin. Der POST selbst traegt das gebundene `openedAt`, damit das Fenster zwischen Lesen und Senden serverseitig zu ist (unten).
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
  Lineage (`succeed`), seine offenen Attention- und Rückfragezeilen. Ein Program, das der Owner
  währenddessen abschließt oder umbindet, geht nicht mit und behält seinen Record. Ein Verbund mit
  einem Game-Maker-Program wird mit Namen abgelehnt (409). Nach einem Absturz zwischen Kill und
  Bindungsschnitt stehen die mitgehenden Programs stale; der Owner bindet sie mit
  `bootstrap-main {slot}` an die Nachfolgerin.
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

**Harness-Wechsel geht NICHT über `succeed`** (`server.ts#handleSelfSucceed`: „that harness is not
overridable here" — nur Modell/Effort innerhalb des geerbten Harness). Der Weg, gegangen am 2026-09-23
für die Orchestratorin von claude/Opus 5.5 auf codex/gpt-6-sol (Owner: „[Zitat entfernt]“
): `POST /api/slots/:id/open`
auf einem freien Slot mit `harness`/`model`/`effort` und einem Label, das `server.ts#isOrchestratorLabel`
erkennt — dann liefert `server.ts#deliverOrchestratorSpawnCard` die Rollenkarte. Einen Linien-Record
schreibt dieser Weg nicht; die Übergabe trägt deshalb ein committeter `HANDOFF.md`-Abschnitt (echte
Nachfolge nach Regel A), auf den die Vorgängerin die Nachfolgerin per `/send` zeigt, bevor sie endet.
Codex lädt `AGENTS.md`, nicht `CLAUDE.md`: der Hinweis nennt die benötigten Regelbuch-Abschnitte namentlich.

## Kontext-Hinweis des Servers

Der Tick `server.ts#tickMigrate` (nur registriert bei `FLEET_MIGRATE_PCT > 0`) stupst ausschließlich
Slots der claude-Harness an; codex/pi/pi-zai sind nicht zuständig, nicht 0 %. Seine MAIN-Nachricht
(`server.ts#migrateMessage`) folgt der Schiene, die `server.ts#migrateRailOf` über dieselbe Bindung
wie `handleSelfSucceed` bestimmt: gebundene Standard-Program-MAIN → offene Pflichten lesbar machen,
dann `succeed` mit optionalem `carry`, kein HANDOFF-Commit · Game-Maker → Checkpoint committen,
`succeed` ohne `carry` · ungebunden, mehrdeutig gebunden → Pflichten stehen lassen (sie gehen
per ID in den Linien-Record), `succeed` mit optionalem `intent` ODER `pointer`. Der Hinweis ist ein Server-Prädikat, nicht das Gate; das Gate bleibt `handleSelfSucceed`.

## Zwei Eigenarten, die eine Orchestratorin bezahlt hat (gemessen 2026-10-02)

**Die Nachfolge-Schwelle ist die env, nicht eine Zahl auf der Karte.** Die Orchestratorin Slot 9
übergab am 2026-10-02 ~00:50 bei gemessenen 30 %, weil ihre Rollenkarte („Entscheidung bei 25 %
gemessen, keine neue Tiefenarbeit ab 30 %") das so sagte. `.env` sagt `FLEET_MIGRATE_PCT='40'`, und
der Owner fand die frühe Nachfolge „[Zitat entfernt]“. Seit der Owner-Promotion am selben Tag gilt: Die
Schwelle ist `FLEET_MIGRATE_PCT` (MAINs und Orchestratorin) bzw. `FLEET_LANE_MIGRATE_PCT` (Lanes).
Darunter wird nicht übergeben, über 45 % wird die Nachfolge aktiv gefahren. Die Zahl liest man aus
`.env` und den eigenen Füllstand misst man mit `./ctl.sh ctx`. **Das gilt für claude, nicht für
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
