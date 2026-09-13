## Prompt 1 — Astra-Orchestrierung

```text
KONTEXT
Recherchiere zum Stand 14.09.2026, wie Astra unsere Spieleentwicklung wirksam orchestrieren kann.
Unser Setup laut internem Plan: Codex CLI, Modellkennung gpt-6-astra, native Sub-Agent-Threads.
Prüfe öffentlich belegbare Modell-/Harness-Fähigkeiten; kennzeichne fehlende Astra-Belege.
Claude Fleet startet Agenten in isolierten Git-Worktrees; eine Program-MAIN koordiniert
begrenzte Aufträge an Lanes. Deren Commits gelangen über ein serverseitiges Gate nach main.
Scope, Promotion und Geschmack entscheidet der Owner; technische Gates prüfen den Baum.
Der Owner beginnt das Spiel komplett neu: neues Repo, alter Code höchstens Steinbruch,
Technik-Stack offen. Spielidee laut Owner: Browser-RTS im Look 1999–2003 (RCT2 + AoE2),
Biber-Kolonien, Wasser als Belagerungskunst.
Bau und Prüfung: headless Linux, 16 Kerne, laut Auftrag 8 GB RAM; ältere Messung nennt 7 GB.
Plane konservativ mit diesem Speicherbudget. Headless-Chromium rendert Canvas 2D und
WebGL2; WebGL läuft per Software-Renderer SwiftShader. Ein Mensch nutzt einen anderen Browser-Rechner.
Historische interne Audits, keine kontrollierten Astra-Vergleiche:
- Private-repo-j/Private-repo-j: Wasser-Demo ohne Gegner, Ökonomie und Siegzustand; weitere Messungen
  trotz kaum sichtbarer Dammwirkung. Audit I (26.08.) fand Selbstbehauptungen im Proof;
  Audit II (27.08.) belegt Reparaturen, aber weiter historische Proofs und fehlenden Produktstopp.
- Private-Repo-C (Audit II): erster Anlauf nutzte native Claude-Subagenten, zweiter baute selbst;
  hoher Prozessanteil, Reparaturläufe und unvollständige Trennung der Anläufe im Ledger.
  Daraus folgt keine gemessene Überlegenheit einer Delegationsform.
- Private-repo-f (Audit 19.08.): Gate 1 blieb nach fünf Critic-Runden offen; Reparaturen an
  Browserstart, Lesbarkeitstests und einem falsch gefassten Brief verbrauchten Arbeit.
- Private-repo-p (Synthese 03.09., übertragbarer Fall): MAIN akzeptierte einen Kommentar als
  Beweis; unabhängige Produktwahrnehmung fehlte. Übergaben müssen solche Claims prüfen.
Owner-Stand 13.09.: Er hat die Spiele nicht gespielt; ältere Proben-/Demo-Rückmeldungen
sind keine Abnahme der fertigen Spiele. Der jüngste Workflow ist in seiner Wirkung unbelegt.
Unsere Rollen-Synthese schlägt zunächst gebriefte, nur lesende Subagents vor; schreibende
Delegation und Ausführungsklassen sind offene Entwurfsfragen, keine erprobte Vorgabe.

FRAGEN
1. Welche belegten Instruktionen und Harness-Einstellungen bringen Astra dazu, geeignete
   Teilaufträge selbst zu formulieren und zu delegieren? Wann ist eigenes Arbeiten sinnvoll?
2. Wann native Sub-Agent-Threads, wann getrennte Sessions mit eigenen Worktrees?
   Vergleiche Kontextübernahme, Schreibisolation, unabhängige Kritik, Kosten und Integration.
3. Wie prüft MAIN Subagent-Ergebnisse und Handoffs: tatsächlichen Diff, Revision, Testausgabe,
   ausgelassene Pflichten und nicht zugestellte Resultate? Welche typischen Fehler sind belegt?
4. Welche kurze Brief-Form wirkt nachweislich? Zeige einen direkt nutzbaren Beispielbrief
   mit Ziel, Quellen, Befugnissen, Schreibfläche, Abschlussbeweis, Rückgabe und Stop-Grenze.
5. Wie testen wir das in einem kleinen Vergleich, ohne Delegationszahl als Erfolg zu werten?
   Miss Zeit bis spielbarer Änderung, Nacharbeit und Prüfaufwand des Empfängers.

AUSGABE-REGELN
Antworte Deutsch, entlang der Fragen. Jede tragende Aussage erhält Quelle mit direktem Link,
Publikations-/Updatedatum und Modell-/Harness-Version, soweit bekannt; fehlende Angaben markieren.
Trenne ausdrücklich: belegt / Erfahrungsbericht / Meinung. Kennzeichne Übertragung auf Astra.
Priorisiere Primärquellen und reproduzierbare Fälle; widersprechende Belege und Lücken nennen.
Gib insgesamt höchstens 3 Empfehlungen, jede mit messbarem Erfolgskriterium, Zeitbudget
und Abbruchkriterium für unseren Pilot. Unbelegte Prompt-Wirkung als Hypothese behandeln.

NICHT
Keine erfundenen Quellen, Fähigkeiten oder Benchmarks; keine pauschale Delegationspflicht.
Keine neue Fleet-Architektur oder verbindliche Rollenordnung; keine Nachfrage nach privaten Daten.
Keine Tool-Ergebnisse als selbstprüfende Wahrheit und keine Prozessmenge als Produktqualität.
```
Quellen im Repo: `docs/plan-fleet-betrieb-2026-09-13.md` §5d; `AGENTS.md`; `server.ts`; `docs/messungen/2026-08-26-private-repo-j-worktrail-audit.md`; `docs/messungen/2026-08-27-private-repo-j-worktrail-audit-II.md`; `docs/worktrail-audit-II/private-repo-c.md`; `docs/worktrail-audit-II/private-repo-f.md`; `docs/messungen/2026-09-03-private-repo-p-worktrail-audit-synthese.md`; `docs/game-maker/README.md`; `docs/messungen/2026-09-14-rollen-briefe-synthese.md`; `docs/messungen/2026-09-11-host-aufteilung-entscheid.md`. Spielidee und RAM-Nennwert: Owner-Auftrag 13.09.2026.

## Prompt 2 — Astra Game-Development

```text
KONTEXT
Recherchiere zum Stand 14.09.2026 die etabliertesten Wege, mit Coding-Agenten Spiele zu bauen,
und prüfe ihre Eignung für Astra in unserer konkreten Lage.
Unser Setup laut internem Plan: Codex CLI, Modellkennung gpt-6-astra, native Sub-Agent-Threads.
Claude Fleet startet isolierte Git-Worktree-Lanes; eine Program-MAIN koordiniert Aufträge,
liest Resultate und integriert über ein serverseitiges Gate. Der Owner entscheidet Promotion
und Geschmack. Öffentliche Belege für Astra selbst bitte prüfen; Übertragungen kennzeichnen.
Neustart laut Owner 13.09.: komplett neues Spiel in neuem Repo, alter Code höchstens
Steinbruch; Technik-Stack offen. Kein Auftrag, die bisherige Engine weiterzuführen.
Spielidee laut Owner: Browser-RTS im Look 1999–2003 (RCT2 + AoE2), Biber-Kolonien,
Wasser als Belagerungskunst. Suche einen kleinen spielbaren Kern für dieses Versprechen.
Bau und Prüfung laufen auf headless Linux mit 16 Kernen, laut Auftrag 8 GB RAM;
eine ältere Messung nennt 7 GB. Plane konservativ mit diesem Speicherbudget.
Headless-Chromium: Canvas 2D und WebGL2 funktionieren; WebGL per Software-Renderer SwiftShader.
Ein Mensch sieht und bedient das Spiel im Browser eines anderen Geräts.
Historische interne Auditbefunde; ihre Übertragbarkeit auf Astra ist offen:
- Private-repo-j/Private-repo-j: Wasser-Demo ohne Gegner, Ökonomie oder Siegzustand; Dammwirkung
  kaum sichtbar, danach weitere Mess-/Dokumentationsrunden statt eines RTS-Kernloops.
  Audit I (26.08.) fand Proof-Selbstbehauptungen; Audit II (27.08.) bestätigt Reparaturen,
  aber historisch gebundene Prädikate belegten weiterhin keinen aktuellen spielbaren RTS-Kern.
- Private-Repo-C: Prozessarbeit überwog nach Audit-Klassifikation; Subagent- und Selbstbau-Anlauf
  sind kein kontrollierter Vergleich. Private-repo-f: Gate 1 nach fünf Critic-Runden noch offen,
  darunter Reparaturen am Browserstart, an Lesbarkeitstests und an der Brief-Präzision.
- Private-repo-p (03.09.): Vertragsprüfungen und Testvideo lieferten keinen unabhängigen
  Produktblick; ein Kommentar wurde als Beweis akzeptiert. Das ist ein übertragbarer Warnfall.
Owner-Stand 13.09.: Er hat die Spiele nicht gespielt; frühere Demo-/Proben-Rückmeldungen
belegen keine Abnahme fertiger Spiele. Wirkung des jüngsten Studio-Workflows bleibt unbelegt.
Bestehender Fleet-Vertrag: Preflight mit Architect und frischer unabhängiger Review;
sensorischer Critic erst nach realem Spielinput, mit Build-/Capture-Paket ohne Builder-Rationale.
Neue Rollen-/Klassenentwürfe sind Vorschläge. Wir suchen Belege vor einer Strukturentscheidung.

FRAGEN
1. Welche Wege sind 2026 tatsächlich etabliert: spielbarer Prototyp zuerst, Vertical Slice,
   kurze Playtest-/Reparaturschleifen, Screenshots? Belege sie mit konkreten Agenten-Spielprojekten
   und nenne einen passenden ersten Slice mit Spielerentscheidung, Gegnerwirkung und Ende.
2. Wie kann ein Agent Spielspaß und Aussehen beurteilen, wenn kein Mensch jede Runde spielt?
   Trenne automatisierte Spielbarkeit, visuelle Lesbarkeit und subjektiven Spaß. Was leisten
   echte Eingaben, Replays, Screenshots/Video und blinde Critics; wo bleibt menschliches Urteil nötig?
3. Welche minimale Studio-/Rollen-/Aktstruktur hat sich bewährt? Was sollte dieselbe Session
   bauen, spielen und reparieren, was braucht unabhängige Prüfung oder eine isolierte Lane?
   Nenne Fallen wie Endloskritik, vorweggenommene Geschmacksgates und verlorene Übergabepflichten.
4. Vergleiche geeignete Engines/Frameworks für dieses Browser-RTS: Rendering, Agenten-Editierbarkeit,
   Headless-Tests, Software-WebGL-Kosten, Assets, reproduzierbarer Build und deterministische Simulation.
   Unterscheide Seed-/Tick-Replay im selben Runtime-Pfad von plattformübergreifendem Determinismus.
   Welche kleine Probe entscheidet den Stack, und welche Leistung muss am Spielergerät gemessen werden?

AUSGABE-REGELN
Antworte Deutsch, entlang der Fragen; kompakte Vergleichstabelle für die Stack-Kandidaten.
Jede tragende Aussage: direkter Quellenlink, Publikations-/Updatedatum, relevante Version;
fehlende Angaben markieren. Primärquellen und reproduzierbare Spielprojekte priorisieren.
Trenne ausdrücklich: belegt / Erfahrungsbericht / Meinung; Astra-Übertragungen markieren.
Gib insgesamt höchstens 3 Empfehlungen mit messbarem Erfolgskriterium, Zeitbudget und
Abbruchkriterium; zeige bei Spaß-Proxys ihre Grenze. Beleglücken und Gegenbeispiele nennen.

NICHT
Keine erfundenen Quellen oder Astra-Erfolgsgeschichten; keinen alten Stack voraussetzen.
Keine technische Grünmeldung als Spaßbeweis, keine Screenshots als Beweis tatsächlich gespielter Partien.
Kein ausführliches Studio-Regelwerk, keine privaten Daten erfragen, keine Umsetzung beginnen.
```
Quellen im Repo: `docs/plan-fleet-betrieb-2026-09-13.md` §5d; `AGENTS.md`; `docs/messungen/2026-08-26-private-repo-j-worktrail-audit.md`; `docs/messungen/2026-08-27-private-repo-j-worktrail-audit-II.md`; `docs/worktrail-audit-II/private-repo-c.md`; `docs/worktrail-audit-II/private-repo-f.md`; `docs/messungen/2026-09-03-private-repo-p-worktrail-audit-synthese.md`; `docs/game-maker/README.md`; `docs/messungen/2026-09-14-rollen-briefe-synthese.md`; `docs/messungen/2026-09-11-host-aufteilung-entscheid.md`. Spielidee und RAM-Nennwert: Owner-Auftrag 13.09.2026.
