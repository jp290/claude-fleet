---
frage: Welche Felder einer Queue-Zeile tragen die Aggregate (land-quality, start-plan, register, Karten-Validator), was kostet ihr Fehlen heute, und welche hoechstens drei Schnitte machen die Aggregate sauber, ohne neue Pflichtfelder?
urteil: Von den fuenf Befunden des Briefs ist nur einer ein Fuellproblem der Zeile. Modell (1) ist seit a7a738c9 behoben und liest nie die Karte. Groesse (2) ist zu 63 von 255 Nullen ein Join-Loch in land-quality.ts, das tasks-archive.jsonl nicht liest, und 151 weitere sind unwiederbringlich. Program (3) steht heute auf 1 von 21 offenen Auftraegen. Der tote Kanal (e) lebt (194 signierte Urteile, 191 davon offen). Der teuerste stille Befund: Kommentare auf Auftragszeilen erreichen ihre Lane nie.
bereich: [queue, aggregate, datenlayer]
belege: [server/types.ts#Task, server/types.ts#TaskComment, land-quality.ts#main, start-plan.ts#startPlanChecks, start-plan.ts#releaseVerdict, task-land-waves.ts#landWaveUnits, register.sh, card-extract.ts#validateCard, server.ts#resolvedModel, server.ts#applyLandToNotes, server.ts#releaseTaskForMain, server.ts#createTaskForMain, server.ts#authorCardFrom, wave-brief.ts#renderCardHead, fleet.json, tasks-archive.jsonl, lane-outcomes.jsonl, audit.jsonl]
nicht-gemessen: server.ts-Verbraucher der Felder ref, refine, criterion, filesProposal, cluster, review ausserhalb der vier Aggregat-Dateien (nur benannt, nicht verfolgt); Latenz zwischen POST /api/tasks und dem ersten Karten-Tick; wer die 79 unsignierten Kommentare tatsaechlich schrieb (nur Textmuster gezaehlt)
stand: 2026-09-18
---

# Welche Felder einer Queue-Zeile die Aggregate tragen, und was ihr Fehlen kostet

Lane `fleet/260918101809-dd65`, Baum `b2d92216`, lebende Daten aus `/Users/owner/claude-fleet`
(nur gelesen) am 2026-09-18 ~12:20 Ortszeit. Der Brief nennt die Messung „2026-09-17"; alle Zahlen
unten sind heute neu gezaehlt, keine ist aus dem Brief uebernommen.

**Soll diese Abstraktion existieren?** Die Frage „welches Feld braucht welcher Leser" ja: die
Aggregate lesen heute Felder, deren Absenz sie still als Default buchen. Eine Pflichtfeld-Schicht
nein: vier der fuenf Briefbefunde verschwinden beim Nachmessen oder liegen beim Leser, nicht beim
Filer (§2).

Owner-Vorgabe woertlich (Brief): *„maximal sinnvolle Informationen mit angeben, so dass die
Aggregierungs-Prozesse sauber arbeiten"*. Die Rangliste in §3 schneidet dort ab, wo ein Aggregat
sauber rechnet.

## 1. (a) Jedes Feld von `Task` und `TaskComment`, sein Leser, seine Absenz

Abgeleitet aus dem Code, nicht aus `docs/self-api.md`. Leser-Kuerzel:
**LQ** `land-quality.ts#main` · **SP** `start-plan.ts` (CLI-Schleife + `#startPlanChecks`/`#releaseVerdict`)
· **LW** `task-land-waves.ts` (Wellenprojektion, Eingabe von SP) · **REG** `register.sh` ·
**CE** `card-extract.ts#validateCard`. Server-Symbole nur, wo gelesen. „Praesenz" = nicht-leer in
`fleet.json`, 200 Zeilen.

| Feld | Praesenz | Aggregat-Leser (Symbol) | Absenz bewirkt | Absenz sichtbar? |
|---|---|---|---|---|
| `id` | 200 | alle | — (Pflicht bei Geburt) | — |
| `originId` | 200 | LQ (Size-Join-Fallback ueber Outcome `originId`) | Join nur ueber `taskId` | still |
| `programId` | 181 | LW (`reasonAgainst: "kein-program"`), SP (Programm-Deckel, Policy), `server.ts#releaseTaskForMain` | keine MAIN kann freigeben; Policy faellt auf `manual` | **sichtbar** (`kein-program` im Start-Plan) |
| `text` | 200 | CE (Quelltext, `sizeNamedIn`), SP (`scout`), REG | — | — |
| `source` | 200 | SP (`filedBy` → HARD in `releaseVerdict`), REG (`src`) | — (Pflicht) | — |
| `kind` | 200 | SP/LW (nur `auftrag` wird Zeile), REG | Load-Default je Quelle (`loadTaskKind`) | still |
| `repo` | 86 | LW (Projektions-Repo) | `null` = `FLEET_DISPATCH_REPO` — definierte Bedeutung | kein Verlust |
| `spawn` | 71 | kein Aggregat; Dispatch (`taskSpawnOf`) | `DEFAULT_SPAWN`; das Outcome-Modell kommt vom **Slot** (`server.ts#resolvedModel`) | seit a7a738c9 als `modelOrigin: "default"` sichtbar |
| `variants`/`variantOf`/`variantIndex`/`variantDecision` | 1/2/2/1 | SP, LW (Gruppe nie Welle, Kollision in der Gruppe frei) | keine Variante — definierte Bedeutung | kein Verlust |
| `files` / `filesOrigin` | 96/96 | LW, SP (ueber `meta.tasks[].files`), REG (`surface`, Tag) | Flaeche UNBEKANNT, keine Kollisionskante (`start-plan.ts#collision`) | **sichtbar** (`flaeche-nur-abgeleitet` 9 Wellen, REG `blind`) |
| `filesProposal` | 0 | kein Aggregat | — | — |
| `cluster` | nicht persistiert | REG (Anzeige) | Zeile ohne Cluster | still, folgenlos |
| `surface` | 188 | SP/LW ueber Metadaten | wird neu berechnet (Cache) | kein Verlust |
| `card` | 133 | SP (`#startPlanChecks`: done, verify, size, gaps, surface), LW (size, after, creates), LQ (`card.size`), REG (`card.surface.files`) | `cardValid: null`, HARD „no card yet" unter `card-valid` | **sichtbar** im Start-Plan |
| `card.size` | s. §2.2 | LW (`#landWaveUnits`: Default `mittel`), SP (Hinweis), LQ (Groessen-Dimension) | Welle wiegt `mittel`; LQ bucht `null` | SP: Hinweis; **LQ: still** |
| `card.rolle` | — | niemand (Karte ist Lesung, `rolle` ≠ `spawn`, `card-extract.ts#cardAdvisoryGap`) | nichts | Gap sichtbar, folgenlos |
| `card.verify` / `card.done` | — | SP HARD (`#releaseVerdict`) | Zeile startet nicht unter `card-valid` | sichtbar, aber erst im Start-Plan (§2.4) |
| `status` | 200 | alle | — | — |
| `disposition` | 29 | REG `--archived` (`grund`) | Archiv ohne Grund, `—` | sichtbar in REG |
| `hold` | 31 | SP (`held` → nie gestartet) | kein Halt | — |
| `releasedBy` | 113 | Outcome-Zeile vom **Slot** gestempelt, nicht vom Task gelesen | „nie freigegeben oder vor dem Feld" | still (Doku sagt so) |
| `created` | 200 | LW (Reihenfolge) | — | — |
| `slot` | 83 | SP (Lane ↔ Zeile, `criterionOf`) | nicht versandt | — |
| `note` | 146 | kein Aggregat | — | — |
| `criterion` | — | SP (`#startPlanLaneClaims`), REG (`crit`) | Lane beansprucht Flaeche voll | sichtbar in REG (`-`) |
| `ref` | — | kein Aggregat hier (Steward-Dedup im Server) | — | nicht vermessen |
| `refine` | — | kein Aggregat | — | nicht vermessen |
| `brief` | 19 | SP (`briefAt` → `cardStale`), REG (`bage`, `edited`) | Rohtext ist der Brief; `cardStale` nie wahr | sichtbar in REG (`raw-request`) |
| `touched` | 20 | kein Aggregat; `server.ts#applyLandToNotes` schreibt | „nichts aufgezeichnet" | still, gewollt |
| `notes` | 1 | kein Aggregat; Lane-Brief ueber `task-notes.ts` | nur Flaechen-Join | still |
| `verdicts` | 5 (6 Eintraege, alle `offen`) | `server.ts#applyLandToNotes` (settled-Stempel) | Legacy-Tuer entscheidet | still |
| `review` | — | kein Aggregat | kein Review | — |
| `comments` | 59 Zeilen, 273 Eintraege | Poll zaehlt nur `n`/`at` (`server.ts` Task-Poll-Projektion); `GET /api/self/notes` liefert sie **nur fuer `notiz`-Zeilen**; `#applyLandToNotes` liest `from`+`verdict` | s. unten | s. unten |
| **TaskComment** `id`, `ts`, `text` | 273 | Anzeige | — | — |
| `TaskComment.from` | 194 signiert, 79 nicht | `#applyLandToNotes` (letztes Wort je Branch) | „unsigniert = Owner" (types.ts) — **67 der 79 unsignierten nennen in den ersten 120 Zeichen eine Session-Rolle** (Orchestrator/MAIN/Slot/Fable/…) | **still, und falsch attribuiert** |
| `TaskComment.verdict` | 194 (`offen` 191, `erledigt` 2, `widerlegt` 1) | `#applyLandToNotes`: nur `erledigt` schliesst | kein Urteil | s. §5 |

Kein Leser in den vier Aggregat-Dateien liest `comments` (`git grep -n comments -- land-quality.ts
start-plan.ts register.sh card-extract.ts task-land-waves.ts wave-brief.ts` liefert nur einen
Kommentar-Wortlaut in start-plan.ts:358). **Der Lane-Kopf (`wave-brief.ts#renderCardHead`,
`#withCardHead`) enthaelt keine Kommentare.** Damit erreichen die 55 Kommentare auf 32
Auftragszeilen (7 davon `pending`) ihre Lane nie — und `server.ts` (Brief-Tuer der MAIN, grep
„put the sharpening on the row as a comment instead") schickt eine MAIN mit ihrer Schaerfung genau
dorthin.

## 2. (b) Die messbaren Absenzen am lebenden Baum

### 2.1 Modell (Brief-Befund 1): behoben, und nie ein Kartenproblem

`land-quality.ts#modelKey` bucht `claude/?` fuer `model: null` ohne `modelOrigin: "ambient"`. Das
Modell der Outcome-Zeile kommt aus `server.ts#resolvedModel(slot)`, **nicht** aus `card.rolle.model`;
der `rolle.model`-Gap des Validators ist fuer die Auswertung folgenlos (`cardAdvisoryGap`).
Fix `a7a738c9` (2026-09-17 11:29, auf main) stempelt seitdem `model`+`modelOrigin`.

```
landed, dieses Repo: 671 · vor a7a738c9: 644 (158 model null, 0 mit modelOrigin)
                         nach a7a738c9:  27 (24 mit modelOrigin: 9 spawn, 15 default; 3 ohne)
bun land-quality.ts --since 14d --root /Users/owner/claude-fleet --out <scratch>/lq.jsonl
  → claude/? 53 von 315 (Horizont b2d92216)
```

Die 3 Zeilen ohne `modelOrigin` nach dem Commit sind vermutlich vor dem Deploy geschrieben
(inferiert, Boot-Zeit nicht gegengeprueft). Die 53 sind Altbestand und laut `resolvedModel`-Kommentar
nicht reparierbar. **Kein Schnitt.**

### 2.2 Groesse (Brief-Befund 2): zu einem Viertel ein Join-Loch, nicht ein Fuellproblem

`land-quality.ts#main` baut `sizeOf` **nur aus `fleet.json`**. Zeilen, die `capTasks` nach
`tasks-archive.jsonl` verdraengt hat, verlieren dort ihre Groesse. Zerlegung der 255 `size: null` von
315 Lands (14 d):

```
151  taskId weder in fleet.json noch im Archiv (verdraengt vor 2026-09-15 18:06, erste Archivzeile)
 63  nur im Archiv, MIT card.size (29 klein, 28 mittel, 6 gross)   ← Join-Loch
 15  nur im Archiv, Karte ohne size
  7  nur im Archiv, ohne Karte
 10  in fleet.json, ohne Karte
  8  in fleet.json, Karte ohne size
  1  Outcome ohne taskId
```

Reproduzierbar: das Python-Stueck in §6. Echte Fuell-Absenz (Karte da, Groesse nicht genannt):
**23 von 255**. Eine Groessen-Pflicht beim Filen haette hoechstens diese 23 plus 17 kartenlose
erreicht; der Archiv-Join holt 63 sofort und rueckwirkend, und er verhindert, dass jede kuenftige
Verdraengung die Groesse wieder loescht. Unter den offenen Auftraegen heute: 5 von 21 Karten ohne
`size`.

### 2.3 Program (Brief-Befund 3): heute 1 Zeile

```
bun start-plan.ts --state /Users/owner/claude-fleet/fleet.json --default-repo /Users/owner/claude-fleet
  → Wellen nach reasonAgainst: flaeche-nur-abgeleitet 9 · flaeche-ohne-bereich 4 · gate-aenderer 2 · kein-program 1 · keine 5
fleet.json: 21 offene auftrag-Zeilen, 1 ohne programId (source owner)
```

Die 13 `kein-program`-Wellen vom 2026-09-17 frueh sind abgetragen. Die eine verbleibende ist eine
Owner-Zeile, die der Start-Plan mit Grund benennt. `server.ts#createTaskForMain` setzt `programId` aus
der Bindung und verweigert es im Body, die MAIN-Tuer kann also keine program-lose Zeile gebaeren.
Program-los wird nur eine Owner-Zeile. **Kein Schnitt**, siehe §4.

### 2.4 Verify (Brief-Befund 4), die dritte messbare Absenz

Die vier genannten Zeilen: `531bab26` archived, `42c53378` pending (Gap: VERIFY beschreibt die
Politik „GET /api/self/gate localProof.steps …"), `21ade485` archived („no command named"),
`c14fcd75` archived (`e2e/watch.ts` ist kein Kettenschritt). Offen heute: **1** Karte mit
`verify:`-Gap. Sichtbar ist der Gap, aber am falschen Ort: `server.ts#authorCardFrom` weist eine
ungueltige **Objekt**-Karte beim Filen ab („card rejected, nothing filed"), eine Karte im
Kopfzeilen-Format (`parseFormattedCard`, `card.model: "format"`, 35 von 133 Karten) wird dagegen
erst vom Karten-Tick gelesen. Der Filer erfaehrt den Gap in der POST-Antwort nicht.

## 3. (c) Rangliste, hoechstens drei Schnitte

**S1 · land-quality liest das Archiv mit** (Leser: `land-quality.ts#main`, `sizeOf`)
- Mechanismus: `sizeOf` zusaetzlich aus `tasks-archive.jsonl` fuellen (juengste Zeile je id, Muster
  wie `register.sh --archived`); `fleet.json` gewinnt bei Doppel.
- Tragende Zahl: 63 von 255 Groessen-Nullen im 14-d-Fenster, rueckwirkend; die Groessen-Dimension
  geht von 60 auf 123 bekannte Lands (19 % → 39 %).
- Done: `bun land-quality.ts --since 14d --root <main> --out <scratch>` zeigt unter `size (card)`
  `null` ≤ 192 bei gleichem Horizont; eine Testzeile im Archiv mit `card.size` wird gezaehlt.
- Verify: install, pins, tsc; die Zaehlung aus §6 als Gegenprobe.

**S2 · Die Outcome-Zeile stempelt `size` beim Schreiben** (Leser: `land-quality.ts#main`, danach
ohne Join)
- Mechanismus: wie `model` in `a7a738c9` — die Zeile, die das Outcome schreibt, kennt ihre Task-Zeile
  noch (`status: sent`); `card.size` dort mitschreiben, Absenz = „Karte sagte keine", nie Default.
  LQ bevorzugt den Stempel vor dem Join.
- Tragende Zahl: 151 Nullen sind verloren, weil die Groesse nur am Task lebte und der Task vor dem
  Archiv verdraengt wurde; S1 schliesst das Loch nur, solange das Archiv haelt.
- Done: jede `landed`-Zeile nach dem Deploy traegt `size` oder ist als „nicht genannt" erkennbar;
  ein e2e-Check in der Ledger-Familie haelt es.
- Verify: install, pins, tsc, e2e-Familie der Outcome-Zeile (Vorschau `./e2e-isolated.sh`, da
  Aussage ueber ein Ledger-Feld).

**S3 · Kommentare einer Auftragszeile erreichen ihre Lane** (Leser: `wave-brief.ts#withCardHead`,
also die Lane selbst)
- Mechanismus: die Wellen-Zeile (`WaveBriefRow`) traegt die Kommentare der Zeile als eigenen,
  gekappten Block hinter dem Brief. Der Brief bleibt byte-gleich und freigegeben, deshalb hinter und
  nicht in ihm; das ist dieselbe Trennung, die `Task.comments` in types.ts begruendet.
- Tragende Zahl: 55 Kommentare auf 32 Auftragszeilen, 7 davon noch `pending`, und die MAIN-Brief-Tuer
  verweist aktiv auf diesen Kanal. Heute erreicht keiner davon eine Lane.
- Done: eine Lane, deren Zeile einen Kommentar traegt, sieht ihn im Gruendungsprompt; ohne Kommentar
  ist der Prompt byte-gleich zu heute (Pin).
- Verify: install, pins, tsc, e2e-Familie `tasks`/brief (Vorschau, da Merge-Pfad der Lane-Zustellung).

──────────── Schnittlinie ────────────

Unter der Linie, jeweils mit Grund:
- **Autor am Kommentar** (`TaskComment.by` aus dem Token, wie `TaskBrief.by`): echter Befund (67 von
  79 unsignierten schreiben ihre Rolle als Freitext, die Doku-Zusage „unsigniert = Owner" ist damit
  falsch), aber **kein Aggregat liest ihn**. Erst wenn S3 Kommentare an Lanes liefert, hat er einen
  Leser. Dann gehoert er als Nachsatz zu S3.
- **Karten-Gaps in der POST-Antwort** fuer Kopfzeilen-Karten (§2.4): Leser waere der filende MAIN,
  kein Aggregat, und heute steht 1 offene Zeile daran. Guenstig, aber die Zahl traegt keinen Platz.
- **Kommentar-Art/Bezug** (Brief-Befund 5): kein Leser benannt.

## 4. (d) Gegenliste, was NICHT verpflichtend werden soll

- **`size` beim Filen.** §2.2: 23 echte Fuell-Absenzen gegen 214 Join-/Retentionsverluste. Eine
  Pflicht traefe den Filer fuer einen Fehler des Lesers. Dazu: `card-extract.ts#sizeNamedIn` nimmt
  eine Groesse nur, wenn der Text sie **nennt**. Eine Pflicht erzeugte genau die geratene Groesse,
  die der Validator verbietet (Regel 3 dort), und LW wiegt die Absenz ohnehin sichtbar als `mittel`.
- **`rolle.model` als HARD_GAP.** Kein Aggregat liest `card.rolle`, das Modell kommt vom Slot
  (§2.1). Ein Harter Gap blockierte Starts fuer eine Dimension, die schon anders gemessen wird.
- **`programId` in `POST /api/tasks`.** Die MAIN-Tuer setzt es aus der Bindung. Program-los wird
  nur eine Owner-Zeile, und der Start-Plan benennt sie (`kein-program`, heute 1). Eine Pflicht
  zwaenge den Owner zur Zuordnung einer Zeile, die er absichtlich selbst faehrt.
- **`verdict` an jedem Kommentar** und allgemein jede Pflicht fuer ein Feld, dessen Wert keine
  Handlung ausloest (Beleg §5).

## 5. (e) Obduktion `comments[].verdict`: nicht tot, sondern ein Ritual ohne Wirkung

Die Prämisse des Briefs („35 Legacy-Eintraege alle offen, docs/arbeitsfolge-fleet-2026-09-11.md:50
nennt ihn woertlich nie benutzt") haelt nicht, in beiden Haelften:

1. Die Doc sagt das Gegenteil: `git show main:docs/arbeitsfolge-fleet-2026-09-11.md` Z. 49–51
   zaehlt „35 Legacy-`comments[].verdict`, alle `offen`" und schliesst „‚Der Kanal wurde nie
   benutzt' ist daher für die gesamte Verdict-Tür **nicht belegt**. Null gilt für den neuen
   taskbezogenen Speicher."
2. Der Kanal lebt: heute **194** signierte Urteile von 99 Branches (max. 5 je Branch), juengstes
   2026-09-18 10:26. Verteilung: `offen` 191 · `erledigt` 2 · `widerlegt` 1. `audit.jsonl`:
   369 `note_verdict`, 5 `note_closed_by_land`, 2 `note_usage_settled`.

Der Mechanismus hinter der Verteilung: jeder Lane-Brief endet mit „melde je Notiz `POST
/api/self/notes/<id>/verdict`" (so auch dieser). Die Notizen kommen ueber den Flaechen-Join, also
meist Nachbar-Arbeit, und die ehrliche Antwort darauf ist `offen`. `offen` loest nichts aus: die Tuer
antwortet selbst `effective: "never — read by the owner"`, und `#applyLandToNotes` handelt nur auf
`erledigt`. Ergebnis: 98 % der Eintraege sind Pflicht-Output ohne Leser. Gewirkt haben die 3
Nicht-`offen`-Eintraege: 5 Schliessungen durch Land.

Das ist der Beleg fuer §4: **ein verlangtes Feld ohne handelnden Leser wird zuverlaessig mit dem
billigsten wahren Wert gefuellt.** Die Aggregation gewinnt daran nichts, und der Kanal verrauscht die
wenigen Eintraege, die handeln.

## 6. Kommandos

```sh
# §2.2 Groessen-Zerlegung (nach dem land-quality-Lauf aus §2.1)
python3 - <<'PY'
import json,collections
R="/Users/owner/claude-fleet/"; LQ="<scratch>/lq.jsonl"
rows=[json.loads(l) for l in open(LQ)]
tasks={t["id"]:t for t in json.load(open(R+"fleet.json"))["tasks"]}
arch={}
for l in open(R+"tasks-archive.jsonl"):
  try: t=json.loads(l)["task"]; arch[t["id"]]=t
  except Exception: pass
out={}
for l in open(R+"lane-outcomes.jsonl"):
  if l.strip():
    j=json.loads(l)
    if j.get("branch"): out[j["branch"]]=j
c=collections.Counter()
for r in rows:
  if r["size"] is not None: c["size set"]+=1; continue
  tid=r["taskId"]
  if not tid: c["no taskId"]+=1; continue
  if tid in tasks: t=tasks[tid]; c["fleet.json, "+("no card" if not t.get("card") else "card w/o size")]+=1; continue
  a=arch.get(tid) or arch.get(out.get(r["branch"],{}).get("originId") or "")
  if a is None: c["neither"]+=1; continue
  s=(a.get("card") or {}).get("size")
  c["archive, "+(("size="+s) if s else ("no card" if not a.get("card") else "card w/o size"))]+=1
print(c)
PY
# §5 Kommentar-/Urteilszaehlung
python3 -c 'import json,collections;T=json.load(open("/Users/owner/claude-fleet/fleet.json"))["tasks"];C=[c for t in T for c in t.get("comments") or []];print(len(C),sum(1 for c in C if c.get("from")),collections.Counter(c.get("verdict") for c in C))'
grep -c note_verdict /Users/owner/claude-fleet/audit.jsonl
```
