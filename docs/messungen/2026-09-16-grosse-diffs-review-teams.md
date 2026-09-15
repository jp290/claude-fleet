---
frage: Wie hält Claude Fleet große Änderungen für Teams mit zwei bis fünf Reviewern prüfbar?
urteil: Erst gemeinsame Messung, Review-Paket und Schnitt vor dem Start; die Ledger rechtfertigen keinen harten Zeilendeckel.
bereich: [review, teams, land-qualitaet]
belege: [lane-outcomes.jsonl, post-land-audits.jsonl, audit-adjudications.jsonl, land-quality.ts#main, card-extract.ts#validateCard, task-land-waves.ts#landWaveUnits, server.ts#laneOutsideSurface, server.ts#mergeJob, docs/harness-adapter.md]
nicht-gemessen: Menschliche Reviewzeit, übersehene Produktfehler, kausaler Größeneffekt und Mehrpersonen-Autorisierung; fehlende Historie und offene Rework-Fenster bleiben unknown.
stand: 2026-09-15
---

# Große Diffs für Teams reviewbar halten

**Entscheidungsvorschlag:** Zuerst gemeinsame Nenner, dann ein Review-Paket pro Änderung und ein
prüfbarer Schnitt vor dem Start. Einen Größenmodus anschließend beratend pilotieren. Die gemessenen
Audit-Rotraten steigen nicht durchgehend mit der Diffgröße; Rework steigt, ist aber kein Fehlernachweis.
Die vier Vorschläge in §3 sind Queue-Vorlagen, keine gestarteten Aufträge und keine neuen Regeln.

Owner-Anlass: Menschen lesen Diffs mit über 3.000 Zeilen, finden sie insgesamt plausibel und übersehen
dabei einzelne Fehler. Auftrag hier: vorhandene Fleet-Belege für gemeinsames Review nutzbar machen.
Die Wirkung bei Teams mit zwei bis fünf Reviewern ist eine zu prüfende Hypothese.

## 1. Messung

### Grundgesamtheit und Bedeutung der Zahlen

Fenster **2026-08-16 21:09:42 bis 2026-09-15 21:09:42 UTC**, beide Grenzen inklusive, nach `outcome.ts`.
567 gelandete Outcomes aus zwölf exakt getrennten Repo-Pfaden; Worktree-Pfade werden nicht stillschweigend
mit dem Hauptrepo zusammengelegt. Sechs Outcomes haben weder `mainAfter` noch Shortstat: Größe unknown.
Größe = hinzugefügte + entfernte **Textzeilen** im gespeicherten Shortstat, Klassen <100, 100–299,
300–999, ≥1000. Binäränderungen sind darin nicht als Textzeilen gemessen. `n` zählt Lands, keine PRs,
Personen oder unabhängigen Audits.

**Audit rot roh** = mindestens ein roter, tatsächlich messender Audit für
`(repo, branch, mainAfter)` in `covers`; nur `red`/`green` zählen im Nenner. `unknown`, fehlende Zuordnung
und fehlender Land-SHA sind keine grünen Ergebnisse. **Ohne flake** entfernt rote Zuordnungen, deren
neueste bis zum Stichtag vorliegende Adjudikation `flake` lautet; das ist keine kausale Fehlerquote.
Beide Spalten stehen nebeneinander, weil rohe Suite-Fehler und adjudizierte Befunde andere Fragen
beantworten (`land-quality.ts#main:316`, `land-quality.ts#aggregate:66`).

**rework3d** = mindestens eine eingefügte Zeile innerhalb von drei Tagen durch einen späteren Commit
umgeschrieben; Nenner nur aufgelöste Lands mit abgeschlossenem Fenster. **fix3d Code** verlangt zusätzlich
eine Codezeile und einen späteren Betreff mit Präfix `fix`; Nenner nur bekannte Code-Lands mit
abgeschlossenem Fenster (`land-quality.ts#main:283`, `land-quality.ts#aggregate:66`). Das sind Anteile
betroffener Lands, nicht Anteile aller Zeilen. Rework umfasst auch Weiterentwicklung und Verschieben.

Die Rework-Beobachtung endet am festgehaltenen Integrationscommit je Repo, nicht am aktuellen Datum.
Fleet: Belegcommit `bf413fa53750e8cfc42c5a0e97211cec6686635c`, Commitzeit 2026-09-15 21:03:34 UTC.
Der unveränderte Leser liefert hier 468 Lands, rework3d **153/345 (44 %)**, fix3d Code **52/228 (23 %)**;
123 Rework-Fenster sind noch offen, keine History-/blame-Fehler. Für die folgende Tabelle werden diese
Ergebnisse zurück an die nach Outcome-Zeit gewählten Lands und deren **Shortstat-Klasse** gebunden.

Andere Repos wurden mit demselben Leser in temporären Shared-Clones geprüft: nur die Repo-Pfade in
kopierten Ledger-Fixtures wurden auf den Clone umgeschrieben. 62 Ergebnisse aus acht Repo-Pfaden,
davon 59 geschlossene Rework-Fenster. 31 weitere Lands sind im gewählten Integrationsverlauf nicht
enthalten: 21 `private-repo-o.worktrees/game-maker-private-repo-o-fresh`, neun
`private-repo-j.worktrees/game-maker-private-repo-j`, eins `private-repo-j.worktrees/astra-main`. Zwei weitere externe
Lands haben keinen `mainAfter`. Diese Fälle bleiben unknown; es wird kein anderer Branch als Ersatz
behauptet. Bei Private-repo-e endet der Horizont am 22. August, deshalb bleiben beide Fenster offen; das
Private-repo-aa hat ein offenes Fenster. Exakte Commitbelege stehen im ausführbaren Skript unten.

### Ergebnis und Prüfung der Ausgangsrechnung

| Textzeilen | n | Direkter SHA-Join: rot/gemessen | Abdeckungs-Join: rot/gemessen |
|---|---:|---:|---:|
| <100 | 90 | 24/65 (37 %) | 28/81 (35 %) |
| 100–299 | 202 | 49/137 (36 %) | 62/169 (37 %) |
| 300–999 | 202 | 42/143 (29 %) | 49/171 (29 %) |
| ≥1000 | 67 | 9/20 (45 %) | 11/26 (42 %) |
| unknown | 6 | unknown | unknown |

Die Vorrechnung **83/178/215/23 auditiert, 34/29/25/48 % rot** ist mit diesem 30-Tage-Fenster weder
über `mainAfter=mainSha` noch über `covers` reproduzierbar. Ohne ihren genauen Ledgerstand und ihr
Skript ist die Abweichungsursache unknown. Im gelesenen Audit-Ledger decken 42 von 669 Einträgen mehr
als einen Land ab; bei 53 liegt `mainSha` nicht in den eigenen `covers`. Der Tip-Join kann deshalb die
Abdeckung nicht ersetzen. In diesem Fenster gibt es keine doppelten Outcome-`mainAfter` und keine
mehrfachen Audit-Zuordnungen je abgedecktem Land.

Der Abdeckungs-Join liefert **447 gemessene Lands**, 112 mit Ergebnis `unknown`, zwei mit bekanntem
Land-SHA ohne Audit und sechs ohne Land-SHA: **120 ohne messenden Audit**. Roh rot sind 150/447 (34 %),
nach 65 Flake-Adjudikationen 85/447 (19 %). Gemeinsame Audits erzeugen korrelierte Zuordnungen; die 447
sind keine 447 voneinander unabhängigen Prüfungen.

**Karten-size ist eine andere Achse:** Der Fleet-Leser gibt klein **7/31 (23 %)**, mittel
**10/25 (40 %)**, gross **2/2 (100 %)** für adjudiziertes Audit rot aus. Die im Brief genannten 21 % /
33 % / 2/2 sind somit kein aktueller Rework-Vergleich. Für **alle 60** Lands mit noch zuordenbarer
Karten-size sind die Rework-Fenster offen; bei 408 fehlt die Karten-size im gelesenen Aufgabenstand.
`land-quality.ts#main:220` liest sie aus dem heutigen `fleet.json`, nicht aus einem historischen
Karten-Snapshot. Aus 2/2 folgt kein belastbarer Größen- oder Modelleffekt. Eine weitere Lesung während dieser Messung
ergab mittel 10/24 und 409 ohne size: Derselbe Git-Horizont friert den Aufgabenstand nicht ein.
Die oben zitierten Kartenwerte gehören zur ersten CLI-Ausgabe; die Haupttabelle hängt nicht an size.

**Lesart:** Die gepoolte rohe Rotrate lautet 35/37/29/42 %, ohne Flake 14/24/15/31 %.
Rework nach Shortstat-Klasse lautet 26/33/53/67 %. Das begründet eine zu testende Review-Hilfe für große
Änderungen, keinen universellen Grenzwert. Fleet allein stellt 438 von 447 gemessenen Audit-Zuordnungen;
Modellvergleiche vermischen Aufgabenart, Zeit, Repo und offene Fenster. Zum Beispiel haben die 23
Fleet-Lands mit `gpt-6-astra` nur drei geschlossene Rework-Fenster und zwei Code-Lands laut Leser.
Ein Ranking nach „0 % Rework“ wäre hier irreführend.

### Größe × Repo × Modell

Repo-Pfade sind relativ zu `/Users/owner/` ausgeschrieben. Harness und Modell bleiben die rohen
Ledgerwerte; fehlende Werte heißen `unknown`, Aliasnamen werden nicht zusammengelegt.
`unknown (0)` bedeutet keinen bekannten Nenner, nicht null Fehler. Jede Prozentzahl hat den eigenen
Nenner direkt davor. Die letzte Tabelle fasst die 82 besetzten Zellen zusammen.

| Repo | Harness/Modell (Ledgerwert) | Zeilen | n | Audit rot roh | ohne flake | rework3d | fix3d Code |
|---|---|---:|---:|---:|---:|---:|---:|
| private-repo-j.worktrees/astra-main | pi-zai/glm-5.3 | 100–299 | 1 | unknown (0) | unknown (0) | unknown (0) | unknown (0) |
| private-repo-j | codex/sol | 100–299 | 1 | unknown (0) | unknown (0) | 0/1 (0%) | unknown (0) |
| private-repo-j | pi-zai/glm-5.3 | 300–999 | 1 | unknown (0) | unknown (0) | 0/1 (0%) | unknown (0) |
| private-repo-j | unknown/fable | 100–299 | 3 | unknown (0) | unknown (0) | 1/3 (33%) | unknown (0) |
| private-repo-j | unknown/fable | 300–999 | 1 | unknown (0) | unknown (0) | 0/1 (0%) | unknown (0) |
| private-repo-j | unknown/opus | ≥1000 | 14 | unknown (0) | unknown (0) | 3/14 (21%) | 2/14 (14%) |
| private-repo-j | unknown/unknown | 100–299 | 1 | unknown (0) | unknown (0) | 0/1 (0%) | 0/1 (0%) |
| private-repo-j.worktrees/game-maker-private-repo-j | codex/unknown | <100 | 3 | 0/3 (0%) | 0/3 (0%) | unknown (0) | unknown (0) |
| private-repo-j.worktrees/game-maker-private-repo-j | codex/unknown | 300–999 | 1 | 0/1 (0%) | 0/1 (0%) | unknown (0) | unknown (0) |
| private-repo-j.worktrees/game-maker-private-repo-j | unknown/claude-opus-5[1m] | 100–299 | 1 | 0/1 (0%) | 0/1 (0%) | unknown (0) | unknown (0) |
| private-repo-j.worktrees/game-maker-private-repo-j | unknown/claude-opus-5[1m] | ≥1000 | 4 | 1/4 (25%) | 1/4 (25%) | unknown (0) | unknown (0) |
| claude-fleet | codex/gpt-5.5 | 300–999 | 2 | 0/2 (0%) | 0/2 (0%) | 2/2 (100%) | 2/2 (100%) |
| claude-fleet | codex/gpt-5.6-sol | <100 | 7 | 3/7 (43%) | 0/7 (0%) | 2/7 (29%) | 0/6 (0%) |
| claude-fleet | codex/gpt-5.6-sol | 100–299 | 16 | 7/15 (47%) | 4/15 (27%) | 6/15 (40%) | 4/10 (40%) |
| claude-fleet | codex/gpt-5.6-sol | 300–999 | 11 | 3/11 (27%) | 2/11 (18%) | 5/11 (45%) | 3/5 (60%) |
| claude-fleet | codex/gpt-6-astra | <100 | 1 | 0/1 (0%) | 0/1 (0%) | unknown (0) | unknown (0) |
| claude-fleet | codex/gpt-6-astra | 100–299 | 15 | 1/15 (7%) | 1/15 (7%) | 0/3 (0%) | unknown (0) |
| claude-fleet | codex/gpt-6-astra | 300–999 | 7 | 0/7 (0%) | 0/7 (0%) | unknown (0) | unknown (0) |
| claude-fleet | pi/openai-codex/gpt-5.6-sol | 300–999 | 1 | 0/1 (0%) | 0/1 (0%) | 0/1 (0%) | 0/1 (0%) |
| claude-fleet | pi/openai-codex/gpt-5.6-sol | unknown | 2 | unknown (0) | unknown (0) | unknown (0) | unknown (0) |
| claude-fleet | pi-zai/glm-5.3 | <100 | 9 | 4/8 (50%) | 1/8 (12%) | 1/8 (12%) | 0/1 (0%) |
| claude-fleet | pi-zai/glm-5.3 | 100–299 | 19 | 9/18 (50%) | 2/18 (11%) | 2/16 (12%) | unknown (0) |
| claude-fleet | pi-zai/glm-5.3 | 300–999 | 7 | 4/6 (67%) | 3/6 (50%) | 1/7 (14%) | unknown (0) |
| claude-fleet | pi-zai/glm-5.3 | ≥1000 | 1 | 0/1 (0%) | 0/1 (0%) | 1/1 (100%) | 0/1 (0%) |
| claude-fleet | pi-zai/unknown | 100–299 | 3 | 1/2 (50%) | 1/2 (50%) | 0/3 (0%) | unknown (0) |
| claude-fleet | unknown/claude-fable-5 | 100–299 | 2 | 0/2 (0%) | 0/2 (0%) | 0/2 (0%) | unknown (0) |
| claude-fleet | unknown/claude-fable-5 | 300–999 | 3 | 0/3 (0%) | 0/3 (0%) | 3/3 (100%) | 3/3 (100%) |
| claude-fleet | unknown/claude-fable-5-1[1m] | <100 | 1 | 0/1 (0%) | 0/1 (0%) | 0/1 (0%) | 0/1 (0%) |
| claude-fleet | unknown/claude-fable-5-1[1m] | 100–299 | 1 | 0/1 (0%) | 0/1 (0%) | 1/1 (100%) | 0/1 (0%) |
| claude-fleet | unknown/claude-fable-5-1[1m] | 300–999 | 6 | 1/4 (25%) | 1/4 (25%) | 4/6 (67%) | 0/4 (0%) |
| claude-fleet | unknown/claude-fable-5-1[1m] | ≥1000 | 4 | 3/4 (75%) | 2/4 (50%) | 4/4 (100%) | 2/4 (50%) |
| claude-fleet | unknown/claude-haiku-4-5-20251001 | unknown | 1 | unknown (0) | unknown (0) | unknown (0) | unknown (0) |
| claude-fleet | unknown/claude-opus-5 | <100 | 3 | 2/3 (67%) | 0/3 (0%) | 0/3 (0%) | 0/3 (0%) |
| claude-fleet | unknown/claude-opus-5 | 100–299 | 6 | 1/6 (17%) | 0/6 (0%) | 1/6 (17%) | 1/5 (20%) |
| claude-fleet | unknown/claude-opus-5 | 300–999 | 14 | 3/12 (25%) | 3/12 (25%) | 3/14 (21%) | 0/5 (0%) |
| claude-fleet | unknown/claude-opus-5[1m] | <100 | 36 | 10/35 (29%) | 5/35 (14%) | 5/19 (26%) | 2/18 (11%) |
| claude-fleet | unknown/claude-opus-5[1m] | 100–299 | 87 | 35/80 (44%) | 25/80 (31%) | 27/58 (47%) | 5/45 (11%) |
| claude-fleet | unknown/claude-opus-5[1m] | 300–999 | 95 | 31/91 (34%) | 16/91 (18%) | 46/73 (63%) | 17/62 (27%) |
| claude-fleet | unknown/claude-opus-5[1m] | ≥1000 | 14 | 6/14 (43%) | 5/14 (36%) | 10/12 (83%) | 3/10 (30%) |
| claude-fleet | unknown/claude-sonnet-5 | <100 | 3 | 1/2 (50%) | 0/2 (0%) | 0/3 (0%) | 0/2 (0%) |
| claude-fleet | unknown/claude-sonnet-5 | 300–999 | 1 | unknown (0) | unknown (0) | 0/1 (0%) | unknown (0) |
| claude-fleet | unknown/fable | 100–299 | 2 | 2/2 (100%) | 1/2 (50%) | 0/2 (0%) | unknown (0) |
| claude-fleet | unknown/fable | 300–999 | 10 | 2/10 (20%) | 0/10 (0%) | 1/5 (20%) | unknown (0) |
| claude-fleet | unknown/opus | <100 | 4 | 2/4 (50%) | 0/4 (0%) | 1/4 (25%) | 1/3 (33%) |
| claude-fleet | unknown/opus | 100–299 | 2 | 1/1 (100%) | 1/1 (100%) | 1/2 (50%) | 0/1 (0%) |
| claude-fleet | unknown/opus | 300–999 | 1 | 0/1 (0%) | 0/1 (0%) | 0/1 (0%) | 0/1 (0%) |
| claude-fleet | unknown/opus | ≥1000 | 2 | 1/2 (50%) | 0/2 (0%) | 2/2 (100%) | 0/1 (0%) |
| claude-fleet | unknown/unknown | <100 | 20 | 6/17 (35%) | 5/17 (29%) | 6/11 (55%) | 1/6 (17%) |
| claude-fleet | unknown/unknown | 100–299 | 29 | 5/26 (19%) | 5/26 (19%) | 6/23 (26%) | 1/15 (7%) |
| claude-fleet | unknown/unknown | 300–999 | 22 | 5/22 (23%) | 1/22 (5%) | 11/14 (79%) | 6/11 (55%) |
| claude-fleet | unknown/unknown | ≥1000 | 1 | 0/1 (0%) | 0/1 (0%) | 1/1 (100%) | 1/1 (100%) |
| claude-fleet | unknown/unknown | unknown | 1 | unknown (0) | unknown (0) | unknown (0) | unknown (0) |
| private-repo-n | unknown/claude-opus-5[1m] | ≥1000 | 4 | unknown (0) | unknown (0) | 0/4 (0%) | 0/4 (0%) |
| private-repo-n | unknown/unknown | 300–999 | 1 | unknown (0) | unknown (0) | 0/1 (0%) | unknown (0) |
| private-repo-n | unknown/unknown | ≥1000 | 2 | unknown (0) | unknown (0) | 2/2 (100%) | 0/2 (0%) |
| private-repo-ac | codex/gpt-5.6-sol | 300–999 | 1 | unknown (0) | unknown (0) | 0/1 (0%) | 0/1 (0%) |
| private-repo-ac | codex/gpt-5.6-sol | ≥1000 | 3 | unknown (0) | unknown (0) | 3/3 (100%) | 1/3 (33%) |
| private-repo-o | codex/gpt-5.6-sol | 300–999 | 2 | unknown (0) | unknown (0) | 1/2 (50%) | 1/2 (50%) |
| private-repo-o | codex/gpt-5.6-sol | ≥1000 | 3 | unknown (0) | unknown (0) | 3/3 (100%) | 3/3 (100%) |
| private-repo-o | unknown/opus | ≥1000 | 1 | unknown (0) | unknown (0) | 1/1 (100%) | 1/1 (100%) |
| private-repo-o | unknown/opus | unknown | 2 | unknown (0) | unknown (0) | unknown (0) | unknown (0) |
| private-repo-o.worktrees/game-maker-private-repo-o-fresh | pi-zai/unknown | ≥1000 | 1 | unknown (0) | unknown (0) | unknown (0) | unknown (0) |
| private-repo-o.worktrees/game-maker-private-repo-o-fresh | unknown/claude-opus-5[1m] | 100–299 | 6 | unknown (0) | unknown (0) | unknown (0) | unknown (0) |
| private-repo-o.worktrees/game-maker-private-repo-o-fresh | unknown/claude-opus-5[1m] | 300–999 | 11 | unknown (0) | unknown (0) | unknown (0) | unknown (0) |
| private-repo-o.worktrees/game-maker-private-repo-o-fresh | unknown/claude-opus-5[1m] | ≥1000 | 2 | unknown (0) | unknown (0) | unknown (0) | unknown (0) |
| private-repo-o.worktrees/game-maker-private-repo-o-fresh | unknown/claude-sonnet-5 | 300–999 | 1 | unknown (0) | unknown (0) | unknown (0) | unknown (0) |
| private-repo-p | codex/gpt-5.6-sol | <100 | 1 | unknown (0) | unknown (0) | 0/1 (0%) | unknown (0) |
| private-repo-p | codex/gpt-5.6-sol | 100–299 | 1 | unknown (0) | unknown (0) | 0/1 (0%) | unknown (0) |
| private-repo-p | codex/gpt-5.6-sol | 300–999 | 1 | unknown (0) | unknown (0) | 0/1 (0%) | unknown (0) |
| private-repo-p | unknown/claude-fable-5-1[1m] | ≥1000 | 3 | unknown (0) | unknown (0) | 3/3 (100%) | 2/3 (67%) |
| private-repo-p | unknown/claude-opus-5[1m] | ≥1000 | 4 | unknown (0) | unknown (0) | 3/4 (75%) | 2/4 (50%) |
| private-repo-p | unknown/unknown | 100–299 | 1 | unknown (0) | unknown (0) | 0/1 (0%) | 0/1 (0%) |
| private-repo-e | unknown/claude-opus-5[1m] | <100 | 1 | unknown (0) | unknown (0) | unknown (0) | unknown (0) |
| private-repo-e | unknown/claude-opus-5[1m] | 100–299 | 1 | unknown (0) | unknown (0) | unknown (0) | unknown (0) |
| private-repo-k | codex/unknown | 100–299 | 1 | unknown (0) | unknown (0) | 0/1 (0%) | unknown (0) |
| private-repo-k | pi-ox/x-preview-f-free | 100–299 | 1 | unknown (0) | unknown (0) | 0/1 (0%) | unknown (0) |
| private-repo-k | unknown/claude-fable-5 | <100 | 1 | unknown (0) | unknown (0) | 0/1 (0%) | unknown (0) |
| private-repo-k | unknown/claude-fable-5 | 100–299 | 2 | unknown (0) | unknown (0) | 2/2 (100%) | unknown (0) |
| private-repo-k | unknown/claude-fable-5 | 300–999 | 1 | unknown (0) | unknown (0) | 1/1 (100%) | unknown (0) |
| private-repo-k | unknown/claude-fable-5 | ≥1000 | 3 | unknown (0) | unknown (0) | 2/3 (67%) | 0/3 (0%) |
| private-repo-k | unknown/claude-opus-5[1m] | 300–999 | 1 | unknown (0) | unknown (0) | 0/1 (0%) | unknown (0) |
| private-repo-aa | codex/gpt-6-astra | ≥1000 | 1 | unknown (0) | unknown (0) | unknown (0) | unknown (0) |

| Alle Repos: Zeilen | n | Audit rot roh | ohne flake | rework3d | fix3d Code |
|---|---:|---:|---:|---:|---:|
| <100 | 90 | 28/81 (35%) | 11/81 (14%) | 15/58 (26%) | 4/40 (10%) |
| 100–299 | 202 | 62/169 (37%) | 40/169 (24%) | 47/142 (33%) | 11/79 (14%) |
| 300–999 | 202 | 49/171 (29%) | 26/171 (15%) | 78/147 (53%) | 32/97 (33%) |
| ≥1000 | 67 | 11/26 (42%) | 8/26 (31%) | 38/57 (67%) | 17/54 (31%) |
| unknown | 6 | unknown (0) | unknown (0) | unknown (0) | unknown (0) |

### Reproduktion

Das folgende Skript als `/tmp/review-messung.py` speichern und im untersuchten Fleet-Checkout ausführen:

```sh
python3 /tmp/review-messung.py "$(dirname "$(git rev-parse --git-common-dir)")" > /tmp/review-tabelle.md 2> /tmp/review-historie.log
```

Es ruft den bestehenden `bun land-quality.ts` mit festen Commitbelegen auf, schreibt ausschließlich
in neue temporäre Verzeichnisse und bricht bei Clone-/Probe-/JSON-Fehlern ab. Die zweite Ausführung
ergab eine bytegleiche Tabelle (`cmp` Exit 0). Der Leserstand ist der genannte Fleet-Belegcommit.
Ledger sind veränderliche, gitignored Eingaben: Reproduzierbarkeit verlangt dieselben Zeilen und
Adjudikationen bis zum Stichtag, für Karten-size zusätzlich denselben `fleet.json`-Aufgabenstand; spätere Rotation oder rückwirkende Korrekturen können Ergebnisse
ändern. Das Skript liest die genannten aktuellen JSONL-Dateien, keine rotierten Archive.

```python
import json, pathlib, subprocess, tempfile, sys, os
fleet=pathlib.Path(sys.argv[1]).resolve(); probe=pathlib.Path.cwd()/'land-quality.ts'
work=pathlib.Path(tempfile.mkdtemp(prefix='fleet-review-'))
read=lambda p:[json.loads(x) for x in pathlib.Path(p).read_text().splitlines() if x.strip()]
run=lambda args:subprocess.run(args,check=True,capture_output=True,text=True,env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'})
qfleet=work/'fleet.jsonl'
run(['bun',str(probe),'--since','30d','--at','bf413fa53750e8cfc42c5a0e97211cec6686635c','--root',str(fleet),'--out',str(qfleet)])
heads={
  "private-repo-n": "ac157a5163ccde3f30bd89fe4409a2eb99b03148",
  "private-repo-e": "5d1b385ee416967482bd19b107ae74ae531edeb3",
  "private-repo-k": "330177ad0361068d031d18c588e2ba84c3bb3052",
  "private-repo-ac": "394392fba8b10e765b644ed40d7a9a3e0a7c450a",
  "private-repo-j": "37695151cd83e7c4d5ade511633d90a22a51cbd0",
  "private-repo-o": "639825043e930a86f2da1e0d0c27feb1921ac162",
  "private-repo-o.worktrees/game-maker-private-repo-o-fresh": "639825043e930a86f2da1e0d0c27feb1921ac162",
  "private-repo-p": "188f150143fb9051aa73f5f62c744482e6b79679",
  "private-repo-j.worktrees/game-maker-private-repo-j": "37695151cd83e7c4d5ade511633d90a22a51cbd0",
  "private-repo-j.worktrees/astra-main": "26a5bf3a81cd5c201f99b9722302344322d874c2",
  "private-repo-aa": "343e6a44e8e8648d044f64623da50ad32f5cfa36"
}
outcomes=read(fleet/'lane-outcomes.jsonl'); audits=read(fleet/'post-land-audits.jsonl')
adjudications=read(fleet/'audit-adjudications.jsonl'); external=[]
for i,(label,head) in enumerate(heads.items()):
 repo=str(fleet.parent/label); target=work/str(i)
 run(['git','clone','--shared','--quiet',repo,str(target)])
 for name,rows in [('lane-outcomes.jsonl',outcomes),('post-land-audits.jsonl',audits)]:
  selected=[{**r,'repo':str(target.resolve())} for r in rows if r.get('repo')==repo]
  (target/name).write_text(''.join(json.dumps(r)+'\n' for r in selected))
 (target/'audit-adjudications.jsonl').write_text(''.join(json.dumps(r)+'\n' for r in adjudications))
 result=run(['bun',str(probe),'--since','31d','--at',head,'--json','--root',str(target),'--out',str(target/'q.jsonl')])
 data=json.loads(result.stdout)
 print(json.dumps({'repo':label,'horizon':data['horizonAt'],'excluded':data['excluded']}),file=sys.stderr)
 external.extend({**r,'repo':repo} for r in data['rows'])
qexternal=work/'external.jsonl';qexternal.write_text(''.join(json.dumps(r)+'\n' for r in external))
sys.argv=[sys.argv[0],str(fleet),str(qfleet),str(qexternal)]

import json, sys, pathlib, collections, re
root=pathlib.Path(sys.argv[1]); end=1789506582000; start=end-30*86400000
read=lambda p:[json.loads(x) for x in pathlib.Path(p).read_text().splitlines() if x.strip()]
out=[o for o in read(root/'lane-outcomes.jsonl') if o.get('disposition')=='landed' and start<=o['ts']<=end]
aud=[a for a in read(root/'post-land-audits.jsonl') if a['at']<=end]
adj={}
for a in read(root/'audit-adjudications.jsonl'):
 if a.get('at',0)<=end and a.get('at',0)>=adj.get(a.get('auditAt'),{}).get('at',-1): adj[a.get('auditAt')]=a
covers=collections.defaultdict(list); direct=collections.defaultdict(list)
for a in aud:
 direct[(a.get('repo'),a.get('mainSha'))].append(a)
 for c in a.get('covers',[]): covers[(a.get('repo'),c.get('branch'),c.get('mainAfter'))].append(a)
q={}
for name in sys.argv[2:]:
 for r in read(name): q[(r.get('repo',str(root)),r['branch'],r['mainAfter'])]=r
bins=['<100','100–299','300–999','≥1000','unknown']
def size(o):
 s=o.get('shortstat',''); n=sum(map(int,re.findall(r'(\d+) (?:insertion|deletion)',s)))
 return 'unknown' if not s else bins[0 if n<100 else 1 if n<300 else 2 if n<1000 else 3]
def calc(rows):
 d=red=effective=rw=rwd=fx=fxd=0
 for o in rows:
  aa=[a for a in covers[(o.get('repo'),o.get('branch'),o.get('mainAfter'))] if a.get('result') in ['red','green']]
  if aa:
   d+=1; red+=any(a['result']=='red' for a in aa)
   effective+=any(a['result']=='red' and adj.get(a['at'],{}).get('verdict')!='flake' for a in aa)
  r=q.get((o.get('repo'),o.get('branch'),o.get('mainAfter')), {})
  if r.get('reworkLines3d') is not None: rwd+=1; rw+=r['reworkLines3d']>0
  if r.get('codeLand') and r.get('reworkByFixSubject') is not None: fxd+=1; fx+=bool(r['reworkByFixSubject'])
 ratio=lambda k,n:f'{k}/{n} ({100*k/n:.0f}%)' if n else 'unknown (0)'
 return [len(rows),ratio(red,d),ratio(effective,d),ratio(rw,rwd),ratio(fx,fxd)]
print('| Repo | Harness/Modell (Ledgerwert) | Zeilen | n | Audit rot roh | ohne flake | rework3d | fix3d Code |')
print('|---|---|---:|---:|---:|---:|---:|---:|')
g=collections.defaultdict(list)
for o in out:g[(o.get('repo','unknown'),o.get('harness') or 'unknown',o.get('model') or 'unknown',size(o))].append(o)
for (repo,h,m,b),rows in sorted(g.items(),key=lambda x:(x[0][0],x[0][1],x[0][2],bins.index(x[0][3]))):
 label=repo.removeprefix('/Users/owner/')
 print('| '+' | '.join(map(str,[label,f'{h}/{m}',b,*calc(rows)]))+' |')
print('\n| Alle Repos: Zeilen | n | Audit rot roh | ohne flake | rework3d | fix3d Code |')
print('|---|---:|---:|---:|---:|---:|')
for b in bins:print('| '+' | '.join(map(str,[b,*calc([o for o in out if size(o)==b])]))+' |')
print('\nKontrolle: n='+str(len(out))+', Zellen='+str(len(g)))
```

## 2. Was Fleet heute trägt

Codebefunde sind **gelesen**, nicht als Teamverhalten im Betrieb getestet. Die Zeiger nennen den
geprüften Einstieg und die Zeile im untersuchten Baum.

| Mechanik | Heute vorhanden | Grenze und Kosten für Review |
|---|---|---|
| Karte | `card-extract.ts#validateCard:205` prüft Ziel, DONE, Verify-Schritt und benannte getrackte Dateien/Symbole; geplante Neudateien stehen unter `creates`. `card-extract.ts#sizeNamedIn:167` verlangt eine ausdrücklich benannte Größenklasse. | Kartenklasse misst keine Diffzeilen. Ein gültiger Dateipfad beweist keine eingehaltene Symbolgrenze. Ohne weiteren Vergleich muss der Reviewer das selbst feststellen. |
| Land-Welle | `task-land-waves.ts#landWaveUnits:85`: klein/mittel/gross wiegen 1/2/3, fehlende Größe 2; Defaultbudget 5, maximal 6 Karten (`LAND_WAVE_BUDGET_DEFAULT:80`, `LAND_WAVE_ROWS_MAX:81`). `task-land-waves.ts#classify:195` trennt unter anderem Gate-Änderer; `task-land-waves.ts#wavesFor:375` gruppiert nach Program und Prüfklasse. | Das Budget begrenzt gepackte Arbeit, nicht menschliche Leselast. Mehrere kleine Karten können zusammen einen großen Diff erzeugen. |
| Terminaler Größenbeleg | `server.ts#buildLaneOutcome:21626` liest Shortstat, Commitzahl und bis zu 200 geänderte Pfade; `server.ts#outcomeReview:21496` liefert die Review-Beziehung, aufgerufen bei `server.ts:21666`. | Erst am Lane-Ende; ein fehlgeschlagener Git-Read wird als leeres Shortstat gespeichert, deshalb hier unknown statt null Zeilen. Zeilenzahl allein unterscheidet keine generierten Dateien, Änderungen an Verträgen oder Tests. Die Pfadliste ist gekappt. |
| Hunk-/Rework-Messung | `land-quality.ts#parseLog:146` gruppiert alte Hunkbereiche je Commit/Datei; `land-quality.ts#main:180` ordnet spätere Änderungen per blame ursprünglichen Land-Commits zu. `land-quality.ts#aggregate:66` zählt Lands mit Rework, nicht den Anteil umgeschriebener Zeilen. | Drei Tage Verzögerung; Umzüge und notwendige Weiterentwicklung können Rework sein. `fix3d` hängt am Commit-Betreff. Kein Maß für menschlich übersehene Fehler. |
| Automatischer Reviewer ③ | `server.ts#tickAutoReview:14195` startet beim passenden Lane-Zustand; `server.ts#fileLaneReview:14288` bindet das Urteil an die Patchidentität und liefert an MAIN/Inbox. Beschreibung: `docs/harness-adapter.md` §auto-③:137. | Beratend, kein Land-Gate; ein Urteil je Task/Patchidentität ist kein Mehrpersonenreview. `src/client.ts#reviewBody:9966` unterscheidet Parsefehler und fehlende Findings ausdrücklich von belegter Fehlerfreiheit. |
| Land-Gate | `server.ts#mergeJob:23955` führt die Integration und Verifikation; die Verify-Aufrufe stehen bei `server.ts:24372` und `server.ts:24406`. Optionaler Clean-Review-Modus ist ein anderer Mechanismus (`server.ts#mergeJob:24475`). | Eine grüne Prüfung beantwortet die ausführbaren Checks. Sie beweist weder Zielerfüllung noch menschliches Verständnis; ein Audit nach Land kommt für die Vorabfreigabe zu spät. |
| Abweichung von der Kartenfläche | `server.ts#laneOutsideSurface:8174` vergleicht die committed Pfade aus `<base>...HEAD` mit `files ∪ creates`. `server.ts#openFleetReport:8185` persistiert den Befund; `src/client.ts#ownerReportRowEl:11452` zeigt zusätzliche Pfade. Beleg für die Einführung: Commit `364cdca0`. | Nur Dateien, keine Hunks innerhalb einer erlaubten Datei. Fehlende Messung ist `null`, leer gemessen ist `[]`; die UI zeigt derzeit nur eine nichtleere Liste. Ohne Anzeige dieser Unterscheidung bleibt dem Leser die Messlücke verborgen. |
| Program als Freigabestufe | `server/types.ts#ProgramRelease:1789` trägt die bestätigte Politik; `server/types.ts#loadProgramRelease:1790` akzeptiert manual/card-valid/all, unlesbar fällt auf Abwesenheit zurück. Betriebsreferenz: `docs/queue-analyst.md` §5:237. | Die Startfreigabepolitik liegt am Program; Landautorität bleibt eine getrennte Promotion (`server/types.ts#Program:1620`). Die gelesenen Typen und Review-Pfade liefern keine Liste authentifizierter menschlicher Reviewer und kein Quorum. Das müsste für mehrere unabhängige Owner gesondert entschieden werden. |

**Einordnung der Bündelungsnotiz:** `docs/messungen/2026-09-16-buendelung-systempruefung-glm.md`
§1–3 nennt die Einzelzeile als tragende Form und beschreibt Kosten serieller Zerlegung. Diese Notiz ist
hier gelesen, ihre Betriebszählungen sind nicht neu geprüft. Daraus folgt als Vorschlag: erst einzeln
prüfbare Ergebnisse schneiden und Zuständigkeit festlegen; keine zusätzliche Wellen- oder Kettenlogik
nur wegen eines großen Diffs bauen. Der Auftrag bleibt bei der Team-Review-Frage.

## 3. Schnitte, nach erwartetem Ertrag je Aufwand

**Vorschläge, keine freigegebenen Aufträge.** Aufwand sind Planungsschätzungen in Entwicklertagen,
keine gemessenen Laufzeiten. Reihenfolge: erst den Nenner verlässlich machen, dann die vorhandenen
Belege zusammen anzeigen, dann vor dem Start schneiden. Schnitt 4 ist ein getrennter Pilot.
Die Rangliste endet bei reviewbaren Änderungen; neue Scheduler, automatische Zerlegung und eine
allgemeine Teamverwaltung gehören nicht zu diesem Auftrag (Owner-Grenze: `docs/scope-inflation.md` §7:148).

### 1 — Eine wiederholbare Messung mit denselben Nennern (1–2 Tage)

**Mechanismus und Ansatz:** Die Rechnung aus §1 in den bestehenden Leser übernehmen. Audit-Abdeckung,
Diffgröße und Drei-Tage-Rework je Repo/Modell ausgeben; unbekannte Größen, offene Fenster und fehlende
Git-Historie sichtbar lassen. **Ertrag:** vermeidet die hier nachgewiesene Verwechslung von Audit-Tip und
abgedeckten Lands. **Team mit 2–5 Reviewern:** alle verwenden dieselbe Baseline; Modell- oder
Größenregeln werden nicht aus unterschiedlichen Nennern abgeleitet. Kosten: explizite Trennung von Ledgerquelle und Zielrepo in der CLI, Repo-Feld im Ergebnis und
synthetische Zuordnungsfälle, noch keine Oberfläche.

```text
ZIEL: Ein 30-Tage-Bericht trennt Diffgroesse, Repo, Modell, Audit-Abdeckung und rework3d mit expliziten Nennern.
FLAECHE: land-quality.ts#main, land-quality.ts#LandRow, land-quality.ts#renderFull, land-quality.ts#aggregate; NEU: e2e/land-quality.ts (standalone Probe)
DONE: Eine Fixture mit zwei gemeinsam auditierten Lands, einem offenen 3d-Fenster und nicht aufloesbarer Git-Historie liefert exakt die erwarteten Zaehler; fremdes Repo und fehlende Historie werden nicht als Null gewertet.
VERIFY: install, pins, tsc; neue standalone Probe bun e2e/land-quality.ts; fester Ledger-Replay nach §1.
VERBOTEN: Gate oder Audit-Ergebnis umdeuten, Ledger-Originale schreiben, Modelle pauschal zusammenlegen.
ROLLE: codex / gpt-5.6-sol / medium
GROESSE: mittel (card.size=mittel)
```

### 2 — Ein Review-Paket pro Änderung (4–6 Tage)

**Mechanismus und Ansatz:** Am vorhandenen Report Karte, DONE/Verify, tatsächliche Diffgröße,
③-Abdeckung und Audit-Status zusammenführen; zuerst Abweichungen von der Kartenfläche zeigen.
Danach Hunks innerhalb bekannter Symbolgrenzen und einen Link zum vollständigen Diff anbieten.
Ein fehlender oder veralteter Symbolbereich bleibt `unknown`. Der aktuelle Post-Land-Audit ist vor
dem Land noch ausstehend; ein früherer grüner Audit darf nicht als Prüfung dieses Kandidaten erscheinen.
**Ertrag:** ein Einstiegspunkt statt mehrerer Belegsuchen. **Team mit 2–5 Reviewern:** ein Mensch liest
Ziel und Schnittstellen, die anderen teilen konkrete Bereiche auf; alle sehen dieselbe Diffidentität.
Kosten: Hunkvergleich mit versionierten Kartenbereichen, eingefrorene Diffidentität, nachträglicher Audit-Join in der Report-Projektion, Typen und Darstellung; Tests für Rebase, neue Dateien und fehlende Karte.

```text
ZIEL: Ein Report zeigt Karte, Verify-Beleg, Review-Abdeckung, Audit-Zuordnung und Hunks ausserhalb der Kartenflaeche fuer denselben Diff.
FLAECHE: server.ts#laneOutsideSurface, server.ts#openFleetReport, server.ts#fleetReportOwnerView; server/types.ts#FleetReport, server/types.ts#fleetReportFrom; src/client.ts#ownerReportRowEl; e2e/tasks.ts
DONE: Eine Aenderung ausserhalb eines benannten Symbols in derselben Datei wird gezeigt; geplante Neudatei gilt als innen; fehlende Range als unknown; nach Diffwechsel gilt altes Review nicht als Abdeckung; vor Land steht Audit ausstehend.
VERIFY: install, pins, tsc, build; ./e2e-isolated.sh (gesamte isolierte Suite; Faelle in e2e/tasks.ts); UI-Pruefung mit den fuenf benannten Faellen.
VERBOTEN: Rohdiff verstecken, fehlende Daten als bestanden darstellen, Landrechte oder automatische Reviewer-Starts ausweiten.
ROLLE: codex / gpt-5.6-sol / medium
GROESSE: mittel (card.size=mittel)
```

### 3 — Vor dem Start nach prüfbaren Ergebnissen schneiden (0,5–1 Tag)

**Mechanismus und Ansatz:** Eine Startvorlage im vorhandenen Karten-/Program-Verfahren: Owner-Satz,
ein beobachtbarer Effekt je Karte, eigenes DONE, benannter Reviewer, explizite Abhängigkeiten und ein
Verantwortlicher für das gemeinsame Ergebnis. Änderungen an derselben Schnittstelle nur dann trennen,
wenn jeder Zwischenstand geprüft werden kann. Eine große Änderung darf zusammenbleiben, wenn ein
Schnitt nur unprüfbare Zwischenstände schafft. **Ertrag:** der Mensch entscheidet über den Umfang,
bevor die Produktionskosten entstehen. **Team mit 2–5 Reviewern:** Arbeitsverteilung nach Verhalten und
Schnittstellen statt nach gleichen Zeilenzahlen. Kosten: Vorlage plus zwei durchgearbeitete Beispiele;
kein neuer Freigabepfad. Die Bündelungsnotiz begründet Vorsicht vor seriellen Kartenketten, aber ihre
noch ungeprüften Betriebszahlen werden hier nicht als Beweis übernommen.

```text
ZIEL: Die Startvorlage macht den geplanten Review-Schnitt vor Produktion pruefbar und endet beim Owner-Auftrag.
FLAECHE: docs/queue-analyst.md (Beispiele in §5; AGENTS.md nur als bestehender Vertrag gelesen)
DONE: Zwei Beispiele (trennbare UI/API-Aenderung und untrennbare Vertragsmigration) nennen pro Karte Effekt, DONE, VERIFY, Reviewer, Schnittstelle und echte after-Abhaengigkeit; beide erreichen genau den zitierten Owner-Auftrag.
VERIFY: install, pins; bun e2e/pins.ts; beide Beispiele gegen die sechs Kartenfelder und den Owner-Satz gegenlesen.
VERBOTEN: Neue bindende Pflicht ohne Owner-Promotion, mehr Arbeit als der Auftrag, neue Dispatch- oder Program-Mechanik.
ROLLE: codex / gpt-5.6-sol / medium
GROESSE: klein (card.size=klein)
```

### 4 — Größen-Deckel als Review-Modus pilotieren (2–4 Tage; nach Schnitt 2)

**Mechanismus und Ansatz:** Zunächst eine ausdrücklich gewählte, beratende Program-Konvention:
ab 1.000 hinzugefügten plus entfernten Textzeilen Bereichsreview und anschließender Integrationsreview.
1.000 ist eine zu erprobende Schwelle aus den Messklassen, kein nachgewiesener sicherer Grenzwert.
Fehlende Größe verlangt Sichtung. Ein Mensch sammelt Bereich, Diffidentität und offene Punkte zweier benannter Reviewer
als attestierten Text im Paket; bei fünf Reviewern bleiben drei zusätzliche Bereichsleser möglich, ein Mensch hält
das Gesamturteil. Ein Diffwechsel macht die betroffenen Lesebelege veraltet.
**Ertrag:** sichtbare Zuständigkeit bei großen Änderungen. **Kosten:** Darstellungszustände und manuell gesammelte
Lesebelege im bestehenden Reporttext; keine belastbare Mehrpersonen-Autorisierung. Identitäten gelten im Pilot als menschlich
attestiert. Für echte getrennte Owner-Rechte wäre ein eigener Auftrag erforderlich.

```text
ZIEL: Ein opt-in Review-Pilot macht ab 1000 Textzeilen zwei benannte Lesebelege und ihr Verhaeltnis zum aktuellen Diff sichtbar.
FLAECHE: src/client.ts#ownerReportRowEl; docs/queue-analyst.md; e2e/tasks.ts (Messfelder aus Schnitt 2 nur lesen)
DONE: 999/1000-Zeilen-Faelle wechseln exakt den Anzeigemodus; unbekannte Groesse bleibt unknown; der bestehende Reporttext kann zwei benannte Leser mit Bereichen dokumentieren, ausdruecklich als unbestaetigte Angabe; ein geaenderter Diff markiert das ganze alte Paket als veraltet; Land bleibt unveraendert moeglich.
VERIFY: install, pins, tsc, build; ./e2e-isolated.sh (gesamte isolierte Suite; Faelle in e2e/tasks.ts); manuelle Darstellung der Grenz- und Veraltungsfaelle.
VERBOTEN: Harte LOC-Sperre, automatische Freigabe, Gleichsetzung von Anzeigenamen mit authentifizierten Personen, neue Owner-Rechte.
ROLLE: codex / gpt-5.6-sol / medium
GROESSE: mittel (card.size=mittel)
```

## 4. Was für Teams neu ist

**Das gemeinsame Review-Objekt:** Karte + Prüfbelege + relevante Audit-Abdeckung + Hunks außerhalb
der Kartenfläche bilden den Einstieg. Der Rohdiff bleibt vollständig erreichbar. Wer einen Bereich
übernimmt, vermerkt auch die nicht gelesenen Schnittstellen. Ein Integrationsreview prüft, ob die
Teiländerungen gemeinsam das Owner-Ziel erfüllen; fünf Teilurteile ersetzen dieses Urteil nicht.

**Die zeitliche Trennung:** Vor Start wird der Schnitt besprochen, vor Land der konkrete Kandidat
gelesen und geprüft, nach Land das Audit zugeordnet. Rework nach drei Tagen ergänzt die Rückschau.
Ein Paket darf diese vier Zeitpunkte nebeneinander zeigen, aber keine späteren Belege vorwegnehmen.

**Der Größen-Deckel:** Die Schwelle wechselt den Review-Modus. Sie ist weder ein Qualitätsurteil noch
ein Anlass, eine Änderung in mehrere voneinander abhängige, einzeln unprüfbare PRs zu zerlegen.
Ein dokumentierter gemeinsamer Review bleibt für einen zusammenhängenden großen Diff möglich.

**Die Zuständigkeit:** Für zwei Reviewer ein Bereichsleser und ein Integrationsleser; für fünf bis zu
vier Bereichsleser und ein Integrationsleser, mit benannten Überschneidungen. Das ist ein Vorschlag zur
Zusammenarbeit, keine gemessene optimale Besetzung. Mehrere unabhängige Owner mit getrennten Rechten,
Stellvertretung und verbindlichem Quorum sind nicht durch die hier gelesenen Program-/Report-Typen
belegt (`server/types.ts#ProgramRelease:1789`, `server/types.ts#FleetReport:524`). Der Pilot behauptet
solche Rechte nicht und überträgt keine Promotion an den automatischen Reviewer.

**Auswertung des Piloten:** Vorher/Nachher je Repo und Größenklasse Review-Minuten, Zeit bis zum ersten
Lesebeleg, entdeckte Fehler vor Land, Audit rot und rework3d erheben. Anteile nur mit Nennern und
abgeschlossenen Zeitfenstern vergleichen. Es gibt aus dieser Messung noch keinen belegten Zeitgewinn
und keine belegte Senkung übersehener Fehler.

## 5. Nicht gemessen und offene Grenzen

- Keine menschliche Reviewzeit, Zahl realer Reviewer, übersehenen Produktfehler oder Team-Nutzung
  beobachtet. Die Kosten in §3 und die Arbeitsteilung in §4 sind Vorschläge.
- Keine Kausalität: Umfang, Modell, Aufgabenart, Dokumentationsanteil und Ausführungsdatum wurden
  nicht kontrolliert. Nur gelandete Arbeit ist enthalten; abgebrochene, verworfene und vor dem Land
  reparierte Änderungen fehlen als Qualitätsfälle.
- Kein historischer Snapshot der Karten-size; Modell-Aliasse und fehlende Modellwerte wurden nicht
  nachträglich aufgelöst. Rework-Horizonte je Repo sind unterschiedlich und in drei Repo-Pfaden
  fehlen die Land-SHAs im gewählten Integrationsverlauf. 163 von 567 Lands haben keinen bekannten
  geschlossenen Rework-Nenner; diese Werte sind nicht null.
- Keine Unterscheidung von generierten Dateien, gelöschtem Code, Verschiebung und fachlich nötiger
  Überarbeitung. Shortstat zählt Textänderungen; rework3d erfasst eingefügte Zeilen. Die Achsen sind
  absichtlich verschieden. Die Zuordnung aus gespeichertem Shortstat wurde nicht für alle Lands
  gegen eine neu berechnete Diffgröße geprüft.
- Audit-`checks` wurden als Schema gesehen, einzelne rote Checks und ihre Ursachen hier nicht
  nachdiagnostiziert. Rot ist das gespeicherte Ergebnis, Flake dessen vorliegende Adjudikation.
  Veränderte Suiten und proportionale Docs-Audits können die Rate beeinflussen.
- Gelesen: die in §2 genannten Symbole, Karten-/Verify-Vertrag, benannte Dokumentabschnitte und
  beide Vorbefunde. Nicht vollständig gelesen: gesamter Server, Authentifizierungssystem, alle
  Testfamilien, acht offene Bündelungsbefunde; keine UI- oder Mehrbenutzer-Sitzung getestet.
- Die Pins prüfen diese Dokumentationsänderung nach Repo-Vertrag. Sie beweisen weder die Wirkung
  des vorgeschlagenen Review-Pakets noch die kausale Deutung der Ledger.
