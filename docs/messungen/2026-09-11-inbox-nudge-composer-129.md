# Der Inbox-Nudge stirbt an einem Composer, der 129 Zeichen haelt — und es ist weder ein Timeout noch ein fremder Rest

Gemessen 2026-09-11 von der Owner-MAIN, nach dem Deploy `43be29af` (Baum `512c1abb`).
Anlass: ein Beleg-Watcher, der pruefen sollte, ob K1 den Fehler beendet. Er hat ihn nicht beendet,
und das ist der richtige Ausgang — siehe §1.

**Wer das hier liest, weil er die Zeile wieder aufnimmt: §3 zuerst.** Die bisherige Fassung des
Befundes benennt die falsche Ursache, und ein Fix entlang ihr waere Arbeit am Problem vorbei.

## 0 · DIE MELDUNG

    inboxNudgeSend — prompt not accepted — composer still holds 129 chars after 3000ms;
                     Fleet payload rollback cleared

Neun Vorkommen zwischen 12:06 und 14:08, dann weitere ab 14:27 auf dem neuen Baum.
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

## 2 · ES IST KEIN FREMDER COMPOSER-REST

Vier Beobachtungen, jede einzeln nachpruefbar:

1. **Die Zahl ist konstant.** 129, ueber neun Vorkommen, zwei Boots, zwei Stunden. Ein Composer,
   in dem jemand arbeitet, hat wechselnde Laengen.
2. **129 ist ein exakter Praefix unserer EIGENEN Nutzlast**, mitten im Wort geschnitten:

       [fleet inbox] 5 ungelesene Eintraege in der Inbox deines Programs f9dc8e10 —
       GET /api/self/inbox, dann POST /api/self/inbox/<id>/        <- hier endet Zeichen 129

   Die Nutzlast ist **177** Zeichen. 177 − 129 = **48** = genau der fehlende Schwanz
   `read (x-fleet-self-token aus $FLEET_SELF_TOKEN).`
3. **Die Pane wurde gelesen.** Composer leer (Platzhalter sichtbar), Footer
   `gpt-6-astra medium · ~/claude-fleet · Main [default]`.
4. **Die naheliegende Hypothese ist GEPRUEFT UND WIDERLEGT**, nicht offen: eine verrutschte
   Codex-Sub-Agent-Ansicht („Direct input is disabled") wuerde das Bild erklaeren — der Footer sagt
   `Main [default]`, sie liegt also nicht vor.

Damit gilt die stehende Regel unveraendert und wird hier nicht geschwaecht: ungesendeter Text in
einem Composer ist Claude Codes eigener Rest, nie ein Owner-Entwurf. Hier ist es nicht einmal das —
es ist **Fleets eigene Nutzlast**.

## 3 · ES IST KEIN TIMEOUT — und das stoesst die bisherige Fassung um

`sendText` (`server.ts#sendText`) wirft **zwei verschiedene** `SendNotAccepted`, und der
Unterschied zwischen ihnen ist der ganze Befund:

| Meldung | Zeitpunkt | Bedeutung |
|---|---|---|
| `prompt not submitted — the composer still held only part of the N-char payload … no Enter was sent` | `awaitArrival` == `"partial"`, **VOR** Enter | Paste noch unterwegs, Enter wurde bewusst unterdrueckt |
| `prompt not accepted — composer still holds N chars after …` | `awaitComposer` **NACH** Enter, danach `rollbackOwnComposerPayload` | Enter ist gefeuert, der Composer leert sich nicht |

**Wir bekommen die zweite.** Also ist Enter zum Messzeitpunkt laengst gesendet, und der Composer
haelt danach den **Anfang** der Nutzlast, waehrend der Schwanz verbraucht ist.

Die archivierte Zeile `3d6285f9` fuehrt den Fall als `ACCEPT_WAIT_MS`-Naht („fest, keine
Lastkopplung, keine zweite Lesung") — also als Zeitproblem. **Das kann nicht die Ursache sein:**
ein groesserer Wartewert verlaengert nur eine Beobachtung, die nach dem entscheidenden Ereignis
stattfindet. Wer die Zeile als Timeout-Tuning wieder aufnimmt, baut am Befund vorbei.

## 4 · WAS NICHT ESTABLISHED IST — und wie die naechste Probe aussehen muss

**Warum Enter genau die fuehrenden 129 Zeichen stehen laesst.** Verdacht, ausdruecklich UNGEPRUEFT:
ein 177-Zeichen-Paste bricht im Codex-Composer ueber mehrere Zeilen, und Enter reicht nur eine ein.

Waere das richtig, ist die Messgroesse die **LAENGE**, nicht die Zeit. Die Probe dazu:
gestufte Nutzlasten (60 / 120 / 130 / 177 Zeichen) gegen eine **WEGWERF-Codex-Pane** — nie gegen
eine lebende, und nie gegen Slot 10. Gesucht ist die Schwelle, ab der ein Rest bleibt.

**Trifft es nur codex?** Alle neun Vorkommen liegen auf EINER codex-Pane. Gegenprobe am selben Tag:
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
