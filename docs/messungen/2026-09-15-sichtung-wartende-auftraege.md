---
frage: Welche wartenden Auftraege in Fleet-Betrieb und Leichtgewicht koennen geschlossen werden, welche brauchen Schaerfung und welche koennen starten?
urteil: erledigt 0 · veraltet 3 · doppelt 1 · schaerfen 18 · startbereit 12; keine vollstaendige Erledigung eines Gesamtauftrags belegt.
bereich: [queue, backlog, programme]
belege: [pending-auftraege.json, active-programs.json, git-Historie, gezielte Code- und Notizlesung]
nicht-gemessen: Live-Queue, private Laufzeitkonfiguration, historische Roh-Ledger, fremde Lanes, Produktverhalten unter Ausfuehrung
stand: 2026-09-15
---

# Sichtung der 34 wartenden Auftraege

## Grundlage und Leseregel

Snapshot laut Auftrag: 2026-09-15, 18:4x. Eingaben: pending-auftraege.json und active-programs.json im privaten Verzeichnis astra-inputs-2026-09-15. SHA256 des Queue-Exports: `6bd15254b32638edc592a59bebd5dda4193882d479d25550331f08aff8e23463`. Filter ausschliesslich programId gleich `f170dc46e4b026ee34d9392e` (Fleet-Betrieb) oder `f9dc8e101bcc10c5e90b0eed` (Leichtgewicht): **34 Eintraege**. Alter = exportiertes ageDays, nicht neu gerechnet. Kopf = erste 80 Unicode-Zeichen von text, Zeilenumbrueche zu Leerzeichen, ohne Ellipse.

Gepinnter gelesener Baum (HEAD und main bei Beginn identisch): `bf7e06e89871c09c4d3c30123fe91d7fc03c60c0`. Alle Codezeilen und Symbole unten beziehen sich darauf. Gelesen: alle ausgewaehlten Volltexte, cardValid/cardGaps, comments und note, beide Program-Intents, die beiden Vorlaufnotizen, der Messnotiz-Index sowie die genannten Codebereiche. Die Historie wurde mit `git log main --oneline --since=2026-08-25` gesucht und passende Commit-Bodies/Diffs gelesen. Graphify wurde nur lesend zur Orientierung benutzt, strukturelle Belege kommen aus dem Baum. Der Knowledge-Index unter dem vorgegebenen privaten Pfad war nicht vorhanden.

Die vorhandene Queue ist der passende Traeger: diese Sichtung braucht eine Ernte-Notiz, keine neue Zustandsschicht. **Urteile sind Vorschlaege fuer die Orchestratorin.** „veraltet“ bedeutet: den alten Auftrag in dieser Form schliessen, nicht: sein damaliges Ziel sei implementiert. „startbereit“ bedeutet fachlich ausreichend beschrieben und kein hier belegter sachlicher Vorganger offen; es bedeutet weder freigegeben noch aktuell kollisionsfrei. Holds und Lane-Deckel aus note sind Snapshot-Fakten und vor dem Start frisch zu pruefen. Kleine benannte Flaechen-/Schreibweisenkorrekturen stehen in der Begruendung; eine fehlende Richtung, rote gespeicherte Karte oder ungeklaerte Abhaengigkeit fuehrt zu „schaerfen“.

## Einzelurteile

| id | Kopf (80 Zeichen) | Alter in Tagen | Urteil | Beleg | Ein Satz Begruendung |
|---|---|---:|---|---|---|
| `ee47b0f8` | [LEBENSZYKLUS S5b · Codex gpt-5.6-sol · Program Fleet-Betrieb] Dein Brief ist de | 10.9 | startbereit | docs/program-lebenszyklus-architektur-2026-09-04.md:598–629, §8-b; git grep nach paneModel/modelPushedAt/modelFooter in server.ts ohne Treffer | Das Footer-Muster ist nachgeliefert und die Sensor-/Push-Luecke offen; fuer den Nullfall gilt die konkrete Checkvorgabe „Feld weglassen“, die Harness-Schreibweise Codex ist zu normalisieren. |
| `1832c7eb` | [LEBENSZYKLUS S5c · Codex gpt-5.6-sol · Program Fleet-Betrieb] Dein Brief ist de | 10.9 | schaerfen | watchdog.sh:195; server.ts#programDispatchCap (12319); `git show 521e397d -- watchdog.sh` | Der Brief setzt noch den Repo-Deckel 2 voraus, waehrend der Watchdog 1 setzt und der Program-Deckel heute vom Repo abhaengt; vor einem globalen Program-Limit 1 die heutige Deckelabsicht festlegen. |
| `60fff186` | ROLLE: [Leichtgewicht/Feld from] Isolierte Lane claude/claude-opus-5[1m]/high. B | 7.3 | schaerfen | server.ts#handleIntake (27094–27100); server/types.ts#Task; Snapshot cardGaps | from wird weiterhin gespeichert, aber der benannte loadState-Symbolanker fehlt und die ausdrueckliche Owner-Freigabe des Rueckbaus ist im Export nicht belegt. |
| `e0c1ba07` | ROLLE: [Leichtgewicht/Feld filesProposal] Isolierte Lane claude/claude-opus-5[1m | 7.3 | startbereit | server.ts#createTaskForMain (10327–10418), Task-Mint ohne filesProposal | Der MAIN-Mint setzt noch keinen Dateivorschlag; der Auftrag beschreibt genau diese Quelle samt Persistenz-, Identitaets- und Negativproben und hat eine gueltige Karte. |
| `df50b95b` | ROLLE: [Leichtgewicht/Feld criterion] Isolierte Lane claude/claude-opus-5[1m]/hi | 7.3 | veraltet | `git show 30988f1f -- server.ts e2e/tasks.ts docs/self-api.md`; server.ts#openCriterionAttention; Snapshot 84888f35 | Die Praemisse „keine aktuelle Population“ ist durch den dokumentierten Criterion-Fall und dessen gelandete Attention-Reparatur ueberholt; Entfernen wuerde den inzwischen benutzten Klaerungsweg und den neuen Warte-Auftrag abbauen. |
| `666d0b67` | ROLLE: [Leichtgewicht/Feld refine] Isolierte Lane claude/claude-opus-5[1m]/high. | 7.3 | veraltet | `git show 0ce91c0d -- server.ts wave-brief.ts e2e/tasks.ts`; Snapshot d02fd2bd; docs/messungen/2026-09-12-spezifizierung-buendelung-befund.md:97–109 | Die spaetere Richtung erhaelt Refine-Struktur in Karten und der neuere Owner-Auftrag erweitert Refine zur Gegenlese; den alten pauschalen Rueckbau nicht daneben starten. |
| `a17a630b` | [NACHFOLGE:6c9e2ac1] ROLLE: Isolierte Read-only-Beleg-Lane; claude/claude-opus-5 | 7.3 | schaerfen | server.ts#supervisorView (25743), #publicProgramListRow (2049); Snapshot cardGaps | Der begrenzte Portfolio-Lesertest bleibt sinnvoll, braucht aber einen gueltigen Datei-/Verify-Kopf und einen selbsttragenden Quellenauftrag statt der im Export unaufgeloesten Vorganger-ID. |
| `60257e41` | [NACHFOLGE:9f1dbfb4] ROLLE: Isolierte Read-only-Beleg-Lane; claude/claude-opus-5 | 7.3 | schaerfen | server.ts#publicProgram (2036), #publicProgramListRow (2049); src/client.ts:7646–7651; Snapshot cardGaps | Die Owner-Liste ist bereits um vier Prosa-Koerper gekuerzt, die Vollprojektion existiert weiter; den Auftrag auf verbleibende Routen/Verbraucher zuschneiden und Verify sowie alte Quellenreferenz reparieren. |
| `a05fa7ff` | [NACHFOLGE:328fd28f] ROLLE: Isolierter Implementierungsworker; claude/claude-opu | 7.3 | veraltet | AGENTS.md:105–109; docs/game-maker/workflow-v2.md §3; aktueller Sensory-Critic-Vertrag | Die verlangte automatische Critic-Ersatzsteuerung mit eigener Persistenz passt nicht zum aktuellen operator-orchestrierten Sensory-Critic-Vertrag; keine alte Workflow-Automatik ohne erneute Richtungsentscheidung bauen. |
| `9940ec64` | [NACHFOLGE:e0d625a5] ROLLE: Isolierter Implementierungsworker; claude/claude-opu | 7.3 | startbereit | program-phase.ts#phaseOf, Regeltabelle R8–R13 (235–270); server.ts#programExecutionView | Die gelesene Phasenentscheidung kennt Attention und Lane-Praedikat, aber keinen complete-Report-Widerspruch bei ahead=0; der Nachfolgebrief enthaelt den erforderlichen positiven und negativen Beweis selbst. |
| `531bab26` | [NACHFOLGE:aa3fd660] ROLLE: Isolierter Implementierungsworker, Suite-Schnitt A;  | 7.3 | schaerfen | `git show 69abe764`; e2e-isolated.sh:839; Snapshot-Kommentar ac973651; e2e/harness.ts | Der im Kommentar priorisierte Steward-Idle-Schnitt ist bereits gelandet, nicht jedoch der ganze until-/Dreilaeufe-/20-Prozent-Auftrag; neue Restmenge und vergleichbare Basis statt nochmals dieselben vier Minuten beauftragen. |
| `67abe12c` | [NACHFOLGE:5cd2d1b9] ROLLE: Isolierter Implementierungsworker, Suite-Schnitt B;  | 7.3 | schaerfen | fleet-e2e.ts; verify-proportion.ts; Suche nach FLEET_E2E_MODULES dort ohne Treffer; Snapshot 531bab26/67abe12c | Der Modulfilter ist damit nicht belegt und Schnitt A bleibt ungeklaert; zuerst dessen Rest und den heutigen Fixture-/Shard-Vertrag festlegen, dann das Acht-Minuten-Ziel neu basieren. |
| `db756205` | [NACHFOLGE:6488292a] ROLLE: Isolierter Implementierungsworker; claude/claude-opu | 7.3 | schaerfen | Snapshot db756205, ausdrueckliche STOPPLINIE; e2e/watch.ts#run, Q6-Familie; `git show a40ed257` | Der Brief verbietet Release vor Entscheidung zwischen fuenf lokalen Laeufen und Mutation plus Offer; neuere Einzelreparaturen beweisen weder beide Familien noch heben sie diese offene Entscheidung auf. |
| `04f55eba` | [UMGEHAENGT 2026-09-10 aus Program e3b3a064 (Original eec64457, dort archiviert) | 4.9 | startbereit | docs/messungen/2026-09-07-c5-zielprojektion-gegenfaelle.md:3–6,234–240; `git log HEAD --oneline -- docs/messungen/2026-09-07-c5-zielprojektion-gegenfaelle.md` | Die bestehende Notiz belegt nur Fall 2/2b und 4 und nennt die anderen offen; als Fortsetzung die vier fehlenden Faelle und die gemeinsame Projektion liefern, vorhandene Belege erhalten. |
| `f3ca2e05` | [CROSS-HOST-DISPATCH · LANES AUF DEM SECOND-HOST, NICHT NUR SUITEN · CLARIFY FIRST | 4.3 | schaerfen | docs/messungen/2026-09-15-second-host-sessions-optionen.md §2–3; Commit 20b9fb3e; Snapshot abd10a06 | B1 konkretisiert die Topologie, beweist aber weder die gesamte Q1–Q6-Klaerung noch den Criterion-Ausgang; verbleibende Transport-/Land-/Deckelfragen nach der Kanarie als Restauftrag fassen statt den Grundsatzlauf zu wiederholen. |
| `e4409bf2` | [REFERENZEN, DIE DIE RETENTION NICHT SIEHT · zwei Befunde, ein Objekt · CLARIFY  | 4.2 | schaerfen | `git show b0cc4194`; task-notes.ts:187–192; Snapshot e4409bf2 | Das neue Archiv verhindert kuenftigen Verlust vollstaendiger Terminalzeilen, waehrend Quellenreife und Join-Deckel getrennte offene Fragen bleiben; Q1/Q2/Q5 gegen Archiv-Wiederherstellung neu formulieren und Altverlust nicht als behoben ausgeben. |
| `42c53378` | ROLLE: Isolierte Claude-Lane, Program Leichtgewicht; ein Kontext-/Nachfolge-Hinw | 3.9 | schaerfen | `git show 83989719`; server.ts#migrateMessage (14952), #tickMigrate (15034–15062); Kommentar 7d29f7c4 | Claude-Filter und richtiger MAIN-Nachfolgeweg sind gebaut, aber zurueckgekehrte Sends zaehlen unabhaengig vom Acceptance-Ergebnis und Erschoepfung bleibt Restarbeit; E2E-Flaeche und Laufzeitdelta konkretisieren. |
| `6067c240` | [QUEUE-INTELLIGENZ E5 · WORKTRAIL-ANALYSE LAUF 1, PERIODISCH: 14 Tage, Pflicht-A | 1.4 | schaerfen | Commit db8186f4; docs/messungen/2026-09-15-karten-schaerfer-lauf-1.md, Abschnitt 6067c240; Kommentar 23ffd95a | E2 ist gelandet und die Auswertung bleibt offen; den vorhandenen Ersatzkopf mit echtem Datum ernten und die zusaetzliche Pflichtanalyse wiederkehrender Hand-Abfragen im Umfang erhalten. |
| `8b2baf60` | [ROLLEN-SYNTHESE S2 · DELEGATION GEBRIEFT UND MESSBAR: Kopfzeilen DELEGATION/VER | 1.4 | schaerfen | card-extract.ts#FORMAT_KEYS (407); server.ts#buildLaneOutcome (21452); docs/messungen/2026-09-15-karten-schaerfer-lauf-1.md; Kommentar c1dd2271 | Parser-/Ledger-Arbeit fehlt, aber Vorganger fcc2f89c ist nicht belegt und der Kommentar fordert verbotene Template-Aenderungen; Kopf reparieren und den Template-Teil an S4 abgeben. |
| `fa07734f` | [ROLLEN-SYNTHESE S3-SCHATTEN · KLASSE ALS REGISTER, nur Schatten: .fleet/klassen | 1.4 | schaerfen | Snapshot-Kommentar 8fd57886; docs/messungen/2026-09-15-karten-schaerfer-lauf-1.md, Abschnitt fa07734f; card-extract.ts#FORMAT_KEYS | Die Owner-Fragen sind laut Kommentar entschieden, doch der gespeicherte Kopf ist ungueltig und S2 fehlt; Ersatzkopf ernten und genau 8b2baf60 als sachlichen Vorganger erhalten. |
| `d02fd2bd` | [FLEET-BETRIEB · BRIEF-GEGENLESE ALS MESSVERSUCH — ein starkes Modell liest mitt | 1.3 | startbereit | server.ts#summaryViaSession (13501–13503); docs/messungen/2026-09-12-spezifizierung-buendelung-befund.md:97–109; Snapshot d02fd2bd | Der neuere Owner-Auftrag ist ein begrenzter ausgeschalteter Gegenlese-Versuch mit Kontrollgruppe und Abbruchregel; nach Stilllegung des widersprechenden Refine-Rueckbaus kann die gehaltene gueltige Zeile freigegeben werden. |
| `8bc86e4b` | [DENKAUFTRAG · OWNER-ENTSCHEID-SCHICHT: welche Daten ueber Owner-Entscheidungen  | 1.3 | schaerfen | Snapshot cardGaps und Kommentar 03dbb158; docs/messungen/2026-09-14-rollen-briefe-synthese.md, Schnittlinie | Die Inventur samt 14-Tage-Fragen und Entwurf ist nicht als geliefert belegt; NEU und bestehende INDEX-Flaeche trennen, Datum setzen und die Quellen sicher als Lese- statt Schreibflaeche behandeln. |
| `e8a5baab` | [DELEGATION (Codex-Haelfte) · READ-ONLY-ERDUNGS-AGENT ALS GETRACKTE DATEI, UND A | 1.2 | schaerfen | docs/messungen/2026-09-15-karten-schaerfer-lauf-1.md, offene Grenzen e8a5baab; Snapshot cardGaps | Beide Ablagevarianten scheiterten im Vorlauf am ungetrackten Elternordner; zuerst den erlaubten Repo-Pfad festlegen, die vorgeschriebene echte Harness-Ladeprobe bleibt Teil der Arbeit. |
| `d3765352` | [ROLLEN-SYNTHESE S4 · ROLLENKARTEN VOLLSTAENDIG: RAIL_TAIL mit inbox + clarifica | 1.0 | doppelt mit 87ed77cf | Snapshot 87ed77cf, NEU-GEFILET; Vergleich DONE und Rollenkarte beider Texte; `git show a63b614a` | Die neue Zeile ersetzt diese ausdruecklich und bewahrt Rollenkarte sowie Done-Umfang bei korrigierter Abhaengigkeit; nur 87ed77cf behalten. |
| `fcff67db` | [FLEET-BETRIEB · CODEX-ROLLOUT-LESER: sessionMs, toolResultBytes, subagentCount, | 0.9 | schaerfen | server.ts#sessionStart (3477), #buildLaneOutcome (21452–21530); Snapshot cardGaps | Die gelesenen Outcome-Leser liefern noch keine Codex-Rollout-Metriken; den falschen LaneOutcome-Typanker und die alternative Testflaeche reparieren sowie Namensabgrenzung zu S2 erhalten. |
| `ffcfec48` | [FLEET-BETRIEB · SUITEN SCHREIBEN KEINE TRUST-EINTRAEGE MEHR IN ~/.codex/config. | 0.6 | schaerfen | server.ts#CODEX_HARNESS (1170); Snapshot ffcfec48; `git log HEAD --oneline --grep=b4477db3` ohne Treffer | Der Trust-Prelude schreibt weiter ins HOME und die Reparatur ist fachlich offen, aber der verlangte Vorganger b4477db3 ist mit diesen Quellen nicht als gelandet belegt; erst Abhaengigkeit aufloesen, dann lokale Vorher-/Nachher-Probe. |
| `4b02bd09` | [QUEUE-INTELLIGENZ E4 · KLEIN · ZWEI RESTE AUS DEM LAND VON 1ed2f6a0 (891c7d98): | 0.5 | schaerfen | server.ts#startVariantGroup (12440–12457), #releaseTaskForMain (9775–9788); Snapshot note | Teilstart und Gruppen-Deckelluecke bestehen im Code, doch der Export haelt die Zeile ausdruecklich hinter a1610fd7; dessen Land und den nur unter manual geltenden Release-Deckel vor Start festhalten. |
| `a0474870` | [FLEET-BETRIEB · KLEIN · REPORTS: DAS AUTO-ACCEPT NACH LAND BLEIBT NACH EINEM RO | 0.3 | startbereit | server.ts#acceptByLandReading (8724–8731) | Die Funktion blockiert an jedem roten Cover und liest weder Adjudikation noch spaeteren gruenen Nachfahren; der kleine Reparaturauftrag nennt genau diese Luecke und ihre Gegenproben. |
| `2b06e849` | [FLEET-BETRIEB · KLEIN · HELFER: DAS ERGEBNIS EINES AUDIT-SHARDS GEHT VERLOREN,  | 0.3 | startbereit | helper-daemon/daemon.ts#api (221–230), #report (678–701) | Der Ergebnis-POST hat im gelesenen Pfad keinen Retry; auf helper-daemon/daemon.ts konkretisieren und die 503-/4xx-Proben ausfuehren, Geraete-Update bleibt Folgeakt. |
| `87ed77cf` | [ROLLEN-SYNTHESE S4 · ROLLENKARTEN VOLLSTAENDIG: RAIL_TAIL mit inbox + clarifica | 0.1 | startbereit | server.ts#RAIL_TAIL (24928–24966); `git merge-base --is-ancestor a63b614a HEAD` → Exit 0; Snapshot NEU-GEFILET | Die Nachfolgegrundlage ist im Baum, der Rail nennt inbox/reply noch nicht und der neue Orchestrator-Bind-Brief fehlt in der Symbolsuche; dies ist der zu behaltende S4-Auftrag. |
| `84888f35` | [FLEET-BETRIEB · GROSS · WARTE-REGISTER: JEDES WARTEN MIT ADRESSAT ALS DATENSCHI | 0.1 | startbereit | docs/messungen/2026-09-15-warten-ohne-adressat.md; Commit 0ed37789; Snapshot 84888f35 | Die Lockerung wartender Kollisions-Claims ersetzt kein Warte-Register mit Adressaten; der Auftrag liefert die benoetigte Datenschicht und begrenzte Stau-Meldung mit Negativproben. |
| `eeacda0a` | [FLEET-BETRIEB · KLEIN · HOST-HYGIENE: EIN SIMULATOR OHNE GEHALTENEN LEASE WIRD  | 0.0 | startbereit | Snapshot eeacda0a, Auftrag/DONE/DO NOT; git ls-files nach simulator-hygiene und host-hygiene ohne Treffer | Die abgeschaltete Hygiene mit gehaltenem oder unbekanntem Lease als Sperre ist konkret begrenzt und im Baum nicht als geliefert belegt; ausschliesslich Stand-ins pruefen, Aktivierung bleibt ausserhalb des Schnitts. |
| `abd10a06` | [FLEET-BETRIEB · MITTEL · SECOND-HOST-SESSIONS: KANARIE DER AGENTEN-BRUECKE B1 MIT | 0.0 | startbereit | docs/messungen/2026-09-15-second-host-sessions-optionen.md §1,§3,nicht-gemessen; Snapshot abd10a06 | Die B1-Vorprobe lief ausdruecklich ohne Agent; die zwei begrenzten echten Agenten samt Abbruch-/Aufraeumkontrolle schliessen genau die noch offene Machbarkeitsfrage. |
| `b7fd9f83` | [FLEET-BETRIEB · KLEIN · KARTEN-LESER: EIN CLAUDE-WORKER IN EINEM NIE VERTRAUTEN | 0.0 | startbereit | server.ts#summaryViaSession (13520–13545), #paneReadiness (6253–6260) | Der Worker wartet auf den Prozess und pastet dann ohne Dialogkontrolle; der benannte schnelle Fehler samt blocked-Screen und normalem Composer als Gegenprobe ist ein enger startbarer Fix. |

## Zaehlung

**erledigt 0 · veraltet 3 · doppelt 1 · schaerfen 18 · startbereit 12 · Gesamt 34.**

Kein Gesamtauftrag wird aufgrund eines passenden Commit-Subjects als erledigt verkauft: C5 hat ausdruecklich offene Faelle; Steward-Idle ist nur ein Teil von Schnitt A; die Migrate-Reparatur laesst die Acceptance-/Erschoepfungsfrage offen. Der Doppelvergleich ergibt dieselbe Rollenkarte und dieselben fuenf Ziele; die neue Zeile ersetzt die alte NACH-Referenz und nennt d3765352 ausdruecklich als Vorlaeufer.

## Startbereit — empfohlene Reihenfolge

Die Reihenfolge priorisiert aktuelle Ausfaelle, dann Klarheit beim Arbeiten und zuletzt neue Faehigkeiten; sie ist kein paralleler Dispatch-Plan.

1. `b7fd9f83` — Beendet die stummen Karten-Worker-Ausfaelle, damit neue Auftraege verlaesslich entstehen.
2. `2b06e849` — Bewahrt teure Audit-Ergebnisse bei kurzen Serverausfaellen.
3. `a0474870` — Laesst durch spaetere Evidenz geklaerte Lands nicht dauerhaft als offene Reports liegen.
4. `84888f35` — Macht danach verbliebenes Warten samt zustaendigem Empfaenger sichtbar.
5. `87ed77cf` — Gibt der Orchestratorin den vollstaendigen Rollen- und Nachfolgebrief; d3765352 vorher als Dublette schliessen.
6. `9940ec64` — Macht einen widerspruechlichen Lane-Abschluss fuer die MAIN sichtbar.
7. `04f55eba` — Ergaenzt die vier offenen C5-Faelle als Beweisgrundlage fuer gemeinsame Sichten.
8. `e0c1ba07` — Erhaelt Dateivorschlaege schon beim MAIN-Filing, ohne sie zu bestaetigten Fakten zu machen.
9. `d02fd2bd` — Prueft nach Schliessen von 666d0b67 mit Kontrollgruppe, ob fachliche Gegenlese Nacharbeit senkt.
10. `ee47b0f8` — Schliesst die Modell-Ruecklese-Luecke nach den akuten Queue-/Report-Reparaturen.
11. `abd10a06` — Prueft B1 mit echten Agenten, bevor Remote-Produktcode beauftragt wird.
12. `eeacda0a` — Fuegt zuletzt die ausgeschaltete Simulator-Hygiene hinzu; ihre Aktivierung ist ein getrennter Akt.

## Ernte und offene Grenzen

- Alte Richtungen getrennt schliessen: df50b95b/666d0b67 betreffen Rueckbau, a05fa7ff eine heute anders zu orchestrierende Critic-Steuerung. f3ca2e05 bleibt als zu schaerfender Restauftrag erhalten: eine B1-Empfehlung und eine Kanarie erledigen nicht automatisch alle sechs Fragen des Cross-Host-Dispatchs.
- Kartenfehler aus dem Export sind nicht automatisch heutige Server-Blocker: der Vorlauf hat Ersatzkoepfe, und die Release-Policy unterscheidet sicherheitsrelevante Flaechen von Hinweisen. Trotzdem keine rote gespeicherte Karte still als bereits repariert zaehlen. 8b2baf60 → fa07734f bleibt eine fachliche Reihenfolge.
- a1610fd7, b4477db3 und fcc2f89c sind mit dem gelesenen Export/Commit-Suchfenster nicht als abgeschlossene Vorganger belegt. Eine erfolglose grep-Suche beweist kein fehlendes Land; die Orchestratorin kann den konkreten SHA oder Archivbeleg nachliefern.
- Archivierung schuetzt neue Terminalzeilen; sie rekonstruiert keine schon verlorenen historischen Quellen. Weder fleet.json noch .env, Prozess-Kommandozeilen, Roh-Ledger oder fremde Lane-Baeume wurden geoeffnet. Bestehende Notizen/Commit-Bodies sind fuer historische Messungen zitierte Quellen, keine hier wiederholten Live-Messungen.
- Ausschliesslich diese Notiz wird geaendert; INDEX-Ernte und Queue-Aktionen gehoeren der Orchestratorin. Einziger schreibender API-Akt dieses Auftrags ist der ausdruecklich verlangte Abschlussreport.

## Vollstaendigkeitsprobe

Diese lesende Probe prueft den Export gegen die Tabelle und die Startliste; ihre vier Negativkontrollen muessen scheitern. Sie beweist keine fachlichen Urteile.

```sh
python3 - <<'PY'
import collections, html, json, re
from pathlib import Path
source = Path('/Users/owner/claude-fleet-private/astra-inputs-2026-09-15/pending-auftraege.json')
rows = [r for r in json.loads(source.read_text()) if r['programId'] in
        {'f170dc46e4b026ee34d9392e', 'f9dc8e101bcc10c5e90b0eed'}]
md = Path('docs/messungen/2026-09-15-sichtung-wartende-auftraege.md').read_text()
def verify(md):
    lines = [line for line in md.splitlines() if re.match(r'^\| `[0-9a-f]{8}` \|', line)]
    parsed = [[html.unescape(c[1:-1]) for c in line.strip('|').split('|')] for line in lines]
    assert len(rows) == len(parsed) == 34
    assert all(len(c) == 6 for c in parsed)
    assert collections.Counter(c[0].strip('`') for c in parsed) == collections.Counter(r['id'] for r in rows)
    by_id = {r['id']: r for r in rows}
    counts = collections.Counter()
    ready = set()
    for ident, head, age, verdict, evidence, reason in parsed:
        r = by_id[ident.strip('`')]
        assert head == r['text'][:80].replace('\n', ' ')
        assert float(age) == r['ageDays'] and evidence and reason
        assert verdict in {'erledigt','veraltet','schaerfen','startbereit'} or re.fullmatch(r'doppelt mit [0-9a-f]{8}', verdict)
        key = 'doppelt' if verdict.startswith('doppelt') else verdict
        counts[key] += 1
        if verdict == 'startbereit': ready.add(r['id'])
    section = md.split('## Startbereit — empfohlene Reihenfolge')[1].split('## Ernte')[0]
    listed = re.findall(r'^\d+\. `([0-9a-f]{8})`', section, re.M)
    assert len(listed) == len(set(listed)) and set(listed) == ready
    for key in ['erledigt','veraltet','doppelt','schaerfen','startbereit']:
        assert f'{key} {counts[key]}' in md.split('## Zaehlung')[1].split('## Startbereit')[0]
    return counts
counts = verify(md)
rowline = next(line for line in md.splitlines() if line.startswith('| `ee47b0f8` |'))
for bad in [md.replace(rowline+'\n',''), md.replace(rowline,rowline+'\n'+rowline), md.replace('| `ee47b0f8` |','| `00000000` |'), md.replace(rowline,rowline.replace('[LEBENSZYKLUS','[XEBENSZYKLUS'))]:
    try: verify(bad)
    except AssertionError: pass
    else: raise AssertionError('negative control accepted')
print('PASS: 34/34 IDs genau einmal; Koepfe, Alter, sechs Spalten, Summen und Startliste stimmen')
print('PASS: fehlende, doppelte, fremde ID und veraenderter Kopf abgelehnt')
print(' · '.join(f'{k} {counts[k]}' for k in ['erledigt','veraltet','doppelt','schaerfen','startbereit']))
PY
```

Gemessene Ausgabe:

```text
PASS: 34/34 IDs genau einmal; Koepfe, Alter, sechs Spalten, Summen und Startliste stimmen
PASS: fehlende, doppelte, fremde ID und veraenderter Kopf abgelehnt
erledigt 0 · veraltet 3 · doppelt 1 · schaerfen 18 · startbereit 12
```

Probenkorrektur: Der erste Tabellenleser entfernte mit strip() auch ein originales Leerzeichen am Ende des 80-Zeichen-Kopfs; der finale Leser entfernt exakt die zwei Markdown-Abstandszeichen und besteht samt Negativkontrollen. Der erste Schreibversuch scheiterte vor Dateierzeugung an einem verschachtelten Heredoc mit gleichem Endmarker; der zweite verwendete einen eigenen Marker. Keine AGENTS.md-Aenderung, weil ausschliesslich diese Notiz autorisiert ist.

## Verifikation der Notiz

`bun install --frozen-lockfile` und `bun e2e/pins.ts`: Exit 0. Pins-Tail:

```text
PASS  land-log.ts prints one line per land and one direct-commit line per day — with no audit ledger every land says "audit ?", not a verdict  (   audit ? | l  audit ? |    audit ? |    audit ?)
PASS  land-log.ts prints one line per land and one direct-commit line per day — verify reads no gate, the skip exit and a waitedOut as skipped  (skipped,skipped,skipped,failed,proportional,ok)
PASS  land-log.ts#VERIFY_SKIP_EXIT is server.ts#VERIFY_SKIP_EXIT  (land-log says 42)

ALL PASS
```

Das Self-Gate wurde vor der Pruefung gelesen; ohne eigenen Commit lieferte es classifiedAs={} und die volle Fallback-Liste. Der Auftrag verlangt ausdruecklich die kurze Docs-Kette; die reine Notiz wird durch verify-proportion.ts#localProofFor als install/pins klassifiziert. Die Gate-Klassifikation wird nach dem Commit nochmals gelesen. Keine Produktsuite wurde als Beweis fuer die Triage ausgegeben.
