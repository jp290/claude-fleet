# Wie gut kann eine gespawnte Session diese Maschine benutzen? — Selbstmessung und Rangliste

**2026-08-07 · Untersuchungs-Lane `fleet/260807110850-be5d` (Slot 1, Fable 5) · Baum `c72fd14` · Queue-Zeile `08689f7f`**

**Owner-Auftrag, wörtlich:** „untersucht wie wir es am besten hinbekommen das spätere Sessions,
benutzt durch dieses Claude Fleet programm, zumindest annähernd so gut darin sind das programm
selbst effizient zu benutzen wie die main session die ja währenddessen selbst daran arbeitet".

**Methode.** Ich BIN der Untersuchungsgegenstand: alles, was einer frisch gespawnten Session
fehlt, fehlte mir heute auch. Jede strukturelle Aussage unten ist entweder an mir selbst gemessen
(wörtliche Ausgabe, `file:line`, Ledger-Zahl) oder als GESCHLOSSEN markiert. Das Dokument liegt in
`docs/`, weil es dasselbe Genre ist wie `agent-visibility-2026-08-06.md`: eine datierte Messung
mit Rangliste, auf die spätere Zeilen zeigen können.

---

## §1 Prämissen-Prüfung: „der Abstand" ist kein einzelnes Ding — und ein Viertel davon ist unschließbar, aber unbeteiligt

Der Abstand zwischen Main-Session und gespawnter Session zerfällt in vier Komponenten mit
verschiedenen Fixes:

- **(i) Fähigkeits-Unwissen** — die Session weiß nicht, was sie fragen darf. Gemessen, §2.4–2.6.
- **(ii) Sensoren, die außerhalb des Haupt-Checkouts lügen** — Absenz sieht aus wie Null.
  Gemessen an mir, §2.2.
- **(iii) Aufmerksamkeits-Verfall** — Text, der beim Spawn gelesen wurde, bindet nicht am
  Handlungsmoment. Gemessen (Vorgabe aus dem Gründungsbrief, nicht neu hergeleitet): alle vier
  Lanes des Tages trugen das Suite-Vorschau-Verbot samt Begründung wörtlich im Brief; eine fuhr
  trotzdem, 8 min Mutex neben zwei wartenden Lands.
- **(iv) Das Baugeschichte-Verständnis der Main-Session** — sie ist gut in Fleet, weil sie AN
  Fleet arbeitet. Das erbt keine Kopie und kein Brief. **Aber: keiner der heute gemessenen Fehler
  brauchte es.** Mein eigener Gründungsbrief — von der Main-Session, dem Experten, von Hand
  geschrieben — trug zwei rottende Zeiger: `briefs/lane-brief-template.md` (liegt in `docs/`) und
  den Vergleich mit `git show main:CLAUDE.md` (unmöglich, §2.5; als „der Vergleich ist selbst ein
  Datenpunkt" evtl. beabsichtigt). Expertise schützt nicht vor rottenden Zeigern. Mechanismen,
  die Fragen zum Abfragezeitpunkt beantworten, schon.

**Teil-Zurückweisung der Frage:** „annähernd so gut im *Benutzen*" ist erreichbar — die messbaren
Kosten liegen vollständig in (i)–(iii), und für jede gibt es einen Mechanismus (§3). „So gut im
*Verstehen*" ist nicht erreichbar und muss es nicht sein.

## §2 Gemessen — an mir, heute, in der ersten Stunde

1. **Pane-Env:** `env | grep FLEET` → genau `FLEET_SELF_TOKEN` + `FLEET_SELF_SLOT` (+ `TMUX`).
   Bestätigt die CLAUDE.md-Zeile; kein `$FLEET_HOST`, die Self-Calls brauchen den Host wörtlich.
2. **`./state.sh` aus der Lane log dreifach, still** (gemessen an Baum `c72fd14`, vor dem Fix):
   (a) `outcomes 0 | post-land audits 0` — der Haupt-Checkout hielt real 136 Outcome-Zeilen
   (`wc -l lane-outcomes.jsonl`, read-only gelesen); `rows()` fing das Fehlen und lieferte `[]`.
   (b) der echte Live-Server erschien als `stray pid … cwd ~/claude-fleet <- not the fleet`, weil
   Server-cwd gegen `$PWD` verglichen wurde. (c) die Health-Check-Zeile druckt die
   *Platzhalter*-IP aus `watchdog.sh`, direkt unter einem Config-Sensor, der den echten
   `.env`-Wert kennt. **Der Fix zu (a)+(b) ist WÄHREND dieser Untersuchung gelandet**
   (`84b092d` + `e622f23`, Zeile `2009cd14`) und wurde aus dieser Lane gegen das
   Abnahmekriterium aus Posten 2 nachgemessen: Anker über
   `git rev-parse --git-common-dir` (`main:state.sh:21`), aus dem Worktree jetzt
   `outcomes 137 | post-land audits 69 | {'green': 52, 'red': 17}` und `LIVE pid …` — echte
   Zahlen statt Nullen, der Live-Server korrekt erkannt. **(c) bleibt offen.** Methodische
   Fußnote, ehrlich: mein erster Re-Test lief als Kopie aus dem Scratchpad und produzierte ein
   FALSCHES Rot (der `dirname "$0"`-Anker griff daneben) — erst der Lauf aus dem Worktree mit
   restaurierter Datei zählte. Ein Abnahmekriterium ist nur so gut wie der Ort, von dem aus man
   es misst.
3. **`./register.sh` aus der Lane funktioniert — absichtlich:** `register.sh:30–38` prüft
   `[ -f fleet.json ]` und fällt sonst über `git worktree list --porcelain` auf den
   Haupt-Checkout zurück; der Kommentar (`register.sh:13–14, 30–33`) trägt das Warum. Es zeigte
   mir sogar meine eigene Zeile (`08689f7f`). Das ist das kopierbare Muster für Posten 2.
4. **Die Self-API ist besser als ihr Ruf — wenn man von ihr weiß.** `GET /api/self/drift`
   lieferte mir `behind:0, wouldConflict:false, dirty:false` UND `otherLanes` mit den in-flight-
   Dateien beider Nachbar-Lanes. `GET /api/self/gate` lieferte das live Gate-Kommando und
   `suiteLock: {pid, alive:true, heldMs:254313, state:"held"}` — die Frage „darf ich jetzt eine
   Suite starten?" ist heute in einer Sekunde beantwortbar, BEVOR man den Mutex acht Minuten
   hält. Die Lane aus (iii) hätte es sehen können; nichts sagte ihr, dass es das Feld gibt.
5. **Das Regelbuch ist aus einer Lane per git unerreichbar:** `git show main:CLAUDE.md` →
   `fatal: path 'CLAUDE.md' exists on disk, but not in 'main'` — die Datei ist untracked, es gibt
   keinen git-Weg zur kanonischen Fassung. Der einzige Drift-Sensor ist `rulebookDrifted` auf
   `/api/self/gate` (bei mir `false`).
6. **Der Gründungsprompt einer dispatchten Lane trägt null Fähigkeitswissen:**
   `grep -c 'api/self\|FLEET_SELF' enhance-prompt.ts` → **0**; `briefAndSend`
   (`server.ts:2176 ff.`) sendet `next.brief?.text ?? next.text`, sonst nichts. Die eine Ausnahme
   ist der Clarify-Pfad: `clarify-prompt.ts:31–32` schreibt die criterion-URL wörtlich aus und
   begründet es („a lane pane carries FLEET_SELF_TOKEN … no $FLEET_HOST to expand").
7. **Der Ledger-Dreisatz — der Träger bestimmt die Nutzung** (`audit.jsonl`, read-only):

   | Fähigkeit | Träger | Nutzung, je |
   |---|---|---|
   | `self/drift` | CLAUDE.md-**Pflichtschritt** („Vor dem Done-Report Drift prüfen") | **59** Events, 8 Slot-Tage |
   | `self/criterion` | **Gründungsprompt** der Clarify-Lanes | **4** (`criterion_proposed`) |
   | `self/verify-intent` | **keiner** (in CLAUDE.md 0×, im Brief 0×) | **0** — nie gerufen |

   Eine gebaute Fähigkeit ohne Träger hat null Verwendungen. (`self/gate` schreibt kein
   Audit-Event — seine Nutzung ist unmessbar; ehrliche Lücke, §5.)

## §3 Rangliste — vier Posten, dann Schnitt

### 1. Die Fähigkeitskarte gehört in den Gründungsprompt — deterministisch, serverseitig, für jede Lane

`briefAndSend` hängt an jeden Brief (kompiliert wie roh) einen festen ~12-Zeilen-Trailer nach dem
Vorbild `clarify-prompt.ts:31–32`: die Self-Calls mit ausgeschriebener URL (drift vor dem
Done-Report; gate **vor jeder Suite** — `suiteLock` lesen; criterion, wenn mitten in der Arbeit
das Kriterium kippt; verify-intent beim Start des eigenen Gate-Laufs), `./register.sh` und
`./state.sh` für Queue und Zustand (beide seit `e622f23` lane-fest), und die 409≠401-Semantik. **Nicht** in den Enhancer (Modell-Output,
driftet pro Task) — deterministischer Code: getrackt, reviewt, gate-gedeckt, im Gegensatz zur
CLAUDE.md-Kopie.

- **Warum Rang 1:** (a) der Gründungsprompt ist der einzige Kanal, der *jede* Lane erreicht —
  auch die im fremden Repo, die das volle Self-Token trägt, aber Fleets CLAUDE.md nie gesehen hat
  (`briefs/session-capabilities-2026-08-07.md` Teil 1, Slot-8-Messung); (b) der Dreisatz §2.7.
- **Kosten:** ~200 Tokens pro Spawn; eine weitere Textstelle in Pflege — aber die einzige mit
  Review und Historie.
- **Kaputtmachbar:** Überstopfung verwässert den kompilierten Brief (`docs/tailored-context.md`
  §5 — kuratieren, klein halten); ein Fehler im Trailer erreicht sofort alle Lanes → ein Pin in
  `e2e/`, dass der Trailer die vier Routen nennt.
- **Messung in einer Woche:** `verify_intent`-Events > 0 (heute: 0 je); Anteil der nächsten 20
  gelandeten Lanes mit ≥1 Self-Call. Schwellenlogik wie `agent-visibility` §4-3: unter 20 % ist
  auch dieser Träger widerlegt — dann stoppen, nicht nachschärfen.

### 2. Absenz darf nie wie Null aussehen — der `Measured`-Kontrakt gilt auch für Skripte

Der Server hat die Sprache (`Measured<T>`, seit `9940ac3`), `register.sh` druckt
„ungeprüft"/„UNBEKANNT" wörtlich — und der während dieser Untersuchung gelandete state.sh-Fix
(`84b092d`+`e622f23`) erfüllt den Kontrakt jetzt für zwei der drei Instanzen aus §2.2, mit dem
besten bisher gebauten Anker (`git rev-parse --git-common-dir` statt `git worktree list`-Kopfzeile).
Was von diesem Posten BLEIBT: *(a)* Instanz (c) — die Platzhalter-IP im Health-Hinweis — ist noch
offen; *(b)* die Regel als eine Zeile Review-Norm, damit das nächste Skript sie nicht neu lernen
muss: *jedes Skript, das Haupt-Checkout-Daten liest, ankert über `--git-common-dir` — oder druckt
das wörtliche Urteil „UNKNOWN … (not the same as none)". Nie eine stille Null, nie ein
Platzhalter-Wert als Fakt.*

- **Kosten:** Minuten pro Skript. **Kaputtmachbar:** fast nichts — schlimmstenfalls Geschwätz.
- **Messung:** `./state.sh` aus einer Lane: null stille Nullen (seit `e622f23` erfüllt,
  nachgemessen §2.2); Instanz (c) aufgelöst oder beschriftet; neue Skripte im Review daran
  gemessen.

### 3. Verbote an den Handlungsmoment verlagern — Text am Spawn ist dafür belegt-unzureichend

Für das eine gemessen gescheiterte Verbot (Suite-Vorschau neben wartenden Lands): der
Preview-Einstieg fragt den Lock-/Land-Zustand ab, bevor er startet — die Information existiert
schon strukturiert (`suiteLock` + seit `c72fd14` die wartenden Lands), sie muss nur am
Startpunkt der Vorschau stehen statt im Brief vom Morgen. Degradation OFFEN: kein erreichbarer
Server → Lauf wie heute (isolierte Suiten bleiben unberührt).

- **Kosten:** Shell + eine Abfrage. **Kaputtmachbar:** ein Block, der fälschlich Gate-Läufe
  trifft — der Eingriff darf nur den Vorschau-Pfad betreffen; ob `e2e-stage.sh` Preview- von
  Gate-Läufen heute unterscheiden kann, habe ich **nicht geprüft** (§5) — das ist die erste
  Frage einer Umsetzungs-Lane, nicht dieser Untersuchung.
- **Messung:** Vorschau-Starts, während ein Land auf den Mutex wartet, pro Woche (aus Trail +
  Gate-Log ableitbar) → 0. Heute: mindestens 1 an einem einzigen Vormittag.

### 4. Der Ternary-Flip (Zeile `526ecd5e`) — dieselben Antworten für plain sessions, NACH 1–3

Vollständig ausgearbeitet in `briefs/session-capabilities-2026-08-07.md` Teil 3, samt Kosten
(`e2e/self-token.ts:25` ist die aufgeschriebene Gegen-Entscheidung und muss bewusst umgedreht
werden; `PRE_AUTH_ROUTES`-Review; eine schmale neue Selbstzustands-Route). Mein Beitrag ist nur
der **Rang**: nach 1–3. Ein exportiertes Token, von dem die Session nichts weiß, reproduziert
exakt die `verify-intent`-Null aus §2.7 für eine weitere Rolle — der Flip ohne Träger ist
(c) < (a) mit größerer Oberfläche.

- **Messung:** der Slot-3-Heartbeat läuft über das Self-Token statt über `fleet.json`; Nutzungen
  des Confused-Deputy-Pfads → 0.

### ─────────── SCHNITTLINIE ───────────

Mit 1–4 ist die Vorgabe erfüllt: eine Session, die beim Start ihre Fähigkeitskarte bekommt (1),
von keinem Sensor angelogen wird (2), am Handlungsmoment mechanisch informiert wird (3) — auch
als plain session (4) — benutzt die Maschine „annähernd so gut". Gesehen, bewusst **nicht**
empfohlen:

- **Mehr/längere CLAUDE.md-Prosa** — durch (iii) belegt-unzureichend, zusätzlich
  Spawn-Snapshot-Drift (`docs/ungoverned-artifacts.md` §3).
- **Ein Wissens-Store/Index** — zweimal dagegen entschieden (BACKLOG 17,
  `docs/knowledge-currency.md` §2: die Fehlerklasse ist Currency, nicht Auffindbarkeit).
- **`GET /api/self/context` als Aggregat** — bewusst entlang der Nähte geschnitten
  (`knowledge-currency.md` §5b, Amendment); nicht wieder zusammenkleben.
- **`OWNER.md` in die Kopierliste** — hat eigene Zeile (`380d24ee`) und eigene Schwelle
  (`agent-visibility` §4-4); braucht diesen Rang nicht.
- **Der Trail-Leser** (Flake-Ranking als Abfrage) — der benannte „ehrliche Rest" von
  `knowledge-currency.md` §5; senkt die 7-min-Beweispflicht auf Sekunden, gehört aber in die
  bestehende Programm-Linie, nicht in diese Rangliste.

**Übergangs-Empfehlung als Text** (CLAUDE.md ist gitignored, eine Lane kann sie nicht ändern —
darum hier): bis Posten 1 gebaut ist, drei Zeilen in die Lane-Disziplin: *(a)* vor jeder Suite
`suiteLock` aus `/api/self/gate` lesen; *(b)* beim Start des eigenen Gate-Laufs
`POST /api/self/verify-intent` — der Owner sieht „running" statt einer stummen Pane; *(c)* ein
Self-Token überlebt den srv-Restart, und ein 409 heißt „erkannt, falscher Scope", nie „tot".

## §4 Gemessen vs. geschlossen

**Live-Demonstration der Currency-These, unfreiwillig:** main hat sich WÄHREND dieser
Untersuchung zweimal bewegt (`c72fd14` → `e622f23`), und zwar genau an der Datei, die ich
zitierte. Bemerkt habe ich es ausschließlich, weil die Lane-Disziplin den Drift-Check vor dem
Done-Report *vorschreibt* — der Pflichtschritt-Träger aus §2.7 hat sich damit im selben Lauf
selbst belegt, in dem er vermessen wurde. Ohne ihn hätte dieses Dokument einen in-Flug-Zustand
als offen gemeldet, der schon Geschichte war.

**Gemessen:** alles in §2 (wörtliche Ausgaben oben); die Existenz und Zustände der Queue-Zeilen
`2009cd14` (sent → gelandet als `84b092d`+`e622f23`), `526ecd5e`, `380d24ee`, `00e5f771` (sent),
`7c890b09` (done → `c72fd14`).
**Geschlossen:** dass der Trailer die Nutzung hebt — §2.7 ist eine Korrelation über drei Träger,
kein Kausalbeweis; deshalb ist der Wochen-Messpunkt Bestandteil des Postens. Dass Posten 3 die
Inzidenz auf 0 bringt — mechanisch plausibel, ungetestet. Dass Komponente (iv) für die
gemessenen Fehler irrelevant war — Induktion aus den heutigen Instanzen, nicht mehr.

## §5 Nicht geprüft

- `streams/prompts.jsonl` — die (iii)-Messung stammt aus dem Gründungsbrief und wurde nicht
  nachgeprüft (Owner-Prompts; bewusst nicht geöffnet).
- `fleet.json` — per Skript nur `id/status/kind/text` dreier Zeilen gelesen; keine Tokens berührt.
- Ob `e2e-stage.sh` Preview- von Gate-Läufen unterscheiden kann (Posten 3 hängt daran).
- Ob `self/gate` ein Audit-Event schreiben sollte (Nutzung heute unmessbar) — unkostete Beobachtung.
- `briefs/steward-kritik-2026-08-07.md` (592 Z.), `briefs/work-waves-2026-08-07.md`,
  `docs/steward.md` — bewusst zugunsten der Selbstmessung nicht gelesen; die Steward-Seite der
  Frage (eigener Auth-Stil, eigene Blindheiten) ist hier nur über `agent-visibility` §4-2/4-4
  abgedeckt.
- **Fable-5-Datenpunkt:** in ~1 h Arbeit über Tokens, Panes und Credentials ist kein Turn einem
  Safeguard-Flag zum Opfer gefallen — 0 Flags, 0 Umformulierungen nötig.
