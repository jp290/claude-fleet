# Konzept-Kandidaten: Methode und Abdeckung

Stand 2026-09-25. Frage: Welche Konzept- und ContextPack-Kandidaten lassen sich aus den lokal verfügbaren Sessionquellen gewinnen, ohne ihre Inhalte öffentlich zu übernehmen?

## Ergebnis

Die private Liste enthält **32 Kandidaten: 19 Konzepte und 13 ContextPacks**. Jeder Eintrag enthält einen vorgeschlagenen Zwei-Satz-Kern, Typbegründung, Scope, Ablösungsbedarf, Nachbarn und 3–5 Quellenverweise. Die Klassifikation ist eine kuratierte Empfehlung, keine Owner-Promotion. Es wurde kein Speicher gebaut.

Das eingefrorene Inventar umfasst 3.849 Einträge einschließlich eines fehlenden Sollpfads und eines reproduzierbaren Commit-Exports. Davon wurden 3.847 gelesen: **5.288.666.808 Bytes und 1.408.414 Zeilen**. Zwei Einträge bleiben unknown: eine Sessiondatei verschwand zwischen Inventarisierung und Öffnen; die Promptdatei fehlt am ursprünglich angegebenen Ort. Eine gefundene Promptdatei wurde separat aufgenommen. 15 Claude-JSON-Zeilen waren nicht parsebar und zählen nicht als ausgewerteter Inhalt.

| Quellenfamilie | Gelesen / inventarisiert | Gelesene Bytes | Semantischer Schnitt |
|---|---:|---:|---|
| Claude-Sessions | 2.191 / 2.192 | 2.277.634.025 | Textblöcke von User und Assistant |
| Codex-Sessions | 746 / 746 | 2.904.105.050 | Dialognachrichten aus response_item |
| Pi-Sessions | 77 / 77 | 56.143.976 | User-/Assistant-Textblöcke |
| Memory-Dateien | 529 / 529 | 1.275.152 | Markdown-Zeilen |
| Direktes Wissensregal | 6 / 6 | 25.928 | Markdown-Zeilen |
| Messnotizen | 295 / 295 | 6.107.490 | Markdown-Zeilen des eingefrorenen Baums |
| Prompt-Sollpfad | 0 / 1 | 0 | unknown |
| Gefundene Promptdatei | 1 / 1 | 35.923.142 | Textfeld, soweit vorhanden |
| Context-Receipts | 1 / 1 | 2.406.705 | Nur Metadaten: 1.272 Datensätze |
| Commit-Export | 1 / 1 | 5.045.340 | 2.952 erreichbare Commit-Bodies |

„Gelesen“ bedeutet vom Parser erfasste Bytes, nicht vollständige semantische Interpretation. Die Grenzen und Zähler stehen im privaten Inventar und im Parserprotokoll. 17 Dateien besitzen einen identischen vollständigen Dateihash wie ein vorheriger Inventareintrag.

## Methode

Die Skripte und ihre Ergebnisse liegen im autorisierten privaten Ergebnispaket. Reproduktion dort: `python3 mine.py`, `python3 refine.py`, `python3 deliver.py`, `python3 check_refs.py`, `python3 check_public.py`. Der erste Schritt erzeugt bei erneuter Ausführung ein neues Inventar; die bestehenden Inventar- und Trefferdateien bewahren den hier berichteten Schnitt. Die weiteren Schritte arbeiten auf diesem Schnitt. Der Repo-Check erfolgt aus dem Repository.

1. Form und Felder der Quellen stichprobenartig bestimmen, danach Dateiliste und Byte-Grenzen einfrieren. Jede gelesene Datei erhält einen Hash; spätere Anhänge gehören nicht zum Nenner. Ergänzende Pack-Quellen werden separat mit Beobachtungszeit und Hash erfasst.
2. Titel aus Memory, vorgegebene Kontextquellen und häufige Wortpaare zur Kandidatensuche verwenden. Der offene Wortpaarlauf liefert überwiegend Transport- und Regelvokabular. Die Auswahl bleibt deshalb begriffsgeleitet und beansprucht keine vollständige semantische Entdeckung.
3. Nur unterstützte Dialogtextfelder und Dokumentzeilen auswerten. Vor Auszügen Credential-/Env-Zeilen, URLs, E-Mail-Adressen und lange opake Werte entfernen. Ganze Transkripte werden nicht in den Modellkontext geladen.
4. Exakte normalisierte Textduplikate sowie erkennbare Übergabe-, Zusammenfassungs- und Startblöcke getrennt markieren. Die konservative Tiefe schließt beide Gruppen aus. Nicht erkannte Paraphrasen und kopierte Teilblöcke bleiben eine Messgrenze. Mehrdeutige Treffer werden im begrenzten Auszugsfenster nachgefiltert; diese Schärfung kann echte Erwähnungen verlieren.
5. Tiefe je Kandidat als beobachtete Session-IDs, Quellen und datierte Treffer ausweisen. Ein Commit zählt als eigene Quelle, nicht als Session. Erste/letzte Erwähnung stammen ausschließlich aus tatsächlichen Trefferzeitstempeln. Undatierte Dokumente erhalten kein erfundenes Datum. Null beobachtete Sessions bedeutet keine historische Abwesenheit.
6. Kerne, Typ und Scope kuratieren. Nachbarn als redaktionelle Vorschläge kennzeichnen und ihre gemeinsame Trefferzahl ergänzen. Ablösung bleibt Vorschlag oder unknown. Vorhandene Packs anhand beider Fleet-Manifeste und ihrer tatsächlichen öffentlichen Quellen prüfen; fremde Repo-Manifeste bleiben außerhalb.

Die Pack-Prüfung las `context-packs.ts:89` und `.fleet/context-packs.json:1` sowie die öffentlichen Zielabschnitte. Ein opaker privater Pack-Zeiger wurde nicht aufgelöst; seine Quelle bleibt unknown. Die Ergänzungsquellen gehören nicht nachträglich zum Session-Nenner.

## Top 20 nach beobachteter Tiefe

Sortierung: bereinigte Sessionzahl absteigend, dann Quellenzahl absteigend, dann Name. Das ist eine Verbreitungsreihung, kein Urteil über Nutzen oder Ausarbeitung. Die öffentlichen Namen enthalten keine Personen- oder privaten Projektbezeichnungen.

1. Graphify
2. Claude Fleet
3. Verify und Audit
4. Messnotizen
5. Queue-Refinement
6. Evidenz und Unknown
7. ContextPacks
8. Jev-Klassifikation
9. Harness-Adapter
10. Owner-Promotion
11. Game Preflight
12. Kontextkosten
13. Eventgetriebenes Warten
14. Slot-Identität
15. Sensory Critic
16. Land-Mechanik
17. Portable Core
18. Rulebook-Generat
19. Videopipeline
20. Verifikationshierarchie

## Gelesen und nicht gelesen

Graphify wurde read-only zur Orientierung abgefragt; sein begrenzter Ausschnitt dient nicht als Abdeckungsbeweis. Gelesen wurden die beauftragten Planabschnitte, der portable Vertrag, die Messnotiz-Skill und die Pack-Quellen. Die Datenfamilien und Parsergrenzen stehen oben.

Nicht semantisch ausgewertet wurden Toolausgaben, Thinking, System-/Developerblöcke, doppelte Codex-Eventnachrichten und kompaktierte Ersatzhistorien. Nicht inventarisiert wurden verschachtelte Claude-Subagent-Archive, archivierte Quellen außerhalb der benannten Sessionwurzeln, Wissensregal-Unterbäume und fremde Repo-Historien. Die Pi-Suche erfasste die lokale Pi-Wurzel rekursiv; zwei weitere übliche Konfigurations-/Datenorte fehlten. Weitere nicht entdeckte Ablagen bleiben unknown. Es gab keine Volllektüre des privaten Regelbuchs und keine Änderung an Owner-Memory oder Index.

Die 32 Kandidaten sind keine erschöpfende Liste aller Konzepte des Owners. Die Tiefe misst lexikalische Verbreitung im beschriebenen Schnitt; sie beweist weder unabhängige Ausarbeitung noch Zustimmung oder aktuelle Gültigkeit.

## Prüfung

Der private Quellencheck öffnet die Ursprungsdateien und prüft Datei, Zeilennummer und exakten Zeilenhash für 162 Verweise einschließlich der beiden Pack-Manifeste. Commit-Verweise werden zusätzlich mit dem Git-Objekt abgeglichen. Fehlende Quelle, Zeile außerhalb der Datei und falscher Hash werden abgewiesen. Existenz und Byte-Identität sind keine semantische Wahrheitsprüfung.

Die öffentliche Notiz wird auf Hostpfade, Credential-Muster und Übernahme der privaten Kandidatenkerne oder längerer Quellenauszüge geprüft und anschließend redaktionell gelesen. Öffentliche Ausgabe sind ausschließlich Methode, Abdeckung, Typzahlen und Namen.

Ausgeführt: `python3 check_refs.py`, `python3 check_public.py` sowie `bun install --frozen-lockfile && bun e2e/pins.ts`. Alle drei Prüfungen schlossen wörtlich mit `ALL PASS`. Die vollständigen Prüfprotokolle werden privat aufbewahrt. Die Gate-Auswahl wird am committeten Diff kontrolliert.
