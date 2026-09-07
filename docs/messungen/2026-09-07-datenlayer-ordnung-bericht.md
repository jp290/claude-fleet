# Bringen die gequeueten Objekt-Fixes (Studio · Projekt · Task) die Ordnung? — Befund 2026-09-07

Owner-Frage (SOS, 14:3x, woertlich sinngemaess): „Alle Slots belegt, viele warten auf uns. Finde
heraus, ob die gequeueten Fixes der Studio-, Projekt- und Task-Objekte das Ganze aller
Wahrscheinlichkeit nach fixen, weil ab dort die Datenlayer zusammenwirken und die Slots einfacher
und effektiver bespeist werden koennen. Erst nur herausfinden, dann Bericht."

Erhoben von einer Fable-5.1-Session im Haupt-Checkout (Slot 1), read-only, am Baum `88e57a7`
(HEAD) mit Live-Zustand um 14:3x–14:5x. Nichts mutiert, keine Suite gefahren. VERIFIED = am
Code/Ledger/Pane gelesen; INFERRED = abgeleitet.

## 0. Urteil

**Nein — nicht „aller Wahrscheinlichkeit nach".** Die gequeueten Fixes treffen die richtige
Wurzel (Dauerhaftes bindet an den sterblichen Occupant statt ans Program), aber:

1. Sie existieren nur fuer **Program/Task**. Fuer **Studio** und **Repo/Projekt** gibt es
   **keinen einzigen Auftrag**, nur die Hub-Richtung `0544306f`.
2. Die Program-Kette (D1-Schreiber) haengt an einer seriellen Freigabe, deren Voraussetzungen
   **schon gelandet sind** — die Zeilen wurden danach nicht weitergeschaltet.
3. Der Slot-Flaschenhals ist ein **Betriebsdeckel** (`FLEET_DISPATCH_MAX_LANES=1`), kein
   Datenlayer: drei der vier laufenden Lanes wurden von Hand gestartet.

Was die Fixes NACH ihrem Land loesen: dass Antworten, Reports und rote Audits eine MAIN ueber
eine Succession hinweg erreichen — genau das, was heute in vier Panes als „warte auf Controller /
MAIN" steht. Was sie nicht loesen: Durchsatz, Studio-Objekt, Queue-als-Befundregister.

## 1. Gelesen

`./state.sh` · `./register.sh` · `fleet.json` (221 offene Zeilen: auftrag 53, notiz 162,
richtung 6; 68 Programs, 14 `active`; `studios: []`) · `docs/messungen/2026-09-04-datenschichten-audit.md`
· `docs/program-lebenszyklus-architektur-2026-09-04.md` (§-Gliederung) ·
`docs/fleet-hub-overlay-2026-09-06.md` §1–2 · `/tmp/astra-datenvertraege-umsetzungsplan-20260907.md`
(C0–C5) · `/tmp/astra-48h-lage-und-zielprojektion-20260907.md` · alle 16 Pane-Tails ·
`git log` seit 09-04 · `server.ts#DISPATCH_MAX_LANES` (`:2217-2240`) · `server.ts` POST
`/api/tasks/:id/dispatch` (`:26500-26510`) · `watchdog.sh:155` · `lane-outcomes.jsonl`,
`audit.jsonl` (gezielt). **Nicht gelesen:** der Code der Inbox-Routen, Charter-Texte, die
Briefe der pending Lebenszyklus-Zeilen im Volltext.

## 2. Die drei Objekte — was davon wirklich gequeuet ist (VERIFIED)

| Objekt | Zustand im Code | Gequeuete Fixes |
|---|---|---|
| **Task** | `capTasks` raeumt nie nicht-terminale Zeilen (Audit B4); 162 notiz + 53 auftrag offen, 58 notiz ungebunden | C0 `a42aa900` (capTasks-Nullbudget, **ausdruecklich ohne Retention**), N2 `f98facad` (Notiz-Lebenszyklus), W1 `e0113460` (sent, Slot 4), W2 `0f5019ac`, W3 `05611418` |
| **Program** („Projekt") | Inbox-Basis **gelandet** (S3a-i = `d6d5cb2`+`453092c`, Outcome-Zeile Task `c3604ce3`, Program `f170dc46`, `mainAfter 453092c`); Status-Projektion **gelandet** (S2 = `df41b3c`, `merge-base --is-ancestor` ja). **Aber ohne Schreiber:** nichts fliesst hinein | S3a-ii `c464af30` · S3b `417d2be5` · S3c `288f6359` · S3d `74319808` · S4 `8e1e0be4` · S5b `ee47b0f8` · S5c `1832c7eb` · S12 `7ed73694` · Rueckweg `18e87e67` / `c62aa3e9` — **alle `pending`** |
| **Studio** | `server/types.ts#Studio`, Routen `GET/POST /api/studios` existieren; **0 Studios live** | **keiner.** Owner-Satz „das Wichtigste ist, dass Tasks und Studios sauber laufen" (Hub-Doc §1) hat keine Auftragszeile |
| **Repo/Projekt als Wurzel** | Attribut an Slot/Task/Program, kein Objekt | keiner |

## 3. Warum „viele warten auf uns" (VERIFIED an Panes + Doc)

Lebenszyklus-Doc §0: Attention, Report, Event, Watch, Auto binden an
`{slot, openedAt, sessionId}`; `teardownSlotOccupant` raeumt sie bei jeder Succession. Live
14:4x:

- Slot 11 (Astra P1): „Offen: Controller-Land, Schnitt-Disposition und Betriebsnachweis."
- Slot 5 (Astra-Lane): „OFFEN: MAIN muss Quellenkorrektur … veranlassen."
- Slot 3 (Astra Review): wartet auf Rueckgabe, 65 % von 258k.
- Slot 7 (Fleet-Betrieb, 45 %): mitten in einer Succession.
- Attention `3ed63bb8` (einzige `open`) adressiert „CONTROLLER SLOT 10" — der Controller ist
  Slot 6.

Das ist B1/B-A1/B-A2 aus dem Datenschichten-Audit. **Die D1-Kette (S3a-ii → S3b → S3d → S3c)
schliesst genau das** — aber erst, wenn die Schreiber gelandet sind.

## 4. Was die Fixes NICHT loesen — die Ordnungsluecke

**4.1 Der Deckel.** `watchdog.sh:155` setzt `FLEET_DISPATCH_MAX_LANES=1`; `state.sh`
bestaetigt `live=1`. Der Tick startet damit **eine unbeaufsichtigte Lane maschinenweit**.
`audit("task_dispatch")` hat genau EINE Aufrufstelle, die Owner-Route (`server.ts:26507`);
`audit.jsonl` traegt diese Zeile fuer `779eb456` (Slot 14), `34c0d050` (Slot 13), `e0113460`
(Slot 4) — **drei der vier laufenden Lanes sind Hand-Dispatches.** `8a69d6d7` (Slot 5) hat keine
solche Zeile; Startpfad UNBEKANNT. Der Je-Repo-Deckel `779eb456` laeuft auf Slot 14. Kein
Datenlayer aendert diese Zahl. (Nebenbefund: der Kommentar an `server.ts:2222` sagt „repo cap of
2" / „live 2" — die Spawn-Zeile sagt 1; der Kommentar ist stale.)

**4.2 Die Freigabekette ist stale.** S3a-i ist als Task `c3604ce3` gelandet — die Zeile
`30383e62` (derselbe Schnitt, gleicher Briefanker §3-i) steht weiter `pending`: ein Duplikat.
S3a-ii `c464af30` („FREIGABE erst nach Land von S3a-i") und S12 `7ed73694` („erst nach S2")
sind seit `453092c` bzw. `df41b3c` **startbar**, tragen aber die Bedingung, als waeren sie
blockiert. Astras Charter-Abgleich `0dfff4b1` nennt dieselbe Bindung (c3604ce3 ↔ S3a-i).

**4.3 N2 ist startbar.** N1 (`24cd54e`, terminales Land `189f815`, Note `verify.ok true`) ist
auf main; `f98facad` verlangt nur „N1 gelandet" und steht `pending`.

**4.4 Kontextdruck der Astra-MAINs.** Slots 3/5/9/11 bei 65–77 % eines 258 400-Fensters
(Owner-Poll `ctx`). Sie warten nicht nur, sie sind auch bald am Ende — und jede Nachricht kostet
den vollen Rest. Slot 12 (P2) meldet `ctx: null`.

**4.5 Astras eigenes Urteil** (48h-Lage, Abschnitt „Urteil"): „Integration, fachliche Annahme
und belastbarer Abschluss liegen auseinander … Mehr Sessions erhoehen nicht automatisch die Zahl
abgeschlossener Ziele." Ihr Rang-2-Vorschlag — read-only Zielprojektion Kriterium → Task →
Urteil → exaktes Land/Audit (C5) — ist die Antwort auf das Ordnungsgefuehl des Owners und
**noch keine Task**.

## 5. Vorschlag an die Sessions (in dieser Reihenfolge)

1. **Controller (Slot 6):** Freigabekette nachziehen — `30383e62` als erledigt-durch-`453092c`
   (Task `c3604ce3`) schliessen; `c464af30` (S3a-ii) und `f98facad` (N2) sind heute startbar;
   Attention `3ed63bb8` neu adressieren (Requester Slot 11 lebt noch, Empfaenger nicht).
2. **Fleet-Betrieb (Slot 7 / Nachfolgerin):** die D1-Schreiber sind der Hebel fuer „warten auf
   uns", nicht C0. Reihenfolge laut Architektur-Doc §9: S3a-ii → S3b → S3d → S3c; S12 danach.
3. **Deckel (Owner-Akt):** nach Land von `779eb456` entscheiden, ob `FLEET_DISPATCH_MAX_LANES`
   ueber 1 geht (`watchdog.sh` + `launchctl kickstart`). Ohne das bleibt jede zweite Lane ein
   Hand-Dispatch.
4. **Studio (neue Zeile, Traeger offen — Vorschlag Game-Maker-Workflow v2 `b2aa5b45`):** erste
   Auftragszeile „Studio-Datensatz aus `docs/game-maker/workflow-v2.md` einspielen + Weg vom
   Studio-Spawn-Tripel in den Lane-Spawn" — ohne sie ist der Hub eine Ansicht auf ein leeres
   Array.
5. **Architektur (Slot 9):** C5-Zielprojektion als Task filen, read-only, zuerst auf den
   Negativfaellen (GLM `f781c60` landed + green + fachlich rejected).

## 6. Was ich selbst korrigiert habe (Eigenpruefung)

- Erste Fassung behauptete „alle vier Lanes von Hand gestartet" aus einem Feld
  `dispatchedBy`, das es nicht gibt. Die belastbare Quelle ist die einzige
  `audit("task_dispatch")`-Aufrufstelle; damit sind es drei von vier, eine unbekannt.
- „S2 gelandet" stand zuerst nur aus dem Log; jetzt per `merge-base --is-ancestor` und
  Commit-Subject `df41b3c` (D2) belegt. Eine Land-Note traegt `df41b3c` NICHT; wie es auf main
  kam, ist hier nicht rekonstruiert.

## 7. Nicht geprueft

Ob die Inbox-Routen tatsaechlich schon lesbar sind (`GET /api/self/inbox` nicht aufgerufen) ·
ob `8a69d6d7` per Tick oder Program-Grant startete · der Zustand der Codex-Lane auf Slot 5 ueber
den Pane-Tail hinaus · ob `30383e62` bewusst als Nachbesserungs-Duplikat gefilet wurde.
