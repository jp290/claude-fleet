---
frage: Welche Freigabe-Türen und Prinzipale bestehen, und welcher begrenzte nächste Schritt löst das Freigabe-Problem der Richtung 247c2f37?
urteil: Zuerst eine geprüfte Sammelfreigabe als Owner-Akt im gewählten Program; im Snapshot wären acht Leichtgewicht-Zeilen zusätzlich freigabefähig, während alle zwölf bereits freigegebenen Fleet-Zeilen an Kollisionen hängen. Ein neues Token beseitigt diese Engpässe nicht.
bereich: [queue, freigabe, autoritaet, karten, dispatch]
belege: [server.ts#releaseTask, server.ts#releaseTaskForMain, server.ts#tickDispatch, server.ts#programReleasePolicy, server.ts#dispatchTask, server.ts#handleStewardRoute, server.ts#handleHelperRoute, server.ts#handleIntake, server/auth.ts#tokenFrom, start-plan.ts#releaseVerdict, e2e/tasks.ts, e2e/programs.ts, e2e/security.ts, e2e/pins.ts]
nicht-gemessen: Live-Konfiguration und Credentials; tatsächliche Starts nach einer Politikänderung; Owner-Zeitgewinn; Vollständigkeit der vorhergesagten Schreibflächen; Sandbox-Sicherheit eines Agenten; Laufzeitproben der API-Schreibwege
stand: 2026-09-14, Eingabesnapshot laut Auftrag 21:39; Dateidatum nach Auftrag
---

# Freigabe-Analyse für die Owner-Session

## 1. Türen: Freigabe ist eine Entscheidung, Start eine zweite Prüfung

Die Abstraktion einer begrenzten Freigabe soll bestehen, weil die Zustimmung zu Arbeit keine unbeschränkte Start-, Land- oder Deploy-Berechtigung bedeutet.
Untersucht: die Queue-Zustandszuweisungen und sämtliche Aufrufer von `releaseTask`/`dispatchTask`, deren Route-/Tick-Gates, Credential-Dispatcher und die unten benannten Proben.
**Quellbefund** bezeichnet gelesenen Code, **Messung** das ausgeführte Snapshot-Skript, **Entwurf** eine noch unimplementierte Entscheidung; keine mutierende API-Sicherheitsprobe wurde ausgeführt.
Baum: `1ab5fa25a86175e9f84dbb8ea20caf82bba6393c`, ermittelt mit `git rev-parse HEAD`; alle folgenden Zeilenanker gelten dort.
Graphify wurde nur zur Orientierung gelesen; dessen teils auf `.hub-prototype` zeigende Treffer sind kein Beleg für diesen Baum.

Reproduzierbare Quellinventur, auch bei den eingebetteten NUL-Bytes in `server.ts`:

```sh
rg -an 'releaseTask\(|dispatchTask\(|status = "queued"|status:.*"queued"|programReleasePolicy|tickOwnsRow' server.ts
rg -an 'taskAct|taskDispatch|selfTaskRelease|programReleaseRoute|programDispatchRoute|/api/wave/dispatch|/api/dispatch' server.ts
# Einen Tabellenbeleg vollständig, einschließlich Kommentaren, nachlesen:
nl -ba server.ts | sed -n '9327,9408p'
```

**Legende:** M = `dispatchOn`/Master-Stop, L = Repo-/Program-Lane-Deckel, K = Startplan-Kollision, H = Hold, T = `kind`.
„Später Tick“ heißt ausdrücklich: Der Freigabe-Endpunkt selbst prüft diese Startbedingungen nicht.
HTTP-Methode in der Tabelle stets POST, außer dem internen Tick.

| Tür / Wirkung | Prinzipal | M / L / K / H / T und weitere Schranken | Beleg `server.ts#symbol` mit Zeile |
|---|---|---|---|
| `/api/tasks` mit `queue:true`: neue Zeile unmittelbar `queued` | owner | M/L/K später Tick; H bei Neuanlage nicht gesetzt; T nur `auftrag` (auch Default). Text, optionale Karte, Spawn, Repo und optionales bestätigtes/aktives Program werden geprüft; eine Karte ist nicht Pflicht. | `#fetch` 32220–32277; Objektliteral 32268 |
| `/api/tasks/:id/queue`: bestehende Zeile `queued`, `releasedBy=owner` | owner | M/L/K später Tick; H wird gelöscht; T nur `auftrag`. **Keine Statusbeschränkung** auf `pending`: auch laufende/terminale Aufträge treffen `releaseTask`. Kosten: erneute Queue-Freigabe kann bereits laufende/abgeschlossene Arbeit erneut disponierbar machen. | `#taskAct` 32744–32814; `#releaseTask` 2353–2357 |
| `/api/self/tasks/:id/release`: `pending→queued`, `releasedBy=machine` | self, exakt gebundene MAIN | M/L/K später Tick; H wird gelöscht; T nur `auftrag`; eigenes aktives Program, kanonisch gleiches Repo, automatable Harness, unter `manual` zusätzlicher Deckel auf bereits gequeuete Program-Zeilen. Gehaltenes `queued` ist Sonderfall: nur Hold löschen, vor Repo-/Harness-/Deckelprüfung. | `#selfTaskRelease` 30103–30110; `#releaseTaskForMain` 9327–9408; `#boundProgramForMain` 8719–8729 |
| `/api/programs/:id/release`: Politik setzen, später `pending→queued→sent` im Tick | owner erteilt; Maschine vollzieht | Route schreibt nur Politik (`manual`, `card-valid`, `all`); Wirkung nur bei aktivem Program. M/L/K/H/T im Tick. `card-valid` verlangt die harten Voraussetzungen aus `releaseVerdict`, nicht `card.valid===true`; `all` umgeht Karten-/Herkunftsprüfung, aber nicht Hold oder pending-Scout-Sperre. | `#programReleaseRoute` 26144–26177; `#programReleasePolicy` 11744–11748; `#tickDispatch` 11981–12001; `start-plan.ts#releaseVerdict` 95–120 |
| interner `tickDispatch`: startet freigegebene Einzelzeile oder vollständige Welle | Maschine aus owner/self-Freigabe oder Owner-Politik; kein Token | M ja, **aktiver Program-Dispatch-Grant übergeht jedoch `dispatchOn=false` für sein Program**; L beide Deckel; K gegen laufende Lanes/frühere Wellen und `after`; H sperrt selbst `queued`; T nur `auftrag`. Harness, freier Slot, Autos-Schalter, Quiet Hours und erneutes Release-Urteil nach `await`; Politik ohne lebende MAIN zusätzlich auf eine Lane begrenzt. | `#tickDispatch` 11767–12012; `#programDispatchGrant` 11723; `#programDispatchCap` 11736; `#tickOwnsRow` 11751 |
| `/api/tasks/:id/dispatch`, einschließlich `clarify:true`: direkt `pending/queued→sent` | owner | **M/L/K/H nicht geprüft**, T nur `auftrag`; Status, Dispatch-Doppelstart, Ziel-Repo, Spawn-Parameter und freier Slot geprüft. `dispatchTask(..., true)`; auch Autos-/Quiet-/Harness-Automationsgates beim Briefen ausgenommen. | `#taskDispatch` 32442–32492; `#dispatchTask` 10536–10613; `#briefAndSend` 10829–10835 |
| `/api/wave/dispatch`: alle benannten Zeilen direkt `pending/queued→sent` in gemeinsamer Lane | owner | **M/L/K/H nicht als Startgate geprüft**, T jede Zeile `auftrag`; exakte aktuelle Land-Welle, eindeutige IDs, Größe/Budget, Status, Repo, Spawn und freier Slot. Der berechnete `plan.next` wird zurückgegeben, nicht als Startverbot ausgewertet. | `#fetch` 32348–32437, insbesondere 32387–32400 und 32428 |

Die Startfunktion hat genau die in der Inventur auffindbaren Aufrufer: Tick, Einzelstart, Wellenstart; `releasedBy` wird bei direktem Owner-Start auf `owner` gesetzt (`server.ts#dispatchTask:10587–10612`).
Der Steward-Token erreicht **keine** dieser Freigabe-/Start-Türen (`#fetch:30623–30626`); ein Steward-Slot kann allerdings mit seinem **anderen**, persönlichen Self-Token die MAIN-Tür nutzen, sofern die aktive MAIN-Bindung tatsächlich besteht (`#selfTaskRelease:30108`, `#boundProgramForMain:8719`).

Vollständigkeitsrand: Folgende Wege müssen im Entwurf mitgedacht werden, sind aber keine neue Freigabe von `pending`:

- `/api/dispatch {on}` und `/api/programs/:id/dispatch {dispatch}` sind Owner-Schalter für spätere Tick-Starts, keine Zeilenfreigabe (`#fetch:32816–32822`, `#programDispatchRoute:26094–26135`). Der Program-Grant setzt den Autos-Schalter nicht außer Kraft (`#tickDispatch:11952–11979`).
- `briefAndSend#requeue:10792–10819`, Boot-Reconcile `server.ts:27381–27387` und Self-`/api/self/wave/split` `29983–30032` schreiben nach einem Start erneut `queued`; sie erhalten die frühere Herkunft statt `releasedBy` neu zu stempeln. Split verlangt eigene Wellenzeilen, einen Grund, verbleibende Arbeit und noch keinen terminalen Report.
- `POST /api/self/tasks` erzeugt nur `pending`; `adopt`, `/kind`, `unarchive` und `/refine/promote` können Arbeit in den Politik-Lesebereich bringen. Die spätere Freigabe bleibt der Tick-Weg, keine zusätzliche direkte Startfunktion (`#createTaskForMain:9834–9910`; `#fetch:30041–30047`, `32307–32316`, `32553–32588`, `32778–32803`).
- Dokumentdrift: `docs/queue-analyst.md:239–251` beschreibt noch „kein Verdict“ und den alten Bestand an Maschinenpfaden; `docs/self-api.md:654–677` beschreibt die vorhandene Politik. Auf den älteren Exklusivitätssatz zu bauen würde den Politikstart und Split übersehen.

## 2. Geschlossene Liste der Credential-Prinzipale

Geschlossen über die Credential-Erkennung des HTTP-/WS-Servers: Owner, Self, Steward, Helper, Intake, Share-Gast; Rollen wie MAIN/Supervisor sind Bindungen innerhalb von Self, keine weiteren Token-Typen.
Die Schranke ist eine API-Schranke; daraus folgt keine Betriebssystem-Isolation eines lokal voll berechtigten Agenten.
Inventurbefehl: `rg -an 'secretEq\(|timingSafeEqual\(|tokenFrom|helperAuthed|handleIntake|shareGate' server.ts server/auth.ts`.

| Credential | Reichweite und geschlossene Grenze | Beleg |
|---|---|---|
| Owner `TOKEN` über Bearer, `fleet`-Cookie oder Query-Token | Owner-Router inklusive Queue/Dispatch, Program-Politik/Grant, Land, Deploy, Slot-Steuerung und Credential-Ausgabe; zusätzlich Helper-Portal. Keine automatische Self-Identität. | `server/auth.ts#tokenFrom:9–16`; `server.ts#tokenGate:23766–23777`, `#fetch:30591–30617`, `30790`, `31246–31249`; `#helperAuthed:19726–19729` |
| Self pro aktivem Slot, Header `x-fleet-self-token` | Nur explizite Self-Routen; Slot aus Tokenvergleich und `cwd`, Rotation bei `openSlot`. Die geschlossene Routenfamilienliste steht unmittelbar unten; Bindungs-/Lane-Prüfungen verengen weiter. Insbesondere kein Owner-Queue/Dispatch, kein Politiksetzen und kein Deploy. | `server.ts#openSlot:5115`; `#fetch:29640–30576`, Owner-Gate 30790; MAIN-Freigabe 30103, MAIN-Land 30131–30140 |
| Steward `stewardToken` über `tokenFrom` | GET sessions/digest, Slot-brief/transcript, dispositions, deploys, journal; POST eigene autos, pending tasks, gated send, journal **und deploy**. Handler-Rest fällt auf `403 route not in scope`; keine Owner-Queue/Start/Land-/Token-Lesetür. | `server.ts#handleStewardRoute:29315–29581`; `#fetch:30623–30626` |
| Helper `helperToken`, Header `x-fleet-helper-token` oder Query/`tokenFrom` | GET `/helper`, jobs, bundle; POST device, claim, result, artifact. Job-/Claim-Gates begrenzen Ergebnisse; kein Owner-/Self-Recht. Owner kann das Portal ebenfalls authentifizieren. | `server.ts#helperAuthed:19726–19732`; `#handleHelperRoute:19737–19981`, abschließendes Default-Deny 19981 |
| Intake `FLEET_INTAKE_SECRET`, Header `x-intake-secret` | Nur POST `/intake`: neue `pending`-Aufträge, kein frei wählbares Program/Repo/Queue-Status. Ohne konfiguriertes Secret deaktiviert; Rate-/Auth-Limits. | `server.ts#handleIntake:26328–26365`; früher Eintritt `#fetch:29615` |
| Share-Gast, Share-Passwort und `share_<id>`-Cookie | Nur jeweiliger Share: auth/info/diff/brief/transcript/summary/comments und WS-Ansicht; kein Task-Router. `send` steht zwar in der URL-Regex, besitzt im gelesenen Share-Handler keinen ausführenden Zweig und endet im Fallback; WS-Gastnachrichten werden verworfen. | `server/auth.ts#shareGate:67–74`; `server.ts#fetch:30657–30783`, `#websocket.message:33271` |

Geschlossene Self-Routenfamilien (jeweils `/api/self`, Methoden und Unterpfade wie im genannten Quellbereich; **keine Prefix-Vollmacht**):

- Identität `/`, flakes, autos; programs; program-execution; supervisor-view, nudge, supervisor-watch/:id/complete; main-direct einschließlich preflight/finalize/abandon; watch (`server.ts:29640–29799`).
- clarifications und :id/reply; inbox und :id/read; messages und :id/read; fleet-report und :id/accept|reject; harness-block; attention (`server.ts:29806–29923`).
- tasks/:id/files-proposal; wave/split; tasks; tasks/:id/notes|brief; tasks/confirm-cards; tasks/:id/release|hold|land (`server.ts:29935–30140`). Land ist für gebundene MAIN nach eigener Promotion-/Landprüfung möglich, ausdrücklich nicht für Lane oder Steward; daher eignet sich ein MAIN-Token nicht als enges Release-Token.
- events/:id/ack; succeed; retire; drift; gate; criterion; suite-offer einschließlich withdraw; jobs und :id; verify-intent; notes und :id/verdict (`server.ts:30143–30576`).

Das bestehende Steward-Credential als „Sondertoken“ umzubenennen wäre eine Rechteausweitung: Es darf bereits senden und deployen, also genau Handlungen, die der gewünschte Release-Prinzipal nie dürfen soll.
Ob Credentials im Betrieb getrennt ausgegeben/verwahrt werden, bleibt unbekannt; Inhalte von `fleet.json`, `.env` und Prozess-Kommandozeilen wurden nicht eingesehen. Bun meldete beim vorgeschriebenen Install-Schritt sein automatisches Laden von `.env`; deren Inhalt wurde nicht ausgegeben.

## 3. Reproduzierte Zählung des bereitgestellten Snapshots

**Messung, keine aktuelle Live-Queue:** Eingaben ausschließlich aus `/Users/owner/claude-fleet-private/astra-inputs-2026-09-14/`.
`active-programs.json`: Fleet-Betrieb `card-valid`, Leichtgewicht und Private-repo-j `manual`; fehlende Politik wird wie im Code gelesen.
Die folgende Zählung verwendet die Release-Urteile aus `start-plan.json` und ergänzt Program/Hold aus `open-tasks.json`; Zeilen werden je Grund exklusiv zugeordnet, Gründe können sachlich trotzdem gemeinsam vorliegen.

| Fleet-Repo: Grund | Zeilen | Bedeutung |
|---|---:|---|
| freigegeben | 12 | 8 durch Politik, 4 bereits `queued`; alle haben `next.collides` |
| ohne Program | 12 | im Snapshot pending/manual; kein allgemeines Verbot eines späteren Owner-Queue-Akts |
| Leichtgewicht, manual | 14 | Gegenrechnung mit bestehenden Checks: 8 würden `card-valid` passieren |
| harte Kartenlücke | 8 | alle ohne belegte Dateien, darunter eine zusätzlich ohne gültigen Verify-Pfad |
| Hold | 4 | explizite Sperre; Sammelfreigabe darf sie nicht beiläufig aufheben |
| Summe | 50 | nur offene, noch nicht gestartete `auftrag`-Zeilen dieses Repos |

Die 12 Kollisionsgründe verteilen sich auf `server.ts` 4, `server/types.ts` 3, `e2e/pins.ts` 2, `docs/messungen/INDEX.md` 2 und `e2e/tasks.ts` 1; letzterer nennt eine frühere Planzeile, die anderen eine Lane.
Repo-Belegung im Snapshot: Fleet **2/3**, Biber **0/1**; Biber trägt zusätzlich 2 Planzeilen, beide manual, die zweite mit `after` auf die erste.
Der Task-Auszug enthält 82 Zeilen: 54 Auftrag, 19 Notiz, 8 Richtung, 1 Betrieb; Status 76 pending, 4 queued, 2 sent.
Damit sind 28 beratende Zeilen absichtlich außerhalb des Startplans; die 2 gesendeten Aufträge erklären den verbleibenden Abstand zwischen Task-Auszug und Plan.
Die ältere Zahlenreihe im Text von `247c2f37` (13 freigegeben, 3/3 belegt, 12 Kollisionen an `server.ts`, 21 Notizen/Richtungen) ist für diesen Snapshot **nicht reproduziert** und wird nicht als Messung übernommen.
Quelltext dieser älteren Behauptung: `python3 -c 'import json; print(next(t["text"] for t in json.load(open("/Users/owner/claude-fleet-private/astra-inputs-2026-09-14/open-tasks.json")) if t["id"]=="247c2f37"))'`.

Wichtig für „alles Gültige“: `ee47b0f8`, `1832c7eb`, `e4409bf2` haben `cardValid=true` und scheitern dennoch an fehlenden belegten Dateien; umgekehrt sind 7 freigegebene Zeilen `cardValid=false`.
`rolle.harness: Codex` oder eine Symbol-Lücke allein sind Hinweise, keine harte Sperre (`start-plan.ts:90–120`; ausführbare Gegenfälle `e2e/tasks.ts:6740–6790`).
Kosten einer Gleichsetzung mit dem UI-Kartenflag: ungeeignete Zeilen freigeben und geeignete unnötig liegenlassen.

**Eigenes reproduzierbares Skript**, aus dem Repo-Root ausführen; alle oben genannten Snapshot-Zahlen einschließlich der Gegenrechnung kommen hieraus:

```sh
bun - <<'JS'
import { releaseVerdict } from './start-plan.ts';
const root='/Users/owner/claude-fleet-private/astra-inputs-2026-09-14/';
const plan=await Bun.file(root+'start-plan.json').json();
const tasks=await Bun.file(root+'open-tasks.json').json();
const programs=await Bun.file(root+'active-programs.json').json();
const byId=new Map(tasks.map(t=>[t.id,t]));
const count=a=>Object.fromEntries([...new Set(a)].sort().map(k=>[k,a.filter(x=>x===k).length]));
const rows=plan.repos.flatMap(repo=>repo.waves.flatMap(w=>w.rows.map(r=>({...r,repo:repo.repo,next:w.next}))));
if (rows.some(r=>!byId.has(r.id))) throw Error('Snapshot-Join unvollständig');
const fleet=rows.filter(r=>r.repo==='/Users/owner/claude-fleet');
const reason=r=>r.release.released?'freigegeben':byId.get(r.id).hold?'hold':
  !byId.get(r.id).programId?'ohne-program':r.release.why?'harte-luecke':'manual';
const hard=fleet.filter(r=>reason(r)==='harte-luecke');
const released=fleet.filter(r=>r.release.released);
console.log(JSON.stringify({
  programs:programs.map(p=>({id:p.id,policy:p.release?.policy??'manual'})),
  repos:plan.repos.map(r=>({repo:r.repo,lanes:r.lanes,cap:r.cap.max,rows:r.waves.flatMap(w=>w.rows).length})),
  tasks:tasks.length,kinds:count(tasks.map(t=>t.kind)),statuses:count(tasks.map(t=>t.status)),
  fleet:count(fleet.map(reason)),why:count(hard.map(r=>r.release.why)),
  releasedBy:count(released.map(r=>r.release.by)),
  collisions:count(released.map(r=>r.next.collides?.file??JSON.stringify(r.next))),
  hardButCardTrue:hard.filter(r=>r.checks.cardValid===true).map(r=>r.id),
  releasedButCardFalse:released.filter(r=>r.checks.cardValid===false).map(r=>r.id),
  manualCounterfactual:programs.filter(p=>(p.release?.policy??'manual')==='manual').map(p=>{
    const rs=rows.filter(r=>byId.get(r.id).programId===p.id);
    return {id:p.id,rows:rs.length,eligible:rs.filter(r=>releaseVerdict({
      ...r,held:!!byId.get(r.id).hold,release:'card-valid'
    }).released).map(r=>r.id)};
  })
},null,2));
JS
```

Die Gegenrechnung ändert ausschließlich die Politik-Eingabe von `releaseVerdict`; sie simuliert weder neue Kollisionsflächen/Wellen noch reale Starts, Kosten, geänderte Karten oder MAIN-Lebendigkeit.
Insbesondere sind die beiden Biber-Karten dadurch nicht als Game-Preflight oder zur Ausführung autorisiert.

## 4. Drei Entwürfe mit Fehlerfällen und notwendigen Proben

**A — `card-valid` als Default je aktivem Program.**
Wirkung: Die vorhandene `programReleasePolicy`/`releaseVerdict`-Kette übernimmt auch zukünftige geeignete pending-Zeilen; keine neue Startfunktion nötig.
Risiko: Ein Default ist eine fortdauernde Vollmacht, kein einmaliges Freigeben der gesehenen Zeilen; Aktivierung, spätere Kartenreparatur oder Import machen Arbeit ohne erneuten Klick startbar.
Eine maschinell gültige Karte beweist weder sinnvollen Auftrag noch akzeptierte Game-Preflight-Reihenfolge; ein aktives Program allein ist deshalb keine hinreichende Migrationserlaubnis.
Vorschlag: Owner wählt ausdrücklich Program und Reichweite, bestehendes `manual` bleibt beim Umstieg erhalten; Hold bleibt vor jeder Politik, `all` wird nicht als Reparatur benutzt.
Fehlerfall: Ein „unqueue“ ist unter dieser Politik kein Stop, weil `pending` wieder berechtigt sein kann (`server.ts#taskAct:32801`, `#tickOwnsRow:11751`); die Oberfläche muss stattdessen Hold anbieten.
Zu pinnen: `e2e/tasks.ts` neben `(rel)`/`(rel-tick)` ab 6735/6975 für neue Zeilen, Hold, Scout, harte/weiche Lücken, fehlende MAIN, Kollision und Caps; `e2e/programs.ts` ab 6081 für explizite Politik/Default/Migration, Ablehnung fremder Prinzipale und inaktiver Programs; `e2e/pins.ts` für Default-Vertrag.

**B — Sammel-Tür „alles Gültige dieses Programs“.**
Wirkung: Ein Owner-Akt über eine konkret angezeigte Auswahl; ausschließlich Queue-Freigabe, anschließend vorhandener Tick. Vorgeschlagene Route: `POST /api/programs/:id/release-valid`.
„Gültig“ bedeutet hartes `releaseVerdict(..., release:'card-valid')` für pending-Aufträge, eigenes gewähltes aktives Program und Repo, keine Holds/Scouts, automatable Harness; bereits queued wird als bereits freigegeben ausgewiesen.
Vorschau nennt IDs, Brief-/Kartenstand, harte Gründe und weiche Hinweise; Submit bindet genau diesen Stand und berechnet vor dem Schreiben erneut, damit spätere Zeilen nicht still in „alles“ geraten.
Risiken: Ein einfacher Loop über Owner-`queue` würde Holds löschen und Kartenprüfungen umgehen; ein Loop über MAIN-release kann am Program-Deckel teilweise abbrechen und braucht nach jedem Await eine frische Identitäts-/Zeilenprüfung.
Deshalb eigener begrenzter Auswahlabschluss mit Ergebnis je ID (freigegeben, übersprungen mit Grund, Konflikt), stabiler Wiederholung und explizitem Verhalten bei zwischenzeitlichem Hold, Archivierung, Briefänderung oder konkurrierendem Release; niemals `dispatchTask(..., true)` aufrufen.
Zu pinnen: `e2e/programs.ts` neben MAIN-release/Hold für Program-/Repo-Grenze, leere/falsche Bodies, fremde/terminale IDs, erneuten Submit, Teilfehler und paralleles Hold; `e2e/tasks.ts` für unveränderte Tick-Sperren und Kartenfälle; `e2e/security.ts` für Owner-only; `e2e/pins.ts:2660–2674` muss eine neue Release-Aufrufstelle bewusst einordnen.

**C — zusätzliches Token-Paar „release“.**
Annahme zur noch offenen Bedeutung von „Paar“: getrenntes Lesetoken für die Program-Queue und Mutationstoken für die nachstehende geschlossene Liste, beide an dasselbe Owner-bestimmte Program/Repo gebunden, widerrufbar und befristet.
**Darf lesen:** reduzierte Queue/Karten/Startgründe dieses Programs, eigene Operationsquittungen; keine Transkripte, freien Dateipfade oder Credential-Endpunkte.
**Darf schreiben, ausschließlich:** freigeben nach B-Prädikat; halten; noch nicht gestartete, unreferenzierte Zeilen archivieren; Karte zu bestehendem, unverändertem Brief setzen und serverseitig am aktuellen Baum validieren.
**Darf nie:** land/merge, deploy, kill, send/messages/nudge/autos/jobs, Token lesen/erzeugen, Program-Politik/Grant/Zuordnung ändern, neue Tasks oder Ersatz-Briefs erzeugen, `kind` ändern, Hold aufheben oder beliebige Felder patchen; alle übrigen Routen/Methoden sind ebenfalls verboten.
Diese Einschränkung erlaubt keinen „read-only“-Agenten, der alte Zeilen selbst archiviert: Archivieren und Karte setzen sind Schreibrechte und müssen getrennt erteilt werden.
Risiken: Kartenfelder beeinflussen Flächen, Done/Verify und unter Politik den Start; ein Agent könnte durch eine zu enge Fläche Kollisionen unsichtbar machen oder durch eine schwache Done-/Verify-Angabe schlechte Arbeit freigeben.
Darum Karte gegen unveränderten Auftrag binden, Herkunft und alten/neuen Stand quittieren, keine frei erfundene Verengung akzeptieren und semantische Änderungen zur Owner-Entscheidung geben; der Validator ist kein Sicherheitsbeweis für beliebige Briefinhalte.
Weiterer Fehlerfall: Prefix-Freigabe oder Wiederverwendung des Steward-/MAIN-Tokens erbt verbotene Rechte; stattdessen separater Auth-Zweig vor Owner-Fallback mit exakter Methode/Route und Objektbindung.
Bekanntes Credential außerhalb seiner Vollmacht erhält eine benannte Scope-Ablehnung (Entwurf: 409); ungültiges/abgelaufenes Credential bleibt Auth-Fehler, keine Erfolgsmeldung. C erhält keinen Dispatch-Bypass und keine lokalen Owner-Dateirechte.
Zu pinnen: `e2e/security.ts` nach dem Steward-/Helper-Default-Deny ab 684 für jede erlaubte und verbotene Route/Methode, Token-Lecks, Ablauf/Widerruf und Fremdprogram; `e2e/programs.ts` für Scope/Occupant-Wechsel nach Await; `e2e/tasks.ts` für Karten-Manipulation, Hold, Archiv-Quellenbindungen und parallele Writes.
Ein Token-Paar allein beschränkt einen Agenten mit freiem Zugriff auf Owner-Dateien oder tmux nicht; Isolation dieses möglichen Agenten ist eine offene Voraussetzung, hier nicht untersucht.

Oberflächenentscheid je Entwurf: Server/HTTP, Persistenz samt Rücklesen, Board/Startplan, Dokumentation und genannte Proben **apply**; für C zusätzlich Credential-Ausgabe/Widerruf/Audit **apply**.
Harness-Verhalten und Provider-/Modellprotokolle bei A/B/C **not-applicable** (bestehendes `harnessAutomatableFor` weiterverwenden); direkter Agentenzugriff auf Host-Credentials bei C **unsupported**.
Client-Dateien wurden nicht untersucht; die nötige Anzeige von Auswahl, Sperrgrund, Hold und Quittung ist eine Entwurfsanforderung, keine Behauptung über vorhandene UI-Fähigkeiten.

## 5. Empfehlung

Ich empfehle B als ersten Schnitt: Im Snapshot würden acht der vierzehn manual-Zeilen von Leichtgewicht das vorhandene `card-valid`-Prädikat passieren, und eine sichtbare Sammelauswahl macht daraus einen begrenzten Owner-Akt.
A sollte anschließend je Program ausdrücklich gewählt werden, weil ein Default auch zukünftige Arbeit autorisiert und aktive Game-Programs ihre eigene Preflight-Freigabe brauchen.
Die zwölf schon freigegebenen Fleet-Zeilen warten sämtlich auf Kollisionen, deshalb darf mehr Freigabe nicht als Nachweis für mehr Durchsatz gelten.
C folgt nur bei nachgewiesenem Bedarf an delegierter Queue-Pflege und mit der geschlossenen Rechteliste, da vorhandene Steward- und MAIN-Credentials verbotene Zusatzrechte besitzen.
Die acht hart blockierten Karten werden gegen Auftrag und Baum repariert, während die vier Holds und zwölf programlosen Zeilen eine eigene Sichtungsentscheidung behalten.

Verifikation: `bun install --frozen-lockfile` erfolgreich; eingebettetes Skript ausgeführt und Zahlen, Abschnittsstruktur sowie Zeilenlimit geprüft; `git diff --cached --check` ohne Befund.
`bun e2e/pins.ts` endete mit folgendem wörtlichen Tail (Quellinventur und Entwürfe sind dadurch keine ausgeführten API-Tests):

```text
PASS  land-log.ts#VERIFY_SKIP_EXIT is server.ts#VERIFY_SKIP_EXIT  (land-log says 42)

ALL PASS
```
