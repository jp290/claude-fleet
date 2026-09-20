# Der Inbox-Nudge stirbt nach Enter; die gemeldeten 129 Zeichen sind nur die erste Bildschirmzeile

Gemessen 2026-09-11 von der Owner-MAIN, nach dem Deploy `43be29af` (Baum `512c1abb`).
Anlass: ein Beleg-Watcher, der pruefen sollte, ob K1 den Fehler beendet. Er hat ihn nicht beendet,
und das ist der richtige Ausgang — siehe §1.

**ENTSCHIEDEN 2026-09-14:** H1 (Eingabepuffer), Ursache terminales `$NAME` → Codex-Mention-Overlay
frisst Enter, Laenge irrelevant — vier Wegwerf-Panes in
`docs/messungen/2026-09-14-inbox-nudge-composer-h1-diskriminator.md`. §4, §6 (fuer codex) und §7
sind damit beantwortet; §6 fuer claude bleibt offen.

**Wer das hier liest, weil er die Zeile wieder aufnimmt: §3 zuerst.** Die bisherige Fassung des
Befundes benennt die falsche Ursache, und ein Fix entlang ihr waere Arbeit am Problem vorbei.

## 0 · DIE MELDUNG

    inboxNudgeSend — prompt not accepted — composer still holds 129 chars after 3000ms;
                     Fleet payload rollback cleared

Korrektur aus der von Program-MAIN an diese Lane gegebenen Messung `4d53b489`: **zwoelf**
Vorkommen zwischen 12:51:53 und 14:49:30, im Takt des Inbox-Nudge-Cooldowns.
Empfaenger in allen Faellen: **Slot 10, Program `f9dc8e10`, Harness codex.**

## 1 · ES IST KEIN K1-REGRESS — das ist bewiesen, nicht vermutet

Der Fehler kehrte **sechs Minuten nach dem Deploy** zurueck, also auf Code, der K1 (`2618dc50`,
bounded hold backoff) enthaelt. Das widerlegt K1 nicht, es **bestaetigt** die Abgrenzung, die zwei
Quellen vorher behauptet haben:

- der Arbeitsplan, Zeile `df55f6c2`: „K1 veraendert diese Mechanik ausdruecklich nicht"
- der Uebergabe-Commit `e2f4f345`: „der Owner-Fall SendNotAccepted bleibt offen und gehoert nicht zu K1"

Beides war bis hier eine Behauptung. Jetzt ist es gemessen. **Der Fehlerzaehler `errors` ist
per-Boot** (`errors.since` == Bootzeit) — leer nach einem Deploy beweist deshalb nie etwas, und
genau deshalb lief der Watcher.

## 2 · 129 IST KEINE PAYLOAD-LAENGE UND KEIN PRAEFIX

Die fruehere Fassung dieses Abschnitts rekonstruierte den Text mit der achtstelligen Anzeige-ID
des Programs. Die Program-MAIN hat dagegen den tatsaechlichen einzeiligen Text aus
`streams/prompts.jsonl` gelesen: **193 Zeichen / 195 Bytes**, zwoelfmal byte-identisch. Die
24-stellige gespeicherte Program-ID erklaert die Differenz von 16 Zeichen zur rekonstruierten
177-Zeichen-Fassung. Die geloggte Nutzlast wird hier nicht erneut aus einem Template nachgebaut.

**Nachgerechnet 2026-09-20** an derselben Quelle (`streams/prompts.jsonl`, `slot:10`,
`source:"auto"`): im Fenster 12:51:53.223 – 14:49:30.334 des 2026-09-11 stehen **genau 12** Zeilen,
alle **byte-identisch**, `len(text) == 193`, `len(text.encode()) == 195`. Die gespeicherte
Program-Id `f9dc8e10…` ist 24 Zeichen lang, die Anzeigeform 8 — die Differenz 24-8=16 ergibt die
fruehere 177 (193-16). Beide Zahlen dieses Abschnitts sind damit an der Quelle bestaetigt, nicht
aus einer Notiz uebernommen.

Vier belegte Punkte ersetzen die alte Praefix-Deutung:

1. `sendText` bildet die Fehlerzahl aus `awaitComposer` → `readComposer` → `composerResidue`.
   Fuer den Codex-Glyph-Composer liest `composerResidue` nur `raw[i]`, also die erste sichtbare
   Composerzeile (`composer.ts#composerResidue`). **129 ist ihre Umbruchbreite**, nicht die Menge
   Text im Eingabepuffer.
2. Der spaetere Rollback liest mit `readExactComposer` → `composerRows` die Glyph-Zeile und alle
   Fortsetzungszeilen. Das Verdikt `Fleet payload rollback cleared` ist nur hinter
   `composerHoldsExactly(read.rows, payload)` erreichbar. Damit standen beim Rollback alle
   **193 Zeichen** von Fleet und nichts Fremdes im gemessenen Composerbereich; nur die Diagnose
   untertrieb sie auf 129.
3. **Die Pane wurde vor dem Send gelesen.** Composer leer (Platzhalter sichtbar), Footer
   `gpt-6-astra medium · ~/claude-fleet · Main [default]`.
4. **Die naheliegende Gegenhypothese ist geprueft und widerlegt:** eine verrutschte
   Codex-Sub-Agent-Ansicht („Direct input is disabled") wuerde das Bild erklaeren — der Footer sagt
   `Main [default]`, sie liegt also nicht vor.

Damit gilt die stehende Regel unveraendert: Der Exact-Reader sah **Fleets volle eigene Nutzlast**,
keinen Owner-Entwurf. Aus der Zahl 129 allein ist keinerlei Textinhalt ableitbar.

## 3 · ES IST KEIN TIMEOUT — und das stoesst die bisherige Fassung um

`sendText` (`server.ts#sendText`) wirft **zwei verschiedene** `SendNotAccepted`, und der
Unterschied zwischen ihnen ist der ganze Befund:

| Meldung | Zeitpunkt | Bedeutung |
|---|---|---|
| `prompt not submitted — the composer still held only part of the N-char payload … no Enter was sent` | `awaitArrival` == `"partial"`, **VOR** Enter | Paste noch unterwegs, Enter wurde bewusst unterdrueckt |
| `prompt not accepted — composer still holds N chars after …` | `awaitComposer` **NACH** Enter, danach `rollbackOwnComposerPayload` | Enter ist gefeuert, der Composer leert sich nicht |

**Wir bekommen die zweite.** Also ist Enter zum Messzeitpunkt laengst gesendet. Der einzeilige
Sensor sieht danach 129 Zeichen; der unmittelbar folgende Exact-Reader sieht weiterhin die
vollstaendige 193-Zeichen-Nutzlast ueber alle Bildschirmzeilen. Die alte Behauptung, der Schwanz
sei verbraucht, ist damit widerlegt.

Die archivierte Zeile `3d6285f9` fuehrt den Fall als `ACCEPT_WAIT_MS`-Naht („fest, keine
Lastkopplung, keine zweite Lesung") — also als Zeitproblem. **Das kann nicht die Ursache sein:**
ein groesserer Wartewert verlaengert nur eine Beobachtung, die nach dem entscheidenden Ereignis
stattfindet. Wer die Zeile als Timeout-Tuning wieder aufnimmt, baut am Befund vorbei.

## 4 · WAS NICHT ESTABLISHED IST — und wie die naechste Probe aussehen muss

**Warum Codex Enter nicht als Submit annahm, ist offen.** Eine Laengenschwelle aus 60 / 120 / 130 /
177 Zeichen waere ein Artefakt des einzeiligen Sensors und ist als Probe verworfen.

Die verbleibende Trennung hat genau zwei Arme in einer Wegwerf-Codex-Pane: (i) den tatsaechlich
gelesenen 193-Zeichen-Text mit gleich langem Ersatz fuer `$FLEET_SELF_TOKEN`, und (ii) einen kurzen
Text mit terminalem `$FLEET_SELF_TOKEN`. Damit variiert je Arm nur Laenge oder terminales Dollar-
Token. Der 66-Zeichen-Erfolg unten trennt beides nicht, weil er zugleich kurz war und kein `$` trug.

**Trifft es nur codex?** Alle zwoelf Vorkommen liegen auf EINER codex-Pane. Gegenprobe am selben Tag:
ein Text von ueber 2 000 Zeichen an Slot 4 (claude, Opus 5) ging mit `acceptance: "observed"` durch.
Das stuetzt „codex-spezifisch" und schwaecht „reine Laengenschwelle" — aber es ist **eine**
Stichprobe je Seite und kein Beweis. Die Probe aus dem Absatz darueber muss beide Harnesses fahren.

## 5 · DIE BETRIEBLICHE HAELFTE, die schwerer wiegt als der Bug

Solange das offen ist, **erreicht der Inbox-Nudge den Empfaenger nicht**. Am Messtag hiess das
konkret: Program `f9dc8e10` hatte **fuenf ungelesene Eintraege** (attention-answer, zweimal
fleet-report, ambient-land, +1), seine MAIN wusste davon nichts, und ihr Kontextzaehler stand ueber
zwei Stunden auf exakt demselben Wert.

Die Klasse dahinter ist allgemeiner als dieser Bug: **ein fehlgeschlagener Nudge meldet sich nur im
per-Boot-Zaehler `errors`** — also an niemanden, der handeln koennte, und nach dem naechsten Deploy
auch dort nicht mehr. Ein Zustellkanal, dessen Scheitern nur in einen fluechtigen Zaehler faellt,
ist von „zugestellt" nicht unterscheidbar. Das gehoert getrennt von der Ursache behandelt.

## 6 · NACHTRAG 2026-09-11 18:0x — DIESELBE KLASSE AUF EINER CLAUDE-PANE, ANDERE URSACHE

Gemessen von der Owner-MAIN (Slot 8) an Slot 4 (claude, Opus 5, Program Fleet-Betrieb), waehrend
`§4`s Probe noch offen ist. Es ist KEIN Beleg fuer die Laengenschwelle und widerlegt §4 nicht —
es ist ein zweiter, unabhaengiger Weg, auf dem eine Nachricht zwischen Composer und Turn verschwindet.

**Beobachtung, Schritt fuer Schritt:**

1. Eine Owner-Nachricht (66 Zeichen, „ich hab eine advisory-zeile archiviert, file die beiden
   korrekturen") stand im Composer von Slot 4. Die Statuszeile sagte `✻ Cooked for 2m 31s · done
   5:31 PM` — die Session war idle, der Text lag **30 Minuten** ungesendet da.
2. `tmux -L claudefleet send-keys -t s4 Enter` → **kein Turn**, Text unveraendert im Composer.
3. `tmux -L claudefleet send-keys -t s4 C-m` → **kein Turn**, Text unveraendert im Composer.
4. Ein einzelnes Leerzeichen → der Text war **spurlos weg**, Composer leer, **kein Turn gestartet**,
   und im Transkript steht die Nachricht NICHT. Die Statuszeile blieb bei `done 5:31 PM`.
5. Dieselbe Nachricht Sekunden spaeter ueber `POST /send` → `acceptance: "observed"`, Turn laeuft.
   (`sendId 91bbcd50d16816777684c759`)

**Was das trennt — zwei Hypothesen, und die zweite ist die sparsamere:**

- (H1) Enter feuert, der Turn wird verworfen. Dann muesste Schritt 4 erklaert werden, in dem gar
  keine Taste mit Submit-Bedeutung kam.
- (H2) **Der gemalte Composer-Inhalt war nicht der Eingabepuffer.** Der Text war Bildschirm-Rest;
  der Puffer war leer, weshalb Enter (Schritt 2+3) korrekt nichts tat — Claude Code sendet keinen
  leeren Prompt — und das Leerzeichen einen Repaint ausloeste, der den Rest wegraeumte.

**Warum H2 fuer §0 relevant ist, auch wenn dort codex laeuft:** `awaitComposer` liest die Pane,
also **denselben gemalten Zustand**. Ist das Malen vom Puffer trennbar, dann ist „composer still
holds N chars" keine Aussage ueber den Puffer, sondern ueber den Bildschirm — und ein Fix, der auf
„der Composer haelt noch Text" aufbaut, baut auf einen Sensor, dessen Bedeutung ungeklaert ist.

**UNGEPRUEFT, ausdruecklich:** welche der beiden Hypothesen gilt. Der Diskriminator ist billig und
gehoert in dieselbe WEGWERF-Pane wie die Probe aus §4: Text hineinmalen lassen, dann OHNE weitere
Eingabe `capture-pane` gegen den tatsaechlich eingereichten Prompt halten — und pruefen, ob ein
`send-keys Enter` auf einen NACHWEISLICH gefuellten Puffer einen Turn ausloest. Nie an einer
lebenden Pane.

**Betrieblich, und unabhaengig von der Ursache:** `POST /send` ist der einzige Weg mit Quittung.
Ein `tmux send-keys` von Hand hat keine Acceptance-Probe, kein Journal und keinen Receipt — es hat
hier 66 Zeichen Owner-Text vernichtet, und ohne die Kenntnis des Wortlauts waere die Nachricht
verloren gewesen. Regel daraus: **eine fremde Pane wird nie per `send-keys` angesprochen**, auch
nicht „nur fuer ein Enter".

## 7 · PHASE-1-URSACHENPROBE 2026-09-12 — VOR DEM PAYLOAD AN DER IDENTITAET GESTOPPT

Diese Lane startete fuenfmal den vorhandenen Real-TUI-Weg aus `acceptance-probe.sh` in einer selbst
erzeugten Instanz. Der letzte Lauf war isoliert als Socket `fleetcomposerphase161661`, Port `26061`
und State
`~/.local/state/claude-fleet/probe-1e1dcd50-phase1-20260912/fleet-composer-phase1-instance-61661`;
installiert war `codex-cli 0.153.4`. Der Wrapper beendet in seinem Trap exakt diesen tmux-Server.
Nach dem Lauf waren weder ein solcher Prozess noch ein solcher Socket vorhanden.

Reproduzierbarer Aufruf:

```sh
/Users/owner/.local/state/claude-fleet/probe-1e1dcd50-phase1-20260912/run.sh
```

Die Sonde nutzte `e2e/harness.ts#tmuxOut`, zustandsgepollte Plain-Captures fuer Readiness und
`capture-pane -p -e` plus `composerRows` fuer den exakten Composer. Drei Probeaufbaufehler wurden
vor jeder Eingabe als solche abgewiesen: fehlende gebundene Session-ID, Update-Menue/Readiness und
ein Raw-SGR-Capture, auf das faelschlich die Plain-Header-Regel angewandt war. Der korrigierte
fuenfte Lauf bewies lebenden Codex, Header und settled Modell, fand danach aber ueber
`GET /api/slots/2/codex-candidates` **null** neue, diesem Pane-Leben eindeutig zuordenbare Rollouts:

```text
Error: slot 2 has 0 new Codex candidates, expected exactly one
```

Das ist die fehlende Faehigkeit genau benannt: Vor dem ersten Prompt lieferte der Adapter keinen
eindeutig bindbaren Transcript-Kandidaten. Ob noch keine Rollout-Datei bestand oder die vorhandene
Candidate-Selektion sie nicht diesem Pane-Leben zuordnen konnte, wurde nicht beobachtet und bleibt
`unknown`. Die verlangte Reihenfolge „Session/Transcript-Identitaet beweisen, dann Enter testen"
war damit in dieser Sonde zirkulaer. Die danach geplante Leer-Composer-Pruefung wurde nicht mehr
erreicht. Nach fuenf Probeaufbau-Laeufen wurde der Retry-Deckel eingehalten und keine sechste Pane
gestartet.

**Kein Runtime-Ergebnis:** In allen fuenf Laeufen scheiterte eine Vorbedingung, bevor
`POST /send {submit:false}` erreicht wurde. Deshalb gibt es hier absichtlich keinen angeblich
„tatsaechlich geloggten Sendtext", keine Payload-Laenge, keinen angenommenen Prompt und keine
Gegenprobe. H1, H2 und der vermutete dritte Mechanismus „terminales `$` oeffnet Codex' Mention-
Overlay und dessen Enter wird nicht zum Submit" bleiben durch diese Lane **unknown**. Die
Fixture-Kommentare in `acceptance-probe.ts` sind kein Runtime-Beleg.

Der genannte Fix-Hash `1e1dcd50` war in diesem Checkout kein aufloesbares Git-Objekt; seine Diff
wurde daher nicht behauptet. Fuer den aktuellen Baum ist nur der deterministische Pin belegt:
`bun e2e/pins.ts` endet `ALL PASS` und sagt, dass keiner der 13 abgeleiteten Fleet-Hint-Builder auf
einem `$NAME`-Token endet, die alte Schlussform als Gegenfixture erkannt wird und die konkrete alte
Fehlerschlussform aus beiden Hint-Universen verschwunden ist. Das stuetzt den beabsichtigten Fix,
ersetzt aber keinen ausgefuehrten Codex-Turn.

**Ein kleinster Produktfix zur einzig verifizierten Produktluecke:** In `server.ts#sendText` darf
die Post-Enter-Diagnose ihre Laenge nicht mehr aus `awaitComposer`/`composerResidue` bilden. Sie
soll einen frischen `readExactComposer` verwenden und bei `kind:"rows"` die sichtbaren
Fortsetzungszeilen beziehungsweise den bekannten Payloadvergleich melden. Der deterministische
Test gehoert in `e2e/watch.ts` neben die vorhandenen ACP-26-Frames: ein umbrechender Codex-Frame
muss 193 Payload-Zeichen statt 129 Zeichen erster Zeile diagnostizieren. Das macht die Zustellung
nicht heil und behauptet keinen H1/H2-Entscheid; es verhindert aber, dass der Sensor erneut eine
falsche Laengenursache verschreibt.

**Offene Grenze fuer Phase 2:** Die echte Ursachenprobe braucht einen Zwei-Stufen-Join: den leeren
Composer ohne Transcript-Pin beweisen und den Prompt in der isolierten Pane senden, danach genau
den dadurch neu entstandenen Rollout anhand Spawn-Fenster, cwd und exaktem Prompt binden und erst
dann die Vorher-/Nachher-Frames auswerten. Diese
Scope-Erweiterung wurde nach dem Retry-Deckel nicht automatisch ausgefuehrt. Die Program-MAIN soll
die Korrekturen aus Notiz `4d53b489` sowie diesen Probeaufbau-Befund in Task `4d53b489` aufnehmen;
der Zustellungsfix selbst und Originalphasen 2/3 bleiben offen.
