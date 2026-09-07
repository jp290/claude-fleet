# Independent review — P3 landepfad-adversarial (2026-09-07)
Reviewer: codex gpt-6-astra (zweite Astra, unabhaengig)
Draft sha256 geprueft: 6b931dc39c0a92d1c866bf96501a0ed5e38b79601c4088257f48c994a850460e

## Maengel (nach Schwere; leer, wenn keine)

1. [schwer] §3.4 — „`!(await adjudicationsByAudit()).has(row.at)`“ — Quelle sagt: `const ADJUDICATION_VERDICTS = ["real", "flake", "stale-test", "unknowable"]`, server.ts:15536 @c7184f8. Die vorgeschlagene Bedingung hebt den Deploy-Blocker auch nach Bestätigung eines **echten Fehlers** oder eines unentscheidbaren Befunds auf. Adjudikation ist keine Deploy-Freigabe; der Quellkommentar hält ausdrücklich fest: „An adjudicated red stays red“, server.ts:15520 @c7184f8. Kosten: Die Reparatur erlaubt einen bekannten roten Baum. Es fehlen eine explizite Freigaberegel je Verdict und negative Checks für `real` und `unknowable`.

2. [schwer] §1.6 — „Never touches the live fleet“ — Quelle sagt im versiegelten Dokument: `[ "$DIR" = "$SRC" ]` als einziger Pfadschutz, unmittelbar gefolgt von der rekursiven Löschung von `DIR`, Dokument:228–229. Ein anders geschriebener Pfad auf dasselbe Verzeichnis oder ein übergeordnetes Verzeichnis passiert diesen Vergleich. Damit kann das angeblich isolierte Repro den Quell-Checkout löschen. Kosten: Datenverlust bei falschem Scratch-Argument. Die Isolationsgarantie ist am Skripttext widerlegt; erforderlich sind ein selbst erzeugtes Scratch-Verzeichnis oder eine geprüfte kanonische Pfadgrenze. Diese Fundstelle gehört zum versiegelten Dokument, nicht zum gepinnten Quellbaum.

3. [mittel] §2.5 — „Undo in der Pause … `FLEET_TEST_LAND_FF_LATCH` … `main-rewound`“ — Quelle sagt: zuerst `await markLandIntent(...)`, danach `await waitForLandFfTestLatch()`, server.ts:18693–18694 @c7184f8. Nach dem vorgeschlagenen Mutex um `markLandIntent…recordLand` hält das Land an diesem Latch bereits den Mutex. Der Undo muss gemäß derselben Fix-Skizze mit 409 abgewiesen werden; er kann main dort nicht zurückspulen. Kosten: Der Done-Satz verlangt ein Ergebnis, das die vorgeschlagene korrekte Serialisierung verhindert. Für die Gegenrichtung braucht es einen Halt vor dem Mutex-Erwerb oder einen nachweislich bereits laufenden Undo.

4. [mittel] §4.3 — „`FLEET_AUDIT_HELPER_GRACE_MS` hoch … Grace ablaufen lassen“ — Quelle sagt: `AUDIT_HELPER_GRACE_MS > 0 && helperClaimCandidateExists()`, server.ts:13592 @c7184f8; außerdem passieren proportionale Einträge die Grace unmittelbar, server.ts:13608 @c7184f8. Die Skizze stellt weder einen geeigneten Helfer noch einen nicht-proportionalen Eintrag her. Der Audit kann deshalb sofort starten und main vor dem Undo lesen. Kosten: Die Skizze reproduziert die behauptete Reihenfolge nicht zuverlässig. Beide Voraussetzungen und der beobachtete Wartezustand müssen Bestandteil des Checks sein.

5. [mittel] §1.7 — „Done für Schritt 3 … während des Gates eine uncommittete Datei … Gate grün bleibt“ — Quelle sagt: `Bun.spawn(["sh", "-c", cmd], { cwd, ... })`, server.ts:12011–12012 @c7184f8. Ein Gate im veränderlichen Worktree kann ebenfalls grün bleiben, wenn die Datei erst nach seinem relevanten Prüfschritt geschrieben wird; §1.3 demonstriert genau diese Form. Zusammen mit dem bereits in Schritt 1–2 eingeführten SHA-Feld beweisen die genannten Assertions deshalb keinen Snapshot. Kosten: Schritt 3 kann ohne Snapshot als fertig gelten. Der Check muss das Gate **vor dem relevanten Lesen** anhalten, dann die Datei schreiben und anschließend fortsetzen.

6. [mittel] §3.4 — „nach … adjudicate → 200“ und „Tip ohne Note → Boot-Row `ok:null`“ — Quelle sagt für den erfolgreichen Deploy `}, 202);`, server.ts:23346 @c7184f8. Ein Wechsel dieses Vertrags wird nicht vorgeschlagen. Außerdem verlangt die eigene Fix-Skizze bei fehlender Note den expliziten `unmeasured`-Override, den der Done-Satz auslässt. Kosten: Falsche HTTP-Erwartung beziehungsweise ein Test, der entgegen dem vorgeschlagenen Preflight einen Boot erwartet. Erfolg muss als 202 geprüft werden; fehlende Note braucht getrennte Fälle ohne und mit Override. Der ebenfalls vorgeschlagene Branch-Guard hat keinen eigenen negativen Done-Check.

7. [mittel] §7.2 — „zweite Note trägt … `waitMs ≥ 15000`“ — Quelle sagt: Die Gate-Wartezeit wird ab dem jeweiligen `askedAt` gemessen, server.ts:18538–18542 @c7184f8. Beginnt das zweite Gate beispielsweise fünf Sekunden nach dem ersten, bleiben von dessen 15 Sekunden nur ungefähr zehn Sekunden Wartezeit. Der verlangte Überlappungsnachweis garantiert keinen gleichzeitigen Eintritt. Kosten: Ein korrekt serialisierender Mutex kann den Check verlieren. Prüfen muss man die beobachtete Restwartezeit beziehungsweise die Nichtüberlappung, nicht pauschal die volle Laufzeit des ersten Gates.

8. [mittel] §0 — „für **alle fünf** Formulierungen eine Antwort“ — Quelle sagt beim F5-Recovery `await recordLand(..., p.mainBefore, cur.out, p.prov)`, server.ts:12760 @c7184f8. Die beschriebene F5-Sequenz verliert B’s Aufzeichnung, nicht B’s Commit aus der Git-Historie. Auch die Rangliste benennt dafür „Commit ohne Note/Undo/Audit“. Kosten: Die Zusammenfassung behauptet zusätzlich das erfüllte Rätselziel „Commit verliert“, obwohl dafür kein eigener Nachweis vorliegt. Aufzeichnungsverlust und Commitverlust müssen getrennt werden.

9. [leicht] §6 — „von den Runnern nur `fleet-e2e-clean-review.ts`“ — Quelle sagt: `read("fleet-e2e-postland-audit.ts").includes("git named this tree")`, e2e/pins.ts:4443 @c7184f8. Die Leser-Inventur ist falsch. Das widerlegt das konkrete Security-Runner-Beispiel nicht, muss aber aus der Begründung entfernt beziehungsweise präzisiert werden.

10. [leicht] §8 — „an einer benannten Menge von Stellen … Diese fünf Leser“ — Quelle sagt zusätzlich `const selfApiCap = read("docs/self-api.md");`, e2e/pins.ts:3673 @c7184f8, mit anschließender Prüfung eines dokumentierten Konfigurationswerts. Die als abgeschlossen dargestellte Leser-Inventur ist unvollständig. Kosten: Die behauptete Abdeckung der DOC_RULE-Konsumenten ist nicht nachvollziehbar vollständig; F8 selbst bleibt davon unberührt.

## Geprueft und korrekt (nur, was du wirklich gelesen hast)

- Das vollständige Dokument einschließlich Repro-Skript gelesen; Hash vor und nach der Prüfung identisch.
- F1: Clean-Pfad, Planbildung, Worktree-Spawn, fehlende Lane-Tip-Bindung, Branch-Advance und Vererbung der proportionalen Kettenwahl bestätigt. Der Confirm-Vergleich existiert, sein späteres Fenster bleibt offen.
- F2: Push nach Stack-Eintrag, Remote-Prüfung über den gesamten Bereich und Stack-Löschung auch bei beiden fail-closed-Git-Rückgaben bestätigt.
- F3: fehlende Bindung an Land-/Audit-Nachweis, tatsächliche Blocker-Menge, einmaliger Preflight und Marker-Verdikt ohne Altersprüfung bestätigt.
- F4: Laufzeit-SHA, fehlender Ancestry-Guard, optionaler `clonedSha` ohne Verdict-Wirkung, Remote-Verbrauch vor Append, verschluckter Append-Fehler und `ran:0` bei grün bestätigt.
- F5: Repo-Schlüssel ohne Belegtheitsprüfung und Recovery-Verlust der überschriebenen Aufzeichnung bestätigt.
- F6: Kandidaten-Wrapper und Kandidaten-Runner werden ausgeführt. Das Security-Beispiel ist am gelesenen Code plausibel; seine Ausführung wurde nicht verifiziert.
- F7.1: Der erste Schreibfehler kann ein pid-loses Verzeichnis hinterlassen; beide Reaper behalten die beschriebene Parkform. Vererbter Hold, sofortige Ablehnung eines zweiten eigenen Holds und irreführender ff-Absagetext ebenfalls bestätigt.
- F8: sieben DOC_RULE-Seed-Anker in fünf Dateien; drei davon über den Fleet-Frame-Check belegt. Die gelesenen Pins prüfen Manifest-Anker, aber nicht diese Seed-Anker. Rename-Klassifikation mit `--no-renames` bestätigt.
- Zahlen: 396 zeitfähige Notes auf der Pin-Historie ergeben sieben Treffer, sämtlich Confirm-Lands, mit der beschriebenen Aufteilung. Unter den letzten 60 Commits am Pin: 14 Notes, alle mit erfolgreichem Hub-Push. Der benannte Bereich enthält einen Commit, keinen ausschließlich lokalen Commit und zwei enthaltende Remote-Ref-Ausgaben einschließlich symbolischem Alias.
- Repro B schließt den fortlaufenden Fixture-Kurzkettenlauf über bereits veränderten Worktree-Bytes **nicht** aus. Das Dokument benennt diese stärkste Alternative korrekt. C belegt im abgedruckten Transkript das Rot des Marker-Kommandos, nicht das Rot der echten Suite.
- Hygieneprüfung: Suchmuster 1, 2 und 4 ohne Treffer; Suchmuster 3 mit zwei Header-Vorlagen, ohne eingebetteten geheimen Wert.

## Nicht geprueft

- Keine Server, Suiten, Repros, Deploys oder Undos ausgeführt; keine Dateien geschrieben.
- Die ursprünglichen Rohtranskripte und die Ablehnung von 07:31 nicht unabhängig authentifiziert.
- Historische Gesamtzahl 482, Drop-Zähler 344 und damalige Stack-Spitze nicht aus einem versiegelten Ledger-Snapshot verifiziert. Beim Lesen waren es bereits 483 Notes mit Verify, 397 zeitfähige Notes und 345 Drops; diese Veränderungen widerlegen die frühere Momentaufnahme nicht.
- Der Median von ungefähr 109 Sekunden ist rechnerisch nachvollziehbar; der genaue historische Nenner 91 bleibt ohne eingefrorene Auswahl und explizite Zeitzone offen.
- Weitere historische Zahlen zu Vorgängerreviews, Direkt-Commits und früheren Betriebsereignissen nicht unabhängig belegt.
- Projektweite Negativaussagen über sämtliche Konsumenten und Tests nicht vollständig bewiesen. Die gelesenen Fundstellen bestätigen keine vollständige Inventur.
- §12 benennt wesentliche Laufzeitgrenzen, behebt aber weder die unbelegte Isolationsgarantie noch die oben aufgeführten Lücken der vorgeschlagenen Checks.

## Verdict

REJECT — Die Deploy-Fix-Skizze gibt auch bestätigte echte Fehler frei, das Repro garantiert seine behauptete Isolation nicht, und mehrere Done-Sätze prüfen eine widersprüchliche oder nicht hinreichend bestimmte Eigenschaft.