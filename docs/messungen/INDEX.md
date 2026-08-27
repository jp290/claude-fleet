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
