# ACP-21 — Wann laesst Fleets Zustellform den Prompt im Composer stehen?

2026-08-22, Lane `fleet/260822103951-f3c2` (Program `eeba7c04caae64d79969199b`, Act ACP-21,
Attempt 1). Rolle: Canary/Researcher — gemessen, nichts gebaut.

Frage: **Unter welchen Bedingungen laesst die Zustellform von Fleet
(`load-buffer` → `paste-buffer -p -d` → 150 ms → `send-keys Enter`) an einer echten claude-TUI
den Prompt im Composer stehen, statt ihn abzuschicken?**

## Ergebnis in drei Saetzen

**Reproduziert.** Bei einem MEHRZEILIGEN Paste, den die CLI zu einem Platzhalter
`[Pasted text #1 +N lines]` einklappt, geht das eine Enter aus `sendText` intermittierend
verloren: der Text steht vollstaendig im Composer, kein Transcript-Eintrag entsteht, und ein
zweites Enter von Hand schickt ihn sofort ab. Trefferquote der Fehlform bei 150 ms:
**2 von 7 Mehrzeiler-Sends (29 %)**; bei EINZEILIGEN Sends **0 von 20**.
Mit 2500 ms statt 150 ms: **0 von 4** — konsistent mit einer Wettlaufstelle am Delay, aber
bei dieser Grundrate **kein Beweis** (bei p=0,29 waeren 0/4 auch rein zufaellig mit 25 %
Wahrscheinlichkeit).

## Reproduktionskommando (copy-paste-faehig)

Eigener Socket, nie `-L claudefleet`. Aufraeumen ausschliesslich per `kill-server`, nie `pkill`.

```sh
WT=$PWD; U=$(uuidgen | tr 'A-Z' 'a-z')
TDIR=$HOME/.claude/projects/$(echo "$WT" | sed 's/[\/.]/-/g')
tmux -L acp21probe new-session -d -s p -x 200 -y 50 -c "$WT" \
  "claude --dangerously-skip-permissions --model 'claude-opus-5[1m]' --session-id $U --prompt-suggestions false; exec /bin/zsh"
sleep 4; tmux -L acp21probe capture-pane -p -t p | sed -n '7,9p'   # Vorzustand: '❯' + 'bypass permissions on'
{ echo "probe ACP21 — langer Brief, bitte NICHT lesen."
  for i in $(seq 1 200); do echo "Zeile $i: Fuellwort Fuellwort Fuellwort abcdefghij."; done
  echo "Ende. Antworte NUR mit dem Wort OK. Marker ACP21"; } > /tmp/acp21.txt
# --- exakt die Zustellform aus server.ts:4746-4755 ---
tmux -L acp21probe load-buffer -b acp21buf /tmp/acp21.txt
tmux -L acp21probe paste-buffer -p -d -b acp21buf -t p
sleep 0.15
tmux -L acp21probe send-keys -t p Enter
# ----------------------------------------------------
sleep 15
grep -c '"type":"user"' "$TDIR/$U.jsonl" 2>/dev/null || echo "0 — Prompt NICHT angekommen"
tmux -L acp21probe capture-pane -p -t p | sed -n '8p'   # im Fehlerfall: '❯ [Pasted text #1 +202 lines]'
tmux -L acp21probe send-keys -t p Enter                 # zweites Enter → schickt ab
tmux -L acp21probe kill-server
```

Die Fehlform ist nicht-deterministisch (≈29 % je Send) — das Kommando muss ggf. mehrfach laufen.

## Aufbau

Kein Fleet-Server im Spiel: direkt tmux + echte claude-TUI, eigener Socket `acp21probe`, `cwd` =
dieser Worktree. Spawn 1:1 nach `agentCmd` (`server.ts:147-176`):
`claude --dangerously-skip-permissions --model 'claude-opus-5[1m]' --session-id <uuid> --prompt-suggestions false`.
Zustellform 1:1 nach `sendText` (`server.ts:4746-4755`).

**Autoritatives Observable:** eine `"type":"user"`-Zeile mit dem Zellen-Marker in
`~/.claude/projects/-Users-owner-claude-fleet-worktrees-fleet-260822103951-f3c2/<sessionId>.jsonl`,
innerhalb von 15 s. Zweitbeleg: `capture-pane -p`. Bei jedem NEIN wurde ein **zweites Enter
nachgeschoben** und erneut 15 s gewartet; beide Antworten stehen in der Tabelle.

**Zeitpunkt des Sends:** ≈2–3 s nach Spawn, unmittelbar nachdem der Composer gemalt war
(Runde 1 direkt gemessen: 1678–2835 ms). In Runde 2/3 misst die entsprechende TSV-Spalte
Spawn→Verdikt, nicht Spawn→Send, und ist als Send-Zeit nicht verwendbar — die Sequenz war
dieselbe.

## Kontrollzelle (eigene Zeile, wie gefordert)

| Zelle | Form | Pane | Inhalt | n | abgeschickt beim 1. Enter |
|---|---|---|---|---|---|
| **A (KONTROLLE)** | `send-keys -l` + separates `send-keys Enter` | frisch | 1 Zeile, 55 B | 5 | **5/5** |

Die Sonde misst also, was sie messen soll. Ein Rot in den Fleet-Zellen ist damit keine
Sondenaussage.

## Tabelle — jede gefahrene Zelle, auch die gruenen

`1. Enter` = Transcript-Zeile innerhalb 15 s. `2. Enter` = Ergebnis nach dem nachgeschobenen Enter.

| Zelle | Form | Pane | Inhalt | Delay | n | 1. Enter ok | Fehlform | nach 2. Enter |
|---|---|---|---|---|---|---|---|---|
| A | send-keys (Kontrolle) | frisch (≈2 s) | 1 Zeile, 55 B | — | 5 | 5/5 | 0 | — |
| B | **Fleet-Form** | frisch (≈2 s) | 1 Zeile, 55 B | 150 ms | 5 | 5/5 | 0 | — |
| C | send-keys (Kontrolle) | etabliert (nach 1 Turn) | 1 Zeile, 55 B | — | 5 | 5/5 | 0 | — |
| D | **Fleet-Form** | etabliert (nach 1 Turn) | 1 Zeile, 55 B | 150 ms | 5 | 5/5 | 0 | — |
| E | **Fleet-Form** | frisch | **42 Zeilen, 3401 B** | 150 ms | 3 | 2/3 | **1** (E-2) | abgeschickt |
| F | **Fleet-Form** | frisch | `@/abs/path` mitten im Text, 144 B | 150 ms | 3 | 3/3 | 0 | — |
| G | **Fleet-Form** | frisch | beginnt mit `/`, 73 B | 150 ms | 3 | 3/3 | 0 | — |
| H | **Fleet-Form** | frisch | **202 Zeilen, 16617 B** | 150 ms | 4 | 3/4 | **1** (H-2) | abgeschickt |
| I | **Fleet-Form** | frisch | **202 Zeilen, 16617 B** | **2500 ms** | 4 | 4/4 | 0 | — |

Summen: Einzeiler bei 150 ms (B+D) **0/10** Fehlform · Mehrzeiler bei 150 ms (E+H) **2/7** ·
Mehrzeiler bei 2500 ms (I) **0/4**. 40 echte claude-Prompts insgesamt (Budget ausgeschoepft:
1 Smoke + 20 Runde 1 + 2 Warmups + 9 Runde 2 + 8 Runde 3).

## Der Mechanismus, soweit gemessen

Beide Fehlformen zeigen dieselbe Signatur im `capture-pane` 15 s nach dem Enter:

```
❯ [Pasted text #1 +202 lines]
──────────────────────────────
  fleet/260822103951-f3c2  |  ctx [----------] --%  |  Opus 5 (1M context)
  ⏵⏵ bypass permissions on (shift+tab to cycle)
```

Der Text ist vollstaendig im Composer, die Pane ist auf ihrem Haupt-Thread, kein Popup, kein
Trust-Screen, kein laufender Turn — das Enter ist schlicht **wirkungslos geblieben**. Das zweite
Enter schickte in beiden Faellen sofort ab.

Die Naht liegt zwischen **Fleets fixem 150-ms-Delay** (`server.ts:4753`) und dem Moment, in dem
die CLI die eingeklappte Paste als abschickbaren Composer-Inhalt uebernommen hat. Die Fehlform
tritt ausschliesslich dort auf, wo die CLI den Paste zu `[Pasted text #N +M lines]` **einklappt**
(Mehrzeiler); Einzeiler, die nicht eingeklappt werden, sind 0/10.

**Nicht gemessen habe ich die CLI-INTERNE Ursache** — `claude` ist ein Binary, ich habe nur den
Aussenzustand beobachtet. Die Aussage lautet daher: der Ausloeser ist der Einklapp-Pfad plus ein
zu kurzes Delay, nicht „die CLI verwirft Enter, weil X".

Groesse allein erklaert nichts: 3401 B ergab 1/3, 16617 B ergab 1/4 — dieselbe Groessenordnung
der Rate, kein Anstieg mit dem Faktor 5 der Bytes.

## Konfundierer — aktiv ausgeschlossen

- **Permission-/Trust-Screen.** Vor JEDEM der 40 Sends wurde `capture-pane -p` geprueft auf
  (a) vorhandene Composer-Zeile `❯`, (b) Abwesenheit von „do you trust"/„yes, proceed",
  (c) Fussleiste `⏵⏵ bypass permissions on`. Ergebnis in allen 40 Zellen-Zeilen: `OK`. Kein
  einziger Trust-Screen — die Panes liefen mit `--dangerously-skip-permissions` in einem cwd,
  den die Maschine bereits kennt.
- **Verrutschte Ansicht.** Dieselbe Vorpruefung liest die Haupt-Thread-Fussleiste
  (`fleet/260822103951-f3c2 | ctx […] | Opus 5 (1M context)` + Bypass-Zeile). Sie war in allen
  40 Faellen vorhanden — auch in den beiden Fehlform-Captures (siehe Block oben). Keine Pane
  stand auf einem Unter-Thread oder in einem Dialog.

## CODE-GELESEN (nicht gemessen, uebernommen aus dem Auftrag und am Baum nachgeschlagen)

- `sendText` (`server.ts:4703`) sendet genau EIN Enter: `paste-buffer -p -d` (`:4750`),
  `Bun.sleep(150)` (`:4753`), `send-keys Enter` (`:4754`). Geworfen wird nur auf einen
  tmux-Exitcode (`:4749`, `:4751`, `:4755`) — nie auf eine Beobachtung der Pane.
- **Die Quittung ist ein Echo, keine Beobachtung:** `submitted: submit` (`server.ts:19534`) gibt
  das Request-Flag zurueck (`const submit = body.submit !== false`, `:19513`). In genau der oben
  gemessenen Fehlform antwortet die Route also `{ok:true, receipt:{submitted:true}}`, waehrend der
  Prompt im Composer steht. Das ist der Grund, warum der Fehler unsichtbar ist — er ist mit dieser
  Messung jetzt belegt und nicht mehr nur plausibel.
- Drei verschiedene Zahlen fuer dieselbe Geste: 150 ms (`:4753`), 400 ms im Summarizer-Pfad
  (`:8198`), 2500 ms `bootSettleMs` fuer claude (`:456`), plus `SEND_BOOT_FRESH_MS`/
  `SEND_BOOT_WAIT_MS` (`:4691`/`:4692`). Keine davon ist aus einer Composer-Messung hergeleitet.
- Der dokumentierte `@/abs/path`-Ausloeser (`server.ts:7598-7606`, „with the popup open the next
  Enter is consumed by the completion") — meine Zelle F hat ihn **nicht** reproduziert (3/3
  abgeschickt). Siehe „Was ich NICHT gemessen habe": mein `@` stand mitten im Text, nicht am
  Zeilenanfang, und die Popup-Oeffnung selbst habe ich als Zwischenzustand nie beobachtet. Das
  widerlegt die dortige Messung NICHT.

## Was ich NICHT gemessen habe

- **Den Fleet-Server.** Keine Zelle lief durch `POST /send`: kein `inputChain`, kein
  `SEND_BOOT_*`-Gate, kein `bootSettleMs`. Ob diese Schichten die Rate erhoehen oder senken, ist
  offen.
- **Die Einklapp-Schwelle.** Ich habe nicht bisektiert, ab wie vielen Zeilen/Bytes die CLI zu
  `[Pasted text #N]` einklappt — nur, dass 1 Zeile nicht und 42 Zeilen schon.
- **Eine grosse EINZEILIGE Paste.** Damit ist „Mehrzeiler" und „gross" in meinen Daten nicht
  vollstaendig getrennt; das Einklappen ist der beobachtete Korrelat, nicht bewiesen als Ursache.
- **Die 400-ms-Zelle** (Budget erschoepft). Es gibt nur 150 vs. 2500.
- **Mehrzeiler in einer ETABLIERTEN Pane** — E/H/I liefen alle in frischen Panes.
- **Maschinenlast** wurde weder kontrolliert noch variiert; alle Laeufe waren seriell auf einer
  ansonsten normal belasteten Maschine.
- **Queue-Zeile `89b48243`** (Welcome-Composer nach `bootstrap-main`) wurde nicht nachgestellt —
  ihr Brief lief durch den echten Fleet-Pfad, meiner nicht.
- **Der CLI-Quellcode.** `claude` ist ein Binary; ich habe nur Pane und Transcript gelesen.

## Vorschlag (nicht gebaut — anderer Act)

1. Die Quittung ehrlich machen: `submitted` darf nicht das Request-Flag echoen. Entweder Feld
   umbenennen (`submitRequested`) oder durch eine Beobachtung ersetzen.
2. Billigste Beobachtung: nach dem Enter `capture-pane -p` lesen — steht dort noch
   `[Pasted text #` bzw. der gesendete Text, ist NICHT abgeschickt worden.
3. Erst danach ueber ein zweites Enter oder ein groesseres Delay reden. Ein blindes zweites Enter
   ist gefaehrlich (es koennte einen leeren Turn oder eine offene Completion ausloesen), ein
   groesseres Delay verlangsamt jeden Send und ist durch 0/4 nicht belegt.
4. Das 150/400/2500-Trio an EINER Stelle mit EINER Begruendung zusammenfuehren; heute sind es drei
   Zahlen ohne gemeinsame Messung.

## Rohdaten

`round1.tsv` / `round2.tsv` / `round3.tsv` und die beiden Fehlform-Captures lagen im
Session-Scratchpad (nicht getrackt); die Tabelle oben ist ihr vollstaendiger Inhalt — jede
gefahrene Zelle steht darin, keine wurde weggelassen.
