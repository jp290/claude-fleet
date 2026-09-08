# C5 — Zielprojektion: Gegenfälle

Stand: 2026-09-08. Zugeordnet zu Task `eec64457`, Program `e3b3a064`.
Dieser Eintrag liefert den belegten positiven Kontrollfall für C5-Fall 2. Die übrigen
C5-Fälle und die vollständige Zielprojektion sind damit nicht erledigt.

## Fall 2: Ein Land wird auf einem späteren Baum auditiert

Die Zuordnung eines Lands zu einer Auditzeile erfolgt über Repository und
`covers[].mainAfter`. `mainSha` bezeichnet den geprüften Baum. Ein Gleichheitsjoin
`mainSha == Land-SHA` verliert diesen vorhandenen Audit.

| Tatsache | Gelesener Beleg |
|---|---|
| Angenommener Kandidat | `a740ba6f9a52b0b18171ee3b71f4ece69e0bb382` |
| Land | `75939cf4e0f22eaee02cc8f82f64120202700a60` |
| Auditzeile | `post-land-audits.jsonl`, `at: 1788821145946` |
| Auditbaum, `mainSha` | `9d09cb6bd3550f75e0ca73c8c45e98ea9fb0c153` |
| Explizite Abdeckung | `covers[].mainAfter` enthält den Land-SHA; Branch `fleet/260907212539-3dfa` |
| Urteil | `green`, 457 Checks, 0 fehlgeschlagen, Exitcode 0 |
| Kette | `proportional: true`, `steps: [install, pins]`, 2127 ms; Originaltail `ALL PASS` |
| Dokumentbytes | Kandidat, Land und Auditbaum enthalten denselben SHA256 `413a87784497c9428bdfdf4ce94dc46a084f0ec1b949e6afddd25796ec41dd2a` für `docs/schnittliste-kommunikation-datenschichten-2026-09-07.md` |

Die Architektur-MAIN hat die Ledgerzeile, ihren Originaltail, die drei Dokumentblobs
und die Git-Ancestry selbst geprüft. Gleiche Dokumentbytes bedeuten nicht gleiche
Bäume. Zwischencommits sind separat über `git log <Land>..<Auditbaum>` lesbar;
`covers` ist kein vollständiges Commit-Inventar. Die Dokumentkurzkette belegt keinen
Tier-2- oder Produktlauf. Die frühere abgelehnte Veröffentlichung `522701cf` bleibt
historisch abgelehnt; die spätere Korrektur erhält ihre eigene Annahme und Abdeckung.

### Reproduzierbare Gegenprobe

Im Haupt-Checkout ausführen. Der Ledger ist privat und wird nicht mitpubliziert.
Fehlende oder rotierte Eingaben lassen die Probe scheitern; sie werden nicht als
fehlender historischer Audit interpretiert. Die Fixture-Änderungen bleiben im Speicher.

```python
import json
import subprocess
from pathlib import Path

land = "75939cf4e0f22eaee02cc8f82f64120202700a60"
rows = [json.loads(line) for line in Path("post-land-audits.jsonl").read_text().splitlines()]
selected = [r for r in rows if r.get("at") == 1788821145946]
assert len(selected) == 1, "Auditquelle fehlt oder ist nicht eindeutig"
r = selected[0]
repo = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()

def covered(row, expected_repo, sha):
    return row.get("repo") == expected_repo and any(
        c.get("mainAfter") == sha for c in row.get("covers", [])
    )

assert covered(r, repo, land)
assert r["mainSha"] != land, "Gleichheitsjoin muss diesen Kontrollfall verfehlen"
assert r["mainSha"] == "9d09cb6bd3550f75e0ca73c8c45e98ea9fb0c153"
assert r["result"] == "green" and r["exitCode"] == 0
assert r["checks"] == {"ran": 457, "failed": 0}
assert r["proportional"] is True and r["steps"] == ["install", "pins"]
assert r["out"].rstrip().endswith("ALL PASS")
assert not covered({**r, "covers": []}, repo, land)
assert not covered({**r, "repo": "synthetic-other-repo"}, repo, land)
subprocess.run(["git", "merge-base", "--is-ancestor", land, r["mainSha"]], check=True)
print("PASS: covers-Join trifft; mainSha-Gleichheit verfehlt; fehlende Coverage und anderes Repo treffen nicht; Ancestry bestätigt")
```

Originalausgabe der selbst ausgeführten Probe:

```text
PASS: covers-Join trifft; mainSha-Gleichheit verfehlt; fehlende Coverage und anderes Repo treffen nicht; Ancestry bestätigt
```

## Nicht gemessen

Kein Hub, kein neuer Agenten-Reader und kein Produktcode wurden implementiert oder
getestet. Ein fehlender Cover-Treffer beweist allein keine historische Nichtabdeckung;
die Beziehung bleibt ohne weiteren Beleg `unknown`. Die synthetischen Negativfälle
prüfen den hier abgedruckten Reader, nicht die vollständige Serverprojektion.
Der zusätzliche C5-Fall eines Audits mit Urteil `unknown` bleibt offen.
