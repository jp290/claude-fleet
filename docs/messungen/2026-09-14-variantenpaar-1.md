---
frage: Variantenpaar 1 (E4, Paarung von Hand) — zwei Lanes, gleicher Brief (`land-quality.ts`, Zeilen 0e6b7d3d und 7eb74615), Opus 5 high gegen codex gpt-5.6-sol high. Welche landet, nach der Regel aus 2026-09-14-queue-intelligenz-schichten.md §5 E4 (DONE je Teil > Suite gruen > kleinerer Diff), ohne Owner-Stufe?
urteil: VARIANTE A (Opus 5, Branch fleet/260914071328-d3e2, Commit daacdab9) landet, Stufe 1 entscheidet — sie reproduziert die Probe aus §3 exakt (fix3d(code) opus 20/84, codex 7/16; vom Orchestrator selbst nachgerechnet, 21 s @378deae8), Variante B (codex, fleet/260914071334-201a, 7e758850) liefert 22/84 und loest fuer 130 Lands den Harness nicht auf. Stufe 2 und 3 haetten B bevorzugt (volle lokale Kette ALL PASS; 386 statt 409 Zeilen), kommen aber nicht zum Zug. Verlierer shelved, Branch bleibt.
bereich: [varianten, land-quality, modellklassen, codex, opus]
belege: [eigene Laeufe beider Skripte am 2026-09-14 10:0x (A: --since 14d --at 378deae8; B: --since 14d am Tip bb546bf2, kennt kein --at), Lane-Reports 1be9850b (A) und 40371c84 (B), Pane-Tails Slot 1 und 3, git diff --stat main...HEAD je Worktree]
nicht-gemessen: der Server-Land-Gate fuer A (laeuft nach dieser Notiz ueber Slot 5); warum B fuer 130 Lands harness=unknown liefert (nicht untersucht); ob Bs +2 eine UTC-Tagesgrenzen-Definition ist (B behauptet es, A reproduziert die Probe mit Commit-Zeit-Semantik); Tokenkosten je Lane (nur ctx-Prozent)
stand: 2026-09-14
---

# Variantenpaar 1: `land-quality.ts`, Opus 5 gegen codex gpt-5.6-sol

Beide Zeilen tragen denselben Brief (E2, `land-quality.ts` — Zeilen-Nacharbeit und Audit-Rot je Land
als abgeleitetes Ledger). Beide wurden 2026-09-14 07:13Z ueber den Hand-Dispatch mit Spawn-Tripel
gestartet, damit die zweite das Land der ersten nicht sieht. Vergleich nach §5 E4, ohne Owner.

## 1. Die beiden Ergebnisse

| | A · Opus 5 high (Slot 1) | B · codex gpt-5.6-sol high (Slot 3) |
|---|---|---|
| Branch / Commit | `fleet/260914071328-d3e2` / daacdab9 | `fleet/260914071334-201a` / 7e758850 |
| Diff | 4 Dateien, +409/-0 (Skript 370, verify-tiering §6.3 +28, state.sh +10, .gitignore +1) | 4 Dateien, +386/-0 (Skript 372, verify-tiering +12, state.sh +1, .gitignore +1) |
| Lane-Laufzeit | ~15 min (Report 09:28 lokal) | ~54 min („Worked for 53m 49s") |
| Kontext am Ende | 20 % von 1M | 71 % von 258 400 |
| CLI | `--since --at --json --summary --out --root` | `--since --json` (kein `--at`: „jetzt" ist immer der Tip) |
| Laufzeit `--since 14d` (eigener Lauf) | 20,9 s, 812 blame-Aufrufe | 125,0 s |
| fix3d(code) opus / codex | **20/84 · 7/16** (Probe exakt) | 22/84 · 7/16 |
| rework3d (irgendein Commit) opus | 63/100 | — (B kennt nur die eine Spalte) |
| Harness-Aufloesung | claude 192 · codex 29 · pi-zai 17 | unknown 130 · codex 23 · pi-zai 14 |
| auditRed opus / codex | 28/134 · 5/28 (nicht-flake, auch unadjudiziert) | 7/100 · 0/23 (nur Rot, dessen covers[] die Branch nennt) |
| state.sh | liest `--summary` aus dem geschriebenen Ledger, 60-s-Timeout, UNKNOWN-Zeile bei Fehlen | ruft den vollen Blame-Lauf bei jedem `./state.sh` (+125 s je Aufruf) |
| Lokale Verifikation (eigenes Wort) | install, pins 561 ALL PASS, tsc strict exit 0, build exit 0; die drei Gate-Suiten nicht lokal | volle Kette inkl. Suiten, Tail ALL PASS |
| Determinismus | zwei Laeufe @378deae8 byte-identisch | zwei Laeufe 122 s / 122 s byte-identisch |

Die Zahlen der Zeilen „fix3d", „Harness", „auditRed" stammen aus meinen eigenen Laeufen, nicht aus den
Reports; die Laufzeiten ebenso. Bs Lauf sah einen um ein Land (bb546bf2) neueren Tip als As Lauf.

## 2. Die Regel, Stufe fuer Stufe

1. **DONE je Teil** (Skript laeuft, Zahlen reproduzierbar gegen die Probe in §3: opus 84/20, codex 16/7):
   A erfuellt es exakt und erklaert nebenbei die Definitionsfrage (die Probe nannte „rework3d", meinte
   aber die `fix…`-Code-Variante; beide Spalten stehen in As Aggregat). B liefert 22/84 und begruendet
   das mit einer fehlenden Zeilenliste der Probe — A zeigt, dass die Probe reproduzierbar ist.
   **A gewinnt hier, und damit ist entschieden.**
2. Suite gruen: B fuhr die volle Kette lokal, A nur install/pins/tsc/build; der Server-Gate misst A beim
   Land. Haette gezaehlt, wenn Stufe 1 gleich gewesen waere — dann fuer B.
3. Diff: B 386 < A 409 Zeilen, gleiche vier Dateien. Ebenfalls fuer B, ebenfalls ohne Wirkung.

Zwei Befunde neben der Regel, die beim Bau des Mechanismus (E4, `variants[]`) zaehlen:
- **Ein DONE-Satz mit Zahl trennt.** Ohne die Probe-Zahlen im Brief haette Stufe 1 beide als erfuellt
  gelesen und B waere ueber Stufe 2/3 gelandet — mit einem state.sh, das jede Session 2 min kostet, und
  einer Harness-Spalte, die 130 Lands nicht zuordnet. Die Zahl im DONE ist der ganze Unterschied.
- **Der kleinere Diff war der schlechtere.** Stufe 3 misst Kuerze, nicht Guete; sie darf nur den
  Gleichstand aufloesen, nie eine Stufe ueberstimmen.

## 3. Was daraus folgt

- Slot 5 (Program-MAIN Fleet-Betrieb) landet A; 7eb74615 wird shelved, `fleet/260914071334-201a`
  bleibt als Datum.
- Der erste Datenpunkt fuer E4: Opus 15 min / 20 % gegen codex 54 min / 71 %, beide mit landbarem
  Ergebnis, nur eines trifft das DONE. Ein Paar ist kein Trend.
- Nach dem Land von A gilt `docs/verify-tiering.md` §6.3 als Beschreibung; `./state.sh` zeigt das
  14-d-Aggregat aus dem Ledger.
