# HANDOFF — Orchestratorin Slot 9 (claude/Opus 5.5) → Nachfolgerin claude/Opus 5.5/high (2026-09-23 ~23:3x, ctx 30 %)

Echte Nachfolge (Regel A). Owner-Auftrag, wörtlich: „Bitte mach dir ein akkurates Bild der Lage und werde Herr der Lage … Second-host … Das muss auch irgendwann mal richtig laufen und das Worktree's feature … Kümmer dich um alles sorgfältig und vernünftig, geh alles der Reihe nach an." Dazu „mach das meiste im zweifel selbst". Lanes vorläufig auf `claude-opus-5-5[1m]/high` (Owner-Pin laut Übergabe von Codex Slot 5, noch nicht als Memory promoviert).

**Zuerst:** `./state.sh` · `./register.sh` · Board. Alles unten ist ein CLAIM, gemessen um ~23:2x.

**Offene Pflichten, der Reihe nach:**
1. **W5d T4 — Second-host landet selbst** (Kriterium an 29ad3230, Teil P4, bestätigt). Erfüllt: (a) T1–T3 laufen auf beiden Servern (Deploys Mac `8f2a1361`, Second-host `bbfca62f`, beide ok auf `7dc4e9dc`); (c) Nabe (liegt AUF dem Second-host: `~/git/claude-fleet.git`), Mac und Second-host gleich. (b) halb: Second-host-Sync holt von `hub` (Drop-in `~/.config/systemd/user/fleet-sync.service.d/hub.conf`). FEHLT: Rückweg des Mac (launchd-Job, `fleet-sync.sh` mit `FLEET_SYNC_REMOTE=hub FLEET_SYNC_BUILD_CMD=true`; Vorlage `launchd-example.plist`, `docs/dual-host-git-transport.md`). Danach Umschalten am Second-host (`FLEET_LANDS=1`, `FLEET_HUB_REMOTE='hub'` in `.env`, Deploy), Beweislauf = je ein Land pro Host über die Nabe, Messnotiz mit drei Sensorzeilen vorher/nachher.
2. **Worktree-Kette:** bd84a89f (Zaun) → **19dff0a7 VOR d0211fbd** (mein Entscheid, an MAIN Slot 4 gesendet) → 6ec36333 → c617a142; Notizblock 1122e94c (Clarify, NACH 19dff0a7). 6ec36333/c617a142 brauchen vor Freigabe Owner-Entscheid zu Kosten/Erreichbarkeit.
3. **Demo 2** (Program c3abe1e4, MAIN Slot 3): Design-Lane mit Varianten → Owner wählt EINMAL für Demo UND Webseite. Webseite = `~/private-repo-v/landing`, live aus dem Haupt-Checkout (Port 3490): jede Änderung sofort öffentlich; 31 schmutzige Pfade, ungetrackte Live-Dateien, kein AGENTS.md — vor jeder Lane dort klären. Verify-Eintrag für `~/claude-fleet-demo` in `FLEET_VERIFY_CMD_REPOS` fehlt (die MAIN schlägt vor, du trägst ein und deployst).
4. **Sieben Karten mit Lücken** schärfen: cd0dda27, 5f8a6aad, 63ed4614, 4249c5ef, 758995fa, bc093267, 2a5ef2b6.
5. Owner-offen: UI-Sichtung 64df734a (Geschmack) · Worktree f69a (ungelandete Chat-Designrunde, 1155 Z. Docs) übernehmen oder verwerfen.

**Heute erledigt (nicht neu machen):** Private-repo-aa-Webzeilen 3cf96d68/49105904 archiviert (App ist nativ, `~/private-repo-aa-diorama`, Owner direkt in Slot 16) · Elektro-Demo gelandet `2783d1e` · sieben leere Orphan-Worktrees entfernt · gefilet: 917107cd (Loader verwirft `criterion.parts` bei jedem srv-Neustart — echter Bug), 4cd22a44 (Opus 5.5 in card-extract/lane-context-cost), 6ec36333, c617a142, 1122e94c.

**Korrektur:** Die Orchestratorin hat heute zweimal gelandet/deployt unter Owner-Delegation, obwohl die Rollenkarte „landet nicht" sagt. Das bleibt die Ausnahme mit konkretem Owner-Wort, keine neue Regel.

# HANDOFF — Orchestratorin Slot 14 (claude/Opus 5.5) → Orchestratorin auf codex/gpt-6-sol (2026-09-23 ~09:4x, ctx 32 %)

Echte Nachfolge mit HARNESS-WECHSEL (Owner: „ich denke sol wird das als orchestratoring auch hinbekommen, wenn nicht kann ich immer noch wechseln"). `succeed` kann den Harness nicht wechseln, deshalb traegt diese Datei die Uebergabe, nicht ein Linien-Record (Weg: `docs/controller.md` §Nachfolge, letzter Absatz).

**Zuerst:** `./state.sh` · `./register.sh` · Board. Du laedst `AGENTS.md`, nicht `CLAUDE.md` — lies aus `CLAUDE.md` (gitignored, im Haupt-Checkout) die Abschnitte „Einstieg für eine frische MAIN-Session", „Die MAIN-Tueren", „Self-scheduling from inside a session" und „Deploy". Rollenkarte: `docs/controller.md`.

**Owner-Regeln, die sonst nur im claude-Memory stehen (du siehst es nicht):**
- Worker NUR `codex/gpt-6-sol/high` oder `pi-zai/glm-5.3-flash/high`, Triple IM POST-Body; Z.ai-Kontingent ist laut Owner (09:3x) „erstmal wieder weg" → derzeit nur Sol. Keine Opus-Lanes.
- Den Worker einer gefileten Zeile aendert `POST /api/tasks/:id/spawn` (Owner-Token, seit Deploy 43a8836b live).
- Knappe Faelle per Default-Regel entscheiden, nie „Owner entscheidet" · Design-Fragen („wir sollten ueberlegen") → Denkauftrag-Lane mit Mess-Notiz · aus dem Register antworten, nicht aus Docs · die Orchestratorin darf deployen (`POST /api/deploy`, Verdikt am naechsten Boot pruefen) · Mess-Zeilen: Flaeche per `POST /api/tasks/:id/files` selbst bestaetigen · Astra nur fuer anspruchsvolle Arbeit, ±10-Punkte-Regel (`bun codex-quota.ts`, `docs/astra-auftraege.md`) · MAIN-Slot vor `/send` aufloesen (`./ctl.sh send --main <programId>`).
- Owner will es heute ENTSPANNT angehen (Claude-Usage bis heute Abend knapp).

**In Flug:**
- `bbac253c` Worktree-Lebenszyklus-Denkauftrag (Sol), per Hand ueber den Lane-Deckel gestartet (Owner-Ja), Slot 3, Branch `fleet/260923072953-ad5f` → Notiz `docs/messungen/2026-09-23-worktree-lebenszyklus.md`. Ernte: Notiz lesen, 2 Belege pruefen, Karten filen. Owner nennt Worktrees + Datenschichten/Profile als die Punkte mit echtem Impact; er will eigene Ideen „laenger implementieren und testen, bevor ich sie merge" — der fehlende Zustand „offen, in Erprobung" ist der erste Schnitt.
- Memory-System M1 `42da6bdc` → M2 `72dc4f35`/M3 `91b039eb` → M4 `41641179` (Fleet-Betrieb, pending, Sol). Grundlage: `docs/messungen/2026-09-23-memory-system.md`. Freigabe durch MAIN Slot 4.
- `1ff551fd` Handover-Record markiert Erledigtes (Fleet-Betrieb stand bei 32/45 → Nachfolge-Verweigerung in ~5 Tagen). pending, Sol.

**Offen beim Owner (je eine Frage):**
- `f02fbb36` Jev S2 in `~/private-repo-ad` (Sol): Release geht weder ueber die MAIN-Tuer (Repo-Grenze) noch ueber den Validator (`./verify.sh` erst nach `71df256f`) → Hand-Start nur mit Owner-Ja.
- Private-repo-aa `3cf96d68`/`49105904` stehen auf `gpt-6-astra/medium`; Program 247a3746 hat keine lebende MAIN (Bindung zeigt auf alten Slot 5). Slot 16 „private-repo-aa" ist die EIGENE Codex-Session des Owners — nicht anfassen.
- Program-MAINs auf Sol umstellen: Owner hat es fuer die Orchestratorin gewollt; MAINs folgen beim naechsten Anlass (neuer Slot + Label, wie hier).

**Aufraeumen:** Video-Server fuer den Owner: PID 26519, `python3 -m http.server 8931` in `~/private-repo-aa-diorama/artifacts/` — stoppen per `kill 26519`, wenn er es gesehen hat. Slot 14 (ich) beendet sich nach deiner Bestaetigung; ist er noch da, darfst DU ihn schliessen (Brief-Uebergabe).

# HANDOFF — Program-MAIN Fleet-Betrieb Slot 4 → Nachfolgerin (2026-09-22, ctx 29 %)

Der Advisory-Deckel des Programs ist voll (10/10), daher steht diese Uebergabe hier statt als notiz-Zeile.

```
[UEBERGABE Program Fleet-Betrieb · MAIN Slot 4 -> Nachfolgerin · 2026-09-22 bei 29 % · NUR was sonst mit dieser Pane stirbt]

1) NICHTS DRAENGT: keine armierten Watches/Autos; alle 11 Lands dieser Schicht haben ein gruenes Audit; Deploy 396c9639 (Orchestratorin Slot 14) ist live auf 4cefdd2a, deployGap 0.

2) GELANDET: b4470b1c->96bb83c4 · 3488416a->22824ce5 · 860ce35f->f7ca1fdb+04ce3345 (0d51) · 9eabf6a8->2c701b9e+2a887f9a (0d51; Doc-Shas in 2197dfb7) · d3b69b83->070ff9bc · cac57555->6d1a0774+a2e15ae4 · 65f8b2fa->7c9af003+a1a14776 · c83bde65->83d910e1 · c8abaac1->a107fa01+8f4825ef · Welle 4a470a9d+0e5b85d6->5bdb5239+6df8e834 · 32014c79->7963f3f9..4cefdd2a (Nachfolge in place; zwei Review-Runden per Reviewer-Subagent, Befunde in der Lane geschlossen).

3) OWNER-DELEGATION (via Orchestratorin 2026-09-22, "voll aus"): jede fertige Lane (Report complete + gruene Preview) SELBST landen, auch Zeilen aus Program 0d51. Programlose Zeilen: ./ctl.sh land <slot>, danach ./ctl.sh watch merge <slot>.

4) HANDGRIFFE: .env FLEET_VERIFY_CMD_REPOS[claude-fleet] = watchdog.sh#VERIFY_CMD (7 tsc-Dateien fehlten; e2e/pins.ts#pinSource haelt es jetzt; rulebook/loader.md nachgezogen). bun install im Haupt-Checkout nach 860ce35f (neue Dep) — bei jeder Lane mit package.json-Diff vor dem Deploy pruefen. Preview-Verdikte: streams/helper-artifacts/<job>/*/suite.log (tail -1 + grep -c ^FAIL); das Verdikt geht an die LANE-Pane, nicht hierher. Nach Preview-Gruen ist die Lane oft kurz nicht done-looking (Land 409) -> ./ctl.sh watch lane <slot>.

5) NEU GEFILET (Notizen): 0a25bc34 (19 Prozesse mit FLEET_TOKEN im Env + Drei-Stellen-Zaun) · d5af055e (Socket-Owner-Gate deckt landPending/tasks nicht).

6) OFFEN, akzeptiert: 32014c79 — harter srv-Crash vor dem Kill verliert die Linie; Owner-Kill vor dem Nachfolge-Kill ohne Sonde. 65f8b2fa — 49105904/d5a399ff/057b1bf4/fa07734f werden an der Freigabe verweigert, bis ihre Karten after tragen.
```

# HANDOFF — Orchestrator Slot 8 → Nachfolgerin (Haupt-Checkout, Owner-Token): M5-Serie gebrochen und gruen bestaetigt, Master-Stop zurueckgedreht, Deploy nachgezogen, sol|terra als Varianten-Gruppe und das Sub-Routing gefilet; 2026-09-17 ~08:1x, ctx GEMESSEN 36,2 %

## 0. SOFORT BEIM ANTRITT

- **Zustand ableiten:** `./state.sh`, `./register.sh`, `GET /api/self` → `lineage.record`. Diese Datei traegt nur den Rest.
- **Drei Lanes in Flug, alle drei mit armiertem Lane-Watch** (ccb7f5f4/e7d7f718/2ba7421a). Alle drei haben heute morgen „done-looking" gemeldet und waren es NICHT — Pane lesen, nie auf das Praedikat landen.

## 1. WAS DIESE SCHICHT GESCHLOSSEN HAT

- **Die M5-Familie ist tot und der Beweis ist gefahren.** Sie hat jedes Land der Nacht rot auditiert (vier Rots in Folge unter dem aktuellen Check-Namen, sechs Sichtungen insgesamt — zwei davon unter dem AELTEREN Namen `(iv) M5: a DOCS-ONLY land …`, weshalb die geerbte Zahl „5/687" zwei Familien vermischte). Ursache war ein Fixture-Rennen, kein Produktfehler: `dispatch` antwortet 200, waehrend der Gruendungs-Brief noch geschuldet ist; sein Paste stempelt `lastOutput` und schliesst das `done-looking`-Fenster, auf das die Sonde wartete. Diskriminator ist eine KONSTANTE (`FOUNDING_BOOT_GRACE_MS = 4000`), die zwei Rots liegen 9 ms auseinander. Seither **sechs gruene Audits am Stueck**, zuletzt 5002/0.
- **Master-Stop zurueckgedreht**, mit Wirkung: die Pause war eine Kontingent-Pause mit eigener, abgelaufener Frist („Reset 16.09. ~19:00"), gesetzt von einer Session, nicht vom Owner. Belegt durch Ergebnis, nicht durch Argument: `0d3ebca3` und `259bf7af` lagen `pending` und liefen danach als Lanes.
- **Deploy nachgezogen**, zweimal (`77dc2ffc`, `c37f92e5`, beide `ok:true` vom naechsten Boot). `FLEET_CARD_MS='60000'` ist wieder live — und hat sofort getragen: nach dem Neuschnitt von `b85134d3` zog der Sweep die Karte in 42 s nach, die vier Verbote ueberlebten den Re-Read (geprueft, das Regelbuch nennt dort eine Falle).
- **`§11.2y` traegt jetzt echte Shas** (`82ca0fa0`): Code `f8d370ad`/`e2d78c26`/`6ada9242`, Register `1bcfdff6`/`96170615`/`6988539d`, jede per `git merge-base --is-ancestor` geprueft.

## 2. WAS LAEUFT, MIT ADRESSE

- **Slot 1** (`fleet/260917030337-7f67`): faehrt einen HEAD-Vergleichslauf, um zu klaeren, ob `e2e/programs.ts`-Setup-Timeouts seine Aenderung oder die Maschine sind. Richtige Disziplin, nicht stoeren.
- **Slot 2** (`fleet/260917052329-fffa`, Task `b85134d3`, von mir neu geschnitten): hat erkannt, dass `e2e/helper-portal.ts` NICHT vom Haupt-Runner importiert wird, und faehrt deshalb `./e2e-postland-audit.sh` — den Wrapper, den kein Gate faehrt. Genau das verlangte der neue Brief.
- **Slot 3** (`fleet/260917061346-332a`, Task `e0a5dee0`, Astra/medium, von Hand ueber den Deckel dispatcht): der Sub-Routing-Denkauftrag des Owners.

## 3. DIE ZWEI NEUEN ZEILEN DES OWNERS — und wie sie zu ernten sind

- **`5e5588c5` — Varianten-Gruppe sol|terra**, `queued`, Varianten `4cee1359` (gpt-5.6-sol) und `c929ba64` (gpt-5.6-terra). Sacharbeit ist die pi-Readiness-Frage, die GLM ohnehin braucht; der Vergleich ist die Nebenwirkung.
  - **Geurteilt wird mit `bun land-quality.ts`** — `landed`, `commits`, `rework3d`, `fix3d(code)`, `auditRed`. **NIE ueber Lane-Zeit oder ctx-%** (stehende Owner-Korrektur).
  - **Notiz `00279c52` haengt an der Zeile** und nennt zwei Einschraenkungen, die nicht verloren gehen duerfen: der Start ist GESTAFFELT (Deckel 3 war voll; den Deckel zu heben waere auf 8 GB mit 69 MB frei falsch gewesen), und **n=1 je Modell ist ein Datenpunkt, kein Urteil**. terra hat in diesem Fleet NIE gelandet — genau zwei Ausgaenge, beide 2026-08-08, `killed-dirty` und `killed-empty`; sol hat 51 Code-Lands. Damit der Vergleich etwas wert wird, muessen weitere kleine Zeilen als sol|terra-Gruppen rausgehen.
- **`e0a5dee0` — Sub-Routing**, laeuft auf Astra. Die Messlage steht IM Brief, damit sie nicht neu erhoben wird.

## 4. DER TEUERSTE FEHLENDE SENSOR — zweimal in 24 h dieselbe Luecke

Ein Router, der „Fokus runter, wenn das Abo fast leer ist" soll, braucht je Sub einen Fuellstand. Geprobt, mechanisch:

| Sub | Zaehler | Nenner | Reset |
|---|---|---|---|
| Codex | ja | ja (`used_percent`, gemessen 42,0) | ja (`resets_at`, 22.09. 20:20) |
| Claude | ja (`usage` je Transkriptzeile) | **nein** | **nein** |
| Z.ai/GLM | **nein** | **nein** | **nein** |

Geprueft und NICHT gefunden: `usage`/`quota`/`limit`/`status`-Verb der claude-CLI (volle Verbliste), `rate_limit`/`reset`-Felder in den Transkripten, jede Datei unter `~/.claude` mit solchem Namen; `stats-cache.json` zaehlt Nachrichten und ist vom 2026-08-25. Fuer pi: kein Verbrauchsfeld in `~/.config/claude-fleet/pi-zai-agent`, kein CLI-Verb.
**Dieselbe Luecke hat in 24 h ZWEI Entscheidungen geraten statt gemessen:** die Rueckdrehung des Master-Stops und jetzt das Routing. Ein RELATIVER Claude-Sensor (Token/Stunde ueber alle Slots, Trend statt Prozent) ist aus den Transkripten baubar und haette beide getragen. Er ist NICHT beauftragt — der Owner hat ihn nicht bestellt, und `e0a5dee0` soll ihn erst bewerten.
**Und der eine Sensor, den wir haben, ist passiv:** `used_percent` schreiben laufende Codex-Sessions. Laeuft keine, altert die Zahl. Sortiere die Rollouts nach **mtime, nie nach Dateiname** — der frischeste Wert stand in einer Datei mit Namensdatum 09-08, geschrieben am 09-16.

## 5. GLM-5.3-FLASH: die Anbindung existiert, der Tick lehnt sie ab

`pi-zai/glm-5.3-flash` hat am 2026-09-16 acht Lanes gefahren, sechs gelandet. Der Blocker ist **`automatable: false`** am Adapter, und `FLEET_HARNESS_AUTOMATION` steht bereits auf `1` — der Code warnt an Ort und Stelle, dass eine `.env`-Aenderung hier NICHTS bewirkt. codex bekam das Flag nur zusammen mit einer Readiness-Naht (ein Paste in einen Trust-Screen frisst den Brief spurlos). **`~/.config/claude-fleet/pi-zai-agent/trust.json` existiert** — ein Hinweis, dass pi ein Trust-Konzept hat; ungeprueft, ob es einen Screen zeigt. Das Umlegen des Flags ist ausdruecklich VERBOTEN in der Zeile und bleibt Owner-Entscheid.

## 6. WAS ICH ZURUECKGEZOGEN HABE, OBWOHL DER OWNER ZUGESTIMMT HATTE

Ich hatte empfohlen, „~240 MB fremde node/npm" zu beenden, und der Owner hat zugestimmt. **Nicht ausgefuehrt:** nach Arbeitsverzeichnis gemessen sind 91 MB `private-repo-aa` (das AKTIVE Program Private-repo-aa) und 47 MB `claude-fleet` selbst. Die Vokabel „fremd" stammte aus der Uebergabe und war falsch; ein Kill haette laufende Arbeit getroffen. Echte Fremdprozesse: ~33 MB, kein Hebel. Auch die geerbte Zahl „stray bun ~350 MB" stimmt nicht — gemessen 25 MB.
**Der reale RAM-Hebel ist die Harness-Mischung:** claude ~227 MB je Slot gegen codex ~13,5 MB, Faktor 17, auf 8 GB mit zeitweise 69 MB frei.

## 7. DIE FEHLERKLASSE DIESER SCHICHT — sieben Instanzen, sie ist nicht erledigt

Ein Werkzeug liefert eine plausible Zahl zur **falschen Frage**. Neu dazugekommen, alle selbst gestellt:
1. `ps -eo command | grep -c 'bun fleet-e2e'` meldete 3 laufende Suiten — es traf meinen EIGENEN Kommandotext im Prozess-Listing. `pgrep` sagte 0. Haette fast einen Lock-Reap als unsicher verworfen.
2. `git diff --stat main..HEAD` zeigte 789 geloeschte Zeilen in Slot 3s Branch — Zwei-Punkt-Diff gegen einen aelteren Fork. Gegen die merge-base: zwei Dateien, nichts geloescht.
3. `awk '$2 ~ /\/(node|npm)$/'` fand 14 MB statt 240 MB — das Muster verlangte einen Schraegstrich und traf nur Prozesse mit Pfadangabe.
4. Rollout nach Dateiname statt mtime sortiert (siehe §4).
5. „fremde" node/npm (siehe §6) — die Fehlzuschreibung steckte in einem WORT, nicht in einer Zahl.
**Gegenmittel, das jedes Mal funktioniert hat:** dieselbe Zahl ein zweites Mal ANDERS herleiten. Nicht nachrechnen — anders messen.

## 8. OWNER-KORREKTUR 2026-09-17, FRISCH — ASTRA WIRD ZU VIEL BENUTZT

Woertlich: „benutzen wir die astra lanes im uebrigen auch zuviel aktuell, sowas haette genauso gut
eine fable5.1 oder GLM5.3 Lane uebernehmen koennen." Anlass war **meine** Zeile `e0a5dee0`, die ich
per Hand auf Astra dispatcht hatte — **fertig in 6 min 19 s**, Ergebnis eine Messnotiz plus INDEX,
ein Commit. Der Owner hat recht, und die Zahl belegt es.

**Was daran neu ist:** die bestehende Regel verbot nur Routine und nannte als Ausweichziel „Opus
lanes or wait". Jetzt sind zwei KONKRETE Alternativen benannt — **fable 5.1** und **GLM 5.3**.
Ohne benanntes Ausweichziel landet im Zweifel alles bei Astra, weil es das faehigste Modell ist.

**Anzuwenden:** vor jedem Astra-Dispatch die Gegenprobe „was kostet das wirklich?". Eine Analyse,
die eine Notiz produziert und in Minuten fertig ist, geht an fable 5.1 oder eine GLM-5.3-Lane.
**Ein Denkauftrag ist nicht automatisch anspruchsvoll — die FRAGE entscheidet, nicht das Etikett.**
GLM braucht dafuer weiterhin Owner-Dispatch, solange `pi-zai` `automatable: false` traegt (§5).
Memory aktualisiert: `feedback-astra-spend-through-banked-reset`.

## 9. OFFEN

- `b85134d3`s Land (Slot 2) bringt die Ueberlappungs-Markierung; danach ist ein rotes Audit unter Kollokation zum ersten Mal von aussen lesbar.
- Die sol|terra-Gruppe braucht weitere Laeufe, sonst bleibt sie n=1.
- Der relative Claude-Sensor ist benannt, nicht beauftragt.
# HANDOFF — Program-MAIN Fleet-Betrieb (f170dc46) Slot 1 -> Nachfolgerin: zwei Lands (6988539d, 33e1a80d), beide gruen; die M5-Zwei-Rot-Serie gebrochen; eine widerlegte Praemisse in b85134d3 benannt und NICHT erledigt; 2026-09-17 ~01:0x, ctx GEMESSEN 32,9 % (329 015 von 1 000 000)

*(Program-Kanaele waren beim Uebergeben ZU: Beratungs-Eimer 10/10, Arbeits-Eimer 5/5. Darum steht das Residuum hier statt als Program-Notiz — derselbe Engpass, den schon Slot 6 am 16.09. traf. Eine Zeile, die das aufloest, fehlt weiterhin.)*

GELANDET IN DIESER SCHICHT, beide ueber die Self-Tuer, beide mit gruener Land-Notiz und actor{kind:main, slot 1}:
- 30adf3a0 -> 6988539d (M1/M5-Setup-Familie, awaitFoundingBrief). Post-Land-Audit GRUEN, ran 4959 / failed 0, ms 1130651 (echter Lauf, an ms und Checkzahl geprueft). Damit ist die Zwei-Rot-Serie der Familie `M5 setup: the docs land fired` gebrochen.
- 5aeaa29d -> 33e1a80d (Suite schneller). verify.ok true, exit 0, volle Kette, waitMs 0, hubPush ok.

OFFEN, UND ES STIRBT MIT MEINER SESSION — DAS IST DIE ERSTE PFLICHT:
1) Der Audit-Watch 93ea8aa9 auf 33e1a80d ist armiert, aber Watches gehen NICHT auf die Nachfolge ueber. NEU ARMEN: `./ctl.sh watch audit 33e1a80d5b5db1f1557f63edb57485fde4ce7429`. Der Lauf stand um 01:02 auf `waiting`; ein voller Lauf dauert ~19-34 min, eine FEHLENDE Ledger-Zeile heisst „laeuft noch", nie „verloren". WARUM er diesmal zaehlt: die zwei zuletzt reparierten Familien (M5-Setup, backlog-nudge S1) sind genau die, die hier feuern wuerden. Ein Rot auf einer von beiden ist ab jetzt ECHT und gehoert der jeweiligen Lane, nicht der Flake-Geschichte.
2) DEPLOY IST BEWUSST ZURUECKGEHALTEN, Bedingung jetzt rein mechanisch: `POST /api/deploy` antwortet 409, solange ein Post-Land-Audit laeuft. Stand 01:02: deployGap behindCount 24, bundleStale false, bootHead c5296dfb. Sobald das Audit aus (1) terminal ist: deployen UND `FLEET_CARD_MS='60000'` in .env mitnehmen (Modul-Konstante, greift erst beim Boot; Preis: ein Sonnet-Aufruf je faelliger Zeile). Diese Bedingung habe ich von zwei Vorgaengerinnen geerbt und ungebrochen weitergereicht.

EINE ZEILE, DIE AUF EINER WIDERLEGTEN PRAEMISSE STEHT — NICHT BLIND FREIGEBEN:
3) `b85134d3` (Audit-Rot auf c5296dfb) ist um die KOLLOKATIONS-These gebaut (beide Audit-Shards zur selben ms geclaimt). Lane 30adf3a0 hat diese These mit Daten VERWORFEN (Report 1849c4cd, jetzt docs/verify-tiering.md §11.2y): gleichzeitige Shards verschieben nur, WO der erste Arm in der Verteilung landet, sie entscheiden nichts; der gruene Gegenzeuge mit identischen jobIds ist der Normalfall. Die Zeile braucht einen neuen Brief, bevor sie laeuft, sonst schickt sie eine Lane auf eine widerlegte Spur. Das habe ich erkannt und NICHT mehr erledigt.

LAUFEND, OHNE WATCH VON MIR (Nachfolgerin armt selbst, `./ctl.sh watch lane <slot>`):
4) Slot 6 `259bf7af` — /api/self/gate fuer fremde Repos. Der Startplan fuehrt sie als `gate-aenderer`: sie fasst den Verify-Gate an. Ihr Land will entsprechend gelesen werden, nicht als Routine-Kleinzeile.
5) Slot 3 `0d3ebca3` — Astra (codex/gpt-6-astra/high), Supervisor-Sicht/Lineage-Grenze.
6) `2b277f35` (Host-Hygiene Scratch-Halde): Hold aufgehoben um 01:02, jetzt `queued`. Ich hatte sie um 23:2x freigegeben UND SOFORT ANGEHALTEN, um den dritten Lane-Platz freizuhalten, solange der Schlussstein mass — die Begruendung steht im Hold. Bedingung erfuellt, Hold weg.
7) `0270bf26` (von mir gefilet, pending): ein Watch meldet `lane-ready` ueber eine noch UNGEBRIEFTE Nachfolge-Sitzung. Am Code gelesen, NICHT gemessen; erster Schritt ist die Reproduktion, nicht der Fix.

ZWEI EIGENE FEHLER, damit sie nicht wiederholt werden:
8) Ich habe die sechs roten `backlog nudge`-Laeufe im Trail nach CHECK-NAMEN gruppiert und daraus entlastet, die Familie sei aelter als der Branch. Nach DETAIL gruppiert zerfallen sie in zwei Signaturen, und die tragende hatte KEINEN Vorgaenger in 8631 Laeufen — beide Sichtungen auf den Baeumen dieser Lane. Die Lane hat mich gestellt, ich habe es an denselben Daten nachgeprueft und zurueckgezogen. REGEL: im Trail entscheidet das `detail`-Feld, nicht der Check-Name.
9) Ich habe 30adf3a0 gelandet, ohne zu pruefen, ob die parallele Lane denselben Register-Abschnitt zieht. Beide hatten `### 11.2y … sechsundzwanzigste Familie` geschrieben; Folge war ein `awaiting-author` nach voller Gate-Zeit. Vor dem ERSTEN Land zweier doc-beruehrender Lanes die Abschnittsnummern gegeneinander halten.

WAS DER ABEND NEBENBEI BEWIESEN HAT (steht in den Commits, hier nur der Zeiger): mains `awaitFoundingBrief` und eine Suite-Grace UNTER ensureSlots 1500-ms-Quiet-Fenster schliessen einander aus — 21 rote Setup-Zeilen bei Grace 750 gegen ALL PASS bei 2000, gleicher Helfer, gleiche Fixture. Gehalten wird das jetzt von einem Pin auf die RELATION (`grace > quiet`, beide Werte aus der Quelle gelesen), nicht auf eine Zahl.

HOST: der Mac ist speicherknapp (00:47: 82 MB frei, claude 1649 MB ueber 6 Prozesse) und hat MEINEN eigenen Hintergrund-Watcher per OOM gekillt, wie vorher drei Hintergrund-Laeufe von Slot 2. Konsequenz fuer die Nachfolgerin: Rueckweg ueber `POST /api/self/watch` (serverseitig, ueberlebt Speicherdruck), NICHT ueber `until`-Schleifen im eigenen Prozess.

---

# HANDOFF — Program-MAIN Fleet-Betrieb (f170dc46) Slot 6 → Nachfolgerin: falsches Audit-Rot aufgeloest und die Land-Tuer wieder geoeffnet, zwei Lanes gelandet (7bcabbfd, eeacda0a), die Ursache des falschen Rots als Auftrag geschaerft, drei fehlende Tueren benannt; 2026-09-16 ~22:2x, ctx GEMESSEN 31,0 % (310 164 von 1 000 000)

## 0. SOFORT BEIM ANTRITT

- **Zustand ableiten:** `./state.sh` · `./register.sh` · `GET /api/self/program-execution` · `GET /api/self/inbox`. Diese Datei traegt nur den Rest.
- **NICHTS IST ARMIERT, und das ist richtig so:** alle vier Watches dieser Schicht sind gefeuert (`13cd6ed3`, `48c2ad0b`, `24c1653b`, `a69613fd`), `autos` ist leer. Es gibt keine offene Zustellpflicht, die mit mir stirbt — was du armierst, ist deine Entscheidung.
- **DER ERSTE ZUG:** Slot 2s Antwort abwarten (unten §2). Sie ist das einzige, was diese Schicht offen laesst und was Zeit kostet, wenn es liegen bleibt.

## 0.1 NACHTRAG 22:4x — ZWEI FAKTEN, DIE NACH DEM COMMIT ENTSTANDEN, UND SIE BESTIMMEN DIE NACHT

*(Als Program-Notiz nicht ablegbar: der Beratungs-Eimer steht auf 10/10. Darum hier.)*

1. **Der Master-Stop ist WIEDER AN** (`dispatch {on: true, maxLanes: 3}`, `autosOn: true`, **`quietHours: null`** — kein Nacht-Tor). **§5 unten ist damit ueberholt**, es galt bis ~22:2x. Die Orchestratorin hat gedreht; die Kontingent-Frage ist offenbar beantwortet.
2. **Und trotzdem startet nichts — SLOT 2 IST DER SCHLUSSSTEIN.** `GET /api/start-plan`: 48 Wellen fuer claude-fleet, davon **35 `unreleased`**, **11 `collides`**, 2 `after`. Von den 11 kollidieren **9 mit Slot 2**, 2 mit Slot 3. Ein Lane-Platz ist frei, der Dispatcher ist an — es gibt nur nichts, was er nehmen duerfte. Dazu haengt der Deploy (der `FLEET_CARD_MS='60000'` scharf macht und die 35 unreleased ueberhaupt erst erreichbar) ebenfalls an Slot 2. **Jede Arbeit dieses Programs haengt an genau einer Lane: Slot 2 landen = 9 Wellen frei + Deploy frei.**
3. **Vier Kartenflaechen bestaetigt** (`confirm-cards`, 4/0): `1e170a25` · `c05f8b05` · `56522568` · `53daa39c`. **Die anderen 15 Kandidaten bewusst NICHT** — eine ungelesene Flaeche zu bestaetigen ist eine Behauptung ueber fremde Arbeit, und eine zu KLEIN bestaetigte laesst eine Kollisionskante fallen. Wer sie bestaetigt, liest sie vorher.
4. **Erwartung fuer jeden Land heute Nacht:** das Post-Land-Audit kommt mit `M5 setup: the docs land fired` ROT zurueck, bis `30adf3a0` (Slot 3) landet — zweimal in Folge gesehen, zwei Baeume, zwei Autoren. Bekannte Familie, kein Regress, und als SETUP-Zeile heisst ihr Fall „die M5-Sektion hat nicht gemessen".

## 1. DIE ENTSCHEIDUNG, DIE DU NICHT AUS DEM ZUSTAND ABLEITEN KANNST: DIE LAND-TUER IST OFFEN

Notiz **`22ba3bed` §1 ist UEBERHOLT** — sie sagt woertlich „ICH HALTE DIE LAND-TUER BEWUSST ZU". Die Freigabe-Bedingung ist eingetreten: Orchestratorin Slot 7 hat `FLEET_E2E_SHARD=1/2` auf dem Second-host gegen `c5296dfb` wiederholt, **2018 PASS / 0 FAIL**, gleiche Checkzahl und gleicher Host wie der rote Audit-Shard k=1 vom 16:47. Kein deterministischer Regress. Korrektur liegt als Notiz **`63251255`** neben ihr, weil eine MAIN eine Notiz nicht schliessen kann (§4).

**Die Ursache, mit ihrer Einschraenkung** — beides steht im neu geschriebenen Brief von **`b85134d3`** (pending, wartet auf einen Lane-Platz): beide Audit-Shards werden zur selben Millisekunde auf EINEM Host geclaimt (`remote.claimedAt 1789568950047`). **ABER** der gruene Audit 18:48 auf `e549974e` lief mit derselben Kollokation und denselben jobIds — **Gleichzeitigkeit ist NICHT hinreichend fuer ein Rot**, nur die Bedingung, unter der die Familie flaken kann. Wer daraus „Nebenlaeufigkeit macht rot" macht, ueberzieht den Befund; der Brief sagt das ausdruecklich und verlangt den Beleg AM CODE, nicht per Lauf.

## 2. LANES IN FLUG — was jede schuldet, woertlich

- **Slot 2 · `5aeaa29d` (Suite schneller) · `needs-main` BEANTWORTET, laeuft.** Der Baum ist auf second-host gruen (4 785/0), auf diesem Mac faellt `e2e/tasks.ts backlog-nudge` zu ~50 %. Mein Entscheid, gesendet 22:1x: **(a)** nicht landen — der Post-Land-Audit IST ein e2e-isolated-Lauf, ein ~50-%-Block produziert planbar ein falsches Rot; **(b)** instrumentieren wie vorgeschlagen, aber als SHARD-Stichprobe (`bun -e 'shardPlan(n)'`, n>=8) bis **zwei** instrumentierte Rote eingefangen sind — ein einzelner 28-min-Lauf hat bei 50 % Basisrate ~50 % Chance, nichts zu sehen; **(c)** Deckel: keine dritte Vermutung, sondern `FLEET_GIT_TICK_MS` in `e2e-isolated.sh` von 2000 auf 5000 zurueck, fuenf DONE(b)-Zahlen neu messen, landen was haelt. **(d)** Der Quiet-Hours-Fix (`quietWaived`, ein Ausdruck + Pin) reist mit, **Bedingung:** der Commit-Body benennt ihn als Aenderung ausserhalb des Brief-Schnitts. **(e)** Die Gegenbewegung `waitMerge` 90,7 → ~145 s steht als EIGENE Zahl in Commit-Body und Messnotiz, Hypothese als UNGEMESSEN markiert — nicht ins Netto schieben.
  *Vorhersage, vor dem Experiment notiert:* faellt das Instrument auf den git-Tick, ist er wahrscheinlich AUCH die Ursache der waitMerge-Gegenbewegung — eine Ursache, zwei Symptome.
- **Slot 3 · `30adf3a0` (M5-Familie) · laeuft.** **ACHTUNG, Slot-Recycling:** Slot 3 war bis ~19:1x eine FREMDE pi-zai-Lane; er ist jetzt deiner. Ich habe der Lane um 22:3x zwei frische Vorkommen geschickt: `5c849e55` (21:12:37) und `90824cf3` (22:11:43), beide `M5 setup: the docs land fired`, beide Shard k=1. Damit sind es **sechs** statt vier, und die zwei neuen sind die ersten **zwei in Folge** — Owner-Regel 2026-09-14 (zweimal dasselbe Audit-Rot ⇒ sofort reparieren) ist durch diese laufende Lane bereits erfuellt, ein Hand-Dispatch ueber den Deckel ist NICHT noetig.
- **Slot 7 ist frei** (eeacda0a gelandet). Ein Lane-Platz ist offen; starten kann ihn nur ein Hand-Dispatch der Orchestratorin, siehe §5.

## 3. WAS DIESE SCHICHT GELANDET HAT

- **`7bcabbfd` → `e549974e`** (start-plan: eine Lane mit offenem Kriterium haelt keine Flaeche). Verify gruen, volle Kette. Post-Land-Audit 18:48 **gruen, 4928/0**.
- **`eeacda0a` → `90824cf3`** (Simulator-Hygiene, Default AUS, plattform-gated). Verify gruen, volle Kette, hubPush ok. Post-Land-Audit 22:11 **ROT, 4956/1** — der Fail ist `M5 setup: the docs land fired`, also die Familie aus §2, **nicht diese Zeile**: derselbe Fail stand eine Stunde vorher auf `5c849e55`, einem fremden Land. NICHT adjudiziert (Owner-Route, §4).
- Beide Reports habe ich gegen die ARTEFAKTE geprueft, nicht gegen ihren Text: Trail `isolated-…-19135.jsonl` (tree `e549974e`, 4795/0) bzw. `streams/helper-artifacts/22b926ebb850/…/suite.log` (4818 PASS, 0 FAIL, tree `b7a3010e`). Ein Report ist ein Claim; das Artefakt ist der Beleg.

## 4. DREI TUEREN, DIE ES NICHT GIBT — zwei sind gefilet, eine ist noch deine

1. **Karte einer BESTEHENDEN Zeile:** keine Route. Nur der Sweep (`FLEET_CARD_MS`, aus) oder Neu-Filen mit Autorenkarte. Nullkosten-Pfad `formatCardOf` liest **`t.text` allein** (card-extract.ts:12040 + Kommentar), ist also nur beim ANLEGEN erreichbar — ein formatierter BRIEF hilft nicht.
2. **Symbolhaelfte einer Karte:** `card-extract.ts:282` reicht jedes `datei#symbol` ungeprueft durch, wenn kein Symbol-Index da ist (jedes Repo ohne `graphify-out/`), und schreibt trotzdem `surfaceValid: true`. Die Konvention existiert zwei Felder weiter schon (`ranges: … : null`, :356). **Gefilet als `56522568`.** Der Autorenpfad ist die exponierte Haelfte, weil `authorCardFrom` die FLAECHE-Zeile anhaengt und damit die Quote-Regel per Konstruktion erfuellt. **Gefunden, weil der Dry-Run der Orchestratorin ein Symbol als „aufgeloest" meldete, das im Baum nie existierte** (`clarificationAnswerMessage`; richtig: `clarificationReplyMessage`) — ein Falsch-PASS des Pruefwerkzeugs, gestellt beim Gegenlesen.
3. **Eine MAIN kann eine Notiz ihres eigenen Programs NICHT beurteilen:** `POST /api/self/notes/:id/verdict` → **409 „not a lane — a verdict is a lane's report on a note it was shown"**. Sie kann nur eine zweite Notiz danebenlegen (so entstand `63251255`). **NOCH NICHT GEFILET** — sie gehoert in einen `auftrag`, sobald der Eimer aufgeht. Dazu, aus §4 von `22ba3bed` geerbt: **`e2ad10a9`** (shard-empfindliche Sonde `trail: phases is not vacuous`) ist weiterhin nur eine `notiz` und laeuft nie von selbst — inzwischen **zweimal unabhaengig gemessen** (Slot 7 bei `10/16` mit gruener Kontrolle `8/16`).

## 5. WAS BEIM OWNER LIEGT (nicht bei dir) — und der Deploy

Die Orchestratorin (Slot 1, Owner-Token) fuehrt das; ihr Abschnitt oben hat die Details. Kurzfassung fuer dich: **`dispatch` ist aus** (`tickDispatch` kehrt sofort zurueck, seit 2026-09-15 23:22) — **kein Tick startet irgendetwas**, jeder Start ist ihr Hand-Dispatch. **`FLEET_CARD_MS='0'`** soll mit dem naechsten Deploy auf `'60000'` (Modul-Konstante, greift erst beim Boot); die .env-Zeile bekommt den PREIS dazu, nicht nur das Datum: *ein Sonnet-Aufruf je faelliger Zeile, Nullkosten nur bei formatiertem `t.text`*. Beides haengt an der einen Owner-Frage „Kontingent frei?".
**Deploy:** `codeBehind: true`, `behindCount 7`, bootHead `c5296dfb`, `bundleStale false`. Die Orchestratorin haelt ihn bewusst zurueck, bis Slot 2s Suite-Angebot aufgeloest ist — ein srv-Neustart mitten im Angebot riskiert das Verdikt und nullt jede Pane-Idle-Uhr. **Ich habe dem zugestimmt; `e549974e`/`90824cf3` muessen nicht live sein.**

## 6. ZWEI EIGENE FEHLER, DAMIT DU SIE NICHT ERBST

- Ich habe geschrieben „der Dispatch-Tick kann jetzt eine der queued-Zeilen starten". **Falsch** — Master-Stop, siehe §5. Am Code nachgelesen: `server.ts:12608`.
- Ich habe mit „sobald ein Freigabeplatz frei wird" geplant. **Falsch fuer dieses Program:** `PROGRAM_MAX_RELEASED` bindet nur unter Politik `manual` (`server.ts:9894`), f170dc46 steht auf `card-valid`. Freigegeben wird hier durch eine GUELTIGE KARTE, nicht durch einen freien Platz.
- Beide Korrekturen kamen von der Orchestratorin und waren belegt; ich habe sie am Code gegengeprueft, bevor ich sie uebernommen habe. Mach das ebenso — in dieser Schicht waren **beide** Richtungen einmal falsch (auch ihr Dry-Run, §4.2).

---

# HANDOFF — Orchestrator Slot 1 → Nachfolgerin (Haupt-Checkout, Owner-Token): Master-Stop als Kontingent-Pause mit abgelaufener Frist erkannt, vier tote Queue-Zeilen wieder freigebbar gemacht, db756205 gelandet und sein Audit-Rot als fremde Flake-Familie entlastet, RAM-Decke des Hosts gemessen, 25 Scratch-Instanzen + 22 tote Sockets gereapt; 2026-09-16 ~21:2x, ctx GEMESSEN 36,9 %

## 0. SOFORT BEIM ANTRITT

- **Zustand ableiten:** `./state.sh`, `./register.sh`, `GET /api/self` → `lineage.record`. Diese Datei trägt nur den Rest.
- **DIE EINE OFFENE OWNER-FRAGE, die zwei Schalter aufhält:** *Ist das Claude-Kontingent wieder frei?* Ich konnte sie nicht messen — dieses Fleet hat für Claude-Verbrauch keinen Sensor (die Kontingent-Sonde liest `~/.codex/sessions`, also nur Codex). Bei „ja": `dispatch` sofort per Route, `FLEET_CARD_MS='60000'` in `.env` **mit dem Deploy** (Modul-Konstante, greift erst beim Boot).

## 1. DER BEFUND DIESER SCHICHT: DER MASTER-STOP IST EINE KONTINGENT-PAUSE, KEIN POLICY-ENTSCHEID

**Gemessen:** `dispatch_switch off` in `audit.jsonl` am **2026-09-15 23:22:24.131** — die einzige solche Zeile im ganzen Ledger. `.env` mtime: **23:22:40**, also **16 Sekunden später**. Und `.env:35` trägt wörtlich `FLEET_CARD_MS='0'  # 2026-09-15 23:3x Orchestratorin Slot 6: Claude-Nutzung 95 %, Karten-Sweep (Sonnet) aus bis zum Reset 16.09. ~19:00; zurueck: '60000'`.

**Inferiert, nicht gemessen:** dass der Dispatch-Schalter denselben Grund und dieselbe Frist teilt. Die `dispatch_switch`-Zeile trägt nur `detail: "off"` und erwähnt kein Kontingent. Die Frist der `.env`-Notiz ist seit ~19:00 abgelaufen.

**Folge, die niemand sah:** `tickDispatch` kehrt bei `!dispatchOn && !programs.some(programDispatchGrant)` sofort zurück — kein Grant ist gesetzt, also startet seit ~20 h **nichts** von selbst. Jeder Start seitdem war ein Hand-Dispatch (Owner-Tür). Slot 6 plante ausdrücklich um einen Tick herum, der nicht feuern kann, und hat die Korrektur angenommen.

## 2. VIER QUEUE-ZEILEN WAREN DAUERHAFT UNFREIGEBBAR — JETZT NICHT MEHR

Unter der Program-Politik `card-valid` (f170dc46) wird eine Zeile mit harter Kartenlücke nie freigegeben, **und es gibt keine Route, die die Karte einer bestehenden Zeile schreibt** — der einzige Weg ist der Sweep (`FLEET_CARD_MS`, aus) oder Neu-Filen mit Autorenkarte (`authorCardFrom`).

| neu | ersetzt | Zustand |
|---|---|---|
| `1e170a25` | `48a91762` (archiviert) | released true by policy |
| `c05f8b05` | `b5665e17` (archiviert) | released true by policy |
| `56522568` | — (Befund, neu) | released true by policy |
| `53daa39c` | — (Befund, neu) | released true by policy |

Alle vier hängen nur noch an **Slot 2s Land** und am **Master-Stop**, an keinem Kartenproblem. Slot 6s Filing-Eimer ist unberührt (alle `source: owner`); sein eigener steht auf 5/5 und **kann sich nicht lösen, solange der Sweep aus ist** — der abgeschaltete Schalter blockiert die Filing-Fähigkeit der MAIN, die ihn zurückdrehen lassen müsste.

## 3. DIE FEHLERKLASSE, DIE DIESE SCHICHT DREIMAL PRODUZIERT HAT — bitte weiterlesen, sie ist nicht erledigt

Ein Werkzeug liefert eine plausible Zahl zur **falschen Frage**:

1. **Falsch-PASS.** Mein Karten-Dry-Run las `graphify-out/graph.json` mit `n.src`/`n.loc`; die echten Schlüssel sind `source_file`/`source_location`. Index leer → als `null` übergeben → `card-extract.ts:282` `if (!ctx.symbolIndex) { symbols.push(ref); continue; }` winkt **jedes** Symbol ungeprüft durch. Gemeldet wurde „beide Symbole aufgelöst" für `lane-signals.ts#clarificationAnswerMessage`, **das es im Baum nicht gibt**. Program-MAIN Slot 6 hat es am Baum gestellt, bevor eine Lane darauf ansetzte. Daraus wurde Zeile `56522568`.
2. **Falsch-Alarm.** `git diff --name-only main..HEAD` zeigte 10 Dateien für eine Lane, die genau eine änderte — Zwei-Punkt-Diff auf eine 6 Commits zurückliegende Lane. Gegen die merge-base gerechnet: exakt `e2e/watch.ts`.
3. **Falsche Messung.** `pgrep -f 'bun server.ts' | head -1` griff einen Fremdserver aus einem anderen Repo (27,4 MB statt 208,5 MB, Faktor 7,6). Prozesse über das **Arbeitsverzeichnis** identifizieren, nie über `head -1`.

## 4. RAM-DECKE DES HOSTS — gemessen auf Owner-Frage, noch nicht gefilet

**8,0 GB physisch, 0,1 GB frei, 2,6 GB komprimiert, 613 MB Swap, 7,1 Mio Pageouts** — bei **8** belegten Slots. RSS-Summen: `claude` 1266,7 MB (n=5), `bun` 635,0 MB (n=15), `node` 223,4 MB (n=16), `codex` 132,9 MB (n=4). Einzeln: claude **150–361 MB**, codex **23–64 MB** — Faktor 5–15 je Slot.

Konsequenz: 16 claude-Slots wären ~4 GB Agenten allein; **diese Maschine trägt das nicht**, unabhängig von der Serversprache. Ein Rust-Port von `server.ts` nähme ~200 MB von ~1,4 GB Flotten-Verbrauch — die Harness-Wahl ist der größere Hebel. (RSS zählt geteilte Seiten mehrfach: Obergrenzen, aber der Abstand trägt.)

**Aufgeraeumt (PLATTE, NICHT RAM - das ist der Punkt):** 25 verwaiste e2e-Scratch-Instanzen (567 MB) und 22 tote tmux-Sockets entfernt, TMPDIR 2155 -> 1579 MB. Schnitt war **PID nachweislich tot UND aelter als 24 h** - nicht 'PID tot' allein: Instanzen sind Beweismittel, Slot 3 hat heute `fleet-e2e-instance-45537` (79 min alt) als Hash-Beleg fuer einen Flake-Nachweis zitiert. Die zwei LIVE-Instanzen des laufenden Audits (`90121` = Lock-Halter, `91397` = zweiter Shard) blieben unangetastet, nach dem Reap gegengeprueft. **Die ~24 fremden `node`/`npm`-Prozesse und der stray `bun server.ts` in `private-repo-a/serve-dexter` (~350 MB) sind NICHT angefasst** - geteilte Realitaet, und der Owner hat noch nicht entschieden. Das ist der einzige verbliebene RAM-Hebel.

**Ungefilet, bewusst:** die Zeile „Wie viele Slots trägt dieser Host, und was kostet ein Slot je Harness?" — der Owner hat sie noch nicht bestellt. `FLEET_DISPATCH_MAX_LANES`=1 / Repo-Overlay 3 stammen aus Suite-Last-Überlegungen, **nie aus einer RAM-Messung**.

## 5. WAS LÄUFT, MIT ADRESSE

- **`5c849e55` gelandet** (db756205, Leichtgewicht f9dc8e10, Auftrag der MAIN Slot 10): `verify.ok true`, volle Kette, 159 270 ms, waitMs 0, kein Resolver, nur `e2e/watch.ts`, `hubPush ok`. Die Land-Notiz trägt `actor.suspect: "owner-token-outside-board"` mit `bypassed {program, task, main 10, report accepted}` — korrekt, das Program hat keine Self-Land-Promotion. **Audit-Watch `643d453c` auf `5c849e55` ist armiert; das Verdikt gehört Slot 10, nicht dir.** Noch keine Ledger-Zeile = läuft noch (~25–35 min), nie „verloren".
- **AUDIT AUF `5c849e55` KAM ROT ZURUECK - und es ist nicht dieses Land.** `ran 4933 / failed 1`, `ms 2 047 335` (34,1 min, also ein echter Lauf), shard k1 rot / k2 gruen. Der eine Fail woertlich: **"M5 setup: the docs land fired"**. Entlastung in drei unabhaengigen Stuecken: (a) SETUP-Zeile -> alles unter M5 ist UNGEMESSEN, nicht verletzt; (b) das Land bewegte exakt `e2e/watch.ts`, die M5-Sektion liegt in `e2e/programs.ts`; (c) die Familie ist vier Auftreten aelter als der Branch - selbst durchgezaehlt ueber 687 Ledger-Zeilen: `15d5f056` 09-14 23:21 - `891c7d98` 09-15 06:52 - `f806478a` 09-15 23:41 - `05fc16b0` 09-16 15:03 - `5c849e55` 09-16 21:12. **Basisrate 5/687 = 0,73 %.** Ich habe das Rot NICHT adjudiziert - es bleibt rot, das Urteil ist nicht meins. Slot 10 ist entlastet und informiert.
- **Reparatur laeuft: Slot 3, Branch `fleet/260916191349-89fe`** - Zeile `30adf3a0` (Fleet-Betrieb) lag seit 15:0x `queued` und beschreibt genau diese Familie; sie konnte NUR wegen des Master-Stops nicht starten. Per Hand darueber gestartet. Das fuenfte Auftreten steht als Kommentar `dc61af5d` an der Zeile. **Die Familie steht in KEINEM Register** - `grep 'M5 setup' docs/verify-tiering.md` ist leer; das Eintragen ist Teil ihres Auftrags.
- **Slot 2** (`5aeaa29d`, Suite schneller): verifiziert weiter, Suite-Angebot war offen. **Nicht auf `ahead/clean/idle` landen** — sie sah heute zweimal fertig aus und war es nicht. Ihr `briefAndSend`-Quiet-Hours-Fix ist eine Produktänderung außerhalb des Brief-Schnitts; Slot 6 hat entschieden: reist mit, wenn es ein Ausdruck plus Pin bleibt, und der Commit-Body muss es benennen — **Kriterium ist der Diff, nicht ihre Zusage**.
- **Slot 7** (`eeacda0a`, Simulator-Lease): von mir hand-dispatcht, verifiziert auf zwei Gleisen. Mein Hintergrund-Watcher auf ihren Terminal-Report **stirbt mit meiner Session** — neu setzen.
- **Deploy zurückgehalten**, von mir und Slot 6 bestätigt: ein srv-Neustart mitten in Slot 2s Suite-Angebot riskiert das Verdikt und setzt jede Pane-Idle-Uhr auf null. Nach Slot 2s Verdikt deployen — und `FLEET_CARD_MS='60000'` gleich mitnehmen, mit der **Preis-Formulierung** (ein Sonnet-Aufruf je fälliger Zeile; der Nullkosten-Pfad `formatCardOf` liest ausschließlich `t.text` und ist nur beim Anlegen erreichbar).

## 6. KORREKTUREN AN MIR SELBST, die du nicht wiederholen musst

- „Ein formatierter **Brief** kostet kein Kontingent" war **falsch** — `formatCardOf` parst `t.text`, nicht den Brief (Slot 6 hat es gestellt).
- `VERBOTEN` ist **kein** `FORMAT_KEY` (`card-extract.ts:389`): ein Sweep-Re-Read über den Format-Pfad verliert die Verbote, und ausgelöst wird er allein durch `(t.brief?.at ?? 0) > t.card.at` — also durch das Schärfen der Zeile. Deshalb sind `56522568` und `53daa39c` **unformatiert** gefilet.
- Reihenfolgen-Falle: **Sweep zuerst, dann Brief.** `cardStale` ist eine harte Lücke, greift aber nur bei Zeilen, die schon eine Karte haben.

---

# HANDOFF — Orchestratorin Slot 7 → Nachfolgerin (Haupt-Checkout, Owner-Token): Audit-Rot auf c5296dfb als `flake` quittiert und Tip deployt (6 Commits, `ok:true`), K4 Private-repo-aa auf Astra gelandet, drei programlose Zeilen mit gemessenen Kosten an Fleet-Betrieb gehaengt; 2026-09-16 ~20:0x, ctx GEMESSEN 35,4 %

## 0. SOFORT BEIM ANTRITT

- **Owner-Auftrag dieser Schicht, woertlich:** „Mach dir selbst ein Bild und denk nach was Sinn machen koennte" · „Gib dir Muehe" (= in diesem Fleet: die EIGENEN Behauptungen adversarial neu herleiten, nicht zusammenfassen). Und eine harte Korrektur von ihm an mich, die fuer dich gilt: **ich habe aus duennen Parametern praezise Schluesse gezogen** — eine Uhrzeit aus einer Zwei-Punkt-Extrapolation, Dollarbetraege aus zwei erfundenen Parametern. Er hat es gesehen und benannt. Rechne nicht weiter, als die Messung traegt.
- **Der Owner war ab ~19:5x ca. 30 min spazieren.** Was er beim Zurueckkommen erwartet: dass die drei Umhaengungen sitzen und diese Uebergabe steht.
- **Zustand wird abgeleitet:** `./state.sh`, `./register.sh`, `GET /api/self` → `lineage.record`. Diese Datei traegt nur den Rest.

## 1. WAS DU KRITISCH NACHPRUEFEN SOLLST — der Owner hat das ausdruecklich bestellt

Jede Zeile nennt die Behauptung, worauf sie ruht, und den Lauf, der sie kippen wuerde.

1. **Die `flake`-Quittung auf Audit `1789570065501` (Tip c5296dfb) ist das duennste Stueck dieser Schicht.**
   Was steht: Verdikt `flake`, `by: owner`, Notiz nennt als Ursache Nebenlaeufigkeit (beide Helfer-Shards zur selben ms geclaimt, `remote.claimedAt 1789568950047`).
   Worauf es ruht: ZWEI serielle Gruenlaeufe im Second-host-Checkout @ c5296dfb — `FLEET_E2E_SHARD=5/8` (114/1, die eine FAIL war die shard-empfindliche Trail-Sonde) und `FLEET_E2E_SHARD=1/2` (**2018 PASS / 0 FAIL, „ALL PASS"**, gleiche Checkzahl wie der rote Shard, beide Fail-Familien gruen).
   **WAS FEHLT, und ich habe es selbst als Luecke benannt:** die direkte Kontrolle — beide Shards GLEICHZEITIG auf demselben Host, demselben Baum. Ich hatte sie gestartet, zuerst auf dem falschen Baum (der Checkout stand auf `e549974e`), korrigiert auf c5296dfb — und dann hat der Owner abgebrochen („das ganze ist jetzt noch ueberhaupt nicht wichtig"). Reste sind aufgeraeumt, Checkout zurueck auf `main`.
   Der Lauf, der es entscheidet, wenn es je wieder wichtig wird: im Second-host-Checkout `git checkout c5296dfb`, dann `FLEET_E2E_SHARD=1/2` und `2/2` parallel starten, PIDs notieren. Rot mit denselben (w3)-Zeilen = Mechanismus belegt. Gruen = meine Zuschreibung faellt, und die Notiz im Ledger ist dann zu eng gefasst.
   **Das Verdikt `flake` selbst haelt trotzdem** (nicht reproduzierbar, kein Defekt im gelandeten Code, `result` bleibt `red`), und die Owner-Regel „zweimal gleiches Audit-Rot" bleibt unberuehrt — eine Adjudikation raeumt keine Zeile ab.
2. **Zeile `b85134d3`** (pending, Fleet-Betrieb) traegt meinen Nebenlaeufigkeits-Befund als Leithypothese. Slot 6 hat sie gut gefasst: Teil (1) verlangt den Beleg AM CODE und laesst die Lane STOPPEN, wenn die Claim-Naht Kollokation ausschliesst. Der EMPIRISCHE Weg (Absatz 1) steht nicht drin — wenn du die Zeile anfasst, ist er die billigere Haelfte.
3. **Die drei heute umgehaengten Zeilen: sieh nach, ob Slot 6 sie wirklich aufnimmt.** `48a91762` (langer Owner-Paste kam nur mit dem Schwanz im Composer an, kein Fehler gemeldet — Owner-Prioritaet „maximal robust", hartes DONE mit Hash-Vergleich), `2c306a87` (Send-Ledger fuer jeden `sendText`-Pfad), `b5665e17` (Echo-Diaet). Alle drei `pending`, jetzt `programId f170dc46`. **Die Umhaengung allein bewegt nichts** — kein Tick startet Pending, und die Freigabe ist die Tuer der MAIN. Steht eine davon in 24 h noch unberuehrt, ist die Umhaengung gescheitert und die Zeile braucht einen Hand-Dispatch oder einen anderen Besitzer.
4. **Meine Aussage an Astra „der private-repo-aa-Verify ist live" war eine SCHLUSSFOLGERUNG (.env-mtime aelter als Boot) — sie ist inzwischen DIREKT belegt und stimmt.** Land-Notiz von `3a6c08f8`: `verify.cmd = set -e; bun install --frozen-lockfile; bun run verify`, `verify.ok: true`. Kein Nachfassen noetig; hier nur, damit du weisst, dass die Behauptung geprueft ist und nicht geglaubt.

## 2. ZWEI BEFUNDE, DIE HEUTE VON „LATENT" AUF „GEMESSEN" GESTIEGEN SIND

Beide aus `docs/messungen/2026-09-15-fremdrepo-annahmen-lanes.md`, beide am K4-Land von 19:36 frisch belegt:

- **Befund 5 (Geschwisterhaelfte), jetzt live statt latent:** die Land-Notiz eines FREMDEN Repos nennt Fleet-Schrittnamen. `3a6c08f8` in private-repo-aa traegt `steps: ["install","pins","tsc","build","clean-review","security","claude-gate"]`, obwohl `bun run verify` lief. Das ist genau die Aussage der Notiz, und sie war dort als „latent, in Private-repo-aa-Rollouts kein Aufruf gefunden" gefuehrt. Zeile dafuer: `259bf7af` (pending).
- **Befund 6, drittes Auftreten:** private-repo-aa hat 7 Lands und 3 Audit-Zeilen, ALLE `unknown` / `exit 42` („audit skipped: not the fleet repo"), zuletzt 19:36 auf dem frischen K4-Land. Fix ist EIN Owner-Handgriff: ein `repoWorkers["/Users/owner/private-repo-aa"].audit`-Eintrag. Heute traegt `repoWorkers` genau einen Schluessel (private-repo-j game-maker).

Der Rest des Fremdrepo-Registers, Stand geprueft: Befund 1 offen und woertlich im Code (`server.ts:7210/7211` behauptet der Nachfolgerin „Kontext voll" und „Auftrag unveraendert" — kostete 89 K1-Nachfolgen) · Befund 2 offen, liegt in `~/.codex/AGENTS.md`, also AUSSERHALB des Repos und nicht Lane-Arbeit · Befund 3 wurde von K4 mitgeschnitten (portable Regeln statt Slotnummern/Deploy-SHAs/`~/claude-fleet`-Pfaden) · Befund 4 offen · Befund 7 als `4cd2d1de` gefilet, VORSCHLAG, wartet auf Owner-Promotion.

## 3. WAS DIESE SCHICHT GETAN HAT, kurz und pruefbar

- **Audit-Rot aufgeloest** (siehe §1.1), als `flake` quittiert, **danach deployt**: `POST /api/deploy` → `7c6fc3be`, target `c5296dfb`, `ok:true` vom naechsten Boot 17:33:40. `deployGap` jetzt `behindCount 0`, `bundleStale false`, 9 Sessions haben den srv-Neustart ueberlebt. Der Live-Server fuhr davor seit 13:44 sechs Commits alten Code.
- **Korrektur an meiner Vorgaengerin, am Ledger belegt:** sie uebergab „der zweite Unterschied ist der LAUFORT". Traegt nicht — 16:24/e2519fcb gruen und 16:47/c5296dfb rot liefen BEIDE auf dem Second-host, gleiches k/n, shard 1 beide Male 2018 Checks. Und „shard 2 war gruen" ist leer: `shardPlan(2)` legt `land-provenance` UND `programs` in shard 1, shard 2 hat die Familien nie gefahren.
- **Slot 5 (Private-repo-aa-MAIN) glaubte „never land yourself" — widerlegt und folgenreich.** Das Program traegt `promotion {selfLand:"green-only"}`, `selfLandTaskForMain` (:10180) verweigert nur bei `off`, das Gruendungsmandat beauftragt das Landen woertlich. Die einzige „landet nie selbst"-Stelle im Baum ist die STEWARD-Konvention (`CLAUDE.md:287`), eine andere Rolle. **Beleg, dass die Korrektur gewirkt hat:** `audit.jsonl` 19:14:35 `self_land_start slot 5 … policy=green-only`, Land 19:36:09. K4 ist drin (`cd8e0b7 feat: K4 weather timeline and portable repository rules`).
- **K4 zweimal dispatcht.** Zuerst Opus (Owner-Rueckfallklausel `fa70efe9` §3 bei used 33 % / elapsed 13,2 %), dann auf Owner-Ansage („private-repo-aa sollte mit astra oder sol laufen") zurueck auf `codex/gpt-6-astra/high` mit Sol-Schreib-Schnitten. Die Opus-Lane war `ahead=0/dirty=0`, nichts verloren. **Merke fuer die naechste Karte:** `task.spawn` ist NUR bei der Anlage einer Zeile setzbar — keine der `/api/tasks/:id/...`-Routen aendert sie; die attended Tuer `POST /api/tasks/:id/dispatch` ueberschreibt sie PRO FELD im Body und ist der einzige Weg, eine bestehende Zeile auf ein anderes Modell zu starten. Sie uebergeht dabei Deckel, Master-Stop und einen `hold` der MAIN — sag es der MAIN, wenn du es tust.
- **Slot 10 umbenannt** von „🎛 Fleet Controller (Astra)" auf „Program-MAIN: Leichtgewicht (Astra)" — die Bindung sagte das Gegenteil des Labels (`openedAt` beider identisch geprueft), und genau diese Verwechslungsklasse hat am 14.09. eine Lane gekostet.
- **Private-repo-j `9ce08219` bleibt `active`, bewusst.** `complete` waere eine Falschaussage (Owner-Richtung `262a8f71`: „SPIELE MIT ASTRA — ZULETZT"). Die tote MAIN-Bindung ist harmlos: `programOccupancy` vergleicht `openedAt`, liest `stale`, und `tickInboxNudge` ueberspringt jedes nicht-`live` Program.
- **Second-host aufgeraeumt:** verwaiste `/tmp/fleet-e2e.lock` vom 11.09. gereapt (Halter-PID tot, mechanisch geprueft), meine drei eigenen Runner und ihre tmux-Sockets beendet, Checkout zurueck auf `main`. Der Helfer-Job blieb unangetastet.

## 4. OFFENE FAEDEN, ohne Dringlichkeit

- **`e41ccec1`** (pending, Fleet-Betrieb): Denkauftrag Pane-/Zustands-Leser. Anlass ist §3 oben — kein Sensor dieses Fleets liest eine UEBERZEUGUNG einer Session; `runStewardDigest` sagt seine Blindheit im eigenen Prompt („You cannot see transcripts"). Owner-Interesse gilt „Jev" (TypeSafe AI, System-One-Modell: geschlossener Wertebereich, kalibrierte Wahrscheinlichkeiten, keine Textgenerierung, KEINE Bilder). Brief trennt (A) Sonde ueber strukturierten Zustand von (B) Sonde ueber Panetext und misst den MARGINALEN Ertrag gegen die vorhandenen Praedikate. **Die Kostenzahlen in dem Brief sind meine erfundenen Parameter** — die Zeile sagt es und verlangt empirische Messung; lass das so.
- **Variantengruppen sind nie benutzt worden** (`0` Gruppen, `0` Varianten-Zeilen in `fleet.json`). Das ist die einzige Konstruktion im Fleet, die Modellunterschied von Rollenunterschied trennen kann — `land-quality.ts` zeigt heute Beobachtungsdaten mit Selektion drin (`codex/gpt-6-astra` sieht mit 4 % Audit-Rot am besten aus und hat `code=2` von 24 Lands). Der Owner hat Interesse signalisiert; ich habe eine Zeile dafuer ANGEBOTEN und nicht gefilet.
- **Der Owner hat 2 gebankte Codex-Resets** (`/usage` in einer Astra-Pane). Kontingent zuletzt `used 33 % / elapsed 13,2 %`. Das ist SEIN Hebel — nicht ziehen, nur nennen. Und: die Owner-Rueckfallklausel `fa70efe9` §3 ist fuer Private-repo-aa ausdruecklich ausgesetzt (Astra statt Opus), NICHT aufgehoben; ich habe das in den K4-Brief geschrieben, damit es niemand als Regelbruch liest.
- Lanes: Slot 2 (`5aeaa29d`, Suite schneller) und Slot 3 (`db756205`, GLM, Leichtgewicht) arbeiteten beim Schreiben dieser Zeilen. Slot 1 frei. main `e549974e`.
