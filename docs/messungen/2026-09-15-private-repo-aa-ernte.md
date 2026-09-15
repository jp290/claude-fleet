---
frage: Was laesst sich aus dem Private-repo-aa-Auftrag (Slot 12, Astra xhigh, ~/private-repo-aa, 2026-09-15 15:39–16:34) mechanisch gewinnen, und wo weicht der Selbstbericht der Session vom Rollout ab?
urteil: Der Rollout traegt alles, was der Selbstbericht als „nicht erfasst" fuehrt — Tokens je Agent, Tool-Bytes, Kuerzungen, Kontingent vorher/nachher. Ein 55-min-Lauf mit sieben Sub-Agents kostete 8 Punkte des Wochenkontingents; 29 von 123 Tool-Ausgaben wurden gekuerzt (385 k Original-Tokens). Die vier Pruefrunden lieferten 0 / 4 / 2 / 0 Befunde. Drei Selbstbericht-Claims sind am Rollout korrigierbar.
bereich: [codex, rollout, kontingent, sub-agents, pruefrunden, private-repo-aa, fleet-reibung]
belege: [~/.codex/sessions/2026/09/15/rollout-2026-09-15T15-39-22-01a0a54b-*.jsonl (Root) und sieben Kind-Rollouts 15-40-54 … 16-15-52 (agent_path /root/<name>); ~/private-repo-aa git log 573f28d..f8dfcec; docs/plan/ERFAHRUNG.md, PRUEFRUNDEN.md, FLEET-REIBUNG.md, KONTINGENT.json im Private-repo-aa-Repo]
nicht-gemessen: Kontextfuellung je Zeitpunkt (nur Endstand 81 % vom Board); was ohne einen Sub-Agent gefunden worden waere (kein Vergleichslauf); ob die Kuerzungen Folge-Reads ausloesten (die Reads sind da, die Kausalitaet nicht).
stand: 2026-09-15
---

# Private-repo-aa-Ernte, 2026-09-15

Orchestratorin Slot 3. Der Owner wollte aus diesem Lauf „das meiste an Info/Daten" gewinnen. Vier
Quellen, in der Reihenfolge ihrer Verlaesslichkeit: Rollout (mechanisch) · Git · die von der Session
selbst geschriebenen Pruef-/Reibungs-Dokumente · der Selbstbericht (`ERFAHRUNG.md`, ein Claim).

## 1. Rollout, mechanisch (token_usage_record.usage summiert; custom_tool_call_output Bytes)

| Agent | Rolle | Dauer | Input | davon cached | Output | exec | Tool-Out KB | gekuerzt (Orig-Tokens) | Kontingent |
|---|---|---|---|---|---|---|---|---|---|
| ROOT | Auftrag + Selbstbericht | 54,4 min | 9 907 280 | 97,7 % | 67 099 | 49 | 354 | 6 (64 397) | 42,0 → 50,0 |
| daten_recherche | Recherche | 5,8 min | 2 223 761 | 92,5 % | 8 104 | 19 | 461 | 3 (39 443) | |
| ios_recherche | Recherche | 3,8 min | 1 079 197 | 90,8 % | 5 829 | 12 | 347 | 3 (41 726) | |
| orte_recherche | Recherche | 4,4 min | 821 444 | 89,4 % | 7 063 | 10 | 272 | 4 (45 905) | |
| pruefung_1_owner | Review R1 | 2,4 min | 483 992 | 86,7 % | 3 050 | 8 | 220 | 4 (54 520) | |
| pruefung_2_fleet | Review R2 | 3,1 min | 782 731 | 91,4 % | 4 940 | 10 | 217 | 4 (54 869) | |
| pruefung_3_einwand | Review R3 | 3,4 min | 794 175 | 87,8 % | 5 342 | 10 | 319 | 3 (53 649) | |
| pruefung_4_abschluss | Review R4 | 1,5 min | 269 166 | 84,4 % | 2 483 | 5 | 136 | 2 (30 805) | |
| **Summe** | | | **16 361 746** | **94,8 %** | **103 910** | **123** | **2 326** | **29 (385 314)** | **+8 Punkte** |

Kontrolle zum Kontingent: `primary.used_percent` ist ein KONTOWEITER, ganzzahliger Zaehler und traegt jede gleichzeitige Codex-Session mit. Geprueft 17:5x: keiner der 14 in den letzten 6 h geschriebenen Rollouts ausserhalb dieses Laufs hat zwischen 13:39:48 und 14:34:12 Z ein `token_usage_record`. Die +8 Punkte gehoeren damit diesem Lauf (±1 durch Rundung). Sol (`gpt-5.6-sol`) zieht am selben Fenster (`limit_id codex`, Rollout 2026-09-14T09-13-37); ob es pro Token billiger ist, ist ungemessen.

Alle acht auf `gpt-6-astra` / `xhigh` (die Kinder erben den Effort; `fork_turns: none`, kein
Kontext-Fork). Kompaktierungen: 0 in allen acht Rollouts. Root-Kontext am Ende 81 % (Board).

Lesart: 95 % des Inputs ist Cache-Replay — der Verbrauch ist INPUT, wie bei den Claude-Lanes
(Regelbuch §GPT-Lane). Die 29 Kuerzungen sind der messbare Teil des Selbstbefunds „zu breit gelesen":
385 k Original-Tokens wurden vom Harness weggeschnitten, bevor sie den Kontext erreichten.

## 2. Git (Ortszeit)

12 Commits 573f28d..f8dfcec. Die ersten drei fallen auf 15:59:50–15:59:51 (20 min nach Start), der
Abschluss-Commit a450b56 auf 16:19:14, der Selbstbericht f8dfcec auf 16:34:03. Nur Docs unter
`docs/plan/`, AGENTS.md, README, .gitignore, package.json (`verify`-Script); kein Renderer-Code.

## 3. Pruefrunden (PRUEFRUNDEN.md, von der Session selbst; am Git gegengelesen)

| Runde | Achse | Befunde | Folge-Commit |
|---|---|---|---|
| R1 | Owner-Auftrag woertlich | 0 | b39b000 (nur Protokoll) |
| R2 | Fleet-Kartenvertrag, validateCard ausgefuehrt | 4 (2×P1: Verzeichnis-Bootstrap, K2/K4 Schreibkollision; 2×P2) | 3de82c5 |
| R3 | staerkster Einwand iOS/Daten | 2 (Lastprobe unrepraesentativ; Prognose als Historie) | f7e628c, 924c574 |
| R4 | Abschluss | 0 | a450b56 |

Ertrag je Runde in Tokens: R2 = 783 k Input fuer 4 Befunde, R3 = 794 k fuer 2, R1+R4 = 753 k fuer 0.
Die Session sagt selbst: eine Stoppregel „Abbruch nach erstem Nullbefund" haette R2/R3 verhindert;
die drei vorgeschriebenen Achsen trugen mehr als die Stoppregel.

## 4. Selbstbericht gegen Rollout — drei korrigierbare Claims

1. **„Anfangsmessung lieferte keinen Kontingentwert."** Falsch gelesen, nicht fehlend: das erste
   `token_count`-Ereignis des eigenen Rollouts (13:40 Z) traegt `primary.used_percent 42.0`. Das
   Rezept `ls -t … | head -1` zeigte auf den eigenen, noch leeren Rollout. Damit ist die
   Auftragsdifferenz messbar: 42,0 → 49,0 beim Abschluss, 50,0 nach dem Selbstbericht.
2. **„rund 40 Minuten."** Auftrag 15:39–16:19 = 39,5 min stimmt; der Rollout laeuft 54,4 min, weil der
   Selbstbericht danach kam. Git allein belegt 20 min — die Session hat das selbst benannt.
3. **„keine belastbaren Tokenanteile je Phase/Agent."** Stehen im Rollout (Tabelle §1). Was fehlt, ist
   nur die Phase INNERHALB des Root-Turns; die Kinder sind sauber getrennt.

## 5. Fleet-Reibung, die Fleet gehoert (aus FLEET-REIBUNG.md, 14 Zeilen; die uebrigen sind Repo-lokal)

- `AGENTS.md:163` sagt „untracked path ungueltig", `card-extract.ts` kennt `surface.creates` — die
  echte Regel ist „direkter Elternordner muss getrackt sein". Prosa-vs-Code, Code gilt; Doc-Zeile.
- Der Kartenvalidator prueft den Verify-Befehlstext, nicht das Bestehen kuenftiger DONE-Tests
  (bekannt, `card-extract.ts:180/211`).
- Das Kontingent-Rezept in `docs/astra-auftraege.md` (`ls -t`) ist waehrend eines Laufs mit
  Sub-Agents unzuverlaessig — die Zeile 5278d2fb verlangt zu Recht „aus dem exakt gebundenen Rollout".
- Ein Shell-Hook (global, nicht Fleet) wies eine Doc-Schreibung ab, weil der TEXT ein verbotenes
  Flag nannte.

## 6. Was Fleet automatisch mitschreiben sollte — der Rollout hat die Felder schon

`ERFAHRUNG.md` §8 wuenscht Phasen, Tool-Bytes, Kuerzungen, Agent-Verbrauch, Kontingent je Sitzung.
Die Felder existieren im Rollout: `token_usage_record.usage` je Response, `custom_tool_call_output`
mit dem Marker `truncated output (original token count: N)` und `Wall time N seconds`,
`spawn_agent`-Argumente (`task_name`, `fork_turns`), `agent_path` in `session_meta` der Kinder,
`rate_limits.primary` in jedem `token_count`. Die Queue-Zeile `fcff67db` (Codex-Rollout-Leser) ist
damit ein Parser ueber bekannte Pfade, kein Forschungsauftrag; diese Notiz ist ihr Eingabe-Auszug.

## 7. Was aus dem Lauf NICHT zu holen ist

Kontextfuellung ueber die Zeit (nur der Endstand), Kausalitaet Kuerzung → Folge-Read, und jede
Aussage „ohne Agent X haette …" (kein Vergleichslauf). Der Selbstbericht markiert das selbst als
`[Erinnerung]`; das ist korrekt und bleibt so.
