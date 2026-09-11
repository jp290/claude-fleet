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
