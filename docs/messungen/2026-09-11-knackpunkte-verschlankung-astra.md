# Claude Fleet: Knackpunkte und schlankere Schnitte

Stand: 2026-09-11; geprüfter Lane-HEAD `b41dc73b4119b8800df69ea17be8a392ad57dff3`.
Auftrag: Owner-Brief über Fable, Slot 8. Vorschläge zur Disposition durch MAIN; keine Promotion.

## Annahmen

Rollen, Zustellbelege und dauerhafte Ergebniszeilen sollen existieren: Ohne sie kann Fleet Arbeit weder verlässlich zuordnen noch ihre Erledigung unterscheiden. Kosten entstehen hier vor allem durch wiederholte Versuche ohne Zustandsfortschritt und durch fehlende Rückwege.

„geprüft“ bezeichnet gelesenen Code oder ausgeführte lesende Zählung; „aus Register übernommen“ bezeichnet offene Eingangsbefunde ohne eigene Vollprüfung; „unknown“ bezeichnet fehlende Evidenz. Ein vorhandener Reader beweist kein tatsächliches Lesen. Einsparungen der drei Züge sind Ziele mit Gegenprobe, keine gemessenen Wirkungen.

Die sechs Gruppen behalten alle Eingangspunkte. Ergänzungen sind ihrer Ursache zugeordnet: Watch-Hold-Spirale zu K1, Prompt-Journal zu K6. Andere Registerzeilen bleiben Eingangsmaterial; dies ist keine zweite Triage. Graphify lieferte einen gekürzten, älteren Symbolgraphen; alle tragenden Urteile beruhen auf heutiger Quellenlektüre.

Messfenster W: 2026-09-08 00:00 UTC bis ausschließlich 2026-09-11 08:00 UTC. Ledgerzählungen verwenden ausschließlich die aktuell erhaltene aktive Datei im Haupt-Checkout. Rotation kann spätere Wiederholungen verkleinern; die Zahlen sind beobachtete Untergrenzen, keine vollständige Betriebshistorie. Live-State-Zahlen sind ein eigener punktueller Stand, keine Ledgerereignisse.

Die historische Owner-Entscheidung zur Betriebs-MAIN wird wie im Brief vorausgesetzt; ihre genaue Rollenformulierung blieb unknown. Das bestehende Succession-Gate der Standard-MAIN und die Zustellreparaturen sind gegenüber den Vorberichten bereits weiter. Die Halbierungsziele unten beziehen sich jeweils auf die benannte Teilkostenart.

## Kosten und Reproduktion

| Gruppe | Geprüfte Kostenbasis | Grenze |
|---|---|---|
| K1 | W: 14.579 `fleet_event_held`-Zeilen mit `composer` im Detail; 4 Deploy-Ledgerzeilen | Holds sind wiederholte Blockaden, keine unterschiedlichen verlorenen Nachrichten; Deployzeilen beweisen keine vier erfolgreichen Restarts. Die 720 `inboxNudgeSend`-Fehler der Startliste sind unknown. |
| K2 | W: 35 Git-Commits berühren `HANDOFF.md`; State: 15 nichtterminale Tasks in COMPLETE Programs | Autorenzahl und behauptete 66 Direkt-Commits nicht nachgemessen; die 15 Tasks sind gefährdete Referenzen, keine bewiesenen Löschungen. |
| K3 | W: 46 `fleet_report_open`-Ereignisse; State: 84 pending Notizen | Weder Ablehnungszahl noch Leselosigkeit daraus ableitbar; Kosten des fehlenden Ablehnungsrückwegs: uncosted. |
| K4 | W: 27 Audits, davon 6 rot; Median `ms` der 18 nichtproportionalen Zeilen: 2.434.413,5 ms | Rund 40,6 Minuten inklusive etwaiger Wartezeit; keine reine CPU-Zeit. Adjudikationsstand und die 110 s Gate der Startliste: unknown. |
| K5 | W: 53 Git-Commits berühren `docs`; 9 proportionale Audits, Median 2.293 ms | Keine Kausalzuordnung der Commits zu diesen Audits; 106/124 Direkt-Commits nicht reproduziert. Die kurze Kette allein erklärt keine halbstündige Verzögerung. |
| K6 | `post-land-audits.jsonl`: 2.206.916 Bytes; State-Datei: 1.693.459 Bytes | Volle Auditdatei ist Input von `tickAuditPing`; tatsächliche I/O-/CPU-Kosten: uncosted. Save-Frequenz und Trail-Dateimenge aus Vorberichten nicht neu gemessen. |

Ein Kommando reproduziert sämtliche eigenen Zahlen der Tabelle; Ausgabe bleibt auf Zahlen und feste Labels begrenzt. Git-Zählungen fragen den benannten Untersuchungs-HEAD, damit spätere Commits das Fenster nicht rückwirkend erweitern.

```sh
python3 - <<'PY'
import json, pathlib, statistics, subprocess
p = pathlib.Path('/Users/owner/claude-fleet')
lo, hi = 1788825600000, 1789113600000
def rows(name):
    return [json.loads(x) for x in (p/name).read_text().splitlines() if x.strip()]
def window(name):
    return [r for r in rows(name) if lo <= r.get('ts', r.get('at', 0)) < hi]
a = window('audit.jsonl')
v = window('post-land-audits.jsonl')
f = [r['ms'] for r in v if r.get('proportional') is not True]
s = [r['ms'] for r in v if r.get('proportional') is True]
print('K1 holds', sum(r.get('event') == 'fleet_event_held' and
    'composer' in str(r.get('detail', '')) for r in a))
print('K1 deploy rows', len(window('deploys.jsonl')))
print('K3 reports', sum(r.get('event') == 'fleet_report_open' for r in a))
print('K4 audits/red/full/median_ms', len(v),
    sum(r.get('result') == 'red' for r in v), len(f), statistics.median(f))
print('K5 short/median_ms', len(s), statistics.median(s))
for path in ['HANDOFF.md', 'docs']:
    out = subprocess.check_output(['git', 'log',
        'b41dc73b4119b8800df69ea17be8a392ad57dff3',
        '--since=2026-09-08T00:00:00Z', '--until=2026-09-11T08:00:00Z',
        '--format=%H', '--', path], text=True)
    print('git commits', path, len(out.splitlines()))
fleet = json.loads((p/'fleet.json').read_text())
complete = {r['id'] for r in fleet['programs'] if r.get('status') == 'complete'}
print('K2 open tasks in complete programs', sum(
    r.get('status') not in ['done', 'archived'] and r.get('programId') in complete
    for r in fleet['tasks']))
print('K3 pending notes', sum(r.get('kind') == 'notiz' and
    r.get('status') == 'pending' for r in fleet['tasks']))
for name in ['post-land-audits.jsonl', 'fleet.json']:
    print('K6 bytes', name, (p/name).stat().st_size)
PY
```

## K1 — Panes: Wiederholung ohne Zustandsfortschritt

**a) Mechanismus — geprüft.** `server.ts#sendText` verweigert jeden diesen Pfad nutzenden Sender vor dem Paste bei beobachtet belegtem Composer; `tickWatches` setzt bei `SendRefused` die Zeile wieder pending, speichert erneut und schreibt bei jedem nächsten Versuch `fleet_event_held`, während `tickInboxNudge` inzwischen Rollback, Zustelljournal und Fehler-Cooldown hat. `ACCEPT_WAIT_MS` ist ein per Env übersteuerbarer, zur Bootzeit fester Wert mit Default 3000 ms; `rollbackOwnComposerPayload` vergleicht den exakten Text vor BSpace, besitzt aber keine atomare Compare-and-Set-Operation gegenüber direkter Eingabe in tmux.

Ergänzende Prüfung: `CLAUDE_HARNESS` hat Composer und Boot-Settle, keine `readiness`-Deklaration; das ist eine verbleibende Trust-Screen-Lücke, deren aktuelle Häufigkeit unknown ist. Boot-Rehydration setzt `lastOutput = Date.now()` (`server.ts:23425`), damit eine alte Pane nach Neustart zunächst als frisch aktiv gilt. `git log -5 --oneline -S'rollbackOwnPayload: true' -- server.ts` zeigt die Reparatur `5eaf0955`; eine erneute Lane „fünf Sender mit Rollback versehen“ wäre bereits erledigte Arbeit.

**b) Kosten.** K1 der Kostentabelle: die Hold-Menge misst Arbeit ohne Zustellfortschritt. Inbox-Fehler, durch Neustarts verlorene Idle-Minuten und Schäden aus dem Read→BSpace-Fenster bleiben uncosted.

**c) WEGLASSEN.** Pane-Nudges ganz streichen und nur dauerhafte Inbox-/Event-GETs behalten beseitigt ihre Composer-Kollisionen. Die ruhende MAIN hätte dann keinen Weckimpuls; ohne nachgewiesenen Pull-Reader bliebe die Erledigung liegen. Das ist für die heutige Rollenverteilung kein tragfähiger erster Schnitt.

**c) VERSCHLANKEN.** Gleiche Hold-Ursache je Event und Occupant nur beim Eintritt sowie beim Freigeben protokollieren, dazwischen zusammenzählen. Ziel: mindestens halb so viele Hold-Ledgerzeilen in einer dauerhaft blockierten Fixture; Send-Proben und State-Saves blieben zunächst gleich teuer. Dieser sehr kleine Schnitt verbessert die Beleglesbarkeit, behebt die Lastquelle nur teilweise.

**c) DYNAMISCH-KLÜGER.** Nach wiederholtem `SendRefused` die nächste Probe je Event und exaktem Empfänger-Occupant mit begrenztem Backoff verschieben; Erfolg, neue Identität oder neues Event beginnen frisch. Der beobachtete Wiederholungszustand ist das Steuersignal; `attempts` bleibt ein Zähler tatsächlicher Sendeversuche. Den Hold aggregieren und den nächsten Prüfzeitpunkt sichtbar machen. Einen an Hostlast gekoppelten Accept-Wait erst nach Messung erfolgreicher Acceptance-Latenzen verfolgen: load1 allein misst keine TUI-Bereitschaft.

**d) Empfehlung: DYNAMISCH-KLÜGER.** Schnittlinie sind `tickWatches` und `recoverFleetReportDelivery` bei belegtem Composer, einschließlich ihrer Hold-Zählung; unverändert bleiben `sendText`, Acceptance-Semantik, Inbox-Nudge, fremder Composer-Inhalt und alle Autoritätsgates. Der nächste Versuch muss begrenzt erreichbar bleiben; ein ewiges Schweigen ist kein Erfolg. Das nicht atomare Löschen und Claude-Readiness sind gesonderte Restbefunde.

## K2 — Rollen: Haltbarkeit am Program, Nachfolge am Occupant

**a) Mechanismus — geprüft.** `server.ts#handleSelfSucceed` verlangt für Standard-Program-MAIN keinen HANDOFF-Commit mehr und `captureProgramHandover` sichert ihre Pflichten, während Generic-/Supervisor-Nachfolge weiter `handoffCommittedAfterOpen` braucht und Game-Maker den Checkpoint hält. `capPrograms` behält Nicht-COMPLETE und die jüngsten COMPLETE Programs bis zum Budget, ohne die noch darauf verweisenden Tasks zu fragen; es verwirft Program-Zeilen, nicht unmittelbar die Tasks, deren `programId` danach ins Leere zeigt.

Die globale HANDOFF-Datei bleibt damit für mehrere Rollen ein gemeinsamer Commit-Pfad; die gemessenen Commits beweisen keine Autorenkollision. Die Startbehauptung „Kontextband nur für Claude sinnvoll“ ist zu weit: `server.ts#contextFill` kann auch Pi- und Codex-Adapter lesen, Codex mit eigenem Fenster-Nenner; die Vergleichbarkeit eines Qualitätsbands zwischen Modellen ist unknown. Die Controller-Rolle bleibt nach portablem Vertrag untypisierte Portfoliofunktion; eine zusätzliche Dispatch-Autorität folgt daraus nicht. Der Owner-Entscheid vom Brief braucht noch eine präzise Rollenformulierung.

**b) Kosten.** K2 der Tabelle trennt den beobachteten HANDOFF-Gitverkehr vom bedrohten Task-Program-Join. Tatsächliche Verluste durch `capPrograms` sind uncosted; das Risiko ist im Code unmittelbar vorhanden, auch wenn das heutige Program-Budget noch nicht ausgeschöpft ist.

**c) WEGLASSEN.** `capPrograms` streichen verhindert diesen Elternverlust sofort, lässt aber auch unreferenzierte COMPLETE Programs unbegrenzt wachsen. Das gesamte Succession-Gate zu streichen würde Generic-/Supervisor-Nachfolge ohne nachgewiesenen Übergabeinhalt erlauben; diesen Verlust rechtfertigt die HANDOFF-Last nicht.

**c) VERSCHLANKEN.** Die bereits gebaute Standard-MAIN-Ausnahme konsequent in deren Einstieg nutzen; zusätzliche HANDOFF-Commits dieser Rolle entfallen, sofern sie keinen anderen ausdrücklich nötigen Inhalt sichern. Halbierungsziel wären deren reine Übergabecommits gegenüber einem gleich langen Fenster; die aktuelle Zählung ist nicht nach Rolle getrennt und beweist dieses Potenzial noch nicht.

**c) DYNAMISCH-KLÜGER.** Retention am gemessenen Referenzbedarf ausrichten: COMPLETE Programs mit nichtterminalen Tasks behalten, nur den verbleibenden Platz mit jüngsten unreferenzierten COMPLETE Programs füllen. Der Budgetüberhang wird erklärbar; Tasks werden weder still umgehängt noch geschlossen. Boot muss diese Referenzen kennen, bevor es Programs kürzt. Für Kontext stattdessen pro Adapter Beobachtbarkeit, Nenner und Alter ausweisen; ein unbekannter Wert löst keine automatische Nachfolge aus.

**d) Empfehlung: DYNAMISCH-KLÜGER.** Schnittlinie ist ausschließlich referenzbewusste `capPrograms`-Retention einschließlich ihrer Boot-Aufrufreihenfolge. Standard-/Game-/Generic-/Supervisor-Nachfolge, Controller-Autorität und Taskstatus bleiben unverändert. Offene Inbox-/Report-Referenzen sind vor Umsetzung als zusätzliche Halter zu prüfen; wenn sie einen weiteren Retentionsvertrag erfordern, gesonderten Schnitt filen und nicht vollständige Referenzsicherheit behaupten.

## K3 — Queue: Vorschläge brauchen Träger und einen Rückweg

**a) Mechanismus — geprüft.** `server.ts#capTasks` hält nichtterminale Zeilen und referenzierte Quellen, `tickDispatch` betrachtet ausschließlich queued Aufträge und prüft Harness-Automatisierbarkeit erst nach Repo- und Program-Deckel. `decideFleetReport` persistiert das einmalige Urteil und quittiert den Empfänger-Event, erzeugt aber keinen neuen Rückweg zur berichtenden Lane; die bestehende Brief-Edit-Route stempelt `model:"owner"` (`server.ts:28480`), während `server/types.ts#TaskBrief` keine eigene MAIN-Autorform trägt.

Aus Register übernommen: keine Umhänge-Route, Bündelziel noch ungebaut, fehlende Self-Brief-Tür, historisch ungeschriebene Task-Felder. Der alte Feldzensus ist am jüngeren Baum unknown und kein Auftrag, acht beliebige Felder zu entfernen. Geprüft: `watchdog.sh:192` setzt den Repo-Default auf eine Lane, keinen expliziten Program-Env-Deckel; `tickDispatch` kann dennoch einen Program-Grant mit eigenem `maxLanes` berücksichtigen. „Program-Deckel nie wirksam“ wäre daher zu pauschal. Die 84 Notizen sind vorhanden; fehlende Leser jeder einzelnen sind nicht bewiesen.

**b) Kosten.** K3 der Tabelle zeigt Kommunikationsaufkommen und Backlogbestand. Bearbeitungszeit, doppelte Arbeit durch eine unbemerkte Ablehnung sowie der Nutzen einer Umhängung bleiben uncosted.

**c) WEGLASSEN.** Notizen ohne belegten Leser automatisch löschen würde Backlog und Poll verkleinern, aber ungeprüfte Befunde vernichten. Sinnvoll entfallen können nur ausdrücklich erledigte oder mit erhaltener Quelle gebündelte Zeilen; Alter oder COMPLETE allein entscheiden das nicht. Ebenso darf ein pending Auftrag ohne Release nicht automatisch starten.

**c) VERSCHLANKEN.** Zuerst den fehlenden Ablehnungsrückweg schließen: Die noch lebende Herkunfts-Lane sieht Report-ID, Urteil und Grund über ihren eigenen Rückweg; ein beendeter Occupant wird als nicht erreichbar ausgewiesen. Ziel wäre mindestens halb so viel manuelles Nachfragen nach Ablehnungen; dafür fehlt heute die Baseline. Bündelung bleibt ein separater inhaltlicher Akt, der Referenzen und einen benannten Leser erhält.

**c) DYNAMISCH-KLÜGER.** Notiz-Lebensdauer an belegte Zuordnung, Übernahme und Verdict koppeln: verwaiste Zeilen zur Disposition vorlegen, gelesene Quellen nur bei expliziter Übernahme archivieren. Für Dispatch zuerst statische Eignung feststellen, dann verfügbare Kapazität bewerten; Ressourcenbudgets dürfen Freigaben nur begrenzen. load1 ohne CPU-Anzahl, Speicher-/Suite-Druck und Hysterese wäre eine wechselhafte Ersatzampel.

**d) Empfehlung: VERSCHLANKEN.** Schnittlinie ist der Rückweg nach Report-Ablehnung an den exakten Herkunfts-Occupant; unverändert bleiben einmaliges Urteil, neuer Report nach Reparatur, Land-Verweigerung, Queue-/Release-Status und Promotion. Umhängung, Bündelung, Brief-Autorschaft und Harness-Reihenfolge sind voneinander trennbare Nachfolgeschnitte. Das Rollenproblem aus K2 darf nicht durch zusätzliche Lane-Rechte gelöst werden.

## K4 — Verify und Audit: teure Messung braucht einen zuständigen Leser

**a) Mechanismus — geprüft.** `e2e-stage.sh` beansprucht den maschinenweiten Suite-Mutex, während `server.ts#verifyPlanFor` und die proportionale Post-Land-Auswahl Docs bereits kurz prüfen; `SUITE_OFFER_WAIT_HELD_MS` bleibt 800.000 ms, also ein festes Angebot-Wartebudget. `tickAuditPing` wählt ein unadjudiziertes rotes Audit und danach ruhige Nicht-Lane-Sessions ohne Program-/Repo-Zuordnung, während `inboxSubject` für das reservierte `audit-red` weiterhin keinen Inhalt liefert.

Die Startaussage „800 s unter Remote-Minimum“ ist ohne dasselbe Lauf- und Wartebudget nicht bewiesen: Das Register selbst nennt nur eine kleinere Untergrenze plus weitere Arbeit. Aus Register übernommen bleiben die zwei konkreten unadjudizierten Audits; deren heutige Adjudikation wurde nicht gelesen. Die Behauptung „achtzehn Flake-Familien“ ist veraltet: `docs/verify-tiering.md` benennt inzwischen eine zweiundzwanzigste Familie (§11.2u), mehrere ausdrücklich repariert; Familienzahl ist keine Zahl aktiver Defekte.

**b) Kosten.** K4 der Tabelle belegt lange Auditlaufzeiten und rote Ergebnisse. Es wurde keine Kausalität „Mutex erzeugt den ganzen Median“ berechnet. Die fehlende Zuständigkeit lässt den teuren Beleg ohne verlässlichen Arbeitsadressaten zurück; deren zusätzliche Liegezeit ist uncosted.

**c) WEGLASSEN.** Den Mutex entfernen kann konkurrierende Suiten auf derselben Maschine gegenseitig beeinflussen; seine dokumentierte Schutzaufgabe bleibt bestehen. Audit komplett entfernen spart die nachgelagerte Laufzeit, verliert aber die Beobachtung des gelandeten Baums. Beides ist ohne neuen Isolations- beziehungsweise Beweisvertrag kein enger Schnitt.

**c) VERSCHLANKEN.** Programbezogene rote Audits über den vorhandenen Outcome-Join in die richtige Program-Inbox schreiben und doppelte generische Pings für vollständig adressierte Audits vermeiden. Halbierungsziel: mindestens halb so viele unzuständige Pane-Pings in einer Mischung mit überwiegend Program-Lands; für vollständig adressierte Fixtures genau keiner. Auditdauer wird dadurch nicht kürzer, die Messung bekommt aber einen handlungsfähigen Leser.

**c) DYNAMISCH-KLÜGER.** Audit-Tiefe nur anhand nachgewiesener Abdeckung der tatsächlich gemeinsam gedeckten Diffs wählen; reine Docs sind bereits der gebaute Fall. Weitere Stufen verlangen zuerst eine belastbare Zuordnung von Verhaltensfläche zu Prüfungen. Wartebudget aus Queue-/Lease-Fortschritt mit harter Obergrenze ableiten; wartenden Helper von arbeitendem Helper unterscheiden und Zeitüberschreitung als unknown erhalten. Ein größeres Timeout allein behebt keine Flake-Familie.

**d) Empfehlung: VERSCHLANKEN.** Schnittlinie ist der in Architektur §5 beschriebene Writer samt Subject-Join und Ping-Unterdrückung bei vollständig adressierten Covers, lokal und remote. Audit-Tiefe, Mutex, Owner-Adjudikation und Land-Promotion bleiben unverändert. Ein nicht auflösbarer Cover ist unknown; ein nachweislich programloser Cover darf den bestehenden Rückweg behalten. Fehlende Zuordnung wird niemals als erfolgreiche Zustellung gezählt.

## K5 — Doc-Flut: Befunde sichern, weniger Git-Bewegung erzeugen

**a) Mechanismus — geprüft.** Git zeigt laufende Änderungen an `docs` und `HANDOFF.md`; `verifyPlanFor` wählt für erkannte Docs-Diffs die kurze Kette, und `schedulePostLandAudit` übernimmt das proportionale Merkmal des Lands für die spätere Auswahl. Der Messindex verweist auf dauerhafte Befundtexte, während das normative Regelwerk laut `AGENTS.md` portablem Kern und privatem Overlay unterschiedliche Leser zuweist; die Behauptung eines pauschalen Kontextanteils der privaten Datei wurde nicht nachgemessen.

Aus Register übernommen bleiben direkte Docs-Commits als dominanter Weg und Messnotizen als einzige Sicherung einzelner Befunde. Welche Aussage ausschließlich dort lebt, wurde nicht Satz für Satz gejoint. Acht Prozent eines Kontextfensters sind ohne tatsächlichen Loaderumfang und Tokenzählung unknown; Dateibytes genügen nicht.

**b) Kosten.** K5 der Tabelle: Git-Bewegung ist belegt, direkte Autorenschaft nicht. Der kurze Auditmedian zeigt, dass die höchste Hebelwirkung eher in weniger kleinteiligen HEAD-Wechseln und geringerem Leseraufwand liegt; tatsächlich dadurch ausgelöste Gate-Wiederholungen bleiben uncosted.

**c) WEGLASSEN.** Messnotizen streichen entfernt auch die nachvollziehbaren Belege, aus denen später Schnitte entstehen. Entfallen können dagegen wiederholte Statussätze, deren Quelle bereits dauerhaft verlinkt ist. Normative Regeln und neue Beobachtungen brauchen weiterhin eine überprüfbare Fassung.

**c) VERSCHLANKEN.** Pro abgeschlossener Frage ein Dokument mit Indexzeile und nachprüfbaren Befunden; Fortschrittsmeldungen gehen in den bereits vorhandenen Report, bevor erneut ein Zwischenstand als Doc committet wird. Ziel: halb so viele reine Zwischenstandscommits pro beantworteter Frage, ohne weniger beantwortete Fragen. Der vorhandene Handover-Record aus K2 reduziert zusätzliche Anlass-Commits.

**c) DYNAMISCH-KLÜGER.** Dokumentpflege durch einen echten Änderungsanlass auslösen: neuer Beleg, widerlegter Befund, geänderter Vertrag oder benannter Leserauftrag. Mehrere gleichzeitige Befundkorrekturen an derselben Frage sammeln; dringende neue Gegenbelege sofort sichern. Anker nur an passende Rollen/Trigger ausliefern, ihre tatsächliche Nutzung als unknown behandeln, solange es keine Lesebelege gibt.

**d) Empfehlung: VERSCHLANKEN.** Schnittlinie ist die Arbeitsweise für Messdokumente: ein zusammenhängender Ergebnisstand statt fortlaufender Zwischenstandscommits. Historische Belege, Owner-Promotion von Regeln, verpflichtende Checkpoints sowie bestehender Docs-Proof bleiben unverändert. Das ist ein Vorschlag an die Betriebs-MAIN, keine durch dieses Dokument wirksam gewordene Regel und kein neues Dokumentsystem.

## K6 — Datenschichten: wiederholte Vollarbeit und wachsende Spuren

**a) Mechanismus — geprüft.** `server.ts#queueStateSave` serialisiert synchron je Aufruf und reiht jeden vollständigen Schreib-/fsync-/Backup-/Rename-Lauf ein; `saveStateNow` nutzt denselben Pfad als Haltbarkeitsbarriere, und `tickAuditPing` liest seine Ledger erneut. Die Sessions-Projektion liefert weiterhin `watches`, `autosOn`, `quietHours` und `programsStale`, für die die Suche in `src/` keine TypeScript-Leser findet; zusätzlich hängt `logPrompt` direkt ans eigene Journal an, während `server/persist.ts#queueEventWrite` nur eine Rotationsgeneration erhält.

Aus Register übernommen: Trail-Bestand jenseits des Statistik-Lesefensters und fehlender Reaper; Writer-/Cleanup-Pfade wurden hier nicht vollständig verfolgt. Der im Gegencheck korrigierte erfundene Konstantenname wird nicht übernommen. Die pauschale Aussage „Ledger ohne zweiten Leser“ trägt nicht: `tickAuditPing`, `programExecutionView` und `readLedger` sind reale Leser; offen sind zuständige Folgebearbeitung, Nutzungshäufigkeit und historische Vollständigkeit. Die frühere Save-Kadenz bleibt eine fremde Momentaufnahme.

**b) Kosten.** K6 der Tabelle belegt die Bytebasis wiederholter Vollarbeit; keine CPU-/SSD-Lebensdauerrechnung daraus. Unbegrenztes Prompt-Wachstum und Trail-Aufbewahrung bleiben aktuell uncosted. K1 erzeugt zusätzlich wiederholte State-Saves: erst dessen unnötige Wiederholung vermindern, dann verbleibende Save-Last neu messen.

**c) WEGLASSEN.** Die vier ungenutzten Poll-Felder entfernen spart ihre Übertragung vollständig, ändert aber weder Queuegröße noch Haltbarkeitsarbeit. Vorher die API-Vertragsleser außerhalb `src/` klären; unbekannte externe Leser dürfen nicht still verschwinden. Rohledger löschen würde die Möglichkeit späterer Gegenproben beschneiden.

**c) VERSCHLANKEN.** Nur gewöhnliche `saveState()`-Anforderungen innerhalb eines laufenden Schreibfensters zu einem nachfolgenden aktuellen Snapshot bündeln; `saveStateNow()` behält eine echte Barriere und darf nicht hinter einen veralteten Snapshot zurückfallen. Halbierungsziel ist die Zahl physischer Schreibvorgänge bei einer definierten Burst-Fixture, nicht behauptete Halbierung der heutigen Maschinenlast. Fehlerpropagation und atomare Dateierneuerung bleiben Pflicht.

**c) DYNAMISCH-KLÜGER.** Bündelungsfenster an beobachtete Save-Warteschlange koppeln, mit begrenzter maximaler Haltbarkeitsverzögerung für gewöhnliche Saves. Spuren nach belegtem Referenzbedarf und Lesefenster staffeln: offene Prüfbelege halten, abgeschlossene Spuren komprimiert archivieren, Rotation und Lücken offen ausweisen. Das ist mehr als ein Reaper und verlangt einen eigenen Aufbewahrungsvertrag.

**d) Empfehlung: VERSCHLANKEN.** Schnittlinie ist ausschließlich Coalescing gewöhnlicher State-Saves; unverändert bleiben Barrieren, Credentials, Dateimodus, fsync, Backup, Rename und gelesene Datenform. Erst nach K1 die Restlast messen, weil sonst Lastentstehung und Lastverarbeitung gleichzeitig verändert werden. Poll-Felder, Prompt-Rotation und Trail-Retention sind getrennte Schnitte mit eigenen Leserprüfungen.

## Rangliste nach Kosten/Nutzen

Qualitative Priorität aus beobachteter Häufigkeit, drohendem Verlust und Schnittgröße; keine erfundenen Euro- oder Zeitersparnisse. K2 steht trotz ungemessener Verlusthäufigkeit vor kosmetischen Rückwegen, weil ein verschwundener Elternsatz später nicht zuverlässig rekonstruierbar ist.

| Rang | Empfehlung | Nutzen / Kosten des Schnitts |
|---|---|---|
| 1 | K1: begrenzter Backoff und aggregierte Holds | Häufigster gemessener Leerlauf; enger Zustellpfad, erhöht begrenzt die Wiederanlaufzeit. |
| 2 | K4: Audit an zuständiges Program | Gibt teuren roten Messungen einen Leser; mehrere lokale/remote Rückwege, vorhandene Inbox nutzbar. |
| 3 | K2: COMPLETE Programs mit offenen Tasks halten | Verhindert dangling `programId`; kleiner Kern, Boot-Reihenfolge muss mitgeprüft werden. |
| — | **SCHNITTLINIE: diese drei als erste Lanes filen** | Seriell wegen gemeinsamer `server.ts`-Fläche; kein Dispatch aus diesem Dokument. |
| 4 | K3: Ablehnung an Herkunfts-Lane zurückgeben | Schließt Kommunikationslücke; Kostenhäufigkeit noch ungemessen. |
| 5 | K6: gewöhnliche State-Saves bündeln | Spart wiederholte Vollarbeit; höheres Risiko an Haltbarkeitsbarrieren, nach K1 erneut messen. |
| 6 | K5: Ergebnisdokumente bündeln | Günstige Arbeitsvereinbarung; Effekt auf Gate-Neuläufe erst zu messen. |

## Drei Lane-Schnitte

Die Done-Kommandos gelten für künftige Code-Lanes. In dieser Dokument-Lane wurden sie nicht ausgeführt. Jede Code-Lane erhält `claude-opus-5[1m]`, Effort `high`, zusätzlich die vom Self-Gate gewählte Verify-Kette; Suiteoutput bleibt in einer externen Logdatei und nur deren Tail wird berichtet. Kein Land oder Deploy ist Teil dieser Briefs.

### Lane 1 — K1: begrenzte Wiederholung bei belegtem Composer

Write-Set: `server.ts`, `e2e/watch.ts`, `e2e/pins.ts`, `docs/self-api.md`.

Auftrag: In `tickWatches` und `recoverFleetReportDelivery` denselben begrenzten Hold-Backoff pro Event/Empfänger-Occupant nutzen; Hold-Eintritt, aggregierte Wiederholungen und Ende unterscheidbar halten. Den Retry-Zeitpunkt über die bestehende Ereignissicht dokumentieren, ohne neue fachliche Zustände oder Queue-Autorität einzuführen. Prozesslokaler Zustand ist für den ersten Schnitt vertretbar; Neustart beginnt mit einer frischen Prüfung und erhält keine falsche Zustellbestätigung.

Done-Test: `./e2e-isolated.sh > /tmp/knackpunkte-k1-proof.log 2>&1` endet mit `ALL PASS` und beweist in `e2e/watch.ts`, dass ein über mehrere Ticks belegter Composer mindestens halb so viele Send-Proben und Hold-Zeilen wie die Tickzahl erzeugt, nach Freigabe innerhalb der dokumentierten Maximalfrist genau einmal zugestellt wird und ein recycelter Empfänger niemals den alten Retry erbt.

Gegenproben: unbekannter Composer, fehlender Empfänger, Teardown während Await, unverändert null verbrauchte Sendeversuche bei Vor-Paste-Verweigerung, zwei unabhängige Events; Reset oder Zeitablauf darf `send-uncertain` nicht eigenmächtig in delivered umwandeln. Leere Eventmenge verursacht weder Save noch Send. Deterministische Uhr-/Latch-Fixture bevorzugen; reine Sleep-Ratenbeobachtung beweist die Obergrenze nicht.

Flächenentscheidung: Server und beide Send-Rückwege apply; bestehende Event-Wireform unverändert, zusätzliche Diagnose nur in bestehender Form; Client not-applicable ohne neue UI; Dokumentation und Proben apply. Claude/Pi/Codex sind für die harnessunabhängige Retry-Regel apply; nicht beobachtbarer Composer bleibt unknown, keine erfundene Unterstützung.

Effort: high. Modell: `claude-opus-5[1m]`. Stopplinie: keine Accept-Wait-Anpassung, keine tmux-Löschänderung, keine Readiness-Sonde und keine persistenten Retry-Felder. Wenn die bestehende Diagnoseform keinen ehrlichen Retry-Zeitpunkt tragen kann, diesen Vertragsbedarf mit Diff melden, statt das Schema beiläufig zu erweitern.

### Lane 2 — K4: audit-red an Program-Inbox

Write-Set: `server.ts`, `e2e/repo-worker-audit.ts`, `e2e/helper-daemon.ts`, `e2e/pins.ts`, `docs/self-api.md`.

Auftrag: Architektur §5 am aktuellen Baum anpassen: Covers über `branch` UND `mainAfter` mit gelandeten Outcomes verbinden, pro aktivem Program einen deduplizierten Inbox-Eintrag schreiben und das `audit-red`-Subject aus dem Audit-Ledger liefern. Nur vollständig adressierte Audits unterdrücken den generischen Ping; gemischte oder nicht auflösbare Covers behalten einen offen benannten Rest.

Done-Test: `./e2e-postland-audit.sh > /tmp/knackpunkte-k4-proof.log 2>&1` endet mit `ALL PASS` und beweist für lokale und remote rote Audits denselben Program-Inbox-Eintrag mit Covers/Fail-Namen/Tail sowie keinen generischen Ping bei vollständiger Zuordnung; für grün, doppelte Meldung, programlosen und gemischten Cover sind die jeweiligen Nebenwirkungen exakt geprüft.

Gegenproben: gleicher Branch mit anderem Land-SHA darf nicht matchen; fehlende historische `programId`, leere Covers, malformed Ledgerzeile und verlorene Program-Bindung liefern benanntes unknown beziehungsweise bleiben offen. Restart lädt den neuen Pingstatus; Inbox-Read ist keine Adjudikation. Slot-Recycle während Await darf die Zuständigkeit nicht verändern.

Flächenentscheidung: lokale Audit-Abgabe, Helper-Ergebnis, Loader, Inbox-Wire/Reverse-Join, Dokumentation und Proben apply; Provider-spezifische Adapter not-applicable, weil Zuordnung an Outcome/Cover hängt; Client not-applicable, sofern bestehende Inbox-Sicht ausreicht. Vor einer nötigen Client-Erweiterung Stopplinie melden.

Effort: high. Modell: `claude-opus-5[1m]`. Stopplinie: keine Adjudikationsrechte für MAIN, keine neue Audit-Tiefe, keine Watch-/Promotion-/Mutex-Änderung und keine nachträgliche Umdeutung alter roter Audits. Wenn unbekannte Herkunft nicht von programlos unterscheidbar ist, konservativ offenlassen und die Lücke im Report benennen.

### Lane 3 — K2: Program-Retention erhält offene Task-Referenzen

Write-Set: `server.ts`, `e2e/programs.ts`, `e2e/pins.ts`, `docs/self-api.md`.

Auftrag: `capPrograms` behält zusätzlich alle COMPLETE Programs, auf die nichtterminale Tasks verweisen, und kürzt nur unreferenzierte COMPLETE Programs nach bestehender Reihenfolge. Alle Aufrufstellen einschließlich Loader müssen denselben vollständigen Taskstand berücksichtigen. Ein Überhang darf sichtbar als Referenzbedarf erklärt werden; kein Task wird verändert.

Done-Test: `./e2e-isolated.sh > /tmp/knackpunkte-k2-proof.log 2>&1` endet mit `ALL PASS` und beweist bei überschrittenem Program-Budget, dass ein altes COMPLETE Program mit pending Task sowohl beim Anlegen weiterer Programs als auch nach Restart erhalten bleibt, während ein gleich altes unreferenziertes COMPLETE Program verdrängt werden kann und alle Taskzeilen identisch bleiben.

Gegenproben: keine Tasks, nur terminale Tasks, ausschließlich referenzierte Programs über Budget, fehlende `programId`, mehrere Tasks am selben Program, malformed Task beim Loader sowie eine Task-Statusänderung vor dem nächsten Retentionslauf. Ein schon fehlendes Program wird nicht erfunden. Der Test muss scheitern, wenn die Referenzprüfung entfernt oder erst nach `capPrograms(loaded)` ausgeführt wird.

Flächenentscheidung: Server-Retention und Boot-Reverse-Join apply; API-Datenform unverändert; Client und Harness-Adapter not-applicable; Dokumentation und Proben apply. Weitere Halter wie offene Inbox/Reports lesend prüfen und ihren Befund berichten, ohne diesen Task-Referenzschnitt als vollständigen Retentionsvertrag auszugeben.

Effort: high. Modell: `claude-opus-5[1m]`. Stopplinie: keine Task-Retention-Reparatur, kein Umhängen, keine neue Handoff-Route, keine Program-Reaktivierung und keine Änderung von Owner-Caps oder Nachfolgegates. Erfordert der Loader eine breite Umstrukturierung, mit dem konkreten Reihenfolgeproblem an MAIN zurückgeben.

## Nicht geprüft

Live-Panes, aktuelle Provider-Readiness, Owner-UI, tatsächliche Lesebelege, genaue Controller-Entscheidungsprosa und CLAUDE-Loader-Tokenumfang wurden nicht beobachtet. Die Dateien im ursprünglichen Lesepaket wurden gelesen; tragende Symbole gezielt geprüft, `server.ts` und die Testmodule nicht vollständig auditiert. Das private Regelbuch wurde nicht geladen.

Die vier zugelassenen Ledger wurden lesend ausgewertet; Adjudikationsledger, Prompt-Journal und Suite-Trails wurden nicht neu ausgezählt. Historische Zahlen ohne eigene Reproduktion sind oben ausdrücklich fremde Befunde oder unknown. Die Startzahlen für Direkt-Commits, Nudge-Fehler, Gate-Dauer, Trail-Menge und ungeschriebene Felder tragen keine aktuelle Wirkungsschätzung.

`~/.Codex/knowledge/INDEX.md` war unter dem genannten Pfad nicht vorhanden; daraus wurde kein zusätzlicher Vertrag abgeleitet. Keine Suite lief in dieser Dokumentarbeit. Dokumentvollständigkeit, Write-Set, sauberer Commit und Drift werden separat als Lieferbeweis geprüft; die Wirkung der vorgeschlagenen Code-Schnitte bleibt bis zu deren Umsetzung unknown.
