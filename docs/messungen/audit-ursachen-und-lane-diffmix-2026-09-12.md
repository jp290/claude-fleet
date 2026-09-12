---
frage: Woraus bestehen die 181 nicht grünen Audits seit dem 25.08., und wohin geht die gelandete Lane-Arbeit?
urteil: 65 Familiensignaturen, 18 Timeouts, eine Nullmessung, drei belegte Fehler und 94 ungeklärte Ursachen; Fleet-Diffs bestehen zu 55,76 Prozent aus Dokumentation und Markdown.
bereich: [audit-ursachen, lane-diffmix]
belege: [server.ts#PostLandAuditRow, server.ts#adjudicationsByAudit, server.ts#buildLaneOutcome]
nicht-gemessen: Neue Same-Tree-Wiederholungen, CPU-Zeit, Arbeitsanteile innerhalb gemischter Lanes und zwei Lands ohne Commit-Provenienz
stand: 2026-09-12
---

# Audit-Ursachen und Lane-Diffmix

Stichtag `2026-08-25T12:06:00Z`, untersuchter Codebaum `c8845a74`.
A liest alle 181 nicht grünen Zeilen unter `post-land-audits.jsonl:271–567`: 101 rot und
80 `unknown`, zusammen 202.215.457 ms; keine fehlt wegen eines ungültigen JSON-Datensatzes.
`ms` ist erfasste Job-Dauer einschließlich Einrichten und Warten, keine CPU-Zeit
(`server.ts#PostLandAuditRow`). Der Urteilsjoin liest `audit-adjudications.jsonl:1–178`,
Schlüssel `auditAt`, jüngstes `at` gewinnt wie in `server.ts#adjudicationsByAudit`.
93 dieser Audits haben ein Owner-Urteil: 51 `flake`, 16 `stale-test`, 22 `unknowable`,
4 `real`; 88 haben keines. Ein Urteil ändert das ursprüngliche Audit-Ergebnis nicht.

## A — Zuordnung der nicht grünen Audits

Die Zuordnung ist disjunkt und beschreibt die belegbare Signatur; eine dokumentierte Familie
beweist keinen aktuellen Flake, auch nach ihrer Reparatur nicht. F = `flake`, S = `stale-test`,
U = `unknowable`, R = `real`; die letzte Spalte zählt gespeicherte Urteile, keine Neubewertung.

| Ursache beziehungsweise belegte Signatur | Anzahl | Summe ms | Adjudiziert |
|---|---:|---:|---|
| Dokumentierte Familiensignatur, Namen unten | 65 | 109.527.176 | 59: 45 F, 13 S, 1 R |
| `checks.ran == 0` | 1 | 27.974 | 1 U |
| Expliziter Timeout-Grund | 18 | 38.724.444 | 4 U |
| Damals fehlende `server.log` im Audit-Out belegt | 0 | 0 | 0 |
| Produkt-/Verifikations-Rot mit belegter Reparatur | 3 | 3.178.242 | 3 R |
| Nicht zuordenbar | 94 | 50.757.621 | 26: 6 F, 3 S, 17 U |
| **Summe** | **181** | **202.215.457** | **93; 88 ohne Urteil** |

**Zeilenzuordnung**, physische Zeilen in `post-land-audits.jsonl`; jede ausgewählte Zeile steht
genau einmal in diesem Schlüssel, die Kategorie `server.log` ist leer:

```text
Familie=285,288,298,299,301,302,307,309,320,321,370,373,379,380,391,392,393,394,410,419,425,427,428,433,436,438,439,440,442,443,444,445,446,448,449,450,451,452,454,460,463,464,465,466,467,468,470,471,472,474,476,477,479,483,485,486,487,489,490,493,499,506,536,537,547
Nullmessung=430
Timeout=286,287,291,314,315,333,334,390,399,407,408,484,488,500,503,505,513,515
Fehler=281,453,480
Ungeklärt=275,279,282,292,294,295,297,300,303,306,308,310,311,312,313,316,322,323,324,325,326,328,329,330,331,332,335,336,337,338,344,345,346,347,349,350,352,353,354,355,357,358,360,362,363,365,366,368,369,371,372,374,375,376,377,378,383,384,385,388,395,396,397,398,401,402,405,409,412,413,416,417,418,420,421,422,426,441,455,457,469,473,478,481,482,491,497,510,523,527,528,535,541,545
```

**Familiennamen und Zuordnung** nach `docs/verify-tiering.md` §11; innerhalb dieser Liste
können Mischläufe mehrfach erscheinen, ihre Vereinigungsmenge ergibt die 65 Tabellenzeilen:

- §11.2b Reseed/Live-Bytes: 506,537,547.
- §11.2f Send-Boot/Stand-in `lines=0`: 285,288; Korrektur in §11.2g mitgelesen.
- §11.2h Owner-Token-Ambient-Use/Zuordnung: 298,299,301,302,307.
- §11.2j `pi-unfenced` Watch-Zustellung: 370,373,379,380,391,393,394,410,419,425,433,436,442,444,448,451,454,466,479.
- §11.2k Raw-Review-Persistenzrace: 392.
- §11.2l Busy-Receiver-Restart: 425,427,433,436,438,439,440,442,443,444,445,446,448,449,450,452,454.
- §11.2n `re-run`-Guard/`settleForMerge`: 309,321,428,449.
- §11.2o Program-Phasenprojektion: 464,465,466,467,468,470,471,472,474,476,477,479,483,485,486,487,489,490,493.
- §11.2q Q6-Fleet-Report auf `send-uncertain`: 466.
- §11.2r Watch-Idempotenz: 320,460,474,483,536.
- §11.2s D2-Vorbedingung/Git-Anzeigecache: 464,466,479,483,485,486,487,490,493,499.
- §11.2u `unbound succession`/sterbende Pane: 463,471,472.

Die Familiensignaturen 467,483,485,486,537,547 sind ohne Owner-Urteil. Zeile 425 trägt `real`,
laut Urteil jedoch einen vorbestehenden Fehler mit j/l-Mischsignatur; seine Verursachung durch
den gedeckten Land ist nicht belegt (`audit-adjudications.jsonl:105`). Die Einzelbeobachtung
§11.2t/Codex-Resume-Heal in Zeile 510 bleibt ungeklärt. §5b und §11 wurden einschließlich
Reparatur- und Rücknahmehinweisen gelesen; hier wurde kein Same-Tree-Rerun ausgeführt.

Timeout verlangt den expliziten `reason`: elfmal 1.800.000 ms Budget, siebenmal 2.700.000 ms.
Das Kontrollfenster ±1 % um 2.700.000 ms trifft zusätzlich die rote Zeile 545 (2.703.856 ms);
sie bleibt ohne Timeout-Grund ungeklärt. Die 94 ungeklärten Zeilen zerfallen in 55 abgelehnte
Starts (`exit 42`, zusammen 29.610 ms), sieben nicht gestartete Kommandos (`exit 127`,
4.637 ms) und 32 rote Läufe (50.723.374 ms). Die konkrete Ursache der Startverweigerung
ist damit nicht bewiesen; der Leerklon-Gegencheck aus §14.1 liegt nicht durchgängig vor.
88 der 181 Zeilen haben `checks:null`, keine hat ein fehlendes `ms`; unbekannte Checkzahlen
sind nicht null Checks. Kein damaliges `server.log`-ENOENT ist im aufbewahrten Audit-Out belegt;
heutiges Fehlen aufgeräumter Instanzen wurde nicht rückprojiziert.

**Drei belegte Fehler, Check und Fix:** Zeile 281 betrifft „§7 fixture: the land gate actually
ran on this lane's tree“ (`e2e/verify-queue.ts:883`): Running wurde vor dem Preflight sichtbar,
repariert in `3814f400`. Zeile 453 betrifft „§1 the pre-auth route set equals the reviewed
allowlist“ (`e2e/security.ts:572`): die Probe kannte die neue Route nicht, ergänzt in
`6c1e6722`. Zeile 480 betrifft sechs gitabhängige Pins im Snapshot ohne `.git`, darunter
„the module set for the copy guard is derived from tracked files, and the derivation ran“;
der Snapshot-Kontext wurde in `997ed481` repariert. Urteile dazu stehen in
`audit-adjudications.jsonl:56`, `:141`, `:156`; alle drei Fix-Diffs wurden gelesen.
`8df64679` beziehungsweise `35ac0b97` aus den Urteilstexten waren lokal nicht als Commits
auflösbar und werden nicht als Fix-Beleg verwendet.

## B — Diffmix der gelandeten Lanes

Grundmenge: 323 Zeilen mit `disposition:"landed"` ab Stichtag
(`lane-outcomes.jsonl:506–899`). Davon sind 321 über `mainAfter` und die zugehörige
`git notes --ref=fleet/land`-Note vollständig auf 321 eindeutige Land-Commits abbildbar;
251 gehören zu claude-fleet, 70 zu den übrigen im Ledger benannten Repos.
Für jeden wurde `git -C <repo> diff --numstat --no-renames <note.mainBefore> <note.mainAfter> --`
gelesen; Additionen und Löschungen zählen beide. Klassenpriorität: Pins, Docs/Markdown,
übrige E2E, übrige Dateien. Repo- und Git-Zugriffe blieben lesend.

Die Zellen zeigen **alle gemappten Lands / davon claude-fleet**; Anteile beziehen sich auf
434.695 / 182.407 numerische Numstat-Zeilen. Lane-Stunden sind die ganze gemessene `sessionMs`
einer Lane, die die Klasse berührt: Bei gemischten Lanes überlappen diese Stunden, sie sind
nicht addierbar und wurden nicht nach Diffgröße aufgeteilt.

| Diff-Klasse | Zeilen, alle / Fleet | Anteil, alle / Fleet | Lane-Stunden, alle / Fleet |
|---|---:|---:|---:|
| `docs/**` und sonstige `*.md` | 109.113 / 101.702 | 25,10 % / 55,76 % | 507,00 / 468,70 |
| Übrige `e2e/**` und `e2e-*.sh` | 25.972 / 25.972 | 5,97 % / 14,24 % | 421,32 / 421,32 |
| `e2e/pins.ts` | 4.674 / 4.674 | 1,08 % / 2,56 % | 274,36 / 274,36 |
| Übriger Code und Dateien | 294.936 / 50.059 | 67,85 % / 27,44 % | 468,32 / 417,00 |
| **Summe** | **434.695 / 182.407** | **100 % / 100 %** | **überlappend** |

41 zusätzliche binäre Numstat-Einträge gehören zu übrigen Dateien außerhalb Fleet; sie haben
keine Zeilenzahl. Die vier Textklassensummen stimmen exakt mit dem gesamten numerischen
Numstat der rekonstruierten Lands überein. Es fehlen keine Repo-Felder; alle 321 zugeordneten
Lands haben lesbare Git-Objekte und gültige Notes. Zeilen 573 und 583 besitzen kein `mainAfter`
und keine Land-Note auf `headSha`; ihre Diffs bleiben unbekannt, ihre vorhandenen Dauern
19.935.597 und 6.228.360 ms wurden keiner Klasse zugerechnet.
83 der 323 Lanes haben `sessionMs:null`. Für die 321 gemappten Lanes sind 238 Dauern bekannt,
zusammen einmalig 598,52 h; für die 251 Fleet-Lanes 185 Dauern, zusammen einmalig 541,14 h.
Bekannte Dauern / berührende Lanes je Klasse, alle und Fleet: Docs 184/253 und 157/214,
E2E 118/137 und 118/137, Pins 71/84 und 71/84, übrige Dateien 168/193 und 120/139.
`server.ts#buildLaneOutcome` misst verstrichene Sessiondauer; Liegezeit bleibt darin enthalten.

Verifikation: A-Zuordnung gegen alle 181 Ledgerzeilen, Summen und jüngste Urteile geprüft;
B-Numstat und Dauerfelder unabhängig erneut über alle 321 Notes berechnet, Klassensummen
434.695 / 182.407 bestätigt; alle zitierten Symbolanker mit `rg -n` aufgelöst.
Ausgeführt wurde ausschließlich `bun e2e/pins.ts`, keine Suite und kein Serverstart.

```text
ALL PASS
```

Für Position 2 begründet die Messung einen Rückweg zur zuständigen MAIN, der das ursprüngliche Ergebnis, vorhandene Urteile und Beleglücken zusammen übermittelt, weil 88 Audits noch kein Urteil besitzen und eine Familiensignatur allein keine Entlastung trägt.
Für den übrigen Plan stützt der Fleet-Diffmix mit 55,76 % Docs/Markdown und weiteren 16,80 % E2E/Pins die bestehende Grenze gegen zusätzliche Regelserien und gegen eine Suite-Verkürzung ohne Ursachenbeleg.
Ungemessen bleiben aktuelle Reproduzierbarkeit, Ursachen der 94 ungeklärten Audits, CPU- und menschliche Arbeitszeit, Zeitanteile gemischter Lanes sowie die Diffs der zwei Lands ohne Commit-Provenienz.
