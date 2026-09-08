# C5 — Zielprojektion: Gegenfälle

Stand: 2026-09-08. Zugeordnet zu Task `eec64457`, Program `e3b3a064`.
Dieser Eintrag liefert den positiven Kontrollfall für C5-Fall 2 sowie Fall 4 mit
einem realen Annahmebeleg und einer synthetischen Änderung. Die übrigen C5-Fälle
und die vollständige Zielprojektion sind damit nicht erledigt.

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

## Fall 4: Annahme von A ist kein Annahmebeleg für geänderte Bytes B

**Realer Ausgangspunkt:** P1-Report `c89b59e7b4f2fecea8fcd2e9`, Task `34c0d050`,
trägt in `fleet.json` eine gespeicherte Entscheidung `accepted` bei `1788781866224`.
Die Begründung nennt den Kandidaten `d05244e538b8e60eaa74d4d36128c6342ad49459`
und den Dokument-SHA256 `185b5295de7d0b188c28cb91240efe7bbc387c861b5c44040caf163c78088772`.
Die Architektur-MAIN hat diese Entscheidung gelesen und den Hash des Git-Blobs selbst
nachgerechnet. Die Bindung an SHA und Datei ist hier aus dem Begründungstext manuell
entnommen; sie ist keine zusätzliche strukturierte Serverrelation.

**Synthetischer Gegenfall:** B entsteht nur im Speicher durch einen angehängten
Absatz an den tatsächlichen Dokumentbytes A. Es gab in dieser Probe keinen neuen
Worker, Report oder Commit B. Eine Projektion darf die historische Annahme A weiter
zeigen; für B fehlt ein entsprechender Annahmebeleg. Das ist `unknown`, nicht `rejected`.

| Eingabe | Zulässige Aussage dieser Probe |
|---|---|
| A, benannter Kandidat und passender Dokumenthash | Die gespeicherte Annahme bezieht sich auf dieses Dokument in A. |
| B, geänderte Bytes, nur alte Annahme vorhanden | A bleibt angenommen; Annahme von B ist nicht belegt. |
| Rebase-Land `9e7660503a32f1404039f9fd6e0e9bc4c0b8e6d2` | Git-SHA verschieden, Dokumentbytes identisch; Gleichheit dieser Datei ist belegt, keine pauschale Annahme des gesamten neuen Baums. |
| Fehlende Entscheidung oder fehlender geprüfter Hash | Annahmebeziehung bleibt `unknown`. |

### Reproduzierbare Gegenprobe

Der kleine Reader unten ist eine selbstenthaltende C5-Fixture, kein vorhandener
Fleet-Consumer. Sein Input enthält den manuell aus der Entscheidung gelesenen
Dokumenthash. Eine Produktionsprojektion müsste auch diese Herkunftskante belegen;
ein freies Textfeld wird hier nicht als automatisch verlässlicher Parser behandelt.

```python
import hashlib
import json
import subprocess
from pathlib import Path

report_id = "c89b59e7b4f2fecea8fcd2e9"
a_sha = "d05244e538b8e60eaa74d4d36128c6342ad49459"
land_sha = "9e7660503a32f1404039f9fd6e0e9bc4c0b8e6d2"
path = "docs/messungen/2026-09-07-verifikation-zielbild.md"
expected = "185b5295de7d0b188c28cb91240efe7bbc387c861b5c44040caf163c78088772"
state = json.loads(Path("fleet.json").read_text())
found = [r for r in state["fleetReports"] if r["id"] == report_id]
assert len(found) == 1, "Annahmequelle fehlt oder ist nicht eindeutig"
decision = found[0].get("decision")
assert decision and decision["disposition"] == "accepted"
assert decision["at"] == 1788781866224
assert a_sha in decision["reason"] and expected in decision["reason"]
a = subprocess.check_output(["git", "show", f"{a_sha}:{path}"])
land_bytes = subprocess.check_output(["git", "show", f"{land_sha}:{path}"])
assert hashlib.sha256(a).hexdigest() == expected
assert a_sha != land_sha and a == land_bytes
b = a + b"\nSynthetic C5 candidate B: changed document bytes.\n"
assert hashlib.sha256(b).hexdigest() != expected

def document_acceptance(payload, verdict, reviewed_hash):
    if verdict != "accepted" or not reviewed_hash:
        return "unknown"
    return "accepted-document-bytes" if hashlib.sha256(payload).hexdigest() == reviewed_hash else "unknown"

assert document_acceptance(a, decision["disposition"], expected) == "accepted-document-bytes"
assert document_acceptance(b, decision["disposition"], expected) == "unknown"
assert document_acceptance(land_bytes, decision["disposition"], expected) == "accepted-document-bytes"
assert document_acceptance(a, None, expected) == "unknown"
assert document_acceptance(a, "accepted", None) == "unknown"
print("PASS: Annahme A belegt; geändertes B unknown; Rebase-Datei bytegleich; fehlende Entscheidung oder Hash unknown")
```

Originalausgabe der selbst ausgeführten Probe:

```text
PASS: Annahme A belegt; geändertes B unknown; Rebase-Datei bytegleich; fehlende Entscheidung oder Hash unknown
```

Die Gegenprobe würde scheitern, wenn der Reader nur `verdict == accepted` prüfte und
den Hashvergleich entfernte: B erhielte die alte Annahme. Sie prüft damit die
Bindungsregel statt bloß eine kopierte Ergebnisliste. Der Hash beweist Bytegleichheit,
nicht die Qualität des Dokuments oder die Unabhängigkeit seines damaligen Reviews.

## Nicht gemessen

Kein Hub, kein neuer Agenten-Reader und kein Produktcode wurden implementiert oder
getestet. Ein fehlender Cover-Treffer beweist allein keine historische Nichtabdeckung;
die Beziehung bleibt ohne weiteren Beleg `unknown`. Die synthetischen Negativfälle
prüfen den hier abgedruckten Reader, nicht die vollständige Serverprojektion.
Der zusätzliche C5-Fall eines Audits mit Urteil `unknown` bleibt offen.
