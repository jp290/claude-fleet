# Verdikt F-wissen — Wissen, Docs, Hygiene und Trail

**Worker:** pi/gpt-5.6-sol  ·  **Baum:** 8767397  ·  2026-08-09
**Werkzeug-Probe:** ast-grep lief (`ast-grep 0.45.1`)  ·  rg ja

## Übersicht
| Zeile | Verdikt | Konfidenz | Größe | Einzeiler |
|---|---|---|---|---|
| `609744d8` | bauen | hoch | M | Der Installations-Quickstart und das Wissensregal ersetzen keinen Einstieg für den Menschen, der das Board betreibt. |
| `a0ea3b11` | unklar | hoch | L | Mehrere Regeln sind getrackt, aber der behauptete Zielzustand im unsichtbaren Regelbuch ist nicht prüfbar. |
| `e7d61b59` | unklar | mittel | S | Der Cache-Kontrakt ist gebaut und getestet; für die zwei kalten Reloads fehlt weiterhin die entscheidende Browser-Tatsache. |
| `d375c581` | unklar | mittel | L | Das Aufräumproblem besteht, aber die Zeile vermischt absichtlich erhaltene Fehlerartefakte mit wirklich totem Scratch und Trail-Retention. |
| `17068154` | bauen | hoch | M | Der Deckel 400 besteht: `never-failed` ignoriert weiterhin ehrlich gemeldete ausgelassene Dateien. |
| `e4f87152` | bauen | hoch | M | Neuöffnen löscht den Steward-Zeitplan weiterhin; die UI zeigt Anwesenheit, aber benennt die gefährliche Abwesenheit nicht. |

## Je Zeile

### `609744d8` — bauen, Konfidenz hoch
- **Warum:** Es fehlt weiterhin genau eine human-facing Board-Einstiegsdatei, etwa `docs/board-guide.md`: erster sinnvoller Ablauf, Owner-only Entscheide, Bedeutung der Board-Aktionen und Betriebsfallen, jeweils als Zeiger statt Regelkopie. Vorhanden sind der Installations-Quickstart (`README.md:11`), die ausführliche Feature-/Button-Referenz (`README.md:31-88`), die Wissenspflege-Landkarte (`docs/README.md:17-45`) und seit `ee15044` der interne Auftragsweg (`docs/attic/auftragsweg-2026-08-09.md:33-106`); keines davon führt den neuen Board-Bediener durch seinen ersten Arbeitszyklus.
- **Beleg:** `README.md:11`, `README.md:31-88`, `docs/README.md:17-45`, `docs/attic/auftragsweg-2026-08-09.md:33-106`, `ee15044`. `ls docs/` und `git log --oneline --since=2026-08-07 -- docs/` wurden geprüft; keine seit dem 08.08. gelandete Datei füllt diese Zielgruppenlücke.
- **Kosten, wenn nicht gebaut:** Neue Owner oder öffentliche Leser müssen Installations-, UI-, Land- und Queue-Wissen selbst zu einem Betriebsablauf zusammensetzen und können dabei Mechanik mit Doktrin verwechseln.
- **Größe:** M (eine Lane) — eine kurze Datei plus Indexzeile, bewusst unter der im Auftrag gesetzten Wiederholungsgrenze.
- **Was noch fehlt, bevor man es starten kann:** Dateiname festlegen; hartes Done aus der Zeile übernehmen und als Inhaltsprüfung ergänzen: ein vollständiger erster Board-Zyklus mit Links, sichtbares Doktrin-Gerüst, keine kopierte Regelstrecke.
- **Nicht geprüft:** Kein Live-Board und keine öffentlichen Nutzerbeobachtungen; `CLAUDE.md` wurde nicht gelesen, weil der Schnitt gerade nicht dessen Regeln wiedergeben soll.

### `a0ea3b11` — unklar, Konfidenz hoch
- **Warum:** Ein Teil der gewünschten Arbeitsweise liegt heute bereits dauerhaft und prominent vor: Done+Beweis vor Start (`AGENTS.md:19-23`), „Sonde zuerst“ (`AGENTS.md:62-76`) und Reporting (`AGENTS.md:98-103`); die Owner-Vorgabe zitieren und die Rangliste abschneiden ist laut `docs/scope-inflation.md:149-157` inzwischen sogar in `CLAUDE.md` eingetragen. Ob die übrigen Regeln noch verstreut sind oder seitdem schon als benannter oberer Abschnitt zusammengezogen wurden, entscheidet aber allein der aktuelle Inhalt des Zielartefakts.
- **Beleg:** `AGENTS.md:19-23`, `AGENTS.md:62-76`, `AGENTS.md:98-103`, `docs/scope-inflation.md:149-157`; `.gitignore:32` und `docs/ungoverned-artifacts.md:11-19` belegen, dass das Ziel ungetrackt und nur kopiert ist. Braucht `CLAUDE.md`, die eine Lane nicht sieht.
- **Größe:** L (mehrere Lanes / erst Entscheidung) — nicht wegen der Textmenge, sondern weil eine Lane nur Berichtstext liefern kann und der Haupt-Checkout ihn manuell übernehmen und auf Duplikate prüfen muss.
- **Was noch fehlt, bevor man es starten kann:** Der Host muss den aktuellen Abschnittsaufbau und alle Alt-Fundstellen in `CLAUDE.md` inventarisieren; erst diese Diff-Liste zeigt, ob noch Arbeit besteht und liefert das Löschkriterium „verschoben, nicht kopiert“.
- **Nicht geprüft:** `CLAUDE.md` selbst sowie seine ungetrackte Haupt-Checkout-Version; deshalb kein Urteil über Vollständigkeit, Reihenfolge oder Dubletten.

### `e7d61b59` — unklar, Konfidenz mittel
- **Warum:** Der heutige Baum hält den beabsichtigten Cache-Kontrakt klar: versioniertes `app.js` ist immutable, eine falsche Version ist `no-store`, und `index.html` bleibt `no-store` (`server.ts:9500-9554`, `e2e/transport.ts:41-83`). `0fa9d2f` maß den zweiten Load im echten Browser mit 0 B; `0db08ac` schrieb gleichzeitig den späteren Befund „beide Reloads kalt“ nur als offenen Nebenbefund fort. Das erklärt den Widerspruch nicht: Hard-Reload, deaktivierter Browsercache, Profil oder Deploy-Nähe sind im erhaltenen Messbericht nicht getrennt.
- **Beleg:** `0fa9d2f`, `0db08ac`, `server.ts:9500-9554`, `e2e/transport.ts:41-83`, `briefs/data-saver-messung-2026-08-07.md:129-138`, `docs/data-saver.md:75-82`.
- **Größe:** S (<1 h) — falls die historische Reload-Art noch feststellbar ist; andernfalls braucht es statt Archäologie einen neuen kontrollierten Browser-Doppelversuch.
- **Was noch fehlt, bevor man es starten kann:** Ein baubares Done-Kriterium: erst „normal reload vs. hard reload/cache disabled“ mit Transferquelle und unveränderter Bundle-Version messen; nur bei einem normalen kalten Zweitload eine neue Fix-Zeile schneiden. Die historische Tatsache hätte der damalige Browser/Operator aus Session 39.
- **Nicht geprüft:** Kein Browserlauf, keine DevTools-Historie und kein damaliges Profil; die zwei kalten Requests wurden aus dem Bericht gelesen, nicht reproduziert.

### `d375c581` — unklar, Konfidenz mittel
- **Warum:** Der Sachkern ist nicht erledigt: `state.sh` sagt weiterhin „nothing reaps these“ und zählt TMPDIR-Instanzen (`state.sh:179-182`), während der Trail ausdrücklich unbegrenzt und unverwaltet bleibt (`docs/e2e-trail.md:73-75`, `docs/e2e-trail.md:183-184`). Aber ein fehlgeschlagener Wrapper bewahrt seine Instanz heute absichtlich zur Inspektion auf (`e2e-isolated.sh:467`, ebenso die anderen Wrapper); „älter als 24 h und kein Prozess-cwd“ beweist daher nicht „tot“. Außerdem räumt der normale Graphpfad seine Verzeichnisse bereits im `finally` auf (`server.ts:9201-9205`), sodass nur Abbruchreste gemeint sein können, und Trail-Retention braucht eine eigene Owner-Policy.
- **Beleg:** `state.sh:179-182`, `e2e-isolated.sh:467`, `server.ts:8972-8975`, `server.ts:9201-9205`, `docs/e2e-trail.md:73-75`, `docs/e2e-trail.md:183-184`. Der in der Zeile zitierte `BACKLOG.md:773`-Beleg ist tot; Batch G bestätigt das in `docs/triage/verdict-G-notizen.md:101-108`, der heutige B-16-Anker ist `docs/attic/backlog-2026-07.md:818-823`.
- **Größe:** L (mehrere Lanes / erst Entscheidung) — nach einer Owner-Entscheidung in mindestens zwei Scheiben: Scratch-/Graph-Hygiene und Trail-Retention.
- **Was noch fehlt, bevor man es starten kann:** Retention für absichtlich konservierte rote Instanzen, Kandidatenidentität jenseits eines Namens/Alters, Dry-run und Verify-Weg festlegen; Trail-N und „rote Läufe behalten“ separat entscheiden. Vor Dispatch außerdem die tote Quelle über `d2a0d45e` korrigieren.
- **Nicht geprüft:** Kein geteilter `$TMPDIR`, keine Live-Prozesse und keine heutigen MB-/Dateizahlen; die historischen 39/2,4/56 MB wurden nicht nachgemessen.

### `17068154` — bauen, Konfidenz hoch
- **Warum:** Der harte Deckel ist am HEAD bestätigt: Kandidaten werden newest-first sortiert und auf `TRAIL_MAX_FILES = 400` geschnitten; `filesOmitted` meldet nur die Differenz (`server.ts:11496-11541`). `trailStats` kennt diese Auslassung nicht und emittiert bei null Fails weiterhin `never-failed` (`trailstats.ts:258-272`); der vorhandene Test beweist nur den vollständig gelesenen Ein-Run-Fall (`e2e/trailstats.ts:140-149`). Damit ist der Mechanismus hinter den historischen 741 von 1141 Dateien unverändert, auch wenn diese Bestandszahl ohne Trail-Dateien nicht neu gezählt werden konnte.
- **Beleg:** `832bb68`, `server.ts:11496-11541`, `trailstats.ts:258-272`, `e2e/trailstats.ts:140-149`, `docs/e2e-trail.md:175-184`. `git log -G 'TRAIL_MAX_FILES|filesOmitted|never-failed'` zeigt seit `832bb68` keinen nachfolgenden Fix.
- **Kosten, wenn nicht gebaut:** Eine Lane kann bei jedem Check, dessen frühere Fails hinter dem Deckel liegen, weiterhin eine positive und falsche Unbedenklichkeitsaussage erhalten und ihren Regressverdacht in die falsche Richtung lenken.
- **Größe:** M (eine Lane) — minimaler Schnitt (a): bei `filesOmitted > 0` niemals `never-failed`, plus Gegenprobe auf der Route; ein parametrisierbarer größerer Read ist nicht nötig.
- **Was noch fehlt, bevor man es starten kann:** Verdict für den gedeckelten Null-Fail-Fall benennen (naheliegend vorhandenes `insufficient-evidence`) und hart testen: omitted=0 darf `never-failed`, omitted>0 darf es nie; `filesOmitted` bleibt sichtbar.
- **Nicht geprüft:** Keine echte Trail-Population und keine Route; 741/1141 sowie 9 historische Fails wurden aus der Queue-Zeile gelesen, nicht am gitignored Ledger nachgezählt.

### `e4f87152` — bauen, Konfidenz hoch
- **Warum:** Die Ursache besteht am HEAD wortgleich: Öffnen und Killen entfernen alle Autos des Slots (`server.ts:3046`, `server.ts:3099`). Der Owner-Poll liefert zwar die Auto-Liste (`server.ts:12469-12477`) und die UI malt bei Anwesenheit seit `3c81347` ein generisches ⏱ (`src/client.ts:4759-4763`), doch die Abwesenheit eines erwarteten Steward-Pulses bekommt weder einen Zustand noch Text. Weg (a) aus der Zeile bleibt damit die enge, verhaltensneutrale Verbesserung; automatische Wiederanlage/Kadenz bleibt ausdrücklich außen vor.
- **Beleg:** `server.ts:3046`, `server.ts:3099`, `server.ts:12469-12477`, `src/client.ts:4759-4763`, `3c81347`. Die seit 2026-08-07 gelandeten Bodies in `git log -- server.ts docs/data-saver.md`, einschließlich `94b1362`, bewegen Zustellung und Readiness, ändern aber diese Schedule-Lebensdauer nicht.
- **Kosten, wenn nicht gebaut:** Nach jedem legitimen Neuöffnen kann der Steward ohne stündlichen Rundgang weiter sichtbar existieren, während der Owner die fehlende Automation nur durch Öffnen/Interpretieren der Auto-Liste bemerkt.
- **Größe:** M (eine Lane) — abgeleiteter Status im Poll, eine negative Steward-Anzeige und zwei Gegenproben in der bestehenden Steward-Familie.
- **Was noch fehlt, bevor man es starten kann:** Semantik eng festlegen: „Puls“ bedeutet ein enabled recurring Auto auf dem aktuellen Steward-Slot; Done: ohne passendes Auto explizit „kein Puls“, mit passendem Auto nächste Fälligkeit. Keine Default-Kadenz und kein Auto-Minting.
- **Nicht geprüft:** Historische `server.log`-/Audit-Zeilen und heutiger Live-Steward, weil die operativen Ledger und `fleet.json` in der Lane fehlen; geprüft wurde die aktuelle Mechanik, nicht der damalige Fünffachlauf.

## Kalibrierung
- Meine drei stärksten Aussagen: `17068154` (Deckel, Auslassungsfeld und Verdict-Ableitung sind direkt am HEAD verbunden); `e4f87152` (beide Löschstellen und die nur-positive UI sind unverändert); `609744d8` (Docs-Inventar und Historie zeigen konkret die weiterhin fehlende Leser-/Ablaufklasse).
- Meine schwächste Aussage (hier zuerst nachprüfen): `e7d61b59` — die mechanische Cache-Seite ist stark belegt, aber ob die historische Reload-Art noch außerhalb des getrackten Berichts rekonstruierbar ist, weiß nur der damalige Browser/Operator.
- Was ich gemessen vs. nur gelesen habe: Gemessen wurden `ast-grep 0.45.1`, Docs-Inventar und Docs-Historie, aktuelle Suchtreffer/Codepfade sowie die relevanten `git log -G`-/Commit-Bodies. Gelesen wurden Batch, fertiges Verdikt G, Docs, Tests und Codebereiche. Keine Suite, keine API, kein Browser, kein Ledger, kein `fleet.json` und kein Maschinen-TMPDIR.

## Batch-Ebene
- Zusammenlegungen, die ich sehe: Keine echte Gleichheit innerhalb des Batches. `17068154` und der Trail-Teil von `d375c581` betreffen dieselbe wachsende Population, aber Korrektheit des Verdicts und Retention sind verschiedene Arbeiten. Batch-übergreifend muss `d2a0d45e` aus G zuerst nur den toten Quellenverweis in `d375c581` korrigieren; das ersetzt das Hygiene-Urteil nicht.
- Reihenfolge, falls eine Zeile eine andere voraussetzt: `d2a0d45e` → korrigierte Reaper-Zeile; `17068154` vor jeder Trail-Retention, damit der Leser schon vor einer Bestandsänderung ehrlich ist. `609744d8` und `a0ea3b11` dürfen wegen ihrer verschiedenen Leser nicht zusammengelegt werden.
- Was diesem Batch als GANZEM fehlt: Bei Wissen ein hostseitiger Blick auf das ungetrackte Regelbuch; bei Hygiene explizite Retention statt „alt = tot“; beim Trail ein Test, der nicht nur gelesene Zeilen, sondern auch bewusst ausgelassene Dateien in die Verdict-Semantik einspeist.
