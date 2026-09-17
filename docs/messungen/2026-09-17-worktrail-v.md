---
frage: Was sagt die Qualitaet einer gelandeten Lane (Zeilen-Nacharbeit, Audit-Rot) ueber Modell, Harness, Groesse, Brief-Bytes, Quellpaket und Karte — die Verknuepfung, die Worktrail IV als fehlend benannt hat — und welche stehende Kennzahl traegt diesen Vergleich?
urteil: Die Verknuepfung ist gebaut und sie widerlegt zuerst ihre eigene vorgeschlagene Kennzahl. Das binaere `rework3d %` ist ein Diff-GROESSEN-Proxy, kein Modell-Signal: es steigt ueber die Einfuege-Zeilen von 18 % (<50 Zeilen) auf 89 % (>=400), waehrend der ANTEIL nachgearbeiteter an eingefuegten Zeilen flach bleibt (1,13 / 2,52 / 2,13 / 3,30 %) — stratifiziert bleibt zwischen opus-5 und gpt-5.6-sol kein messbarer Unterschied (2,68 % gegen 1,97 %, n=108 gegen 10). Das zweite Qualitaetsfeld traegt noch weniger: von 90 roten Audits in 14 Tagen sind 4 als `real` adjudiziert, 33 als `flake`, 29 nie adjudiziert — `land-quality.ts` zaehlt 57 davon als Lane-Qualitaet, und 19 der 82 reinen Docs-Lands tragen ein Rot. Und die Verknuepfung selbst hat ein strukturelles Loch: von 74 Lands mit Quellpaket und 63 mit Karten-`size` hat KEINES ein geschlossenes 3-Tage-Fenster, von 103 mit Karte nur 18 — die drei Steuergroessen, die gebaut wurden, um gesteuert zu werden, sind juenger als das Settle-Fenster des einzigen Qualitaetssignals. Die teuerste Einzelursache im Fenster ist ein Byte: das literale NUL in `server.ts:18054` macht die Datei fuer das Quellpaket zu `binary-source` und kostet 67 von 110 Lane-Briefen (61 %) genau die Datei, um die es geht; 79 von 124 Briefen bekommen 0 Treffer. Die Reparatur ist als `2e99a34e` schon offen — ihr fehlt nur diese Kostenzeile.
bereich: [worktrail, land-qualitaet, kennzahl, modellklassen, ledger, quellpaket, karte, audit]
belege: [land-quality.jsonl (628 Zeilen, 304 im Fenster), lane-outcomes.jsonl (1084/367), context-receipts.jsonl (884/302 gejoint), cards.jsonl (362 Laeufe/206 Zeilen), post-land-audits.jsonl (703/278), audit-adjudications.jsonl (190/85), fleet.json (200 Zeilen), land-quality.ts#aggregate #renderSummary #modelKey, server.ts#buildLaneOutcome (22150) #receiptModel (29698) #laneSnippetBlock (11922), context-snippets.ts (Kopf), state.sh:186-193, docs/messungen/2026-09-13-worktrail-iv-agents-ctxpacks-fable.md, docs/messungen/2026-09-14-queue-intelligenz-schichten.md §3 §5]
nicht-gemessen: Wirkung des Quellpakets auf Erdungskosten (0 von 74 Lands mit geschlossenem Fenster — die Kontrollkohorte aus §E3 der Queue-Notiz ist weiter ungefahren); Karte gegen Nacharbeit (n=18 zu klein); Transkripte (kein Lane-Transkript gelesen, dies ist eine reine Ledger-Analyse); Fremd-Harness-Nacharbeit (glm 0, astra 0 Code-Lands mit geschlossenem Fenster); Tokenkosten; ob `releasedBy owner` kausal oder Selektion ist; Move/Copy-Erkennung in der Nacharbeits-Probe (Erbe von land-quality.ts, dort als Limit deklariert)
stand: 2026-09-17
---

# Worktrail-Analyse V — Qualitaet je Lane, gejoint

Lauf 1 der periodischen Worktrail-Analyse (E5 aus
`docs/messungen/2026-09-14-queue-intelligenz-schichten.md` §5). Read-only Opus-5-Lane auf Branch
`fleet/260917081939-36b3`. **Pflicht-Ausgang laut Auftrag: drei Auftragszeilen und eine stehende
Kennzahl** — §8 und §7.

## 0. Grundmenge, Fenster, Join

- **Fenster:** 2026-09-03 00:00 Ortszeit bis jetzt. **Beobachtungshorizont** ist nicht die Uhr,
  sondern der Stand, gegen den `land-quality.ts` zuletzt gelaufen ist: `asOf = e4d8e1ba`,
  `asOfAt = 2026-09-17 06:13:20`. Alles, was nach diesem Commit landete, ist in den
  Nacharbeits-Feldern nicht vermessen, sondern `null`.
- **Grundmenge:** 304 Zeilen aus `land-quality.jsonl` im Fenster (628 gesamt, ab 2026-08-03).
  `lane-outcomes.jsonl` kennt im selben Fenster 367 Branches (landed 327 · killed-empty 26 ·
  killed-dirty 12 · shelved 2); die Differenz zu 304 sind die Lands nach dem Horizont.
- **Join-Schluessel:** `branch` gegen `lane-outcomes` (juengstes `ts` gewinnt) und gegen
  `context-receipts` (juengstes `at`); `taskId` gegen `cards.jsonl` (juengstes `at`).
  Trefferquote: Outcome 304/304 · Receipt 302/304 · Karte 103/304.
- **Qualitaetsfelder** (alle aus `land-quality.ts`, nicht neu berechnet): `reworkLines3d` =
  eingefuegte Zeilen, die main binnen 3 d ueberschrieben hat (`git blame` der spaeteren Hunks
  gegen `base..mainAfter`); `reworkByFixSubject` = dasselbe, aber nur durch einen Commit mit
  `fix`-Subject; `auditRed` = ein messendes Audit auf `branch`+`mainAfter` war rot und seine
  NEUESTE Adjudikation ist nicht `flake`.
- **Richtungsdisziplin** wird uebernommen: unbekannt ist `null`, nie 0; jede Quote nennt ihren
  Nenner. Wo ein Nenner 0 ist, steht `—` und nicht „kein Befund".
- **Kein Transkript gelesen.** Dies ist eine Ledger-Analyse; Worktrail IV war die Transkript-Analyse.
  Keine zweite Ledger-Kopie angelegt, kein `ps` aufgerufen.

## 1. Was IV offenliess, und was dieser Lauf schliesst

Worktrail IV nennt in ihrem eigenen `nicht-gemessen` woertlich: *„Qualitaet der gelandeten Arbeit
(Audit-Rot je Lane nicht gejoint)"*. Die Queue-Notiz vom 09-14 baute darauf `land-quality.ts` (E2)
und beauftragte diesen Lauf mit der Verknuepfung. Dieser Lauf wiederholt daher **nichts** aus IV —
kein Report-Deckel, keine Erdungskosten, kein Graphify-Hook, keine `sleep`-Zaehlung. Er beantwortet
genau eine Frage: **traegt das, was die Ledger ueber eine Lane wissen, eine Aussage ueber die
Qualitaet ihrer Arbeit?**

Die Antwort ist dreiteilig: die Verknuepfung existiert jetzt (§2), die dafuer vorgeschlagene
Kennzahl misst das Falsche (§3), und fuer die drei neuesten Steuergroessen ist sie heute
strukturell nicht berechenbar (§5).

## 2. Die Verknuepfung

Alle Quoten ueber Code-Lands mit BEKANNTEM Feld; `n` ist die Zahl der Lands in der Gruppe,
`code` davon Code-Lands (nicht docs-only).

### 2.1 Modell und Harness

| Klasse | n | code | rework3d binaer (code) | fix-Subject (code) | auditRed | ins. Median |
|---|---:|---:|---:|---:|---:|---:|
| claude/opus-5 | 184 | 162 | 71 % (77/108) | 25 % (27/108) | 25 % (45/177) | 246 |
| **claude/? (ungestempelt)** | 48 | 39 | 65 % (15/23) | 17 % (4/23) | 18 % (8/44) | 191 |
| codex/gpt-6-astra | 24 | 2 | — (0) | — (0) | 4 % (1/24) | 233 |
| pi-zai/glm-5.3 | 19 | 2 | — (0) | — (0) | 24 % (4/17) | 165 |
| codex/gpt-5.6-sol | 16 | 11 | 60 % (6/10) | 40 % (4/10) | 19 % (3/16) | 122 |
| pi-zai/glm-5.3-flash | 6 | 5 | — (0) | — (0) | 33 % (2/6) | 106 |
| claude/fable + fable-5-1 | 7 | 1 | — (0) | — (0) | 14 % (1/7) | 440 |

Der fix-Subject-Wert reproduziert die Handprobe der Queue-Notiz (dort opus 24 %, codex 44 %; hier
25 % und 40 %) — die Probe und das Ledger messen dasselbe. **Die zweitgroesste „Modellklasse" ist
`?`**: 48 von 304 Lands (16 %), davon 39 Code-Lands, tragen gar kein Modell. §6.1 zeigt, dass diese
Information eine Datei weiter vollstaendig vorliegt.

`glm` und `astra` haben im Fenster zusammen **4 Code-Lands** — ueber ihre Code-Qualitaet sagt dieses
Fenster nichts. Ihre `auditRed`-Quoten (24 % / 4 %) stammen fast nur aus Docs-Lands und sind nach
§4 ohnehin kein Lane-Signal.

### 2.2 Groesse, Effort, Bereich

| Schnitt | n | code | rework3d binaer (code) | auditRed | ins. Median |
|---|---:|---:|---:|---:|---:|
| Karten-`size` klein | 42 | 36 | — (0) | 20 % (8/41) | 96 |
| Karten-`size` mittel | 20 | 13 | — (0) | 25 % (5/20) | 318 |
| Karten-`size` gross | 1 | 1 | — (0) | 100 % (1/1) | 839 |
| ohne `size` | 241 | 172 | 70 % (98/141) | 22 % (50/229) | 233 |
| effort high | 242 | 180 | 70 % (81/116) | 24 % (55/232) | 229 |
| effort medium | 16 | 3 | 100 % (2/2) | 6 % (1/16) | 198 |
| Code-Land | 222 | 222 | 70 % (98/141) | 21 % (45/212) | 216 |
| **Docs-Land** | 82 | 0 | 12 % (7/59) | **24 % (19/79)** | 229 |

`size` traegt **null** Nacharbeits-Nenner — jede Zeile mit `size` ist juenger als das Fenster (§5).
Die `size`-Spalte in `state.sh` zeigt deshalb heute strukturell nur `auditRed`.

Die Docs-Zeile ist der erste Beleg gegen `auditRed` als Lane-Signal: 19 Lands, die keine einzige
Code-Zeile anfassten, tragen ein rotes Audit — genauso oft wie Code-Lands.

### 2.3 Brief-Bytes und Quellpaket

Brief-Bytes = `context-receipts.deliveredBytes` (`server.ts:11888`, UTF-8-Bytes des
ausgelieferten Briefs). Verteilung ueber 302 gejointe Receipts: min 2 877 · p25 6 922 · **p50 8 275**
· p75 11 023 · max 29 171.

| Brief-Bytes | n (code, Fenster zu) | rework binaer | fix-Subject | ins. Median |
|---|---:|---:|---:|---:|
| < 8 k | 69 | 65 % | 22 % | 245 |
| 8–13 k | 57 | 70 % | 25 % | 293 |
| >= 13 k | 14 | 93 % | 43 % | 397 |

Der Gradient sieht nach „lange Briefe sind teuer" aus, ist aber **derselbe Groessen-Effekt wie in
§3**: die Median-Einfuegemenge steigt mit den Brief-Bytes (245 → 293 → 397). Ein langer Brief
beschreibt eine grosse Aufgabe. Ohne Stratifizierung ist diese Zeile keine Aussage ueber Briefe.

**Quellpaket** (`snippet` im Receipt, existiert seit 2026-09-14 15:13, 124 Receipts):

| | Wert |
|---|---|
| Receipts mit `snippet`-Feld | 124 |
| davon **0 Treffer** | **79 (64 %)** |
| Treffer-Histogramm | 0:79 · 1:17 · 2:14 · 3:10 · 4:3 · 5:1 |
| Bytes p50 / p90 / max | 211 / 7 564 / 8 191 |
| Receipts mit 0 Bytes | 41 |
| Auslassungsgruende (203 Eintraege) | `symbol-not-found` 115 · **`binary-source` 68** · `symbol-ambiguous` 14 · `budget-exhausted` 5 · `unsupported-source` 1 |

Die Queue-Notiz mass am 09-13 an 17 Brief-TEXTEN einen Median von 7 343 B fuer diesen Block. Ueber
124 Receipts liegt der Median bei **211 B**. Das ist kein Widerspruch, sondern eine groessere
Stichprobe: der Block ist in der Mehrheit der Briefe leer. Die Ursache steht in §6.2.

Qualitaet gegen Quellpaket ist **nicht berechenbar**: 0 von 74 Lands mit `snippet.bytes > 0` haben
ein geschlossenes 3-Tage-Fenster.

### 2.4 Karte

| Kartenzustand | Lanes im Fenster | gelandet | auditRed | rework binaer (code, Fenster zu) |
|---|---:|---:|---:|---:|
| ohne Karte | 242 | 215 (89 %) | 20 % (38/190) | 68 % (89/130) |
| Karte gueltig | 74 | 66 (89 %) | 25 % (15/59) | 80 % (4/5) |
| Karte ungueltig | 51 | 46 (90 %) | 26 % (11/42) | 83 % (5/6) |

**Die Gueltigkeit der Karte sagt ueber das Landen nichts** (89 / 89 / 90 %), und fuer Nacharbeit ist
der Nenner 5 bzw. 6 — keine Aussage. Die Karte ist damit im Fenster die einzige urteilende Schicht
(Queue-Notiz §1) **ohne jede gemessene Wirkung auf ein Ergebnis**.

Kartenkosten und -wirkung im Fenster: 362 Modell-Laeufe fuer 206 Zeilen, 245 davon `valid:false`,
zusammen 203,5 min Modellzeit (p50 47 s, p90 87 s, max 121 s gegen 120 s Timeout). Der
Modellwechsel aus E1b ist sichtbar und hilft:

| Kartenmodell | gueltig | ungueltig | Quote |
|---|---:|---:|---:|
| `claude-haiku-4-5-20251001` | 28 | 138 | 17 % |
| `claude-sonnet-5` | 55 | 80 | **41 %** |
| `format` (Validator-Relesung ohne Modell) | 34 | 27 | 56 % |

### 2.5 Was sonst noch im Join steckt

| Schnitt | n (code, Fenster zu) | fix-Subject | Bemerkung |
|---|---:|---:|---|
| `releasedBy: owner` | 81 | **32 %** | z = 2,27 gegen machine |
| `releasedBy: machine` | 59 | **15 %** | ins. Median 204 gegen 231 |
| `ownerPrompts > 0` | 33 | 27 % | ins. Median 401 gegen 209 |
| `ownerPrompts = 0` | 108 | 24 % | |
| Notizen-Block > 0 | 76 | 24 % | kein Unterschied |
| `briefSource: card` | 13 | 31 % | Nenner zu klein |
| `repairRounds > 0` | 0 | — | **im ganzen Fenster nie ungleich 0** |

Die Owner/Maschine-Differenz ist das einzige nicht-triviale Signal ausserhalb der Groesse — und sie
ist ungeklaert: der Owner released typischerweise das, was die Maschine nicht auto-landen konnte.
Sie wird hier als **Beobachtung ohne Kosten** gefuehrt, nicht als Befund, und ist der natuerliche
erste Stratifizierungskandidat fuer Lauf 2.

## 3. Warum `rework3d %` als Kennzahl nicht traegt

Der Auftrag schlug `rework3d % je Modellklasse` als stehende Kennzahl vor. Ueber alle 141 Code-Lands
mit geschlossenem Fenster:

| Einfuege-Zeilen | n | binaer (irgendeine Zeile ueberschrieben) | ANTEIL gepoolt | Anteil Median je Land |
|---|---:|---:|---:|---:|
| < 50 | 11 | **18 %** | 1,13 % | 0,00 % |
| 50–150 | 30 | 63 % | 2,52 % | 1,37 % |
| 150–400 | 54 | 67 % | 2,13 % | 0,82 % |
| >= 400 | 46 | **89 %** | 3,30 % | 1,82 % |

**Der binaere Wert vervierfacht sich ueber die Diff-Groesse, der Anteil nicht.** Das ist der ganze
Mechanismus: „wurde IRGENDEINE meiner Zeilen angefasst" ist bei 400 eingefuegten Zeilen fast sicher
und bei 20 fast unmoeglich — die Kennzahl misst, wer die grossen Auftraege bekam.

Stratifiziert verschwindet der Modellunterschied, den der ungeschnittene Wert suggeriert:

| Einfuege-Zeilen | claude/opus-5 | codex/gpt-5.6-sol | claude/? |
|---|---|---|---|
| < 150 | n=26, binaer 54 %, fix 15 % | n=7, binaer 43 %, fix 29 % | n=8, binaer 50 %, fix 12 % |
| 150–400 | n=43, binaer 67 %, fix 19 % | n=1 | n=10, binaer 60 %, fix 10 % |
| >= 400 | n=39, binaer 87 %, fix 38 % | n=2 | n=5, binaer 100 %, fix 40 % |

`gpt-5.6-sol` hat im einzigen belastbaren Bucket sieben Code-Lands. **Aus 14 Tagen ist zwischen den
Modellklassen kein Qualitaetsunterschied ablesbar** — weder im Anteil (2,68 % gegen 1,97 %) noch
stratifiziert. Das ist ein Ergebnis, kein fehlendes Ergebnis: wer heute eine Variante „nach
Qualitaet" waehlt (E4), waehlt Rauschen.

## 4. `auditRed` ist kein Lane-Signal

278 Audits im Fenster, davon 173 gruen, 90 rot, 15 anderes. Die 90 roten, nach ihrer NEUESTEN
Adjudikation:

| Adjudikation | rote Audits |
|---|---:|
| `flake` | 33 |
| **nie adjudiziert** | **29** |
| `stale-test` | 14 |
| `unknowable` | 10 |
| **`real`** | **4** |

`land-quality.ts` zaehlt alles ausser `flake` — also **57 von 90** — als `auditRed` einer Lane. Von
allen 304 Lands im Fenster tragen 64 ein `auditRed`; **vier** davon haengen an einem als `real`
adjudizierten Audit, alle vier an `claude/opus-5`. Keine andere Modellklasse hat im Fenster auch nur
ein `real`-Rot.

Die Koalisierung ist dabei NICHT die Ursache — das war die naheliegende Vermutung und sie ist
widerlegt: die 278 Audits decken im Mittel 1,18 Branches, die roten 1,11 (Histogramm 1:243 · 2:28 ·
3:5 · 5:1 · 8:1). Das Problem ist nicht Verteilung, sondern **Zurechnung**: ein Rot misst den
Zustand der Suite am Tip, und 86 von 90 sind nach heutigem Wissensstand nicht die Schuld der Lane,
deren Branch daneben steht. Die 19 Docs-Lands mit `auditRed` (§2.2) sind die sichtbare Spitze.

Kosten: jede Variantenwahl (E4), jedes Modellklassen-Profil (`21ade485`) und jede
`accepted-by-land`-Entscheidung, die `auditRed` liest, liest zu 94 % den Flake-Zustand der Suite und
den Rueckstand der Adjudikation (29 offene) statt der Arbeit.

## 5. Der blinde Fleck: die Steuergroessen sind juenger als das Settle-Fenster

| Dimension | erstes Land damit | Lands im Fenster | davon mit geschlossenem 3-d-Fenster |
|---|---|---:|---:|
| Karte | 2026-09-13 11:58 | 103 | **18** |
| Karten-`size` | 2026-09-14 12:24 | 63 | **0** |
| Quellpaket (`snippet` > 0) | 2026-09-14 15:55 | 74 | **0** |

Von 304 Lands haben 200 ein geschlossenes Fenster und 104 nicht — und die 104 sind fast exakt die
Zeilen, die die neuen Schichten getragen haben. **Die Verknuepfung, die dieser Lauf herstellen
sollte, ist fuer die drei Dimensionen, wegen derer sie gebaut wurde, heute leer.** Kein Fehler im
Ledger: `reworkLines3d` ist korrekt `null`, weil das Fenster offen ist. Aber es heisst, dass eine
14-Tage-Periodik den Effekt einer Aenderung, die vor 3 Tagen live ging, strukturell nie sieht.

Konsequenz fuer den Takt: §9.

## 6. Zwei mechanische Ursachen, die im Join sichtbar werden

### 6.1 Der fehlende Modellstempel — 16 % der Lands sind `claude/?`

`server.ts#buildLaneOutcome` schreibt (Zeile 22150):

    model: s.model ?? null,

`s.model` ist leer, wenn der Slot ohne explizites Modell gegruendet wurde. Dieselbe Datei loest
denselben Fall 7 500 Zeilen weiter bereits auf — `server.ts#receiptModel` (29698):

    if (s.model) return { model: s.model, modelOrigin: "spawn" };
    const fallback = harnessDefaultModel(harnessOf(s.harness));
    return fallback ? { model: fallback, modelOrigin: "default" } : { model: "ambient", modelOrigin: "ambient" };

Gemessen: von den 48 ungestempelten Lands tragen 15 im Receipt `model: claude-opus-5[1m]` mit
`modelOrigin: "default"`; **13 davon sind vom 09-15 oder juenger** (09-15: 9, 09-16: 1, 09-17: 3) —
das Loch ist nicht historisch, es laeuft. Die uebrigen 33 haben auch im Receipt `null`; deren
Receipts stammen alle von vor dem 09-15, seit dem 09-15 ist kein Receipt mehr modell-los (09-13: 9,
09-14: 4, 09-15/16/17: 0). Die Receipt-Haelfte von E3 ist also gelandet und wirkt; die
Outcome-Haelfte fehlt.

Warum das nicht nachtraeglich reparierbar ist, steht im Kommentar ueber `receiptModel` selbst:
*„resolved AT WRITE TIME — a later reader cannot know which FLEET_MODEL the server ran with"*. Jeder
Tag ohne diesen Fix erzeugt Zeilen, die die Kennzahl aus §7 dauerhaft nicht zuordnen kann.

### 6.2 Ein NUL-Byte kostet 61 % der Lane-Briefe die Datei, um die es geht

Von den 203 Auslassungen im Quellpaket sind 68 `binary-source`, davon **67-mal `server.ts`**
(einmal `context-snippets.ts`). Betroffen sind **67 von 110 Branches** mit Quellpaket-Receipt.
Ursache ist ein einzelnes literales `0x00` bei Byte 1 222 331, `server.ts:18054`, in einem
Hash-Eingang — `createHash("sha256")` mit einem Template-Literal, in dem das NUL als Feldtrenner
zwischen Repo-Pfad und Shard steht. Der Detektor in
`context-snippets.ts` weist die Datei danach als Binaerquelle zurueck — vertragsgemaess
(„binary content carries its own refusal reason"), aber mit dem Effekt, dass das Modul, das nach
seinem eigenen Kopf die *gemessenen 52 Bash-Aufrufe bis zum ersten produktiven Marker* senken soll,
ausgerechnet fuer die meistberuehrte Datei des Repos nie liefert. Ein grosser Teil der 115
`symbol-not-found` haengt am selben Byte: die haeufigsten Refs sind `server.ts#CODEX_HARNESS` (5),
`server.ts#buildLaneOutcome` (4), `server.ts#PI_ZAI_HARNESS` (4), `server.ts#paneReadiness` (4) —
alles Symbole, die im Baum existieren.

**Die Reparatur ist bereits gefilet** (`2e99a34e`, pending, gefilet 2026-09-17 09:29 von
Orchestratorin Slot 8, FLAECHE `context-snippets.ts, e2e/attention.ts, e2e/helper-portal.ts,
server.ts, e2e/pins.ts`). Ihr Begruendungsteil kennt nur den grep-Schaden (stiller False Negative
mit exit 1). Die hier gemessene Zahl — 67 von 110 Lane-Briefen, 68 von 203 Auslassungen — ist die
zweite, groessere Kostenseite derselben Zeile und gehoert an sie angehaengt, nicht in eine neue
Zeile. §8 traegt das als Regie-Schritt, nicht als Auftrag.

## 7. Die stehende Kennzahl

**Name:** Nacharbeits-Anteil (`reworkShare3d`).

**Definition.** Ueber alle Code-Lands im Fenster, deren 3-Tage-Fenster am Beobachtungshorizont
GESCHLOSSEN ist (`reworkLines3d !== null`, `insertedLines > 0`):

    reworkShare3d = Σ reworkLines3d / Σ insertedLines

berichtet (a) gesamt, (b) je Modellklasse `harness/model`, (c) stratifiziert nach
Einfuege-Zeilen-Bucket `<50 / 50–150 / 150–400 / >=400`. Der Median des Anteils je Land wird
danebengestellt, weil der gepoolte Wert von den groessten Lands dominiert wird. Der bisherige
binaere Wert bleibt als Nebenspalte stehen — als Groessen-Proxy ist er nuetzlich, als
Qualitaets-Aussage nicht.

**Warum dieser und nicht der binaere:** §3 — der binaere Wert schwankt ueber die Diff-Groesse um den
Faktor 4,9 (18 → 89 %), der Anteil um 2,9 mit flachem Verlauf (1,13 → 3,30 %) und ohne Ordnung
(das mittlere Bucket liegt unter dem darunter).

**Heutiger Wert**, Fenster 2026-09-03 00:00 bis Horizont `e4d8e1ba` (2026-09-17 06:13:20),
n = 141 Code-Lands mit geschlossenem Fenster, 50 692 eingefuegte Zeilen:

| Groesse | Wert |
|---|---|
| **reworkShare3d gesamt** | **2,91 %** (1 475 / 50 692) |
| Median des Anteils je Land | 0,99 % (p75 3,10 % · p90 8,08 % · max 100 %) |
| je Klasse: claude/opus-5 | 2,68 % gepoolt · 0,93 % Median · n=108 |
| je Klasse: claude/? | 4,70 % gepoolt · 0,94 % Median · n=23 |
| je Klasse: codex/gpt-5.6-sol | 1,97 % gepoolt · 1,70 % Median · n=10 |
| Bucket <50 / 50–150 / 150–400 / >=400 | 1,13 % · 2,52 % · 2,13 % · 3,30 % |
| Vergleichswerte alt: binaer / fix-Subject | 70 % (98/141) · 25 % (35/141) |

**Was ein Wechsel bedeuten wuerde:** ein Anstieg des Gesamtanteils ueber ~4 % bei gleichbleibender
Bucket-Verteilung ist der erste Wert, der eine Ursachensuche rechtfertigt; eine Differenz zwischen
zwei Modellklassen zaehlt erst, wenn beide im selben Bucket n >= 20 haben — heute erreicht das
keine Paarung ausser opus-5 mit sich selbst.

## 8. Ausgang — Auftragszeilen

Vier Zeilen, nach Wirkung sortiert. **Die Pflicht des Auftrags (drei Zeilen) ist nach A3 erfuellt;
die Schnittlinie steht dort.** A4 steht darunter, weil es die billigste ist und den einzigen
Sensor baut, der §6.2 vor einem Rueckfall schuetzt — sie ist ein Vorschlag, keine Forderung.

Vorweg, weil es KEINE neue Zeile ist: **Regie-Schritt fuer die MAIN.** An die bestehende, pendente
Zeile `2e99a34e` (NUL-Byte) den gemessenen zweiten Schaden anhaengen: *„Dasselbe Byte macht
`server.ts` fuer das Quellpaket zu `binary-source`: 68 von 203 Auslassungen, 67 von 110
Lane-Briefen mit Quellpaket-Receipt verlieren dadurch die Datei, um die es im Brief geht
(docs/messungen/2026-09-17-worktrail-v.md §6.2)."* Kein neuer Auftrag, keine neue Karte — eine
Ergaenzung am Text der offenen Zeile, damit ihre Prioritaet stimmt.

---

### A1 — Der Modellstempel fehlt auf 16 % der Lands, obwohl das Receipt ihn kennt

    [FLEET-BETRIEB · KLEIN · 48 VON 304 LANDS IN 14 TAGEN SIND `claude/?` — DAS RECEIPT KENNT DAS
    MODELL, DAS OUTCOME NICHT · gemessen Worktrail V, 2026-09-17, Horizont e4d8e1ba]
    ROLLE: claude/claude-opus-5[1m]/high
    GROESSE: klein
    FLAECHE: server.ts, land-quality.ts, e2e/pins.ts

    BEFUND. `server.ts#buildLaneOutcome` schreibt `model: s.model ?? null` (Zeile 22150). Ist der
    Slot ohne explizites Modell gegruendet, bleibt das Feld leer — 48 von 304 Lands im Fenster
    2026-09-03..2026-09-17 (16 %), davon 39 Code-Lands. In `land-quality.ts#modelKey` werden sie zur
    zweitgroessten "Modellklasse" `claude/?` und tragen dort einen eigenen Nacharbeits-Anteil von
    4,70 % (n=23) — eine Zahl ohne Adressaten. Dieselbe Datei loest denselben Fall bereits auf:
    `server.ts#receiptModel` (Zeile 29698) gibt `{model, modelOrigin: "spawn"|"default"|"ambient"}`.
    Gemessen: 15 der 48 tragen im Context-Receipt `claude-opus-5[1m]` mit `modelOrigin: "default"`,
    13 davon sind vom 09-15 oder juenger. Nachtraeglich reparierbar ist es nicht — der Kommentar
    ueber `receiptModel` sagt warum: "resolved AT WRITE TIME — a later reader cannot know which
    FLEET_MODEL the server ran with".

    AUFTRAG. `buildLaneOutcome` stempelt Modell und Herkunft ueber denselben Weg wie das Receipt:
    das aufgeloeste Modell ins `model`-Feld, die Herkunft in ein NEUES Feld `modelOrigin` (nie
    stillschweigend, damit ein Leser `spawn` von `default` unterscheiden kann). `ambient` bleibt
    `null` im `model` — Fleet darf kein Modell erfinden. Gilt fuer alle drei Dispositionen
    (landed/killed/shelved), nicht nur fuer Lands.
    DONE: (a) eine frisch gegruendete Lane ohne Spawn-Modell erzeugt eine `lane-outcomes`-Zeile mit
    gesetztem `model` und `modelOrigin:"default"` — als Gegenprobe im Report zitiert; (b) eine Lane
    MIT Spawn-Modell aendert sich nicht (`modelOrigin:"spawn"`, `model` unveraendert); (c) ein
    Harness ohne Default-Modell schreibt weiterhin `model:null` und `modelOrigin:"ambient"`;
    (d) `e2e/pins.ts` haelt fest, dass `buildLaneOutcome` und `receiptModel` dieselbe Aufloesung
    benutzen, damit die beiden Stempel nicht wieder auseinanderlaufen; (e) `land-quality.ts` bleibt
    unveraendert bis auf die Uebernahme des Feldes in `LandRow` und `modelKey`.
    VERIFY: install, pins, tsc, build, clean-review, security, claude-gate.
    DO NOT: bestehende `lane-outcomes`-Zeilen nachtraeglich umschreiben; `land-quality.jsonl` von
    Hand anfassen; ein Modell raten, wo der Harness keinen Default nennt.

### A2 — Die Kennzahl misst die Diff-Groesse, nicht die Qualitaet

    [FLEET-BETRIEB · KLEIN · `rework3d %` IST EIN DIFF-GROESSEN-PROXY (18 % BEI <50 ZEILEN, 89 % BEI
    >=400) — DER ANTEIL IST ES NICHT (1,13/2,52/2,13/3,30 %) · gemessen Worktrail V, 2026-09-17]
    ROLLE: claude/claude-opus-5[1m]/high
    GROESSE: klein
    FLAECHE: land-quality.ts, state.sh, e2e/pins.ts

    BEFUND. Ueber 141 Code-Lands mit geschlossenem 3-Tage-Fenster steigt der binaere Wert
    ("irgendeine eingefuegte Zeile wurde binnen 3 d ueberschrieben") monoton mit der Einfuegemenge:
    <50 Zeilen 18 % (n=11) · 50-150 63 % (n=30) · 150-400 67 % (n=54) · >=400 89 % (n=46). Der
    Anteil nachgearbeiteter an eingefuegten Zeilen tut das nicht: 1,13 / 2,52 / 2,13 / 3,30 %.
    `land-quality.ts#aggregate` bildet heute nur den binaeren Wert (`rework3d`, `fix3dCode`) und
    `renderSummary` zeigt genau den in `state.sh`. Folge: die eine Zeile, die der Fleet als
    Qualitaets-Lagebild liest, vergleicht Modelle danach, wer die grossen Auftraege bekam. Gesamt
    heute: 2,91 % Anteil (1 475/50 692) gegen 70 % binaer.

    AUFTRAG. `aggregate` bekommt neben den Ratio-Feldern einen Anteil (Summe `reworkLines3d` /
    Summe `insertedLines` ueber die Zeilen mit bekanntem Feld) und den Median des Anteils je Land;
    `renderSummary` zeigt den Anteil als FUEHRENDE Zahl, den binaeren Wert als Nebenspalte; die
    Volltabelle bekommt zusaetzlich eine Gruppierung nach Einfuege-Zeilen-Bucket
    (<50 / 50-150 / 150-400 / >=400). Richtungsdisziplin bleibt: kein Nenner ⇒ "—", nie 0.
    DONE: (a) `bun land-quality.ts --summary --since 14d` zeigt den Anteil je Modellklasse und
    gesamt, Ausgabe im Report zitiert; (b) gegen den heutigen Ledger reproduziert der Lauf die
    Zahlen aus docs/messungen/2026-09-17-worktrail-v.md §7 (gesamt 2,91 %, opus-5 2,68 %, Buckets
    1,13/2,52/2,13/3,30 %) oder benennt begruendet, warum der Ledger sich seither bewegt hat;
    (c) `state.sh` bleibt einzeilig lesbar und faellt bei fehlendem Ledger weiter auf
    "land-quality UNKNOWN" zurueck; (d) `e2e/pins.ts` pinnt die Anteils-Formel an einem
    Mini-Fixture (zwei Zeilen, bekannter Erwartungswert), damit sie nicht still zur Quote wird.
    VERIFY: install, pins, tsc, build, clean-review, security, claude-gate.
    DO NOT: den binaeren Wert entfernen (er ist als Groessen-Proxy brauchbar); `land-quality.jsonl`
    neu berechnen lassen, um die Zahlen zu treffen; die Blame-Probe selbst anfassen.

### A3 — `auditRed` zaehlt 57 von 90 roten Audits als Lane-Qualitaet; 4 sind `real`

    [FLEET-BETRIEB · MITTEL · VON 90 ROTEN AUDITS IN 14 TAGEN SIND 4 `real`, 33 `flake` UND 29 NIE
    ADJUDIZIERT — `land-quality.ts` ZAEHLT 57 DAVON ALS LANE-QUALITAET · gemessen Worktrail V]
    ROLLE: claude/claude-opus-5[1m]/high
    GROESSE: mittel
    FLAECHE: land-quality.ts, state.sh, e2e/pins.ts

    BEFUND. `land-quality.ts` setzt `auditRed` auf true, wenn ein messendes Audit rot war und seine
    NEUESTE Adjudikation nicht `flake` ist — dokumentiert und bewusst. Im Fenster
    2026-09-03..2026-09-17: 278 Audits (173 gruen, 90 rot, 15 anderes); die 90 roten nach neuester
    Adjudikation: flake 33, nie adjudiziert 29, stale-test 14, unknowable 10, real 4. 64 der 304
    Lands tragen dadurch `auditRed`, VIER haengen an einem `real`-Rot. Die naheliegende Erklaerung
    Koalisierung ist widerlegt: 278 Audits decken im Mittel 1,18 Branches, die roten 1,11. Zweiter
    Beleg gegen die Zurechnung: 19 der 82 reinen Docs-Lands tragen ein `auditRed` — genauso oft wie
    Code-Lands (21 %).

    AUFTRAG. Die Spalte wird geteilt, nicht umdefiniert: `auditRed` bleibt wie sie ist (Zustand der
    Suite am Tip, ein ehrlicher Betriebswert), daneben `auditRedReal` = rot UND neueste Adjudikation
    `real`. Die Aggregation (`aggregate`, `renderSummary`, `state.sh`) berichtet `auditRedReal` als
    Qualitaets-Spalte und `auditRed` als Betriebs-Spalte, jede mit eigenem Nenner. Dazu sichtbar
    machen, was die Zahl blind macht: Anteil nie adjudizierter Rots (heute 29/90 = 32 %) als eigene
    Zahl in derselben Zeile — ein Rueckstand, der waechst, entwertet beide Spalten.
    DONE: (a) `bun land-quality.ts --summary --since 14d` zeigt drei Zahlen (auditRed,
    auditRedReal, nicht adjudiziert) mit getrennten Nennern, Ausgabe im Report zitiert; (b) gegen
    den heutigen Ledger sind es 64 auditRed, 4 auditRedReal, 29 unadjudizierte Rots — oder die
    Abweichung ist am Ledger begruendet; (c) `null` bleibt `null`: ein nicht messendes Audit
    erzeugt in KEINER der drei Spalten eine 0; (d) `e2e/pins.ts` pinnt, dass `auditRedReal` echt
    strenger ist als `auditRed` (ein Fixture mit verdict `stale-test` zaehlt in der einen, nicht in
    der anderen).
    VERIFY: install, pins, tsc, build, clean-review, security, claude-gate.
    DO NOT: die Adjudikationsregel fuer `auditRed` aendern; Audits nachtraeglich adjudizieren, um
    den Rueckstand zu senken; ein Modell-Urteil an den Land-Pfad haengen.

---
**Schnittlinie — die Pflicht des Auftrags (drei Zeilen) ist hier erfuellt.**
---

### A4 — Niemand liest die Quellpaket-Quittung, in der 64 % Fehlschlag steht (Vorschlag)

    [FLEET-BETRIEB · KLEIN · 79 VON 124 LANE-BRIEFEN BEKOMMEN 0 QUELLPAKET-TREFFER, UND DIE ZAHL
    STEHT NUR IN 124 EINZELNEN RECEIPTS · gemessen Worktrail V, 2026-09-17]
    ROLLE: claude/claude-opus-5[1m]/high
    GROESSE: klein
    FLAECHE: state.sh, land-quality.ts, e2e/pins.ts

    BEFUND. Seit 2026-09-14 15:13 traegt jedes Lane-Receipt `snippet{bytes,hits,omitted}` (E3,
    gelandet und wirksam). Ueber 124 Receipts: 79 mit 0 Treffern (64 %), Bytes-Median 211, 41 mit 0
    Bytes; Auslassungsgruende `symbol-not-found` 115, `binary-source` 68, `symbol-ambiguous` 14,
    `budget-exhausted` 5. Kein Code liest dieses Feld aggregiert — die 61-%-Ausfallquote aus §6.2
    war 68 einzelne Receipt-Zeilen lang unsichtbar, und die Reparatur `2e99a34e` entstand ueber
    einen ganz anderen Weg (grep). Wenn das NUL-Byte faellt, faellt mit ihm der Sensor-Anlass: ohne
    Aggregat merkt niemand, wenn der naechste Ausfall kommt.

    AUFTRAG. Ein Aggregat ueber die Quellpaket-Quittungen der letzten 14 Tage in `state.sh`: Zahl
    der Receipts, Treffer-Quote, Bytes-Median, die drei haeufigsten Auslassungsgruende mit Anzahl.
    Leser ist der Mensch und die naechste Worktrail-Analyse, nicht der Server — kein Gate, kein
    Alarm, keine Entscheidung haengt daran.
    DONE: (a) `./state.sh` zeigt die Zeile mit heutigen Werten (124 Receipts, 45/124 mit Treffer,
    Median 211 B, binary-source 68) oder der Abweichung mit Datum; (b) fehlt das Ledger, steht dort
    UNKNOWN und kein Nullwert; (c) `e2e/pins.ts` haelt die Feldnamen `snippet.hits`/`.bytes`/
    `.omitted[].why` fest, damit ein Umbenennen im Receipt die Anzeige nicht still leert.
    VERIFY: install, pins, tsc, build, clean-review, security, claude-gate.
    DO NOT: das Quellpaket selbst aendern; das NUL-Byte anfassen (das ist 2e99a34e); aus der Quote
    ein Gate machen.

## 9. Was Lauf 2 anders braucht

**Eingabe.** Dieser Lauf hat sechs Ledger von Hand ueber `branch` und `taskId` gejoint. Das ist
reproduzierbar (§10), aber es ist jedes Mal eine Stunde, und es ist die Stelle, an der zwei Laeufe
unbemerkt verschiedene Grundmengen bilden koennen. `land-quality.ts` ist bereits ein LESER von
`lane-outcomes`, `post-land-audits`, `audit-adjudications` und `fleet.json` — die Join-Schluessel,
die hier fehlten, gehoeren in seine Zeile: `briefBytes` und `snippetHits` aus dem Receipt,
`cardValid` aus der Karte. Dann ist Lauf 2 ein `bun land-quality.ts --json` plus Auswertung, und
A1/A2/A3 sind seine Vorbedingung, nicht sein Nebenprodukt. (Bewusst NICHT vorgeschlagen: eine
zweite Ledger-Kopie. Die Felder gehoeren in die bestehende Zeile.)

**Takt.** 14 Tage sind fuer die Frage, die dieser Lauf stellen sollte, zu kurz — §5: null von 74
Quellpaket-Lands und null von 63 `size`-Lands hatten ein geschlossenes Fenster. Der Takt muss an
zwei Groessen haengen statt an einer:
- **Fenster >= 21 Tage**, damit eine vor 7 Tagen gelandete Aenderung mindestens 14 Tage gesetzter
  Lands hat;
- **Horizont = `asOfAt` von `land-quality.ts`, nicht die Uhr** — Lauf 2 nennt seinen Horizont-Commit
  im Kopf, wie dieser hier (`e4d8e1ba`), sonst sind zwei Laeufe nicht vergleichbar.
Konkret: **Lauf 2 am 2026-10-01**, Fenster ab 2026-09-10. Dann tragen Karte, `size` und Quellpaket
je ~2 Wochen gesetzter Lands, und die Kennzahl aus §7 hat ihren ersten Vergleichswert.

**Senke.** Der Notiz-Kanal schliesst nicht (Queue-Notiz §3: 196 von 201 Verdicts "offen", 3 von 69
per Land geschlossen) — dieser Lauf hat deshalb keine Notiz gefilet. Die Senke ist die
Auftragszeile ueber die MAIN-Tuer (§8), und die Rueckkopplung ist die Kennzahl: Lauf 2 misst
`reworkShare3d` erneut UND prueft, welche der Zeilen A1–A4 gelandet sind. Eine Zeile, die zwei
Laeufe ueberlebt hat, ohne zu landen, ist kein Befund mehr, sondern eine Entscheidung, die
aussteht — sie gehoert dann archiviert oder eskaliert, nicht ein drittes Mal gemeldet.

**Was Lauf 2 nicht wieder tun muss:** die Karten-Gueltigkeit gegen die Landequote pruefen (89/89/90 %
— beantwortet, §2.4), die Koalisierung als Ursache der `auditRed`-Verschmutzung vermuten (1,11
Branches je rotem Audit — widerlegt, §4), und Modellklassen ungeschnitten vergleichen (§3).

## 10. Methode und Reproduktion

Alle Zahlen stammen aus den Ledgern des Haupt-Checkouts, gelesen ohne Schreibzugriff. Kein
`land-quality.ts`-Lauf wurde ausgeloest (das haette den Ledger neu geschrieben); der Horizont ist
der, den die Datei bereits trug.

    # Fenster und Grundmenge
    WIN=2026-09-03T00:00 local ; HORIZONT = max(asOfAt) aus land-quality.jsonl = e4d8e1ba
    land-quality.jsonl : select(.landedAt >= WIN)                        -> 304
    lane-outcomes.jsonl: dedupliziert je .branch, juengstes .ts           -> 367 im Fenster
    context-receipts.jsonl: dedupliziert je .branch, juengstes .at        -> 302 gejoint
    cards.jsonl        : dedupliziert je .taskId, juengstes .at           -> 103 gejoint

    # Kennzahl (§7)
    rows  = land-quality-Zeilen mit codeLand && reworkLines3d != null && insertedLines > 0
    share = sum(reworkLines3d) / sum(insertedLines)        # 1475 / 50692 = 2,91 %
    Buckets ueber insertedLines: [0,50) [50,150) [150,400) [400,inf)

    # auditRed-Zerlegung (§4)
    rote Audits = post-land-audits im Fenster mit .result=="red"                      -> 90
    je Audit die NEUESTE audit-adjudications-Zeile mit .auditAt == audit.at
    Deckungsgrad = len(.covers) je Audit                                  -> Mittel 1,18

    # Quellpaket (§2.3, §6.2)
    receipts mit .snippet != null im Fenster                                         -> 124
    hits==0 -> 79 ; .omitted[].why gezaehlt -> binary-source 68 (67x ref "server.ts")
    NUL-Nachweis: open("server.ts","rb").read().count(b"\x00") == 1, Offset 1222331

Gegenproben, die gefahren wurden: der fix-Subject-Wert dieses Joins (opus 25 %, sol 40 %) gegen die
Handprobe der Queue-Notiz §3 (24 % / 44 %) — dieselbe Groessenordnung an ueberlappender, aber nicht
identischer Grundmenge; die Koalisierungs-Hypothese gegen das `covers`-Histogramm (widerlegt); die
Behauptung "E3 hat `model:null` geschlossen" gegen die Receipts je Tag (im Receipt geschlossen seit
09-15, im Outcome nicht — §6.1).

Nicht gepruefte Annahmen, die tragen: dass `reworkLines3d` misst, was sein Kopfkommentar sagt
(uebernommen, nicht nachgerechnet); dass `covers[].branch` die Lane meint, deren Land das Audit
ausgeloest hat; dass die Dedup-Regel "juengstes `ts` je Branch" dieselbe Grundmenge bildet wie die
von Worktrail IV benutzte.
