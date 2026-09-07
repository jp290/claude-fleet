# Independent review — P3 landepfad-adversarial (2026-09-07)
Reviewer: codex gpt-6-astra (zweite Astra, unabhaengig)
Draft sha256 geprueft: eb9adb85ae5105301090402c31b0c88cf835751dd8989ded412005f049a2d7bb

## Maengel (nach Schwere; leer, wenn keine)

1. [schwer] §1.7 — „Cover wartet in der Grace, `FLEET_AUDIT_HELPER_GRACE_MS` hoch“ — Quelle sagt: `if (entryRunsShortChain(r, q.covers)) return true;` (`server.ts:13608 @c7184f8`). Docs-only-Einträge überspringen die Helfer-Grace ausdrücklich. Zusätzlich setzt Grace einen geeigneten Helfer voraus: `AUDIT_HELPER_GRACE_MS > 0 && helperClaimCandidateExists()` (`server.ts:13592 @c7184f8`). Der vorgeschlagene unabhängige Audit-Check erzeugt sein behauptetes Wartefenster nicht. Ein Direkt-Commit könnte erst nach der Tip-Lesung eintreffen. Kosten: L1 Schritt 4 hat weiterhin keinen zuverlässig isolierenden Done-Check. Er braucht einen bestätigten Halt vor der Audit-Tip-Lesung.

2. [mittel] §6 — „und damit dieselben Runner“ — Quelle sagt: Der Security-Wrapper startet `bun fleet-e2e-security.ts` (`e2e-security.sh:100 @c7184f8`); der isolierte Audit startet `bun fleet-e2e.ts` (`e2e-isolated.sh:839 @c7184f8`). Dieser importiert `./e2e/security` (`fleet-e2e.ts:48 @c7184f8`). Der separate Security-Runner bezeichnet sich ausdrücklich als „not a module of the main suite“ (`fleet-e2e-security.ts:2 @c7184f8`). Kandidatenbytes werden auf beiden Stufen ausgeführt, aber nicht dieselben Runner. Kosten: Die Wirkung des konkreten `process.exit(0)`-Beispiels auf Tier 2 wird falsch erklärt.

3. [mittel] §7.2 — „`FLEET_SUITE_LOCK_HOLDER` in der Server-Env“ — Quelle sagt: `const named = process.env.FLEET_SUITE_LOCK_HELD_BY;` (`server.ts:17399 @c7184f8`). Auch das zitierte Vorbild verwendet `FLEET_SUITE_LOCK_HELD_BY` (`e2e-isolated.sh:818 @c7184f8`). Mit dem vorgeschlagenen Namen erkennt der Server keinen geerbten Hold. Kosten: Der Done-Check prüft Warteschlangenverhalten statt paralleler Gates innerhalb eines geerbten Holds.

4. [mittel] §2.5 — „das Land wartet, seine Note trägt `mainBefore` = Tip nach dem Undo“ — Quelle sagt: `let landMain = mainSha;` und später `const mainBefore = landMain;` (`server.ts:18676`, `server.ts:18681 @c7184f8`). Dieser Stand wurde vor dem Gate gelesen (`server.ts:18478 @c7184f8`). Ein Mutex ausschließlich um `markLandIntent…recordLand` aktualisiert ihn nach einem währenddessen abgeschlossenen Undo nicht. Kosten: Der vorgeschlagene Mutex allein erfüllt den eigenen Gegenrichtungs-Check nicht; die Skizze muss festlegen, wie sie einen veralteten Integrationsstand nach dem Warten behandelt.

5. [mittel] §1.7 — „die Datei nicht landet (dirty → kein ff)“ — Quelle sagt: Der Advance mergt im Holder des Integrationsbranches: `gitRetry(holder.path, "merge", "--ff-only", branch)` (`server.ts:3883 @c7184f8`). Der Lane-Cleanliness-Check liegt vor dem Gate (`server.ts:18466 @c7184f8`). Ein später schmutziger Lane-Worktree verhindert diesen Advance nicht automatisch. Ein Snapshot erklärt, warum uncommittete Bytes nicht geprüft oder gelandet werden; er erklärt keine Land-Ablehnung. Kosten: Skizze und Done-Satz verlangen unterschiedliche Änderungen. Ein zusätzlicher Dirty-Guard oder die ausdrückliche Zulässigkeit des gepinnten Advances fehlt.

6. [mittel] §6 — „Die Wrapper sind gepinnt und kein brauchbarer Angriffspunkt“ — Quelle sagt: Der Pin sucht einen Runner-Aufruf als Text und verlangt als letzte relevante Zeile `exit $code` (`e2e/pins.ts:364`, `e2e/pins.ts:367 @c7184f8`). Das beweist keine Erreichbarkeit dieses Aufrufs. Ein vollständiger Wrapper-Ersatz scheitert an den beschriebenen Pins; daraus folgt keine allgemeine Integrität der Wrapper. Kosten: Eine begrenzte Textprüfung wird als ausgeschlossene Angriffsklasse dargestellt. Die Aussage muss auf den tatsächlich widerlegten vollständigen Ersatz beschränkt werden.

7. [mittel] §2.1 — „ein `index.lock`-Treffer … löscht bis zu drei Rollback-Zeiger“ — Quelle sagt: Die beiden Fehlerzweige stammen aus `git(repo, "rev-list", range)` und `git(repo, "rev-list", range, "--not", "--remotes")` (`server.ts:12459`, `server.ts:12461 @c7184f8`). Das Dokument belegt keinen Index-Lock-Zugriff dieser Aufrufe. Der zitierte Index-Lock-Mechanismus betrifft dagegen Status-/Diff-Refreshes (`server.ts:2761 @c7184f8`). Kosten: Ein konkreter Auslöser wird ohne tragenden Beleg genannt. Die Eskalation tatsächlicher `rev-list`-Fehler ist bestätigt; das Index-Lock-Beispiel ist zu streichen oder separat nachzuweisen.

8. [mittel] §1.4/§12 — „Ein Commit, dessen Committer-Zeit danach liegt, wurde nach diesem Zeitpunkt erzeugt“; „Sonde … ist eine Untergrenze“ — Quelle sagt: Persistiert wird `startedAt: startedAt - heldWait` (`server.ts:12114 @c7184f8`); die Sonde vergleicht damit Git-Metadaten, keinen beobachteten Commit-Erzeugungszeitpunkt. Sie setzt unveränderte Committer-Zeiten und vergleichbare Uhren voraus. Auch die sieben Treffer sind laut eigener Auswertung keine nachgewiesenen F1-Fälle. Kosten: Ein Metadatenindikator wird als zeitlicher Beweis beziehungsweise Häufigkeitsuntergrenze bezeichnet. Diese Voraussetzungen und die fehlende Ereignismessung gehören in §12.

9. [mittel] §7.2 — „Busy-Marker prüft … ihn anlegt“; „eines endet `exit 7`“ — Quelle sagt: Die vorhandene gegenseitige Ausschließung verwendet ausdrücklich `mkdirSync(SUITE_LOCK)` als atomaren Claim (`server.ts:17364 @c7184f8`). Getrenntes Prüfen und Anlegen des vorgeschlagenen Busy-Markers erlaubt dagegen, dass beide Gates zunächst „frei“ sehen. Kosten: Der Gegencheck kann trotz überlappender Gates grün bleiben. Er braucht einen atomaren Claim und einen bestätigten Überlappungsversuch.

10. [leicht] §1.5 — „Das Fenster ist die Gate-Laufzeit: … ~110 s volle Kette (Median)“ — Quelle sagt: `ms` enthält die vorgelagerte Hold-Wartezeit (`server.ts:12078 @c7184f8`); `waitMs` enthält die nachgewiesenen Warteanteile (`server.ts:12115 @c7184f8`). Am rekonstruierten historischen Ausschnitt ergeben sich für volle Ketten seit Septemberbeginn ungefähr 109 Sekunden **Arbeit**, aber ungefähr 140 Sekunden **Gesamtlaufzeit** als Median. Kosten: Die Größen werden vermischt. Die Formel `ms - waitMs`, der Zeitfilter und der Ledger-Stichtag fehlen neben der Zahl.

11. [leicht] §8 — „für `AGENTS.md`-Zitate von `RULE_ANCHORS` … gefangen“ — Quelle sagt: Bei fehlender `AGENTS.md` wird `RULE_ANCHORS` übersprungen (`e2e/pins.ts:1176 @c7184f8`); dieser Pin prüft die **aus ihr zitierten Pfade**. Die Löschung von `AGENTS.md` selbst fällt an `RULE_VERIFY`: `pin(RULE_VERIFY, false, agents === null ? "no AGENTS.md" …)` (`e2e/pins.ts:1010 @c7184f8`). Kosten: Der Löschungsgegenfall bleibt geschlossen, aber seine Absicherung ist missverständlich beziehungsweise falsch zugeordnet.

12. [leicht] §1.6 — „alle sechs Assertions … drei Notes, roter Baum in C, Kurzkette in B's Audit-Zeile“ — Quelle sagt: Das eingebettete Skript prüft zusätzlich dreimal `main == C2`; damit enthält es acht aggregierte Ergebnisprüfungen. Die Audit-Assertion prüft Kommando und Cover-Stempel, aber weder `result === "green"` noch die behauptete Gesamtzahl grüner Audit-Zeilen. Grün ist ein eigenständiges Verdict (`server.ts:14028 @c7184f8`). Kosten: Exit 0 bestätigt weniger als die begleitende Beschreibung nahelegt; Zahl und zugesicherte Assertions müssen mit dem Skript übereinstimmen.

## Geprueft und korrekt (nur, was du wirklich gelesen hast)

- Dokument vollständig gelesen. SHA-256 vor und nach der Prüfung identisch.
- F1: Clean-Pfad einschließlich Klassifikation, Hold, Verify, Retry, Intent und Advance gelesen. Kein Vergleich eines vor dem Gate festgehaltenen Lane-Tips mit dem später gelandeten Branch-Tip. Die zusätzlichen Identitätsvergleiche des Confirm-Pfads sind vorhanden.
- §1.3: Die stärkste Gegenlesart zu B wird inzwischen korrekt benannt: Der Fixture-Kurzkettenlauf kann C2 im veränderlichen Worktree vorgefunden und trotzdem PASS gemeldet haben. Das Transkript schließt dies nicht aus; es belegt die vererbte Kettenwahl, keine Inhaltsblindheit der echten Pins. C zeigt im eingebetteten Transkript das Rot des definierten Marker-Kommandos, nicht der produktiven Suite.
- Historische Notes nachgerechnet, begrenzt auf den Zeitstempel der Land-Note am Quell-Pin: **482** mit Verify, **396** mit Zeitinformation, **60** proportional. Die **7** zeitlichen Treffer sind Confirm-Lands: drei rot, zwei `waitedOut`, zwei grün mit `stale:true`.
- Innerhalb der letzten **60** Commits am Quell-Pin: **14/14** vorhandene Land-Notes mit erfolgreichem Hub-Push.
- Angegebener Land-Bereich: **1** Commit; **0** Commits außerhalb der Remote-Tracking-Refs. Die Contains-Ausgabe zeigt einen Remote-Branch plus dessen symbolischen HEAD-Verweis. Zwei konfigurierte Remotes sind keine zwei unabhängigen enthaltenden Branches.
- Aktuelle erlaubte Zustandsfelder: Stack-Tiefe **1**, Drop-Zähler **345**. Der historische Wert **344** wurde damit heute nicht unmittelbar reproduziert.
- F2: Beide fail-closed-Rückgaben von `remoteHoldsLandedRange` führen zur Stack-Löschung. Reset-Fehler behalten den Eintrag. Reihenfolge Undo-Eintrag vor Hub-Push bestätigt.
- F3: Working-Tree-Build, fehlende Land-/Audit-Bindung, vollständige aktive Blocker-Menge, fehlende erneute Prüfung nach dem Build und fehlender Alterscheck beim Boot-Verdict bestätigt. Die Unknown-Zweige von `judgeDeploy` sind im Dokument inzwischen berücksichtigt.
- F4: Laufzeit-Tip, unveränderte Covers, optionales `clonedSha` ohne Verdict-Wirkung, Remote-Cover-Verbrauch vor Append, geschluckte Append-Fehler und mögliche grüne Zeile mit `ran:0` bestätigt.
- F5: Repo-bezogene Intent-Map ohne Belegtheitsguard, Pause nach Advance und Boot-Recovery-Zweige bestätigt. Die überarbeitete Verlustskizze ist als nicht ausgeführt gekennzeichnet.
- F6: Kandidatenskripte werden ausgeführt. Das neue Security-Runner-Beispiel ist durch die genannten Wrapper-Pins nicht widerlegt. Die Grenzen des vorgeschlagenen PASS-Zählers werden ausdrücklich benannt.
- F7: Server-Lockfunktionen und `e2e-stage.sh:1–330` gelesen. Eine fehlgeschlagene erste Schreibung kann den nicht automatisch bereinigten Park hinterlassen. Sofortige Ablehnung eines zweiten eigenen Holds und irreführender Retry-Text bestätigt.
- `verify-proportion.ts` vollständig gelesen. Rename nach `docs/` erschleicht wegen `--no-renames` keine Kurzkette.
- F8: **Sieben** Seed-Anker in **fünf** DOC_RULE-Dateien bestätigt. Der zitierte Fleet-Frame-Check prüft die selektierten Anker. `RULE_VERIFY` liest den Shell-Codeblock, nicht die Überschrift; die belegte Überschriftenlücke bleibt bestehen.
- Hygieneprüfung: Drei vorgegebene Muster ohne Treffer. Das Auth-Header-Muster trifft in Dokumentzeilen **252** und **254** auf variable Vorlagen; dort steht kein konkreter Credentialwert.
- Kosten sind für F1–F8 benannt. Für alle nummerierten Reparaturschnitte stehen Done-Sätze im Dokument; die oben beanstandeten sind noch keine verlässlichen Abnahmechecks.

## Nicht geprueft

- Keine Repro-Ausführung, Suite, Serveroperation, Fehlerinjektion, kein Deploy und kein Undo; nichts geschrieben.
- Rohartefakte und tatsächlich ausgeführte Skriptbytes der Scratch-Läufe. Geprüft wurden eingebettetes Skript und Transkript.
- Die ursprüngliche Ablehnung von 07:31 mit sechs Mängeln lag nicht vor. Die gelesene spätere Ablehnung mit 14 Punkten ersetzt diesen Abgleich nicht.
- Historischer `fleet.json`-Snapshot für den Drop-Zähler 344 und den damaligen Stack-Inhalt. Aktuelle Zustandsänderungen widerlegen diese historischen Angaben nicht.
- Live-Prozessumgebung, Konfigurationssensor, tatsächlicher Zustand der Remote-Server, historische Undo-Versuche und Ursachenhistorie der Drops.
- Die behaupteten 31 Direkt-Commits: Zeitraum und reproduzierbarer Auswertungsaufruf fehlen.
- Vollständige implementationsweite Absicherung aller negativen Existenzbehauptungen; insbesondere nicht sämtliche Harnesse, Konfliktpfade, Daemon-Pfade und Tests vollständig gelesen.
- Historisch leerer Quelldiff zum damaligen HEAD. Der heutige HEAD enthält inzwischen Änderungen an geprüften Quelldateien; sämtliche Codebelege dieser Abnahme stammen deshalb vom Quell-Pin.
- Experimentelle Ankeränderungen, reale Häufigkeit der Rennen sowie Signal-, Dateisystem-, Zombie- und PID-Recycling-Verhalten.

## Verdict

REJECT — Der unabhängige Audit-Done-Check in §1.7 setzt ein vom Code ausdrücklich ausgeschlossenes Grace-Fenster voraus; zusätzlich verhindern falsche Runner-Zuordnungen, fehlerhafte Testvoraussetzungen und überzogene Belegbehauptungen die Annahme.