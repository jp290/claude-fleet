# Index der Messnotizen

Eine Zeile je Notiz in `docs/messungen/`, angehängt von der schreibenden Lane selbst (siehe
`.claude/skills/mess-notiz/SKILL.md` §Die Index-Zeile) — nicht aus dem Korpus generiert, weil ein
generierter Index gegen die Dateien driftet. Format:
`- <urteil> — docs/messungen/<datei>.md · bereich: a,b · stand: YYYY-MM-DD`. Das `urteil` ist
wörtlich das gleichnamige Front-Matter-Feld der Notiz: die Antwort, nicht die Zusammenfassung.

Die Notizen, die vor dem Front-Matter entstanden sind, werden nachgetragen (P0b); bis dahin ist
diese Liste unvollständig, und ein Fehlen hier heißt nicht, dass es die Notiz nicht gibt.

- Von 71 offenen Queue-Zeilen sind 4 erledigt oder widerlegt und 8 haben eine veraltete Prämisse; Dreiteilung in 8 BAU, 21 zweiter Blick, 40 Archiv-Vorschlag, der Archivschnitt selbst ist nicht ausgeführt — docs/messungen/2026-08-19-queue-triage.md · bereich: queue · stand: 2026-08-19
- Von acht Größen hat keine einen vollständigen maschinellen Sensor (zwei teilweise, sechs gar keinen); der reichste Sensor lane-outcomes.jsonl feuert auf dem Lane-Pfad, den die Studios nicht benutzen — docs/messungen/2026-08-20-gamestudio-readiness.md · bereich: studio,verify · stand: 2026-08-20
- Weder Konzept jetzt als Studio/Canary; beide als billige Wissensartefakte plus falsifizierbare Papier-Piloten; AFTERIMAGE zusätzlich als eingefrorene determinism-benchmark SPEC; die Produktfrage bleibt ausdrücklich Owner-Geschmack — docs/messungen/2026-08-23-glm-decision-review-umbra-afterimage.md · bereich: studio,autoritaet · stand: 2026-08-23
- Die Schleife bis lane finished ist fast geschlossen, aber ihr Ende ist doppelt ein Owner-Klick (Merge-Start und Confirm); land und budget sind maschinell noch nicht existent, alles andere sind Grade — docs/messungen/2026-08-23-redteam-glm-autonomie.md · bereich: autoritaet,studio · stand: 2026-08-23
- Wurzel ist ein fehlender Completion-Kontrakt auf der Dispatch-Schicht (briefAndSend liefert Task-Text plus Ankerblock, keinen Commit-/Report-/Idle-Auftrag); Harness- und Modellverhalten vom Transkript widerlegt — docs/messungen/2026-08-23-rootcause-lane-ohne-commit-und-report.md · bereich: lane-lifecycle,harness · stand: 2026-08-23
- Die Kette steht endgebaut bis auf die Kante, die einen Baum auf main bringt; sie ist owner-token-only und in Produkt-Repos zusätzlich verify-blockiert (exit 42), alle 8 Tower-Lands des Tages waren menschliche Klicks — docs/messungen/2026-08-23-studio-autonomy-causal-audit-fable.md · bereich: autoritaet,studio · stand: 2026-08-23
- Die Kette Worker, Watch, MAIN, Attention funktioniert; die zwei fehlenden Akte sind Maschinenakte am Anfang und Ende jedes Acts (Start wegen tickDispatch-return beim fremden Repo-Cap, Land wegen Owner-only-Land-Route) — docs/messungen/2026-08-23-studio-autonomy-causal-audit-glm.md · bereich: autoritaet,queue · stand: 2026-08-23
- Kein Pfad gefunden, über den ein nicht gebundener, stale, Lane-, Steward-, Worker- oder Self-Token-Principal einen Land auslöst oder unattribuiert landet; die zwei dokumentierten Design-Grenzen (textueller Call-Site-Pin, via-Spoofbarkeit des Suspect-Flags) gewähren keine Autorität — docs/messungen/2026-08-24-authority-critic.md · bereich: autoritaet,verify · stand: 2026-08-24
- Fable startet nicht als freie Großanalyse, sondern als enges read-only Admission-Gate Stufe 1½ mit vier Routen; wichtigster Befund ist die zweifache Proof-Lücke (bun run verify prüft gespeicherte Selbstbehauptungen, Fleet-Land-Notes weisen den Repo-Verify als SKIPPED, Exit 42, aus) — docs/messungen/2026-08-26-private-repo-j-worktrail-audit.md · bereich: studio,verify · stand: 2026-08-26
- Private-repo-j ist konditional rettbar, nicht aber als Fortsetzung der Route statischer Damm auf echtem Deutschland-DEM; jetzt genau einen eintägigen adversarialen Kernloop auf absichtlich gebautem Terrain finanzieren, kein weiterer DEM-Messakt und kein Stufe-3-Papier davor — docs/messungen/2026-08-27-private-repo-j-worktrail-audit-II.md · bereich: studio,kosten · stand: 2026-08-27
