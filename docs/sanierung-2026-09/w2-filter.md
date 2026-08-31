# W2 — Filterdefinition „tote docs/-Pfade in lebendem Code"

Planreparatur 2 (`docs/sanierung-2026-09/plan-2026-08-31.md` §Planreparaturen) verlangt, dass der
Filter als Kommando notiert wird, **bevor** gezählt wird — „12 tote docs/-Pfade" war nicht
ableitbar (real 11–16 je Filter, mit e2e-Fixtures 56). Erfolgsmaß 3 misst mit GENAU diesem Kommando.

## Das Kommando

```sh
git grep -ohE 'docs/[A-Za-z0-9._/-]+\.md' -- '*.ts' '*.sh' ':!e2e/*' ':!attic/*' \
  | sort -u | while read -r p; do [ -f "$p" ] || echo "$p"; done
```

Quellenmenge: getrackte `*.ts` und `*.sh` im ganzen Baum, **ohne** `e2e/` (Fixtures und
Testtexte, die absichtlich nicht-existente Pfade nennen) und **ohne** `attic/` (archivierter Code,
der seinen historischen Stand behält). Ausgabe = eine Zeile je Pfad, der in lebendem Code zitiert
wird und im Baum nicht existiert; leere Ausgabe = 0.

## Zählung

| Zeitpunkt | Baum | Tote Pfade |
|---|---|---|
| vor W1-Land (Briefstand) | — | 17 |
| nach W1, vor W2 | `ff5b813f501794af6411846d55276bbcbf01655e` | **14** |
| nach W2 | dieser Commit | **0** |

Datum der Messung: 2026-09-01.

Die Differenz 17 → 14 ist **kein W1-Effekt am Code**, sondern der Filter selbst: drei der 17
Fundstellen liegen in `e2e/` bzw. `attic/` und sind damit per Definition draußen
(`docs/analysis-2026-07-28-verification.md` und `docs/simplification-plan-2026-07-28.md` in
`e2e/steward-outcomes.ts` und `attic/atlas.sh`; `docs/skills.md` nur in `attic/lerntisch/` — und
dort gemeint ist ohnehin die mitgelieferte Doku des pi-Pakets, nicht eine Datei dieses Repos).

## Fix-Regeln, die zur 0 geführt haben

- **(a) Zuhause existiert unter `docs/attic/<basename>.md`** — Pfad umgeschrieben, Satz unverändert.
  11 Basenames: `agent-visibility-2026-08-06` · `autonomy-map-2026-08-06` · `autonomy-trial-1` ·
  `discrepancy-audit` · `graduation-criteria` · `merge-review-autonomy` · `mining-2026-07-26` ·
  `perception-layer` · `steward-intelligence` · `steward-nudge` · `steward-pulse-v2`.
- **(b) kein Zuhause im Repo** — der verweisende Satz sagt jetzt, dass das Dokument nicht (mehr) im
  Repo liegt; kein Pfad erfunden, kein privater Maschinenpfad genannt. 3 Fälle:
  `efficiency-pilot-result.md` · `security-model.md` · `security.md` (letzteres war nie eine Datei
  dieses Repos, sondern die mitgelieferte Doku von Pi).
