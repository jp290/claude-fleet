# 48-Stunden-Vorschau: Ergebnisse, Rückwege und Zielprojektion

Stand: 2026-09-08, 02:40 CEST. Vorschaufenster bis 2026-09-10, 02:40 CEST.
Quell-Pin dieser Aufnahme: `1d83090dc55eda8ed9289dc4db9d8ca294c74252`.
Auftrag: `3f1cec58`, an Architektur-MAIN `e3b3a064` adressiert, gespeichert im
Review-Program `eec69528`. Das Program-Feld ist nicht die Empfängeradresse.

## Urteil

**Zuerst die laufende Arbeit verlässlich abschließen, dann ihren Zielstand sichtbar
machen.** Eine gemeinsame Zielprojektion sollte existieren, weil Land, fachliche
Annahme und Audit unterschiedliche Fragen beantworten. Sie soll aus vorhandenen
Belegen entstehen und fehlende Beziehungen als `unknown` zeigen. Ein weiterer
Summary-Speicher würde diese Beziehungen nicht beweisen.

Für die nächsten 48 Stunden empfehle ich fünf priorisierte Ergebnisse unten. Die
Zeitabschnitte sind Kontrollpunkte, keine gemessenen Aufwandsschätzungen und keine
Freigabe zusätzlicher Lanes. Bestehende MAINs besitzen ihre Aufträge; Controller
koordiniert Ausführungsplätze, Land und Deploy. Bereits laufende Arbeit wird durch
diese Vorschau nicht umsortiert. Ein gemeldeter Taskstatus ist kein Funktionsnachweis.

## Rückblick: das feste Fenster der Eingangsnotiz ist reproduziert

Die Vorlage vom 7. September betrachtete **2026-09-05 10:06:06.690505 UTC bis
2026-09-07 10:06:06.690505 UTC**. Das ist eine historische Bilanz, nicht das
Vorschaufenster und nicht eine aktuelle Erfolgsquote.

| Menge im historischen Fenster | Nachgerechnet |
|---|---|
| Terminale Lane-Einträge, alle Repos | 45: 40 landed, 2 killed-empty, 3 killed-dirty |
| Terminale Lane-Einträge, Fleet-Repo | 41: 40 landed, 1 killed-empty |
| Terminale Audit-Einträge | 34: 15 green, 12 red, 7 unknown |

Die Nenner bleiben getrennt. Noch laufende Lanes fehlen im terminalen Lane-Ledger;
Audits können mehrere Lands abdecken. `15/40` wäre deshalb keine sinnvolle
Erfolgsquote. Die damalige Queuezählung und Host-Ursachen wurden hier nicht erneut
historisch rekonstruiert und werden nicht als aktuelle Tatsachen übernommen.

Reproduktion im Haupt-Checkout, ohne Ausgabe privater Datensätze:

```python
import json
import subprocess
from collections import Counter
from datetime import datetime
from pathlib import Path

start = datetime.fromisoformat("2026-09-05T10:06:06.690505+00:00").timestamp() * 1000
end = datetime.fromisoformat("2026-09-07T10:06:06.690505+00:00").timestamp() * 1000
repo = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
def read_window(file, key):
    rows = [json.loads(line) for line in Path(file).read_text().splitlines()]
    return [r for r in rows if start <= r.get(key, -1) <= end]
lanes = read_window("lane-outcomes.jsonl", "ts")
audits = read_window("post-land-audits.jsonl", "at")
all_lanes = Counter(r["disposition"] for r in lanes)
fleet_lanes = Counter(r["disposition"] for r in lanes if r.get("repo") == repo)
audit_results = Counter(r["result"] for r in audits)
assert all_lanes == {"landed": 40, "killed-empty": 2, "killed-dirty": 3}
assert fleet_lanes == {"landed": 40, "killed-empty": 1}
assert audit_results == {"green": 15, "red": 12, "unknown": 7}
print("PASS: historisch 45 terminale Lanes, davon 41 Fleet; 34 separate Audits; Nenner getrennt")
```

Selbst ausgeführter Originaltail:

```text
PASS: historisch 45 terminale Lanes, davon 41 Fleet; 34 separate Audits; Nenner getrennt
```

Bei späterer Rotation oder fehlenden Eingaben scheitert diese Reproduktion; das
beweist keinen neuen historischen Ausgang. Die Originalvorlage und ihre JSON-Auswahl
waren temporäre Eingaben. Die tragenden Zahlen und ihre Methode stehen nun hier.

## Was gegenüber der Vorlage erledigt oder anders ist

- Die eigene GLM-Korrektur `51f551ba` ist angenommen, als `75939cf4` gelandet und
  durch Audit `1788821145946` auf Baum `9d09cb6b` abgedeckt. Die sichtbare
  Rejection-Historie bleibt erhalten. Nicht mit der separaten Review-Korrektur
  `6e1caad8` verwechseln.
- C5 hat zwei ausgeführte Kontrollfälle: Audit-Coverage und Kandidatenannahme.
  Quelle: [C5-Gegenfälle](2026-09-07-c5-zielprojektion-gegenfaelle.md), Commits
  `01141873` und `1d83090d`. Die übrigen Fälle sind offen; keine fertige Hub-Projektion.
- P1 und P2 sind publizierte Dokumentverträge. P3 wurde unter ausdrücklich
  erlaubter Selbstannahme publiziert (`58cb3e5e`), ohne unabhängiges Astra-ACCEPT.
  P3 bleibt deshalb als Quelle mit dieser Abnahmegrenze gekennzeichnet.
- Die M1-Owner-Entscheidungstür existiert seit `7a20eead`; die alte Behauptung
  einer ausschließlich erreichbaren Self-Tür ist überholt. Das löst nicht automatisch
  die Zustellung einer Ablehnung an eine arbeitende Lane.

## Vorschau: fünf Ergebnisse in vorhandenen Aufträgen

Die Statusspalte ist aus `fleet.json` um 02:37 CEST gelesen. Die Mechanismen unten
sind Vorschläge aus den gelesenen Briefen, keine neue vollständige Codeprüfung.

| Priorität / Kontrollpunkt | Ergebnis und vorhandener Träger | Beleg, der den nächsten Schritt erlaubt |
|---|---|---|
| 1 / erste 8 h | Laufende N2-Notizarbeit `f98facad` (sent, Land-Pipeline) sowie die bereits laufenden Audit-Arbeiten zurücknehmen und prüfen; lokale Audit-Sonde `8f14a22b` (queued) vor einem allgemeinen „Audit wieder grün“ klären. | N2: fremde Notiz-ID verweigert, erledigt nur nach zugehörigem Land, killed lässt offen. Audit-Sonde: lokaler Lauf ausdrücklich belegt; ein grüner Helferlauf ersetzt ihn nicht. Originalausgaben statt bloßer Checkzahl. |
| 2 / erste 24 h | Annahme und Land zusammenführen: `e219d486` (queued, derzeit ohne Program-Zuordnung) plus Rückgabe `18e87e67` (pending, Fleet-Betrieb). Vor Dispatch für die ungebundene Zeile den fachlichen Empfänger sichern. | Rejected blockiert Land mit benanntem Report; kein Report bleibt gemäß Brief erlaubt; unentschieden einschließlich fehlendem Key explizit entscheiden. Rückgabe erreicht genau den ursprünglichen lebenden Worker; Doppelzustellung und recycelter Slot sind Negativfälle. Die Dokumentkorrektur ersetzt diesen Produktbeweis nicht. |
| 3 / bis 24 h, danach Beobachtung bis 48 h | Audit-Platzierung `d49dd776` (queued, Fleet-Betrieb) und Zeitmessung `95d09e33` (queued, ungebunden) seriell abstimmen. | Warte- und Arbeitszeit getrennt, Altzeilen ohne Messung bleiben unknown. Frist ab Wählbarkeit, kein Doppelclaim, kein Rückwechsel eines laufenden Executors. Die fünf Folgeaudits aus dem Platzierungsbrief erst nach dem Fix zählen; kommen im Fenster weniger zustande, bleibt das Betriebsziel offen. |
| 4 / bis 48 h | Architektur beendet die fehlenden C5-Beziehungen; anschließend einen Program-Detailfall als Vorschlag für vorhandenes S12 `7ed73694` (pending, Fleet-Betrieb) schärfen. | Ein Leser zeigt Kriterium, Task, fachliches Urteil, Kandidat, Land und Audit separat. Annahme A bleibt bei A; fehlende Quelle unknown; neue MAIN sieht offene Pflicht ohne alte Rechte. Gleiche Eingaben ergeben in Hub und Rollen-Kontext dieselben Fakten. S12s bestehender Brief erfüllt diesen erweiterten Zielnachweis nicht automatisch; keine Umsetzung unter falschem Brief. |
| 5 / parallel nur Entwurf, nicht neue Produktmutation | Kontext-/Notizleser mit N2 und `3ea89f71` (pending, Fleet-Betrieb) abgrenzen; `f9dc8e10` Leichtgewicht steht proposed. Modellprofile `21ade485` nicht doppeln. | Ein Self-Brief nennt seinen wirklichen Urheber, fremdes Program wird verweigert, Altbestand wird nicht rückwirkend umgedeutet. Für jede zusätzliche Kontextinformation ist ein konkreter Verbraucher benannt. Veraltete Slot-Adresse allein beweist keinen fehlenden Leser. |

Gemeinsame Schreibflächen und Suitekapazität werden vor jeder Freigabe durch die
zuständige MAIN erneut geprüft. Keine dieser Zeilen bekommt durch diese Tabelle
Vorrang vor einer bereits laufenden Lane oder einen erhöhten Deckel.

## Urteil zu qualitativen Ziel- und Kontextdaten

| Information | Behandlung und Beweisgrenze |
|---|---|
| Task, Reportentscheidung, Kandidat, Land, Auditbaum, Coverage | Aus Originalrecords ableiten; Quelle und Geltungsstand anzeigen. Gleichnamige Statuswörter nicht zu einer Gesamtampel verschmelzen. |
| Bestätigtes Ziel, Kriterium, Scope, Ersetzung oder fachliches Urteil | Als Aussage einer berechtigten Instanz mit Bezug auf konkrete Arbeit erhalten. Fehlt die Kante Kriterium → Task, bleibt sie unknown, bis sie ausdrücklich gesetzt ist. |
| Empfehlung, Relevanzhypothese, Zusammenfassung | Als Deutung kennzeichnen; Quellen, Geltungsbereich und Widerlegungsgrund nennen. Darf weder ein Owner-Urteil noch einen fehlenden Test erzeugen. |
| Rollenbezogener Kontext | Dieselben Beziehungen wie der Hub lesen, aber nach Aufgabe auswählen. Tatsächlich zugestellte Quelle/Version im vorhandenen Receipt nachweisen; keine behauptete Lieferung aus bloßer Existenz einer Notiz. |

Damit bleibt der Hub eine Projektion gemäß
`docs/fleet-hub-overlay-2026-09-06.md:64` am genannten Pin. Persistenz ist für
fehlende ausdrückliche Links oder Urteile sinnvoll, nicht für eine zweite Kopie des
bereits ableitbaren Fortschritts. P2 besitzt den Adressierbarkeitsvertrag; C5 prüft
Beziehungen und Verluste. Das Leichtgewicht-Program prüft nach Bestätigung die Leser
und Rollenkarten. Keine neue Plattform oder ContextPack-Serverobjekte in diesem Akt.

## Was der Owner entscheiden muss — und was nicht

Die vorhandenen bestätigten Aufträge brauchen keinen neuen Richtungsentscheid.
Ungebundene Arbeit braucht einen benannten fachlichen Empfänger und ein Controller-
Routing; das ist keine neue Programgründung. Bei Leichtgewicht fehlen dagegen noch
Owner-Bestätigung und eine eigene MAIN-Bindung. Die frische Controller-Session soll
diesen Vorschlag gegen C5/P2/N2 abgrenzen, bevor sie ihn bestätigt.

Eine echte Geschmackskontrolle bleibt am Produkt: Erst nach einer durchgängigen
Task-/Report-/Korrektur-/Annahme-Kette sollte dieselbe Kette an einem Spiel- oder
Studio-Abschnitt mit Build, Launch, echter Bedienung und Capture vorgeführt werden.
Kein solcher Produktlauf wurde für diese Vorschau ausgeführt. Der Owner muss einen
Betriebs- oder Geschmacksentscheid nicht durch das Lesen von Sessiontranskripten ersetzen.

## Grenzen und Abschluss dieses Akts

Geprüft: historische Ledgerzählung, aktuelle Statuswerte und die genannten
vollständigen Auftragsbriefe, vorhandene C5-Belege, Hub-Regel und Planregister.
Nicht geprüft: vollständige aktuelle Implementierung aller vorgeschlagenen Fixes,
Host-Auslastung, Tokenkosten, Owner-Arbeitsminuten, sämtliche alten Charter- und
Taskreferenzen oder künftige Liefertermine. Die Qualitätsaussagen sind Empfehlungen,
keine gemessene Produktverbesserung. Keine Suite, kein Deploy und keine neue Lane.

Diese Vorschau ersetzt die Wartegründe der Eingangsnotiz, nicht das noch offene
Gesamtreview von `eec69528`. Die historischen Quellen wurden nicht rückwirkend
umgeschrieben. Der nächste Architekturakt bleibt ein fehlender C5-Gegenfall oder
eine konkrete Rückgabe aus der Tabelle, nicht eine weitere allgemeine Bilanz.


## Ausgeführter erster Abschlussakt — 2026-09-08

Die Architektur-MAIN hat den noch unentschiedenen Report
`bf2d079f6480e73f2cc76dcb` zu Checkpoint-Task `f5ce8012` fachlich entschieden:
`rejected`, bei `1788828410350`. Die Ablehnung gilt seiner Behauptung eines noch
fehlenden P3-Owner-Entscheids; Attention `58cb3e5e` hatte die Selbstannahme vorher
unter Auflagen erlaubt. Die bestätigten P1/P2-/GLM-Belege bleiben bestätigt.
Der Arbeitsbaum der ursprünglichen Checkpoint-Lane war sauber, `main..HEAD` leer.
Es gibt daraus keinen zu landenden Kandidaten und keine verlangte Nacharbeit.
Ein später gelesener Slot-10-Occupant gehört bereits einer anderen Lane; aus der
Slotnummer wird deshalb kein weiterer Eingriff in die alte Lane abgeleitet.

Der Audit-Dokumentauftrag `6d7ff117` ist in der Queue `done`. Sein korrigierter
Report `a36891ec0d58766ab8ec6ede` trägt ein `accepted` der zuständigen MAIN bei
`1788827823931`; die erste Fassung `36cfd4ba` ist ausdrücklich superseded/rejected.
Die Architektur-MAIN hat die Dokumentbytes von Kandidat `ab76a0af` und Land
`323b70595ec23710ffdd8a2689e860dc7de00728` für
`docs/messungen/2026-09-07-projektionssonde-basis.md` verglichen: kein Diff.
Audit `1788827850316` deckt diesen Land explizit über `covers` ab: `green`,
458 Checks, 0 Fehler, Exitcode 0, `proportional`, `install+pins`, Originaltail
`ALL PASS`. Damit ist die geprüfte Publikationskette geschlossen; die umfangreiche
historische Auswertung wurde in diesem Abschlussakt nicht erneut voll vermessen.

**Zwei andere rote Belege bleiben getrennt offen:**

| Auditbaum / Ledgerzeit | Originalbefund | Zugeordnete bestehende Arbeit |
|---|---|---|
| `51565db4`, `1788818482644` | `red`, 3953/2, Remote-Record vorhanden; `deleting a Watch does not delete its acknowledged event` und `subject teardown after event creation leaves the event trail intact`; Originaltail `2 FAILURES` | `cac29de6`, bei Aufnahme queued |
| `83856c6a`, `1788821143810` | `red`, 3945/1, kein Remote-Record; `ctl setup: the source tree resolves and carries an executable ctl.sh`; Originaltail `1 FAILURES` vor stderr | `8f14a22b`, bei Aufnahme queued; sein verlangter lokaler Folgebeweis bleibt offen |

Fehlender Remote-Record allein beweist keine Host-Identität. Der aktuelle Befund
wird über Auditzeit, Baum und benannten Check identifiziert. Ein späterer grüner
Docs-Audit auf einem anderen Baum löst keinen dieser zwei Fehlernachweise ab.
Die inzwischen gestartete Platzierungsarbeit `d49dd776` wird nicht verdoppelt.

Reproduktion dieser Abschlussbelege im Haupt-Checkout:

```python
import json
import subprocess
from pathlib import Path

rows = [json.loads(line) for line in Path("post-land-audits.jsonl").read_text().splitlines()]
def audit(at):
    found = [r for r in rows if r.get("at") == at]
    assert len(found) == 1, "Auditquelle fehlt oder ist nicht eindeutig"
    return found[0]
land = "323b70595ec23710ffdd8a2689e860dc7de00728"
a = audit(1788827850316)
assert any(c.get("mainAfter") == land for c in a.get("covers", []))
assert a["result"] == "green" and a["exitCode"] == 0
assert a["checks"] == {"ran": 458, "failed": 0}
assert a["steps"] == ["install", "pins"] and a["proportional"] is True
assert a["out"].rstrip().endswith("ALL PASS")
path = "docs/messungen/2026-09-07-projektionssonde-basis.md"
assert subprocess.check_output(["git", "show", f"ab76a0af:{path}"]) == subprocess.check_output(["git", "show", f"{land}:{path}"])
w = audit(1788818482644)
c = audit(1788821143810)
assert w["result"] == c["result"] == "red"
assert w["fails"] == ["deleting a Watch does not delete its acknowledged event", "subject teardown after event creation leaves the event trail intact"]
assert c["fails"] == ["ctl setup: the source tree resolves and carries an executable ctl.sh"]
assert "2 FAILURES" in w["out"] and "1 FAILURES" in c["out"]
print("PASS: korrigierte Dokumentbytes und Audit-Coverage bestätigt; zwei separate rote Auditbefunde bleiben erhalten")
```

Selbst ausgeführter Originaltail:

```text
PASS: korrigierte Dokumentbytes und Audit-Coverage bestätigt; zwei separate rote Auditbefunde bleiben erhalten
```
