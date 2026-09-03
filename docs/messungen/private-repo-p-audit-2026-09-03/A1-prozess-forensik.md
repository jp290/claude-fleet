# Strang A1 — Prozess-Forensik des Private-repo-p-Laufs „Private-repo-y" in Zahlen

Fenster: **2026-08-31 16:26 → 2026-09-03 12:00 Lokalzeit (CEST) = 67,6 h.** Program
`07ee8a6dee2b36d11203db2b`, Repo `/Users/owner/private-repo-p`.
Alle Zeiten lokal. Quelle je Tabelle in der Zeile darunter.

## Was der Lauf geleistet hat (Vergleichsbasis, vor der Kritik)

In 67,6 h Wanduhr entstanden aus einer leeren Produktkarte **9 gelandete Integrationen** und ein
lauffähiger erster Slice: WorkflowPack-1.0.0-Vertrag + Validator + Schema-Negativ-Gate, eigenes
App-Target, freie Orientierung, synthetische Demo, Release-Gate mit lokalem Privacy-Check,
manueller ChatGPT/Claude-Export und Stufen-Messung — **15 039 Produktzeilen, davon 100 % aus
Lanes** (`git log --numstat 166267e^..HEAD`). Am Ende laufen 59 Unit- und 4–5 UI-Tests mit
Accessibility-Audits im Land-Gate. **Die Private-repo-o-Wurzel 1 ist geschlossen**: zwei
unabhängige Codex-Reviews (fremde Modellfamilie) liefen wirklich und gaben BEIDE `FAIL` zurück —
Brief 5 mit 2 HIGH/1 MEDIUM/1 LOW, Brief 7 mit 2 HIGH; die MAIN prüfte alle vier Befunde gegen
den Code nach und ließ die FAIL-Quittung ehrlich landen (`34612ba`, `01d99e6`). **Die Regel „MAIN
baut nicht" hielt für Produktcode**: 15 MAIN-Direktcommits, davon 11 reine Doku und 4
Beweis-Infrastruktur, 17 Produktzeilen insgesamt.

## 1. Wanduhr-Zerlegung

| Block | Dauer | Anteil |
|---|---|---|
| Lane läuft (Union aller 10 Lane-Intervalle) | 14,03 h | 21 % |
| davon Fehlstart-Lane `fda8` ohne jedes Ergebnis | 1,67 h | 2 % |
| **Warten ohne laufende Lane** | **53,54 h** | **79 %** |

Quelle: `ios-audit-log.jsonl` (`slot_open`, `land_actor`), `ios-lane-outcomes.jsonl` (`sessionMs`
deckt sich auf ±0,1 min mit slot_open→land).

| Warte-Ursache | Dauer | Beleg |
|---|---|---|
| Gate-Fehlkonfiguration unbemerkt, MAIN N0 stand (08-31 19:23 → 09-01 21:44) | 26,90 h | Verdikt 08-31 19:23:27 `sh tools/verify.sh: No such file or directory`; nächstes Ereignis erst `slot_open` 09-01 21:44:08 |
| Endblock 09-02 20:00 → 09-03 12:00 (Nacht + Owner-Pause) | 15,99 h | darin `ba896b1b` seit 09-03 08:22:33 released, nie dispatcht = 3,62 h |
| Hand-Dispatch-Latenz zwischen zwei Lands (5 Lücken) | 10,48 h | s. Tabelle unten |
| Start/Lane-Wechsel | 0,17 h | |

**Wartezeit gesamt 79 %.** Ohne den 26,9-h-Ausreißer (Fenster 09-01 21:44 → 09-02 20:01 = 22,28 h,
Lane-Union 11,21 h) bleiben **49,7 % Wartezeit** — praktisch identisch mit dem Private-repo-o-Wert.
**Dominierende Ursache ist die Hand-Dispatch-Tür**, nicht die Nacht: jede der fünf
Zwischen-Lands-Lücken hat eine `task_release`-Zeile am Anfang und eine `slot_open`-Zeile am Ende.

| Task | released | Lane-Spawn | Latenz | Ursache |
|---|---|---|---|---|
| b0ad8a79 Product-Card | 08-31 16:34:19 | 16:34:21 | 0,0 min | (noch nicht master-stopped) |
| dac21cc7 Brief 1 | 09-01 22:12:29 | 22:17:22 → killed-empty 23:57:26; Neustart 23:58:05 | 105,6 min | tmux-Prefix-Bug s1/s10, Lane ohne Agent |
| b78fe350 Brief 2 | 09-02 00:56:25 | 03:20:23 | 144,0 min | kein Attention-Ruf, Controller kam von selbst |
| 94f6b4ae Brief 3a | 04:17:07 | 05:49:32 | 92,4 min | Owner-Nudge 05:55 im Controller-Send genannt |
| e02d2285 Brief 3b | 05:51:03 | 09:05:41 | 194,6 min | Attention `10cd96f5` erst 09:05 (Nachfolge dazwischen) |
| 5b822ccc Brief 4 | 06:29:18 | 11:05:28 | 276,2 min | Attention `9c5c508a` 11:04 (Lane 3b lief teilweise parallel) |
| dfc21621 Brief 5 | 12:27:05 | 13:35:28 | 68,4 min | Attention `4d1d9968` (ohne Task-ID) + Korrektur `c4a3c8a6` |
| d7c700b1 Brief 6 | 13:56:35 | 14:26:49 | 30,2 min | Attention `730af987` |
| d5c79ce4 Brief 7 | 17:05:03 | 19:36:26 | 151,4 min | Attention `c4466aa9`, 131 min Antwortlatenz |
| ba896b1b Brief 9 | 09-03 08:22:33 | — | ≥ 217,4 min | nie dispatcht |

Quelle: `ios-audit-log.jsonl` (`task_release` / `slot_open`), `ios-attention.json`.
MAIN-Nachfolgen: 3 (09-01 21:44/21:47 Doppelstart nach Trust-Dialog, 09-02 09:03, 09-02 14:29),
Gründungsbrief 4× × 13 638 B zugestellt.

## 2. Commit-Provenienz (28 Commits `166267e..HEAD`, plus `e944452` davor)

| | Anzahl | Zeilen (+/-) |
|---|---|---|
| Aus einer Lane gelandet | 13 | 16 156 |
| MAIN direkt auf main | 15 | 601 |
| davon reine Doku (HANDOFF/PRODUCT/PROOF) | 11 | 465 |
| davon Beweis-Infrastruktur (`scripts/*`) | 4 | 119 + 17 Produktzeilen |

**Gate-Reparaturen statt Produkt: 8 von 29 Commits (28 %).** `e944452` (sh/bash-POSIX-Syntaxfehler
im Gate-Skript), `a9b21db` (Fokus-Flake + Runner-SIGKILL-Retry), `ebcea19` (Simulator-Lease
warteschlangen statt rot), `cee2ed0` (OCR-Frame-Check auf falsche App), `3d77f15` (ALL-PASS-Tails)
— alle MAIN; plus `d749111` (Gate-Laufzeit unter das Budget), `a4f8f08`, `b5c62cd`
(UI-Toggle-Race) auf Lane-Branches. Nur `d749111` ist Opus-signiert; `a4f8f08` und `b5c62cd`
tragen `Co-Authored-By: Claude Fable 5.1` — zu ihren Zeitpunkten (10:55, 15:37) liefen beide MAINs
bereits auf Opus 5 [abgeleitet: sie stammen aus einer Fable-Session außerhalb der Program-MAIN].

Quelle: `git log --format=%B --numstat`, `ios-land-notes.txt` (`mainBefore..mainAfter`).

## 3. Lane-Kosten

| Lane | Modell/Harness | sessionMs | toolResultBytes | Commits | Dateien | ownerPrompts | Ergebnis |
|---|---|---|---|---|---|---|---|
| 06eb Product-Card | codex/gpt-5.6-sol/high | — | — | 2 | 1 | 0 | landed |
| fda8 Brief 1 Fehlstart | claude-fable-5-1[1m] | — | — | 0 | 0 | 1 | **killed-empty** |
| c384 Brief 1 | claude-fable-5-1[1m] | 57,7 min | 343 564 | 1 | 41 | 0 | landed |
| 8ce8 Brief 2 | claude-fable-5-1[1m] | 55,1 min | 697 289 | 1 | 14 | 0 | landed |
| 1e59 Brief 3a | claude-fable-5-1[1m] | 38,7 min | 969 596 | 1 | 12 | 0 | landed |
| **dfdb Brief 3b** | **claude-opus-5[1m]** | **118,5 min** | **5 208 596** (Read 4 937 228) | 3 | 18 | 1 | landed (2 Anläufe) |
| 3713 Brief 4 | claude-opus-5[1m] | 68,9 min | 1 116 724 | 1 | 14 | 0 | landed |
| 2f60 Brief 6 | claude-opus-5[1m] | 95,7 min | 378 116 | 2 | 16 | 1 | landed (2 Anläufe) |
| 8712 Brief 5 Review | codex/gpt-5.6-sol/high | — | — | 1 | 1 | 0 | landed (3 Anläufe) |
| 47e7 Brief 7 Re-Review | codex/gpt-5.6-sol/high | — | — | 1 | 1 | 0 | landed |

Quelle: `ios-lane-outcomes.jsonl`.

**Ausreißer dfdb:** 5,21 MB Tool-Ausgabe, davon **4,94 MB aus `Read`** — 14× so viel Lesestoff wie
die vergleichbare Lane 2f60 (0,38 MB) bei ähnlichem Diff-Umfang (18 gegen 16 Dateien). Ihr Brief
(`ios-tasks.md` TASK e02d2285, 8 019 B zugestellt) ist der längste Lane-Brief des Laufs und
verlangt fünf Bauteile inkl. einer kompletten `ReleaseAndAcceptanceView` mit ~20 benannten
Accessibility-Identifiern. Sie ist damit **der einzige „Programm statt Schnitt"-Brief** — und
zugleich die einzige Lane, deren Land am 300-s-Budget starb und die dafür einen eigenen
Performance-Commit (`d749111`) schreiben musste. Weitere Erklärung wäre nur aus dem 12,1-MB-
Transkript zu holen: **nicht geprüft**.
**Sensorlücke:** für alle vier codex-Lanes ist `sessionMs` und `toolResultBytes` `null` — die
Hälfte der Lanes dieses Laufs hat gar keinen Kostensensor.

## 4. Attention-Ökonomie (10 Rufe)

| # | ID | Art | erhoben | Latenz | beantwortet von |
|---|---|---|---|---|---|
| 1 | 31c3472a | Nachfolge | 09-02 09:02 | 0,9 min | Controller Slot 14 (Owner-Token) |
| 2 | 10cd96f5 | Dispatch-Bitte | 09:05 | 0,4 min | Controller Slot 14 |
| 3 | 646efa7e | Fleet-Mechanik (Verify-Budget) | 10:15 | 3,4 min | Controller Slot 14 |
| 4 | 9c5c508a | Dispatch-Bitte | 11:04 | 1,8 min | Controller Slot 13 |
| 5 | 4d1d9968 | Dispatch-Bitte (Task-ID fehlte) | 12:26 | 68,9 min | Controller |
| 6 | c4a3c8a6 | Dispatch-Bitte (Korrektur zu #5) | 12:27 | 68,4 min | Controller |
| 7 | 730af987 | Dispatch-Bitte | 13:56 | 30,8 min | Controller Slot 15 |
| 8 | c2141fdc | Fleet-Mechanik (Hostlast 37/49/42) | 14:18 | 9,0 min | Controller Slot 15 |
| 9 | c4466aa9 | Dispatch-Bitte | 17:26 | 131,2 min | Controller |
| 10 | ce7f9e1e | Fleet-Mechanik (Audit-Adjudikation) | 09-03 11:54 | **offen** | — |

**Dispatch-Bitten 6 · Fleet-Mechanik 3 · Nachfolge 1 · Produktentscheide 0.**
Median-Latenz 9,0 min, Summe 5 h 15 min. Alle neun Antworten tragen `by: "owner"`, ihr Text ist
aber durchgehend mit `[Fleet Controller Slot 10/13/14/15]` gezeichnet: **der Mensch hat keinen
einzigen Attention-Ruf beantwortet** — er berührte den Lauf zweimal per Pane-Text (09-02 17:21
Status+Video, 17:39 Dank), beide außerhalb des Attention-Kanals.
Quelle: `ios-attention.json`, `ios-prompts.jsonl`.

## 5. Verifikation und Audit

**16 Land-Versuche für 9 Lands (7 Fehlschläge = 44 %).** Gate-Wanduhr gesamt 64,0 min, davon
**26,7 min (42 %) auf Versuchen, die nichts landeten.**

| Land | verify ms | Ereignis |
|---|---|---|
| f155520 | 122 551 | (Vorversuch 08-31 19:23: `tools/verify.sh` existiert nicht, 1 s) |
| 91e6a77 | 146 302 | 2 Fehlversuche davor (113 s, 10 s) |
| 889d585 | 192 742 | |
| e6cdf61 | 193 893 | |
| a4f8f08 | 248 998 | Fehlversuch 10:08 **TIMED OUT nach 300 s** → Budget 10:17 global auf 480 s |
| 466f318 | 191 041 | |
| b5c62cd | 451 923 | Fehlversuch 15:28 `FAIL native tests: xcodebuild exited 65` (UI-Toggle-Race unter Last) |
| 34612ba | 350 684 | 2 Fehlversuche: 13:55 exit 65, 14:31 **TIMED OUT nach 480 s** |
| 01d99e6 | 335 846 | |

Quelle: `ios-land-notes.txt`, `ios-prompts.jsonl` (Land-Verdikte), `ios-audit-log.jsonl`
(`self_land_start`). Die Gate-Dauer wuchs mit der Suite von 122 s auf 452 s (3,7×) — das
480-s-Budget hat bei 452 s noch 6 % Luft.

**9/9 Post-Land-Audits `unknown`.** 5× lokal `exit 42` („audit skipped: not the fleet repo"),
4× über das Helfer-Portal `exit 127` („Bun could not find a package.json"). Erzeugte Kosten,
belegt: 4 vollständige Repo-Bundles gebaut, übertragen und auf einer fremden Maschine geklont für
Läufe, die strukturell nie messen konnten (`ios-tasks.md` TASK 02131402) · zwei Steward-Tasks
(`516b70a9` gebaut und gelandet, `02131402` seit 09-02 17:01 pending) · als Kompensation fuhr die
MAIN das Gate 5× von Hand nach (352/244/188/496 s, `ios-tasks.md` TASK 9f65abf1) ≈ 21 min
Hostlast auf derselben 8-GB-Maschine · zwei Ack-Turns für Ereignisse, die nie eine Aussage
trugen.
**Und der Kanal lief rückwärts:** die drei Nachrichten „Unbeurteiltes Audit-Ereignis" (09-02
21:44, 09-03 04:15, 09-03 11:53) an die iOS-MAIN betreffen **claude-fleet-Lanes**
(`fleet/260902162622-dbae`, `…260903010318-95c4`, `…260903085422-54d7`, 22/3508/3515 Checks) —
fremde rote Audits in einer Pane, deren Program sie nichts angehen. Sie sind der ganze Inhalt der
letzten 16 h dieser MAIN und die Ursache der noch offenen Attention `ce7f9e1e`.

## 6. Zustell-Rauschen an die MAIN

76 der 117 Zustellungen gingen in die MAIN-Panes (Slot 3/4, cwd `private-repo-p`):

| Klasse | an MAIN | gesamt |
|---|---|---|
| merge-Ereignisse | 14 | 14 |
| Worker-Reports | 11 | 11 |
| Attention-Antworten (Echo des eigenen Textes) | 9 | 9 |
| Post-Land-Audit-Ereignisse (alle `unknown`) | 9 | 9 |
| Controller-Sends | 10 | 15 |
| Harness-Task-Notifications | 10 | 22 |
| Gründungs-/Nachfolgebrief | 5 | 5 |
| unbeurteilte Fremd-Audits | 3 | 3 |
| Pane-Steuerung (`/model`, `resume`) | 3 | 6 |
| **Owner-Text (Mensch)** | **2** | **2** |
| Lane-Briefs / Land-Verdikte (an Lanes) | 0 | 18 |

**Reines Maschinen-Echo: 32 der 76** (merge + Attention-Echo + Audit-Ereignisse) — 42 % dessen,
was in eine MAIN-Pane fiel, war eine Quittung ohne Entscheidung. Doppelungen: Gründungsbrief 4×
identisch à 13 638 B (einmal davon vom Trust-Dialog gefressen, 09-01 21:44 → Wiederholung 21:47);
Brief 1 2× identisch à 5 615 B (Fehlstart-Lane); Land-Verdikt `2f60` **zweimal in derselben
Sekunde an Slot 14** (15:36:00 `terminal` + 15:36:01 `auto`, byte-identisch 994 B); die
Budget-Meldung an Slot 12 zweimal (10:18:31 `uncertain`, 10:18:56 nachgetippt). **4 der 18
Owner-Sends (22 %) kamen ohne bestätigte Zustellung zurück** (3× `uncertain`, 1× `unobserved`).
**Kontext-Pack-Schicht war komplett inert:** alle 18 Brief-Quittungen zeigen `selected: []` und
sechs Packs `omitted: source-unavailable` — jeder Brief war roher Text.
Quelle: `ios-prompts.jsonl`, `ios-context-receipts.jsonl`.

## 7. Private-repo-o ↔ Private-repo-y

| Maß | Private-repo-o (08-29/30) | Private-repo-y (08-31…09-03) |
|---|---|---|
| Wanduhr | 19 h 41 min | 67,6 h (bereinigt 22,3 h) |
| Wartezeit | 52 % | **79 %** (bereinigt 49,7 %) |
| Lanes gespawnt / gelandet / verworfen | 12 / 11 / 1 killed-dirty | 10 / 9 / 1 killed-empty |
| MAIN-Nachfolgen | 0 (eine MAIN) | **3** |
| MAIN-Direktcommits | 14 docs + 1 chore | 11 docs + 4 Beweis-Infra |
| Produktcode aus Lanes | 13/13 Commits | 13/13 Commits (15 039 Zeilen) |
| Attention Fleet : Produkt | 4 : 1 | **10 : 0** |
| Post-Land-Audit `unknown` | 11/11 | **9/9** |
| Land-Versuche pro Land | nicht erhoben | 16 / 9 = 1,78 |
| Fremder Critic | **lief nie** | **2× gelaufen, 2× FAIL, 6 Befunde bestätigt** |
| Owner hat das Produkt selbst bedient | nein | **nein** (nur 134-s-Testvideo gesehen) |

## Gerankte Befunde (nach Folgekosten)

1. **Ein Land-Verdikt ohne Adressaten kostete 26,9 h — 40 % der Wanduhr.** Kette: Repo-Verify war
   auf `sh tools/verify.sh` konfiguriert, die Datei existiert nicht → Verdikt 08-31 19:23:27 ging
   an die *Lane* (Slot 5), nicht an die MAIN → MAIN N0 (Slot 4) stand danach ohne Ereignis →
   niemand pollte → erst der Neustart am 09-01 21:44 fand es, und der Fix `e944452` deckte
   zusätzlich einen zweiten Fehler auf (macOS `sh` ist bash-3.2-POSIX, `exec > >(tee …)` ist dort
   Syntaxfehler, „jeder Gate-Lauf schlug fehl, bevor irgendetwas verifiziert wurde"). **Fehlt:**
   ein Vor-Flug, der das konfigurierte Verify-Kommando EINMAL fährt, bevor das Program startet —
   und eine Zustellung des Verdikts an die MAIN, nicht nur an die Lane.
2. **Die Hand-Dispatch-Tür kostete 10,5 h Leerlauf und 6 der 10 Attention-Rufe.** Der Dispatcher
   war master-stopped, also brauchte jede Lane einen Attention-Ruf + eine Controller-Antwort;
   zweimal (`4d1d9968`/`c4a3c8a6`) ging dabei die Task-ID verloren und musste per zweitem Ruf
   nachgereicht werden. Die MAIN hat das selbst vermessen: „5 Owner-Round-Trips" für 3 Dispatches
   (`ios-tasks.md` TASK 9f65abf1). Die Latenz war nicht konstant, sondern wuchs, je beschäftigter
   der Controller war (0,4 min früh, 131 min um 17:26). **Fehlt:** genau die Tür, die es im
   Private-repo-o-Audit als V4/V5 schon als Vorschlag gab — eine Freigabe der gebundenen MAIN, die
   auch startet.
3. **9/9 Audits `unknown` — dieselbe Klasse wie im Private-repo-o, ein Lauf später ungefixt, jetzt
   mit Zusatzkosten.** Neu gegenüber 08-30: das Helfer-Portal bündelt seit `FLEET_AUDIT_HELPER_
   GRACE_MS=60000` das private-repo-p-Repo und schickt es auf eine fremde Maschine — 4× für `exit
   127`. Kosten in diesem Lauf: 2 Steward-Tasks, 21 min Hand-Gate-Läufe der MAIN, 9 Ack-Turns,
   1 offene Attention. **Fehlt:** `not-applicable` statt `unknown`, und eine Eignungsprüfung vor
   dem Bundle (beide bereits als Task `02131402` bzw. Vorschlag V6 formuliert, keiner promotet).
4. **44 % der Land-Versuche landeten nichts, und drei davon waren Hostlast, nicht Baumfehler.**
   Zwei Timeouts (300 s, 480 s) und zwei `xcodebuild exit 65` auf Bäumen, die in ruhigeren Läufen
   grün waren (`b5c62cd`-Body: „grün in den zwei Läufen des Workers und in jedem ruhigeren Lauf",
   Last 20–33). Ein Gate, das auf einer 8-GB-Maschine mit ~30 Sessions gegen einen Simulator
   fährt, ist ein Lastmesser, kein Baumurteil. Direkte Folgekosten: 3 zusätzliche Commits
   (`d749111`, `a4f8f08`, `b5c62cd`), ein globaler Fleet-Budget-Eingriff für ein Fremd-Repo,
   26,7 min Gate-Zeit. **Fehlt:** eine Lastschranke vor dem nativen Gate — die Hostlast-Attention
   `c2141fdc` stellte die Frage, beantwortet wurde sie mit „warte kurz".
5. **Der Brief-Kanal hat keinen Deckel und keine Auswahl.** Ein 8-KB-Brief (3b) erzeugte die
   teuerste Lane des Laufs (118,5 min, 4,94 MB gelesen); der Gründungsbrief wurde 4× vollständig
   zugestellt; 42 % dessen, was eine MAIN-Pane erreichte, war Maschinen-Echo ohne Entscheidung;
   die Kontext-Pack-Auswahl lieferte in 18/18 Fällen nichts. **Fehlt:** ein Schnitt-Kriterium für
   Briefumfang und die Kürzung der Echos (die MAIN schlug selbst `{ok,id}` statt Volltext-Echo
   vor, ~12 KB/Session).

**Schnittlinie.** Darunter beobachtet, aber nicht gerankt: der tmux-Prefix-Bug `s1`/`s10` (kostete
100 min und eine leere Lane, war am selben Abend gefixt); 22 % unbestätigte Owner-Sends; die
doppelte Land-Verdikt-Zustellung an Slot 14; die fehlende Kostensensorik für codex-Lanes.

## Verifiziert / Abgeleitet / Nicht geprüft

**Verifiziert** (aus Werkzeugausgaben): alle Zeiten und Dauern aus `ios-audit-log.jsonl`,
`ios-land-notes.txt`, `ios-attention.json`, `ios-prompts.jsonl`, `ios-context-receipts.jsonl`,
`ios-lane-outcomes.jsonl`; die Commit-Zerlegung aus `git log --numstat 166267e^..HEAD` und den
`mainBefore..mainAfter`-Spannen der Land-Notes; die Commit-Bodies von `e944452`, `a9b21db`,
`ebcea19`, `cee2ed0`, `3d77f15`, `d749111`, `a4f8f08`, `b5c62cd`, `c40a64f`; die Private-repo-o-
Vergleichszahlen aus `docs/messungen/2026-08-30-game-maker-workflow-audit-synthese.md` §Wurzel 2
und §„Was der Lauf geleistet hat".

**Abgeleitet:** die Zuordnung von `a4f8f08`/`b5c62cd` zu einer Fable-Session außerhalb der
Program-MAIN (aus `Co-Authored-By` gegen den Modellstand der MAINs); die Ursache des
26,9-h-Blocks als „Verdikt ohne Adressaten" (belegt sind Verdikt und Ereignisstille, nicht die
Innensicht der MAIN N0); die Zuordnung der Wartelücken zu genau einem wartenden Task (jede Lücke
hat genau eine offene `task_release`-Zeile); dass die drei Fremd-Audit-Nachrichten wegen der
Pane-Adressierung und nicht wegen einer Repo-Zuordnung bei Slot 4 landeten.

**Nicht geprüft:** die sechs claude-Lane-Transkripte und die zwei Codex-Rollouts (also die
Innensicht der dfdb-Lesekosten und der Codex-Reviewzeit); die drei MAIN-Transkripte; das Video;
`scripts/verify.sh` selbst; ob innerhalb der 26,9 h jemand am Repo arbeitete (kein Ledger führt
es); die Frage, ob die Hostlast von diesem Program oder von fremden Sessions kam (die Attention
`c2141fdc` nennt fremde Verursacher, ich habe sie nicht nachgemessen).
