---
frage: Warum blieb der erste Private-repo-y-Lauf des Private-repo-ps (Program 07ee8a6d, 31.08.–03.09.) hinter dem Möglichen zurück (Owner-Urteil nach dem Video, 03.09.), und welche Fehler teilt er mit dem Private-repo-o-Lauf?
urteil: Fünf Wurzeln, keine davon „schwaches Bauen" — (1) im ganzen Rail gibt es keinen Akteur mit fremder Wahrnehmung, null Design-/Nutzungs-Vokabular in acht Bau-Briefs, der Review ist Vertrags-Abgleich, das Owner-Video war eine Test-Aufzeichnung; (2) das owner-bestätigte Program-JSON trägt drei strukturell unerfüllbare Erfolgsklauseln und friert „kein Provider" ein, sodass „Private-repo-y" ohne einen Modellaufruf gebaut und die Lücke als Messwert 0 umdefiniert wurde, ohne dass einer von 10 Attention-Rufen eine Produktfrage stellte; (3) Gates und Golden Cases messen das selbstdeklarierte Universum, der Probelauf ist ein Orakel-Echo, die MAIN akzeptierte einen Kommentar als Beweis; (4) 79 % der Wanduhr waren Warten (49,7 % bereinigt = Private-repo-o-Niveau), davon 26,9 h eine still gestorbene MAIN nach einem Land-Verdikt, das nur die Lane erreichte; (5) der Workflow ist kein Objekt (profile null, die Private-repo-o-Regeln landeten in einem Game-Maker-Abschnitt) und einen Weiterarbeits-Zug gibt es nicht. iOS-neu ist fast nichts; die Fehler waren bekannt, dokumentiert und unrepariert.
bereich: [private-repo-p, product-studio, workflow, verify, lane-lifecycle, program]
belege: [docs/messungen/private-repo-p-audit-2026-09-03/, docs/messungen/2026-08-30-game-maker-workflow-audit-synthese.md, docs/messungen/2026-08-27-meta-blindspot-audit.md, docs/ideen/2026-09-03-session-ledger-je-program.md]
nicht-gemessen: die App wurde von keinem Strang selbst bedient (Simulator-Lease, Hostlast); die Kosten der vier codex-Lanes (kein Sensor); ob die Hostlast von diesem Program oder fremden Sessions kam; die Innensicht von MAIN N0 nach 19:24.
stand: 2026-09-03
---

# Private-repo-p-Worktrail-Audit, Fall Private-repo-y — Synthese (2026-09-03)

Anlass, Owner wörtlich (2026-09-03): *„ich glaube vorgestern habe ich die 'Private-repo-y' App-Idee
in Auftrag gegeben. Eine iosApp session hat dann auch daran gearbeitet, und das ergebnis habe ich
dann später als video reviewed, es war nicht super super schlecht. Aber es war doch recht weit
unter dem was so möglich wäre wenn der Workflow und das alles besser angegangen worden wären."*
Verlangt: ein ausgelagerter Worktrail-Audit mit gestaffelten Opus-5-Agenten, ein kritisches
Durchdenken des Workflows, und der Vergleich mit dem Private-repo-o-Lauf („gleiche oder ähnliche
Fehler beim Erstellen des Workflows").

## Methode

Stufe 1: sechs unabhängige Opus-5-Stränge, nur lesend, gemeinsamer Kontext-Brief, je eigener
Quellenschnitt — A1 Prozess-Forensik (Ledger, Prompts, Attentions, Land-Notes), A2 die drei
MAIN-Transkripte (17,5 MB), A3a die sechs Bau-Lane-Transkripte (25 MB), A3b die vier Codex-Rollouts
(Reviews, Product-Card-Lane, MAIN N0), A4 Produkt-Forensik am Build samt 99 Videoframes, A5 der
Workflow-Vertrag auf Design-Ebene mit Wiederholungs-Matrix gegen Private-repo-o. Die sechs Reports
liegen wörtlich unter `docs/messungen/private-repo-p-audit-2026-09-03/`. Stufe 2 ist dieses Dokument:
die Stränge gegeneinander gelesen, acht tragende Behauptungen von mir selbst am Code und an den
Ledgern nachgeprüft (Liste am Ende), gerankt nach Folgekosten, mit Schnittlinie. Die Optimierung
steht getrennt in `docs/ideen/2026-09-03-private-repo-p-workflow-v2.md`.

## Was der Lauf geleistet hat (Vergleichsbasis, bevor kritisiert wird)

In 67,6 h Wanduhr (bereinigt um einen 26,9-h-Stillstand: 22,3 h) entstanden 9 Lands und eine
kompilierende SwiftUI-App mit fünf Screens: geschlossener WorkflowPack-1.0.0-Vertrag mit
732-Zeilen-Validator und 32 Negativ-Fixtures, 53 native Unit-, 59 Host-Package- und 5 UI-Tests
mit Accessibility-Audit in jedem Pfad, drei wörtliche Maschinen-Tails, ein Land-Gate, das den
Simulator selbst leaset und aufräumt. **15 039 Produktzeilen, 100 % aus Lanes**; die MAIN
committete direkt nur Doku und Beweis-Infrastruktur (A1 §2). Jede Lane fuhr das literale Gate
mindestens zweimal, zitierte den Tail wörtlich, benannte jede Abweichung; kein Suite-Log wurde in
einen Kontext geleitet (A3a). Die MAIN las vor jedem Land den Diff und fuhr das Gate 19-mal selbst
(A2). **Private-repo-o-Wurzel 1 in ihrer alten Form ist geschlossen:** zwei unabhängige
Cross-Model-Reviews (codex/gpt-5.6-sol) liefen wirklich, sagten beide FAIL, obwohl das Gate grün
war, und die MAIN bestätigte alle sechs Befunde am Code (A3b, A1 §7). Der Datenschutz-Pfad ist
ehrlich gebaut: `unknown` wird nirgends zu 0, Senden bleibt bis Freigabe und Hash-Gleichheit
gesperrt (A4). Die Briefe 1, 5, 7 und 9 gehören zu den schärfsten dieses Fleets (A5). **Die
Bauqualität ist nicht das Problem.**

## Wurzel 1 — Kein Akteur mit fremder Wahrnehmung, und die Produktseite fehlt im Rail

Der servergebaute Gründungsbrief der MAIN hat 105 Zeilen Landing-Pipeline (file → release →
wait → verify claim → land → watch → ack) und keine Zeile Produkt; Produktqualität hängt an einem
Nebensatz in `AGENTS.md:5` („Product quality, interaction, accessibility, and visual coherence are
part of the slice") (A2-1). Was der Vertrag nicht als Loop-Schritt führt, wird nicht zerlegt und
kommt nicht in den Brief: in allen acht Auftrags-Briefs kommen *visual, design, coherence,
layout, Bedienung, polish, critic, usability* **null Mal** vor (A2 §2, A3a-2, A5 §2a — von mir
gegengezählt: zwei Treffer, beide außerhalb der Bau-Briefs). Accessibility überlebte nur als
Test-API (`performAccessibilityAudit`) und wurde de facto das einzige UI-Gate: Trefferfläche,
Kontrast, Clipping — nicht Hierarchie, Typografie, Verständlichkeit (A3a-2). Der
„independent-codex-review" ist per Brief zehn Code-Invarianten aus derselben Card, die dieselbe
MAIN-Linie schrieb; beide Receipts führen **„owner usability"** wörtlich unter *Not verified*, und
kein Gate griff das auf (A3b-B1). Der Reviewer konnte Bilder sehen (`view_image` 2× in Brief 5,
zur Fehlerdiagnose) — der Brief bestellte es nicht. `scripts/review.sh`, das seit Private-repo-x genau
den Owner-Start der App liefert, wurde in keinem Brief und keiner Attention gerufen (A5 §2a).
Der einzige Nutzbarkeitsbeweis, Brief 8 (Computer-Use-Fahrt), war fertig entworfen und an „nach
ALL-PASS von Brief 7" gebunden; Brief 7 kam RED, also lief er nie (A2-2). Das Owner-Video war
eine Aufzeichnung der fünf XCUITests — jeder Frame ein Screen, den das Gate ohnehin behauptet, im
Maschinentempo, mit ~35 s Springboard und zwei Test-Runner-Kacheln ohne App-Icon davor (A2 §4,
A4-P5). Die MAIN las 13 Screenshots, keinen für ein Produkturteil (A2 §4).

**Kosten:** 22 h Produktentwicklung, jedes Produkturteil aus dem bauenden System; der Owner war
der erste fremde Blick — wie bei Private-repo-o, nur dass dort wenigstens ein Critic *vorgesehen*
war. Beim nächsten Lauf identisch, weil nichts im Rail einen Critic verlangt.

## Wurzel 2 — Das owner-bestätigte Program-JSON ist der Ursprung, und niemand meldete es zurück

Der `successCriterion` ist ein Konjunkt aus ~15 Bedingungen, von denen drei strukturell nie wahr
werden können (A2-4, A5 §2b): Token- und Kostenmessung „entscheidet, ob 2,99 Euro drei oder fünf
Vorhaben tragen", während `nonGoals` und `openQuestions` jeden Provider-Aufruf verbieten (→ Brief 4
„price decision undecidable"); „Post-Land-Audit grün" in einem Repo, in dem der Audit
konstruktionsbedingt 9/9 `unknown` ist; ein Computer-Use-Worker als Erfolgsbedingung, während
dieselbe Fähigkeit als offene Frage „vor Produktimplementation messen" dasteht (nie gemessen,
Briefe 1–7 liefen trotzdem). Die Product Card löste den ersten Widerspruch nicht auf, sondern
definierte ihn um: „ohne Modellaufruf `0`" wurde zur Messzeile (`docs/PRODUCT.md:227`), wanderte
als *Produktregel* in Brief 1, 2 und 4 und steht im Code als `StageMeasures.local → .measured(0)`
(A3b-B3). Über 24 Task-Zeilen, 117 Zustellungen und beide Receipts findet sich **keine** Stelle,
an der jemand „die App konsultiert nichts" als Problem benennt. Von 10 Attention-Rufen sind 10
Fleet-Mechanik (6 Hand-Dispatch-Bitten, 3 Budget/Hostlast/Audit, 1 Nachfolge) und **0** Produkt-
oder Vertragsfragen; Private-repo-o hatte 4:1 (A1 §4, A5 §2e). Ein erklärtes Stop-Tor der Card
(`bc9e7de`) verfiel geräuschlos (A5 §2c, K1).

**Was der Nutzer deshalb bekommt** (A4, von mir am Code bestätigt): die gesamte
Beratungs-Logik ist eine `if resultKind == .bindingDecision`-Zeile; sonst ist das Ergebnis die
Konkatenation der eigenen Eingaben (`OrientationResult.swift:118`, im Video wörtlich sichtbar).
Der Builder erzeugt für jede Eingabe dieselbe Schablone (2 Kriterien, 2 Validierungen, 2
Schritte, 5 Zustände). „Private-repo-y ohne Modell" war Programm-Vorgabe, kein Lieferfehler — der
Lieferfehler ist, dass die Beratungsleistung nicht durch *Wissen* (Fallmuster, Vorlagen,
Gegenfragen) ersetzt wurde, sondern durch Textformatierung, und dass das niemand zur
Owner-Entscheidung machte.

**Kosten:** die Diskrepanz zwischen Claim („Dein AI-Workflow, eingerichtet") und Erlebnis ist die
wahrscheinlichste Wurzel des Owner-Urteils. Ein Erfolgsmaß, das nie „erfüllt" sagen kann, hat
keinen Endpunkt: der Lauf endet, wenn der Owner hinsieht, nicht wenn er fertig ist.

## Wurzel 3 — Gates und Golden Cases messen das selbstdeklarierte Universum

Die vier verbindlichen ALL-PASS-Tails beweisen Vertragstreue gegen eine Card, die derselbe
Erzeuger schrieb; die Card sagt selbst, sie bewiesen keine Nutzbarkeit, und definiert dann für
den beobachteten Lauf kein Kriterium, keinen Beobachter, keine Bar (A5 §2d). Von fünf Golden
Cases existieren zwei als Pack-Fixture, handgeschrieben, die der Builder so nie erzeugt; das
Rechenwerk der Preisfrage, `GoldenCaseReport.build`, hat keine Aufrufstelle außerhalb einer
Testdatei (A3b-B2, A4 §4). Der „objektive Probelauf" schaltet auf `expectedOutcome.status` und
kann für Stop-/Eskalationsfälle nicht fehlschlagen — ein Orakel-Echo, das nur der fremde
Reviewer fand (A3b-B5, A4-P3, K7). Der als Gate zitierte Tail von `schema-negative.log` lautet
„Test run with 0 tests in 0 suites passed", weil die Briefe „die letzten drei Zeilen" bestellen
und die swift-testing-Zusammenfassung unter den 59 XCTest-Zeilen steht; alle sechs Lanes zitierten
ihn, eine bemerkte es (A3a-5). Der Reparatur-Brief 6 diktierte den Algorithmus („two constraints
of the same kind with different values" = Widerspruch) — sachlich falsch, `min 80` + `min 120`
ist erfüllbar; die Lane baute ihn buchstabengetreu, schrieb Fixture und Contract-Test aus der
eigenen Implementierung, das Gate wurde grün, und der Re-Review führt es als HIGH-Regress
(A3a-1, A3b-B4; `WorkflowPackValidator.swift:449-451` von mir gelesen: die Implementierung
widerspricht ihrem eigenen Doc-Kommentar drei Zeilen darüber). Die MAIN sah die Semantik vor dem
Land, deutete sie als Absicht, weil der Code-Kommentar es behauptete, und landete (A2-5).

**Kosten:** zwei Review-Runden, sechs Konformitätsbefunde, null Produktbefunde, zwei HIGH offen,
Brief 9 seit 03.09. 08:22 queued und nicht dispatcht; jede Qualitätszahl im Produkt („3/3", „7
davon wie erwartet") ist informationsfrei; die Preisentscheidung hat keine Grundlage.

## Wurzel 4 — 79 % der Wanduhr waren Warten; die Türen sind dieselben wie bei Private-repo-o

Zerlegung (A1 §1): Lane läuft 14,0 h (21 %), Warten ohne laufende Lane 53,5 h (79 %). Davon
**26,9 h**: der Repo-Verify zeigte auf `sh tools/verify.sh`, die Datei existiert nicht; das
Verdikt vom 31.08. 19:23 ging an die *Lane*, nicht an die MAIN; MAIN N0 stand danach ohne
Ereignis bis zur Neugründung am 01.09. 21:44 — im Audit-Log kein Eintrag dazwischen (von mir
geprüft). Dieselbe MAIN hatte davor schon 2,5 h untätig auf einen Report gewartet, bis der Owner
sie weckte (A3b-B6). Bereinigt bleiben **49,7 %** Wartezeit, praktisch der Private-repo-o-Wert:
Hand-Dispatch-Latenz 10,5 h über fünf Lücken (Dispatcher master-stopped, jede Lane ein
Attention-Ruf, Latenz 0,4 → 131 min mit der Controller-Last, zweimal ging die Task-ID verloren),
16 Land-Versuche für 9 Lands (44 % landeten nichts, drei davon Hostlast: zwei Timeouts, zwei
`xcodebuild 65` auf Bäumen, die ruhig grün waren → Budget 300 → 480 s global, drei Extra-Commits),
9/9 Post-Land-Audits `unknown` wie 11/11 bei Private-repo-o — jetzt teurer, weil das Helfer-Portal
das Repo viermal auf eine fremde Maschine bündelte für `exit 127`, plus zwei Steward-Tasks, 21 min
Hand-Gate der MAIN und drei *fremde* rote claude-fleet-Audits, die als Inhalt der letzten 16 h in
die iOS-MAIN-Pane fielen (A1 §5). 42 % dessen, was eine MAIN-Pane erreichte, war Maschinen-Echo
ohne Entscheidung; die Kontext-Pack-Auswahl lieferte 18/18-mal `selected: []` (A1 §6).

**Kosten:** ~37 h Wanduhr, sechs der zehn Attention-Rufe, drei MAIN-Nachfolgen (43 %/32 % ctx,
Hostlast-Stopp). V4–V6 des Private-repo-o-Audits hätten den Großteil gedeckt; nur V4 (selfLand ab
Gründung) war wirksam (A5 §4).

## Wurzel 5 — Der Workflow ist kein Objekt, und ein Weiterarbeits-Zug existiert nicht

Der iOS-Workflow besteht aus sieben Artefakten (Rail-Brief, Program-Record, AGENTS.md, Product
Card, PROOF/verify.sh, HANDOFF.md, Fleet-Regelbuch); `product-studio-working-circle.md` — Working
Circle, Anti-Slop, pre-owner-loop, sensory Critic — hat den Lauf mit **0** Treffern nirgends
berührt (A5 §1). `Program.profile` existiert, aber `ProgramProfileKind` kennt genau einen Wert,
`game-maker`, und alle drei iOS-Programs tragen `profile: null` (von mir geprüft,
`server/types.ts:1172-1174`). Die drei Private-repo-o-Regeln, die normativ wurden (V1–V3, `75b2110`),
landeten in §Game-Maker-Profil des Working-Circle-Docs — ein Abschnitt, den ein iOS-Program
konstruktionsbedingt nicht erbt (K2). Die Lineage führt nur MAIN-Autorität und beginnt erst bei
N1.5; die 24 Brieftexte sind für die MAIN nicht rücklesbar (K4/K8).

**CONTINUE — der Owner hat recht, es gibt ihn nicht** (A5 §3): Private-repo-x endete am 24.08. mit
dem eigenen HANDOFF-Satz „critic verdict and owner review … neither exists yet", wurde am 30.08.
15:27 zusammen mit vier anderen Programs administrativ `complete` gesetzt, ohne erfülltes
Kriterium und mit unbeantworteter Owner-Frage, und am 02.09. durch `30def00` ersetzt statt
fortgeführt. Übertragen wurde der Beweis-Apparat (verify.sh, Lease, Flake-Gegenmittel), nicht
Produktwissen, Nutzerurteil oder Geschmack — und HANDOFF.md wird bei jedem Programmwechsel
überschrieben. Eine zweite Private-repo-y-Iteration müsste als neues Program im selben Repo
gegründet werden und kollidierte an `Private-repo-x.xcodeproj`/`Package.swift` mit jeder
Parallel-App (die Private-repo-z-Kollision aus dem Portfolio-Plan). Die Lane-Memory unter
`~/.claude/projects/-Users-owner-private-repo-p/memory/` lädt in keiner Lane automatisch; 3713
kannte sie nicht und lief in genau die zwei Audit-Reds, die sie dokumentiert (A3a).

## Schnittlinie

Darunter gemessen, mit klarem Mechanismus, aber kleinerer Folgekost — für den Brief-Block, nicht
für die Workflow-Entscheidung:

- **Bild-Hygiene:** unverkleinerte Retina-PNGs sind 79 % der Tool-Bytes aller sechs Lanes (6,87
  von 8,71 MB; dfdb las ein Bild zweimal) und ~80 % der drei MAIN-Sessions (13 Reads, 5,2 MB);
  N1.5 verbrannte 606 kB/h und musste nach 5,4 h nachfolgen; der teuerste Block (1,75 MB) diente
  dazu, ein flakendes Contrast-Audit zu *entfernen* (A2-3, A3a-3). Kein `sips` in irgendeinem
  Transkript.
- **Brief-Umfang und Budget:** der 8-KB-Brief 3b war der einzige „Programm statt Schnitt"-Brief
  und erzeugte die teuerste Lane (118 min, davon 41 min reiner Gate-Kampf, Produktcode ≈ 8 min);
  das Gate-Budget wurde in der Lane unter Lane-Last gemessen und im Gate unter Gate-Last
  eingelöst (Faktor 1,8) (A3a-4, A1-5).
- **Erdungskurve:** Bytes bis zur ersten Schreibaktion 40 → 239 KB, weil jeder Brief „read in
  full" per Glob bestellt und `docs/PRODUCT.md` in allen sechs Lanes vollständig gelesen wird
  (A3a-6); Product-Card-Lane und MAIN N0 lasen je ~8 min `graphify/SKILL.md`, um festzustellen,
  dass es keinen Graphen gibt (A3b).
- **Produktoberfläche ohne Identität** (A4-P5, P1, P4): kein App-Icon, kein Display-Name,
  englischer Titel über deutschem Text, ASCII-Umlaute („Ankuendigung", „Pruefung") im gesamten
  sichtbaren Korpus, SHA-256 als Hauptinhalt des letzten Screens; der gespeicherte Workflow ist
  write-only (`LocalWorkflowStore.list/load` ohne Aufrufstelle in `App/`, von mir geprüft); der
  „erste reale Test" ist ein Knopf „bestanden".
- **Sensorik:** codex-Lanes haben `sessionMs`/`toolResultBytes` null; `ownerPrompts` sieht
  Codex-Pane-Eingaben nicht; die Land-Note trägt Fleet-Schrittnamen für private-repo-p-Lands (A1, A3a).
- tmux-Prefix-Bug `s1`/`s10` (100 min, leere Lane, am selben Abend gefixt); 22 % unbestätigte
  Owner-Sends; doppelte Verdikt-Zustellung.

## Private-repo-o ↔ iOS

| Maß | Private-repo-o (29./30.08.) | Private-repo-y (31.08.–03.09.) |
|---|---|---|
| Wanduhr / Wartezeit | 19 h 41 min / 52 % | 67,6 h / 79 % (bereinigt 22,3 h / 49,7 %) |
| Lanes gespawnt / gelandet | 12 / 11 | 10 / 9 |
| MAIN-Nachfolgen | 0 | 3 |
| Attention Fleet : Produkt | 4 : 1 | 10 : 0 |
| Post-Land-Audit `unknown` | 11/11 | 9/9 |
| Fremder Critic / Review | lief nie | 2× Code-Review, FAIL, 6 Befunde; kein Nutzungs-Critic |
| Owner hat das Produkt bedient | nein | nein (134-s-Testvideo) |
| Erster fremder Produktblick | der Owner, nach 19,7 h | der Owner, nach 22 h |

A5 §4 führt die 33-zeilige Wiederholungs-Matrix (Wurzeln 1–3, V1–V7, Lifecycle 1–8, K1–K11,
Blaupause S1–S4). Ergebnis: **iOS-neu ist fast nichts.** Besser wurden V4 (selfLand ab Gründung)
und Lifecycle 4 (Modell im Receipt); stärker wurde die unabhängige Review. Alles andere sind
bekannte, dokumentierte, am 01.09. 21:44 unreparierte Fehler — die Blaupause vom 30.08.
verlangte S1 (Briefprofil), S3 (Capture + Critic-Kit) und S4 vor dem nächsten Lauf; nichts davon
war gelandet, als der iOS-Lauf begann.

## Verifiziert / Abgeleitet / Nicht geprüft

**Von mir selbst geprüft (Stufe 2):** `LocalWorkflowStore.list/load` ohne Aufrufstelle in
`Private-repo-y/App/`; `areIncompatible` `WorkflowPackValidator.swift:449-451` gegen den
Doc-Kommentar; das Audit-Log zwischen 31.08. 19:23:26 und 01.09. 21:44:08 ist leer;
`ProgramProfileKind = "game-maker"` als einziger Wert und `profile: null` an allen drei
iOS-Programs; `OrientationRules.evaluate` (`OrientationResult.swift:108-126`); Design-/Critic-
Vokabular in `ios-tasks.md` (2 Treffer, keiner in einem Bau-Brief); die Briefe bestellen „die
letzten drei Zeilen" von `schema-negative.log`; fünf Programs tragen dieselbe `completedAt`-Minute
30.08. 15:27. Alle sechs Reports wurden auf Token-, Namens- und IP-Reste gescannt (leer).

**Von den Strängen verifiziert:** je Report am Ende, mit Fundstellen; die Byte-, Zeit- und
Prozentzahlen stammen aus Turn-Indizes über die Transkripte und aus den Ledger-Exporten.

**Abgeleitet:** die Kausalkette Rail-Vertrag → fehlende Brief-Zeile → fehlendes Kriterium → nie
geprüft (A2-1); dass MAIN N0 am Merge-Watch starb statt an Kontext oder Kill (A3b); dass ein
Vorlagen-Katalog in derselben Lane-Zeit machbar gewesen wäre (A4 §6); dass Screenshot-Bytes ≈
Kontextprozente sind (A2-3).

**Nicht geprüft:** die App wurde von niemandem selbst bedient; `make verify`/`review` wurden nicht
gefahren (Zahlen aus den Receipts); die Kosten der vier codex-Lanes; wer die Hostlast verursachte;
K6 und K11; die Innensicht von MAIN N0 nach 19:24; ob Brief 9 inzwischen gelandet ist.
