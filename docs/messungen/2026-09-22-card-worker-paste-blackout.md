---
frage: Warum endeten am 2026-09-21 ab 19:12 alle Kartenlaeufe mit „summarizer timed out without an answer" und `ms: 0`, und was zeigt die Worker-Pane dabei?
urteil: Derselbe Blackout wie beim Founding-Paste, auf der Worker-Bahn — `summaryViaSession` pastete fest 2 500 ms nach „Prozess lebt", claude lebt nach ~20 ms, malt unter Last aber bis zu 26 s nichts, und ein Paste in dieses Dunkel geht verloren (in der Wegwerf-Reproduktion 3 von 3 Pastes vor dem ersten Frame ohne Transcript, 3 von 3 danach mit). Kein Trust-Dialog, kein Update-Screen, kein Kontingent — dieselben Zeilen lasen vorher und nachher sauber. `ms: 0` war ein Literal im Fehlerpfad, keine Messung. Beides im Code behoben.
bereich: [karten, worker, readiness, blackout, ledger]
belege: [server.ts#summaryViaSession, server.ts#tickCardSweep, server.ts#CLAUDE_READY_FRAME, e2e/tasks.ts (jb), docs/messungen/2026-09-21-founding-paste-blackout.md]
nicht-gemessen: Die Last im Fenster 19:12–19:52 selbst ist nicht vermessen (server.log traegt keine Zeitstempel je Zeile, die Ladelast wird nicht protokolliert); die Zuordnung „Last" stuetzt sich auf die im Fenster laufenden Lane-Suiten und Post-Land-Audits im Log und auf die Messung vom 21.09. (Blackout 8,5–25,9 s). Die Pane selbst ist aus dem Fenster nicht erhalten — der Worker toetet seine Session im `finally`.
stand: 2026-09-22
---

# Der Karten-Worker pastete ins Dunkel

2026-09-22, Lane `fleet/260922072229-1470`. Anlass: Orchestratorin Slot 13 mass am 21.09. sieben
Kartenlaeufe in Folge mit `gaps: ["run: summarizer timed out without an answer"]` und `ms: 0`.

## 1. Was das Ledger wirklich sagt

`cards.jsonl`, alle `source:"model"`-Zeilen um das Fenster (Zeit CEST):

| Zeit | Zeilen | Ergebnis |
|---|---|---|
| 18:17–18:19 | 4249c5ef, d6bbca83 | gelesen, 9–30 s |
| 19:12–19:52 | 2fe74e5c ×2, d3b69b83 ×3, 65dc105f ×3, efad804e ×2 | **10 × timeout, `ms: 0`** |
| 19:55–19:57 | bc98af80, efad804e | gelesen, 21 s — **derselbe Boot** |
| 20:58 – 22.09. 08:09 | d3b69b83, 65dc105f, … (16 Laeufe) | alle gelesen, 9–33 s |

Zwei Folgerungen, beide aus den Zeilen: (a) es war kein dauerhafter Ausfall „seit dem Deploy",
sondern ein 40-Minuten-Fenster, das sich ohne Neustart schloss; (b) dieselben Zeilen (efad804e,
d3b69b83, 65dc105f) lasen vorher oder nachher sauber — eine Ursache pro Repo (Trust-Dialog) oder
pro Text scheidet aus. Der Trust-Dialog haette ausserdem einen anderen Fehlertext geworfen
(`claude trust dialog in … — the worker never answers it`, seit 2026-09-15).

## 2. Warum `ms: 0`

`server.ts#tickCardSweep`, `catch`-Zweig: `appendEvent(CARD_FILE, { …, ms: 0, … })` — ein Literal.
Der Lauf war 120 s alt (`CARD_TIMEOUT_MS`), als der Fehler kam; das Ledger hat ihn als „scheiterte
vor dem Start" gelesen. Jetzt: `ms: Date.now() - runStarted`, gestartet vor `formatCardOf`.

## 3. Reproduktion — eigene Wegwerf-Pane, dieselbe Worker-Zeile

Socket `cardprobe` (nie `claudefleet`), cwd `/Users/owner/claude-fleet`, Zeile wortgleich zur
Adapter-Zeile: `claude --session-id <uuid> --model 'claude-sonnet-5' --tools "" --strict-mcp-config
--permission-mode dontAsk`, Paste per `paste-buffer -p` + Enter wie `summaryViaSession`, Zeuge ist
das Transcript. claude 2.1.278, Load 2,5.

| Settle nach `alive` | alive | erster Ready-Frame | Paste | Antwort im Transcript |
|---|---|---|---|---|
| 2 500 ms | 20 ms | 865 ms | 2 696 ms | **ja**, 4 626 ms |
| 2 500 ms | 19 ms | 1 070 ms | 2 700 ms | **ja**, 4 630 ms |
| 2 500 ms | 27 ms | 1 084 ms | 2 712 ms | **ja**, 5 151 ms |
| 0 ms | 24 ms | 975 ms | 29 ms | **nein** |
| 0 ms | 25 ms | 957 ms | 30 ms | **nein** |
| 300 ms | 22 ms | 1 372 ms | 441 ms | **nein** |

Was die Pane nach den drei Fehllaeufen zeigt (60 s spaeter): zweimal die Nutzlast im Composer, das
Enter verbraucht (`❯ Reply with exactly the word PONG and nothing else.`), einmal einen leeren
Composer (`❯ `) — die Bytes kamen nie an. Kein Dialog, kein Update-Hinweis, der Footer liest
`main | ctx [----------] --% | Sonnet 5` und `⏵⏵ don't ask on`. Das sind genau die zwei
Verlustformen aus `2026-09-21-founding-paste-blackout.md` §1.

Auf dem ruhigen Host malt claude nach ~1 s und der feste Settle traegt. Am 21.09. mass derselbe
Host unter Last 8,5 s und 25,9 s bis zum ersten Frame; das Fenster 19:12–19:52 faellt in eine Phase
mit laufenden Lane-Suiten und Post-Land-Audits (server.log). Ab ~2,5 s Blackout verliert der alte
Pfad jeden Paste und wartet dann den ganzen `CARD_TIMEOUT_MS` ab.

## 4. Warum der Founding-Fix vom 21.09. hier nicht griff

Der Fix setzte `CLAUDE_HARNESS.readiness.accept` und liess `waitForFoundingReadiness` darauf warten
— das ist die SLOT-Bahn. `summaryViaSession` fragt die Adapter-Methode `worker()`, die nur
`cmd`/`comms`/`blocks` trug, und schlief danach fest 2 500 ms. Die Worker-Bahn hatte den Marker nie.

## 5. Was geaendert wurde

1. `Harness.worker()` traegt `accept: RegExp | null`; der claude-Adapter liefert
   `CLAUDE_READY_FRAME` — **nicht** hinter `IS_CLAUDE`, weil die Worker-Zeile das claude-Binary
   startet, gleich was `FLEET_CMD` sagt.
2. `summaryViaSession` wartet nach `alive` auf einen Frame, der `accept` trifft (Blocks zuerst,
   Abstand 250 ms), begrenzt durch `READY_WAIT_MS` (live 45 s per `.env`), und verweigert danach
   mit `summarizer session never drew its TUI within Ns` — statt zu pasten und 120 s zu warten.
   `accept: null` behaelt den alten 2 500-ms-Settle.
3. `tickCardSweep` schreibt auf dem Fehlerpfad die echte Dauer.

Gegenprobe: `e2e/tasks.ts` (jb), ein claude-Stand-in ueber den PATH wie (jt). „dark" malt nie →
erwartet die benannte Verweigerung in < 10 s und **nichts** gepastet (alter Code: Paste nach 2,5 s,
Pastedatei nicht leer → rot). „lit" malt sofort die Permission-Zeile → erwartet den Paste (schuetzt
gegen einen Fix, der alles verweigert).

## 6. Abhilfe ohne Code — keine noetig

Kein Owner-Akt: weder `FLEET_CARD_MODEL` noch `FLEET_CARD_MS` spielen eine Rolle, und der
Trust-Stand von `~/claude-fleet` ist in Ordnung (der Paste nach dem Frame wurde in allen Laeufen
genommen). Wirksam wird der Fix mit dem naechsten Deploy.
