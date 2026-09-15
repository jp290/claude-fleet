---
frage: Warum sah am 2026-09-15 niemand, dass die claude-fleet-Queue ~3,5 h stand, obwohl alle Fakten auf Platte lagen — und was an unserer Arbeitsweise hätte es früher sichtbar gemacht?
urteil: Jede Blockade war ein Warten ohne Adressat. Unsere Sensoren und Gewohnheiten fragen „was ist fertig, was ist rot?", keine fragt „wer wartet worauf, seit wann, und kann das enden?". Vier Mechanik-Zeilen gefilt, zwei Arbeitsregeln als Vorschlag an den Owner.
bereich: [queue, start-plan, dispatch, orchestrierung, arbeitsweise]
belege: [audit.jsonl (criterion_proposed, task_release, slot_kill, fleet_report_decision_delivered je b28b9d89), server.ts /api/self/criterion-Handler, server.ts#answerAttentionsForCriterion, server.ts#tickDispatch (dispatchTask mit clarify=false), server.ts /send (loescht awaiting "owner"), server.ts#capTasks, start-plan.ts#projectStartPlan (after-Zweig), Report der Lane 939ccb6f]
nicht-gemessen: Wie e3e5084a genau aus tasks verschwand (Zeile 249f8d06 belegt es zuerst); wie oft die Klasse vor dem 14.09. auftrat; ob ein Stau-Sensor mit 15 min zu laut wird.
stand: 2026-09-15
---

# Warten ohne Adressat, 2026-09-15

Orchestratorin Slot 7, nach der Stau-Diagnose der Vorgaengerin
(`2026-09-15-queue-stau-und-orchestrierungs-entscheide.md`). Jene Notiz erklaert, WIE eine Lane die
Queue blockiert. Diese fragt, warum sich der Blocker nicht bewegte und warum es niemand sah.

## 1. Was geschah (audit.jsonl, Task b28b9d89, Ortszeit)

| Zeit | Ereignis |
|---|---|
| 11:43 | `task_release by=policy card-valid`, Lane startet (Text: CLARIFY FIRST; Dispatch mit clarify=false) |
| 11:46 | `criterion_proposed`; Report `needs-main` an die Program-MAIN |
| 11:51 | MAIN nimmt den Report an (`accepted`) — bestaetigen darf nur der Owner |
| 12:11 | Autoclose schliesst die Lane (`slot_kill owner`), Policy startet die Zeile neu |
| 12:13 / 13:01 / 13:04 | dasselbe noch einmal, jedes Mal ein neues, anders formuliertes Kriterium |
| 15:21 | `criterion_confirmed`, nachdem die Orchestratorin den Owner fragte |

Parallel: `d3765352` wartet per `after` auf `e3e5084a`, die keine Queue-Zeile mehr ist, und haelt ueber
Claims fuenf freigegebene Zeilen (Befund der Lane `939ccb6f`). Am Vortag 22:50–00:0x dieselbe Klasse,
gemessen und als `2d3cc525` („KLEIN") in die normale Queue gefilt — wo sie heute selbst hinter dem Stau
stand.

## 2. Das Muster

Vier Wartezustaende, keiner mit erreichbarem Adressat:

- Kriterium wartet auf den Owner → der Hinweis ging an die MAIN, eine Attention entstand nie.
- `after` wartet auf eine Zeile → die Zeile existiert nicht mehr, der Plan liest das als „nicht fertig".
- Kollisionen warten auf eine Lane → die Lane wartete selbst.
- Die Reparatur wartet in der Queue → hinter dem Stau, den sie repariert.

Unsere Rueckkanaele sind erfolgsfoermig: ein Watch feuert auf `done-looking`, ein Audit auf rot. Fuer
„nichts bewegt sich" gibt es nur den Autoclose, und der hat geschlossen statt gemeldet.

## 3. Was die Arbeitsweise gesehen haette (gerankt nach heute gesparten Stunden)

1. **Zweites Auftreten eines Durchsatz-Blockers = sofortige Reparatur ausserhalb der Queue** (~3,5 h).
   Die Owner-Regel „zweimal gleiches Audit-Rot = sofort reparieren" deckt nur Audits. 00:0x war das
   erste, 11:43 das zweite Auftreten.
2. **Eine Stau-Diagnose ist erst fertig, wenn jeder Wurzel-Blocker von seiner eigenen Seite gelesen ist**
   — Pane, Task-Record, Audit-Folge. Die Diagnose um 14:1x las Slot 1 als „frisch gebrancht, ohne
   Commit", also arbeitend; die Frage „warum bewegt er sich nicht?" fehlte (~1 h).
3. **Kein Warten ohne Adressat** — wer ein Warten schreibt, nennt einen existierenden Empfaenger, der
   davon erfaehrt. Mechanisch: Zeilen `898ad990`, `249f8d06`.
4. **„Angenommen" heisst fuer den Autoclose „beurteilt, darf schliessen"**, fuer die MAIN „gelesen".
   Wer eine Frage annimmt, die nur der Owner beantworten kann, leitet sie weiter; die Annahme sollte die
   Lane-Zahl der Task zeigen (dreimal an einem Tag ist eine Schleife). Mechanisch teilweise: `e0160347`.
5. **Die Uebernahme liest nur Fleet-foermige Arbeit.** Slot 16 (Private-repo-aa, Astra, `cwd ~`, seit
   2026-09-08, kein Program) war fuer `register.sh`/`state.sh` unsichtbar; dort lagen drei Widersprueche
   zum neuen Owner-Ziel. Kandidat: eine `state.sh`-Zeile „Slots ohne Repo und Program, Alter".

## 4. Gefilt (Program Fleet-Betrieb, alle vom Owner freigegeben)

| Zeile | Schnitt | Stand |
|---|---|---|
| `898ad990` | Kriterium ablegen → genau eine Owner-Attention je Task | per Hand gestartet |
| `e0160347` | Autoclose lehnt eine Lane mit offenem Kriterium ab | per Hand gestartet |
| `7bcabbfd` | Startplan: offenes Kriterium haelt keine Flaeche (ersetzt `2d3cc525`, Bedingung am Kriterium statt an awaiting) | nach `939ccb6f` |
| `249f8d06` | capTasks behaelt after-Ziele; ein fehlendes Ziel ist als `missing` sichtbar | nach `939ccb6f` |
| `80f61ed8` | Stau-Sensor: freigegeben, 0 now, Deckel frei, 15 min → eine Attention mit Wurzel-Blockern | nach `939ccb6f` |

## 5. Vorschlag an den Owner (propose, nicht promotet)

- **Regel 1:** Tritt ein Blocker, der freigegebene Arbeit anhaelt, ein zweites Mal auf, startet die
  Orchestratorin seine Reparaturzeile sofort per Hand ueber Deckel und Kollision, ohne vorheriges Urteil.
- **Regel 2:** Eine Stau-Diagnose nennt fuer jeden Wurzel-Blocker, worauf er wartet, wer ihn freigeben
  kann und ob der das weiss — gelesen an Pane, Task-Record und Audit-Folge, nicht aus der Kollisionsrechnung.
