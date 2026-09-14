---
frage: Senkt das Quellpaket im Lane-Brief die Erdungskosten bis zum ersten produktiven Marker, getrennt vom Effekt des Karten-Kopfs?
urteil: Kein messbarer Quellpaket-Effekt. Bei gleicher Karten-Schicht liegen A und B 1 bis 2,5 Bash-Aufrufe auseinander (ohne KARTE 20,5 gegen 18 bei n=10/5, mit KARTE 8 gegen 9 bei n=3/11); der Abstand 8 gegen 52 ist ein Marker-Artefakt (Basislinie mit Edit/Write-Marker 24,5, n=34); Profile je Modellklasse (21ade485) haben einen Sensor nur fuer Claude-Harness-Klassen und ohne Aufloesung unter dieser Streuung.
bereich: [lane-kontext, briefs, quellpaket]
belege: [lane-context-cost.ts#measureTranscript, lane-context-cost.ts#cohortRows, context-snippets.ts#renderSnippetBlock, wave-brief.ts#renderCardHead, server.ts#laneOwnerPrompts, server.ts#briefHashOf, docs/messungen/opus-lane-kontextkosten-2026-09-12.md, docs/messungen/2026-09-14-queue-intelligenz-schichten.md]
nicht-gemessen: Ursache des Wechsels von Commit- zu Edit-Markern am 09-12/13; ob Lanes das Paket gelesen haben; Tokenkosten des Pakets; codex/pi-zai-Lanes (kein Transkript); rework3d (Fenster offen)
stand: 2026-09-14
---

# Wirkung des Quellpakets auf die Erdung einer Lane

2026-09-14, Lane `fleet/260914081957-230b`, gemessen gegen den Stand `82c907db` und die Ledger im
Haupt-Checkout bis 2026-09-14 10:00 (lokal). Frage: **Kommt eine Opus-5-Lane mit einem Quellpaket
im Brief mit weniger Bash-Aufrufen und weniger Kontext zu ihrem ersten produktiven Schritt, wenn
man den Karten-Kopf getrennt ausweist?**

## Ergebnis

**1. Die Basislinie reproduziert exakt.** `bun lane-context-cost.ts --baseline 1789204092324`
(Outcome-Zeilen mit `ts` bis zum eingefrorenen Ledger-Stand der Basislinie, nur `fleet/`-Branches,
explizite Opus-5-Modelle) liefert 198 Lanes, 187 mit Marker, **Median 52 / p90 110** Bash-Aufrufe vor
dem Marker, Kontext am Marker Median 177 297, Endkontext Median 232 847,5 und bei 153/187 den Commit
als Marker. Das sind die Zahlen aus `docs/messungen/opus-lane-kontextkosten-2026-09-12.md`
Tabelle 1. Lane fuer Lane gegen deren `joined-lanes.csv` verglichen: 198/198 identisch in Bash
davor, Kontext am Marker, Endkontext und erstem Cache-Kontext.

**2. Die 52 sind ueberwiegend ein Marker-Artefakt.** Der Marker ist der erste `Edit`/`Write`/
`NotebookEdit` ODER der erste `git commit`. In der Basislinie ist er bei 153 von 187 Lanes der
Commit (Median davor 60), dann zaehlt die ganze Implementierung per Shell mit. Nur ueber die 34 Lanes
mit Edit/Write-Marker liegt die Basislinie bei **Median 24,5**. Nach Tagen (Brief-Zeit) schwenkt der
Markertyp innerhalb eines Tages: 09-12 8 von 11 Opus-Lanes mit Commit-Marker, 09-13 (Kohorte A)
6 von 19, Kohorte B 0 von 16. Zeitgleich wechselt die Claude-Code-Version in den Transkripten von
2.1.269 (11 von 12 Lanes mit UTC-Branch-Datum 09-12) auf 2.1.270 (47 von 48 Lanes mit Branch-Datum
09-13/14, eine ohne Versionsfeld). Das ist eine
Koinzidenz, keine gemessene Ursache. Der Vergleich „8/7/7/4/19 gegen 52" aus
`2026-09-14-queue-intelligenz-schichten.md` §2 vergleicht also zwei Markerregime.

**3. Kohorten.** Brief = erster owner-/auto-Prompt je Worktree-cwd in `streams/prompts.jsonl`
(dieselbe Wahl wie `server.ts#laneOwnerPrompts`); sein sha256[:12] stimmt bei allen geschlossenen
Lanes mit `briefHash` auf Receipt UND Outcome ueberein (Spalte Hash-Join `both`).
- Fenster A = 2026-09-13 01:17 bis vor 20:57: **31 Lane-Briefs** (die 33 der Kartierung sind diese
  31 plus zwei Receipts einer Program-MAIN mit `branch: main`), davon **28 mit `pfad#symbol`** und ohne
  Quellpaket (Kartierung: 29; die Differenz habe ich nicht aufgeloest), 3 ohne Symbol. Von den 28:
  19 Opus 5, 4 Fable 5.1, 5 fremder Harness (3 pi-zai, 2 codex) = nicht messbar.
- Fenster B = ab 20:57 bis 2026-09-14 10:00: 22 Lane-Briefs, **18 mit Quellpaket** (16 Opus 5, 2 codex
  nicht messbar), 4 ohne Paket (gesondert gelistet, nicht in B).
- Modellklasse: Ledger-Modell zuerst; ist es auf Outcome und Receipt `null` (10 der 35 Opus-Lanes),
  das einzige `claude-*`-Modell im Transkript. Alle 10 nannten `claude-opus-5`.
- Mediane nur ueber geschlossene Lanes (Outcome vorhanden). Laufende Lanes ab 10:00 sind ausgeschlossen.

| Gruppe | n Briefs (Modell aus Transkript) | n messbar | n mit Marker | Bash bis Marker median / p90 | n mit Edit/Write-Marker: Bash davor median | Kontext am Marker median | Endkontext median |
|---|---:|---:|---:|---:|---:|---:|---:|
| A · Opus 5 | 19 (5) | 19 | 19 | 23 / 54 | 13: 20 | 160837 | 238379 |
| A · mit KARTE | 4 (3) | 4 | 4 | 15.5 / 47 | 3: 8 | 164237.5 | 237546 |
| A · ohne KARTE | 15 (2) | 15 | 15 | 23 / 54 | 10: 20.5 | 160837 | 238379 |
| B · Opus 5 | 16 (5) | 16 | 16 | 9 / 37 | 16: 9 | 126933.5 | 196911.5 |
| B · mit KARTE | 11 (5) | 11 | 11 | 9 / 15 | 11: 9 | 118962 | 185735 |
| B · ohne KARTE | 5 (0) | 5 | 5 | 18 / 39 | 5: 18 | 128733 | 196963 |

Die Rohwerte je Zelle, nur Lanes mit Edit/Write-Marker (Bash-Aufrufe davor, sortiert):
A ohne KARTE 4, 14, 15, 18, 20, 21, 23, 23, 25, 27 · B ohne KARTE 6, 12, 18, 19, 39 ·
A mit KARTE 8, 8, 23 · B mit KARTE 4, 6, 7, 7, 8, 9, 9, 9, 12, 15, 37.
Kontext am Marker (dieselben Lanes, Median): A ohne KARTE 144 971, B ohne KARTE 128 733,
A mit KARTE 159 547, B mit KARTE 118 962. Baseline mit Edit/Write-Marker: 146 725.

**4. Lesart.**
- *Quellpaket, bei gleicher Karten-Schicht:* ohne KARTE 20,5 gegen 18 Aufrufe, mit KARTE 8 gegen 9.
  Das ist innerhalb der Streuung einer einzigen Zelle (B ohne KARTE reicht von 6 bis 39). **Kein
  Effekt nachweisbar**, auch kein Gegen-Effekt. Beim Kontext am Marker liegt B in beiden Schichten
  niedriger (−16 k ohne, −41 k mit KARTE). Die mit-KARTE-Zelle von A hat aber n=3.
- *Karten-Kopf:* in beiden Fenstern liegt die Zelle mit KARTE bei 8–9, die ohne bei 18–20,5.
  Karten-Lanes sind nicht zufaellig zugeteilt: die Karte gibt es nur fuer gueltig kartierte Zeilen.
  Eine handgeschriebene `FLAECHE:`-Zeile ohne Karte haben 6 von 15 (A) und 3 von 5 (B) Briefs der
  ohne-KARTE-Zellen. Das ist eine Korrelation, kein Karten-Effekt.
- *Kohorte B insgesamt* (Median 9 gegen A 23) mischt beides: B hat 11/16 KARTE-Lanes, A 4/19, und
  A hat 6 Commit-Marker, B keinen.
- *Ausreisser ohne Paket in B:* `260914043015-3e56` (KARTE, kein Paket) 62 Aufrufe. Das Paket
  fehlte, weil der Brief kein Symbol trug; der Ausreisser gehoert zu keiner Kohorte.

**5. Sensor fuer `21ade485` (Profile je Modellklasse).** Ein Sensor existiert jetzt, getrackt, fuer
die Klassen, die unter dem claude-Harness laufen (Opus 5, Fable 5.1): `lane-context-cost.ts`. Fuer
codex und pi-zai gibt es keinen, 8 der 53 Briefs in beiden Fenstern sind nicht messbar. Im
Receipt fehlt das Quellpaket weiterhin (Bytes/Treffer/Auslassungen, E3-Receipt-Felder in
`fleet/260914080744-e45f` offen). Bei n≤16 je Zelle und p90 37–54 loest der Sensor Unterschiede von
wenigen Bash-Aufrufen nicht auf. Ein Profil, das auf einem solchen Unterschied beruht, haette also
weiterhin keinen Beleg.

**6. rework3d** ist fuer alle Lanes beider Kohorten `null`: `land-quality.jsonl` haelt das
3-Tage-Fenster eines Lands vom 09-13/14 bis 09-16/17 offen. Kein Wert heisst nicht gemessen, nicht 0.

## Methode

Skript `lane-context-cost.ts` (getrackt, read-only, Nachfolger von `extract.py` aus
`/tmp/opus-lane-kontextkosten-2026-09-12.JSq2PO/`; Definitionen im Dateikopf unveraendert uebernommen,
Subagent-Transkripte ausgeschlossen, Git-Commit-Erkennung mit entfernten Heredocs):

```sh
bun lane-context-cost.ts --baseline 1789204092324          # Basislinie, 198/187, Median 52
bun lane-context-cost.ts --until 2026-09-14T10:00:00+02:00  # Tabellen unten
bun lane-context-cost.ts --until 2026-09-14T10:00:00+02:00 --json   # Zeilen ohne Brief-Text/Kommandos
```

Quellen unter dem Haupt-Checkout: `streams/prompts.jsonl`, `context-receipts.jsonl`,
`lane-outcomes.jsonl`, `land-quality.jsonl`; Transkripte unter
`~/.claude/projects/-Users-owner-claude-fleet-worktrees-fleet-*/*.jsonl`. Die Rohwerte je Zelle, der
Markertyp nach Tag und die Versionszaehlung habe ich einmalig aus der `--json`-Ausgabe bzw. per `grep`
auf das `version`-Feld der ersten Transkriptdatei je Lane gezaehlt; sie sind nicht Teil der
Skriptausgabe.

Die Zeilen je Lane (alle Briefs beider Fenster, auch nicht messbare und nicht zugeordnete):

| Branch | Kohorte | Brief (lokal) | Bytes | Hash-Join | KARTE | Modell (Klasse) | Harness | Disposition | Marker | Bash bis Marker | Agent bis Marker | Kontext am Marker | Endkontext | rework3d/inserted |
|---|---|---|---:|---|---|---|---|---|---|---:|---:|---:|---:|---:|
| 260912231727-631a | A-ohne-symbol | 09-13 01:17 | 8095 | both | nein | claude-opus-5[1m] (opus-5) | claude | landed | git commit | 53 | 0 | 202097 | 217418 | — |
| 260913001224-60f3 | A | 09-13 02:12 | 8005 | both | nein | claude-opus-5[1m] (opus-5) | claude | landed | Edit | 20 | 0 | 133761 | 169163 | — |
| 260913003325-6a40 | A | 09-13 02:33 | 12083 | both | nein | claude-opus-5[1m] (opus-5) | claude | landed | git commit | 34 | 0 | 171054 | 312984 | — |
| 260913010153-2f1e | A | 09-13 03:01 | 7380 | both | nein | null (opus-5, Transkript) | claude | landed | Edit | 25 | 0 | 193350 | 294513 | — |
| 260913033331-855f | A | 09-13 05:33 | 7077 | both | nein | claude-opus-5[1m] (opus-5) | claude | landed | git commit | 54 | 0 | 204313 | 221903 | — |
| 260913033340-cf72 | A | 09-13 05:33 | 6334 | both | nein | claude-opus-5[1m] (opus-5) | claude | landed | Edit | 18 | 0 | 125844 | 192551 | — |
| 260913052206-65d2 | A | 09-13 07:22 | 8327 | both | nein | claude-opus-5[1m] (opus-5) | claude | landed | Edit | 4 | 0 | 88946 | 111271 | — |
| 260913054350-777e | A | 09-13 07:43 | 8678 | both | nein | claude-opus-5[1m] (opus-5) | claude | landed | Edit | 15 | 0 | 101911 | 147573 | — |
| 260913061343-8aaa | A | 09-13 08:13 | 8340 | both | nein | claude-opus-5[1m] (opus-5) | claude | landed | Edit | 27 | 0 | 160837 | 247650 | — |
| 260913080623-293e | A | 09-13 10:06 | 9423 | both | nein | claude-opus-5[1m] (opus-5) | claude | landed | Write | 23 | 0 | 168515 | 238379 | — |
| 260913095026-db29 | A | 09-13 11:50 | 11090 | both | nein | glm-5.3 (andere) | pi-zai | landed | nicht messbar | — | — | — | — | — |
| 260913100026-c16a | A | 09-13 12:00 | 8232 | both | nein | claude-opus-5[1m] (opus-5) | claude | landed | git commit | 30 | 0 | 124498 | 353486 | — |
| 260913110228-4db7 | A | 09-13 13:02 | 11808 | both | nein | fable (fable-5.1) | claude | landed | Write | 16 | 0 | 156435 | 282447 | — |
| 260913113700-5631 | A | 09-13 13:37 | 6170 | both | nein | claude-opus-5[1m] (opus-5) | claude | landed | git commit | 30 | 0 | 219937 | 246179 | — |
| 260913123308-e1f8 | A | 09-13 14:33 | 6027 | both | nein | claude-opus-5[1m] (opus-5) | claude | landed | Edit | 14 | 0 | 153958 | 212815 | — |
| 260913123458-db6c | A | 09-13 14:35 | 8299 | both | nein | fable (fable-5.1) | claude | landed | Write | 50 | 1 | 250789 | 287281 | — |
| 260913130021-bf80 | A | 09-13 15:00 | 7023 | both | nein | claude-opus-5[1m] (opus-5) | claude | landed | git commit | 77 | 0 | 294806 | 350438 | — |
| 260913131229-394d | A | 09-13 15:12 | 7434 | both | nein | glm-5.3 (andere) | pi-zai | landed | nicht messbar | — | — | — | — | — |
| 260913134125-d0c5 | A | 09-13 15:41 | 13794 | both | nein | null (opus-5, Transkript) | claude | landed | Edit | 23 | 0 | 306093 | 429808 | — |
| 260913142340-11ec | A | 09-13 16:23 | 7619 | both | nein | fable (fable-5.1) | claude | landed | Write | 41 | 0 | 221109 | 258977 | — |
| 260913144943-655c | A | 09-13 16:49 | 8176 | both | nein | glm-5.3 (andere) | pi-zai | landed | nicht messbar | — | — | — | — | — |
| 260913153240-489a | A | 09-13 17:32 | 8519 | both | nein | claude-opus-5[1m] (opus-5) | claude | landed | Edit | 21 | 0 | 135984 | 177950 | — |
| 260913153855-07b0 | A | 09-13 17:39 | 8902 | both | ja | null (opus-5, Transkript) | claude | landed | Edit | 23 | 0 | 168928 | 255967 | — |
| 260913165448-dbf3 | A | 09-13 18:54 | 5634 | both | ja | null (opus-5, Transkript) | claude | landed | Edit | 8 | 0 | 97027 | 109802 | — |
| 260913170120-fbaf | A | 09-13 19:01 | 7707 | both | ja | null (opus-5, Transkript) | claude | landed | Edit | 8 | 0 | 159547 | 219125 | — |
| 260913170128-3d03 | A-ohne-symbol | 09-13 19:01 | 5619 | both | ja | null (opus-5, Transkript) | claude | landed | Write | 24 | 0 | 125708 | 145353 | — |
| 260913170459-2462 | A-ohne-symbol | 09-13 19:05 | 6095 | both | ja | null (opus-5, Transkript) | claude | landed | Write | 6 | 0 | 86342 | 110279 | — |
| 260913173532-ef16 | A | 09-13 19:35 | 8804 | both | ja | gpt-6-astra (andere) | codex | landed | nicht messbar | — | — | — | — | — |
| 260913180029-3682 | A | 09-13 20:00 | 7981 | both | ja | claude-opus-5[1m] (opus-5) | claude | landed | git commit | 47 | 0 | 203049 | 353006 | — |
| 260913183621-0e11 | A | 09-13 20:36 | 11589 | both | ja | gpt-6-astra (andere) | codex | landed | nicht messbar | — | — | — | — | — |
| 260913183645-12cf | A | 09-13 20:36 | 15142 | both | ja | fable (fable-5.1) | claude | landed | Write | 63 | 0 | 246671 | 283823 | — |
| 260913185718-cdc7 | B | 09-13 20:57 | 24721 | both | ja | gpt-6-astra (andere) | codex | landed | nicht messbar | — | — | — | — | — |
| 260913190951-0443 | B | 09-13 21:09 | 14942 | both | ja | null (opus-5, Transkript) | claude | landed | Write | 15 | 0 | 136492 | 208623 | — |
| 260913192423-60f4 | B | 09-13 21:24 | 13872 | both | ja | claude-opus-5[1m] (opus-5) | claude | landed | Edit | 8 | 0 | 145289 | 201048 | — |
| 260913194407-382d | B-ohne-paket | 09-13 21:44 | 6647 | both | ja | fable (fable-5.1) | claude | landed | Write | 19 | 0 | 162947 | 361515 | — |
| 260913205858-6f73 | B | 09-13 22:59 | 12904 | both | ja | null (opus-5, Transkript) | claude | landed | Edit | 7 | 0 | 100918 | 115449 | — |
| 260913221107-a536 | B-ohne-paket | 09-14 00:11 | 5479 | both | nein | claude-opus-5[1m] (opus-5) | claude | killed-empty | Write | 11 | 0 | 96954 | 118905 | — |
| 260913223851-041e | B-ohne-paket | 09-14 00:38 | 9612 | both | ja | gpt-6-astra (andere) | codex | landed | nicht messbar | — | — | — | — | — |
| 260913232606-917e | B | 09-14 01:26 | 14351 | both | ja | null (opus-5, Transkript) | claude | landed | Edit | 7 | 0 | 99300 | 125665 | — |
| 260913232630-f7b3 | B | 09-14 01:26 | 15669 | both | ja | claude-opus-5[1m] (opus-5) | claude | landed | Edit | 4 | 0 | 96380 | 185735 | — |
| 260913233638-d005 | B | 09-14 01:36 | 13046 | both | nein | claude-opus-5[1m] (opus-5) | claude | landed | Edit | 19 | 0 | 128733 | 201542 | — |
| 260914002055-ce4b | B | 09-14 02:21 | 13278 | both | nein | claude-opus-5[1m] (opus-5) | claude | landed | Edit | 6 | 0 | 86070 | 108133 | — |
| 260914003135-7232 | B | 09-14 02:31 | 12467 | both | nein | claude-opus-5[1m] (opus-5) | claude | landed | Edit | 39 | 0 | 165515 | 298910 | — |
| 260914005824-652d | B | 09-14 02:58 | 16889 | both | ja | claude-opus-5[1m] (opus-5) | claude | landed | Write | 9 | 0 | 116872 | 330104 | — |
| 260914023025-3fa0 | B | 09-14 04:30 | 14158 | both | ja | null (opus-5, Transkript) | claude | landed | Edit | 37 | 2 | 211169 | 340688 | — |
| 260914040254-a94e | B | 09-14 06:03 | 9931 | both | ja | null (opus-5, Transkript) | claude | landed | Write | 6 | 0 | 101226 | 124694 | — |
| 260914040302-0a4b | B | 09-14 06:03 | 14866 | both | ja | claude-opus-5[1m] (opus-5) | claude | landed | Write | 9 | 0 | 130997 | 198841 | — |
| 260914043015-3e56 | B-ohne-paket | 09-14 06:30 | 8369 | both | ja | null (opus-5, Transkript) | claude | landed | Edit | 62 | 0 | 294711 | 384068 | — |
| 260914060358-18d4 | B | 09-14 08:04 | 12990 | both | ja | claude-opus-5[1m] (opus-5) | claude | landed | Edit | 9 | 0 | 141957 | 172524 | — |
| 260914060406-45bc | B | 09-14 08:04 | 10430 | both | ja | claude-opus-5[1m] (opus-5) | claude | landed | Edit | 12 | 0 | 118962 | 161039 | — |
| 260914062622-2051 | B | 09-14 08:26 | 14604 | both | nein | claude-opus-5[1m] (opus-5) | claude | landed | Edit | 18 | 0 | 158343 | 196860 | — |
| 260914071328-d3e2 | B | 09-14 09:13 | 7363 | both | nein | claude-opus-5[1m] (opus-5) | claude | landed | Write | 12 | 0 | 125134 | 196963 | — |
| 260914071334-201a | B | 09-14 09:13 | 7367 | both | nein | gpt-5.6-sol (andere) | codex | shelved | nicht messbar | — | — | — | — | — |

## Was nicht gemessen wurde

- Die **Ursache** des Wechsels von Commit- zu Edit/Write-Markern zwischen 09-12 und 09-13. Die
  Versionskoinzidenz ist beobachtet, nicht geprobt.
- Ob eine Lane das Paket **gelesen** hat oder trotzdem dieselben Dateien per Bash oeffnete. Gezaehlt
  werden Aufrufe, nicht deren Ziel.
- Tokenkosten des Pakets. Der Brief waechst mit Paket von ~8 KB auf ~13–15 KB, in Tokens ist das nicht
  umgerechnet.
- Aufgabentyp und -groesse als Kovariate. Tageszeit und parallele Aenderungen im Fenster sind nicht
  kontrolliert. Der Hooks-Commit `2b9a7fe0` (getrackte `.claude/settings.json`, 09-13 17:45) ist
  Vorfahr des `forkSha` aller 16 B-Lanes und der beiden spaeten A-KARTE-Lanes mit `forkSha`
  (`fbaf`, `3682`), fruehe A-Lanes forkten vor ihm.
- codex/pi-zai-Lanes: kein Claude-Transkript, als nicht messbar gefuehrt.
- rework3d: Fenster offen (s. o.). Der Qualitaetseffekt des Pakets ist damit ebenfalls ungemessen.
- Signifikanz: bei n=3–16 je Zelle kein Test. Die Rohwerte stehen oben.

## Entscheidungs-Trail

```
ts	phase	entscheidung	warum	beleg	ergebnis
2026-09-14T08:25:00Z	korpus	Brief = erster owner/auto-Prompt je cwd, per briefHash gegen Receipt+Outcome geprueft	dieselbe Wahl wie der Server, sonst keine Join-Garantie	server.ts#laneOwnerPrompts	alle geschlossenen Lanes both
2026-09-14T08:40:00Z	baseline	Horizont = max ts des Outcome-Snapshots, nur fleet/-Branches	Basislinie globbte fleet-*; game-maker/hardening war sonst die 199.	joined-lanes.csv	198/187, Median 52, 198/198 Werte identisch
2026-09-14T08:50:00Z	modell	Ledger-null per Transkript-Modell klassifiziert	10 Opus-Lanes fielen sonst still aus den Kohorten	--json models	A 19, B 16 statt 14/13
2026-09-14T08:55:00Z	marker	zweite Spalte nur Edit/Write-Marker	Basislinie 153/187 Commit-Marker, B 0/16	Tabelle	Basislinie 24,5 statt 52
2026-09-14T09:05:00Z	ursache	Versionsprobe statt Ursachensuche	Ursache ist nicht E3; Koinzidenz benennen genuegt	version-Feld	2.1.269 -> 2.1.270 am selben Tag
```
