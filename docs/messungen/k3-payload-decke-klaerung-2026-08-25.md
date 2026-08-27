---
frage: Ist eine deterministische Fixture für einen Payload-Decken-Check auf /api/sessions billig genug, um sie zu bauen, oder wird daraus die neunte Flake-Familie?
urteil: Nicht dispatchen; der Check existiert seit einem Monat (e2e/tasks.ts, seit e901287), ist in keiner der acht Flake-Familien genannt, und die Schwellenwert-Bauart ist gegen nicht-deterministische Felder robust; die K3-Behauptung, es gebe keinen solchen Check, ist widerlegt
bereich: [verify]
belege: [e2e/tasks.ts:589, e2e/slots.ts, e2e/transport.ts, e901287, docs/messungen/video-memory-theo-2026-08-25.md]
nicht-gemessen: Ob die 14-KiB-Decke bei mehr als 16 Slots hält; ob transport.ts und slots.ts dieselbe Bauart durchhalten; kein Check gebaut oder ausgeführt; der Video-Beleg (P80/P82/P83) nicht erneut geprüft
stand: 2026-08-25
---

# K3 — ist eine deterministische `/api/sessions`-Payload-Decke als Check billig?

2026-08-25, Lane `fleet/260825211516-4d40`. Frage: **Ist eine deterministische Fixture für einen
Payload-Decken-Check auf `/api/sessions` billig genug, um sie zu bauen — oder wird daraus die
neunte Flake-Familie?**

## Ergebnis

**Die Vorfrage ist gegenstandslos: der Check existiert bereits, seit einem Monat, ohne
Flake-Meldung.** `docs/messungen/video-memory-theo-2026-08-25.md` §K3 behauptet „kein `check(`-Name
in `e2e/` … nennt Byte, Payload, Size oder Budget" — das ist widerlegt:

- `e2e/tasks.ts:589` — `check("the 16-slot sessions payload stays under 14 KB with a 15 KB task
  queued and bounded event facts", bytes < 14 * 1024, …)`. Genau die Payload-Decke, die K3 fordert,
  auf genau dem Endpunkt (`GET /api/sessions`).
- `e2e/tasks.ts:575` — Gegenprobe `"control: the 15 KB task IS in the polled payload (so the size
  check below can fail)"` — nicht-tautologisch: bewiesen wird, dass der Task im selben Payload
  steckt, das als klein bewiesen wird.
- `e2e/slots.ts:350` — `"WS ?seed=N shrinks the reconnect seed (the data-saver scrollback
  budget)"` (Lane C).
- `e2e/slots.ts:402` — `"the seed budget survives hidden — it is read at connect time, not on a
  timer"` (Lane D).
- `e2e/slots.ts:398-400` — `"hidden tab polls nothing at all (data saver …)"` — reine
  Funktionsprüfung von `pollPlan()`, keine Netzwerk-Zeitmessung (Lane D).
- `e2e/transport.ts:91-99` — gzip-Schwelle auf `/api/sessions` selbst (`"a JSON answer over the
  gzip floor is compressed, and still parses"`) und drei Nachbar-Checks für Kompressionsverhalten
  (Lane B).

Alle vier Data-Saver-Lanes (A payload, B transport, C reconnect, D mode — `docs/data-saver.md` §3)
haben damit bereits einen oder mehrere e2e-Checks, die genau ihre gemessene Wirkung verteidigen.
Quelle: `git log -1 --format='%ci' e901287` → 2026-07-26 16:30:15 +0000 (Lane A, der Payload-Check
landet in diesem Commit); `git log --oneline e901287..HEAD -- e2e/tasks.ts | wc -l` → 56 spätere
Commits an derselben Datei, **kein** Eintrag zu diesem Check in `docs/verify-tiering.md` (das acht
Flake-Familien akribisch mit Signatur, Instanzzahl und Fundstelle führt — ein neunter Fund dort
wäre nicht unbemerkt geblieben).

## Mechanismus — warum er trotz nicht-deterministischer Felder deterministisch läuft

`server.ts:19243-19361` (Handler von `GET /api/sessions`) hat mehrere nicht-deterministische Felder
im Payload: `now: Date.now()` (Zeile 19245), pro Slot `openedAt`, `lastOutput`, `ctx: contextFill(s)`
(Datei-mtime-abhängig), `git` (mtime-gecachter Tick), `share.created`. Ein Byte-für-Byte-Vergleich
gegen eine feste Antwort wäre damit strukturell flake-anfällig — genau die Sorge hinter K3.

Der bestehende Check umgeht das vollständig, indem er **nie exakte Bytes vergleicht, sondern nur
eine Schwelle** (`bytes < 14 * 1024`) auf einem fixen 16-Slot-Board (das feste Board der
`e2e-isolated.sh`-Fixtur, siehe `e2e/harness.ts` — die Suite spawnt eine konstante Slotzahl, keine
zufällige). Die nicht-deterministischen Felder ändern die Bytegröße pro Poll um niedrige
zweistellige Beträge (der Kommentar in `e2e/tasks.ts:582` nennt „20 B Lauf-zu-Lauf-Varianz" zwischen
zwei gemessenen Läufen: 13 033 B und 13 053 B), die Decke liegt ca. 1 000 B darüber — drei
Größenordnungen unter der Regression, die er fangen soll (ein 15-KB-Prompt). Normalisierung war also
nie nötig: die Schwellenwert-Form macht Feld-Determinismus irrelevant, sie braucht nur
Größenordnungs-Stabilität, und die ist gemessen vorhanden.

## Kosten (des bereits existierenden Checks, gemessen am Diff)

- **Zeilen:** `e2e/tasks.ts:566-641`, 76 Zeilen inklusive Kommentar und vier Folge-Checks zu Brief-
  Digest-Verhalten (derselbe Block prüft mehr als nur die Decke — die Decke selbst ist 2 Checks,
  Zeilen 575 und 589).
- **Laufzeit:** keine `sleep`/Poll-Schleife im Block — ein `POST /api/tasks`, zwei `GET
  /api/sessions`, ein `GET /api/tasks`, ein `POST /brief`, zwei weitere `GET /api/sessions`/`GET
  /api/tasks`. Reine HTTP-Roundtrips, keine Timing-Annahme — die Klasse von Flake, vor der
  `docs/verify-tiering.md` bei Pane-Beobachtung und `stalled`-Fixtures warnt (§11.2c), trifft diesen
  Check strukturell nicht, weil er nichts über Wanduhrzeit beobachtet.
- **Wartung:** die Decke (14 KiB) wurde bereits einmal nachgemessen und verschoben (Kommentar
  nennt die Migration von einem 28-Slot-Board auf das jetzige 16-Slot-Board, remessen am
  2026-08-24) — sie ist also as-a-fact schon einmal gepflegt worden, nicht nur geschrieben und
  vergessen.

## Urteil

**Nicht dispatchen.** Der Check existiert, läuft seit einem Monat in der Isolated-Suite
(`e2e-isolated.sh`, Tier 2) mit, ist in keiner der acht dokumentierten Flake-Familien genannt, und
die Konstruktion (Schwellenwert statt Bytevergleich) macht ihn gegen die nicht-deterministischen
Felder im Handler robust — es gibt nichts nachzurüsten. Die einzige reale Lücke: `docs/data-saver.md`
§4 nennt weiterhin nur den manuellen `curl | wc -c`-Weg als Verifikation und verweist nicht auf den
e2e-Check — das ist ein Ein-Zeilen-Doc-Fix (Verweis ergänzen), keine Bau-Aufgabe, und außerhalb des
Auftrags dieser Lane (Messen, nicht Bauen).

Die dritte Handlungsoption aus dem Auftrag („anders schneiden") entfällt: es gibt keinen Schnitt zu
ziehen, wenn das Ziel schon steht.

## Was nicht geprüft wurde

- Ob die 14-KiB-Decke auch bei mehr als 16 Slots (ein größeres Live-Board) proportional hält — nur
  das feste Fixture-Board wurde gemessen, nicht skaliert.
- Ob `e2e/transport.ts` und `e2e/slots.ts` dieselbe Schwellenwert- statt Bytevergleich-Bauart wie
  `e2e/tasks.ts` konsequent durchhalten — nur die zitierten Zeilen wurden gelesen, nicht die
  vollständigen Dateien.
- Kein Check wurde in dieser Lane gebaut oder ausgeführt (Auftrag: nur Messen). `GET /api/self/gate`
  wurde vor dem Report abgefragt (`localProof.steps`) für die Beweiskette dieser Lane, nicht für
  den e2e-Check selbst.
- Der Video-Beleg (P80/P82/P83, fremdes Projekt) wurde nicht erneut geprüft — nur die Behauptung
  über den eigenen Code-Stand in `video-memory-theo-2026-08-25.md` §K3 wurde gegen `e2e/` verifiziert
  und als falsch befunden.
