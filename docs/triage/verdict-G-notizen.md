# Verdikt G-notizen — Notizen und selbst-erklärte Nicht-Aufträge

**Worker:** pi/gpt-5.6-sol  ·  **Baum:** 45902f9  ·  2026-08-09
**Werkzeug-Probe:** ast-grep lief (`ast-grep 0.45.1`)  ·  rg ja

## Übersicht
| Zeile | Verdikt | Konfidenz | Größe | Einzeiler |
|---|---|---|---|---|
| `05320523` | streichen | hoch | S | Beide Befunde sind dauerhaft dokumentiert; der Maschinen-Fakt ist zusätzlich gebaut. |
| `356333db` | streichen | hoch | S | Produktfrage und Widerlegung von `mtime` stehen bereits in Brief und Register. |
| `b759e8d9` | streichen | hoch | S | Der Repo/Branch-Fehlalarm ist als offener Sensorbefund dokumentiert. |
| `56be77a3` | streichen | hoch | S | Der Sicherheitsbefund samt Owner-Griff steht im Attic und im Commit-Body. |
| `09572f62` | streichen | hoch | S | P-6 bleibt als ausdrücklicher Owner-Entscheid im Attic erhalten. |
| `cd85c924` | streichen | hoch | S | Retrieval-Phasen, Blocker und offene Entscheide sind im Attic ausführlicher gesichert. |
| `97f529b1` | streichen | hoch | S | Smart-auto und sein ausdrückliches „nicht zuerst bauen“ stehen im Attic. |
| `7366e599` | streichen | hoch | S | Runtime-Env und die Kollisionsklasse stehen bereits im stillgelegten Register. |
| `10ac2528` | streichen | hoch | S | Analyzer-Aufschub ist dokumentiert; Datenfehler: kind gehört auf `note`. |
| `63626cdb` | streichen | hoch | S | Die drei Audit-Reste sind dokumentiert; Datenfehler: kind gehört auf `note`. |
| `b8716d0e` | streichen | mittel | S | Drift bestätigt, aber die verbliebenen Quellen sind SHA-gepinnt; Nachziehen wäre wiederkehrende Pflege ohne Wahrheitsgewinn. |
| `d2a0d45e` | bauen | hoch | S | Ein toter `BACKLOG.md:773`-Beleg in `d375c581` ist direkt bestätigt und eng korrigierbar. |
| `efc98cfa` | streichen | hoch | S | Groupchat-Abhängigkeiten sind im Steward-Brief gesichert; Datenfehler: kind gehört auf `note`. |

## Je Zeile

### `05320523` — streichen, Konfidenz hoch
- **Warum:** Typ (a), Wissenssicherung: Der ungelesene Schlussbericht, die vorhandene Transcript-Route und der nötige Vorab-Look stehen bereits in `briefs/steward-kritik-2026-08-07.md`; der Maschinen-Fakt wurde danach gebaut. Die Queue-Notiz ist damit nur noch eine zweite Ablage, nicht der Träger des Wissens.
- **Beleg:** `c02a0d4`, `briefs/steward-kritik-2026-08-07.md:102-127`, `briefs/steward-kritik-2026-08-07.md:348`; zusätzlich `23e6033` und `server.ts:11717` für `gate: gateView()` auf dem Digest.
- **Größe:** S (<1 h) — Zeile archivieren.
- **Was noch fehlt, bevor man es starten kann:** Nichts; die weiterhin offene Ritualentscheidung steht im Brief, nicht in dieser Duplikat-Zeile.
- **Nicht geprüft:** Keine damaligen Lane-Transkripte und keine Live-Journale; der historische Einzelfall wurde aus der getrackten Auswertung gelesen.

### `356333db` — streichen, Konfidenz hoch
- **Warum:** Typ (a), Wissenssicherung: Die Produktfrage „sichtbare letzte Ausgabe“ und die Abwägung flüchtiges `lastOutput` gegen widerlegtes `transcriptFact.mtime` stehen bereits im dauerhaften Wert-Review. Zudem ist die schädliche Epochen-Lesart seit `523f5dc` behoben; die Queue-Zeile muss nicht als Erinnerung weiterleben.
- **Beleg:** `7941c3f`, `briefs/work-waves-2026-08-07.md:172-174`; `523f5dc` und `server.ts:10066-10075` zeigen die gebaute Restart-Korrektur.
- **Größe:** S (<1 h) — Zeile archivieren.
- **Was noch fehlt, bevor man es starten kann:** Falls der Owner die Anzeige dennoch will, braucht es einen neuen, geschnittenen Auftrag mit gewählter Semantik; diese Notiz ist dafür nicht das Ausführungsstück.
- **Nicht geprüft:** Keine vollständige UI-Lokalisierung der Info-Karte und keine Live-Messung nach dem letzten Neustart.

### `b759e8d9` — streichen, Konfidenz hoch
- **Warum:** Typ (a), Wissenssicherung: Fehlalarm, Ursache und Kosten sind im heutigen Sensor-Dokument ausdrücklich als offen festgehalten. Die Notiz ist nicht mehr die einzige Stelle, die den Befund bewahrt.
- **Beleg:** `3b22aa8`, `docs/attic/autonomy-map-2026-08-06.md:277-286`; der weiterhin branch-only geschnittene Code steht in `server.ts:11297-11331`.
- **Größe:** S (<1 h) — Zeile archivieren.
- **Was noch fehlt, bevor man es starten kann:** Ein eigener Lane-Auftrag müsste Migration/Toleranz alter Journal-Keys und ein repo+branch-Done-Kriterium festlegen.
- **Nicht geprüft:** Der historische Zwei-Repo-Fehlalarm wurde nicht live reproduziert.

### `56be77a3` — streichen, Konfidenz hoch
- **Warum:** Typ (a), Wissenssicherung: Der Confused-Deputy-Befund, die bereits erfolgte frühere Widerruf-Aktion und der verbleibende Owner-Entscheid „cwd ändern oder Exposition akzeptieren“ stehen dauerhaft im Attic und im Abgleich-Commit. Die Zeile ist als Wissensspeicher redundant, nicht als Codearbeit aufzuwerten.
- **Beleg:** `c366c66`; `docs/attic/backlog-2026-07.md:994-1010` und `docs/attic/backlog-2026-07.md:1280-1297`.
- **Größe:** S (<1 h) — Zeile archivieren.
- **Was noch fehlt, bevor man es starten kann:** Kein Lane-Start; ein etwaiger aktueller Share-Widerruf oder cwd-Wechsel ist ein Owner-Griff.
- **Nicht geprüft:** Der heutige Slot-/Share-Zustand, weil `fleet.json` und die Share-Wirklichkeit nicht im Lane-Baum liegen.

### `09572f62` — streichen, Konfidenz hoch
- **Warum:** Typ (a), Wissenssicherung: Das Program-Board bleibt im Attic ausdrücklich „owner: build or not“, einschließlich der dünnen Evidenzbasis von einem handgefahrenen Stack. Der erste Satz erklärt die Zeile selbst zum Nicht-Auftrag; `bauen` würde diese Aussage überstimmen.
- **Beleg:** `c366c66`; `docs/attic/backlog-2026-07.md:1197` und `docs/attic/backlog-2026-07.md:1313-1315`.
- **Größe:** S (<1 h) — Zeile archivieren.
- **Was noch fehlt, bevor man es starten kann:** Erst ein neuer Owner-Entscheid und danach ein eigener Auftrag mit engerem Schnitt.
- **Nicht geprüft:** Ob seit dem dokumentierten Einzel-Stack außerhalb des getrackten Baums weitere Stacks von Hand gefahren wurden.

### `cd85c924` — streichen, Konfidenz hoch
- **Warum:** Typ (a), Wissenssicherung: Die Retrieval-Idee ist als Entscheidungsitem mit Phasen, Gold-Set, Geheimnisgrenze und ungelöstem Embedding-Ursprung ausführlicher im Attic festgehalten. Der erste Satz sagt „kein Arbeitsauftrag“; die Queue-Notiz fügt gegenüber der Datei keinen dauerhaften Wissensrest hinzu.
- **Beleg:** `c366c66`; `docs/attic/backlog-2026-07.md:830-850`, `docs/attic/backlog-2026-07.md:882-950`.
- **Größe:** S (<1 h) — Zeile archivieren.
- **Was noch fehlt, bevor man es starten kann:** Owner-Entscheid zu Indexgrenze/Secret-Policy und Embedding-Quelle; erst dann getrennte Phase-Aufträge.
- **Nicht geprüft:** Keine externe Embedding-Infrastruktur und kein ungetrackter Arena-Lauf.

### `97f529b1` — streichen, Konfidenz hoch
- **Warum:** Typ (a), Wissenssicherung: Nutzen, Vertrauensrisiko und die harte Reihenfolge „Do not build this first“ stehen bereits im Attic. Die Notiz erklärt sich selbst zum Nicht-Auftrag und gehört nicht als baubare Zeile umgedeutet.
- **Beleg:** `c366c66`; `docs/attic/backlog-2026-07.md:745-762`.
- **Größe:** S (<1 h) — Zeile archivieren.
- **Was noch fehlt, bevor man es starten kann:** Eine belegte manuelle Nutzung der Phase-1-Signale und danach ein neuer Opt-in-Auftrag.
- **Nicht geprüft:** Ob die Phase-1-Signale in ungetrackten Betriebsdaten tatsächlich benutzt wurden.

### `7366e599` — streichen, Konfidenz hoch
- **Warum:** Typ (a), Wissenssicherung: Die Lane-Runtime-Env samt `FLEET_LANE_SLOT`, Portband und sicheren Fleet-on-Fleet-Overrides ist im Attic erhalten. Die Notiz sagt selbst „bauen, wenn [die Kollisionsklasse] sich meldet“; ohne neuen Vorfall ist sie kein heutiger Bauauftrag.
- **Beleg:** `c366c66`; `docs/attic/backlog-2026-07.md:478-489`.
- **Größe:** S (<1 h) — Zeile archivieren.
- **Was noch fehlt, bevor man es starten kann:** Ein neuer, belegter Port-/Socket-Kollisionsfall als Auslöser und ein daraus geschnittener Auftrag.
- **Nicht geprüft:** Ungetrackte Betriebs- oder Server-Logs auf solche Vorfälle.

### `10ac2528` — streichen, Konfidenz hoch
- **Warum:** Typ (a), Wissenssicherung: Recorder/Viewer und der bewusst spätere Analyzer stehen im Attic; die Volumenfrage ist dort ausdrücklich als spätere Analyse-Voraussetzung erhalten. Der erste Satz sagt „kein Arbeitsauftrag“. Zusätzlich liegt ein echter Datenfehler vor: `kind` gehört auf `note`, nicht auf `lane`.
- **Beleg:** `c366c66`; `docs/attic/backlog-2026-07.md:953-985`; der bekannte lane→note-Formfehler steht in `briefs/work-waves-2026-08-07.md:220-225`.
- **Größe:** S (<1 h) — Zeile archivieren; nicht dispatchen.
- **Was noch fehlt, bevor man es starten kann:** Für einen späteren Analyzer erst ein Owner-gewähltes Volumen-/Fragestellungskriterium und ein neuer Lane-Auftrag.
- **Nicht geprüft:** Die aktuelle Zeilenzahl von `lane-outcomes.jsonl`; sie ist für das Duplikat-Urteil nicht erforderlich.

### `63626cdb` — streichen, Konfidenz hoch
- **Warum:** Typ (a), Wissenssicherung: Alle drei bewusst zurückgestellten Audit-Reste stehen im Attic einschließlich offener Abwägungen. Der Text erklärt sich selbst zum Nicht-Auftrag. Zusätzlich ist `kind:lane` ein Datenfehler; `kind` gehört auf `note`.
- **Beleg:** `c366c66`; `docs/attic/backlog-2026-07.md:424-474`; `briefs/work-waves-2026-08-07.md:220-225`.
- **Größe:** S (<1 h) — Zeile archivieren; nicht dispatchen.
- **Was noch fehlt, bevor man es starten kann:** Bei erneutem Bedarf je Rest einen eigenen Auftrag mit Ereignisquelle, Retention-Ziel und Done-Kriterium schneiden.
- **Nicht geprüft:** Das ungetrackte `audit.jsonl` auf neue Nachfrage oder tatsächlichen Retention-Druck.

### `b8716d0e` — streichen, Konfidenz mittel
- **Warum:** Der mechanische Kern ist bestätigt, aber heute stärker gedriftet als die Notiz sagt: Seit `1e46b8b` haben sieben Commits die zwei Dokumente berührt, nicht mehr nur `d139698`. Von den damals betroffenen IDs verbleiben im eingefrorenen Batch-Satz drei (`f0a710db`, `08f44054`, `acb5839d`); alle drei Quellen nennen `@1e46b8b`, und die gepinnten Zeilen lösen exakt auf. Typ (a), Wissenssicherung: Die dauerhafte Lehre „Beleg-Verfall mechanisch melden“ steht bereits im Wert-Review; HEAD-Zeilennummern nachzuziehen wäre erneute Driftpflege ohne Wahrheitsgewinn.
- **Beleg:** `7941c3f`, `briefs/work-waves-2026-08-07.md:195-196`; die gepinnten Quellen stehen in `docs/triage/batch-A-verben.md:20-22`, `docs/triage/batch-A-verben.md:38-40` und `docs/triage/batch-A-verben.md:55-57`. Gemessen: `git log 1e46b8b..HEAD -- docs/autonomy-map-2026-08-06.md docs/autonomy-verbs-2026-08-06.md` ergibt sieben Commits.
- **Größe:** S (<1 h) — Zeile archivieren; die Pin+Abschnitt-Regel beibehalten.
- **Was noch fehlt, bevor man es starten kann:** Nichts Sinnvolles; nur ein tatsächlich nicht auflösbarer Pin oder fehlender Abschnittsanker rechtfertigt eine neue Korrekturzeile.
- **Nicht geprüft:** Die bereits geschlossenen damaligen IDs wurden nicht aus `fleet.json` rekonstruiert; geprüft wurden die im eingefrorenen Batch-Satz noch vorhandenen betroffenen Zeilen.

### `d2a0d45e` — bauen, Konfidenz hoch
- **Warum:** Verfallsbefund (1) ist direkt bestätigt: `d375c581` zitiert weiterhin `BACKLOG.md:773`, obwohl nur noch die Attic-Datei getrackt ist und B-16 dort auf Zeile 818 steht. Befund (2) ist bereits durch Weitertragen von `94565a55` nach `bbf2eea1` dokumentiert und `bbf2eea1` selbst gebaut; der heute wertvolle Schnitt ist daher nur die eine Quellenkorrektur an `d375c581`, nicht ein allgemeiner Reaper-Umbau.
- **Beleg:** `docs/triage/batch-F-wissen.md:147-149`; `c366c66` benennt/realisiert den Move, heutiger Anker `docs/attic/backlog-2026-07.md:818-823`. Für (2): `briefs/work-waves-2026-08-07.md:33-37` und `docs/attic/autonomy-map-2026-08-06.md:258-275`.
- **Kosten, wenn nicht gebaut:** Die Abgrenzung von `d375c581` gegen den Lane-Kill-Orphan-Reap bleibt für einen Prüfer an genau der Stelle unauflösbar, an der sie Scope-Dopplung ausschließen soll.
- **Größe:** S (<1 h) — Owner korrigiert genau die QUELLE in der offenen Queue-Zeile.
- **Was noch fehlt, bevor man es starten kann:** Hartes Done: `d375c581` nennt `docs/attic/backlog-2026-07.md:818 @c366c66`; der alte Pfad kommt in seinem GEPRÜFT-Block nicht mehr vor. Kein Code- oder Suite-Lauf nötig.
- **Nicht geprüft:** Der rohe aktuelle/archivierte Status von `94565a55` und `bbf2eea1`; dafür wurde die getrackte Übernahme in `briefs/work-waves-2026-08-07.md` gelesen. Die erste, weiterhin offene Zeile ist im eingefrorenen Batch direkt sichtbar.

### `efc98cfa` — streichen, Konfidenz hoch
- **Warum:** Typ (a), Wissenssicherung: Die Abhängigkeit des Groupchats von einer `[pulse-reply]`-Ernte und der gemessene ungelesene Reply stehen bereits im Steward-Brief; der Commit-Body grenzt den Groupchat ausdrücklich als spätere Idee ab. Der erste Satz sagt „kein Arbeitsauftrag“. Außerdem ist `kind:lane` ein Datenfehler; `kind` gehört auf `note`.
- **Beleg:** `c02a0d4`; `briefs/steward-kritik-2026-08-07.md:377-381` und `briefs/steward-kritik-2026-08-07.md:592`; der Owner-Create-Pfad mintet weiterhin `kind:"lane"` in `server.ts:9605`.
- **Größe:** S (<1 h) — Zeile archivieren; nicht dispatchen.
- **Was noch fehlt, bevor man es starten kann:** Falls der Owner die Idee später wieder aufnimmt: erst Reply-Ernte, Paste-Schutz und gerechnetes Kostenbudget, dann ein neuer Auftrag.
- **Nicht geprüft:** Keine aktuelle Modellkostenrechnung und kein Mehrparteien-Liveversuch.

## Kalibrierung
- Meine drei stärksten Aussagen: `d2a0d45e` (der tote Pfad und der neue Anker sind bytegenau nachprüfbar); `56be77a3` (derselbe Sicherheitsbefund steht wörtlich in Attic und `c366c66`); `b759e8d9` (Ursache und offener Status stehen im heutigen Sensor-Dokument und im branch-only Code).
- Meine schwächste Aussage (hier zuerst nachprüfen): `b8716d0e` — die Zeilendrift ist real, aber mein `streichen` beruht auf der Wertung, dass SHA-Pin plus Abschnitt den Schaden bereits vollständig neutralisieren.
- Was ich gemessen vs. nur gelesen habe: Gemessen wurden `ast-grep --version`, die Git-Historie und Diffs ab `1e46b8b`, die Auflösung der gepinnten Zeilen, die getrackte Absenz von `BACKLOG.md` und der heutige B-16-Anker auf Zeile 818. Gelesen wurden Code, Attic, Briefs und Commit-Bodies. Keine Suite, kein Ledger, kein `fleet.json`, keine API-Route.

## Batch-Ebene
- Zusammenlegungen, die ich sehe: Keine echte Gleichheit. `b8716d0e` und `d2a0d45e` sind dieselbe Befundfamilie, aber nicht dieselbe Arbeit: gepinnte Zeilendrift versus ein tatsächlich verschwundener Dateipfad.
- Reihenfolge, falls eine Zeile eine andere voraussetzt: Nur `d2a0d45e` bleibt als Aktion; die Quellenkorrektur an `d375c581` ist unabhängig. Ein späterer Groupchat setzt Reply-Ernte, Paste-Schutz und Kostenentscheid voraus, aber diese Notiz soll dafür nicht in der Queue bleiben.
- Was diesem Batch als GANZEM fehlt: Keine weitere Bauwelle, sondern eine Datenhygiene-Regel: selbstdeklarierte Notizen dürfen nicht als `kind:lane` minten, und dauerhaftes Wissen gehört einmal in Brief/Doc/Commit statt zusätzlich als nie dispatchbare Queue-Kopie zu leben.
