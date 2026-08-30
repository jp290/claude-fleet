# HANDOFF — Fleet wieder in einen belastbaren Betriebszustand bringen, 2026-08-30 10:38 CEST

Owner-Ziel: zuerst den gemessenen FleetEvent-/Composer-Schaden schließen und den laufenden Stand
wieder mit einem grünen Produktionsbeweis versehen; danach die operativen Schulden so ordnen, dass
Board, Audits, Helper und Succession keine stillen Zustände mehr erzeugen. Mindestgrenze für
„vernünftig laufend“: P0 exakt gelandet, neuester Post-Land-Audit grün, exakt dieser Tip deployed,
Bundle nicht stale und keine unbelegte Behauptung über eine verschwundene Event-Zeile.

## 1. Als Erstes neu messen

Führe `./state.sh` und `./register.sh` aus, lies dann `/api/sessions`, `/api/deploys` und
`/api/post-land-audits` mit dem Token aus `fleet.json`. Vor jedem Write den aktuellen Slot-Occupant
erneut belegen. Keine Pane-Injection als Ersatz für einen Fleet-Rückkanal und keinen Prozess nach
Namensmuster töten.

Stand dieser Übergabe:

- `main=75b21106feb1f66e11ca6f2b81341dadd0ea05f4`; der Server bootete Deploy `416d7fa4` auf
  `088d3a8b90de17cd42f648caf2640641edd77d77`. Die vier neueren Main-Commits sind Doku, daher
  `codeBehind:false`; `bundleStale:false`.
- Der letzte Second-host-Audit ist **rot** auf `dbb2e09460a6c65251eb6e2b802814eea7727cb2`:
  Exit 1 nach 1.261.823 ms und exakt `1 FAILURES`. Der auf 64 KB begrenzte API-Tail nennt den
  fehlgeschlagenen Check nicht. Nicht als Flake bezeichnen; dazu wäre ein grüner Same-Tree-Rerun
  nötig. Der unmittelbar ältere Audit auf `088d3a8` war grün mit `rows=3308 results=3308`.
- Second-host ist `active`, ohne Claim und ohne neue Lapse. Das lokale P0-Isolated hält derzeit den
  einzigen Suite-Lock; keine zweite Suite daneben starten.

## 2. P0 fertigstellen — Task `9912a68a`, Slot 2

Branch `fleet/260830063131-c091` steht sauber auf
`3f64ed1446f6c21585d24838626bb44947e5638b`, `ahead=1/behind=1`. Der Commit ändert sechs Dateien
mit 551 Einfügungen und 22 Löschungen. Sein Vertrag ist im Baum sichtbar: `subject-gone` ist ein
eigener Terminalzustand (`server.ts:1443`), verschwundene Subjects werden so terminalisiert
(`server.ts:7444`), und der Composer vergleicht Fleet nur gegen den vollständigen eigenen Payload
(`composer.ts:57`). `AGENTS.md` ist unverändert.

Beweislage:

- RED4 auf der Basis endete mit genau vier erwarteten Produktfehlern: Prefix wurde submitted;
  100 Holds erhöhten `attempts`; das verschwundene Subject blieb pending; die tote Lane wurde
  trotzdem zugestellt. Der Rest des Laufs lief weiter und der Tail endete `4 FAILURES`.
- Die normale Gate-Kette ist grün: clean-review, Security und Claude-Gate enden jeweils
  `ALL PASS`; die Exit-Zeilen sind `cr=0`, `sec=0`, `cg=0`.
- `./e2e-isolated.sh` läuft seit 10:24 CEST unter dem allein notierten Wrapper-PID `98814`.
  Scratch-Tail:
  `/private/tmp/claude-501/-Users-owner-claude-fleet-worktrees-fleet-260830063131-c091/6a6249e4-c2c8-430d-9ae8-05e5ad096e5a/scratchpad/green-iso.log`.
  Taskstatus ist noch `sent`; es gibt noch keinen Fleet-Report.

Reihenfolge ohne Abkürzung:

1. Auf das terminale Isolated-Ergebnis warten. Nur ein Tail `ALL PASS` akzeptieren; bei Rot zuerst
   Checkname und Signatur lesen. Eine zweite grüne Ausführung desselben Trees wäre erst dann der
   Flake-Beleg.
2. Slot 2 muss den aktuellen Docs-Commit konfliktfrei merge-forwarden, den nötigen Beweis auf dem
   neuen HEAD erhalten und danach den Fleet-Report mit den wörtlichen Tails und sauberem Tree
   senden. HEAD und Report gegeneinander prüfen; `3f64ed1` ist der P0-Commit, nicht mehr der finale
   Branch-HEAD.
3. Der Task hat kein `programId`; eine Program-MAIN-Self-Land-Tür existiert dafür nicht. Der
   **Owner** landet exakt den gemeldeten Commit über den serverseitigen Landpfad.
4. Den dadurch erzeugten Post-Land-Audit bis `green|red|unknown` beobachten. Bei `red` oder
   `unknown` nicht deployen. Der alte rote `dbb2e09`-Audit bleibt `unknown`, bis sein eigener Check
   oder ein Same-Tree-Rerun vorliegt; ein neuer grüner Tip darf ihn nicht rückwirkend zum Flake
   umetikettieren.
5. Nur nach grünem Audit darf der **Owner** exakt den neuen Main-Tip deployen. Danach
   `hitTarget:true`, `bundleStale:false`, `bootHead=head=target` und keinen laufenden Deploy prüfen.
6. Event `77d3aadb2df16f6246d790e6` ist heute weder in `/api/sessions` noch in den lokalen Ledgers
   auffindbar. Die alte Anweisung, ausgerechnet diese Zeile nach dem Deploy zu prüfen, ist damit
   nicht ausführbar. Kein Ergebnis erfinden: verwende den deterministischen Isolated-Test und bei
   Bedarf eine neu erzeugte, kontrollierte Subject-Teardown-Gegenprobe; nie einen Owner-Composer als
   Versuchsfeld.

## 3. Danach: Betriebsbeweise schließen

In dieser Reihenfolge, jeweils als eigener landbarer Slice:

1. **Helper-Provenienz.** Audit-Ledger meldet für den grünen 3308er Trail nur `checks.ran=23`, weil
   es aus dem gekürzten Tail zählt. Die vollständige Trail-Zahl und der fehlgeschlagene Check müssen
   strukturiert übernommen werden; bis dahin ist der einzelne rote Check im neuesten Audit nicht
   fernlesbar.
2. **Second-host-Daemon.** Die gelandete Helper-Implementierung kann `remote.clonedSha` melden
   (`helper-daemon/README.md:52`), der installierte Daemon tut es noch nicht. Installation/Restart
   ist ein ausdrücklicher **Owner-Akt**; dieses Repo deployt ihn nicht
   (`helper-daemon/README.md:66`). Nach Rollout muss der nächste echte Remote-Audit
   `remote.clonedSha == mainSha` belegen oder die Abwesenheit ausdrücklich benennen.
3. **Audit-Zustand.** Ziel ist nicht, historische rote Zeilen zu löschen, sondern dass der neueste
   Produktions-Tip grün und seine Provenienz vollständig ist. Second-host bleibt Pull-only.

## 4. Succession ist eine offene Richtungsentscheidung, kein `.env`-Handgriff

`FLEET_MIGRATE_PCT` und alle zugehörigen Live-Schalter fehlen aktuell; Migration ist aus
(`server.ts:11304`). Die frühere Anweisung „55 setzen“ ist nicht ausreichend begründet. Der aktuelle
Rail nudged höchstens dreimal (`server.ts:11606`) und öffnet für Program-MAIN-Succession einen
**freien anderen Slot** (`server.ts:18526`); Same-Slot-Succession ist nicht implementiert.

Gemessen vor dieser Übergabe: Slot 1 `32,9%`, Slot 5/Game-MAIN `40,4%`, Slot 11 `26,8%`, Slot 13
`29,3%`; diese Sitzung in Slot 4 lag zuletzt bei `39,6%`. Vor Aktivierung muss der Owner deshalb
entscheiden:

- cross-slot jetzt als begrenzten Canary aktivieren und Schwelle/Safe-Point benennen; oder
- Same-Slot zuerst bauen und erst danach automatisch schalten.

Keine `.env`-Änderung und keinen Server-Restart aus diesem Handoff ableiten. Host-Konfiguration,
Restart und die gewählte Schwelle sind Owner-Akte. Bis dahin Übergaben manuell und in arbeitssicheren
Momenten durchführen.

## 5. Operative Sicht und alte Arbeit

Die Ledgers halten exakt 200 Tasks: 128 pending, 1 queued, 1 sent, 66 done, 4 archived. Damit sind
130 offen: 95 Aufträge, 34 Notizen, 1 Richtung. `register.sh` markiert 17 Zeilen seit 22 Tagen als
`needs-you`. Von 64 Programmen sind 26 aktiv; nur sechs davon haben offene Tasks, 20 aktive Programme
haben keine offene Task. Das ist Sicht- und Entscheidungsbedarf, kein Beweis, dass sie abgeschlossen
sind.

Nächster Board-Slice nach P0 und Produktionsbeweis:

1. kompakte/collapsible operative Gruppen;
2. sichtbarer Hinweis auf die 200er Retention, die nur terminale Rows verdrängt
   (`server.ts:2844`);
3. eigene stale/unbound-Recovery-Gruppe;
4. die 17 `needs-you` und aktiven Programme ohne offene Task sichtbar triagierbar machen.

Keine Task automatisch löschen/archivieren und kein Programm automatisch auf complete setzen.
Task `d98fe812` ist als read-only Architekturreview queued, aber Pi/Z.ai ist nicht unattended
automatisierbar; Owner entscheidet manuelles Starten, erlaubte Neubesetzung oder Rücknahme. Die eine
offene Richtung `23eef33d` verlangt Merge-Train plus Staging-Dev-Instanz, aber ausdrücklich erst
nach Lands/Tag-Messung, Bruchstellen-Inventar und Owner-Promotion. Vor belastbarem Auditrail nicht
bauen.

Von den alten Harvest-Kandidaten ist Context-Pack A (`716f53e`) bereits in `main`; nicht neu bauen.
D1/Stuck-Sensor (`2954eff`, `fleet/260827083510-80fe`) ist noch ein Commit ahead, aber 89 Commits
behind und überschneidet sich mit P0 in `server.ts`. Nach P0 neu gegen den aktuellen Vertrag prüfen,
dann bewusst rebasen/reparieren oder als überholt stehen lassen; nicht blind landen.

## 6. Grenzen und fremde Zustände

- Slot 1 (`second-hostS4`) ist lebendig, aber ohne Task-/Programmbindung; diese Recovery wurde deshalb
  von der gebundenen Nachfolgesitzung in Slot 4 geführt. Nicht nachträglich Besitz erfinden.
- Eine offene Owner-Attention gehört Private-repo-o/Slot 5 und fragt nach einem Taste-Gate. Diese
  Fleet-Recovery beantwortet oder übernimmt sie nicht.
- Im Main-Checkout liegen 28 vorbestehende ungetrackte Owner-Dateien. Nicht anfassen, committen oder
  löschen. Unbeteiligte Dateien dürfen einen Lane-Land nicht in einen Cleanup-Auftrag verwandeln.
- Unaufgelöst beim Handoff: laufender P0-Isolated-Tail; unbekannter Check des roten `dbb2e09`-Audits;
  fehlender Second-host-Daemon-Rollout; Owner-Entscheid über Succession-Modus und Schwelle; D1-
  Adjudikation; visuelle Board-Prüfung.

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
