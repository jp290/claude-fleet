# Der Founding-Paste in die schwarze Pane — warum die Orchestrator-Nachfolge vom 2026-09-20 23:45 verschwand

*Gemessen 2026-09-21 vom Nachfolger selbst (Slot 6), an claude 2.1.278, in Wegwerf-tmux-Sockets.
Anlass: der Owner stellte fest, dass die Session, die die Nachfolge hätte antreten sollen, nichts
von ihrer Vorgängerin wusste.*

## 0. Was passiert ist, in fünf Belegen

| # | Beleg | Quelle |
|---|---|---|
| 1 | `23:44:56 slot_open slot=6 /Users/owner/claude-fleet` | `audit.jsonl` |
| 2 | `23:45:11 send slot=6 succession 3238B observed` — der Server hält die Zustellung für bewiesen | `audit.jsonl` |
| 3 | `23:47:12 slot_kill slot=7 handoff` — die Vorgängerin wird auf diesen Beweis hin zurückgezogen | `audit.jsonl` |
| 4 | Die ERSTE `type:"user"`-Zeile in `28b04658-…jsonl` (der Session, die der Slot-Datensatz als `sessionId` führt) ist die Owner-Nachricht von 23:50:26. Der Brief steht nirgends darin. | Claude-Transcript |
| 5 | Das Pane-Scrollback von `s6` zeigt drei Splash-Paints und dann direkt die Owner-Zeile — kein Byte des Briefs wurde je geechot. | `tmux capture-pane -S -` |

Der Übergabe-Record selbst war **nie verloren**: `GET /api/self` liefert ihn vollständig
(`lineageId f54c597761cdbf0e48fbc039`, fünf offene Report-Verpflichtungen, `intent` 1987 Zeichen).
Verloren ging allein der Prompt, der dem Nachfolger gesagt hätte, dass es ihn gibt.

## 1. Reproduktion — drei Läufe, ein Muster

Skript: Pane über eigenen Socket öffnen (`claude --dangerously-skip-permissions --session-id <uuid>
--model claude-haiku-4-5-20251001`), nach `DELAY` ms `paste-buffer` + `Enter`, danach fragen, ob ein
Transcript existiert. Das Transcript ist der unabhängige Zeuge: es entsteht nur, wenn ein Turn
genommen wurde.

| Lauf | Paste bei | Erster gemalter Frame | Nutzlast vor Enter auf dem Schirm | Transcript |
|---|---|---|---|---|
| A | 4,5 s | 8,5 s | nein | **nein** |
| B | 14 s | 25,9 s (Host unter Last) | nein | **nein** |
| C | bei Erscheinen von `❯` (9,15 s) | 9,15 s | (noch nicht, 0,3 s später) | **ja** |

Lauf B ist der bezahlte Fall in Zeitlupe: der Frame-Trace zeigt die Pane **1,5 s–25,8 s komplett
leer**, und um 25,9 s malt die TUI plötzlich den Composer **mit der Nutzlast darin** — die gepufferten
pty-Bytes wurden nachgespielt, das Enter von 14,4 s war im selben Strom schon verbraucht. Ergebnis:
der Text steht für immer im Composer, kein Turn, kein Transcript.

Lauf C ist die Kontrolle: derselbe Paste, dieselbe Maschine, nur getriggert auf `❯` — Turn genommen.

Nebenmessung (Lauf D, 3828 B mehrzeilig): claude **kollabiert einen großen Paste nicht**, er rendert
ihn zeilenweise im Composer. `composerArrival` kann für einen Nachfolgebrief also `complete`
erreichen; das Rendern brauchte allerdings > 1,5 s.

## 2. Warum kein Gate gegriffen hat

```
paneReadiness(s):      Adapter deklariert blocks ohne accept  →  return null
waitForFoundingReadiness:  if (!rd || rd.state === "ready") return { ok: true }   ← erste Zeile
```

Für claude war `readiness.accept = null`. Damit ist der Founding-Gate ein No-op, und es bleibt allein
`FOUNDING_BOOT_GRACE_MS` (4 s). `bootSettleMs: 2500` greift ebenfalls nicht: `sendText` legt den
Settle nur auf den Übergang *nicht-alive → alive*, und der claude-Prozess ist lange vor seiner TUI
`alive` — die erste Sonde sagt schon „alive", also `waitedForAlive = false`.

## 3. Warum das Ledger `observed` schrieb

`sendText` prüft vor dem Enter `awaitArrival` und danach `awaitComposer(r === "")`. Auf einem Frame
**ohne jeden Composer** liefert der strenge Leser `unobservable`, `awaitArrival` antwortet damit
sofort `differs` — und `differs` heißt ausdrücklich „Vollständigkeit unbeweisbar, nie widerlegt", der
Send läuft weiter. Nach dem Enter malt die TUI (inzwischen gebootet) einen **leeren** Composer, und
genau dieses Bild galt als Beweis für „die TUI hat den Turn genommen".

Ein leerer Composer nach dem Enter ist aber auch das Bild einer Pane, die den Paste **nie bekommen
hat**. Genau diese Zweideutigkeit hat die Vorgängerin das Leben gekostet.

Die drei Zustände, rein gegen `composer.ts` gefahren (glyph-Form, derselbe Payload):

| Frame | `composerRows` | `composerArrival` | was `sendText` tut |
|---|---|---|---|
| Pane malt nichts | `null` | *(unobservable ⇒)* `differs` | **Enter wird gesendet** ← die Lücke |
| Composer da, leer | `[""]` | `partial` | refused, kein Enter — schon vor dem Fix |
| Nutzlast gerendert | `["[fleet succession] …"]` | `complete` | Enter, `observed` |

Der Vorfall brauchte also genau die erste Zeile: **kein Composer auf dem Frame**. Der leere Composer
war schon immer abgedeckt.

## 4. Was geändert wurde

1. **`server.ts#CLAUDE_HARNESS.readiness.accept`** = `IS_CLAUDE ? CLAUDE_READY_FRAME : null`.
   `accept` hängt an `IS_CLAUDE`, `blocks` nicht: ein Block verweigert nur, ein nie erscheinender
   Ready-Marker würde jeden Founding-Paste bis zum Budget-Ende halten.

   **Die erste Fassung dieses Markers war die Composer-Glyphe allein, und sie war falsch — gefunden
   von `./e2e-claude-gate.sh`, nicht von mir.** Vier Checks der Schlaf-/Wake-Familie starben mit
   `wake failed: pane never showed its ready marker`: `wakeSlot` geht durch DIESELBE
   `waitForFoundingReadiness` wie jede Bahn, die in eine frische Pane tippt, und `IS_CLAUDE` ist
   eine NAMENSPROBE — die Fake-Binaries der Gate-Suite heißen `claude` und malen per Konstruktion
   kein Byte (`claude-hang.c` ist `for (;;) pause();`). Zwei Lehren, beide allgemein: ein
   Ready-Marker ist eine Bedingung, deren ABWESENHEIT blockiert, also trifft er jeden Stand-in, den
   die Namensprobe einfängt; und die Glyphe war zu eng formuliert — gebraucht wird „diese TUI hat
   ihre Chrome gemalt", nicht „hier ist ein Composer".

   `CLAUDE_READY_FRAME` nennt darum drei gemessene Zeilen, jede genügt: die Composer-Glyphe
   (9152 ms), die Permission-Zeile des Bypass-Spawns, der ctx-Footer (12 853 ms auf demselben Boot).
   Gegen echte Frames geprüft: **pending** auf dem Blackout UND auf „nur Banner", **ready** auf allen
   drei Chrome-Formen. Der Wake-Fixture bekommt einen eigenen Stand-in `claude-ready`, der die
   Permission-Zeile malt — bewusst NICHT die Glyphe (er sähe sonst aus wie ein Composer, der den
   Paste nie annimmt) und NICHT den Footer (der trägt das laufende Modell und wird als solches
   geparst).
2. **`server.ts#sendText`** gibt `observed` nur noch zurück, wenn die Ankunftslesung `complete` war.
   Alles andere mit leerem Composer ist `unobservable` — dasselbe Wort, das ein Stand-in ohne
   Composer schon immer bekam. **Kein Aufrufer wird dadurch abgewiesen**; es ist eine Ehrlichkeits-,
   keine Verweigerungsänderung.
3. **`.env`: `FLEET_READY_WAIT_MS='45000'`** — 4 s Grace + 20 s Code-Default lägen innerhalb der
   gemessenen Streuung (25,9 s). Rückfalltür: Zeile löschen.

## 5. Wie der Fix gegengeprüft ist

- `e2e/pins.ts`: zwei Regeln über die Quelle (der Marker existiert und stammt aus derselben Konstante
  wie der Composer · `observed` hängt an `arrival === "complete"`). **Mutationsprobe gefahren:**
  `accept` auf `null` zurück ⇒ Pin 1 rot; `return { acceptance: "observed" }` ⇒ Pin 2 rot.
- `e2e/slots.ts` + der Stand-in-Modus **`blackout`** in `e2e-isolated.sh`: die Pane malt nichts,
  während der Paste ankommt, schluckt ihn, und erst das Enter malt einen gewöhnlichen leeren
  Composer — ohne einen Turn ins `turns`-Ledger zu schreiben. Das ist die Frame-Folge aus §1/§3,
  mechanisch. Erwartet: `acceptance: "unobservable"` und kein Turn.

## 5a. Die Wake-Bahn bleibt ABSICHTLICH ungefixt — und warum das hier steht

`wakeSlot` tippt ebenfalls in eine frische Pane und hat **dieselbe Lücke**: es wartet auf
`paneAgentAt === alive` plus `bootSettleMs` (2500 ms), also auf ~3,5 s — während die TUI erst nach
8,5–25,9 s malt. Der Marker gehört dort hin.

Er steht trotzdem nicht dort. Der Versuch, ihn zu setzen, färbte **vier Checks der
Schlaf-/Wake-Familie** von `./e2e-claude-gate.sh` rot: `wake failed: pane never showed its ready
marker within 20s`. Zwei Reparaturversuche, beide gemessen und beide ergebnislos:

1. Der Fake malt nichts (`claude-hang.c` = `for (;;) pause();`) — also bekam die Fixture einen
   Stand-in, der die Permission-Zeile malt. **Derselbe Fehler.**
2. Gegenprobe in einer echten tmux-Pane, mit derselben argv-Form wie die Wake-Bahn sie baut:
   der Stand-in malt seine Zeile, und der Marker matcht (`marker matches: True`). Die
   Liveness-Prüfung der Fixture besteht ebenfalls — die Pane ist also oben und die Zeile sollte
   darauf stehen.

Damit ist der Fehler **unerklärt**, und eine Bahn, deren Rot ich nicht erklären kann, bekommt keine
Änderung. `wakeSlot` behält seinen Vertrag von vor dem 2026-09-21 (`{ marker: false }`; Blocks
verweigern weiterhin), die Fixture-Änderung wurde **zurückgenommen**, und ein Pin hält fest, dass
genau EINE Bahn diesen Verzicht haben darf. Das ist eine benannte offene Lücke, keine Aussage, dass
Wake sicher wäre.

## 6. Was NICHT gemessen ist

- Ob `codex`/`pi` denselben Blackout haben — nur claude ist vermessen.
- **`❯` ist ein Composer-Glyph UND ein Auswahl-Cursor.** Der Trust-Dialog trägt ihn auch
  (`❯ Yes, I trust this folder`), und der ist gedeckt: `paneReadiness` prüft `blocks` VOR `accept`,
  die Reihenfolge trägt hier Gewicht. Ein anderer Auswahl-Screen mit `❯`, den `blocks` nicht kennt,
  würde als „ready" gelesen — das ist aber keine Regression, sondern exakt der Zustand von vorher
  (ohne Marker gab es gar keinen Gate). Ein vierter Paste-fressender Screen bleibt damit offen,
  wie der Codex-Update-Prompt in `docs/harness-adapter.md`.
- Ob 45 s auf diesem Host unter Volllast reichen; 25,9 s ist der größte gesehene Wert, kein Maximum.
- **Warum die Wake-Fixture den Marker nicht sieht** (§5a) — der nächste Schritt ist ein Lauf mit
  einem Debug-Abzug des Frames im Timeout-Zweig; ohne den bleibt die Wake-Bahn ungefixt.
- Der dritte Weg eines verlorenen Founding-Pastes: die Route räumt den Nachfolger jetzt auf und
  antwortet 500, aber **niemand stellt den bereits geschriebenen Lineage-Record irgendwo zu**. Dass
  die Übergabe hier gerettet werden konnte, lag daran, dass der Nachfolger von Hand nach ihr gefragt
  hat.
