# SendNotAccepted auf dem Codex-Pfad (Slot 10) — was die zwei Zeilen beweisen und was sie nicht beweisen

*Gemessen 2026-09-11 ~11:3x von der Program-MAIN Fleet-Betrieb (Slot 1), Program `f170dc46`, am
laufenden Server (Boot `092083c2`, Deploy `c5279397`). Anlass: Owner-Meldung „Fleet-Nachrichten
erscheinen im Eingabefeld, verschwinden und lassen sich nicht abschicken".*

*Folgeschritt zu Bündel `df55f6c2` (Zustellung und Lane-Lebenszyklus), neben dessen Zeilen
`f53cb7ac` (Rollback ohne Compare-and-Set) und `3d6285f9` (ACCEPT_WAIT_MS fix 3000) — beide sind in
der K1-Lane `f4889e3c` ausdrücklich AUSGESCHLOSSEN. Dieser Befund wird von K1 nicht behoben.*

## Die Belege

`streams/prompts.jsonl`, die **einzigen zwei** `SendNotAccepted` in 12 460 Zeilen des Journals:

| ts | lokal | slot | source | text | delivery |
|---|---|---|---|---|---|
| 1789117821201 | 11:10:21 | 10 | `auto` | `[fleet inbox] 5 ungelesene Eintraege …` (129 Zeichen) | `SendNotAccepted` |
| 1789118481086 | 11:21:21 | 10 | `auto` | derselbe Text | `SendNotAccepted` |

`GET /api/sessions` → `errors.last`, wörtlich:

    prompt not accepted — composer still holds 129 chars after 3000ms; Fleet payload rollback cleared

Slot 10 = `🎛 Fleet Controller (Astra)`, `harness codex`, `model gpt-6-astra`, `agent alive`.

## 1. Der Rollback-Race ist als URSACHE dieser zwei Ereignisse widerlegt

`rollback cleared` ist nur erreichbar, wenn `server.ts#rollbackOwnComposerPayload` vorher
`composerHoldsExactly(read.rows, payload)` bejaht hat — der Composer hielt **exakt** Fleets Nutzlast
und nichts sonst. Ein eingestreuter Owner-Anschlag hätte `kept:differs` ergeben, ein misslungenes
Löschen `residue`. Beide Verdikte sind hier nicht gefallen.

Gegenprobe Owner-Text-Erhalt, aus dem Codex-Rollout derselben Session
(`~/.codex/sessions/2026/09/08/rollout-…-01a08013-….jsonl`): **78 Sekunden nach dem zweiten
Fehlschlag**, `2026-09-11T09:22:39.098Z`, steht dort eine vom Owner selbst getippte
`role: user`-Nachricht, vollständig und unversehrt, gefolgt von `task_started`. Es ist kein
Owner-Text verlorengegangen.

## 2. Die fehlende Enter-Annahme ist bestätigt — die Nachricht kam NIE an

Im Rollout dieser Session gibt es zwischen `task_complete` `09:04:44.376Z` und
`thread_settings_applied` `09:22:38.869Z` **keine einzige Zeile**. Die zwei Nudges (`09:10:21.201Z`
und `09:21:21.086Z` UTC) haben die Codex-Session nie erreicht.

Damit ist auch die naheliegende Gegenhypothese widerlegt, der Composer-Glyph lese das Transcript-Echo
eines abgeschickten Turns als Residuum (die Gefahr, die der Adapter-Kommentar bei
`server.ts#CODEX_HARNESS` selbst benennt): Es gab keinen abgeschickten Turn, der hätte echoen können.

`send-keys Enter` kam mit Exit 0 zurück, und 3000 ms später lagen alle 129 Zeichen noch im Composer.

## 3. Der SENDER als Variable ist ausgeschlossen — es ist der Zustand der Pane

Um **11:03:29** ging ein Owner-`/send` in dieselbe Pane und wurde angenommen (`delivery: sent`;
Rollout `09:04:00.853Z` trägt den Text als `role: user`). Sieben Minuten später scheiterte der
Auto-Nudge.

Der einzige Code-Unterschied zwischen beiden Aufrufen ist `options.rollbackOwnPayload`, und der
wirkt **erst nach** dem Fehlschlag: sein zweiter Effekt `s.quietUntil` wird ausschließlich an
`server.ts:9803` gelesen und gated dort die Idle-Uhr (`s.lastOutput`), nicht die Eingabe. Die Kette
`load-buffer` → `paste-buffer -p` → `Bun.sleep(150)` → `send-keys Enter` ist für beide Pfade
byte-identisch (`server.ts#sendText`).

Folglich unterscheidet die beiden Fälle nicht der Aufrufer, sondern der Zustand der Pane im Moment
des Sendens. Beobachtet, nicht bewiesen: die zwei Fehlschläge trafen eine **zwischen zwei Turns
ruhende** Codex-Pane, die zwei Erfolge eine gerade arbeitende bzw. einen tippenden Menschen.

## 4. Zwei strukturelle Befunde, die dabei auffielen

- **Versions-Drift am Adapter.** Installiert ist `codex-cli 0.153.4`. Der Kommentar an
  `server.ts#CODEX_HARNESS` datiert Composer-Form und Readiness-Marker auf **0.147.0**
  (2026-08-22). Composer-Erkennung und Submit-Verhalten einer TUI sind genau die Art Fläche, die
  zwischen sechs Minor-Versionen wandert. Ungeprüft.
- **Es gibt keinen Submit-Vertrag am Harness.** Das `Harness`-Interface deklariert `composer` und
  `readiness`, aber nichts über das Abschicken. `paste-buffer -p` + 150 ms + `Enter` steht fest
  verdrahtet in `server.ts#sendText`; eine **zweite, abweichende** Kopie (`paste-buffer -p -d`,
  400 ms) steht in `summaryViaSession` (server.ts:10536). Braucht ein Harness eine andere
  Submit-Form, gibt es heute keine Naht, an der er das sagen könnte — und die zwei Kopien driften
  unbeobachtet.

## 5. Der kleinste belegte Folgeschritt

Eine **read-only Messlane**, kein Code-Schnitt — damit kollidiert sie nicht mit K1 (`f4889e3c`),
die `server.ts` hält.

Scratch-Codex-Pane auf eigenem tmux-Socket (Muster `e2e-isolated.sh`, NIE `-L claudefleet`), dort
dieselbe 129-Zeichen-Nutzlast wiederholt zustellen und **jeweils eine** Variable ändern:

1. Pane **ruhend** (seit >5 min kein Turn) gegen Pane **gerade fertig** — die Trennung aus §3.
2. Wartezeit zwischen Paste und Enter: 150 ms gegen deutlich länger.
3. `paste-buffer -p` gegen `paste-buffer -p -d` (die zweite Form aus `summaryViaSession`).

**Wahrheitsquelle ist die Rollout-Datei der Scratch-Session**
(`~/.codex/sessions/**/rollout-*-<sessionId>.jsonl`: erscheint die Nutzlast als `role: user`?),
**nie** der Composer-Glyph — §2 zeigt, warum der Glyph hier nicht als Zeuge taugt.

**Gegenprobe in jedem Lauf:** vorher getippter Text muss unverändert im Composer stehen bleiben;
ein Lauf, der ihn anfasst, ist ein Fehlschlag der Sonde, kein Ergebnis.

**Done:** je Variable eine Zeile „angekommen / nicht angekommen" mit der Rollout-Zeitmarke, und
benannt, welche der drei Variablen den Unterschied macht. Ergibt keine einen Unterschied, ist das
Ergebnis „an 0.153.4 unter diesen drei Variablen nicht reproduzierbar" — auch das ist ein Ergebnis
und beendet den Schritt.

**Stopplinie:** keine Änderung an `ACCEPT_WAIT_MS`, an der Löschlogik, am Rollback und an keiner
Zeile von `server.ts` — beides ist in K1 ausgeschlossen, und der Befund braucht erst eine Messung.
