# Schnittliste Kommunikations- und Datenschichten — 2026-09-07

Kein Bericht: eine Rangordnung von Schnitten. Jeder Posten ist so geschrieben, dass er ohne
menschliches Nachlesen eine Queue-Zeile wird (Mechanismus, Kosten-Zahl mit Quelle, DONE, VERIFY).
Maximal acht Posten waren erlaubt; **vier** stehen über der Linie, der Rest ist unter ihr benannt.

## Herkunft und Korrekturhistorie — diese Fassung steht auf main, obwohl ihre Vorfassung abgelehnt war

Der Satz gehört an den Anfang, weil ein Leser sonst eine Prüfung annimmt, die nicht stattgefunden hat:

- Die Erstfassung entstand in Lane `012fe6b9` (168 Zeilen) und wurde als FleetReport `e351772b`
  eingereicht. Ihre Abnahmebasis nannte den Lane-HEAD `a87eae3a`; dieser Sha **löst auf main nicht
  auf** (`git merge-base --is-ancestor a87eae3a main` sagt nein), weil der Land per Rebase erfolgt —
  er ist als Lane-lokaler Vor-Rebase-Stand zu lesen, nicht als Punkt der Historie.
- Der Empfänger — die Architektur-MAIN des Programs `e3b3a064` — hat sie **fachlich abgelehnt**
  (`decision.disposition: rejected`, `decidedAt 1788787296285`), mit einem Korrekturbrief statt eines Lands.
- **Trotzdem wurde die byte-gleiche Fassung gelandet:** Commit `522701c`, sha256
  `c74331e8b8553000e32db400e18f7394513fd9bb1dee6216a32f0c86348fe8f6`. Zwischen diesem Land und dieser
  Revision stand das Dokument also ohne Abnahme auf main — es ist keine geprüfte Quelle gewesen und
  wird hier nicht nachträglich zu einer erklärt.
- Diese Revision arbeitet den dauerhaft gefilten Korrekturbrief `c9683f04` (fünf Gruppen) ab. Der
  ursprüngliche Empfängerslot existierte zum Zeitpunkt der Korrektur nicht mehr, die Korrektur läuft
  deshalb als eigene Lane auf main statt als Nachbesserung in der alten.
- Der Abgleich Gruppe → Änderung steht am Ende unter »Korrekturgruppen«. Zwei Posten haben dabei ihre
  Aussage verloren: Posten 1 beschreibt eine Lücke, die seit `7a20eead` geschlossen ist, und der
  frühere Posten 5 ist unter die Linie gewandert.

## Messbasis und Methode

Zwei Messzeitpunkte, getrennt gehalten:

- **15:15 CEST** — die Erstmessung (Erstfassung). Zahlen daraus sind mit »15:15« markiert.
- **23:3x CEST** — die Nachmessung dieser Revision, mit den unten abgedruckten Proben.

Quellen: `fleet.json` im Haupt-Checkout (Schlüssel `fleetReports`, `programs`, `slots`, `tasks`,
`clarifications`, `attentionRequests`, `watches`) und `streams/prompts.jsonl`. Beide sind gitignored;
gelesen wird mit `python3`/`grep`, nie mit `rg`.

**Nenner sind definiert, nicht impliziert.** `fleet.json` hält einen *Speicherbestand*, keine
Vollhistorie: `server.ts#pruneFleetReports` schneidet terminale Report-Zeilen auf
`FLEET_REPORT_KEEP = 20` (`server.ts:2465`). Eine Aussage »je eingereicht« ist aus dieser Datei
strukturell nicht ableitbar und steht nirgends mehr in diesem Dokument. Ausgenommen von der Prune
sind genau die Zeilen, die der Owner noch schuldet (`reportAwaitsOwner`) — für die ist der
Speicherbestand vollständig, für alle anderen nicht.

**Probe A — Reports (Posten 1).** Spiegelt `server.ts#reportReceiverLiveness` und
`reportAwaitsOwner`. Entscheidend: unentschieden heißt **fehlender Schlüssel ODER explizites null**
(`server/types.ts`: `decision?: FleetReportDecision | null`) — eine Probe auf `decision === null`
allein zählt heute **null von 21** unentschiedenen Zeilen und meldet eine falsche Null.

```python
import json
s = json.load(open("fleet.json"))
reports = s["fleetReports"]
slots = {int(k): v for k, v in s["slots"].items() if v.get("cwd")}
def liveness(r):
    rc = r.get("receiver")
    if rc is None: return "owner-inbox"          # eigene Ablehnung in decideFleetReport
    sl = slots.get(rc["slot"])
    return "live" if sl and sl.get("openedAt") == rc["openedAt"] else "gone"
absent = [r for r in reports if "decision" not in r]
null_  = [r for r in reports if "decision" in r and r["decision"] is None]
undec  = absent + null_
awaiting = [r for r in undec if liveness(r) != "live"]
print(len(reports), len(absent), len(null_), len(undec) - len(awaiting), len(awaiting))
print([r["id"][:8] for r in awaiting])          # IDs, nicht nur ein Zähler
```

Ausgabe 23:3x: `32 21 0 9 12` — 32 gespeicherte Zeilen, 21 unentschieden (alle in der Form
*fehlender Schlüssel*, keine einzige als explizites null), davon 9 mit lebendem Empfänger und **12
ohne** (1 ersetzter Occupant, 11 Owner-Inbox). Entschieden: 11, davon **0 durch den Owner**. Die IDs
der 12 stehen in der zweiten Zeile und sind der Gegenstand, nicht der Zähler.

**Probe B — Programs (Posten 2).** Spiegelt `server.ts#programOccupancy` (`unbound` | `live` |
`stale`), gekreuzt mit `status`:

```python
def occ(p):
    m = p.get("main")
    if not m: return "unbound"
    sl = slots.get(m["slot"])
    return "live" if sl and sl.get("openedAt") == m["openedAt"] else "stale"
```

Ausgabe 23:3x über 69 Programs: `active × live 6`, `active × stale 8`, `active × unbound 0`,
`complete × stale 46`, `complete × unbound 8`, `proposed × unbound 1`.

**Probe C — Sends (Posten 3).** `streams/prompts.jsonl`, ein JSON-Objekt je Zeile. Nur Zeilen mit
Schlüssel `delivery` sind journalisierte Sends; **der Nenner ist diese Menge, nicht ihre
`sent`-Teilmenge.** Zeitfenster: `ts >= (now - 7d) * 1000`.

```python
import json, time
from collections import Counter
rows = [json.loads(l) for l in open("streams/prompts.jsonl")]
d7 = [r for r in rows if r.get("delivery") and r["ts"] >= (time.time() - 7*86400) * 1000]
bad = [r for r in d7 if r["delivery"] in ("uncertain", "unobserved")]
print(len(d7), len(bad), Counter(r["delivery"] for r in d7))
```

Ausgabe 23:3x: **31 von 604** (28 `uncertain`, 3 `unobserved`) = **5,1 %**. Über die gesamte Datei:
39 von 1335 = 2,9 %. Ein Filter `source: owner` verengt nichts — alle 604 Zeilen tragen ihn.
*Korrektur gegen die Erstfassung:* dort stand »31 von 571 = 5,4 %«; 571 war die `sent`-Teilmenge,
also ein Nenner, aus dem der Zähler herausgerechnet war.

**Was diese Revision NICHT vorlegt:** eine Originalausgabe des Land-Gates. Der Brief verlangt sie zu
Recht; sie entsteht erst beim Land dieser Fassung, und ihr Pfad plus Exitcode gehört in die
Land-Note, nicht in eine Prosa-Behauptung hier. »ALL PASS im Report« ist kein Prüfbeleg und wird an
keiner Stelle dieses Dokuments als einer geführt.

**Verweisform:** Symbole (`datei#symbol`), keine Zeilennummern — undatierte Zeilenverweise rotten.
Die drei Ausnahmen (`server.ts:2465`, `AGENTS.md:118–129`, `server/types.ts`) zeigen auf den Baum
dieser Messung und sind als datierte Snapshots gemeint.

Rangprinzip: **still vor laut.** Ein Kanal, der fehlschlägt, ohne dass es jemand sieht, schlägt
teurer als einer, der 409 quittiert.

---

## Posten 1 — M1: Die Owner-Tür für Reports existiert seit `7a20eead`; offen sind die 12 Zeilen davor

**Mechanismus (Stand der Erstfassung, 15:15 — heute historisch):** `server.ts#clarificationReceiverFor`
löst den Empfänger aus dem lebenden Occupant von `program.main` auf, `server.ts#decideFleetReport`
verglich das volle Tripel {slot, openedAt, sessionId}, und die einzige Route
`POST /api/self/fleet-report/:id/(accept|reject)` war self-only — ein Retire der MAIN machte die
Abnahme dauerhaft unmöglich.

**Was am Baum von heute gilt:** die Lücke ist zu. `server.ts#ownerDecideFleetReport` hinter
`POST /api/fleet-report/:id/(accept|reject)` entscheidet genau die Zeilen, die keine Session mehr
beurteilen kann, und **verweigert, solange der Empfänger lebt** — mit der Adresse der Tür, die offen
ist. `server.ts#reportReceiverLiveness` ist die eine Funktion, die beide Türen lesen, damit sie nicht
auseinanderlaufen. `server.ts#decideFleetReport` vergleicht nur noch slot + openedAt (der
sessionId-null-Fall aus Slot 12); der Verdikt-Stempel ist `by: "owner"`; `fleetReportOwnerView` macht
die verwaisten Zeilen sichtbar; `pruneFleetReports` nimmt Zeilen mit `reportAwaitsOwner` von der
Retention aus. Queue-Zeile `89279f1f` steht auf **done**, nicht mehr auf pending.

Ihre vier DONE-Sätze, knapp und vollständig, weil ein Leser sie sonst nachschlagen muss: (1) eine
Owner-/Controller-Route entscheidet einen Report, dessen gebundener Occupant nicht mehr lebt, und
gilt nicht, solange er lebt; (2) die Entscheidung ist als Owner-Entscheidung gestempelt, nicht als
die der toten MAIN; (3) ein Report mit gestorbenem Occupant ist als solcher sichtbar statt still auf
`NO_RECEIVER_EVIDENCE`; (4) der sessionId-null-Fall ist geschlossen oder ehrlich als richtig
begründet. Alle vier sind am Code belegt (Symbole oben). Ausdrücklich verboten war und bleibt: die
Abnahme automatisieren, die Self-Route aufweichen, den Occupant-Vergleich lockern.

**Kosten heute (23:3x, Probe A): 12** unentschiedene Zeilen, die auf den Owner warten. **0
Owner-Verdikte sind bisher gefallen:** die Tür ist gebaut und ungenutzt. Die Zeilen namentlich, weil
ein Zähler hier nichts adressiert:

```
ersetzter Occupant (1): 79fa8885
Owner-Inbox (11)      : 303a0d8c 6a8db675 4ed8e3f6 ccdaabb8 f7efb7aa 14f483e2
                        dd3ec74d 1815ff0f 2dcf8221 a846d563 d9afe4cc
```

Die 11 Owner-Inbox-Zeilen haben in `decideFleetReport` eine **eigene** Ablehnung, weil der Owner
kein Occupant-Tripel hat; nur die eine übrige ist ein Report an eine MAIN, deren Occupant ersetzt
wurde. Die Liste ist ein **Snapshot**, kein Bestand: ein Wiederholungslauf um 23:57 liefert 13 — die
dreizehnte ist der Report dieser Korrektur selbst (`c334a674`, Owner-Inbox, unentschieden). Wer die
Zeilen abarbeitet, misst also zuerst neu und arbeitet dann die IDs ab, die er dabei liest.

**Ein Nebenbeleg der Erstfassung ist datiert nachzutragen.** Dort stand »10 von 10 Clarifications
sind unbeantwortet, 6 davon mit totem Receiver«. Nachgemessen 23:3x trägt jede der 10
Clarification-Zeilen `status: "answered"` mit vollständigem `answer`-Objekt. **Eine Messung von
heute widerlegt für sich genommen keinen früheren offenen Zustand** — sie datiert ihn nur. Hier
entscheidet deshalb nicht der Zählstand, sondern der Zeitstempel: jede der 10 Zeilen trägt ihr
`answer.at`, und die **jüngste Antwort liegt am 2026-09-05 21:22**, rund 41 Stunden **vor** der
15:15-Messung; die älteste am 2026-08-15 20:08. Zum Messzeitpunkt der Erstfassung waren die 10
Zeilen also bereits beantwortet, und der Nebenbeleg war schon damals nicht zutreffend — nicht erst
seither überholt. Was ihn erzeugt hat, ist derselbe Probentyp wie `decision === null` in Probe A:
eine Prüfung auf das falsche Feld, deren Null wie ein Befund aussieht. Die Owner-Tür für Attention
funktioniert dagegen wie behauptet (21 Zeilen: 19 `answered`, 1 `refused`, 1 `open`).

Der Rest-Schnitt ist damit kein Bau mehr, sondern ein Rückstand — er verdient eine Zeile, aber eine
kleinere als die Erstfassung ihm gab.

**DONE:** Die 12 namentlich bekannten Zeilen aus Probe A sind je einzeln entschieden **oder** mit
Begründung stehen gelassen; für Clarifications ist entschieden, ob dieselbe Owner-Tür dort fehlt
(eigene Zeile, kein Anhang an diese).

**VERIFY:** Probe A oben, mit **beiden** Unentschieden-Formen und getrennter Ausweisung von
Null-Receiver (Owner-Inbox) gegen ersetzten Occupant, verglichen über die **abgedruckten IDs** statt
über einen Gesamtzähler — »0« ist hier ausdrücklich **kein** DONE-Kriterium: eine automatische
Entscheidung alter Reports ist in `89279f1f` verboten und bleibt es. Funktional geprüft wird in
`e2e/watch.ts` (der D3-Block: Owner-Tür verweigert bei lebendem Empfänger, nimmt bei totem,
Lane-Ausschluss 401, Body-Form, 404 für unbekannte ID — 58 Fundstellen, die dichteste Familie) und in
`e2e/programs.ts` (Projektion und Succession, 7 Fundstellen). `e2e/security.ts` trägt **nur** die
Routentabellen-Pins, keine Funktionsprüfung; die Erstfassung nannte sie als Testfamilie, das war
falsch.

## Posten 2 — M3: Aktive Programs binden tote Occupants und sehen dabei lebendig aus

**Mechanismus:** `program.main` zeigt nach Occupant-Wechsel oder Retire weiter auf das alte Tripel.
Die Sicht darauf ist **präzise, nicht pauschal**: `server.ts#programHealth` liefert ein Paar —
`occupancy` aus `server.ts#programOccupancy` (`stale` bei toter Bindung, `unbound` bei fehlender,
`live` sonst) und `sessionIdMatch` (`unknown` außerhalb einer lebenden Occupation, sonst `exact`
oder `divergent`). Es meldet nie »health unknown«. Der Defekt ist also nicht die Sicht, sondern dass
nichts die Bindung räumt: das Program steht `active` in jeder Liste und kann nichts empfangen.

**Kosten heute (23:3x, Probe B): 8 von 14** aktiven Programs sind `active × stale`
(15:15: 7 von 14) — `cd110019`, `66499a03`, `07ee8a6d`, `2c073232`, `b2aa5b45`, `79036e9a`,
`29c0f21b`, `446e77f8`. `active × unbound`: **0**. Jede dieser Bindungen mit offener Lane ist eine
werdende Posten-1-Sackgasse.

**DONE — ein Vertrag, nicht zwei:** ein Program mit unerledigter Arbeit bleibt **sichtbar** `stale`
oder `unbound` und behält seinen bestehenden Wiederaufnahmeweg; Retire und Occupant-Wechsel lösen
oder aktualisieren die Bindung (für Succession tut das `server.ts#succeedProgramMain` bereits, die
Lücke ist der Retire-/Sterbepfad). **Keine automatische Complete-Markierung**, nur um einen Zähler
auf null zu bringen: der Fall »active + unerledigter Task + Retire« darf nicht als Programerfolg
verschwinden. Soll die Statuspolitik anders aussehen (etwa: ein stale Program fällt automatisch aus
`active`), ist das ein **noch offener Owner-Vorschlag** und kein DONE dieser Zeile.

**VERIFY:** Probe B liefert für `active` nur noch `live` **oder** eine ausdrücklich benannte,
sichtbare `stale`/`unbound`-Zeile mit Wiederaufnahmeweg; live zeigt `GET /api/programs` dasselbe
Paar aus `programHealth`. Die Erstfassung verlangte hier »`occupancy: live` oder Status ≠ active« und
widersprach damit ihrem eigenen DONE, das Unbinding erlaubt — ein entbundenes aktives Program liest
`unbound` und wäre an dieser VERIFY-Zeile gescheitert.

## Posten 3 — M4: Der Send-Kanal liefert per Paste; der belegte Composer ist kein Räumfall

**Mechanismus:** `server.ts#sendText` liefert über `tmux paste-buffer` in die Pane. Ein belegter
Composer wird **vor** dem Boot-Block per `server.ts#readComposer` gelesen und der Send
**abgelehnt, bevor irgendetwas getippt wird** (`SendRefused: composer occupied (N chars) — nothing
typed`) — im Kommentar der Stelle: »an occupied composer is an owner draft«. Das ist eine
Schutzentscheidung, kein Defekt. Der verbleibende Fall ist enger: ein Rest, der **zwischen** Prüfung
und Paste entsteht oder Enter überlebt, endet als `acceptance: uncertain`/`unobserved`; für den
**eigenen** Payload existiert dafür bereits ein Protokoll (`rollbackOwnComposerPayload`, aufgerufen
nur unter `options.rollbackOwnPayload`). Die in der Erstfassung beobachteten Räum-Tastenfolgen
(C-u, C-a, C-k, BSpace) erreichten den Composer einer zweiten Pane gar nicht.

**Kosten heute (23:3x, Probe C): 31 von 604** journalisierten Sends der letzten 7 Tage endeten
`uncertain` (28) oder `unobserved` (3) = **5,1 %**. Der Fall vom 2026-09-07 14:12 steht als Zeile im
Ledger (Slot 8, `uncertain`, 23-Zeichen-Text — deckt sich mit der Beobachtung »composer still holds
24 chars after 3000ms«). Strukturkost darüber, als Schätzung markiert: jede Nachricht an eine MAIN
liest deren vollen Kontext neu, ~250–350k Tokens (Dispatcher-Schätzung, keine Messung); gemessener
Extremfall ein Turn mit 195 000 Tokens ≈ 37 % des Session-Budgets, 1 h 09 min (Dispatcher-Messung
2026-09-07, Slot 4).

**DONE:** Ein fremder Entwurf im Composer bleibt **erhalten**, und der Send weist sich ausdrücklich
als `refusing`/`no-send` aus — »Composer deterministisch räumen« ist als allgemeiner Fix
ausgeschlossen und steht nicht mehr in dieser Zeile. Zurückgenommen werden darf ausschließlich
nachweislich **eigener** Payload, über das vorhandene Protokoll. Belegt wird das je unterstütztem
Harness mit einer begrenzten Probe in **beide** Richtungen — ein Positivfall mit echter Acceptance
und ein Negativfall mit vorbelegtem Composer —, und was nicht geprüft werden konnte, heißt ehrlich
`unsupported` oder `unknown`, nicht »pass«.

**VERIFY:** `./acceptance-probe.sh` (ACP-25, Real-TUI) mit dem Positiv-/Negativpaar je Harness, Tail
`ALL PASS`; dazu Probe C **nach** der Reparatur als Vorher-Nachher an derselben Datei mit demselben
Nenner. Ausdrücklich **nicht** als Beleg zugelassen: eine 7-Tage-Zählung, die `uncertain == 0`
zeigt — ein alter `uncertain`-Eintrag wird durch eine Reparatur nicht nachträglich zur Quittung, und
eine leere Historie beweist keinen neuen Fix.

## Posten 4 — M2: Artefakte und Briefe zeigen in `/tmp` statt an einen haltbaren Ort

**Mechanismus:** Queue-Zeilen und Briefs landen über `server.ts#saveState` in `fleet.json` und dürfen
auf beliebige Dateisystempfade zeigen. `/tmp` hat auf dieser Maschine **keine Haltbarkeitsgarantie**
über einen Reboot hinweg; die Zeile, die darauf zeigt, bleibt. Das ist die belegbare Aussage — nicht
die stärkere »bei einem Reboot ist der volle Inhalt aller Zeilen weg«, die einen Reboot-Test
voraussetzte, den niemand gefahren hat.

**Drei Sorten, und sie tragen verschiedene Pflichten** — die Erstfassung warf sie in einen Topf:

1. **Pflichtartefakt** — ein dauerhafter Liefergegenstand, auf den eine offene Zeile inhaltlich
   angewiesen ist (z. B. `/tmp/astra-datenvertraege-umsetzungsplan-20260907.md`, 24 K). Gehört
   bereinigt und autorisiert an einen haltbaren Ort, mit Quellen-/Versionsbeleg und Rückverweis.
2. **Optionale Referenz** — Entwürfe, Zweitmeinungen, Kandidatenfassungen
   (`/tmp/astra-p3-2026-09-07/independent-review-candidate.md`). Rückverweis genügt; ein Verlust
   kostet Kontext, nicht die Zeile.
3. **Temporäres Verify-Log** — `astra-disposition-verify.log`, `astra-plan-luecken-verify.log`,
   `astra-disposition-probe-final.log`, `p1-publication-…-install.log`. Hier ist nicht die Datei
   der Liefergegenstand, sondern der **Beweis**, und der wird an einem haltbaren Ort gesichert
   statt im Log: Kommando, **absoluter** Logpfad, Exitcode und der wörtliche Tail gehören in die
   Land-Note des Commits (`git notes --ref=fleet/land show <sha>`) und in den Commit-Body, ein
   Messergebnis zusätzlich in eine Notiz unter `docs/messungen/`. Steht das dort, ist der Beweis
   auch dann noch prüfbar, wenn die Datei nicht mehr existiert; steht es nicht dort, ist der Beweis
   mit der Datei verloren — dann fehlt die Sicherung, nicht das Log. Die Logdatei selbst ins Repo zu
   committen ersetzt diese Sicherung nicht und wäre der falsche Fix.

Eine pauschale Verpflichtung, alle privaten Scratch-Ziele in dieses Repo zu committen, steht deshalb
nicht mehr in dieser Zeile.

**Kosten heute (23:3x): 37** Queue-Zeilen referenzieren einen `/tmp`-Pfad (28 `pending`, 6 `done`,
1 `sent`, 2 `archived`); 15:15 waren es 20, Dispatcher-Vormittag 14 — die Zahl wächst mit der Queue.
Alle geprüften `/tmp/astra-*`-Ziele existieren zum Messzeitpunkt noch (16 K bis 6,7 M). **Ein
verlorener Pfad macht den Tasktext nicht leer:** die Zeilen tragen ihre Aufgabe in Prosa, der Pfad
trägt das Artefakt — was fehlt, ist von Zeile zu Zeile verschieden und muss einzeln gelesen werden.

**Dazu die datierte Gegenprobe zu einer Behauptung der Erstfassung:** »C1–C5 existieren nirgends
sonst« ist **falsch**. C5 ist als eigener dauerhafter `auftrag` gefiled — Task `eec64457`
(`pending`, Program `e3b3a064`, codex/gpt-6-astra/medium); C3/C4/C5 sind zusätzlich über Task
`506fdce6` adressiert. Übernommen war die Behauptung aus einem älteren Dispatch, ohne sie gegen den
aktuellen Bestand zu prüfen.

**DONE:** Jede offene (`pending`/`queued`/`sent`) Zeile, deren Inhalt an einem `/tmp`-Pfad hängt, ist
nach der Sortierung oben eingeordnet; für Sorte 1 liegt das bereinigte, autorisierte Artefakt an
einem haltbaren Ort mit Quellenbeleg, und die Zeile zeigt dorthin; Sorte 2 behält ihren Rückverweis;
Sorte 3 bleibt, wo sie ist, und ist als vergänglich benannt.

**VERIFY:** Die Zähl-Probe über `fleet.json` `tasks` (striktes Pfadmuster `/tmp/…`, ohne
Prosa-Erwähnungen) liefert je offener Zeile die Sorten-Einordnung, nicht nur einen Zähler; für die
Sorte-1-Zeilen zeigt `git log --oneline -- docs/` den Artefakt-Commit. Für den docs-Anteil dieser
Arbeit: `bun e2e/pins.ts`.

---

## Unter der Schnittlinie — benannt, ausdrücklich NICHT ausgearbeitet

- **Die empfohlene Rückweg-Form (früher Posten 5).** Die Erstfassung stellte die portable Warte-Regel
  als Defekt hin: sie empfehle einen »one long-lived quiet wait outside the transcript«, und genau
  diese Form sei am 2026-09-04 zweimal in einer halben Stunde vom OS wegen Speichermangels getötet
  worden (Notiz `0a8d2f13`). **Das trägt am Vertrag nicht.** `AGENTS.md:118–129` ordnet die getippte
  Route bereits vor: »A Controller delegates observation to the bound Supervisor when a typed
  notification route exists« und »If a reliable watch, notification, or wait mechanism exists for the
  awaited state, arm exactly one such return path«; der lange Wait steht ausdrücklich als
  *Otherwise*-Fall, und für ihn schreibt derselbe Absatz Cadence und Stopp-Linie vor
  (»then name the cadence and the stop line, and report `unknown` for every unobserved interval«).
  `0a8d2f13` ist damit ein historischer **Ausfallbeleg** für eine Form, die der Vertrag ohnehin
  nachordnet — kein Nachweis eines heute fehlenden Vorrangs und kein Anlass für eine neue harte
  Invariante. Ein aktueller, spezifisch fehlender Rückweg mit Falsifikator wäre der Beleg, der diesen
  Posten über die Linie hebt; diese Revision hat keinen. Es wird deshalb **kein fünfter Posten
  erzwungen**.
- **Codex-Zombie-Prozesse** (Notiz `6a691420`: 10 Prozesse, alt bis 7 d 16 h; 15:15 neun
  Agent-Binaries lebend). Maschinenhygiene ohne Kommunikationskosten-Zahl.
- **Branch-/Worktree-Rest** (Notiz `1d05c49b`: jeder Lane-Auto-Close hinterlässt Worktree und Branch;
  15:15: 412 `fleet/*`-Branches, 396 gemerged, 5 Worktrees auf Platte). Messbare Zahl, keine belegten
  Kosten in der Kommunikationsschicht.
- **Post-Land-Audits: 136 rot, 106 unknown von 518** (`state.sh`, 15:15). Hat eine eigene Dok-Reihe
  (`docs/verify-tiering.md`); hier gäbe es keine neue Mechanik.
- **Harness-inhärente Wiedereinlese-Kost** (~250–350k Tokens je MAIN-Nachricht, Schätzung): der
  Extremfall ist unter Posten 3 verbucht; die Kost selbst zu senken ist ein Produkt-Eingriff
  (Adapter, Aufmerksamkeitsfenster), kein Schnitt mit Ledger-Zahl.
- **TMPDIR-e2e-Schrott 1,7 G, 2 geleakte tmux-Sockets, 2 stray PIDs** (`state.sh`, 15:15): die
  Hygiene-Sektion existiert bereits und druckt sie bei jedem Lauf.

## Schnittlinie

Geschnitten wird bei Mechanismen, die **beides** erfüllen: (a) heute eine Zahl aus Ledger oder
Messung mit definiertem Nenner, (b) sie blockieren oder zerstören den Fluss zwischen Owner, MAIN und
Worker (Abnahme, Adresse, Zustellung, Datenort, Rückweg). Die vier Posten darüber erfüllen beides.
Alles darunter ist Hygiene mit Zahl ohne Kommunikationskosten, hat eine eigene Dok-Reihe, ist
harness-inhärent — oder trägt, wie die Rückweg-Form, am geltenden Vertrag nicht.

## Mechanismen außerhalb M1–M4 — Bestandsaufnahme

Gefunden und unter der Linie: Rückweg-Form, Zombie-Prozesse, Branch-Rest. **Über der Linie: keiner.**
Weitere Kommunikations-/Daten-Mechanismen außerhalb M1–M4 wurden in den Ledger- und Code-Quellen
dieser Messrunde nicht gefunden — als Absenz festgehalten, nicht als Lücke: geprüft wurden
`fleetReports`, `clarifications`, `attentionRequests`, `watches`, `tasks`, `programs`, `slots`,
`streams/prompts.jsonl`, `state.sh` sowie die Report-, Program- und Send-Pfade in `server.ts`,
`server/types.ts` und die Prüffamilien in `e2e/`.

## Korrekturgruppen — Abgleich mit Brief `c9683f04`

| Gruppe | Was geändert wurde |
|---|---|
| 1 (M1) | Nebenbeleg »10 von 10 Clarifications unbeantwortet« datiert nachgetragen: alle 10 tragen `answer.at`, die jüngste Antwort 2026-09-05 21:22 und damit ~41 h vor der 15:15-Messung — er war schon zum Messzeitpunkt nicht zutreffend, nicht erst seither überholt; Probe A erfasst beide Unentschieden-Formen und trennt Null-Receiver von ersetztem Occupant; IDs statt Gesamtzähler; »je eingereicht/je entschieden« gestrichen und durch den Speicherbestand mit `FLEET_REPORT_KEEP`-Vorbehalt ersetzt; keine automatische Entscheidung als VERIFY; Testfamilie auf `e2e/watch.ts` + `e2e/programs.ts` korrigiert (`e2e/security.ts` trägt nur Routen-Pins); die vier DONE-Sätze von `89279f1f` ausgeschrieben. **Zusätzlich, weil es die Aussage kippt:** die Lücke ist seit `7a20eead` (`ownerDecideFleetReport`) geschlossen und `89279f1f` steht auf `done` — der Posten beschreibt jetzt den Rückstand von 12 Zeilen, nicht mehr eine fehlende Tür. Occupant-Rechte unverändert. |
| 2 (M3) | `programHealth` präzise als Paar `occupancy` (`stale`/`unbound`/`live`) + `sessionIdMatch` (`unknown`) beschrieben statt »health unknown«; **ein** Vertrag: sichtbar stale/unbound mit Wiederaufnahmeweg, keine automatische Complete-Markierung, andere Statuspolitik als offener Owner-Vorschlag benannt; der Widerspruch zwischen DONE (Unbinding erlaubt) und VERIFY (`live` verlangt) aufgelöst; Negativfall active+unerledigt+Retire ausdrücklich geschützt. |
| 3 (M4) | »Composer deterministisch räumen« gestrichen — `sendText` verweigert per Design vor dem Tippen; DONE verlangt Erhalt des fremden Entwurfs und `refusing`/`no-send`-Nachweis, Rücknahme nur eigenen Payloads; 7-Tage-`uncertain == 0` als Beleg ausgeschlossen, ersetzt durch Positiv-/Negativprobe je Harness mit ehrlichem `unsupported`/`unknown`. |
| 4 (M2) | Dreiteilung Pflichtartefakt / optionale Referenz / temporäres Verify-Log eingeführt, für die dritte Sorte mit der Beweissicherung statt der Datei (Kommando, absoluter Logpfad, Exitcode, wörtlicher Tail in Land-Note und Commit-Body, Messergebnis in `docs/messungen/`); pauschale Commit-Pflicht für alle privaten Scratch-Ziele entfernt; Reboot als fehlende Haltbarkeitsgarantie statt ungeprüftem Totalverlust; »ein verlorener Pfad leert nicht die Zeile«; »C1–C5 existieren nirgends sonst« datiert widerlegt (C5 = Task `eec64457`, gefiled; C3–C5 auch in `506fdce6`). |
| 5 (Beweise) | Posten 5 unter die Schnittlinie verschoben, mit `AGENTS.md:118–129` als Grund; `0a8d2f13` als historischer Ausfallbeleg eingeordnet, keine neue Invariante; kein fünfter Posten erzwungen. Methodenteil trägt jetzt die tatsächlichen Lesekommandos, Filter, Zeitfenster und getrennte Nenner; »derselbe Dreizeiler« ohne Dreizeiler ist ersetzt; die Nenner-Verwechslung 571 vs. 604 in Posten 3 korrigiert; ausdrücklich vermerkt, dass das Gate-Originallog zur Land-Note gehört und »ALL PASS im Report« kein Prüfbeleg ist. |
