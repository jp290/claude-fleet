# HANDOFF — Fleet-Autonomie-Recovery (Slot 16), 2026-08-30 09:03 CEST

Owner-Ziel: den Fleet-Workflow von außen nach innen wieder zuverlässig und weitgehend autonom
machen. Priorität ist der Transportpfad, weil Fleet-Nachrichten wiederholt in den Owner-Entwurf
geschrieben wurden; zuletzt kam eine Nachricht nur teilweise an und blieb abgeschnitten im
Eingabefeld. Keine weitere Komfortarbeit vor dem P0-Nachweis dieses Pfads.

## 1. Produktionsstand und Second-host-Beweis

`main` und der laufende Server stehen auf `088d3a8b90de17cd42f648caf2640641edd77d77` (Deploy
`416d7fa4`, `hitTarget:true`, `bundleStale:false`, `codeBehind:false`). Der Second-host-Portal-Audit
dieses exakten Tips endete nach 1.274.049 ms mit Exit 0 und `ALL PASS`; sein Trail nennt
`rows=3308 results=3308`, denselben Tree und `dirty=false`. Second-host ist weiter `active`, ohne
Claim und ohne Lapse.

Offene Proof-Surface: das strukturierte Ledger zählt wegen des auf 64 KB gekürzten Tails nur 23
Checks, obwohl der Trail 3308 belegt. `remote.clonedSha` fehlt ebenfalls, weil der installierte
Remote-Daemon älter als die aktuelle Helper-Implementierung ist. Ein Daemon-Rollout/Restart ist laut
`helper-daemon/README.md:68` ein eigener Owner-Akt; nicht eigenmächtig durchführen.

## 2. P0 läuft in Slot 2: FleetEvent-Zustellung und Composer-Commit

- Task `9912a68a`, Branch `fleet/260830063131-c091`, Basis `088d3a8`.
- Exakter Occupant: `openedAt=1788071492008`,
  `sessionId=6a6249e4-c2c8-430d-9ae8-05e5ad096e5a`.
- Write set: `composer.ts`, `server.ts`, `src/client.ts`, `e2e/watch.ts`, `e2e-isolated.sh`,
  `docs/self-api.md`. `AGENTS.md` wurde nach Owner-Korrektur wieder vollständig zurückgesetzt;
  dort keine Regel aus diesem Task landen.
- Vertrag: persistierte Events eines verschwundenen Subjects werden ausdrücklich `subject-gone`;
  reine Owner-draft-Holds erhöhen `attempts` nicht; Enter erst nach Beweis des vollständigen
  Payloads; `send-uncertain` bleibt nicht wiederholbar und quittierbar; Reverse-State, Client,
  Supervisor, Budget, Pruning und Tests müssen mitgezogen werden.
- Der erste RED-Lauf maß wegen einer fehlerhaften Fixture nichts und zählt nicht. Der reparierte
  Basis-RED-Lauf #2 läuft als eigener Wrapper PID `31419`; Log:
  `/private/tmp/claude-501/-Users-owner-claude-fleet-worktrees-fleet-260830063131-c091/6a6249e4-c2c8-430d-9ae8-05e5ad096e5a/scratchpad/red2.log`.
  Beim Handoff hielt er seit rund 7 Minuten den Suite-Lock und hatte das Watch-Modul noch nicht
  erreicht. Nicht nach Namen töten; höchstens diesen notierten PID.
- Aktuell sind nur Probe/Docs/Composer-Dateien im Baum; die Produktionsänderungen liegen während
  des Basis-RED als Scratch-Patch. Vor Landung verlangen: erwartetes Rot der neuen Checks auf der
  Basis (kein Fixture-Fehler), anschließend finaler voller Gate-Tail `ALL PASS`, isolierter Tail
  `ALL PASS`, sauberer Commit und HEAD-Abgleich mit dem Report.

Nach Slot-2-Erfolg: exakt den gemeldeten Commit serverseitig landen, den Second-host-Post-Land-Audit
bis zum terminalen Urteil beobachten und erst danach deployen. Vor diesem Deploy in der lokalen
`.env` ausschließlich `FLEET_MIGRATE_PCT=55` ergänzen (Host-Konfiguration, nicht committen), damit
MAINs vor der projektweiten ~60%-Grenze eine semantische Succession anstoßen. Vor Aktivierung die
Kontexte der MAINs erneut messen. Danach den alten persistierten Event
`77d3aadb2df16f6246d790e6` prüfen: aktuell `pending`, Receiver ist dieser Slot-16-Occupant, Subject
ist der alte Slot-2-Branch `fleet/260830005056-09e6`, `attempts=164`. Erwartung nach Fix/Teardown:
terminal `subject-gone`, attempts unverändert, kein Teiltext und kein automatisches Enter im neuen
Owner-Composer.

## 3. Danach, ohne destruktive Datenkosmetik

Das Board hält exakt 200 Tasks: 128 pending, 1 queued, 1 sent, 66 done, 4 archived. Unter pending
sind 93 Aufträge, 34 Notizen, 1 Richtung. Es gibt 64 Programme: 26 active, 26 complete, 12 proposed.
Die Quelle rendert in der Statusansicht alle Programme und Taskgruppen ohne Collapse; die 200er
Retention verdrängt nur alte terminale Zeilen. Nächster Slice: kompakte/collapsible operative Sicht,
sichtbarer Retention-Hinweis und eigene Gruppe für stale/unbound Recovery. Keine Tasks oder Programme
automatisch löschen oder als complete markieren. Eine Pixel-/Scroll-Prüfung war nicht möglich, weil
kein In-App-Browser verbunden ist; Source/API-Diagnose ist belegt, visuelle UX bleibt `unknown`.

Rollen-Audit: die globalen Codex-Rollenbriefe wurden zuletzt am 24.08., Claude-Rollen am 07.08. oder
früher geändert. Standard-Lane-, Standard-Program-MAIN-, Supervisor- und Controller-Pflichten blieben
inhaltlich gleich; die Änderungen vom 29./30.08. betreffen den GameMaker-Workflow und Runtime-
Mechaniken (Binding/Succession/Reports), nicht die Standardrollen.

## 4. Schutzgeländer für die Fortsetzung

Im MAIN-Checkout liegen 28 vorbestehende ungetrackte Owner-Dateien: nicht anfassen oder löschen.
Dieser Handoff-Commit bewegt `main` um einen Docs-Commit; Slot 2 ist danach einen Commit behind und
muss den konfliktfreien Merge-Forward vor seinem finalen Beweis durchführen. Zuerst RED2 weiter
beobachten, dann P0 beweisen/landen/auditieren/deployen; erst danach Board und Ledger-Proof-Surface.

# HANDOFF — Session „🤗 hf-schwarm II" (Slot 5), Abschluss 2026-08-29

Zustand wird ABGELEITET: `./state.sh` · `./register.sh` · Live-Queue. Vorgängerin: `800f08b`
(hugFaceInci). Diese Session hat deren §1 abgearbeitet — Aufträge 0 und 1 sind gelandet, Auftrag 2
ist owner-seitig und der einzige offene Punkt.

## 1. WAS DU ALS ERSTES WISSEN MUSST: die Vorgänger-Adjudikation stand auf einer falschen Prämisse

Die Notiz `40f62f7` schreibt, `mainSha` sei „die BEHAUPTUNG des Servers, nicht die Messung des
Helfers", und schließt daraus auf `unknowable`. **Der erste Halbsatz gilt für die falsche Hälfte der
Frage.** `server.ts#buildHelperBundle` liest den SHA aus dem **Header der geschriebenen
Bundle-Datei** zurück; `helperClaim` schreibt genau den als `mainSha`. Ein zwischenzeitlich
gewandertes main hätte einen ANDEREN `mainSha` erzeugt, keinen verdeckten.

Drei unabhängige Messungen, alle in `docs/messungen/2026-08-29-bundle-provenienz-second-host.md`:
Herkunft aus dem Bundle-Header · `0cd5e23`/`972dd48` sind **Nachfahren** von `748ec97` · ihre
**Committer**-Zeit ist 12:36:07, der Bericht kam 12:32:48 — sie landeten **3m19s nach** dem Audit.
Die Vorgängernotiz datierte `972dd48` auf 12:24; das ist die AUTOREN-Zeit, und der Unterschied ist
hier der ganze Punkt.

**Die Parallel-Session-Hypothese ist damit widerlegt, nicht bloß unbewiesen.** Was wirklich keinen
Sensor hatte, war EIN Glied: übergebenes Bundle → tatsächlich ausgechecktes Verzeichnis. Genau das
schließt Auftrag 0.

**Ich habe NICHT neu adjudiziert, mit Absicht.** Die Ursache des leeren `successorToken` auf Linux
ist weiterhin geschlossen statt gemessen. `unknowable` durch `stale-test` zu ersetzen, weil eine
Prämisse fiel, wäre derselbe Fehler gespiegelt. Das Urteil gehört **hinter** Auftrag 2.

## 2. Gelandet in `b3f4230` (DIREKT-COMMIT — für jedes land-seitige Ledger unsichtbar)

Kein `git notes --ref=fleet/land`, keine Zeile in `lane-outcomes.jsonl`, **kein Post-Land-Audit**.
Die Verifikation lief deshalb von Hand und VOLL:

| Kette | Ergebnis |
|---|---|
| Land-Gate-Kette (`watchdog.sh:91`) | exit 0, ALL PASS |
| `./e2e-isolated.sh` | ALL PASS, 3273 Checks, 0 FAIL |
| `./e2e-postland-audit.sh` | ALL PASS, 0 FAIL |

Deploy `aa7ee409`: `ok:true`, `hitTarget:true`, `bundleStale.stale:false`, `codeBehind:false`.

**Auftrag 0:** der Daemon misst nach dem Klon `git rev-parse HEAD` im Klon und schickt `clonedSha`;
der Server validiert (40 Hex oder NICHTS) und legt ihn unter `remote.clonedSha` **neben** `mainSha`.
Gemessen-oder-abwesend — ein fehlgeschlagenes rev-parse sendet kein Feld. Eine Divergenz wird in
audit()- und Alarmzeile geschrien, **ändert aber kein Verdikt**.

**Auftrag 1:** `successorToken … ?? ""` ist raus, ersetzt durch eine benannte precondition, die als
sie selbst fällt und die **Länge** des Tokens berichtet, nie den Token.

## 3. DIE LEHRE DIESER SESSION — ein grünes `ALL PASS` deckte nur die Hälfte

`./e2e-isolated.sh` lief ALL PASS über 3273 Checks und hat von meinen vier neuen Sonden **nur zwei
geladen**. `(K)` und `(HD)` liegen in `fleet-e2e-postland-audit.ts` — dem Wrapper, den **kein Gate
fährt**. Wer auf das grüne Wort geschaut hätte, hätte Auftrag 0 auf einer Suite für verifiziert
erklärt, die seine Pins nie geladen hat. Prüfung ist billig: `grep -c '^PASS  (HD)'` auf den Log.

Die entscheidenden Zeilen, weil sie die Mac/Linux-Asymmetrie sichtbar machen:
- `(HD) … cloned=1636b14a == mainSha == handedOver` — ECHTER Daemon, ECHTES Bundle, sein eigenes
  rev-parse. Die einzige Stelle im Baum, die Auftrag 0 tragen kann.
- `Program-MAIN succession precondition … slot=7 row=present token=32 chars` — auf **diesem Mac** ist
  der Token da. Auf dem Second-host war er es nicht.

## 4. DER OFFENE PUNKT: Auftrag 2, und er ist owner-seitig

Den Audit auf demselben Tip auf dem Second-host wiederholen. **Von hier aus nicht machbar**, aus drei
gemessenen Gründen:
- `helper-daemon/README.md` hält als promovierte Invariante fest: *„no ssh runner, no push — the
  Fleet never opens a connection towards the helper machine."* Alles ist ein PULL des Daemons.
- `ssh second-host` scheitert an der Host-Key-Prüfung; `known_hosts` ist geteilte Realität außerhalb
  dieses Repos — angefasst habe ich es nicht.
- **Ein Direkt-Commit stellt KEIN Audit in die Queue** (Tier-2 hängt an `landLane`). Es gibt keine
  Route, die einen Audit von Hand einreiht — `/api/post-land-audits` ist GET + adjudicate.

**Zwei Wege, deine Wahl:** (a) den Daemon auf dem Second-host aus `b3f4230` aktualisieren, dann trägt
der nächste dort geclaimte Audit `remote.clonedSha`; (b) mir Zugang geben für eine wörtliche
Wiederholung auf `748ec97`. Bis dahin trägt der Second-host das Feld NICHT — die Server-Hälfte steht,
die Geräte-Hälfte nicht.

## 5. Zwei Enden aus dem Vorgänger-Handoff §2: BEIDE LEBEN — nicht neu bauen

- **A (Context-Pack):** `fleet/260827123336-6f18`, 1 Commit über main, `.fleet/context-packs.json` +
  `e2e/context-packs.ts`.
- **D1 (Stuck-Sensor):** `fleet/260827083510-80fe`, 1 Commit über main, `lane-signals.ts`,
  `server.ts`, `e2e/lanes-lifecycle.ts`.

Beide stehen in `lane-outcomes.jsonl` als `killed-dirty`; die Worktrees liegen noch auf Platte.

## 6. Korrektur am Fehlerbericht der Vorgängerin + neue Queue-Zeile `ae8715dc`

`POST /api/self/succeed` scheitert reproduzierbar mit `composer still holds 98 chars after 3000ms`.
**Der Mechanismus im Vorgänger-Handoff stimmt nicht:** `succeedSupervisor` RUFT
`waitForFoundingReadiness`, und für eine claude-Nachfolgerin ist dieser Wait per Konstruktion ein
No-op — nur `PI_OX_HARNESS` und `CODEX_HARNESS` deklarieren ein `readiness`. Der Dispatch-Pfad hätte
dort **genauso wenig** gewartet.

Der tragende Befund ist der andere: **98 Zeichen, invariant über zwei verschieden lange `carry`** —
was nicht mit dem Brief skaliert, ist nicht der Brief. Nächster Schritt ist `awaitComposer` /
`after.length`, nicht der Readiness-Pfad. Verdacht (INFERIERT): dieselbe fehlende Succession erklärt
den leeren `successorToken` im roten Second-host-Audit.

## 7. Nicht gefixt, benannt

- Der Kommentar an `server.ts#paneReadiness` sagt „every adapter but codex" und ist seit
  `PI_OX_HARNESS` stale — **zwei** Adapter deklarieren `readiness`.
- Punkt 3 der Vorgängernotiz (füllt sich `checks.ran` aus dem gedeckelten Tail?) ist unangetastet.
- Ein Sweep über weitere `?? ""`-Credentials in Fixtures steht weiterhin aus.
- `docs/messungen/2026-08-29-main-lane-lifecycle-gaps.md` tauchte während dieser Session untracked
  auf und ist **nicht meins** — eine parallele Session arbeitet. Nicht angefasst, nicht committet.
