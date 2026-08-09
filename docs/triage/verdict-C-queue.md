# Verdikt C-queue — Queue-Mechanik, Register, Analyse/Brief/Refine

**Worker:** pi/gpt-5.6-sol  ·  **Baum:** 45902f9  ·  2026-08-09
**Werkzeug-Probe:** ast-grep lief (`ast-grep 0.45.1`)  ·  rg ja

## Übersicht
| Zeile | Verdikt | Konfidenz | Größe | Einzeiler |
|---|---|---|---|---|
| `391a6cab` | bauen | hoch | S | Re-analyse löscht bei abgeschaltetem Analysten weiterhin Urteil und Maschinenbrief ohne Wiederherstellungspfad. |
| `684a9d99` | bauen | mittel | M | Der unbeaufsichtigte Dispatch umgeht ohne Analyst alle drei Analyse-Gates; der Freigabeklick sagt das nicht. |
| `6d07877f` | unklar | mittel | M | Der Code bestätigt den einzigen `files`-Schreiber, aber Population, Registerwirkung und Herkunftsentscheidung sind lane-unsichtbar/offen. |
| `dabd1880` | streichen | mittel | M | Der gemessene Dauer-Sweep wurde wegen genau seiner Kosten bewusst abgeschaltet; am Baum läuft er nicht mehr. |
| `8235c4bc` | unklar | hoch | L | Die Wellen-Skizze hat weder belastbare Eingabedaten noch ein prüfbares Done-Kriterium. |
| `e17a19b0` | bauen | mittel | L | Bezeichner bleiben für Mensch und Agent uneinheitlich; die Akte löst heute nur Branches auf. |
| `65af341f` | unklar | hoch | M | Der Route fehlt die Rückrichtung, aber der Auftrag vermischt Code mit zwei Änderungen am lane-unsichtbaren Live-Register. |
| `c8e2ddd7` | unklar | hoch | L | Ein Owner-gewollter Gesamtentwurf ohne festes Zielbild ist noch kein baubarer Schnitt. |
| `ed4a318c` | unklar | hoch | L | Der klare Anzeige-Fix und der unentschiedene Umbau des 16er-Rasters sind noch immer in einer Zeile gebündelt. |
| `f5cf00dd` | bauen | hoch | M | Der Server kann benannte Worktrees bereits; nur Picker-Sichtbarkeit und Client-Weitergabe fehlen. |
| `55264c21` | bauen | hoch | S | Der Explorer bleibt tracked-only, während der vorhandene Dateibetrachter einen kleinen direkten Rulebook-Einstieg erlaubt. |

## Je Zeile

### `391a6cab` — bauen, Konfidenz hoch
- **Warum:** Die Prämisse hält am heutigen Baum: `reanalyse` löscht `analysis` und einen uneditierten `brief`, während der einzige Wiederhersteller im abgeschalteten Sweep liegt. Ein 409 bei `ANALYSIS_TICK_MS === 0` ist eng, reversibel und mit positiver Gegenprobe definiert.
- **Beleg:** `watchdog.sh:153`; `server.ts:3901`, `server.ts:3977-3978`, `server.ts:4013-4018`, `server.ts:4087-4094`, `server.ts:10181`, `server.ts:13878-13890`; `ec91075` dokumentiert die bewusste Abschaltung und die damalige Live-Messung.
- **Kosten, wenn nicht gebaut:** Ein Klick kann ein vorhandenes Urteil und einen Maschinenbrief dauerhaft löschen und trotzdem Erfolg melden.
- **Größe:** S (<1 h).
- **Was noch fehlt, bevor man es starten kann:** Nichts am Kriterium; die zwei Env-Gegenproben müssen in `e2e/tasks.ts` explizit getrennt werden.
- **Nicht geprüft:** Env des laufenden Servers und Live-Queue; geprüft wurden Code und `watchdog.sh` im Baum, nicht der aktuelle srv-Prozess.

### `684a9d99` — bauen, Konfidenz mittel
- **Warum:** Ohne Analyst überspringt `tickDispatch` den gesamten Analyse-/Stale-/Kollisionsblock und `briefAndSend` fällt auf Rohtext zurück. Der vorgeschlagene Weg (b), ein sichtbarer und maschinenlesbarer Fakt vor der Freigabe statt eines neuen Gates, ist ein sinnvoller, begrenzter Schnitt; die Oberfläche behauptet derzeit sogar pauschal, der Analyst lese und kompiliere vor der Freigabe.
- **Beleg:** `server.ts:3788-3813`, `server.ts:4261-4307`; `src/client.ts:6077-6090`, `src/client.ts:6256-6258`; `watchdog.sh:153`; `ec91075` begründet, warum der Analyst abgeschaltet wurde. `a00e127` löste nur den beaufsichtigten Roh-Start, nicht den unbeaufsichtigten Freigabeweg.
- **Kosten, wenn nicht gebaut:** Der nächste Freigabeklick kann eine ungelesene, unkollisionsgeprüfte Rohzeile unbeaufsichtigt starten, während die UI den gegenteiligen Ablauf verspricht.
- **Größe:** M (eine Lane).
- **Was noch fehlt, bevor man es starten kann:** Owner bestätigt Weg (b) und den Namen des Poll-Fakts; Done und Gegenprobe sind sonst ausreichend.
- **Nicht geprüft:** Ob `dispatch.on` im laufenden `fleet.json` heute noch true ist; braucht `fleet.json`, die eine Lane nicht sieht. Der srv-Prozess-Env wurde nicht geprüft.

### `6d07877f` — unklar, Konfidenz mittel
- **Warum:** Der strukturelle Engpass stimmt: `Task.files` ist optional und wird nur beim bestätigten Refine-Kind geschrieben. Ob der vorgeschlagene manuelle Schreiber heute nennenswert wäre und wie er eine vorhandene Herkunft ohne Wahrheitswert-Downgrade ersetzt, hängt jedoch an nicht sichtbarer Population und an einer Owner-Entscheidung zwischen (a)/(c).
- **Beleg:** `server.ts:1083-1094`, `server.ts:4051-4054`, `server.ts:13948-13954`; `86f99f1` dokumentiert Herkunft, Dreiwertigkeit und den damals einzigen Schreiber.
- **Größe:** M (eine Lane), falls Weg (a) samt Provenienz festgelegt wird.
- **Was noch fehlt, bevor man es starten kann:** Owner-Entscheid zu Schreibrecht, Überschreibregel und sichtbarer Herkunft; außerdem ein überprüfbarer Vertrag mit dem Register.
- **Nicht geprüft:** braucht `fleet.json` und `register.sh`, die eine Lane nicht sieht. Damit sind „0 von 198“, die heutige Spaltenwirkung und der geforderte Register-Lauf nicht nachgeprüft.

### `dabd1880` — streichen, Konfidenz mittel
- **Warum:** **Belegtyp (c), widerlegt:** Die Zeile beschreibt einen dauerhaft laufenden, nicht konvergierenden Sweep. Seit `ec91075` ist genau dieser Sweep wegen 445 Läufen in 48 Stunden bewusst deaktiviert; der heutige Spawn setzt 0 und der Timer wird dann nicht registriert. Die sinnvolle Restfrage „was gilt beim Freigeben ohne Analyst?“ trägt `684a9d99`, nicht diese Kapazitätsreparatur.
- **Beleg:** `ec91075`; `watchdog.sh:153`; `server.ts:3901`, `server.ts:3977-3978`, `server.ts:10179-10181`. Der Commit-Body nennt sowohl die gemessene globale Entwertung als auch die Owner-seitig aktivierte Abschaltung.
- **Größe:** M (würde eine Scheduler-/Prioritätsentscheidung betreffen).
- **Was noch fehlt, bevor man es starten kann:** Nur bei einer bewussten Wiederaktivierung wäre neu zu entscheiden, ob angeforderte Reads Priorität bekommen; das ist heute kein Bauauftrag.
- **Nicht geprüft:** Der laufende srv-Prozess kann vom Baum abweichen; sein Env wurde nicht gelesen. Deshalb nur mittlere, nicht hohe Konfidenz.

### `8235c4bc` — unklar, Konfidenz hoch
- **Warum:** Die Zeile nennt sich selbst „SKIZZE, UNGEPRÜFT“ und lässt Datenqualität, Stale-Semantik und UI-Form offen. Zudem besitzt `TaskAnalysis` kein `files`-Feld; deklarierte Pfade liegen auf `Task`, sind nur über Refine befüllt und der Analyst ist im Deployment-Baum aus.
- **Beleg:** `server.ts:1083-1094`, `server.ts:1152-1166`, `server.ts:3901`; `watchdog.sh:153`; `86f99f1` belegt die getrennten Flächen `Task.files`, Lane-Dateien und Analystenurteil; `ec91075` belegt die Abschaltung.
- **Größe:** L (mehrere Lanes / erst Entscheidung).
- **Was noch fehlt, bevor man es starten kann:** Harte Definition einer „Welle“, Umgang mit unbekannten/stalen Pfaden, gewünschte UI und ein Verify-Weg; außerdem zuerst Entscheidung und Datenfläche aus `6d07877f`.
- **Nicht geprüft:** braucht `fleet.json`, die eine Lane nicht sieht, um Vollständigkeit und Frische der heutigen Datenpopulation zu beurteilen.

### `e17a19b0` — bauen, Konfidenz mittel
- **Warum:** Der Owner-Bedarf ist konkret, und die vorhandene Akte ist nur der Präzedenzfall für `branch`, keine allgemeine Auflösung. Das dreiteilige DONE ist prüfbar, aber für eine erste Lane zu groß; der Owner-Kommentar liefert mit Hover/Task-Kurztitel einen sinnvollen ersten Schnitt.
- **Beleg:** Bestehender Spezialpfad: `server.ts:8105`, `server.ts:12696-12699`, `src/client.ts:7294`. Eine Suche nach `/api/resolve`, `/api/identify` und `resolve-token` in `server.ts`, `src/client.ts` und `e2e/` hatte am Baum keinen Treffer.
- **Kosten, wenn nicht gebaut:** Task-IDs, SHAs und andere gleichförmige Tokens bleiben erklärungsbedürftiger Klartext; Menschen raten, und Agenten brauchen je Token-Art einen anderen Suchweg.
- **Größe:** L (mehrere Lanes).
- **Was noch fehlt, bevor man es starten kann:** In zwei Scheiben schneiden: zuerst serverseitige Auflösung plus Hover für Task/Commit, danach Navigation und die übrigen Arten; Mehrdeutigkeit bleibt jeweils ein Ergebnis.
- **Nicht geprüft:** Die im Zeilentext genannten Live-Zählungen der Tokens, weil dafür `fleet.json` nötig wäre; braucht `fleet.json`, die eine Lane nicht sieht. Keine Browser-Sichtprüfung.

### `65af341f` — unklar, Konfidenz hoch
- **Warum:** Der Code bestätigt die Einbahnstraße: der Aktionsregex kennt nur `adopt`, und die einzige Kind-Mutation dort ist `note → lane`. Als Gesamtauftrag ist die Zeile aber nicht lane-abgeschlossen, weil DONE zusätzlich zwei konkrete Live-Zeilen mutiert.
- **Beleg:** `server.ts:14034`, `server.ts:14068-14080`; `src/client.ts:6014-6019`. Es gibt im heutigen Server keinen `t.kind = "note"`-Schreiber.
- **Größe:** M (eine Lane plus separater Owner-Akt).
- **Was noch fehlt, bevor man es starten kann:** In (1) Route+Client+Checks und (2) expliziten hostseitigen Register-Akt teilen; Semantik für `queued` sollte wie für `sent` festgelegt werden.
- **Nicht geprüft:** braucht `fleet.json`, die eine Lane nicht sieht. Daher sind Existenz und heutiger Zustand von `10ac2528` und `63626cdb` nicht verifiziert.

### `c8e2ddd7` — unklar, Konfidenz hoch
- **Warum:** Der Owner-Wunsch nach einer gründlichen Überarbeitung ist real, aber die Zeile delegiert ihr hartes DONE ausdrücklich an eine Clarify-Lane. Ein einzelner fehlender Audit-Knopf trägt den Gesamtentwurf nicht: das Board zeigt Adjudikationen inzwischen an, ruft die bestehende POST-Route aber weiter nicht auf.
- **Beleg:** Die heutige Queue-Fläche und ihre Poll-Invarianten liegen in `src/client.ts:5571-5620`, `src/client.ts:5762-6103`, `src/client.ts:6113-6188`; Audit-Adjudikationen werden nur dargestellt in `src/client.ts:7432-7438`, die Schreibroute existiert in `server.ts:12663-12679`. `c72fd14` hat seit Anlage weitere Audit-Live-Sicht in dieselbe Board-Fläche gebracht.
- **Größe:** L (mehrere Lanes / erst Entscheidung).
- **Was noch fehlt, bevor man es starten kann:** Owner-bestätigtes Zielbild je Pane, messbares Done und ein trennscharfer Darstellungs-Verify; danach neue Zeilenmessung am aktuellen Code statt der alten 424-Zeilen-Zahl.
- **Nicht geprüft:** Kein Browser, keine Screenshots und keine laufende Queue-Population; die Audit-Ledger sind lane-unsichtbar.

### `ed4a318c` — unklar, Konfidenz hoch
- **Warum:** Teil A ist weiterhin eine klare Verbesserung: aktive Lane-Zeilen zeigen die Slotnummer und ein beliebiges Label, der Branch steht nur im Tooltip. Teil B bleibt dagegen eine Owner-/Architekturentscheidung über das gemeinsame 16er-Raster; beide Teile in einer Zeile sind kein direkt dispatchbarer Schnitt.
- **Beleg:** `server.ts:34`, `server.ts:1266`; `src/client.ts:4742-4778`. Die frühere Voraussetzung „richtiger Stapel-Anker“ ist seit `53f5ce8` erledigt; dessen Body belegt die Wahl nach größtem `lastOutput` statt niedrigster Slot-ID.
- **Größe:** L (Teil A S/M, Teil B erst Clarify und wahrscheinlich mehrere Lanes).
- **Was noch fehlt, bevor man es starten kann:** Teil A als eigene Zeile mit Branch als sichtbarer/kopierbarer Identität; Teil B als reine Clarify-Zeile mit Owner-Entscheid zum Raster.
- **Nicht geprüft:** Kein Browser-Render und keine Live-Belegung der 16 Slots; die im Text genannte 7/4/5-Population wurde nicht nachgemessen.

### `f5cf00dd` — bauen, Konfidenz hoch
- **Warum:** Der Serverpfad ist vorhanden und validiert einen optionalen Branch; der Client sendet weiterhin hart `branch: ""` und versteckt den Knopf innerhalb eines Worktrees. Damit ist der Rest ein klarer Client-Schnitt mit bestehender serverseitiger Gegenprobe.
- **Beleg:** `src/client.ts:3804-3813`, `src/client.ts:4268-4278`; `server.ts:2476-2492`, `server.ts:14284-14305`. `01447be` bewegte die Picker-Fläche um Harness/Model/Effort, ließ aber Schnellpfad und leeren Branchnamen bewusst unverändert.
- **Kosten, wenn nicht gebaut:** Benannte Denk-/Scratch-Lanes erfordern weiter einen Umweg, und der vorhandene Knopf verschwindet genau dann, wenn der Owner bereits in einem Worktree steht.
- **Größe:** M (eine Lane).
- **Was noch fehlt, bevor man es starten kann:** Client-Done präzisieren: Feldwert, sichtbare Serverfehlermeldung und Ableitung des Repo-Toplevels im Worktree-Fall; kein neuer lane-loser Baumtyp.
- **Nicht geprüft:** Kein Browser und kein echter Worktree-Spawn; nur Client, Route, Validierung und Commit-Body gelesen.

### `55264c21` — bauen, Konfidenz hoch
- **Warum:** Der Explorer ist absichtlich ausschließlich `git ls-files`; eine gitignorierte `CLAUDE.md` kann dort strukturell nicht erscheinen. Die bestehende Identitätskarte und `showFileView` erlauben einen kleinen, klaren Einstieg ohne Tree-Aufweitung oder zweiten Editor.
- **Beleg:** `server.ts:13598-13616`; `src/client.ts:2112-2140`, `src/client.ts:2185-2259`, `src/client.ts:4070`. Der direkte Begriff „Rulebook“ kommt in der Client-Fläche nicht vor.
- **Kosten, wenn nicht gebaut:** Das zentrale lokale Steuerdokument bleibt trotz vorhandenem Viewer nur über indirekte Dateisuche auffindbar.
- **Größe:** S (<1 h).
- **Was noch fehlt, bevor man es starten kann:** Ein Fixture für vorhanden/fehlend und die genaue Platzierung in der Identitätskarte; die bestehende `/api/file`-Fehlerantwort soll wiederverwendet werden.
- **Nicht geprüft:** Keine Browser-Sichtprüfung. Eine lokale Spawn-Kopie von `CLAUDE.md` war wegen `AGENTS.md` lesbar, wurde aber nicht als Live-Rulebook oder Beleg für den laufenden Server behandelt.

## Kalibrierung
- Meine drei stärksten Aussagen: `391a6cab` (Löschpfad und ausgeschalteter einziger Wiederhersteller stehen direkt im Code), `f5cf00dd` (Serverfähigkeit vorhanden, Client sendet nachweislich leer), `c8e2ddd7` (die Zeile verweigert selbst ein hartes DONE und ist daher heute nicht dispatchbar).
- Meine schwächste Aussage (hier zuerst nachprüfen): `dabd1880` streichen — der Baum und `ec91075` sagen „Analyst aus“, aber ich habe den Env des laufenden srv-Prozesses nicht gemessen; bei abweichendem Live-Env muss das Verdikt auf `unklar` zurück.
- Was ich gemessen vs. nur gelesen habe: Gemessen wurden Werkzeugverfügbarkeit, HEAD/Datum sowie Text-/Historientreffer (`ast-grep --version`, `rg`, `git log`/`git show`/`git blame`). Gelesen wurden aktuelle Codebereiche, `watchdog.sh` und Commit-Bodies. Nicht gemessen wurden laufender Server-Env, HTTP-Routen, Browserdarstellung, Queue-Population, `fleet.json`, `register.sh` und Ledger; keine Suite wurde gefahren.

## Batch-Ebene
- Zusammenlegungen, die ich sehe: **Keine formale `zusammenlegen mit`-Beziehung.** `c8e2ddd7` ist nach einer Clarify-Lane die tragende Zeile für den visuellen Gesamtentwurf der Queue-Panes; sie darf die konkreten Semantiken aber nicht schlucken. Für `lane→note` bleibt `65af341f` tragend, für den Picker `f5cf00dd`, für die Rulebook-Auffindbarkeit `55264c21` und für Lane-Identität/Raster `ed4a318c`. Das sind Datei-/Gestaltungsüberschneidungen, keine gleiche Arbeit. `8235c4bc` hängt von `6d07877f` ab, ist aber keine Teilmenge davon. `dabd1880` ist nur die Wiederanschalt-Voraussetzung des in `684a9d99` verworfenen Wegs (c), nicht dieselbe Arbeit.
- Reihenfolge, falls eine Zeile eine andere voraussetzt: `391a6cab` vor weiterer Nutzung von Re-analyse; Owner-Entscheid zu `684a9d99` vor erneutem unbeaufsichtigtem Dispatch mit Analyst=0. `6d07877f` (oder eine andere belastbare Dateifläche) vor `8235c4bc`. `e17a19b0` serverseitig zuerst, sein Queue-Clientteil nach Klärung von `c8e2ddd7`. `ed4a318c` in A/B splitten; seine alte Stapel-Voraussetzung ist durch `53f5ce8` bereits erfüllt. `f5cf00dd` kann unabhängig gebaut werden.
- Was diesem Batch als GANZEM fehlt: Ein Owner-Entscheid, ob Analyse dauerhaft aus bleibt und welche Wahrheit dann Freigabe, Register und Kollisionssicht tragen. Außerdem fehlen für UI-Großarbeit ein aktuelles Zielbild und für registerabhängige Zeilen die hostseitige Auswertung von `fleet.json`/`register.sh`. Keine Zeile öffnet eines der in `docs/work-register-2026-08-06.md` §7 beerdigten Programme wieder; insbesondere ist die vorgeschlagene Warnung kein Wiederaufleben des Eval-Gates.
