---
frage: Warum starten 17 freigegebene Zeilen nicht, obwohl der Repo-Deckel 3 Lanes erlaubt und 1 laeuft — und was hat der Owner am 2026-09-15 zu Routing, Verhaertungen und Tests entschieden?
urteil: Der Startplan serialisiert die ganze claude-fleet-Queue hinter EINE laufende Lane — Ganz-Datei-Kollision auf drei Hub-Dateien, deren Zeilen fast nie Ranges tragen, plus transitive Claims der wartenden Zeilen. Effektiver Deckel 1 statt 3. Dazu fuenf Owner-Entscheide (Abschnitt 3).
bereich: [queue, start-plan, dispatch, routing, orchestrierung]
belege: [start-plan.ts#projectStartPlan, start-plan.ts#collision, start-plan.ts#rangesOn, task-land-waves.ts#rangesCollide, server.ts#DISPATCH_CONTEXT_TRIGGERS, GET /api/start-plan (Owner-Poll)]
nicht-gemessen: Wie lange der Stau schon besteht (kein Zeitverlauf des Startplans); ob tickDispatch exakt dem Plan folgt (nur der Plan gelesen); Anteil der Kollisionen, die bei echten Ranges verschwaenden.
stand: 2026-09-15
---

# Queue-Stau und Orchestrierungs-Entscheide, 2026-09-15

Gemessen von der Orchestratorin (Slot 5) gegen `GET /api/start-plan` und die offene Queue, Stand main
`7e7491ad`, 2026-09-15 ~14:1x. Diagnose, kein Fix.

## 1. Der Stau

Repo claude-fleet: Deckel 3 (Quelle `repo`), 1 laufende Lane (Slot 1, Task `b28b9d89`, frisch
gebrancht, noch ohne eigenen Commit). Der Plan hat 53 Wellen:

| `next` | Wellen |
|---|---:|
| `unreleased` | 36 |
| `collides` (freigegeben) | 16 |
| `after` (freigegeben) | 1 |
| `now` | **0** |

Die 17 freigegebenen Wellen warten ALLE auf Slot 1 — zehn direkt, sechs transitiv ueber die zwei
vorderen Zeilen `220d9dcd` und `d3765352` (die selbst auf Slot 1 warten), eine per `after`:

- direkt: `220d9dcd` (server/types.ts) · `d3765352` (docs/self-api.md) · `0bcfee35` · `5aeaa29d` ·
  `a0474870` (server.ts) · `640a74c9` · `fcff67db` (server/types.ts) · `de1d8d77` · `a1610fd7` ·
  `86d13f8d` (docs/self-api.md)
- transitiv: `b4ea42c8` · `f58d0112` (e2e/programs.ts via d3765352) · `ffcfec48` · `2b06e849` ·
  `e0160347` (server.ts via d3765352) · `2d3cc525` (e2e/tasks.ts via 220d9dcd)
- `after`: `4b02bd09` wartet auf `a1610fd7`

## 2. Warum — drei Mechanismen, die sich multiplizieren

**(a) Ganz-Datei-Rueckfall.** `start-plan.ts#collision` nutzt `task-land-waves.ts#rangesCollide`:
fehlt auf EINER Seite ein Range fuer die gemeinsame Datei, kollidiert die ganze Datei. Eine laufende
Lane ersetzt das nur mit echten Hunks auf Dateien, die sie schon geaendert hat (`rangesOn`, seit
`6e818eaa`); eine frische Lane hat keine. Slot 1 traegt Ranges nur fuer `server.ts` (10771–10781) und
`context-plan.ts`, nicht fuer `server/types.ts` und `docs/self-api.md`.

**(b) Hub-Dateien ohne Ranges.** In den 53 offenen Auftraegen:

| Datei | Zeilen nennen sie | davon mit Range |
|---|---:|---:|
| server.ts | 31 | 18 |
| server/types.ts | 10 | 5 |
| e2e/tasks.ts | 9 | 0 |
| docs/self-api.md | 7 | 0 |
| e2e/programs.ts | 6 | 0 |
| e2e/pins.ts | 4 | 0 |

Test- und Doku-Dateien bekommen strukturell keine Ranges: neue Checks und neue Doku-Abschnitte haben
kein bestehendes Symbol, auf das die Karte zeigen koennte. Genau diese Dateien nennt aber fast jede
Code-Zeile, weil der Vertrag Doku und Proben mitverlangt.

**(c) Transitive Claims.** `start-plan.ts#projectStartPlan` laesst jede freigegebene Welle, die in der
Schlange steht (`collides`, `cap`, `after`), ihre Dateien gegen alle SPAETEREN Wellen beanspruchen
(`claims`). Das verhindert, dass eine spaetere Zeile einer frueheren zuvorkommt — und macht aus einer
blockierten Zeile vorne eine Sperre fuer alles dahinter. Eine Lane auf einer Hub-Datei haelt so die
ganze Kette.

Produkt: ein Deckel von 3 wirkt als 1. Die Sicherungen sind einzeln begruendet (Unbekannt ist nie
frei; keine Zeile ueberholt eine fruehere); ihr Zusammenspiel hat niemand als Deckel entschieden —
dieselbe Klasse, die `start-plan.ts` im Kommentar zu Schnitt 2 schon einmal beschreibt.

## 3. Owner-Entscheide 2026-09-15 (Gespraech mit der Orchestratorin)

1. **Qualitaetsmass:** `fix3d` misst Churn, nicht Qualitaet; der Satz „jeder vierte Code-Land braucht
   einen Fix" ist zurueckgenommen. Kandidat fuer ein ehrliches Mass: Lands ohne Owner-Intervention
   (`ownerPrompts`) und ohne `real`-Audit oder Undo (Ledger: 15 real-Audits, 143 Lands mit
   ownerPrompts>0 von 575, 30 rote Audits unbeurteilt).
2. **Routing ist eine Tabelle, keine Server-Logik.** Arbeitsarten, erkennbar an der Karte: bauen ·
   denken+bauen (DONE fest, Weg offen; Entscheidung vor dem ersten Code-Commit festhalten) · klaeren ·
   messen/sichten · urteilen/gegenlesen (andere Modellfamilie als der Autor) · denken. Aufnahmetest
   fuer jede weitere Zeile: aendert sie Harness, Modell, Effort, Kontextbedarf oder Pruefweg, und ist
   sie an der Karte erkennbar? Faehigkeiten (vision/browser) sind eine Spalte, keine Zeile. Harness-
   Fragen werden aus dem Harness heraus geprobt; das Modell ist eine zweite Entscheidung (Sol medium
   haette die Codex-Adapter-Frage getragen, gewaehlt war Astra high). Jede Zeile traegt kuenftig den
   Grund ihrer Modellwahl. Phasenwechsel (z. B. Sonnet in der Pruefphase) erst nach Messung ueber
   `lane-context-cost.ts`; einziger Haken dann `POST /api/self/verify-intent`. Gehoert in `21ade485`.
3. **Verhaertungen mit Mass:** ein Mechanismus stellt Fakten fest, urteilt nicht; entsteht aus einer
   Klasse (zweiter Fall), sitzt an der Grenze, wo der Fakt entsteht; Haerte passt zum Schadensradius;
   hat Name, Tuer, Rueckweg, Zaehler; und muss in seinem Ledger je etwas verhindert haben. Ein Pin nur
   auf einen Fakt, den Code liefert.
4. **Keine Screenshot-Beweise nach Client-Lands** (der Client ist nie gebrochen, unnoetige Tokens).
   Stattdessen als Richtung: eine getrennte **dev/test-Instanz** von Claude Fleet, die bei Bedarf an
   den Owner geht, spaeter fuer komplexere UI/Apps und evtl. A/B-Tests mit KPIs.
5. **Modell dieser Orchestratorin:** vom Owner selbst per `/model` gestellt (Fable, danach zurueck auf
   Opus). Die Modellpolitik-Zeile im Regelbuch (Fable orchestriert) bleibt bis zu einem ausdruecklichen
   Owner-Satz unveraendert.

## 4. Offene Faeden fuer die naechste Orchestratorin

- Stau-Fix als eine Denk+Bau-Zeile (gefilt, siehe Commit-Body).
- `21ade485` mit Abschnitt 3.2/3.3 schaerfen.
- Klein und schon besprochen: `./ctl.sh audit <sha>` ueber die vorhandene Artefakt-Route; drei
  unstrittige Regelbuch-Korrekturen (Deploy-Einstieg, Rueckweg-Absaetze, Doppelsatz) nach
  `docs/messungen/2026-09-15-zweitmeinung-audit-detail-und-regelbuch-praesens.md`.
- Duplikat: `0d3a5b76` (MAIN, gehalten) und `f58d0112` (Orchestratorin) sind derselbe Sonden-Fix —
  eine davon archivieren.
- Owner-Fragen offen: Qualitaetsspalte bauen und 30 rote Audits nachbeurteilen? „Fehlende Audit-Zeile =
  laeuft noch" korrigieren (Regelbuch + `e2e/pins.ts` + Land-Log)?
