# Program Fleet-Betrieb — MAIN Slot 6 → Nachfolgerin (2026-09-17 ~23:5x, ctx GEMESSEN 30,1 %)

Diese Datei existiert, weil der Advisory-Deckel (10/10) das Filen als `notiz` verweigert und
`HANDOFF.md` die GETEILTE Datei des Orchestrators ist — genau die Kollision, nach der die
openQuestion dieses Programs fragt. Der Weg zur Nachfolgerin ist das 500-Zeichen-Feld von
`POST /api/self/succeed`, das auf diese Datei zeigt.

[UEBERGABE-ZUSTAND Program Fleet-Betrieb · MAIN Slot 6 -> Nachfolgerin · 2026-09-17 ~23:5x · alles gemessen, nicht erinnert]

1) GELANDET IN DIESER SCHICHT, vier Lands, alle mit gruenem Gate:
   2f22ef0e (B, Self-Land-Sprosse im Vorschlag) · b1563efb (Worktrail-Byte-Bilanz, docs) ·
   bcf1d451 (6ef9881c, Helfer-Grace im Audit-Drain) · 0497df33 (53daa39c, Karten-Re-Read).
   Audits gruen fuer 2f22ef0e (5109/0) und bcf1d451 (5109/0) und b1563efb (680/0, proportional).
   NACHGETRAGEN 2026-09-18 00:0x: das Audit zu 0497df33 ist da und GRUEN — ran 5113 / failed 0,
   852.527 ms. Die 5113 bestaetigen den Lane-Report unabhaengig: 5109 + 4 neue Checks (drei in
   e2e/tasks.ts plus ein Pin) geht genau auf. Damit sind ALLE VIER Lands dieser Schicht gruen
   auditiert; es ist kein Audit mehr offen und kein Watch mehr nachzuziehen.

2) ZWEI DIREKT-COMMITS VON MIR, fuer jedes land-seitige Ledger unsichtbar:
   7e038076 (docs/messungen/2026-09-17-holds-entpark-grund-nicht-live.md) und
   60ded776 (docs/verify-tiering.md, Familie 11.2ab + zweite Sichtung in 11.2t).
   state.sh land-health untertreibt dadurch um ZWEI. 7e038076 ist vom Audit zu bcf1d451
   mitgemessen worden (dessen Tip), 60ded776 NICHT.

3) DER NAECHSTE AKT, und er ist jetzt erst moeglich: c05f8b05 briefen.
   Der cardDue-Fix IST gelandet (0497df33), also darf ab jetzt wieder ein Brief angefasst
   werden — die Sperre aus Notiz 68fbfb95 §2 ist damit ABGELAUFEN, nicht aufgehoben.
   In den Brief gehoeren die KORRIGIERTEN Zahlen aus Report zu bd783b5d, nicht die aus
   Kommentar 13d36581: es sind 21 Mutations-Callsites, nicht 18; und der groesste
   REALISIERTE Posten ist nicht Program, sondern POST /api/self/fleet-report
   (606 Aufrufe / 381.461 B = 73 % der Klasse). c05f8b05 ("Echo-Diaet") ist genau dessen
   Schnitt. Die 4 AKTIVEN Programs messen Median 22.798 B, nicht die 3.754 B des
   71er-Medians.

4) EIN VERKLEMMEN, DAS KEIN FELD ANZEIGT — und mein Workaround ist KEINE Reparatur.
   53daa39c stand `queued`, Dispatch an, 10 freie Slots, Deckel 3 — und konnte trotzdem
   strukturell nicht starten: start-plan.ts:317 haelt eine WELLE, bis JEDES Mitglied
   freigegeben ist, und drei der vier Partner (1e170a25, c05f8b05, 56522568) sind durch die
   owner-bestaetigte Reihenfolge in 68fbfb95 §1 gehalten — die es gibt, weil drei der vier
   server.ts tragen und kollidieren wuerden. Die Welle will alle vier gleichzeitig, die
   Ordnung verbietet mehr als eine. Ich habe es mit `./ctl.sh dispatch 53daa39c` per HAND
   gestartet (startet genau EINE Zeile = die Ordnung) statt Holds zu loesen.
   FOLGERUNG, allgemein: eine SEQUENTIELLE Ordnung innerhalb einer Welle ist ueber den Tick
   UNERREICHBAR. Das trifft 1e170a25/c05f8b05/56522568 beim naechsten Mal genauso.

5) ZWEI REGISTRIER-SCHULDEN, teure Haelfte schon getan:
   (a) Die Vorschau zu 0497df33 war rot auf zwei `guarded rung`-Zeilen (e2e/programs.ts),
       Trail 2/380 und 3/381. Die LANE hat meine Basisraten-Lesart UEBERHOLT und sie ist
       besser: der fallende Konjunkt ist `cf2Confirm.ok && confirm==="resolved-candidate"`,
       woertlich `the lane is not done-looking (no signal)`. Das ist §11.2y in einem Arm,
       den dessen Reparatur nie erreicht hat. VON MIR NACHGEPRUEFT: awaitFoundingBrief hat
       GENAU ZWEI Aufrufstellen (e2e/programs.ts:10732, :11045), waitDoneLooking hat 30 —
       also 28 Arme ohne den Schutz. Die Familie heisst NICHT "zwei Zeilen mit 0,5 %",
       sondern "§11.2y in den 28 waitDoneLooking-Armen ohne awaitFoundingBrief". Die
       Reparatur existiert; sie muss nur an die uebrigen Aufrufstellen.
   (b) Registriert habe ich schon: 11.2ab (Composer-Rollback, 6/100) und die zweite
       Sichtung in 11.2t (heals 7->7 loest die Konjunktion auf). Beides in 60ded776.

6) OFFEN, mit Beleg:
   - Der ADVISORY-DECKEL ist voll: POST /api/self/tasks kind=notiz antwortet
     "10/10 pending advisory rows awaiting owner disposition"; im Program stehen 26 pending
     notiz-Zeilen, die aelteste 323 h. Darum gingen meine zwei Befunde in getrackte Dateien
     statt in die Queue. Wenn diese Zeile hier nicht filebar war, steht sie im Commit-Body.
   - deployGap waechst weiter (bei Schichtende 15+ Commits hinter dem Boot). Der
     Verhungerungs-Fix 280e6191 ist gelandet, laeuft aber NICHT — siehe 7e038076. Ein
     Entparken der Gruppe 5e5588c5/4cee1359/c929ba64 VOR einem Deploy ist dieselbe Wette
     wie die fuenf Verhungerungen davor. Deploy ist Orchestrator-Tuer.
   - 20 unquittierte rote Vorschauen sitzen in der Owner-Inbox (Deckel 20): seit dem
     Erreichen wird JEDE weitere rote Vorschau nur noch als `lane_suite_event_skipped`
     protokolliert und erreicht den Owner nicht mehr. Zweimal in dieser Schicht gesehen.
   - Ein Hold-Record ist {by, slot, at} — es gibt KEIN reason-Feld. Die Reihenfolge lebt
     ausschliesslich in Notiz 68fbfb95 §1 (Korrektur an c25dc5fb §4).
[NACHTRAG ZUM UEBERGABE-ZUSTAND · MAIN Slot 6 · 2026-09-18 ~08:3x · Schicht 2 nach dem Deploy]

7) DEPLOY b197adef IST DURCH UND VON MIR NACHGEPRUEFT, nicht uebernommen: bootHead == head ==
   4db6e47f, behindCount 0, bundleStale false, und 280e6191 / 2f22ef0e / 0497df33 sind per
   `git merge-base --is-ancestor` Vorfahren des bootHead. Damit ist mein eigener Befund aus
   7e038076 ERLEDIGT: die Verhungerungs-Reservierung ist live, die Holds sind fuer die Gruppe
   nicht mehr tragend. Die Sperre aus Kommentar 00a62658 an c05f8b05 ist damit ebenfalls weg.

8) c05f8b05 LAEUFT — Slot 1, fleet/260918061359-a705, per HAND dispatcht (s. Punkt 10).
   Ich habe ihren Brief geschrieben (POST /api/self/tasks/c05f8b05/brief, 4.757 Zeichen). Der
   Brief ERSETZT den Zeilentext als Arbeitsauftrag — die Tuer ueberschreibt, ein blosser Nachtrag
   haette den Rest verloren. Er traegt BEIDE Haelften (Report-/Nachrichten-Echo UND die
   Program-Routen aus 13d36581) und diese Korrekturen:
   - clarificationReplyMessage, NICHT clarificationAnswerMessage (den Namen gibt es nicht).
   - SAEMTLICHE Zeilennummern des Ursprungstexts sind verrottet; die Lane loest Symbole per rg
     an ihrem Baum auf und zitiert keine Zahl aus dem Auftrag.
   - Die vier Zeilenanker in 13d36581 sind falsch (b1563efb hat sie aufgeloest: Klammern,
     Kommentar, ein invalid-json-return). Die korrigierte Zahl 21 Mutations-Callsites steht als
     DATIERTE Messung zum Nachrechnen drin, nicht als abzuschreibende Zahl.
   - Massgeblich sind die AKTIVEN Records (Median 22.798 B, max 41.587 B), nicht der 71er-Median
     von 3.754 B.
   - Drei DONE-Saetze, je mit Falsifier, jeder misst seine eigene Voraussetzung.

9) OFFEN UND UNVERIFIZIERT, ausdruecklich als solches: der KARTEN-RE-READ, um den die ganze
   Deploy-Warterei sequenziert war, ist NICHT beobachtet worden. cardDue ist wahr
   (brief.at 1789711714382 > card.at 1789582881287), CARD_ON sollte an sein (.env:35
   FLEET_CARD_MS='60000'), und trotzdem stand die Karte nach ~4 min unveraendert auf
   model "author". Es BLOCKIERT nichts — die Karte ist valid, validatorVersion 5,
   filesOrigin "confirmed", und ihre surface nennt bereits die richtigen Symbole. Aber die
   Behauptung "die Sequenzierung hat sich ausgezahlt" ist NICHT belegt. Wer es pruefen will:
   card.at gegen brief.at, und ob der Sweep ueberhaupt Runden dreht.

10) DAS WELLEN-VERKLEMMEN IST KEIN EINZELFALL MEHR — zweite Sichtung, und damit eine Eigenschaft.
    c05f8b05 stand queued mit GUELTIGER, bestaetigter Karte und wurde von
    "waiting: wave partner 1e170a25 is not released" gehalten — also von genau der Ordnung, die
    die Reihenfolge richtig macht. Wie bei 53daa39c per `./ctl.sh dispatch` geloest: das startet
    GENAU EINE Zeile und ist damit die Ordnung, nicht ihre Umgehung. Erwartung fuer die
    Nachfolgerin: 1e170a25 und 56522568 treffen dasselbe. Eine sequentielle Ordnung INNERHALB
    einer Welle bleibt ueber den Tick unerreichbar, bis Welle oder Ordnung geaendert wird.

11) DER REST DES SCHNITTS, woertlich von Orchestratorin Slot 4 (2026-09-18 08:0x), nie zwei
    server.ts-Zeilen zugleich:
    (1) c05f8b05 briefen + freigeben  -> VON MIR ERLEDIGT, laeuft.
    (2) NACH dem Land von c05f8b05: Variantengruppe 5e5588c5/4cee1359/c929ba64 entparken —
        jetzt greift die Reservierung (280e6191 ist live, s. Punkt 7).
    Beim Gruppenstart gilt die Abmachung aus 68fbfb95 §4: Gruppenstart dem Orchestrator ANSAGEN,
    ab dann Deploy-Sperre bis die Messung durch ist.

12) NOCH IMMER OFFEN aus Schicht 1, unveraendert: der Advisory-Deckel (10/10) — auch DIESER
    Nachtrag war nicht als notiz filebar; die zwei Registrier-Schulden (§11.2y in den 28
    waitDoneLooking-Armen, und die zwei guarded-rung-Zeilen); die 20 unquittierten roten
    Vorschauen, ab denen jede weitere rote Vorschau den Owner nicht mehr erreicht.
