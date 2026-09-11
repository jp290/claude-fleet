# Übergabe Betriebs-MAIN Slot 3 — fünf Dinge, die weder aus der Program-Sicht noch aus git ableitbar sind

*Stand 2026-09-11 ~11:0x, Program `f170dc46` (Fleet-Betrieb), Slot 3, `claude-opus-5[1m]`/high.*
*Alles Übrige steht in den Land-Notes (`git notes --ref=fleet/land`), den Commit-Bodies und
`GET /api/self/program-execution` — dort nachlesen, nicht hier. Diese Notiz entstand, weil der
Advisory-Deckel des Programs eine elfte `notiz`-Zeile zu Recht verweigert (10/10 pending).*

## 1. Attention `b57b0287` ist inhaltlich erledigt, mechanisch offen

Sie verlangte den Deploy-Entscheid. Der Deploy ist gefahren (`deploys.jsonl` `c5279397`, `ok:true`,
target `092083c2`, `hitTarget:true`) und er WIRKT — das ist der belastbare Teil:

| Zeitpunkt | `GET /api/sessions` → `errors` |
|---|---|
| vor dem Deploy | `{total: 195, distinct: 2}`, davon **n=194** `inboxNudgeSend` |
| nach dem Deploy | `null` |

Das ist der Live-Beleg für den Land `5eaf0955` (die fünf unbeaufsichtigten Sender rollen ihren
eigenen Paste zurück). Die Attention-Zeile bleibt trotzdem `open`: `/api/self/attention` kennt nur
`GET` und `POST`, es gibt **keine Selbst-Schließung**, und offene Attention überlebt eine Succession
absichtlich. Also **nicht neu stellen und nicht als laufende Arbeit lesen** — nur der Owner kann sie
beantworten.

## 2. Eine Program-MAIN hat keine Tür, um ihre EIGENE Lane anzusprechen

Gemessen: `/api/self/nudge` existiert, ist aber supervisor-gated (`server.ts#supervisorRefusal`);
unter `/api/self/tasks` gibt es nur `POST`, `/release` und `/land`. Als die S3d-Lane 26 h lang
dreimal lokal `./e2e-isolated.sh` fuhr und dabei den Suite-Mutex hielt — und damit eine zweite Lane
aushungerte —, gab es keinen Weg, ihr das zu sagen; der einzige wäre der Owner-Token auf
`/api/slots/:id/send` gewesen. Gelöst hat es ihre eigene Stopp-Regel (dritter Same-Tree-Lauf grün).
Verwandt mit `18e87e67` und `c62aa3e9`, aber nicht dasselbe: hier geht es um **MAIN → eigene Lane**.

## 3. Self-Land verweigert jede Zeile ohne Program-Zuordnung — dreimal in einer Schicht bezahlt

`POST /api/self/tasks/<id>/land` antwortet 409 `a Program-MAIN lands only rows of program
f170dc46…` sowohl für eine **fremde** Programzeile (`ce37f5e5`, `db76262c` in `f9dc8e10`) als auch
für eine Zeile **ganz ohne** `programId` (`f8d9c037`: `repo:null`, `source:owner`). Alle drei gingen
über die Owner-Route. Folge für Erfolgskriterium (a) „keine Fleet-Lane ohne Program-Zuordnung mehr
in der Queue": **weiterhin offen**, mit `f8d9c037` als frischem Beleg.

## 4. Die Ledger-Spur der drei Owner-Route-Lands ist nicht gleich — und das ist Absicht

`5eaf0955` und `7627fbad` tragen `actor.suspect: "owner-token-outside-board"` mit
`bypassed {program f9dc8e10, main 10, report "undecided"}`. Die beiden Reports in Astras Program
sind **unbeurteilt**; nur deren MAIN kann das, und bis dahin schließt ihr Autoclose nicht.
`092083c2` trägt dagegen **nur** `{kind: owner, via: bearer}` ohne Flag: dort gab es keine Bindung
zu umgehen. Der Unterschied trennt „ist um jemanden herumgegangen" von „es war niemand da" — und
macht die zwei Flags dadurch aussagekräftig statt zu Rauschen.

## 5. Zwei Kleinigkeiten, die sonst als Befund neu entdeckt würden

- Mein Accept des S3d-Reports `58102e38` steht mit `reason: null` in der Zeile. Eigener Fehler
  (leerer Payload durch einen abgebrochenen Skript-Guard), und first-wins lehnt das Nachreichen ab.
  Die Begründung steckt in der Land-Note zu `7d21a841` und im Diff, nicht in der Report-Zeile.
- Das Slot-Label sagt `Program-MAIN: Fleet-Betrieb (Fable)`, während der Slot
  `claude-opus-5[1m]`/high fährt. Seit dem Owner-Entscheid 2026-09-04 („MAINs auf Opus 5, nur der
  Controller auf Fable") ist das Label falsch; die Korrektur wäre eine Owner-Route.
