---
frage: Wo schlagen die Fix-Commits ein, die gelandete Code-Zeilen binnen drei Tagen umschreiben?
urteil: 85/336 stimmt; im gelieferten 14-Tage-Snapshot sind es 29/121 statt 31/120. Die Pruefapparatur ist mit 57 von 79 zugeordneten Fix-Commits der groesste Schwerpunkt.
bereich: [land-qualitaet, rework, verify, e2e, karten]
belege: [land-quality.ts, docs/verify-tiering.md, e2e/pins.ts, e2e/watch.ts, e2e/ctl.ts, e2e/land-durability.ts]
nicht-gemessen: Keine historische Testausfuehrung oder vollstaendige Check-Abdeckung; keine kausale Defektquote, keine Modellursache und keine Kostenmessung.
stand: 2026-09-15
---

# Fix3d-Anatomie: zuerst die Pruefapparatur

## 1. Nachrechnung und Nenner

Die Messabstraktion soll bestehen: Zeilenherkunft trennt ueberlappende Lands besser als gemeinsame Dateinamen; sie misst jedoch **Umschreibung, nicht Defektschuld**. Untersucht wurden die Definition, alle Snapshot-Zeilen, die Git-Zeilenherkunft und die zugeordneten Hunks der 40 juengsten Fixes; keine alte Suite wurde erneut ausgefuehrt.

Quell- und Beobachtungsstand: `ee33a2b13a7ffc1a3980dfbeb4aaf9746d42c0ff`, Commitzeit **2026-09-15 10:13:14 UTC**. Eingabe: bereitgestellte `land-quality-2026-09-15.jsonl`, 575 Zeilen, SHA-256 `e7d5434d011c36d5cb157898c29ed2ef7fbbe33963c98cc437107b02c65b8d29`. Der private Ablageort wird hier nicht veroeffentlicht; `$INPUT` bezeichnet diese Datei.

| Schnitt | Lands | codeLand=true | fix3d bekannt | true | null bei Code-Lands | Rate |
|---|---:|---:|---:|---:|---:|---:|
| Gesamt | 575 | 420 | 336 | 85 | 84 | 85/336 = 25,30 %, gerundet 25 % |
| landedAt ab 2026-09-01 10:13:14 UTC | 273 | 205 | 121 | 29 | 84 | 29/121 = 23,97 %, gerundet 24 % |

**85/336 bestaetigt; 31/120 nicht bestaetigt.** Die vorgegebene juengere Kopfzahl hat zwei Treffer mehr und einen bekannten Code-Land weniger als diese Eingabe. Das ist weder Rundung noch der Ausschluss von `null`: Der Original-Summary-Pfad liefert ebenfalls `fix 29/121 24%`. Auch erneute Git-Zuordnung nur der 14-Tage-Lands ergibt 29 betroffene geschlossene Lands. Die genaue Herkunft von 31/120 bleibt **unknown** (anderer Daten-/Beobachtungsstand oder anderer Schnitt nicht belegt); daraus darf kein Anstieg 25 → 26 % behauptet werden. Auch die behauptete juengere Audit-Rate ist nicht diese Eingabe: der Summary-Pfad liefert `red 60/259 23%`.

Definitionen am gelesenen Stand: `land-quality.ts:49` behandelt `docs/` und jede `.md` als Dokument, alle anderen Pfade als Code — auch Kommentare in `.ts`. `land-quality.ts:74` nimmt nur Code-Lands mit bekanntem Fix-Feld in den Nenner. `land-quality.ts:287` liest alle erreichbaren Nicht-Merge-Commits, nicht nur die First-parent-Linie. `land-quality.ts:300` blamed die alte Hunk-Seite auf dem **Parent des Fixes**, ordnet deren Ursprungs-SHA dem Land-Intervall `base..mainAfter` zu und setzt bei `subject.startsWith("fix")`, Code-Pfad und ≤3 Tagen das Flag (`land-quality.ts:305`). Das Drei-Tage-Fenster wird erst nach vollstaendigem Ablauf bekannt (`land-quality.ts:340`). `rework3d` umfasst dagegen jedes Commitpraefix und auch Dokumente. Der Kandidatenfilter toleriert bis zu eine Stunde vor Land (`land-quality.ts:294`); unter den hier zugeordneten geschlossenen Treffern gibt es **keinen negativen Zeitabstand**.

```sh
# INPUT auf den bereitgestellten Snapshot setzen; aus dem Repo ausfuehren.
shasum -a 256 "$INPUT"
bun land-quality.ts --summary --out "$INPUT"
bun land-quality.ts --summary --out "$INPUT" --since 14d
INPUT="$INPUT" python3 - <<'PYCOUNT'
import os, json
rows = [json.loads(s) for s in open(os.environ['INPUT'])]
for name, rs in [('all', rows), ('14d', [r for r in rows
        if r['landedAt'] >= r['asOfAt'] - 14*86400000])]:
    code = [r for r in rs if r['codeLand'] is True]
    known = [r for r in code if r['reworkByFixSubject'] is not None]
    print(name, len(rs), len(code), len(known),
          sum(r['reworkByFixSubject'] is True for r in known))
PYCOUNT
```

## 2. Zuordnung der Fix-Commits

**79 eindeutige Fix-Commits → 85 geschlossene Code-Lands**, 152 verschiedene Land/Fix/Datei-Kanten, null fehlgeschlagene Blames; die Menge der getroffenen Branches ist exakt die Menge der 85 `true`-Zeilen. Ein Fix kann mehrere Lands treffen und ein Land mehrere Fixes. Die Tabelle zeigt die **40 juengsten dieser 79**, absteigend nach Committerzeit, bei Gleichstand SHA; die noch offenen Lands werden nicht in diese Rangliste gemischt. Im gesamten Suchlauf wurden bereits elf offene Lands getroffen, deren Snapshot-Flag weiterhin `null` ist.

**Dateien sind nur die durch Blame zugeordneten Pfade**, nicht die gesamte Dateiliste des Fix-Commits. Der Fix kann seinen eigentlichen Produktfehler anderswo beheben und hier nur einen Import, Kommentar oder Test erweitern. Das ist insbesondere bei Nr. 9, 15, 23, 33, 34, 38 und 40 sichtbar. `sha^:pfad:zeile` bezeichnet die gelesene alte Seite und ist mit `git show SHA^:PFAD` auffindbar. Server-Bereiche werden an der gelesenen alten Quelle benannt; Imports und Boot-Loader sind ausdruecklich keine erfundenen Funktionssymbole.

Auditnotation je Branch: `true/…`, `false/…`, `null/…` = **auditRed/auditVerdict aus dem Snapshot**. `null` bleibt unbekannt. Ein rotes Audit ist kein Schuldbeweis fuer diesen Fix; `land-quality.ts:343` zaehlt jedes gemessene Rot ausser adjudiziertem `flake`, also auch `stale-test`. Von den 85 betroffenen Lands: **16 true, 68 false, 1 null**.

Checkurteil: **ja** = eine bereits vorhandene Assertion konnte das konkrete Symptom erkennen (eventuell erst im Audit oder unter dem problematischen Ablauf); kein Beweis, dass sie beim Land lief. **nein** = der hier zugeordnete Nachzug hat keinen Laufzeit-/Typfehler, den die betrachteten Checks erkennen sollten. **unklar** = historische Abdeckung nicht belegt oder keine kausale Verbindung zwischen Hunk und Produktfehler. Ein erst im Fix hinzugefuegter Test ist kein vorher vorhandener Check.

| Nr. | Land-Branch · auditRed/auditVerdict | Fix-SHA | Betroffene Dateien, alte Zeilen · Familie/Bereich | Vorhandener Check? Beleg/Einordnung |
|---:|---|---|---|---|
| 1 | `fleet/260912091530-46b1` · false/null | `19d2d5bf` | `e2e/tasks.ts:4886` · e2e/tasks.ts | **ja** — Fixture erwartet den inzwischen entfernten Verify-Pfad; (w2/3b) wuerde rot. Integrations-/Sondendefekt. |
| 2 | `fleet/260908161921-2955` · false/null | `326eaba8` | `server.ts:12082` · server.ts#tickInboxNudge | **unklar** — RULE_SIGIL bekommt erst hier die Inline-Tick-Flaeche; keine historische Gegenprobe fuer andere Checks. |
| 3 | `fleet/260911153147-0283` · false/null | `c37f7e8f` | `e2e/pins.ts:272` · e2e/pins.ts | **unklar** — Leak-Filter schliesst IPv6 irrtuemlich aus; kein alter IPv6-Gegentest belegt. |
| 4 | `fleet/260908161921-2955` · false/null | `5eaf0955` | `server.ts:12012` · server.ts#tickInboxNudge | **unklar** — Rollback und Journal werden fuer den Inbox-Sender ergaenzt; alte End-to-end-Abdeckung nicht bewiesen. |
| 5 | `fleet/260909171314-ad9c` · false/null | `7d21a841` | `e2e/watch.ts:2883` · e2e/watch.ts | **unklar** — S3d erweitert Watch-Deduplizierung und die bestehende Budget-Sonde; geplanter Schnitt nicht aus dem Diff beweisbar. |
| 6 | `fleet/260907235032-17ed` · false/null | `052d3d77` | `server.ts:4131` · server.ts#applyLandToNotes | **unklar** — applyLandToNotes schliesst bisher die Quelle statt der Verwendung; Nachweis ueber neue Semantiktests erforderlich. |
| 7 | `fleet/260906155403-e2e2` · false/null | `d875bde1` | `server.ts:82` · server.ts#Imports/Typen, Boot-Loader | **unklar** — Loader verliert die Inbox-Verlustmarke beim Neustart; Import/Boot-Umschreibung allein belegt keine alte Abdeckung. |
| 8 | `fleet/260907150307-8d83` · true/null<br>`fleet/260908060716-67dd` · false/null | `73195c20` | `e2e/ctl.ts:33` · e2e/ctl.ts | **ja** — Alter ctl-Setup-Check erkennt fehlendes Skript; neue Fassung macht Ursache und nicht erreichte Checks sichtbar. |
| 9 | `fleet/260906182840-8b73` · false/null | `be2dbeb6` | `e2e/helper-portal.ts:22` · e2e/helper-portal.ts | **unklar** — Zugeordnet ist nur ein fs-Import; die neue K7d-Warteprobe belegt keine Schuld dieses alten Lands. |
| 10 | `fleet/260907150307-8d83` · true/null | `d832a679` | `e2e/ctl.ts:11` · e2e/ctl.ts | **ja** — Vorhandener ctl-Setup-Check verlangt erreichbares Skript; Archiv ohne Git-Kontext verletzt genau diese Voraussetzung. |
| 11 | `fleet/260907150306-c549` · false/null | `f8259fa3` | `e2e/pins.ts:6687` · e2e/pins.ts | **ja** — Alter Rollen-Pin erwartet non-server; neuer Server-Import widerspricht seiner exakten Erwartung. Sondennachzug. |
| 12 | `fleet/260905114820-f746` · false/flake | `064b455a` | `e2e/pins.ts:2062` · e2e/pins.ts<br>`server.ts:8995` · server.ts#programDispatchCap, tickDispatch | **unklar** — Alter Pin verlangt gerade den bisherigen Env-Deckel; er prueft den neuen Repo-Fallback nicht. |
| 13 | `fleet/260904190610-05a1` · false/null | `c7184f85` | `server.ts:13921` · server.ts#runPostLandAudit | **unklar** — Audit trennt Warte- und Arbeitsuhr erst hier; alter Nachweis dieser Unterscheidung fehlt. |
| 14 | `fleet/260905074006-5353` · true/null | `19ddef50` | `server.ts:20406` · server.ts#handleOwnerProgramRoute | **unklar** — Program-Antwort bekommt supervisorHealth; bestehende Checks gegen tote Bindung nicht nachgewiesen. |
| 15 | `fleet/260904190426-2f46` · false/flake<br>`fleet/260906222646-5fb3` · false/null | `2dfaa814` | `e2e/programs.ts:8100` · e2e/programs.ts | **unklar** — Zugeordnet sind Typ/Cleanup einer erweiterten Self-Land-Sonde; keine alte Gegenprobe zum Nichtmessungs-Retry. |
| 16 | `fleet/260904190426-2f46` · false/flake<br>`fleet/260906222646-5fb3` · false/null | `94dd5e4e` | `e2e/pins.ts:669` · e2e/pins.ts<br>`server.ts:17219` · server.ts#holdSuiteLock, mergeJob | **unklar** — M5 repariert Reaping und proportionalen Hold; neue Land-Arme pruefen die zuvor fehlenden Faelle. |
| 17 | `fleet/260906222646-5fb3` · false/null | `b8b5e488` | `e2e-clean-review.sh:142` · Skripte<br>`e2e-isolated.sh:818` · Skripte<br>`e2e-postland-audit.sh:155` · Skripte<br>`e2e/pins.ts:647` · e2e/pins.ts | **ja** — clean-review wartet bereits auf den Merge; falsch vererbte Halter-PID blockiert ihn im verschachtelten Gate. |
| 18 | `fleet/260904053339-c44a` · false/null | `2a06185f` | `e2e/watch.ts:3184` · e2e/watch.ts | **ja** — D2-Vorbedingung behauptet Zahlen vor ihrem gemeinsamen Zustand; vorhandene Assertion kann rot werden. |
| 19 | `fleet/260906021638-42a9` · true/unknowable | `c8104a2b` | `e2e/land-durability.ts:441` · e2e/land-durability.ts | **ja** — Bestehendes setup F verlangt fleet-sync.sh; fehlender Quellbaum im Audit macht genau diese Sonde rot. |
| 20 | `fleet/260903153159-4f7c` · false/flake | `25c08fcb` | `server.ts:23390` · server.ts#Bun.serve/Routing | **unklar** — Bun.serve-Routing ergaenzt dispatch; alte Probe fuer die Erreichbarkeit dieser Tuer nicht belegt. |
| 21 | `fleet/260903153159-4f7c` · false/flake | `7a68c9f9` | `e2e/security.ts:248` · e2e/security.ts | **ja** — Vorhandener Pre-auth-Allowlist-Abgleich erkennt die neue, noch nicht nachgetragene dispatch-Alternative. |
| 22 | `fleet/260904193045-bd1b` · false/flake | `93e54601` | `fleet-e2e-postland-audit.ts:1187` · Audit-Pruefapparatur | **unklar** — Proportionale Fixture pruefte zwei Konstanten; Git-Kontext wird erst mit drittem Pin gemessen. |
| 23 | `fleet/260904194724-5140` · false/flake | `c36c1e94` | `e2e-isolated.sh:802` · Skripte | **unklar** — Zugeordnet ist die Wrapper-Env-Zeile fuer einen neuen Latch; Produktursache liegt im Watch-Tick. |
| 24 | `fleet/260904190426-2f46` · false/flake<br>`fleet/260904194724-5140` · false/flake | `d37f8355` | `e2e/pins.ts:627` · e2e/pins.ts<br>`server.ts:11463` · server.ts#runVerify | **unklar** — runVerify erbt bisher Env; alte Pins sichern den Hold, nicht die fehlende Bereinigung. |
| 25 | `fleet/260902051644-adb8` · false/null<br>`fleet/260903192830-8293` · false/null | `eb07267e` | `e2e/repo-worker-audit.ts:16` · e2e/repo-worker-audit.ts<br>`server.ts:10305` · server.ts#auditPingMessage, runPostLandAudit | **unklar** — Lokale Fail-Namen werden ergaenzt; alte Test-Typen pruefen dieses bisher fehlende Feld nicht. |
| 26 | `fleet/260904053339-c44a` · false/null<br>`fleet/260904163343-a5bc` · false/flake | `c8c016a6` | `e2e-isolated.sh:792` · Skripte<br>`e2e/watch.ts:26` · e2e/watch.ts | **unklar** — Explizites Autoclose=0 und srvEnv-Probe kommen neu hinzu; alte Off-Annahme war nicht gemessen. |
| 27 | `fleet/260902220341-6f16` · false/flake | `509d5da5` | `e2e/pins.ts:3611` · e2e/pins.ts<br>`e2e/programs.ts:82` · e2e/programs.ts<br>`server.ts:11401` · server.ts#MergeLast, withValidErrorReason | **unklar** — Legacy-Backfill aendert absichtlich die bisherige Abwesenheitsregel; vorhandener Pin schreibt alte Regel fest. |
| 28 | `fleet/260901143551-6592` · null/null<br>`fleet/260902051644-adb8` · false/null<br>`fleet/260902051742-41fb` · true/unknowable | `52673b64` | `e2e/helper-daemon.ts:32` · e2e/helper-daemon.ts<br>`e2e/repo-worker-audit.ts:201` · e2e/repo-worker-audit.ts<br>`server.ts:12635` · server.ts#postLandAuditChecks, runPostLandAudit<br>`server/types.ts:647` · weitere Module | **unklar** — Remote-Tail wurde als Gesamtzahl gelesen; bisherige Assertions bestaetigen sogar die zu kleine Zahl. |
| 29 | `fleet/260903221332-34c1` · true/stale-test<br>`fleet/260904012640-002d` · true/real | `6c1e6722` | `e2e/programs.ts:1599` · e2e/programs.ts | **ja** — Bestehender report-join sucht eine schon geloeschte Fixture-Zeile; daneben falscher Slot-only-Bindungscheck. |
| 30 | `fleet/260902033037-5144` · true/unknowable | `4846d831` | `server.ts:22252` · server.ts#Bun.serve/Routing | **nein** — Nur Kommentarzeiger nach Modul-Move; kein Laufzeit-/Typdefekt. Committext belegt bewusst getrennten Nachzug. |
| 31 | `fleet/260831145701-afa6` · false/null<br>`fleet/260901084323-ce15` · true/unknowable | `01ccfb30` | `e2e/pins.ts:617` · e2e/pins.ts<br>`server.ts:15322` · server.ts#processBirthFingerprint | **unklar** — Locale-Fessel fehlt im Server-Leser; bisheriger Pin nimmt diesen Leser ausdruecklich aus. |
| 32 | `fleet/260831075020-f651` · false/null | `4b14096f` | `e2e/pins.ts:3223` · e2e/pins.ts<br>`server.ts:7542` · server.ts#markFleetEventReceiverGone, recoverFleetReportDelivery, tickWatches | **unklar** — Recovery wird begrenzt; alte Assertion prueft Wiederholbarkeit, nicht Erschoepfung. |
| 33 | `fleet/260831221221-6e09` · false/flake | `ec5b6bed` | `e2e/tasks.ts:2870` · e2e/tasks.ts | **unklar** — Zugeordnet ist nur Erweiterung der tracked-Fixture; keine kausale Produktdefekt-Zuordnung. |
| 34 | `fleet/260830005056-09e6` · false/null | `c83969df` | `e2e/tasks.ts:1575` · e2e/tasks.ts | **unklar** — Zugeordnet ist nur ein Kommentar zum zusaetzlichen Blockscreen; Rest des Fixes betrifft neue Erkennung. |
| 35 | `fleet/260831145701-afa6` · false/null<br>`game-maker/hardening` · true/unknowable | `86e704ab` | `e2e-stage.sh:78` · Skripte<br>`e2e/pins.ts:458` · e2e/pins.ts<br>`e2e/verify-queue.ts:78` · e2e/verify-queue.ts | **unklar** — Gemischte Haertung: Locale und modularer Quellraum; kein einheitlicher alter Check fuer alle Aenderungen. |
| 36 | `fleet/260830063131-c091` · false/flake | `24d0e497` | `e2e/watch.ts:843` · e2e/watch.ts | **ja** — Vorhandene Watch-Assertions lesen noch nicht gesettelte Events; Fix wartet vor derselben Zustandsbehauptung. |
| 37 | `fleet/260830063131-c091` · false/flake | `9c76df47` | `e2e/watch.ts:694` · e2e/watch.ts | **ja** — Vorhandene pending/attempts-Assertions koennen falsche Fixture-Voraussetzungen rot melden; neue Proben trennen Ursache. |
| 38 | `fleet/260829221817-82a7` · false/null | `283cd0c1` | `e2e/watch.ts:2019` · e2e/watch.ts | **unklar** — Nur Checkname ist dem Land zugerechnet; neue Recovery-Faelle sind damit kein bewiesener Altdefekt. |
| 39 | `fleet/260829221817-82a7` · false/null<br>`game-maker/hardening` · true/unknowable | `5262ed08` | `server.ts:6375` · server.ts#sendText, ownerInboxDebts, slotDeliveryBudget; Boot-Reconciliation | **unklar** — sendText wartete nur auf nichtleeren Composer; Teilpaste/terminaler Subject-Zustand brauchen gezielte Gegenproben. |
| 40 | `game-maker/hardening` · true/unknowable | `2a05610a` | `e2e/programs.ts:7` · e2e/programs.ts | **unklar** — Zugeordnet ist nur der plantScreen-Import; fehlendes Runtime-Programm der alten Fixture ist aus dieser Kante allein nicht bewiesen. |

### Zaehlung aller 79 nach Familie

Jede Zahl zaehlt eindeutige Fix-SHAs **innerhalb** der Familie; Mehrfachzuordnungen sind gewollt, die Spalte summiert sich deshalb nicht auf 79. Die Pruefapparatur (`e2e/` plus `fleet-e2e*.ts`) umfasst insgesamt 57 Fixes / 63 betroffene Lands; `server.ts` 36 / 37, Shell-Skripte 9 / 11, `src/client.ts` 5 / 5, sonstige Module 10 / 10. Dokumentpfade: **0 per Definition des Fix-Code-Filters**, keine Aussage ueber Dokument-Nacharbeit.

| Familie / Pfad | Fix-Commits |
|---|---:|
| `server.ts` | 36 |
| `e2e/pins.ts` | 14 |
| `e2e/tasks.ts` | 9 |
| `e2e/watch.ts` | 9 |
| `e2e/programs.ts` | 7 |
| `e2e-isolated.sh` | 5 |
| `src/client.ts` | 5 |
| `e2e/security.ts` | 3 |
| `e2e/ctl.ts` | 2 |
| `e2e/helper-daemon.ts` | 2 |
| `e2e/land-durability.ts` | 2 |
| `e2e/merge.ts` | 2 |
| `e2e/repo-worker-audit.ts` | 2 |
| `e2e/verify-queue.ts` | 2 |
| `fleet-e2e-harness.ts` | 2 |
| `merge-prompt.ts` | 2 |
| `analysis-prompt.ts` | 1 |
| `capability-map.ts` | 1 |
| `composer.ts` | 1 |
| `context-plan.ts` | 1 |
| `e2e-claude-gate.sh` | 1 |
| `e2e-clean-review.sh` | 1 |
| `e2e-postland-audit.sh` | 1 |
| `e2e-stage.sh` | 1 |
| `e2e/context-plan.ts` | 1 |
| `e2e/drops.ts` | 1 |
| `e2e/errors.ts` | 1 |
| `e2e/helper-portal.ts` | 1 |
| `e2e/land-provenance.ts` | 1 |
| `e2e/lane-helpers.ts` | 1 |
| `e2e/lanes-basic.ts` | 1 |
| `e2e/lanes-lifecycle.ts` | 1 |
| `e2e/prompts.ts` | 1 |
| `e2e/restart.ts` | 1 |
| `e2e/review.ts` | 1 |
| `e2e/self-token.ts` | 1 |
| `e2e/steward-core.ts` | 1 |
| `e2e/supervisor.ts` | 1 |
| `fleet-e2e-postland-audit.ts` | 1 |
| `helper-daemon/daemon.ts` | 1 |
| `public/index.html` | 1 |
| `register.sh` | 1 |
| `repo-map.ts` | 1 |
| `server/types.ts` | 1 |
| `state.sh` | 1 |

### Reproduzierbare Git-Methode

Der Snapshot enthaelt **kein `base`**. Deshalb wurden zusaetzlich nur `branch`, `mainAfter`, `base` der passenden Zeilen aus dem lokalen Outcome-Ledger samt Rotation gelesen: 575 passende Records, keine fehlende Basis. Die folgende Reproduktion braucht diese Metadaten weiterhin; nach Ledger-Rotation muessen sie bereitgestellt werden. Sie liest weder Konfiguration noch Credentials. `mainAfter` allein reicht bei einem Land mit mehreren Commits nicht als Herkunftsmenge. Ein einzelnes `blame mainAfter` wuerde ausserdem spaetere Zeilennummern falsch verwenden. Die Implementierung unten verwendet denselben Parser und dieselben Zeit-/Kandidatenregeln wie die Metrik; sie schreibt ausschliesslich in ein neu erzeugtes Scratch-Verzeichnis.

```sh
# Voraussetzung: INPUT ist exportiert; Checkout/land-quality.ts entspricht ee33a2b1.
set -e
FIX3D_SCRATCH=$(mktemp -d)
export HITS="$FIX3D_SCRATCH/hits.json"
cat > "$FIX3D_SCRATCH/analyse.ts" <<'TS'
const {parseLog,isDocPath} = await import(`${process.cwd()}/land-quality.ts`);
const rows=(await Bun.file(process.env.INPUT!).text()).trim().split('\n').map(JSON.parse);
const common = Bun.spawnSync(['git','rev-parse','--path-format=absolute','--git-common-dir']).stdout.toString().trim();
const root = common.replace(/\/.git$/, '');
const bases = [];
for (const suffix of ['.1', '']) {
  const file = Bun.file(`${root}/lane-outcomes.jsonl${suffix}`);
  if (!await file.exists()) continue;
  for (const line of (await file.text()).split('\n')) {
    try {
      const r = JSON.parse(line);
      if (r && rows.some(x => x.mainAfter === r.mainAfter))
        bases.push({branch:r.branch, mainAfter:r.mainAfter, base:r.base});
    } catch {}
  }
}
const git=async(args:string[])=>{const p=Bun.spawn(['git',...args],{stdout:'pipe',stderr:'pipe'});const out=await new Response(p.stdout).text();const err=await new Response(p.stderr).text();if(await p.exited)throw Error(args.join(' ')+err);return out};
const lands=[];for(const r of rows){const base=bases.find(x=>x.branch===r.branch&&x.mainAfter===r.mainAfter)?.base;if(!base)throw Error(r.branch); const commits=new Set((await git(['rev-list',`${base}..${r.mainAfter}`])).trim().split('\n')); const files=new Set((await git(['diff','--name-only','--no-renames',base,r.mainAfter])).trim().split('\n'));lands.push({r,base,commits,files});}
const log=await git(['log',rows[0].asOf,'--no-merges','--no-renames','-p','-U0','--no-color','--format=%x1e%H %ct %s',`--since=${new Date(Math.min(...rows.map(r=>r.landedAt))-3600000).toISOString()}`]);
const groups=parseLog(log).filter(g=>g.subject.startsWith('fix')&&!isDocPath(g.path));
const owner=new Map();for(const l of lands)for(const c of l.commits)owner.set(c,l);
const hits=[];let i=0,errors=0;
await Promise.all(Array.from({length:8},async()=>{while(i<groups.length){const g=groups[i++],t=g.ct*1000;const cands=lands.filter(l=>l.files.has(g.path)&&!l.commits.has(g.sha)&&t>=l.r.landedAt-3600000&&t<=l.r.landedAt+7*86400000);if(!cands.length)continue;const boundary=cands.reduce((a,b)=>a.r.landedAt<=b.r.landedAt?a:b).base;let b;try{b=await git(['blame','--porcelain',...g.ranges.flatMap(r=>['-L',r]),`${boundary}..${g.sha}^`,'--',g.path]);}catch(e){errors++;continue;}const counts=new Map();for(const line of b.split('\n')){const m=/^([0-9a-f]{40}) (\d+) (\d+)/.exec(line);if(!m)continue;const l=owner.get(m[1]);if(!l||!cands.includes(l)||t-l.r.landedAt>3*86400000)continue;const c=counts.get(l)||[];c.push({origin:m[1],old:Number(m[3])});counts.set(l,c);}for(const [l,lines]of counts)hits.push({branch:l.r.branch,mainAfter:l.r.mainAfter,base:l.base,closed:l.r.reworkByFixSubject!==null,auditRed:l.r.auditRed,auditVerdict:l.r.auditVerdict,sha:g.sha,ct:g.ct,subject:g.subject,path:g.path,lines});}}));
hits.sort((a,b)=>b.ct-a.ct||a.sha.localeCompare(b.sha)||a.branch.localeCompare(b.branch)||a.path.localeCompare(b.path));await Bun.write(process.env.HITS!,JSON.stringify(hits,null,2));console.log(JSON.stringify({groups:groups.length,errors,hits:hits.length,closedLands:new Set(hits.filter(x=>x.closed).map(x=>x.branch)).size,closedFixes:new Set(hits.filter(x=>x.closed).map(x=>x.sha)).size,openLands:new Set(hits.filter(x=>!x.closed).map(x=>x.branch)).size}));
TS
bun "$FIX3D_SCRATCH/analyse.ts"
python3 - <<'PYCHECK'
import os, json, collections
rows = [json.loads(s) for s in open(os.environ['INPUT'])]
h = [x for x in json.load(open(os.environ['HITS'])) if x['closed']]
assert {x['branch'] for x in h} == {r['branch'] for r in rows
    if r['codeLand'] is True and r['reworkByFixSubject'] is True}
fixes = list(dict.fromkeys(x['sha'] for x in h))
print('EXACT BRANCH SET PASS', len(fixes), len(h))
for sha in fixes[:40]:
    a = [x for x in h if x['sha'] == sha]
    print(sha, sorted({x['branch'] for x in a}), sorted({x['path'] for x in a}))
for path in sorted({x['path'] for x in h}):
    print(path, len({x['sha'] for x in h if x['path'] == path}))
PYCHECK
# Detailpruefung am Beispiel; old-side-Linien stammen aus hits.json:
git log -1 --format='%h %ad %s' --date=iso 19d2d5bf
git show --format= -U3 19d2d5bf -- e2e/tasks.ts
git blame --porcelain -L 4886,+1 19d2d5bf^ -- e2e/tasks.ts
```

Das aus dieser Notiz kopierte Kommando wurde zusaetzlich vollstaendig ausgefuehrt. Ausgefuehrtes Ergebnis: `groups=620, errors=0, hits=172, closedLands=85, closedFixes=79, openLands=11`; nach Ausschluss offener Fenster `EXACT BRANCH SET PASS 79 152`. Der Suchlauf darf auch einen schon umgeschriebenen Ursprung mehrfach treffen; gezaehlt werden hier eindeutige SHAs bzw. Branches, keine Summe der Zeilen als Aufwand.

## 3. Muster und Aussagegrenzen

**Rang 1: `server.ts`, 36/79 Fixes (45,6 %).** Besonders sichtbar sind Zustellung (`tickInboxNudge`, `sendText`, Recovery), Audit und Land/Gate. Ein konkreter Defekt ist der unvollstaendige Paste bei `5262ed08^:server.ts:6372`: nichtleerer Composer wurde als ausreichend behandelt, bevor Enter gesendet wurde; der Fix wartet auf die Payload-Ankunft. Ein anderer ist die unerreichbare Dispatch-Tuer (`25c08fcb^:server.ts:23387`): Handler vorhanden, Routing-Alternative fehlt. Diese Beispiele sind Befunde an gelesenen Diffs, keine gemessene Ausfallrate.

**Rang 2: `e2e/pins.ts`, 14/79 (17,7 %).** Die Probe selbst muss semantisch richtig und ueber den richtigen Quellraum gespannt sein. `f8259fa3^:e2e/pins.ts:6682` konserviert eine Rollen-Erwartung, obwohl das Modul jetzt serverseitig importiert wird; `c37f7e8f^:e2e/pins.ts:269` verengt den Leak-Filter durch falsche IPv6-Einordnung. Mehr Assertions allein helfen nicht, wenn die Fixture den alten Zustand als Soll festschreibt.

**Rang 3 ist geteilt: `e2e/tasks.ts` und `e2e/watch.ts`, je 9/79 (11,4 %).** Ein eindeutiger dritter Sieger waere erfunden. Tasks zeigt Integrationsnachzug (`19d2d5bf^:e2e/tasks.ts:4883`, Verify-Pfad nicht mehr ableitbar); Watch zeigt ungemessene oder nicht gesettelte Voraussetzungen (`24d0e497^:e2e/watch.ts:840`, `9c76df47^:e2e/watch.ts:760`). Diese Reparaturen verbessern die Messung, nicht notwendig das Produkt. Der Familienbegriff ist hier der konkrete Dateipfad; die breitere Pruefapparatur umfasst 57/79 = **72,2 %**, mit Mehrfachzaehlung gegen Server/Skripte. Das ist ein Auftretensanteil, kein Anteil am Aufwand und keine Aussage, 72,2 % aller Defekte seien Testdefekte.

**Anteil „kein Check haette es gesehen“:** In der offengelegten 40er-Sichtung: 11 ja (27,5 %), 1 nein (2,5 %), 28 unklar (70,0 %). Damit ist **2,5 % nur der belegte Anteil in dieser Sichtung**, nicht die geschaetzte Blindquote; unter den 12 entschieden bewerteten Faellen sind es 1/12 (8,3 %), eine stark selektierte Teilmenge. Fuer alle 79 bleibt die Quote unbekannt. Das einzige Nein ist zudem ein Kommentar-Nachzug, kein entkommener Laufzeitdefekt. Keine historische Mutation oder Testausfuehrung wurde behauptet. Insbesondere bedeutet `auditRed=false` nicht „kein vorhandener Check konnte das sehen“.

**Folgearbeit versus Defekt:** Beides kommt vor. `4846d831` ist belegte, bewusst getrennte Folgearbeit: Der gelesene Committext erklaert, dass der vorausgehende Modul-Move Kommentar-Umformulierung verbot und die Reststellen meldete; der Diff aendert nur Verweis-Kommentare (`4846d831^:server.ts:22249`). Trotzdem liefert eine `.ts`-Zeile mit `fix` ein positives fix3d-Signal. `94dd5e4e` ist dagegen trotz Namen „M5“ keine bloss angenommene zweite Ausbaustufe: Sein Committext benennt zwei M1-Regressionen, der Diff ergaenzt Reaping und befreit proportionale Gates vom Hold (`94dd5e4e^:server.ts:17216`, `:18252`). Kosten: ein toter Halter blockiert weitere Lands, ohne ihren Baum zu messen. Nicht jede Slice-Nummer bedeutet geplante Folgearbeit. Fuer alle 79 wurde kein Planarchiv rekonstruiert; eine vollstaendige Defekt-/Folgearbeitsquote bleibt offen.

**Audit ist ein Hinweis, keine Kausalzuordnung.** Das gelesene Register `docs/verify-tiering.md:3947` zeigt exemplarisch die Gegenrichtung: Ein als Self-Land-Fehler sichtbares Rot war ein echter Dispatch-Tail-Defekt, dessen erste Reparatur wiederum den Kill-Requeue-Check verletzte (`docs/verify-tiering.md:3982`). Diese Registerstelle stuetzt die Vorsicht bei „Flake“, ist aber kein zusaetzlicher Treffer dieser 79er-Zaehlung. Hinzu kommen bekannte Messgrenzen: Umzuege/Kommentare/Imports zaehlen mit; Korrekturen ohne kleingeschriebenes `fix`-Praefix fehlen; offene Fenster fehlen aus dem Nenner; `landOf` ordnet einen Ursprungscommit genau einem Land zu (`land-quality.ts:280`). Die Daten erlauben keine Aussage ueber Modelle als Ursache.

## 4. Empfehlung, Verifikation und Ungeprueftes

**Naechste Investition eher gezielte Tests an der Pruefapparatur, zuerst Fixture-Voraussetzungen und Audit-Staging in `e2e/watch.ts`, `e2e/ctl.ts` und `e2e/land-durability.ts`.** Tragend sind **57/79** Fix-Commits mit dortigen bzw. anderen Pruefapparatur-Umschreibungen und die konkret belegte doppelte Archiv-Luecke bei Nr. 10/19: Die Sonde findet ein Skript im Arbeitsbaum, aber nicht im Audit-Snapshot. Der naechste kleine Schnitt sollte dieselbe Skript-Aufloesung gegen Arbeitsbaum und Archiv ohne Git-Verzeichnis samt fehlendem Skript pruefen; Watch-Fixtures sollen ihren erforderlichen Zustand vor der Behauptung nachweisen. Das ist eine Empfehlung zur Pruefung der aktuellen Abdeckung, keine Behauptung, die inzwischen reparierten Faelle seien noch offen. Im Kartenfeld **VERIFY** sollte dieser konkrete Gegenfall samt Ausfuehrungsumgebung stehen; ein pauschales „Suite gruen“ beschreibt ihn nicht. Vorrang fuer eine allgemeine Kartenreform laesst sich hieraus nicht ableiten. Ungeprueft bleiben historische Ausfuehrung/Abdeckung der meisten Checks, geplante Folgearbeit in den uebrigen Fixes, Defektursache allein kommentierter/importierter Kanten, Arbeitsaufwand, aktueller Live-Zustand und die Herkunft der abweichenden Kopfzahl 31/120. Der ausgelieferte Snapshot selbst traegt die belastbare Aussage 85/336 insgesamt und 29/121 im juengeren Fenster.

Verifikation dieser Notiz: `bun e2e/pins.ts`, Exit 0. Ausgefuehrter Tail: Die Pins pruefen Repository-Regeln; die Zahlen sind durch die separate Nachrechnung und den exakten Branch-Mengenvergleich belegt.

```text
PASS  land-log.ts#VERIFY_SKIP_EXIT is server.ts#VERIFY_SKIP_EXIT  (land-log says 42)

ALL PASS
```
