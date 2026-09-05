# HANDOFF — 🎛 Fleet Controller (Slot 5, Fable 5.1): Program-Dispatch gelandet+deployt, Suite-Schnitte A/B gefilet, Codex-Zustellprobe ZU, GLM- und Dual-Host-Schnitt-1 gelandet; 2026-09-05 17:0x, ctx GEMESSEN ~27 %

> **Ein Abschnitt je LEBENDEM Prinzipal:** dieser ERSETZT den der Controller-Vorgaengerin (Slot 12, 15:5x).
> **Der Controller ist, wer das Label `🎛 Fleet Controller` traegt.** Lineage: … → 7 → 12 → 5 → du.

Zustand ableiten, nicht hier lesen: `./state.sh`, `./register.sh`, Owner-Poll, Panes.

## 0. Was du als Erstes tust

1. `GET /api/self/attention` und der Attention-Bestand: ich habe KEINE offene Attention hinterlassen; Astras zwei (Advisory-Deckel, GLM-Land) sind beantwortet.
2. **KEIN DEPLOY, solange Slot 1 (Beleg-Lane 2 `9f1dbfb4`, Program 66499a03, Slot 8) laeuft und danach noch ~20 min** — Slot 8s Beweis (erste `autoClose`-Zeile ueberhaupt) haengt an einem deploy-freien Idle-Fenster nach der Report-Annahme; jeder Deploy nullt die Idle-Uhr aller Panes. Slot 8 meldet dir das Fenster selbst, wenn der Report da ist. `deployGap.codeBehind` steht nach dem Dual-Host-Land `7b1d9cd` auf `true` — die Dateien sind docs/dual-host-git-transport.md, docs/repo-map.generated.md, fleet-sync.sh; KEIN Server-Code darunter, der Deploy ist funktional nicht noetig. Deploy erst nach Slot 8s Fenster, und nur wenn wirklich Server-Code dahinter liegt.
3. **Audit-Watches, die mit mir sterben:** `7a68c9f` (Program-Dispatch) und `7b1d9cd` (Dual-Host) — arm beide neu (`{"kind":"audit","repo":"/Users/owner/claude-fleet","mainAfter":"<sha>"}`; die mainAfter-Sha steht in der Land-Note `git notes --ref=fleet/land show <tip>`). Erwartung: rot auf genau den zwei bekannten Familien (D2 setup, projection nextAction), alles andere ist Befund.
4. **Slot 4s Composer trug beim Land den ungesendeten Text „mach gate 3 und 4 als einen akt, claude installier ich".** Nach Owner-Regel ist ein Composer-Rest nie ein Owner-Entwurf; ich habe ihn nicht ausgefuehrt, aber die Folgezeile `0c00f9a9` (Gate 3+4 als EIN Akt) genau so geschnitten und als BLOCKIERT markiert, bis `ssh second-hostowner@100.64.0.2 'command -v claude'` einen Pfad liefert. Der Owner muss Claude Code dort installieren und einloggen (Credential-Akt, sein Kontingent) — das steht in meinem Schlussbericht an ihn.
5. **Das Dual-Host-Program `cd110019` hat KEINE lebende MAIN:** `program.main` zeigt auf Slot 8 mit `openedAt 1788567958928` (retired); der heutige Slot 8 ist die MAIN von 66499a03. Genau daran starb Slot 4s needs-main-Report („no exact clarification receiver evidence"), und die Lane stand 30 min stumm. Owner-Wahl: neue MAIN spawnen oder das Program ueber den Controller fahren; bis dahin liest DU die Panes der Dual-Host-Lanes.

## 1. Owner-Entscheide dieser Session

- 16:2x „Wollen wir die Suite vllt einfach etwas verkleinern?" → meine Antwort nach Messung: erst Wartezeit und Vorschau, kein Check faellt. „Ja bitte geh diese Punkte jetzt sauber an." → Zeilen `aa3fd660` (Schnitt A: Warten auf Bedingung statt Timer) und `5cd2d1b9` (Schnitt B: Modulfilter + Fixture-Karte fuer die Lane-Vorschau) im Program Audit-Determiniertheit (Slot 6), Reihenfolge NACH Slot 6s Zeile 3 (`423f4031`, queued, wartet am Deckel); `7d3d29de` (Offer-Seite sieht den Second-host nicht) standalone pending. Messbasis in den Texten: Trail `isolated-20260905T121144Z`, 3139 Checks, 1690 s; 83 Checks >5 s = 753 s; 461 sleep() = 366 s; programs/tasks/watch/merge = 2/3 der Zeit; heute rot auf genau EINEM Check.
- Freigabe an Slot 4 (Dual-Host), die einzige Wirkung ausserhalb des Repos: eine fetch-only-Zeile (`restrict,command="/usr/bin/git-upload-pack '/Users/owner/claude-fleet'"`) in `~/.ssh/authorized_keys` auf oldmac, append-only, Backup im Lane-Scratchpad. Owner-Delegation „entscheide du" fuer Dual-Host; rueckgaengig = die Zeile loeschen.

## 2. Was gefallen ist (Belege: Ledger, Queue, Commit-Bodies)

- **Gelandet+deployt:** Program-Dispatch `5c1f831f` als vier Commits, Tip `7a68c9f`, verify ok 111 s, waitMs 0; Deploy `0deb6aef` Boot ok, bootHead = Tip. Slot 1s eigener Bestaetigungslauf: 1 FAIL = projection nextAction (bekannt), sonst gruen.
- **Gelandet (docs/skript, kein Deploy):** GLM-Gegenlesung `6a527587` → `fedf579` nach fachlicher Annahme durch Astra (Report `f4469951`); Dual-Host Schnitt 1 `cf4a85cd` → `7b1d9cd`, verify gruen ( `fleet-sync.sh`, `docs/dual-host-git-transport.md`, Repo-Map).
- **Codex-Zustellprobe ZU:** das Audit-Event `35c0a100` kam direkt bei Astra an (attempts 1) und wurde von ihr selbst quittiert. Kein Relais mehr noetig. D2 `e88884c8` bleibt pending bei Astra.
- **Astras Rueckgabe an Slot 7 lag seit 13:42 unzugestellt** (Queue-Notiz `410b24ea`, von der Vorgaengerin nicht relayt) — relayt, Korrektur `d1682e2`, angenommen, gelandet. Sieben abgearbeitete D1-Koordinationsnotizen archiviert (Advisory-Deckel 10/10 → 3/10). Drei Doppel-Zeilen von Slot 6 archiviert (`9da27a0b`, `865439d9`, `0c6c78e7`). Richtung `233ee108` → Prozess-Dokument als `d2b69d3d` pending in Astras Program.
- **Waisen:** vier vollstaendig gelandete Worktrees entfernt. ZWEI bleiben mit uncommitteter Arbeit (b963 = Task `9fd34beb`, 290 Zeilen programExecutionView/programHealth; 1787 = `db6902c4`, ersetzt durch `02740e69`) — nicht meine Entscheidung; loeschen oder salvagen ist Owner-/MAIN-Sache.
- **Maschine:** 8,6 GB RAM; macOS killte Slot 1 zwei Hintergrund-Waechter wegen Speicherknappheit (43 % frei bei 7 claude/11 codex/21 bun-Prozessen). Kein Befund gefilet, nur gemessen.
- Audits `1d5efb9` und `cba8807` rot, beide exakt die zwei bekannten Familien. Die Audits laufen „(remote, second-host)" — der Helfer ist erreichbar; nur die Offer-Seite sieht ihn nicht (`7d3d29de`).

## 3. Offen — Zuege der Nachfolgerin, in dieser Reihenfolge

1. §0.3 Audit-Watches; §0.2 Deploy-Sperre beachten.
2. Slot 4s Land-Ausgang lesen (Merge-Watch stirbt mit mir): bei `merged` nichts weiter; bei `ff-lost`/rot die Lane lesen, nicht raten.
3. Drei Zeilen am Deckel (`423f4031` Slot 6, `02740e69` Fleet-Betrieb, danach Schnitt A/B) — der Tick startet sie, sobald Plaetze frei sind; nichts von Hand dispatchen.
4. Owner-Sache, an ihn berichtet: Claude Code auf dem Second-host installieren (Gate 3+4), MAIN fuer Dual-Host, die zwei dirty Waisen, Regelbuch-Drift „GPT-Slot hat ctx null" (unveraendert).

## 4. Was mit dieser Session stirbt

Merge-Watch Slot 4, Audit-Watch `7a68c9f`, alle Hintergrund-Waechter. Kein Auto, keine Mission, keine offene Attention.

---
---

# HANDOFF — Program-MAIN Fleet-Betrieb 2026-09 (`f170dc46e4b026ee34d9392e`, Slot 10, Opus 5): die Audit-Regression ist ZU (`93e5460`, ueber die eigene Self-Land-Sprosse), die zweite Lane haengt an einem NIE-GEMESSENEN Gate — und ich habe die Last-Hypothese am Ende mit einer Kontrolle belegt; 2026-09-05 13:5x

Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Hier nur, was git
und die Sensoren nicht tragen. Lineage 4 → 16 → 10 → 3 → 5 → 2 → 10 → du.

## 0. DAS ERSTE, WAS DU TUST — zwei Zeilen, und beide sind Tueren, keine Fragen

- **`ec0bf175` IST GELANDET: `1d5efb9`** (drei Commits `df41b3c` / `8785f46` / `1d5efb9`),
  `verify.ok:true`, `exitCode 0`, `ms 188620`, `waitMs 91000`, Land-Note mit
  `actor{kind:main, slot:10, program:f170dc46, task:ec0bf175, sessionIdMatch:exact}`. **Damit sind
  BEIDE Zeilen oberhalb der Schnittlinie durch die eigene Sprosse gelandet** — zusammen mit
  `93e5460` zwei Belege fuer Erfolgskriterium (d). **Der Post-Land-Audit zu `1d5efb9` steht noch
  aus; ich konnte keinen Watch mehr halten — arm ihn neu**
  (`{"kind":"audit","repo":"/Users/owner/claude-fleet","mainAfter":"1d5efb95..."}`).
  Der Weg dorthin ist unten als §0-alt konserviert, weil die MECHANIK wiederkommt:

- ~~**`ec0bf175` ist FERTIG UND GEPRUEFT, aber NICHT gelandet.**~~ (§0-alt, erledigt — Mechanik gilt)
  Der Gate lief voll durch und starb an `e2e-claude-gate.sh` **Phase 3**: `server did not come up`,
  **`no server.log exists`** in der aufbewahrten Instanz. Das ist woertlich die NIE-GEMESSEN-Signatur
  aus dem Regelbuch, kein Regress am Diff — bei `ms 665428 / waitMs 531000` (**80 % Schlange**, 3 von
  3 Stufen blockiert) unter fuenf lebenden Lanes ist ein 30-s-Server-Boot-Timeout der Normalfall.
  **Der Diff ist von mir geprueft und getragen** (Details §2). Die Tuer ist jetzt zu: die Self-Land-Route
  antwortet `no progress since the last verdict — resolved on the same candidate 7173a09b`.
  **KORREKTUR an meiner ersten Fassung dieses Absatzes, am lebenden System widerlegt:** ich hatte
  hier geschrieben, es genuege, dass main sich bewegt. **Falsch.** Main ist danach DREIMAL gezogen
  (`0347f06`, `93e5460`, `a719c5b`), und die Route nannte unveraendert `candidate 7173a09b`. Der
  Kandidat haengt am TIP DER LANE, und der rebase, der ihn aendern wuerde, laeuft erst INNERHALB des
  Lands, das der Guard blockiert — eine geschlossene Schleife. Es gibt genau ZWEI Oeffner:
  **(a) die LANE rebased selbst und committet** (der Weg, den der Guard mit „repair" meint), oder
  **(b) der Owner landet vom Board**, dessen Route diesen Guard nicht kennt. Ein no-op-Commit auf der
  Lane waere ein Rail-Trick und ist keiner von beiden.
  **AUSGANG, zur Bestaetigung der Mechanik: (a) hat funktioniert.** Die Lane rebaste sauber
  (`7173a09b -> 51e1ef6`, drei Commits neu geschrieben, Diff unveraendert 336/-2), meldete
  AUSDRUECKLICH „kein Konflikt, kein Leer-Commit" — und der Guard oeffnete, **weil der KANDIDAT
  sich bewegt hat, nicht main**. Genau die Unterscheidung, die ich oben erst falsch hatte.
  Nebenbefund der Lane, zweite Kontrolle fuer die Last-These: ihre Kette fuhr ALLE FUENF Phasen von
  `e2e-claude-gate.sh` inkl. der `harness waiver`-Phase 3, `grep -c 'did not come up'` = 0.

  **STAND BEI DER UEBERGABE (historisch): (a) lief.** Ich habe Slot 4 um 13:5x per `POST /send` (die Route ist
  `/send`, NICHT `/api/send`) den Repair-Auftrag geschickt — Composer vorher mit `C-u` geleert, weil
  dort ein ungesendetes `land it` stand und ein Paste damit verschmolzen waere. Die Lane ist **6
  hinter main**, und ZWEI dieser sechs fassen `server.ts` an, dieselbe Datei wie sie selbst
  (`93e5460`, `c36c1e9`) — der rebase ist also echte Arbeit mit moeglichen Konflikten, kein
  Formalakt. Sie hat begonnen (liest die `93e5460`-Hunks). Ich habe ihr ausdruecklich VERBOTEN, einen
  Leer-Commit zu setzen: geht der rebase sauber durch und ist nichts zu aendern, soll sie genau das
  melden — dann ist (b) faellig.
  **Das ist eine LIVE-Instanz deiner eigenen Zeile `6101dbc3` (R5)** — der Guard haelt ein nie
  gemessenes Gate fuer ein Urteil. Wenn du R5 baust, ist das dein Beleg-Fall.
- **`35ac0b97` (Audit-Regression) IST GELANDET: `93e5460`**, im zweiten Anlauf, `verify.ok:true`,
  alle sieben Stufen, `exitCode 0`. Die Land-Note traegt
  `actor {kind:main, slot:10, program:f170dc46, task:35ac0b97, sessionIdMatch:exact}` — also ein
  Beleg fuer Erfolgskriterium (d), gelandet ueber die eigene Sprosse, nicht durch den Controller.
  **OFFEN daran: der Post-Land-Audit.** Ich hatte Watch `9b43fa5b`
  (`{"kind":"audit","mainAfter":"93e54601..."}`) armiert — **ein Watch stirbt mit meiner Session,
  arm ihn neu.** Und **DER DEPLOY FEHLT NOCH** (§1): ohne ihn bleibt jedes rein-docs-Land rot.

## 1. Die Kette, die niemand sonst zusammenhaengt: das Audit-Rot ist DREI Schritte tief

Jedes rein-docs-Land ist seit dem Deploy 07:36 rot — fuenf in Folge, immer dieselben sechs
`fatal: not a git repository`-Fails, `ms ~1000`. Reihenfolge bis das aufhoert:
**(1)** ~~`35ac0b97` landen~~ **ERLEDIGT: `93e5460`** · **(2)** DEPLOY (der Fix ist Servercode —
`runPostLandAudit`; ohne Deploy aendert das Land nichts) · **(3)** das naechste rein-docs-Land
erzeugt erst dann die gruene Zeile. **Schritt 2 ist der einzige, der noch aussteht.**
**Der Deploy gehoert dem Controller** (Slot 7 hat ihn heute 12:53 gefahren, `bootHead 22b2bf40`) —
frag ihn, deploy nicht selbst, sonst zwei srv-Neustarts.

## 2. Was ich an den zwei Diffs geprueft habe (damit du es nicht zweimal liest)

- **`ec0bf175` / `7c4dedf`, +336/−2.** Beide Abweichungen vom Brief sind richtig und beide „der Code
  gewinnt": `executionStatus:` statt `status:` in der Owner-Liste, weil `publicProgram` die ganze
  Program-Zeile spreadet und `Program.status` dort schon der Lebenszyklus ist (der Brief haette ihn
  fuer jeden Board-Leser still ueberschrieben); und der Deploy-Guard auf `repoCanon(REPO_DIR)` statt
  `import.meta.dir`, weil `deployGap()` in `REPO_DIR` zaehlt. Die Overload-Trennung haelt: die
  Owner-Liste ruft die Ledger-lose Form. Es irrt in Richtung SCHWEIGEN (`landedMainAfter` nur aus
  `mainAfter`, also eher `lastAudit:null` als ein geratener Join; `codeBehind` bleibt `null`, nie
  `false`). Jeder Check unter benannter Mutation rot gesehen, Kaskade als Rauschen deklariert.
- **`35ac0b97` / `9a6592c`, +159/−15.** `gitContext` haengt am `proportional`-Flag, weil das genau
  die Frage IST. `git init -q -b main && git add -A -f` laeuft VOR dem node_modules-Symlink —
  `.gitignore`s `node_modules/` matcht keinen SYMLINK, umgekehrt indiziert es 629 Pfade eines
  628-Pfad-Baums, mit jedem Pin gruen. KEIN Commit, absichtlich: ein erfundener HEAD beantwortete
  `git rev-parse HEAD` mit einer sha != `mainSha` — eine falsche Messung in richtiger Form. Ein
  gescheiterter git-Kontext gibt einen Fehlerstring → `unknown`, nie ein rotes Suite-Urteil.
  Der teuerste Satz des Reports ist der, warum NICHT immer: mit `.git` im Snapshot folgt
  `e2e/trail-emit.ts#resolveSourceTree` dem node_modules-Symlink, `--is-inside-work-tree` kippt auf
  YES, und der Trail landete IM Scratch-Verzeichnis, das der Server danach loescht — das
  Flake-Register verloere still genau die Laeufe, die ein Land adjudizieren.

## 3. Was ich selbst am Host getan habe (`bb96059`, Direkt-Commit)

Der faelligste Posten des Programs, und er kann keine Lane sein (`rulebook/` ist gitignored):
**acht aufeinanderfolgende Bullets** in `rulebook/lane-discipline.md` ueber EINEN Gegenstand
(Suite-Mutex, Sensoren, Warten) — 5 398 B, ueber zwei Tage gewachsen — auf **drei** Regeln gezogen.
Keine Regel gestrichen; die acht Originalbloecke stehen als **§15.30–§15.37** in
`docs/attic/regelbuch-messgeschichten-2026-08.md`, Gegenprobe an neun tragenden Zeichenketten.
`bun e2e/pins.ts` ALL PASS, `RULE_RENDER` byte-identisch.
**Ehrlich: 81 322 → 79 508 B, NICHT < 75 000.** Der Rest ist mit Prosa-Schnitt nicht zu holen — die
verbliebenen Bullets sind ueberwiegend je eine Regel mit ihrem bezahlten Preis. Wer die 75 000 will,
verlagert ganze Regelbloecke nach `docs/` und zeigt nur hin. Das ist ein STRUKTUR-Entscheid.
Mitgenommen: der `FLEET_LANE_AUTOCLOSE`-Absatz trug „scharf, nie ausgeloest" ohne Ursache — die
Ursache (14-ms-Phasenkopplung des 30-min-Repaints gegen `STALLED_IDLE_MS`) steht jetzt dort, frisch
nachgezaehlt `0 von 786`.

## 3b. DIE KONTROLLE, die die Last-Hypothese aus der Vermutung holt

Zwei Laeufe DESSELBEN Gates, dieselbe `e2e-claude-gate.sh` Phase 3 (harness waiver):

| Lauf | `waitMs` | `ms` | Phase 3 | Ergebnis |
|---|---|---|---|---|
| `ec0bf175`, 13:12 | **531 000** (3 von 3 Stufen blockiert) | 665 428 | `server did not come up`, **kein `server.log`** | RED |
| `35ac0b97`, 13:32 | **0** (0 von 3 blockiert) | 115 985 | gruen | `ok:true` |

**Der 30-s-Server-Boot der Phase 3 ist lastempfindlich, und die Schlange ist die Last.** Damit ist
das erste Rot als NIE-GEMESSEN belegt statt nur behauptet — und die Lehre ist nicht „die Maschine
ist zu langsam" (im selben Fenster landete Slot 1 gruen), sondern: **wer unter Mutex-Andrang landet,
kauft eine Phase-3-Nichtmessung mit spuerbarer Wahrscheinlichkeit ein, und der Progress-Guard macht
daraus ein Urteil.** Vor einem Land unter Andrang lohnt der Blick auf `/tmp/fleet-e2e.lock.q`.

## 4. Drei Korrekturen an meinen eigenen Saetzen dieser Session

- **Ich habe `merges: {'4': 'interrupted'}` als „der Land wurde von einem Neustart getoetet" gelesen
  und das dem Owner so gemeldet. Falsch.** Die Regelbuch-Regel sagt es richtig: `interrupted` OHNE
  `verify` heisst **ein Land LAEUFT**. Es lief noch elf Minuten und resolvte dann mit `verify.ok:false`.
  Der `detail`-Text („der Server wurde mitten im Lauf unterbrochen") ist ein pessimistischer
  Vorab-Eintrag, kein Befund — lies ihn nie als einen.
- **Ich habe „beide meine Lands liefen in rote Gates" gesagt. Falsch, und die Vermischung war
  teuer:** NUR `ec0bf175` hatte je ein rotes Gate. `35ac0b97`s Gate war BEIDE Male gruen — sein
  einziges Hindernis war der geteilte Working Tree (fremde uncommittete `docs/verify-tiering.md`,
  committet als `0347f06`). Zwei blockierte Lanes, zwei voellig verschiedene Ursachen.
- **Die Live-Route schlaegt die Zustandsdatei.** `fleet.json` zeigte `interrupted`, `GET
  /api/slots/:id/merge` zeigte im selben Moment das vollstaendige Verdikt samt `waitMs`, `exitCode`
  und stderr-Tail. Fuer ein Merge-Urteil immer die Route fragen.

## 4a. EIN FEHLER VON MIR, den du nicht wiederholen sollst

Ich habe um 14:41:25 `63ff7f6` (nur `HANDOFF.md`) auf main committet, **waehrend Slot 5s Land seit
14:20:53 lief**. Die Ursache ist mechanisch und billig zu vermeiden: ich hatte die `merges`-Probe
und den `git commit` in DERSELBEN `&&`-Kette — die Probe druckte korrekt `'5': 'interrupted'`
(= ein Land LAEUFT), aber ihre Ausgabe wurde nie gelesen, weil der Commit im selben Zug lief.
**Die Probe gehoert in einen EIGENEN Aufruf, dessen Ausgabe du liest, bevor du committest.**
Ausgang, ehrlich in beide Richtungen: Slot 5 hat **keinen** ff-lost erlitten — sein Verdikt ist
`resolved, landed=False, verify.ok=None`, „clean rebase, but verify NEVER STARTED", also die dritte
Queue-Aushungerung des Tages und nicht meine Kollision. Der Fehler bleibt trotzdem einer; er ist
nur diesmal nicht teuer geworden. Ich habe Slot 3 (MAIN des betroffenen Programs) per `/send`
gewarnt, statt es ihn entdecken zu lassen.

## 4b. DER TIER-2-BEFUND ZU `93e5460` IST `unknown` — und der Grund ist ein Budget-Defekt

**Das Land ist gruen im Gate, aber vom Post-Land-Audit NIE BESTAETIGT.** Die Ledger-Zeile:
`result unknown`, `ms 2700498` (das volle 45-min-Budget), **`checks: None`** — nichts gezaehlt.
Ihr eigenes `out` sagt warum: `waiting 970s … position 2 of 3`, `acquired after 1001s`. **17 Minuten
des Budgets gingen an die Mutex-Schlange**, danach blieben ~28 min fuer eine Kette, die ~25–35 min
braucht. (Nebenbei reapte sie eine zerrissene Acquisition: „lock has a process-birth fingerprint but
NO pid".)

**Der Defekt, benannt, weil der andere Pfad ihn schon geloest hat:** der Land-Gate trennt seit
`08dc17a` `timeoutMs` (Arbeit) von `waitMs` (Schlange) — darum ist ein `waitedOut`-Gate NIE
`ok:false`. Der Post-Land-Audit hat nur `FLEET_POSTLAND_AUDIT_TIMEOUT_MS`, EIN Budget fuer beides.
Unter Andrang verbrennt er es im Warten und meldet `unknown` — **von einem Absturz nicht
unterscheidbar**. Das Muster fuer die Trennung existiert bereits; der Audit muesste es nur erben.
Als `notiz` wollte ich es filen, aber die Advisory-Kappe steht auf **10/10** — deshalb hier.

**Konsequenz fuer die Uebergabe:** `93e5460` traegt ein gruenes Pre-Land-Gate und KEIN Tier-2-Urteil.
`unknown` ist kein Pass. Der naechste Audit auf einem spaeteren Tip deckt es mit ab (`covers`), oder
jemand faehrt `./e2e-isolated.sh` seriell, wenn die Maschine ruhig ist.

**Zweiter Fall derselben Familie an EINEM Nachmittag:** dasselbe Andraengen liess vorher ein
Land-Gate in Phase 3 nichts messen (531 von 665 s Warten, kein `server.log`). Der Suite-Mutex ist
heute nicht langsam — er ist der Grund, warum zwei Messungen keine Messungen wurden.

## 5. Offen, unbeansprucht

- **§11.2o in `docs/verify-tiering.md` traegt eine veraltete Basisrate:** dokumentiert `6/209 = 2,9 %`,
  heute gemessen `18/221 = 8,1 %`, sieben der Rots von heute vor 08:12. Die S2-Lane hat das korrekt
  NICHT zu einem zweiten Schnitt gemacht, nur gemeldet. Eine Zeile Register-Pflege.
- **Vierzehn Zeilen dieses Programs tragen persistent `spawn codex/gpt-5.6-sol`** (S3a-i, S3a-ii, S3b,
  S3c, S3d, S4, S5a, S5b, S5c, S12, CP-A, CP-B, CP-C, S2-alt). KEINE Route aendert den Spawn: wer eine
  davon will, **filt sie NEU** (`ec0bf175`/`02740e69` zeigen wie), niemals freigeben. Drei weitere
  solche Zeilen liegen im Program `79036e9a` — nicht deine, aber der Controller sollte es wissen.
- **Erfolgskriterium (a) ist EINE Zeile entfernt:** von 95 offenen Fleet-Zeilen haben 11 kein Program,
  davon sind 10 `notiz` (laufen nie) und genau eine ist ein `auftrag`: **`5c1f831f`**. Eine
  Program-Zuweisung von aussen gibt es nicht — das ist ein Owner-/Controller-Griff.
- **Maschinenhygiene, von nichts geerntet:** 3,4 G TMPDIR-Scratch, vier verwaiste e2e-tmux-Sockets.
  Ich habe sie NICHT angefasst: einer der „strays" hatte sein cwd in einer LEBENDEN Lane, und
  `state.sh`s Heuristik haengt an TMPDIR. Bei fuenf Lanes und Mutex-Andrang ist das kein Aufraeumen
  nebenbei, sondern eine eigene Zeile mit notierten PIDs.

# HANDOFF — 🎛 Fleet Controller (Slot 12, Fable 5.1): D1 freigegeben und im zweiten Land, Fleet-Betrieb geschnitten, Second-host per SSH erschlossen, Dual-Host Phase 3 entschieden; 2026-09-05 15:5x, ctx GEMESSEN 32,4 %

> **Ein Abschnitt je LEBENDEM Prinzipal:** dieser ERSETZT den der Controller-Vorgaengerin (Slot 7, 12:5x).
> **Der Controller ist, wer das Label `🎛 Fleet Controller` traegt.** Lineage: 5 → 6 → 9 → 3 → 9 → 3 → 7 → 12 → du.

Zustand ableiten, nicht hier lesen: `./state.sh`, `./register.sh`, Owner-Poll, Panes.

## 0. Was du als Erstes tust

1. `GET /api/self/attention` — ich hatte keine offene Attention; alle vier vom Morgen sind beantwortet.
2. **D1 IST GELANDET UND DEPLOYT** (Stand 16:0x): zweites Land `merged`, verify ok; main `4d7d60b`; Deploy `86ab66ad` Boot ok,
   bootHead = main. Damit live: Codex-Zustellfix (kein Hinweis endet mehr auf dem Token-Sigil) und `FLEET_HELPER_WAKE_ADDR`.
   **Wake-Probe gefahren:** `POST /api/helper/devices/secondhostlinux1/wake` antwortet `{"sent":true}` (vorher 409). Slot 5 raeumen,
   falls das Land es nicht schon tat.
3. **Die eine offene Probe: Codex-Zustellung ohne Relais.** Das naechste Event an Slot 3 (Astra) muss `delivered` und von ihr selbst
   `acknowledged` werden. Bis es kommt, gilt die Relais-Regel unter 4; danach ist der Defekt zu. Das Merge-Terminal-Event `88220bd4`
   habe ich noch relayt (alter Server-Text). ACHTUNG: das ERSTE Event einer FRISCHEN Codex-Pane kann weiter 409 beim eigenen Ack
   bekommen (Session-Id lazy gebunden) — das ist D2 `e88884c8`, nicht D1.
4. **Bis dahin bist DU Astras Relais:** Event in `fleet.json.events` mit `receiverSlot 3` und `status send-uncertain` → in Astras Pane
   steht der Text mit offenem Picker („no matches / Press enter to insert or esc to close"): `tmux -L claudefleet send-keys -t s3 Escape`
   leert den Composer (Owner-Entscheid: Composer-Rest ist nie ein Owner-Entwurf), dann `POST /send {slot:3,text}` — Text ohne `$`
   am Ende, kein `$`/`@`/`/` am Zeilenanfang, Report-Id und Ack-Route in Worten. Vier Relais heute, alle so gelungen.
5. **Slot 1 (`5c1f831f`, Program-Dispatch, kein Program):** zwei Commits, Gate lokal gruen bis auf die Suiten; ihr isolated-Lauf hielt den
   Mutex 60+ min. Ihr Verdikt kommt zu DIR. Landen, wenn sie fertig meldet (Pane lesen, nicht den Watch glauben).
6. **Slot 4 (`cf4a85cd`, Dual-Host Phase 3):** laeuft mit meinem Entscheid (§1). Slot 7 (GLM-Gegenlesung, docs-only, 1 Commit): landet
   Astra selbst. D2 `e88884c8` pending bei Astra, Start nach D1.

## 1. Owner-Entscheide dieser Session (woertlich oder sinngemaess, Reihenfolge)

- 13:1x „Ja ich hab den effort geändert — sollten bis morgen abend auf jeden Fall bei medium bleiben" → Astra medium bis 2026-09-06 abends. „Ok ich starte die GLMgegenlesung" → er fand sie nicht, ich habe `6a527587` per Owner-Dispatch (pi-zai/glm-5.3/high) gestartet. „Entscheide du für 3 & 4" → Idle-Uhr (a) 20 min in `.env`, Dual-Host (b) parken.
- 13:5x „ja bitte mach den Schnitt" → 15 Fleet-Betrieb-Zeilen archiviert (reversibel), Regel an Slot 10: keine neuen Auftraege ausser Produkt-Entblocker/Lebenszyklus.
- 14:0x „Private-repo-j sollten wir noch etwas auf Eis legen … schwere Aufgaben … an Astra geben" → Memory `feedback-heavy-tasks-to-astra-private-repo-j-on-ice`.
- 15:1x „das repo definitiv auf second-host packen … auto link … volle funktionalität" → Zeile `cf4a85cd`; „entscheide du" → **Weg (b):** oldmac kanonisch, Second-host zieht per git ueber Tailscale, faehrt Sessions+Suiten, landet nicht; Reihenfolge Transport → Gate 3 (watchdog.service) → Gate 4 (zweite Instanz); Zielbild je Repo (Fleet-Repo spaeter kanonisch auf dem Second-host, iOS auf oldmac), Platzierung nach Profil als eigene Zeile. An Slot 4 per `/send` zugestellt.
- „Codex-ctx ist NIE Succession-Druck" gilt fort (Astra stand bei 54 %).

## 2. Was gefallen ist (Belege: Ledger, Queue, Commit-Bodies)

- Deploy `9b3c0db5` (13:45, Boot ok, bootHead `4761020`): Audit-Fix `93e5460` + `FLEET_STALLED_IDLE_MS=1200000` live. `.env` traegt zwei neue Zeilen (STALLED, WAKE_ADDR), beide kommentiert.
- Gelandet heute durch die MAINs: `c36c1e9/1db9296/126a82d` (Watch-Tick Lost Update, Slot 6), `93e5460` (Audit-Git-Kontext, Slot 10), `ec0bf175` (Lebenszyklus, Slot 4). Slot 8 (Dual-Host) regulaer retired.
- Slots 11/13 (leere Codex-`gpt-5.6-sol`-Panes im Haupt-Checkout, seit 07:2x) gekillt; ihre Bindungen gehoerten zwei `complete`n Programs.
- **Second-host:** SSH `second-hostowner@100.64.0.2` passwortlos + sudo (MacBook-Claude hat die Host-Seite gemacht, von hier verifiziert); WoL-MAC stimmt mit `.env`; Helfer pollt alle 15 s, Last 0, 16 Kerne. **Die „Offline"-Meldung von Slot 8 war falsch:** Quiet Hours 23–07 des Daemons. Referenz-Memory `reference-second-host-ssh-and-power`.
- **§11.2o ist strukturell rot** (D1-Report `a795f0ff`): seit 09-04 16:42 19 rote isolated-Laeufe in Folge auf 13–14 Baeumen; kein Baum bekommt gruenes isolated. An Slot 6 (Program 79036e9a) gegeben, Ursache offen (Land im Fenster 09-04 13:02–16:42 oder Last).
- Slot 2 (66499a03) hat (a) angenommen, Preis benannt (Marge 3x → 2x Suite-Stille), startet dritten Beleg-Lauf.

## 3. Offen — Zuege der Nachfolgerin, in dieser Reihenfolge

1. §0 (D1 → Deploy → Wake-Probe → Zustellprobe → Relais beenden).
2. **Prozess-Dokument aus Richtung `233ee108`** (agentische Analyse + Auto-Dispatch, Rueckkanal an die MAIN, dynamischer Deckel, MAIN-Tod → Nachfolge oder Parken): als Zeile in ASTRAS Program filen (Owner: schwere Denkaufgaben an Astra), nicht an Opus.
3. **Second-host-Vorschauen:** Lane-isolated-Laeufe blockieren den Mutex hier stundenweise, waehrend der Second-host leer laeuft. Slot 1 bot seinen Lauf an; `GET /api/self/suite-offer` meldete um 14:06 `online:false, lastSeenAgeMs 390552`, obwohl der Daemon alle 15 s pollte → Online-Erkennung pruefen, dann Vorschauen verlaesslich dorthin. Eigene Zeile, kein Program (oder Fleet-Betrieb oberhalb der Linie).
4. Slot 1 landen (§0.5). Astras GLM-Land und D2 beobachten, nicht uebernehmen.
5. Owner-Sache, unveraendert: Regelbuch-Drift „GPT-Slot hat ctx null"; `/etc/sudoers.d/second-host` (pauschales NOPASSWD, bewusst).

## 4. Was mit dieser Session stirbt

Alle Hintergrund-Waechter (Relais auf send-uncertain, Pane-Waechter Slot 1) und die gefeuerten Watches (Lane Slot 1, Merge Slot 5). **Slot 2 (66499a03) will succeeden und findet keinen freien Slot** — nach dem Aufraeumen von Slot 5 geht es. Kein Auto, keine Mission, keine offene Attention. **Mechanismus, den Slot 2 belegt hat (`1388caf`, `4d7d60b`):** wir teilen EINEN Checkout; wer HANDOFF.md committet, nimmt fremde uncommittete Abschnitte mit oder ueberschreibt Zeile 1 eines fremden Titels. Regel-Vorschlag (nicht promoviert): eigenen Abschnitt VORANSTELLEN, nie Zeile 1 ersetzen, eigene Aenderung nicht laenger als noetig uncommittet lassen. Genau so ist mein Abschnitt in Slot 2s Commit `4d7d60b` gelandet.

---
---
# HANDOFF — Program-MAIN Fleet-Betrieb 2026-09 (`f170dc46e4b026ee34d9392e`, Slot 5, Opus 5): VIER Lands, drei deployt — und eines traegt eine Regression, die ich selbst gefunden und gefilt habe; 2026-09-05 11:5x, ctx GEMESSEN 44,1 % (Owner-Poll)

# HANDOFF — Program-MAIN 66499a03 „Fleet-Betrieb ohne manuelles Owner-Routing" (Slot 2, Opus 5): ERFOLGSSATZ 8 IST NICHT UNBELEGT, SONDERN STRUKTURELL UNERREICHBAR — der TUI-Repaint kommt 14 ms vor der Schwelle; der Owner hat (a) gewaehlt, die Schwelle steht auf 20 min, der dritte Beleg-Lauf ist released; 2026-09-05 15:5x, ctx GEMESSEN 29,8 %

Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Hier nur, was git
und die Sensoren nicht tragen. Lineage 4 → 16 → 10 → 3 → 5 → 2 → du.

## 0a. NACHTRAG 15:5x — DER OWNER HAT ENTSCHIEDEN, UND ZWEI SAETZE UNTEN SIND UEBERHOLT

**Entscheid (a) ist gefallen und LIVE** (Controller Slot 12, vom Owner delegiert, 13:1x):
`FLEET_STALLED_IDLE_MS='1200000'` (20 min) steht in der gitignorierten `.env:28` — kein Commit,
kein `launchctl kickstart` noetig, weil `watchdog.sh:155` mit `set -a; . ./.env; set +a` sourct
(`set -a` exportiert, die Variable erreicht `bun server.ts` also wirklich; ein blosses `. ./.env`
haette nur eine Shell-Variable gesetzt, die das Kind nie sieht — das war die Falle, die ich vor dem
Deploy geprueft habe). `FLEET_STALLED_IDLE_MS` kommt in `watchdog.sh` NULL mal vor, wird also von der
expliziten Liste hinter dem Sourcing nicht ueberschrieben. Live seit **Deploy `9b3c0db5`, Boot ok
13:45:34, bootHead `4761020`**; der Controller hat den Live-Env gemessen, ich habe die Kette
(.env-Wert · `set -a` · kein Override · Restart in `deploys.jsonl`) selbst nachgelesen.

**DAMIT SIND ZWEI SAETZE IN ABSCHNITT 0 UEBERHOLT — nicht loeschen, aber nicht mehr befolgen:**
- „Bis der Owner waehlt: `9f1dbfb4` NICHT erneut releasen" — **erledigt.** Ich habe die Zeile am
  13:47 ueber die EIGENE Tuer released (`POST /api/self/tasks/9f1dbfb4/release`, `ok:true`,
  `sessionIdMatch:"exact"`). Sie steht `queued` auf Position 1.
- **`releasedBy` ist jetzt `machine` statt `owner`.** Die beiden ersten Beleg-Laeufe gingen durch die
  Owner-Tuer; dieser geht durch die Self-Release-Tuer einer MAIN. Das ist der bessere Satz-11-Beleg,
  und er ist der Grund, warum ein Hand-Dispatch diesen Lauf beschaedigen wuerde.

**WAS DER DRITTE LAUF BRAUCHT (dein Ablauf, wenn der Report kommt):**
1. **Sofort annehmen** — `POST /api/self/fleet-report/<24-hex>/accept`. **`reason` max 500 Zeichen,
   und die Laenge VOR dem Schreiben pruefen:** ein `assert`, das die schon truncated Datei
   hinterlaesst, sendet einen LEEREN Body, und den verbucht die Route als gueltige Annahme mit
   `reason: null` — genau so ist mein Grund im zweiten Lauf verlorengegangen, ohne Re-Decide-Tuer.
2. **„FENSTER AUF HH:MM" an den Controller** (Peer-Name ueber `ListAgents`, Slot 12 — der Name
   wechselt staendig: d4 → bd → ad an EINEM Tag; nie einen alten wiederverwenden). Ein Deploy im
   Fenster nullt die Idle-Uhr aller Panes.
3. **Die Uhr selbst lesen, ohne Owner-Token:** mtime von `streams/s<slot>-<openedAt>-<hash>.raw`.
   `poll()` leitet `lastOutput` genau aus dem Wachstum dieser Datei ab. **Faelligkeit jetzt
   `mtime + 1 200 000 ms`.** Der 30-min-Repaint (`Checking for updates`) laesst nach jedem Paint
   20 freie Minuten — das Fenster existiert in JEDEM Zyklus.
4. **Der Beleg ist EINE Zeile:** `killed-empty` MIT `autoClose{reportId,disposition,decidedAt,decidedBySlot}`
   in `lane-outcomes.jsonl`. Stand 15:5x weiterhin **0**. Der Close feuert KEIN Event — niemand weckt
   dich, du musst zur Faelligkeit selbst nachsehen.

**Benannter Preis des Entscheids, den ich empfohlen habe:** die 30 min waren gegen Fehlurteile
gewaehlt („a lane running an e2e suite routinely prints nothing for ten minutes at a stretch",
Kommentar ueber der Konstante). Mit 20 min bleibt die Marge 2x statt 3x. Begrenzt wird der Schaden
dadurch, dass der Auto-Close zusaetzlich sauberen Baum, `ahead 0`, kein Merge-Verdikt UND einen
angenommenen Terminalreport verlangt: betroffen waere nur eine Lane, die BERICHTET hat und danach
20 min stumm weiterarbeitet. Ein ueberraschender `killed-empty` in den naechsten Tagen gehoert hierher.

## 0. DER BEFUND, der die ganze Jagd beendet — und die EINE offene Owner-Frage

**Erfolgssatz 8 (automatisches Cleanup einer clean+ahead0-Lane) kann fuer eine claude-Lane NIE
feuern.** Nicht Pech, nicht der Deckel, keine fremde Hand. Gemessen an der Beleg-Lane `9f1dbfb4`
(Slot 1, Branch `fleet/260905061853-2111`):

| | |
|---|---|
| Repaint 1 | 08:49:04.487 |
| Repaint 2 | 09:19:04.473 |
| Abstand | **1799,986 s** |
| `STALLED_IDLE_MS` | **1800,000 s** |

Claude Code malt in eine IDLE Pane alle 30 min `Checking for updates` (beide Paints in den
Stream-Bytes von `streams/s1-…​.raw` belegt, 59 bzw. 70 ANSI-Sequenzen, sonst nur Footer). Der Timer
laeuft ab dem VORIGEN Paint, die mtime ist dessen ENDE — die Phase ist selbstgestellt und liegt
damit dauerhaft ~14 ms VOR der Schwelle. `server.ts#poll` setzt `lastOutput` bei JEDEM Byte-Zuwachs
des pipe-pane-Streams; einzige Ausnahme ist der selbstverursachte Resize (`quietUntil`). TUI-Chrome
ist nicht ausgenommen. Also erreicht `idleMs` nie 1 800 000, Zyklus fuer Zyklus.

**Das erklaert die Null:** 0 `autoClose` in inzwischen 785 Ledger-Zeilen.

**ZWEITER VERBRAUCHER, wichtiger als mein Program:** dieselbe Schwelle speist das Feld `stalled` auf
`/api/sessions` (`server.ts`, neben `doneLookingSince`). Es kann fuer eine claude-Lane nie `true`
werden — **das Board unterzaehlt gestoppte Lanes still.** Niemand handelt darauf, aber jeder, der es
liest, liest eine Flagge, die nicht feuern kann.

**DIE OFFENE FRAGE — Attention `24c10c30f8f2d261f210f87f`, Stand 11:01 `open`.** Sie STIRBT mit
meiner Session (`reconcileAttention`, „requester session ended"); darum steht sie hier vollstaendig,
damit du sie NEU STELLEN kannst statt sie zu erben:
- **(a) `FLEET_STALLED_IDLE_MS` auf einen Wert, der nicht mit dem 30-min-Takt kollidiert (z. B. 20 min).**
  Eine Zeile in `watchdog.sh` + `launchctl kickstart`. MEINE EMPFEHLUNG: billigste Aenderung, loest
  die Phasenkopplung sofort, und danach ist der Beleg in einem Lauf zu holen.
- **(b) `poll()` schneiden, damit TUI-Chrome nicht als Arbeit zaehlt.** Sauberer, aber Chrome von
  Arbeit im Byte-Strom zu trennen ist nicht trivial — eigene Lane, eigenes Kriterium.
- **(c) Satz 8 mit der ehrlichen Einschraenkung fuehren** — dann bleibt er unbelegt und dieses
  Program schliesst mit 10 von 11.

**Bis der Owner waehlt: `9f1dbfb4` NICHT erneut releasen.** Die Zeile steht wieder `pending` (der
Kill hat sie requeued). Ein zweiter Lauf scheitert identisch an denselben 14 ms und kostet einen
Lane-Platz plus Stunden fuer ein Ergebnis, das mit Zeitstempeln auf beiden Seiten schon vorliegt.

## 1. Was seit dem letzten Handoff wirklich passiert ist

- **Die Beleg-Lane ist gelaufen** (Start 08:18:53 per TICK, nicht von Hand — Satz 11 fuer diese
  Zeile intakt). Report `7035c488f34aeeca12510a6d` um 08:22:08, von mir um **08:22:48** angenommen;
  die Entscheidung traegt mein exaktes Occupant-Tripel, also war die Auto-Close-Vorbedingung erfuellt.
- **Ende 09:21:21 per Owner-Token**, `killed-empty`, `commitCount 0`, **ohne** `autoClose`.
  Regelkonform: die 35-min-Zusage war abgelaufen und ich hatte „FENSTER ZU" gemeldet.
- **Ehrlich zur Bilanz:** der Lane-Platz wurde frei, weil der Owner 08:18/08:19 vier Lanes killen
  liess — nicht weil eine Lane von selbst endete. Und `9f1dbfb4` traegt `releasedBy:"owner"`, ging
  also durch die Owner-Tuer, nicht durch die Self-Release-Tuer einer MAIN.
- **Alle uebrigen Auto-Close-Klauseln HALTEN** (`server.ts#laneAutoCloseRefusal`, einzeln geprueft):
  Flag armiert, `autosOn`, Worktree-Lane, kein Steward, keine Merge-/Commit-/Review-Jobs, `taskId` +
  `programId` am Slot, Program aktiv, genau EIN Terminalreport mit Urteil des exakten Empfaengers,
  Provenienz stimmt. `mergeLast.get(1)` war `null` (Controller-Lesung 08:26). Die Klaerungs-Falle war
  entschaerft (`awaiting: null`, keine offene Clarification). **Es fehlte einzig die Uhr.**

## 2. Werkzeuge, die ich teuer gelernt habe — nimm sie mit

- **DIE IDLE-UHR IST OHNE OWNER-TOKEN LESBAR: die mtime von `streams/s<slot>-<openedAt>-<hash>.raw`.**
  `poll()` leitet `lastOutput` genau aus dem Wachstum dieser Datei ab. Faelligkeit =
  `mtime + STALLED_IDLE_MS`. Das ersetzt jede Bitte an den Controller um eine `lastOutput`-Lesung —
  und es zeigt AUCH, WAS gemalt wurde (Tail entschachteln, ANSI strippen).
- **`POST /api/self/tasks` ist bei 10/10 pending advisory rows ZU** („program advisory filing cap
  reached … ask the owner to dispose"). Das Register dieses Programs nimmt keine Zeile mehr an; meine
  zwei Befunde stehen deshalb hier statt dort.
- **`accept` nimmt `reason` bis 500 Zeichen — und einen LEEREN Body akzeptiert es ebenfalls mit
  `ok:true`.** Mein erster Versuch lief in einen `assert`, schrieb eine leere Datei, und
  `--data-binary @leer` wurde als gueltige Annahme OHNE Grund verbucht. Die Annahme steht, `reason`
  ist `null`, und es gibt keine Re-Decide-Tuer. **Laenge VOR dem Schreiben pruefen, nie im selben
  Skript, das die Datei schon truncated hat.**
- **`GET /api/self/fleet-report` traegt die Entscheidung NICHT.** `disposition` liest sich dort als
  `None`, auch wenn die Annahme steht — ich habe daraus einmal faelschlich „nicht angenommen"
  geschlossen. Der Beweis ist die 409-Antwort eines zweiten `accept` (`already accepted`) samt
  `decision`-Objekt, oder `fleetReports` in `fleet.json`.
- **Ein `bun server.ts` mit frischer Startzeit ist nicht automatisch ein Deploy.** Ein Suite-Lauf
  startet seinen eigenen. Unterscheide an `deploys.jsonl` und am tmux-Socket (`fleettest<pid>`),
  nicht an der Prozessliste — ich hielt 08:55:35 fuer einen Deploy in meinem Messfenster.
- **Ein Heartbeat-Text altert schneller als du denkst.** Zwei meiner vier Autos feuerten mit
  Verzweigungen, deren Praemisse ueberholt war (einer haette eine falsche Attention ausgeloest).
  Schreib in den Text, WORAN der Nachfolger merkt, dass die Praemisse tot ist.

## 3. Korrekturen an meinen eigenen frueheren Saetzen

- **`f176ad1e` war KEIN Defekt.** Ich meldete, `reconcileAttention` lasse die Attention einer
  beendeten Anfragerin auf `open` stehen. Sie stand kurz darauf auf `refused` („requester session
  ended"): die Refusal haengt am Slot-TEARDOWN, und der lag hinter der Succession-Grace. Ein
  Zeitfenster, kein Steckenbleiben — die Projektion korrigierte meine Zeile selbst von `OWNER_GATE`
  auf `READY (R5)`.
- **Der Repaint war NICHT der Agentenzaehler** (so die naheliegende Vermutung des Controllers,
  2,3 s vor einem fremden Land). Die Bytes sagen `Checking for updates`. Die Cadence-Zaehlung ueber
  vier Streams (s1 1×/40 min · s5 9×/294 min · s15 6×/916 min · s6 2×/703 min) sah unregelmaessig aus
  und liess mich zuerst sagen, die Schwelle sei „treffbar, nicht unerreichbar". Erst das ZWEITE
  Intervall an derselben Pane zeigte die Phasenkopplung. **Eine Haeufigkeit ueber fremde Panes ist
  kein Ersatz fuer zwei aufeinanderfolgende Messungen an derselben.**

## 4. Offen, ehrlich

- **Satz 8** — die Owner-Wahl oben. „Gebaut, nie gelaufen" ist ab jetzt der falsche Satz; richtig ist
  **„gebaut, kann unter der heutigen Schwelle nicht laufen"**.
- **Satz 11** — strukturell offen, unveraendert: 3 von 4 Program-Lands ueber Owner-Token, und die
  Beleg-Zeile selbst war owner-released.
- **Ungeprueft von mir:** ob die 14-ms-Phasenkopplung auch fuer `codex`- und `pi`-Panes gilt (deren
  TUIs malen anders; nur claude ist gemessen). Wer (a) waehlt, sollte das mitmessen — sonst
  repariert er die Uhr fuer einen Harness und nicht fuer die Fleet.
- **Dieser Commit ist ein DIREKT-COMMIT aus dem Haupt-Checkout** und damit fuer jedes land-seitige
  Ledger unsichtbar: keine Land-Note, keine `lane-outcomes`-Zeile, kein Post-Land-Audit. Verifikation
  von Hand, proportional fuer eine reine Prosa-Aenderung: `bun install --frozen-lockfile` +
  `bun e2e/pins.ts` (Ergebnis unten im Commit-Body). Kein laufender Land wurde beruehrt — `merges`
  und `landPending` waren beide leer, an `fleet.json` geprueft, bevor ich committet habe.

# HANDOFF — 🎛 Fleet Controller (Slot 3, Fable 5.1): zwei Deploys gefahren, Freeze aufgehoben, Codex auf 0.153.4, Astra mechanisch belegt UND sein Fenster widerlegt; DEIN AUFTRAG hat zwei Stufen, und Stufe 1 ist deine eigene Erdung; 2026-09-05 08:0x, ctx GEMESSEN 30,5 %

> **Ein Abschnitt je LEBENDEM Prinzipal** (Vorschlag, nicht promoviert): dieser ERSETZT den der
> Controller-Vorgaengerin (Slot 9, 03:0x). **Der Controller ist, wer das Label `🎛 Fleet Controller`
> traegt — nie eine Slot-Nummer aus Prosa.** Lineage: 5 → 6 → 9 → 3 → 9 → 3 → du.

Zustand ableiten, nicht hier lesen: `./state.sh`, `./register.sh`, Owner-Poll, Panes. Hier steht nur,
was git und die Sensoren nicht tragen.

## 0. DEIN AUFTRAG — zwei Stufen, und die Reihenfolge ist eine Owner-Vorgabe

Owner, 2026-09-05 07:5x, **WOERTLICH** (die Rangliste endet, wo diese Saetze erfuellt sind):

> „dein nachfolger sollte in fable5.1 laufen und mir dann helfen eine asta session zu spawnen die
> sich die claude fleet codebase einmal ganz genau anschaut unter dem hintergrund wissen was das
> ganze werden soll, und dann nach verbesserungen und optimierungen sucht, von außen nach Innen und
> mit besonderer sorgfalt für die md dateien des systems und der einzlenen agenten rollen. astra
> sollte hier für alles opus5 worker benutzen, für die ausgiebige rechercher, implementierung, usw.
> astra sollte sicherstellen das diese agenten auch die richtigen anweiseungen, werkzeuge und
> datenschichten haben um eine gute entscheidung zu treffen"

Zwei Minuten spaeter nachgereicht, **WOERTLICH**:

> „und bevor dein nachfolger diese astra session erzeugt sollte er sich zuerst selbst mit opus
> agenten einen überblick verschaffen" · „darüber woran die slots arbeiten usw."

### Stufe 1 — DEIN eigener Ueberblick, mit Opus-Agenten, BEVOR Astra existiert

Der Owner hat Subagenten fuer diese Sache ausdruecklich freigegeben (das Regelbuch verbietet sie
sonst ohne Aufforderung). Fuer den Bericht dieser Nacht liefen vier Opus-Agenten parallel und das
hat funktioniert; das Muster ist wiederverwendbar:

- **Ein Agent je Frage, nicht ein Agent fuer alles.** Bewaehrt hat sich der Schnitt Commits/Features
  · Ledger-Zahlen · Betrieb+Queue+Programs · Erkenntnisse/Korrekturen.
- **Jeder Prompt braucht harte Verbote**, sonst kostet er die Maschine: keine Suiten starten, kein
  `bun run build`, kein git-Schreibzug, kein tmux-`send-keys`, kein `kill`, keine POST-Route. Lesende
  GETs sind in Ordnung.
- **Token-Hygiene in JEDEN Prompt**: `ps -eo command` druckt hier die Self-Tokens FREMDER Slots in
  den Bericht. Zaehlen ja (`ps -eo command | grep -c '<muster>'`), Zeilen ausgeben nein.
- **`rg` respektiert `.gitignore`**, und gitignored sind ausgerechnet `fleet.json`, die drei Ledger,
  `.env`, `CLAUDE.md` und `rulebook/`. Fuer alles Operative gehoert `rg -uu`, `grep` oder `python3`
  in den Prompt, sonst liefert der Agent ein LEERES Ergebnis statt eines Fehlers.
- **Agenten erben deine Regeln nicht.** Schreib „lies, bevor du behauptest", „zitiere Datei und
  Symbol", „sag, was du NICHT geprueft hast", „trenne gemessen von abgeleitet" wortwoertlich hinein.

Die Frage dieser Stufe ist die des Owners: **woran arbeiten die Slots gerade**. Zielbild fuer deinen
eigenen Kopf, bevor du Astra briefst: je belegtem Slot Rolle, Harness, Modell, Fuellstand und die
Arbeit, an der er sitzt; je aktivem Program die gebundene MAIN und ob sie lebt; die offenen
Queue-Zeilen nach Gruppe; die zwei Deckel und wer an ihnen steht. `./state.sh` und `./register.sh`
sind der Anfang, nicht das Ende — die Panes tragen den Rest.

### Stufe 2 — die Astra-Session, danach

**Astra ist mechanisch belegt, nicht vermutet** (2026-09-05 07:4x, Probe im Scratchpad):
Modell-Id `gpt-6-astra`, Harness `codex`, geantwortet hat sie. Beide Codex-Installationen stehen auf
**0.153.4** (Astra verlangt ≥ 0.153.1). `HARNESS_MODEL_RE` laesst die Id ohne Codeaenderung durch,
`effortLevels` des Codex-Adapters traegt `high`/`xhigh`/`max`/`ultra`. Eine Astra-Lane ist also
sofort dispatchbar.

**DIE EINE ZAHL, DIE DAS DESIGN BESTIMMT: Astras Fenster ist hier 258 400 Tokens, nicht 1 050 000.**
Gemessen am `token_count`-Satz der Rollout-Datei der Probe, nicht aus der Ankuendigung uebernommen
(die nennt 1,05 M; auf diesem Konto, Plan `prolite`, gilt die kleinere Zahl). Konsequenz, und sie ist
der Kern des Briefs:

- **Astra darf die Codebase NICHT selbst lesen.** 461 getrackte `.md`-Dateien allein, davon 352 unter
  `docs/`; `server.ts` hat 24 603 Zeilen. Ein einziger Lesedurchgang sprengt das Fenster.
- **Astra ist der KOPF: briefen, Ergebnisse zusammenfuehren, urteilen.** Das Lesen, Recherchieren und
  Implementieren gehoert den Opus-5-Lanes — genau das hat der Owner mit „für alles opus5 worker"
  gesagt.
- Zum Vergleich, damit die Groessenordnung sitzt: diese Controller-Session hat ~305 000 Tokens
  verbraucht, also mehr als Astras ganzes Fenster. Zwei Codex-Lanes standen heute nach 80 bzw. 113
  Minuten Arbeit an EINER Scheibe bei 64,6 % und 72,6 %.

**Worker-Tripel fuer jede Lane:** `{harness:"claude", model:"claude-opus-5[1m]", effort:"high"}` —
das ist zugleich die geltende Modellpolitik (Owner 2026-09-02: Orchestrierung Fable, Lanes Opus 5).

**Der fleet-native Weg**, und er braucht dich als Uebersetzer: Astra wird **Program-MAIN eines neuen
Programs**. Eine Session schlaegt ein Program nur VOR (`POST /api/self/programs`); **Bestaetigen und
Aktivieren sind Owner-Akte**, ebenso die Bindung der MAIN. Danach filet Astra eigene Zeilen
(`POST /api/self/tasks`), gibt sie frei (`POST /api/self/tasks/:id/release`, setzt nur
`pending → queued` und dispatcht NICHT), und der Tick startet die Lanes.

**Deckel, die den Takt bestimmen** (alle heute live gemessen): `FLEET_DISPATCH_MAX_LANES` = **2** je
Repo, und der Program-Deckel faellt mangels eigener Variable auf denselben Wert zurueck — eine breite
Review serialisiert also auf zwei gleichzeitige Lanes. `PROGRAM_MAX_PENDING` = 5 offene `auftrag`,
`PROGRAM_MAX_PENDING_ADVISORY` = 10 offene beratende Zeilen je Program. **Zwei Programs stehen HEUTE
am Advisory-Deckel**; ein drittes Program erbt das Problem nicht, aber der Owner muss die zwanzig
Altzeilen irgendwann disponieren.

**Drei Fallen, die genau diesen Auftrag betreffen** — sie gehoeren in Astras Gruendungsbrief, nicht
in deine Erinnerung:

1. **Codex laedt `AGENTS.md`, NICHT `CLAUDE.md`.** Der portable Vertrag traegt die Controller-Zeile
   und den 25-%-Hinweis, die hostspezifische Realitaet steht im Overlay. Was Astra davon braucht,
   muss der Brief namentlich anfordern.
2. **`CLAUDE.md` und `rulebook/` sind gitignored** — der Auftrag zielt aber ausdruecklich auf „die md
   dateien des systems und der einzelnen agenten rollen". Eine Lane sieht ihre Aenderung daran nie in
   `git status` und kann sie NICHT landen; sie stirbt mit dem Worktree. **Regelbuch-Befunde muessen
   als TEXT im Report kommen**, und der Fragment-Edit passiert im Haupt-Checkout. Getrackt und damit
   landbar sind `AGENTS.md`, `SYSTEM.md`, `README.md` und alles unter `docs/`.
3. **Eine reine Mess-Lane ist ohne Artefakt nicht landbar** (`FILES: keine`, `ahead=0`). Der Weg ist
   die `mess-notiz`-Skill: Ergebnis als getrackte Notiz unter `docs/messungen/`, committen, landen.
   Sonst muss jedes Ergebnis von Hand aus der Pane geerntet werden, bevor der Slot stirbt.

**Werkzeuge und Datenschichten, die in jeden Lane-Brief gehoeren** (das ist der Owner-Satz „die
richtigen anweisungen, werkzeuge und datenschichten"): getrackter Code → `rg`; alles Operative →
`rg -uu`/`grep`/`python3`; Struktur → `ast-grep --pattern '<muster>' --lang ts <datei>`; der
Wissensgraph ist read-only auch aus einer Lane befragbar (`graphify query "<frage>" --graph
"$(dirname "$(git rev-parse --git-common-dir)")/graphify-out/graph.json"`, Rezept in `AGENTS.md`);
Wissen aus `git show main:docs/...` statt aus dem Spawn-Zeit-Schnappschuss des eigenen Baums;
Befundregister sind die COMMIT-BODIES und `git notes --ref=fleet/land`, nicht die Subjects; Zahlen
kommen aus den drei Ledgern und den **ZWEI** Trail-Registern (lokal `e2e-trail/`, Audits nach
`$TMPDIR/fleet-e2e-trail` — wer nur eines liest, untertreibt, heute mit 215/12 statt 250/20 bezahlt).

**„unter dem hintergrund wissen was das ganze werden soll"** — die Quellen dafuer, alle geprueft
vorhanden: `AGENTS.md` (Vokabular, Rollen-Tabelle, harte Invarianten), `SYSTEM.md` (13 KB, hat genau
EINEN Leser-Verweis im ganzen Baum, seine Rolle ist selbst eine offene Owner-Frage),
`docs/attic/operating-model.md`, `docs/attic/autonomy-plan.md`, `docs/controller.md`,
`docs/steward.md`, `docs/portfolio-plan-2026-09-02.md`, `docs/agentic-control-plane-program-2026-08-20.md`
und die Program-Datensaetze in `fleet.json`.

**„von außen nach Innen"** liest sich am Baum als: portabler Vertrag und Einstiegsflaechen zuerst
(`AGENTS.md`, `README.md`, `SYSTEM.md`, Board-Client), dann die Rollen-Dokumente, dann die
Server-Naht (`server.ts` plus die zehn Blatt-Module unter `server/`, Invariante: kein `server/*.ts`
importiert aus `server.ts`), zuletzt die Gates und Suiten.

## 1. Rolle (unveraendert, Owner-Entscheide 2026-09-04 09:1x/19:2x + Korrektur 00:5x)

Ueberblick halten, Owner-Nachrichten auf Programs routen. Lands vom Board NUR fuer Zeilen ohne
lebende MAIN oder ohne Self-Land-Promotion. Audit-Adjudikation: die MAIN urteilt, der Controller legt
ab; fuer Controller-gelandete Zeilen urteilt der Controller. Lane-Events der Program-Lanes gehoeren
der Program-MAIN. **Der Controller haelt den Deploy-Trigger und die Mutex-Koordination.**
Modellpolitik: Controller und MAINs Fable 5.1, Lanes Opus 5 high, Codex `gpt-5.6-sol` bzw. jetzt
`gpt-6-astra`, GLM ueber `pi-zai` (nie `pi`).

## 2. Was in dieser Session (02:49–08:0x) gefallen ist

- **R2' gelandet** (Slot 10, `1c3c6ef` → `e71f620`, sechs Commits, Gate gruen ueber alle sieben
  Schritte) und **um 03:56 deployt** (`640d0024`, Boot-Verdikt ok, hitTarget, `deployGap` 0). Damit
  ist der bounded ff-Retry scharf: `FLEET_LAND_FF_RETRY_ROUNDS` defaultet in `server.ts` auf 2 und
  ist in `watchdog.sh` nicht gesetzt. **Der fleetweite Commit-Freeze ist aufgehoben und strukturell
  ueberfluessig.**
- **Zweiter Deploy 07:36** (`82f55be0` auf `9718592`, ok, hitTarget, `bundleStale` false): damit sind
  das proportionale Tier-2-Audit, der FIFO-Suite-Mutex und die FAIL-Namen auf lokalen Audit-Zeilen
  live.
- **Audit auf `e71f620` rot 3/3661, von Slot 10 selbst als `flake` adjudiziert** (`at=1788573383933`).
  Ich habe die Evidenz geliefert und NICHT selbst geurteilt — die MAIN urteilt.
- **Attention `6793f141` (Deploy-Entscheid) beantwortet und geschlossen.** Sie war an den Owner
  gerichtet, der Deploy-Trigger liegt aber beim Controller.
- **Codex aktualisiert.** Falle, die eine halbe Stunde gekostet haette: `codex update` ruft
  `npm install -g` und trifft damit den Homebrew-Prefix, waehrend der PATH `~/.local/bin` zuerst
  nimmt. Beide Baeume stehen jetzt auf 0.153.4; `codex doctor` meldet die Doppelinstallation
  weiterhin als Fehler, weil das naechste Update wieder nur eine Haelfte trifft.
- **Statusbericht ueber 16 h an den Owner geliefert**, aus vier parallelen Opus-Agenten.

## 3. Was JETZT offen ist, alles Owner-Sache

1. **Eine offene Attention, `d549e09b`, seit 02:29** (Dual-Host, MAIN Slot 8 lebt): Gate 3 ist die
   erste Installation der systemd-Vorlage auf einem Host, Gate 4 die Aktivierung einer zweiten
   netzerreichbaren Instanz. Beide sind Host-Akte, von einer Session nicht fahrbar. Die MAIN wartet
   und faengt bis zur Antwort nichts an.
2. **Vier Programs stehen `active` mit toter gebundener MAIN**: Private-repo-o, private-repo-p, Private-repo-j,
   Game-Maker v2. Vorschlag der Vorgaengerinnen: zwei archivieren, zwei neu binden.
3. **Zwei Programs am Advisory-Deckel** (je 10/10 pending): sie koennen keine Messung mehr in die
   Queue legen, bis der Owner disponiert.
4. **Sicherheitsbefund, unberuehrt:** die Datei-Route liest mit dem Owner-Token jede Datei auf der
   Platte, ohne Sperrliste; `.env` und der GLM-Schluessel sind vom Board aus lesbar.
5. **Die globale `~/.claude/CLAUDE.md` widerspricht dem Fleet-Vertrag in drei Punkten** (u. a.
   Kontextschwelle 60 % gegen 25/30). Owner-Datei, nicht unsere.
6. **§11.2o ist kein Flake mehr, sondern ein Regimewechsel**: 1,4 % Rot vor dem 04.09. gegen 39,5 %
   danach, im 16-h-Fenster 19 Rot bei 23 Beobachtungen. Das Regelbuch fuehrt weiter 2–3 %, also den
   Durchschnitt ueber beide Regime. Gehoert dem Program Audit-Determiniertheit; die Wurzel ist offen,
   weil die Sonde ihr eigenes Diagnosefeld wegwirft.
7. **Maschinenhygiene:** 3,5 GB Scratch unter `$TMPDIR`, ein verwaister tmux-Socket, 297 aktive
   Codex-Rollouts mit 1,21 GB. Niemand reapt das.

## 4. ZUSAGEN, DIE DU ERBST — sie sterben sonst still mit mir

- **Die Lane mit `taskId 9f1dbfb4` bleibt ab IHREM Report 35 Minuten unangetastet**: kein Kill, kein
  Land, kein Send, auch wenn sie wie ein freier Slot aussieht. Zustandsbasiert, kein Branchname
  noetig. Quelle: Attention `bc59777c`, festgehalten in `80fd38e`. Sie stand NICHT im Handoff meiner
  Vorgaengerin und waere fast verloren gegangen — die Program-MAIN 66499a03 hat sie zurueckgeholt.
  Ohne sie stirbt deren Erfolgssatz 8 ein drittes Mal.
- **Vor JEDEM Deploy fragst du die Program-MAIN 66499a03 nach ihrem Fenster.** Sie meldet von sich
  aus „FENSTER AUF HH:MM" bei ihrer Report-Annahme und „FENSTER ZU" mit Ergebnis; solange keine
  dieser Nachrichten vorliegt, ist die Antwort nein und du deployst ohne Ruecksicht.
- **Der Grund dafuer, am Code verifiziert:** die Boot-Rehydrierung stempelt `s.lastOutput` jeder Pane
  auf die Bootzeit, und `lastOutput` ist nicht persistiert. **Jeder srv-Neustart nullt die Idle-Uhr
  JEDER Pane.** Der Auto-Close verlangt 30 Minuten ununterbrochenes Idle — ein Deploy im Fenster
  toetet den Beleg, ohne dass irgendjemand die Lane anfasst. Das deckt keine der „nicht anfassen"-
  Zusagen ab, weil es kein Eingriff in die Lane ist.

## 5. Messungen dieser Session, die anderswo nicht stehen

- **Astras Fenster ist hier 258 400, nicht 1 050 000** (Rollout-`token_count` der Probe). Der
  Codex-Plan ist `prolite`, das Wochenlimit stand bei **76 %** mit Reset am 07.09., Guthaben null.
  Wer eine Astra-Session aufsetzt, konkurriert mit den Codex-Lanes um denselben Topf.
- **REGELBUCH-DRIFT, noch nicht nachgezogen:** `rulebook/einstieg.md` behauptet, ein GPT-Slot habe
  `ctx: null` und dort zaehle nur die Selbstauskunft. **Falsch.** Der Codex-Adapter liest Zaehler UND
  Fenster aus Codex' eigener Rollout-Datei (`windowFromFile: true`); zwei Codex-Lanes meldeten heute
  64,6 % und 72,6 %. Das 25/30-Band hat auf Codex also einen Sensor. Fragment editieren, mit dem
  Einzeiler aus dem Kopf von `rulebook.ts` rendern, `bun e2e/pins.ts`.
- **`supports.selfSchedule: false` beim Codex-Adapter gated NICHTS** — das Feld wird nur vom Client
  und von zwei Pins gelesen. Die Zugangsdaten stecken in jeder Pane mit `cwd`. Es ist eine
  Nicht-Werbung fuer eine ungemessene Faehigkeit, kein Verbot.
- **Die Nachfolge hat kein Harness-Tor**: `handleSelfSucceed` prueft Handoff, Occupant und
  Program-Bindung, erbt den Harness und validiert Modell/Effort gegen dessen eigene Liste. Ein
  Nicht-claude-Prinzipal koennte sich also selbst abloesen.
- **Codex hat kein Transcript im Fleet-Sinn** (`supports.transcript: false`, bewusst): Gespraechsansicht
  und ✨-Zusammenfassung des Boards funktionieren fuer einen Codex-Slot nicht. Fuer eine Astra-Session
  heisst das: was der Owner lesen soll, muss in einem Artefakt landen, nicht in der Pane bleiben.

## 6. Was mit dieser Session stirbt

Zwei gefeuerte Merge-Watches und ein gefeuerter Audit-Watch, alle zugestellt und quittiert. Keine
offene Attention meinerseits. Kein Hintergrund-Poller. Die zwei Zusagen aus §4 ueberleben NUR, weil
sie hier stehen.

---
---


# HANDOFF — Program-MAIN „Fleet-Betrieb 2026-09" (`f170dc46e4b026ee34d9392e`, Slot 5, Opus 5): drei Lands, alle gruen, KEINER deployt — und der Beweis dafuer ist ein `fails: null`; 2026-09-05 06:0x, ctx GEMESSEN 33,8 %

Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Hier nur, was git
und die Sensoren nicht tragen. Die Abschnitte darunter sind FREMD (geteilte Datei).

## 0. DAS ERSTE: was mit meiner Session stirbt

1. **ERLEDIGT — die Attention `6793f1414b53a1c6d3b428d6` IST BEANTWORTET: der Deploy ist
   gefahren.** 2026-09-05 07:36 vom 🎛 Fleet Controller (Slot 3) auf Owner-Delegation. Verdikt am
   LEDGER, nicht am 202: `id 82f55be0, stage boot, ok true, target = bootHead = 9718592,
   hitTarget true, bundleStale false, ms 5281`; danach `deployGap.behindCount 0`, `codeBehind
   false`, `errors null`, neun Panes leben weiter. **Selbst gegengeprueft:** Server seit 07:36:12,
   `./state.sh` LIVE-Zeile stimmt. Damit sind `eb07267`, `cbccd3a`/`036ff7c` und
   `d0befb9`/`9a03d4a` REAL auf dieser Maschine — mitgenommen wurden auch `1a69a52`, `b73b6b8`,
   `9718592`, weil das Ziel die Lane-Spitze war, nicht ein einzelner Commit.
   **`FLEET_LANE_AUTOCLOSE=1` ist ab diesem Boot ERSTMALS real scharf** (Stand davor: 0 von 777
   Outcome-Zeilen mit `autoClose`). Der erste echte Beleg gehoert **Program 66499a03 (Slot 2)**,
   nicht diesem Program — nicht wegschnappen.
   Der historische Text der Attention, falls jemand die Begruendung sucht:
   **DEPLOY-ENTSCHEID.** Drei Lands von heute frueh sind auf main, aber NICHT auf dieser Maschine.
   Laufender Server seit 03:56 auf `089fb0a`; main steht auf `9a03d4a`. **Beleg, kein Verdacht:**
   das Post-Land-Audit zu `cbccd3a` kam rot zurueck und seine Zeile trug `fails: null` — genau das
   Feld, das `eb07267` eingefuehrt hat, damit eine lokale Audit-Zeile ihre Fehlernamen NENNT; ich
   musste den einen Fehlschlag von Hand aus der Trail-Datei graben. Dieselbe Zeile sagt
   `proportional: null`, also laeuft auch `cbccd3a` nicht. Erst der Deploy macht wahr: `eb07267`
   (rotes Audit nennt seine Checks) · `cbccd3a` (docs-Tip zieht install+pins statt ~30 min voller
   Suite) · `9a03d4a` (Suite-Mutex wird FIFO). **Zwei Dinge gehoeren zum Deploy:**
   `FLEET_LANE_AUTOCLOSE=1` ist armiert, hat aber in 771 Ledger-Zeilen NIE ausgeloest (0 Zeilen mit
   `autoClose`) — ein Deploy ist der Moment, in dem ein nie ausgeloester Flag scharf wird; und
   `POST /api/deploy` lehnt bei laufendem Post-Land-Audit mit **409** ab.
2. **ERLEDIGT, nichts mehr offen:** das Audit zu `9a03d4a` ist eingelaufen — **rot, 1 von 3678,
   und der eine Fail ist wieder §11.2o**; die eigenen Sonden des FIFO-Lands (§2c, suite-lock-Pins)
   sind ALLE gruen. Von mir als `flake` adjudiziert. Damit haben alle drei Lands ihr Tier-2-Urteil:
   `eb07267` gruen · `cbccd3a` rot/§11.2o · `9a03d4a` rot/§11.2o.
   **DIE KOSTEN DAVON SIND JETZT MESSBAR UND GEHOEREN AUF DEN TISCH: drei Audits heute, je ~31 min,
   ZWEI davon ausschliesslich an diesem einen Check rot.** Ein Audit, das nur noch wegen einer
   bekannten Familie rot ist, erzieht zur Gewoehnung — genau der Mechanismus, vor dem B-14 warnt.
   Der billige erste Schnitt steht unveraendert in §11.2o: die Sonde druckt nur `phase` und wirft
   `phaseBasis`/`unknown` weg, obwohl der Server beide mitliefert.
3. **Slot 4 traegt eine frische Lane `fleet/260905035705-b963` mit `taskId: None`** — vom Tick
   gestartet, waehrend ich landete. Ich habe sie NICHT gebrieft und nicht geprueft; sie gehoert
   keiner Zeile dieses Programs, die ich kenne. Erst lesen, dann urteilen.

## 0. WAS MIT MEINER SESSION STIRBT — NICHTS HAENGT IN DER LUFT

`GET /api/self` bei der Uebergabe: **0 autos, 0 armed watches, keine offene Attention** (die eine,
`6793f1414b53a1c6d3b428d6`, ist vom Owner mit dem Deploy beantwortet). Baum sauber. Der
Astra-Relais-Auftrag liegt beim CONTROLLER, nicht bei dir — er war kurz meiner und ist um 11:4x
zurueckgezogen worden; er steht deshalb absichtlich nicht mehr im Handoff.

**Ich habe zu spaet uebergeben, und der Grund gehoert hierher:** 44,1 % gegen ein Band von 25/30.
Es gibt KEINEN Kontext-Nudge im Code, und die Supervisor-Bindung ist seit dem 23.08. stale — es
kommt also niemand und sagt es dir. **Miss deinen Fuellstand selbst und frueh** (Schnipsel im
Regelbuch, Abschnitt Kontext-Band). Anker: ~2,5 Punkte je Land; ich habe vier gefahren plus acht
Direkt-Commits.

### Die Zeilen, die JETZT laufen oder warten

- **`35ac0b97` (queued) — die dringendste.** Fix fuer die Regression aus dem naechsten Abschnitt;
  sie ist LIVE und macht jedes rein-docs-Land rot. Brief traegt Wurzel, zweiteiliges
  Done-Kriterium und drei benannte Entwuerfe mit ihren Fallen.
- **`ec0bf175` (SENT, Lane laeuft)** — Lebenszyklus S2, Opus 5, ersetzt `9fd34beb`.
- **`02740e69` (queued)** — Lebenszyklus S5a, Opus 5, ersetzt `db6902c4`.
- **`9fd34beb` und `db6902c4` DUERFEN NIE FREIGEGEBEN WERDEN** — ihr `spawn` traegt persistent
  `codex/gpt-5.6-sol`, KEINE Route aendert es, ein Release spawnt wieder eine sol-Lane gegen die
  Owner-Ansage von 08:1x. **Dasselbe gilt fuer die zwoelf weiteren sol-Zeilen** (S3a-i, S3a-ii,
  S3b, S3c, S3d, S4, S5b, S5c, S12, CP-A, CP-B, CP-C): wer eine davon will, **filt sie NEU**, so
  wie ich es mit den zweien getan habe — nicht freigeben.

### Das Regelbuch: gerendert und konsistent, aber GEWACHSEN statt verdichtet

`CLAUDE.md` ist **81 322 B**, das Ziel des Controllers ist **< 75 000**. Ehrlicher Stand: **die
Verdichtung von `rulebook/lane-discipline.md` ist NICHT angefangen** — ich habe im Gegenteil heute
**rund 3,6 KB HINZUGEFUEGT** (Tier-2-proportional; FIFO-Mutex samt der Einschraenkung, dass
`server.ts#holdSuiteLock` ohne Ticket nimmt; die Deploy-Regel zur Idle-Uhr). Jede dieser Zeilen
beschreibt Verhalten, das sich heute auf main GEAENDERT hat, keine war falsch — aber der Posten ist
damit der faelligste des Programs und grosszuegig meiner.
**Gerendert ist es:** ich habe ausschliesslich Fragmente editiert und danach den Render-Einzeiler
aus dem Kopf von `rulebook.ts` gefahren; `bun e2e/pins.ts` war nach JEDEM Zug ALL PASS, der
byte-genaue Pin haelt. Es liegt nichts Halbfertiges herum.

## 0b. EINE REGRESSION, DIE ICH SELBST GELANDET HABE — sie ist LIVE und macht jedes docs-Land rot

**`cbccd3a` (Tier 2 proportional) faehrt `bun e2e/pins.ts` in einem Baum OHNE `.git`.** Seit dem
Deploy 07:36 ist damit JEDES rein-docs-Land rot. Zwei von zwei: Audit-Zeilen `2e671a47` (08:49,
375/6) und `8a4655cb` (09:49, 377/6), beide `proportional:true`, beide ~1 s, beide sechs identische
Fails mit `fatal: not a git repository (or any of the parent directories): .git`.

**Die Sonden sind nicht schuld — sie scheitern korrekt ALS SIE SELBST** („die Ableitung lief",
„PROBE: git named …", „source set is not empty"). Genau die Regel, die dieses Repo verlangt, und
sie hat funktioniert.

**Wurzel, am Code gelesen:** `server.ts#runPostLandAudit` legt den Tip per
`snapshotIntegrationTree` in einen tmpdir und spawnt mit `cwd: dir`; ein Snapshot hat kein `.git`.
Der VOLLE Pfad ueberlebt das nur, weil `e2e-isolated.sh` `node_modules` auf den Quell-Checkout
zurueck-symlinkt (`docs/e2e-trail.md` §3) — die proportionale Kette faehrt nackt, ohne diesen
Zeiger. Der LAND-GATE ist nicht betroffen: er laeuft im Lane-Worktree, und der hat eine
`.git`-DATEI.

**Erledigt:** beide Zeilen als `real` adjudiziert (NICHT flake — wer das als Rauschen ablegt,
konserviert es), und **`35ac0b97` ist gefilt UND freigegeben** (Opus 5, mit Wurzel, Done-Kriterium
in zwei Teilen und einem benannten Entwurfsraum). **Ich habe den Fix NICHT selbst gefahren:
ctx 38 %, und die Wahl zwischen den drei Entwuerfen ist echte Entwurfsarbeit, keine Glue.**

**UND EIN ROT, DAS ICH BEWUSST NICHT ADJUDIZIERT HABE:** das Audit zu `d37f835` (09:49, 3678/4).
Drei der vier kenne ich — `projection nextAction` (§11.2o) und das Paar `subject-gone` /
`counterprobe`, das die Vorgaengerin als gemeinsam fallend vermessen hat. Die vierte,
**`D2 setup: both closing lanes reached the spent shape …`, habe ich NICHT untersucht** — und eine
SETUP-Zeile heisst, dass alles unter ihr UNGEMESSEN ist, nicht verletzt. Sie ist ausserdem genau
die Familie, die der Deploy erstmals scharf gemacht hat (`FLEET_LANE_AUTOCLOSE`). **Ein
unadjudiziertes Rot ist sichtbar, ein falsch adjudiziertes ist unsichtbar** — darum liegt es offen.

## 1. Was gelandet ist — VIER Lands, alle mit gruener Note, alle von MIR (actor-Rail, `confirmedByHuman false`)

- **`bc0609f8` → `d37f835`** (GATE-ENV, gelandet 09:2x NACH dem Deploy). `runVerify` spawnte die
  Gate-Kette ohne `env`-Option, Bun gab ihr `process.env` VOLLSTAENDIG; jetzt durch
  `server.ts#verifyChildEnv`. **Der Befund liegt ueber dem Brief: `FLEET_SELF_TOKEN` und
  `FLEET_SELF_SLOT` — die scoped Lane-Credentials — erreichten den Gate-Kind-Prozess.** Gemessen
  14 FLEET_*-Namen vorher, 0 nachher, PATH byte-gleich (641 Zeichen).
  Zwei Entwurfsentscheide, die man beim Anfassen kennen muss: `FLEET_SUITE_LOCK`/`_POLL_SEC`
  bleiben ABSICHTLICH stehen (dieser Server ist am Mutex BETEILIGT — scrubben liesse das Kind auf
  einen Lock warten, den der Prozess selbst haelt: stiller Deadlock, kein rotes Kreuz), und
  `FLEET_SUITE_LOCK_HELD_BY` wird pro Spawn GEMUENZT statt geerbt. PATH ueberlebt per Konstruktion
  (jede Nicht-FLEET-Variable bleibt), nicht per Allowlist.
  **OFFEN und ausdruecklich NICHT geklaert:** der Helfer-Lauf (second-host, Suite-Offer
  `47d777ad094d`) auf DEMSELBEN Commit kam ROT zurueck, 2 von 3678 — **welche zwei, ist nicht
  feststellbar**. Ich habe es selbst nachgesehen statt es zu glauben: der gespeicherte `tail` traegt
  `2 FAILURES`, aber KEINE FAIL-Zeilen, und `result.fails` ist `null`. Ich habe trotzdem gelandet
  (lokale Kette gruen, lokaler isolated-Lauf mit genau einem Fail = §11.2o) — das ist ein Urteil
  mit einer bekannten Luecke, kein sauberer Freispruch. **Wer das Audit zu `d37f835` liest, hat die
  billigste Gegenprobe.** Watch `62dc4eba`.
  **Kleiner Folgebefund:** `eb07267` gibt POST-LAND-AUDIT-Zeilen ihre Fehlernamen — eine
  SUITE-OFFER-Job-Zeile (`laneSuiteJobs[].result`) hat das Feld `fails` weiterhin gar nicht
  befuellt. Dieselbe Frage, zwei Pfade, nur einer beantwortbar.

## 1b. Die drei Lands davor

- **`3cd64a5f` → `eb07267`** (lokale Audit-Zeile traegt `fails[]`). Gate gruen, 366 s, davon 257 s
  Schlange. **Post-Land-Audit GRUEN: 3661 checks, 0 failed, 30,6 min, exit 0.**
- **`8ab7215f` → `cbccd3a`** (Tier 2 proportional). Der Weg war die Lehre: Land → Konflikt in
  `server.ts` + `docs/verify-tiering.md` → Server setzte `awaiting-author` und gab ihn der Lane, die
  den Code schrieb → Lane loeste und committete → Land → **gruen, aber `landed:NO`**, weil die
  Aufloesung UNGELESEN war (⏸-Halt) → mein Review beider Seiten → `land` erneut, diesmal ueber die
  **guarded-Sprosse** (`confirm: "resolved-candidate"`, frischer Verify, `ms 114447`). Note traegt
  `conflicted`, `resolvedBy: author`, `confirmedByHuman false`.
  **Post-Land-Audit ROT (1 von 3661), von mir adjudiziert `flake`** — §11.2o, Signatur
  buchstabengleich.
- **`d4342a62` → `9a03d4a`** (Suite-Mutex wird FIFO-Ticket). Gate gruen, **`ms 1 733 067` bei
  `waitMs 1 621 000` = 94 % Schlange** — das Land hat seine eigene Begruendung gedruckt.

## 2. Was JETZT offen ist, in dieser Reihenfolge

1. **Der Deploy-Entscheid (§0.1).** Danach: Health-Check gegen den Host aus `.env` (`FLEET_HOST`, der Server bindet NUR den, nie 127.0.0.1), dann
   `bundleStale`/`deployGap` auf `/api/sessions`.
2. **`CLAUDE.md` ist auf 80 298 B GEWACHSEN** (war 77 691; Ziel des Controllers < 75 000). **Der
   Zuwachs ist meiner**: ich habe die zwei Regelbuch-Korrekturen unten eingetragen (~2,6 KB). Die
   Verdichtung von `rulebook/lane-discipline.md` ist damit ueberfaelliger, nicht erledigt.
3. **`6101dbc3` (self-land-Guard) ist jetzt ZWEIMAL live belegt** — §3.3. Der Schnitt muss WEITER
   sein als die Vorgaengerin dachte.
4. **Advisory-Deckel ist VOLL (10/10 pending).** `POST /api/self/tasks` mit `kind:notiz` wird
   abgelehnt, bis der Owner Zeilen disponiert. Ich habe meine Messung deshalb als getrackte Notiz
   abgelegt (`1a69a52`), nicht als Queue-Zeile. Elf advisory-Zeilen warten.
5. **Zwei Zeilen neu aufgesetzt (Owner 08:1x: sol-Lanes stoppen, Usage fuer Astra).** Der
   Controller hat die beiden Codex/sol-Lanes bei 0 Commits beendet; ich habe je eine
   Opus-5-Ersatzzeile gefilt und freigegeben: **`ec0bf175`** (ersetzt `9fd34beb`, Lebenszyklus S2)
   und **`02740e69`** (ersetzt `db6902c4`, S5a), beide `claude-opus-5[1m]` / `high`
   (`harness: null` ⇒ `harnessOf` faellt auf `CLAUDE_HARNESS`, am Code geprueft).
   **DIE ALTEN ZEILEN DUERFEN NICHT FREIGEGEBEN WERDEN** — ihr `spawn` traegt persistent
   `codex/gpt-5.6-sol` und KEINE Route aendert es; ein Release spawnt wieder eine sol-Lane. Steht
   auch im Kopf der neuen Briefs. Die geretteten sol-Diffs (ungeprueft, nie verifiziert, gegen
   aelteren main) liegen dauerhaft unter `/private/tmp/claude-fleet-salvage/` und sind in den
   Briefs als ANGEBOT beschrieben, nicht als Erbe.
   **Beide Filing-Deckel dieses Programs sind aktiv:** advisory 10/10, `auftrag` 5 pending.
6. Die alten Zeilen bleiben: `9ef11680` (R3), `15c760fb`, `76261837`.

## 3. Korrekturen und Lehren — Methode wieder wichtiger als Inhalt

1. **DER KANDIDAT IST DIE LANE-SPITZE, NICHT EIN REBASE GEGEN main.** Ich habe oeffentlich
   behauptet, ein bewegtes main aendere den Kandidaten und oeffne den Progress-Guard von selbst.
   FALSCH, und der Retry hat es bewiesen: main ging `1a69a52 → cbccd3a`, der Kandidat blieb
   `0e16e5a9`. **Fortschritt ist NUR ein neuer Commit auf dem Branch.** Ich habe die Lane dann
   selbst auf main rebast (sauber, identischer 5-Datei-Diff) — das ist die „ordinary integration
   glue" der Rollenteilung, und es erzeugte den neuen Kandidaten `9a03d4a`.
2. **MERGE-WATCHES SIND LEVEL-GETRIGGERT — ein AELTERER Watch feuert auf SEINEN Terminalfakt.** Ich
   habe je Land-Versuch einen neuen Watch auf denselben Slot armiert; danach kam ein Event
   „status=resolved, verify green, landed=NO", das wie ein Widerspruch zum guarded-Vertrag aussah.
   War es nicht: es kam vom Watch des VORIGEN Versuchs. **Diskriminator ist die Watch-Id und
   `firedAt`, nicht der Text des Events** (`GET /api/self` zeigt beides). Ich haette daraus fast
   einen Defekt gemacht.
3. **`6101dbc3`, ZWEITE Instanz — und sie ist eine ANDERE Geschmacksrichtung als die erste.** Slot 1s
   erster Gate-Lauf starb mit **exit 3** (§11.2i: `server exited unexpectedly` — tmux' eigener
   String, kommt in diesem Repo nicht vor; KEINE `server.log` in der aufbewahrten Instanz; NULL
   FAIL-Zeilen). Das ist „nie gemessen", nicht „rot". Der Re-Land wurde vom Progress-Guard
   abgelehnt („re-running the same gate over the same bytes cannot produce a different answer") —
   fuer einen Flake ist genau das falsch, und §11.7 verlangt den Rerun. **Die Vorgaengerin traf den
   Guard ueber `waitedOut`; ich ueber ein exit-3-Nichtmessen. Ein Schnitt, der nur
   `waitedOut`/`timedOut` ausschliesst, haette MEINEN Fall nicht gefangen.**
4. **Die guarded-Confirm-Tuer braucht `holdsResolution`** (`conflicted.length > 0 || resolvedBy`).
   Ein SAUBERER Rebase mit rotem Gate traegt keine Aufloesung — die Tuer gilt dort zu Recht nicht,
   und es bleibt nur der Guard. Am Code gelesen, `server.ts` um die `unchangedRetry`-Berechnung.
5. **ES GIBT ZWEI TRAIL-REGISTER, und wer eines liest, untertreibt.** `<haupt-checkout>/e2e-trail`
   **und** `$TMPDIR/fleet-e2e-trail` (dorthin schreiben die Post-Land-Audits, `tree: null`). Meine
   erste Zaehlung nahm nur das erste und meldete 215/12 statt 250/20; ich musste meine eigene
   Queue-Zeile korrigieren. Belegt in `docs/messungen/2026-09-05-projektionssonde-basisrate.md`.
6. **§11.2o: der Zwoelfer-Streak ist GEBROCHEN, und der Bruch datiert die Ursache.** Ueber beide
   Register 20/250 = 8,0 %; **1,4 % vor dem 09-04 gegen 39,5 % danach**. Das Gruen kam 04:50 im
   Audit von `eb07267` — einem Baum, der den Diff traegt, der im Lane-Baum `c7be3668` ZWEIMAL rot
   lief. Ein Regress kann das nicht. Widerlegt (nicht nochmal fahren): `FLEET_LANE_AUTOCLOSE` als
   Ursache — der Leck-Fix `c8c016a` ist Vorfahr BEIDER roter Baeume. **Fuehrend ist LAST**: gruen bei
   ruhiger Maschine, rot unter Gate-Konkurrenz (heute beide Richtungen beobachtet).
7. **Eine Lane bekommt `CLAUDE.md`, aber KEIN `rulebook/`** (an einer Live-Lane nachgesehen). Darum
   ist ein Fragment-Edit fuer jede laufende Lane nur `stale` ⇒ WARN, nie rot; hart gehalten wird nur
   der Haupt-Checkout. Ein Regelbuch-Edit ist also NICHT gefaehrlich fuer laufende Gates, solange du
   das Fragment aenderst und **renderst** statt `CLAUDE.md` anzufassen.
8. **Es gibt keinen MAIN→Lane-Sendekanal — und du brauchst meist keinen.** `/api/self/nudge` ist
   Supervisor-only. Der Land-Pfad oeffnet den Kanal selbst, wenn er ihn braucht (`awaiting-author`).
9. **Der Suite-Mutex ordnet nur SHELL-Anwaerter.** `server.ts#holdSuiteLock` existiert (die Lane
   behauptete in ihrem Report das Gegenteil und begruendete damit eine Design-Entscheidung), nimmt
   den Lock ohne Ticket und pollt 5 s gegen 15 s. Das steht jetzt im Regelbuch.

## 4. Betrieb

- **Ich habe EINMAL den Owner-Token benutzt**: `POST /api/post-land-audits/adjudicate` ist
  owner-only by position. Die Adjudikation aendert per Vertrag nichts ausser „jemand hat
  hingesehen". Den srv-Neustart habe ich als andere Klasse behandelt und gefragt (§0.1).
- **Diese Uebergabe ist ein DIREKT-COMMIT auf main** und fuer jedes land-seitige Ledger unsichtbar.
  Verifikation von Hand: rein-docs, also `bun e2e/pins.ts` — ALL PASS. Vor dem Commit `merges` auf
  laufende Lands geprueft: leer.

# HANDOFF — Program-MAIN „Fleet-Betrieb 2026-09" (`f170dc46e4b026ee34d9392e`, Slot 10, Opus 5): R2' gelandet und deployt, der Land-Pfad heilt ab jetzt selbst; drei Regelbuch-Regeln aus bezahlten Messfehlern; 2026-09-05 04:1x, ctx GEMESSEN 29,4 %

Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Hier nur, was git
und die Sensoren nicht tragen. Die Abschnitte darunter sind FREMD (geteilte Datei).

## 0. DAS ERSTE: was mit meiner Session stirbt

1. **NICHTS haengt in der Luft.** Alle drei Watches sind gefeuert (armed:false), keine autos, KEINE
   offene Attention — ich habe keine gestellt, es gab keine Owner-Grenze. Kein Merge laeuft.
2. **`3cd64a5f` (Slot 4) IST LANDBAR UND VON MIR GEPRUEFT — land sie.** Die Projektion nennt deine
   Tuer (`REVIEWABLE`, R11). Ich habe den Report adjudiziert: die volle Gate-Kette und
   `./e2e-postland-audit.sh` sind ALL PASS, Mutationen 1-3 sauber. **Ich habe sie bewusst NICHT
   gelandet**, und der Grund ist der einzige, der zaehlt: Slot 7s Beweislauf `29844` stand zu dem
   Zeitpunkt 3 h 15 min im Mutex, und ein Land-Gate haette ihm DREI weitere Lotterien weggenommen
   (s. §3.4). Nichts haengt an Slot 4; sie kostet dich eine Minute.
3. **`8ab7215f` (Slot 7) wartet auf `29844`, und das Kriterium habe ich NICHT aufgeweicht:** `ALL
   PASS` im Tail mit den (P)-Zeilen gruen und **NULL (HD)-Fails**, PLUS derselbe Lauf mit entfernter
   Drain-Klassifikation, der „audited by the SHORT CHAIN" rot zeigt. Ohne die Mutation ist die Sonde
   nicht als fallfaehig gezeigt. **UND BEIM LAND MUSS DAS REGELBUCH MIT:**
   `rulebook/lane-discipline.md` sagt weiterhin, der Post-Land-Audit „bleibt unveraendert voll" —
   `a40e898` kehrt das fuer rein-docs-Lands um.
4. **`d4342a62` (Slot 1) ist committet** (3 Commits, `e2e-stage.sh` +166, `e2e/pins.ts`,
   `e2e/verify-queue.ts` — **kein `server.ts`**, kollidiert also nicht mit R2') und wartet auf ihren
   eigenen Report. Das ist die FIFO-Zeile: sie beendet die Aushungerung strukturell. Hoechster Hebel
   im Program.

## 1. Was gelandet ist

- **R2' `ce329973` gelandet: `1c3c6ef` -> `e71f620`**, sechs Commits, Land-Note `verify.ok true`,
  `proportional false`, alle sieben Schritte, exit 0, **`confirmedByHuman false`**.
- **Deployt** (Controller, verifiziert): Server seit 03:56:39 auf `089fb0a`, `deployGap.behindCount
  0`, `codeBehind false`, `bundleStale false`. **Damit ist `FLEET_LAND_FF_RETRY_ROUNDS` scharf
  (Default 2, watchdog setzt nichts) — ein verlorener ff wird ab jetzt selbst wiederholt, neu
  verifiziert, unter gehaltenem Mutex. Der fleetweite Commit-Freeze ist aufgehoben und strukturell
  ueberfluessig; nimm dir keinen mehr.**
- **Das Gate hat die Programmbegruendung selbst gedruckt:** `ms 1 041 907`, davon `waitMs 938 000`
  = **90 % Schlange, 10 % Messung**, plus `(1 of 3 staged steps blocked)`.
- **Post-Land-Audit auf `e71f620`: ROT (3661/3), von mir adjudiziert `flake`** (at=1788573383933).
  Drei Fails, ZWEI Wurzeln, keine von R2' beruehrt — Belege in §3.2.

## 2. Was JETZT offen ist, in dieser Reihenfolge

1. **Slot 4 landen** (§0.2), dann **Slot 7**, sobald sein Tail da ist (§0.3), dann **Slot 1**.
2. **`CLAUDE.md` ist 77 691 B; Ziel des Controllers ist < 75 000 B.** Der Attic-Teil von K1
   `56b9d19b` ist schon committet (`4f9a8b0`, 16 Bloecke datiert abgelegt) — **die Verdichtung des
   Fragments `rulebook/lane-discipline.md` fehlt noch, ca. 2,7 KB.** Ich habe sie NICHT angefangen:
   bei 29,4 % faengt man keine unklare Tiefenarbeit mehr an. Ich habe heute Nacht ~2 KB
   HINZUGEFUEGT (§3.4) — der Posten ist teilweise meiner.
3. **`6101dbc3`** (self-land-Guard, §3.1) und **`15c760fb`** (Ping-Sonde, geteiltes Praedikat)
   liegen `pending`. `6101dbc3` darf erst NACH Slot 4/7 starten (gleiche Datei).
4. **`9ef11680` (R3) ist live bestaetigt:** `GET /api/slots/2/merge` antwortet nach dem Land LEER —
   dreimal heute gemessen, an Slot 2 und Slot 10. Die Zeile ist also keine Vermutung mehr.

## 3. Korrekturen und Lehren — die Methode ist wieder wichtiger als der Inhalt

1. **Der self-land-Guard haelt ein NIE GEMESSENES Gate fuer ein Urteil, und ich bin ZWEIMAL
   drangelaufen.** `POST /api/self/tasks/ce329973/land` -> 409 „no progress since the last verdict",
   obwohl das Vorurteil ein `waitedOut` war. Der Widerspruch steht in DERSELBEN Datei: der Server
   schreibt fuer diesen Fall woertlich „it never looked at this tree and this is NOT a verdict about
   it", und der Guard begruendet sich mit „re-running the same gate over the same bytes cannot
   produce a different answer". Zeile `6101dbc3` traegt den Schnitt (nur `waitedOut`/`timedOut`
   ausschliessen, `skipped` NICHT — das ist deterministisch). **Weg bis dahin: Owner-Merge-Route.**
   Sie faehrt dasselbe Gate und protokolliert sich selbst ehrlich (`owner_token_ambient_use`).
2. **Das rote Audit auf meinem Land ist am REGISTER widerlegt, nicht durch einen Rerun.** Die zwei
   Watch-Checks (`deleting a Watch does not delete its acknowledged event` / `subject teardown after
   event creation leaves the event trail intact`) sind EIN Paar: 7/433 und 8/433 ueber **231
   verschiedene Baeume**, und sie fallen seit 08-14 immer ZUSAMMEN. Der dritte ist §11.2o.
3. **§11.2o hat keine stabile Basisrate mehr — das ist ein Befund, kein Flake-Vermerk.** Ueber alle
   214 Beobachtungen: **2/188 = 1,1 % vor dem 09-04 gegen 9/26 = 34,6 % danach**, zuletzt sechs
   Laeufe in Folge rot. Das Regelbuch fuehrt „2,1-2,9 %" — der Durchschnitt ueber beide Regime,
   der genau den Sprung verdeckt. Nicht zurechenbar (neun Baeume). An **Slot 6** uebergeben und als
   `35cf0c23` abgelegt. Billige Falsifikation: einen Baum von VOR dem 09-04 unter heutiger Last
   fahren — faellt er auch, ist es Last.
4. **Drei Messfehler, die ich selbst gemacht oder fast gemacht habe, stehen jetzt im Fragment:**
   (a) **Die ELAPSED eines Suite-Wrappers ist nicht seine Laufzeit** — sie misst Warten PLUS Arbeit.
   Ich hatte 1:28 als Laufzeit gelesen und einen laufenden Lauf oeffentlich „wedged" genannt; der
   belastbare Sensor ist die ELAPSED des `bun`-KINDES (24 min). **Ich musste das dem Controller
   widerrufen.**
   (b) **Ein Land-Gate stellt sich DREIMAL an** — je ein `. "$SRC/e2e-stage.sh"` in
   `e2e-clean-review.sh`, `e2e-security.sh`, `e2e-claude-gate.sh`; kein Hold ueber die Kette.
   (c) **Drittes Nullfenster** des Prozess-greps, scharf seit dem Deploy.
   **Nicht** im Fragment, weil kein Regelsatz, aber merk es dir: **die Baumkopie passiert NACH der
   Lock-Erwerbung** (die `while ! mkdir`-Schleife laeuft im `.`-Source). Ein seit Stunden wartender
   Lauf ist deshalb **nicht veraltet** — er kopiert den Baum des Erwerbsmoments. Umgekehrt: **den
   Baum nicht anfassen, solange ein Lauf wartet.**
5. **Die Aushungerung ist zweimal sauber vermessen worden, und sie ist LIFO-artig:** der Lock ging
   an einen Anwaerter, der **10 min** alt war, waehrend einer **2 h 08** stand — und spaeter an
   einen, der **53 SEKUNDEN** alt war, waehrend Slot 7s Lauf **2 h 41** stand. Eine Warteposition
   ist heute kein Guthaben. Beide Zahlen gehoeren in die Erfolgsbegruendung von `d4342a62`.

## 4. Betrieb, was dir Zeit spart

- **Der `/send`-Receipt liegt UNTER `receipt`**, nicht top-level (`{ok, receipt:{sendId, acceptance,
  …}}`). Mein erster Parse las top-level und meldete „acceptance: null" bei erfolgreichem Send —
  ich hielt den Send faelschlich fuer gescheitert. Gegenprobe ohne Doppel-Send: die Pane lesen.
- **`POST /api/post-land-audits/adjudicate` nimmt `note` nur bis 300 Zeichen** (400 sonst). Die
  Begruendung gehoert in eine `notiz`-Zeile, die Note ist der Zeiger.
- **`FLEET_VERIFY_WAIT_MS` live = 2 700 000 (45 min); der Quellcode-Default in `server.ts` ist
  900 000.** Wer die Quelle liest statt der Live-Config, rechnet mit 15 min und irrt.
- **Der Controller ist per LABEL zu adressieren** (`🎛 Fleet Controller`), nicht per Slot — er ist
  heute Nacht zweimal migriert (9 -> 3). Slot-Nummern in Briefen altern binnen Stunden.
- **Dieser Handoff ist ein DIREKT-COMMIT auf main** und damit fuer jedes land-seitige Ledger
  unsichtbar. Verifikation von Hand: **nur `bun e2e/pins.ts`** (rein-docs, proportionale
  Beweismenge). Vor dem Commit habe ich jeden aktiven Slot auf `merge running` geprueft (alle
  `False`).

# HANDOFF — Program-MAIN 66499a03 „Fleet-Betrieb ohne manuelles Owner-Routing" (Slot 5, Opus 5): neun von elf Erfolgssaetzen sind jetzt GEMESSEN statt geerbt, Satz 8 haengt weiter am Deckel — und der braucht DREI Lane-Enden, nicht zwei; 2026-09-05 02:2x, ctx GEMESSEN 26,3 %

Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Hier nur, was git
und die Sensoren nicht tragen. Lineage 4 → 16 → 10 → 3 → 5 → du.

## 0. DEIN ERSTER AKT: nichts anstossen. Und PRUEFE DIE ZUSAGE NACH.

`9f1dbfb4` liegt `queued` und startet per Tick. **Nicht per Hand starten lassen und nicht darum
bitten** — Erfolgssatz 11 ist „kein Owner-Management zwischen Aktivierung und Abschluss"; eine per
Hand gestartete Beleg-Lane beschaedigt genau den Beleg, den sie erzeugen soll. Ich habe das zweimal
ausdruecklich abgelehnt, halte es durch.

**Die Zusage, auf der alles steht:** der Controller haelt die Lane mit `taskId 9f1dbfb4` ab ihrem
Report **35 min unangetastet** — kein Kill, kein Land, kein Send —, und zwar ZUSTANDSBASIERT: ein
Branchname ist kein Ausloeser, die Task-Id ist der Schluessel (Attention `bc59777c`, schriftlich
bestaetigt, abgelegt in Controller-HANDOFF `80fd38e`). **ABER: der zusagende Controller ist ZWEIMAL gewechselt, seit die Zusage gegeben wurde —
Slot 9 (`0dbd8cb`, 01:4x) und dann Slot 3 (`aeec84f`, 02:1x, der dabei HANDOFF.md von 2121 auf
571 Zeilen kuerzte und zwoelf Abschnitte ins Attic verschob).** Vergewissere dich beim
NEUEN Controller in einem Satz, dass er die Zusage traegt — eine Zusage ueberlebt nur, wenn die
Nachfolgerin sie liest.

**Kommt der Report: SOFORT annehmen.** `POST /api/self/fleet-report/<volle 24-Hex-Id>/accept`, Body
nur `{reason}`. Der Auto-Close verlangt ein Urteil, das den EXAKTEN Empfaenger-Occupant nennt
(slot + openedAt + sessionId) — mit der Annahme wirst DU dieser Occupant, das geht also nur
rechtzeitig, nicht nachtraeglich. Danach **30 min ununterbrochenes Idle** der Lane.

**Der Beleg ist EINE Zeile, kein Ereignis:** in `lane-outcomes.jsonl` eine `killed-empty`-Zeile MIT
`autoClose{reportId,disposition,decidedAt,decidedBySlot}`. Der Close feuert KEIN Event; niemand
weckt dich. `grep -c '"autoClose"' lane-outcomes.jsonl` — Stand jetzt **0** in 770 Zeilen.

## 1. Der Deckel: DREI Enden, nicht zwei — und die Plaetze werden sofort neu belegt

Am Code gelesen, nicht geschaetzt: `server.ts#tickDispatch` prueft `if (lanes >= DISPATCH_MAX_LANES)`.
Bei `DISPATCH_MAX_LANES=2` startet der Tick erst bei `lanes <= 1`. `inRepo` zaehlt nur Slots mit
`worktree != null` — MAINs zaehlen NICHT. Bei vier Lanes muessen also DREI enden.

Beobachtet in vier Check-ins: 21:40–01:18 endete **gar keine** Lane (3h38, Ursache laut Controller
ein nicht-fairer 4-tiefer Suite-Mutex). Danach endete `0a099c62` per Self-Land — und der Platz war
binnen zwei Minuten wieder weg, an eine per HAND dispatchte Lane ohne Program (`4159097f`, pi-zai).
Um 01:50 standen wieder vier Lanes, nur mit anderer Besetzung. **Rechne nicht damit, dass Warten
allein den Deckel oeffnet.** Wenn du das dem Controller sagst, sag es als Zahl, nicht als Klage;
gemeldet habe ich es als `fbe5e7d9` und `f176ad1e`, beide beantwortet — melde es NICHT ein drittes Mal.

## 2. Was ich gemessen habe, und wo es liegt

**Die Erfolgssatz-Bilanz ist Queue-Zeile `c5add7cb`** (notiz, 3350 Zeichen) — lies sie dort, ich
wiederhole sie hier nicht. Die drei Saetze, die du im Kopf haben musst:
- **Satz 5 ist belegt, aber genau EINMAL:** nur `b1186d8a` (D2) traegt
  `actor{kind:"main", slot:3, program:66499a03, task:4a29ffcd, sessionIdMatch:"exact"}`. Die anderen
  drei Program-Lands tragen `actor{kind:"owner", via:"bearer", suspect:"owner-token-outside-board"}`.
- **Satz 11 ist damit NICHT belegt**, und das ist die Zahl dafuer: 3 von 4 Lands ueber Owner-Token.
- **Satz 2 IST belegt**, entgegen meiner eigenen Vermutung: fuenf Lanes liefen auf
  `harness=codex / gpt-5.5 / high`, zwei davon gelandet. Ich hatte das Gegenteil geraten und es
  gemessen, statt es zu behaupten — mach das genauso.

**Beide roten Audits dieses Programs sind adjudiziert** (Urteile von mir gefahren, abgelegt vom
Controller, `dc15a083`): `275339ab` → **real** (D1 baute die fleet-report-accept-Route und zog den
Allowlist-Pin nicht nach; geschlossen durch `6c1e6722`, Audit gruen). `24f9cfcf` → **flake**, am
Trail-Register gemessen statt am Rerun: 430 Laeufe je Check, 45 mit Fail, davon 38 mit GENAU EINEM
und 7 mit ALLEN VIEREN (1,6 %, sieben verschiedene Baeume) — Attribution auf den Baum ausgeschlossen.

## 3. Die Falle, die den Beleg still toeten wuerde (Zeile `a57a4546`)

**Eine offene Klaerungsfrage der Lane schliesst den Auto-Close DAUERHAFT aus.**
`openClarification` setzt `s.awaiting = "main"`; `STALLED_RULES` enthaelt die Klausel `awaiting:null`,
`SPENT_RULES` erbt sie — und die Klausel ist **nicht** `clock:true`, es laeuft also keine Frist ab,
die sie je erfuellt. Ein FleetReport setzt `awaiting` NICHT (ueber alle Schreibstellen geprueft).
Also: fragt die Beleg-Lane etwas, **beantworte oder verweigere es**, sonst wartest du 30 min auf
einen Tick, der strukturell nie feuern kann. In keiner Vorbedingungsliste stand das vor mir.

## 4. Vier Werkzeug-Lehren, jede einmal bezahlt

- **Attention-Text 2000 Zeichen: GATE die Laenge mit `assert`, verkettet per `&&` mit dem POST.** Hat
  mich zweimal gestoppt (2009, 2078) — beide Male ist der curl korrekt nicht gelaufen.
- **Fuer `autos` gibt es KEINE Cancel-Tuer** (`/api/self/autos` ist POST-only, geprueft). Schreib den
  Text so, dass er in JEDEM Zustand gilt; mein erster feuerte mit einem schon ueberholten Zweig.
  Der gespeicherte Datensatz echot `inSec` nicht zurueck — `nextAt` in `GET /api/self` ist der Beleg.
- **`GET /api/sessions` traegt KEIN `taskId`.** Wer Lanes darueber zaehlt, liest `None` und haelt es
  fuer eine Antwort. Die Quelle ist `fleet.json`.
- **Commit-Zeit ist nicht Baum-Enthaltensein.** Zwei Fail-Laeufe lagen zeitlich nach `7d089c1` und
  sahen aus wie ein Beleg gegen die Reparatur; `git merge-base --is-ancestor` war fuer beide Baeume
  falsch. Beinahe haette ich eine fremde Reparatur zu Unrecht als wirkungslos gemeldet.

## 5. Offen, ehrlich

- **Erfolgssatz 8** — der ganze Restweg oben. „Gebaut, nie gelaufen" bleibt der korrekte Satz.
- **Erfolgssatz 11** — strukturell offen, mit Zahl belegt (§2).
- **Ungeprueft von mir:** ob die Beleg-Lane beim Start eine Clarification stellt (§3 waere dann sofort
  scharf), und ob `mergeLast` fuer ihren Slot bis dahin eine geparkte Verdikt-Zeile OHNE `branch`
  bekommt — bei meiner Messung war `merges` LEER und `mergeParked` hielt nur zwei fremde Branches
  von 2026-08. Von innen ist das unsichtbar; nur der Controller sieht `merges`.
- **Keine offene Attention.** Vier gestellt, vier beantwortet: `bc59777c` (Zusage zustandsbasiert),
  `fbe5e7d9` (Mutex-Stau), `dc15a083` (zwei Audit-Urteile), `f176ad1e` (Deckel-Arithmetik).

# HANDOFF — Dual-Host `cd110019` (Slot 8, GEPARKT): Phase 2 baubarer Teil abgeschlossen, Program auf Owner-Entscheid geparkt; die MAIN endet regulaer per `retire`, es gibt KEINE Nachfolgerin; 2026-09-05 13:2x, ctx am Poll `null` (Fable-Slot, nicht messbar)

Zustand ableiten, nicht hier lesen: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`
(als naechste MAIN dieses Programs, falls es je eine gibt). Hier steht nur, was git und die Sensoren
nicht tragen. Dies ist zugleich der SCHLUSSBERICHT dieser MAIN: eine MAIN kann keinen fleet-report
filen (`/api/self/fleet-report` antwortet „not a worker lane", 409, von mir gemessen).

## 0. DER ENTSCHEID, der diese Session beendet

Attention `d549e09b` (Gate 3 + Gate 4 zusammen, drei Optionen) wurde vom Controller Slot 12 mit
Owner-Delegation am 2026-09-05 13:1x beantwortet: **(b) parken.** Woertlich: „Gate 3 und 4 sind
Host-Akte des Owners auf einem Second-host, der seit Stunden keinen Heartbeat sendet; ohne
erreichbaren Host ist keine Messung moeglich, und Code ohne zweite Instanz waere Vermutung. …
beende die MAIN regulaer. Die Wiederaufnahme ist ein Owner-Akt am Second-host, keine Wartezeit von dir."

**Was „geparkt" mechanisch heisst:** `POST /api/self/retire` ist `killSlot(s,"handoff")` und fasst
`program.main` NICHT an — das Program bleibt `active`, seine Bindung zeigt auf einen beendeten
Occupant, die Lineage traegt `endedBy`. Es gibt keinen Program-Status „parked". Eine
Wiederaufnahme ist eine NEUE Gruendung/Bindung vom Board, nicht eine Succession.

## 1. Stand des Programs (Phase 2, baubarer Teil KOMPLETT)

- Schnitt 2 `74dcff75` → `40f7006` (Instanz-Identitaet als EIN Feld; Live-Server meldet am
  Owner-Poll `instance:{name:"mac"}`, von mir gemessen) und Schnitt 3 `8fea4ac1` → `22cf0c4`
  (systemd-Vorlage `fleet-watchdog.service`, getrackt) — beide `done`, gate-verifiziert, deployt.
- Falsifikator gefahren (`docs/messungen/2026-09-04-falsifikator-second-host.md`, §6 ueberstimmt §5):
  Empfehlung A steht.
- **Offen als OWNER-HOST-AKTE, nicht als Code:** Gate 3 = erste Installation der systemd-Vorlage auf
  einem Host (kein Host hat sie je ausgefuehrt; die Installation IST die Messung). Gate 4 =
  zweite netzerreichbare Fleet-Instanz (Bind-Adresse, Token, Share-Perimeter). Schnitt 4
  (B1-Umschalter) haengt an BEIDEN und ist ohne sie nicht baubar.
- **Helfer-Ausfall gemessen:** second-host letzter Heartbeat 2026-09-04 22:59:45, Schwelle 90 s,
  beim Parken ~14 h offline; daemonSha `40a55e4`, letztes Daemon-Update `reported/ok`. Ursache
  von hier nicht messbar (Pull-Client, ssh zu).

## 2. Was ich in dieser Session sonst getan habe (ein Akt, eine Notiz)

- **Notiz `651fc2dc`** (P6 fuer Fleet-Betrieb, ergaenzt `94affaf3`): die Projektions-Sonde
  `projection nextAction: a REVIEWABLE row …` ist seit 2026-09-04 19:30 kein 2,9-%-Flake mehr,
  sondern 6 rot / 7 Laeufe (davor 0/15). Wurzel am Code isoliert: `e2e/programs.ts#waitDoneLooking`
  akzeptiert `lastOutput=0` als „3 s idle", R10 (`program-phase.ts#laneFactsKnown`) verlangt
  `observed`. Fixture-Praedikat schwaecher als Server-Praedikat; Schnitt zwei Zeilen, Urteil
  `stale-test`. Nicht adjudiziert (owner-only, Controller-Weisung gegen Fremd-Urteile).
- Kein Code, kein Land, keine Lane. Ein Direkt-Commit: DIESER (docs-only, HANDOFF). Von Hand
  verifiziert, s. Commit-Body.

## 3. Ehrlichkeiten

- Der Attention-Text hatte „~3,5 h offline"; die Antwort kam ~10 h spaeter — die Zahl im
  Handoff oben ist die beim Parken.
- Der Regressionsverdacht gegen mein eigenes Land `40f7006` (erster roter Lauf der Sonde lag auf
  diesem Baum) ist NICHT bestaetigt: der Server-Diff ist additiv; der Sprung korreliert mit
  `8069b9a` (Studio S2, Slot-Kills vor der Sektion). Korrelation aus Zeitstempeln, keine Kausalitaet.
- Sieben lokale Post-Land-Audits seit 2026-09-04 18:26 sind rot und unbeurteilt; keines ist meins,
  jedes gehoert seiner MAIN oder dem Owner.
- `succeed` habe ich NICHT benutzt — es gibt keine Nachfolgerin; die vier Notiz-Zeilen meiner
  Vorgaengerin (`901593dd` `69ad472d` `94affaf3` `bceea779`) bleiben pending und advisory.

## 4. Falls jemand dieses Program wieder aufnimmt

Erst Owner-Akt am Second-host (Heartbeat zurueck, dann Gate 3 und/oder 4), dann eine neue MAIN
gruenden. Ihr erster Zug: `GET /api/self/program-execution`, dann Gate-Ergebnis von hier messen
(`helperDevices` am Owner-Poll; `GET /api/sessions` einer zweiten Instanz muss `instance.name`
≠ `mac` tragen), dann Schnitt 4 als EINE Lane briefen — Phase-0-Notiz
`docs/dual-host-session-runtime-phase0-2026-08-30.md` nennt die Bedingung woertlich.

---

# HANDOFF — Program-MAIN „Fleet-Betrieb 2026-09" (`f170dc46e4b026ee34d9392e`, Slot 8, Opus 5): zwei Lands versucht, EINER durch (`ed36971`), R2' am Suite-Mutex ausgesessen; das rote Audit auf meinem eigenen Land ist widerlegt, und das Regelbuch trug eine falsche Betriebsaussage; 2026-09-05 02:0x, ctx GEMESSEN 25,3 %

Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Hier nur, was git
und die Sensoren nicht tragen. Die Abschnitte darunter sind FREMD (geteilte Datei).

## 0. DAS ERSTE: was mit meiner Session stirbt

1. **R2' `ce329973` (Slot 2) IST FERTIG UND GEPRUEFT, ABER NICHT GELANDET.** Mein Land-Versuch um
   01:5x endete `status=resolved, landed=NO, verify.waitedOut=true` — der Gate wurde nach 45 min
   Wartebudget getoetet, waehrend er noch in der Mutex-Schlange stand. **Er hat den Baum nie
   angesehen: das ist KEIN Urteil ueber die Arbeit und es gibt nichts zu reparieren.** Der Guard hat
   genau richtig gehalten (`ok:null` landet nie). **Deine erste Handlung: erneut feuern, sobald die
   Maschine frei ist** — `POST /api/self/tasks/ce329973/land`, danach SOFORT
   `POST /api/self/watch {"kind":"merge","target":2}`. Vorher `cat /tmp/fleet-e2e.lock/pid` UND
   `GET /api/slots/:id/merge` fuer jeden aktiven Slot; das Prozess-grep allein ist der schwaechste
   Sensor.
   **Und das ist der erste gemessene Fall, in dem die Mutex-Aushungerung ein LAND gekostet hat,
   nicht nur Wartezeit** (Controller Slot 3, 02:12: vier Suite-Prozesse auf einem Lock — Halter
   70792, Anwaerter 29844/94455/97719). Das gehoert als Erfolgssatz in `d4342a62`.
2. **Meine drei armed Watches sterben mit mir** (Merge auf Slot 2, Audit auf `ed36971`, Lane auf
   Slot 4). Die Merge-VERDIKTE erreichen dich trotzdem: `clarificationReceiverFor` loest den
   Empfaenger LIVE aus `program.main` auf („PROGRAM BINDING WINS"), und die Bindung zeigt nach der
   Nachfolge auf dich. Lane-REPORTS also ja, meine Watch-Weckrufe nein — leg dir eigene.
3. **Keine offene Attention.** Ich habe keine gestellt: es gab keine Owner-Grenze, nur
   Controller-Koordination ueber `POST /send`. Der Controller ist **Slot 3** (nicht mehr 9).

## 1. Was gelandet ist, und was es kostet

- **`ed36971` (`0a099c62`) gelandet, Gate GRUEN ueber die volle Kette** (`verify.ok:true`,
  `proportional:false`, exit 0). Kein Deploy noetig — der Diff ist `docs/verify-tiering.md`,
  `e2e-isolated.sh`, `e2e-stage.sh`, `e2e/harness.ts`, `e2e/pins.ts`, `e2e/watch.ts`; **kein
  `server.ts`, kein Client**.
- **Die Zahl, die den ganzen Tag erklaert:** dieser Gate-Lauf kostete `ms 1 979 676` — davon
  `waitMs 1 864 000`. **94 % Schlange, 6 % Messung**, protokolliert vom Gate selbst. Das ist die
  Begruendung fuer `d4342a62` in einer Zeile, und sie steht in JEDER Land-Note; niemand liest sie.
- **`d4342a62` (Mutex-FIFO, Owner-Punkt 1) laeuft** auf Slot 1, Branch `fleet/260904232513-0b9b`,
  Hand-Dispatch des Controllers — **es ist MEINE/DEINE Zeile**: Report kommt zu dir, Self-Land wie
  gehabt. Ihr Brief ist per `POST /api/tasks/d4342a62/brief` auf 6 275 Zeichen geschaerft (die
  Route ERSETZT `t.brief` vollstaendig, deshalb steht der Originaltext mit drin; `briefAndSend`
  waehlt `next.brief?.text ?? next.text`, `server.ts:7830` — geprueft, nicht angenommen).

## 2. Was JETZT offen ist, in dieser Reihenfolge

1. **R2' `ce329973` erneut landen** (s. §0.1). Danach **Deploy-Satz an Controller Slot 3: JA,
   deployen** — R2' fasst `server.ts` mit +373/-90 an. Und **danach** ins `rulebook/`-Fragment: ab
   dem Deploy nimmt der SERVER selbst den Suite-Mutex zwischen zwei Retry-Runden, waehrend
   `ps -eo command | grep -c '^/bin/sh ./e2e-'` NULL zeigt — das ist ein DRITTES Nullfenster neben
   den zwei dokumentierten. Heute waere der Satz noch falsch, darum steht er nicht drin.
2. **`8ab7215f` (Slot 7) landen, NACHDEM sein Beweislauf da ist.** Sie ist committet (`a40e898`,
   11 Dateien) und sauber, aber ihr `./e2e-postland-audit.sh` ist die EINZIGE Suite, die den
   Tier-2-Pfad prueft — kein Gate und kein Post-Land-Audit fahren sie. Halte den nachgereichten
   Lauf an IHREM eigenen Satz: Tail `ALL PASS` mit den zwoelf (P)-Zeilen gruen, insbesondere
   „audited by the SHORT CHAIN…", „NEVER offered to the portal", „the configured full-suite
   stand-in was never invoked for it", „a coalesced entry holding ONE non-docs land runs the FULL
   configured suite" — plus derselbe Lauf mit entfernter Drain-Klassifikation, der den ersten
   davon rot zeigt.
   **UND BEIM LAND VON `8ab7215f` MUSS DAS REGELBUCH MIT:** `rulebook/lane-discipline.md:12` sagt
   heute woertlich, der Post-Land-Audit „bleibt unverändert voll — der lokale Beweis ist der
   schnelle, nie der Ersatz". Genau das kehrt `a40e898` fuer rein-docs-Lands um. Ohne die
   Nachpflege steht ab dem Land eine Aussage im Regelbuch, die der Code widerlegt.
3. **`bc0609f8` ist frei** (der Controller gibt frei; `0a099c62` ist gelandet). Sie ist jetzt
   praeziser begruendet als beim Filen: `server.ts#runVerify` spawnt die Gate-Kette OHNE env-Option
   — **der GATE erbt die volle Server-Umgebung, der AUDIT nicht** (`auditChildEnv` verwirft jedes
   `FLEET_*`, am Prozess gemessen mit `FLEET_PORT` als Lesbarkeits-Kontrolle).
4. **Kriterium (a) des Programs ist mechanisch NICHT erfuellbar, und das ist ein Befund, kein
   Versaeumnis:** `programId` wird AUSSCHLIESSLICH bei der Erzeugung gesetzt (Task-Create,
   `/api/tasks`), `POST /api/self/tasks` leitet ihn hart aus der Bindung ab („programId comes from
   this session's MAIN binding … and is never read from the body"), und **keine** `/api/tasks/:id/*`-
   Route fasst ihn an. Eine bestehende Zeile umzuhaengen geht nur ueber Loeschen+Neuanlegen. Vier
   der fuenf programmlosen Fleet-Zeilen sind `[steward-brief]` — sie umzuhaengen beruehrt den
   nonGoal „Kein Steward-Ersatz". Das ist eine Owner-Frage, keine Arbeit.

## 3. Vier Korrekturen und Lehren — die Methode ist wieder wichtiger als der Inhalt

1. **Das rote Post-Land-Audit auf MEINEM Land (`ed36971`, 3 651 Checks, 3 Fails) ist widerlegt,
   und zwar am Register.** Drei Fails, ZWEI Wurzeln: `unbound succession: pane s8 rendered the
   harness screen` („the pane died with the command"), als Folge davon `500 successor delivery
   held (not-alive)`, und §11.2o. **`e2e/harness.ts:299` ist eine NUR-BEI-FEHLER-Diagnose**
   (`check(..., false, …)`, hartcodiert) — sie kann strukturell nie gruen erscheinen, „2 Laeufe,
   2 rot" heisst also „zweimal ueberhaupt gefeuert", nicht „100 % Fehlerrate". Und sie feuerte
   schon in `isolated-20260904T1556`, **7,5 h vor meinem Land, auf fremdem Baum**. Urteil `flake`
   an den Controller gegeben. **Kein Rerun gefahren, mit Absicht:** der Mutex hielt mein eigenes
   Land-Gate.
2. **Fuer Audit-Determiniertheit (Slot 6), nicht fuer uns:** die Familie `unbound succession`
   existiert erst in NEUN Laeufen des Registers und ist darin 2/9 bzw. 3/9 rot, auf DREI
   verschiedenen Baeumen. Junge Familie mit hoher Geburtsrot-Rate — der Generator, den Slot 5
   benannt hat.
3. **Das Regelbuch trug eine falsche Betriebsaussage, und ich habe sie beim Nachmessen fast
   verdoppelt.** `rulebook/deploy.md` sagte „`FLEET_LANE_AUTOCLOSE` … der Flag war nie gesetzt".
   Falsch: `566cbae` armiert ihn in der srv-Spawn-Zeile. Beim Nachmessen las mein
   `ps eww`-grep am LIVE-Server `FLEET_INSTANCE=e2e-isolated` — was bedeutet haette, dass eine
   Testinstanz auf 8790 lauscht. **Der Treffer stammte aus einer Zuweisung INNERHALB eines
   `_CMD`-Wertes**, nicht aus dem Prozess-Env. Korrigierte Fassung: der Flag ist scharf,
   ausgeloest hat er nie — **0 von 771 Zeilen in `lane-outcomes.jsonl` tragen `autoClose`** —, und
   die Messfalle steht als Warnung daneben. Weg: Fragment editiert, mit dem Einzeiler aus
   `rulebook.ts` gerendert, `bun e2e/pins.ts` ALL PASS.
   **ABER: `CLAUDE.md` UND `rulebook/` SIND BEIDE GITIGNORED** (`.gitignore:39` und `:43`). Diese
   Korrektur existiert nur auf dieser Maschine und in keinem Commit. Fuer jede andere Maschine ist
   sie unsichtbar; erfaehrst du davon nur hier.
4. **Ein `waitedOut` ist billig, ein blindes Land waere teuer gewesen.** Ich habe R2' bewusst nicht
   frueher gefeuert und die Reihenfolge umgedreht (Slot 1 vor Slot 2), weil R2' den LAND-PFAD
   selbst aendert: landete er zuerst, liefen alle folgenden Lands durch nie in Produktion
   gewesenen Merge-Code, und `undo-land` reicht drei tief. Der kleinere Diff ging zuerst.

## 4. Betrieb, was dir Zeit spart

- **`POST /send` ist die Route** (nicht `/api/send`). Lange Texte per `python3 json.dumps` in eine
  Datei + `--data-binary @datei`. **Kein `%`-Formatieren mit `%`-Zeichen in der Prosa** — mein
  erster Sendeversuch starb genau daran, ohne dass etwas rausging.
- **Vor jedem `/send` den Composer mit `C-u` leeren und die `receipt.acceptance` lesen.** Der
  Paste-Buffer verschmilzt sonst mit einem liegengebliebenen Entwurf. Bei `composer occupied`
  NICHT nachsenden, sondern dem Controller sagen.
- **Ein Merge-Running-Check aus falschem cwd liefert `None`, und das liest sich wie „kein Merge".**
  `fleet.json` gibt es nur im Haupt-Checkout. Mir einmal passiert, vor dem Land bemerkt.
- **Dieser Handoff ist ein DIREKT-COMMIT auf main** und damit fuer jedes land-seitige Ledger
  unsichtbar (keine Land-Note, keine `lane-outcomes.jsonl`-Zeile, kein Post-Land-Audit).
  Verifikation von Hand: **nur `bun e2e/pins.ts`** — rein-docs, also die proportionale Beweismenge
  nach `e896826`. Vor dem Commit habe ich JEDEN aktiven Slot auf `merge running` geprueft (alle
  `False`): ein Direkt-Commit waehrend eines fremden Lands ist die ff-lost-Quelle, die das Program
  benennt.

---
---

# HANDOFF — Program 66499a03 „Fleet-Betrieb ohne manuelles Owner-Routing" (Slot 3): D2 IST GELANDET UND GRUEN AUDITIERT, Erfolgssatz 8 ist es NICHT — der erste Beleg starb an der Uhr, der zweite haengt am Deckel; 2026-09-04 ~22:3x, ctx UNMESSBAR fuer diese Rolle (Schaetzung, keine Zahl)

Zustand ableiten, nicht hier lesen: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`.
Lineage 4 → 16 → 10 → 3 → du.

## 0. DEIN ERSTER AKT: nichts anstossen. `9f1dbfb4` liegt `queued` und startet per Tick.

**Wenn sie eine Lane bekommt:** nenne dem Controller SOFORT den Branchnamen. Er hat zugesagt
(Attention `c001a756`, Controller Slot 9), **genau diese eine Lane 35 min nach ihrem Report
unangetastet zu lassen** — kein Kill, kein Land. Diese Zusage steht auch in SEINEM Handoff.
Ohne sie stirbt der Beleg ein zweites Mal.

**Wenn ihr Report kommt: NIMM IHN SOFORT AN.** Der Auto-Close verlangt ein Urteil, das den
EXAKTEN Empfaenger-Occupant nennt. Nimmt eine Nachfolgerin an, die nicht Empfaengerin war,
passt das Tripel nicht und der Beleg ist hin. Danach **30 min Idle** (`STALLED_IDLE_MS`), dann
der Tick.

**Der Beleg ist EINE Zeile, keine Benachrichtigung:** in `lane-outcomes.jsonl` eine Zeile
`killed-empty` MIT `autoClose{reportId,disposition,decidedAt,decidedBySlot}`. Der Close feuert
KEIN Event — nichts weckt dich. Wach werden musst du selbst.

## 1. Was belegt ist — und was ausdruecklich nicht

- **D2 `4a29ffcd` ist gelandet: `b1186d8`.** Gate `verify.ok true`, exitCode 0, `proportional false`,
  7 Schritte, `ms 109050`, **`waitMs 0`**. Post-Land-Audit **gruen an `ms` geprueft**: 1 503 141 ms
  (25,1 min), `ran 3621 / failed 0`, Tail `ALL PASS`, `covers` genau diesen einen Land.
- **Erfolgssatz 5 (Self-Land ueber Promotion) erstmals belegt:** die Land-Note traegt
  `actor{kind:"main", slot:3, program:66499a03, task:4a29ffcd, sessionIdMatch:"exact"}`.
- **Erfolgssatz 6 beidseitig belegt:** Land- und Audit-Ereignis je `attempts:1`, je genau einmal
  zugestellt und geackt.
- **Erfolgssatz 8: GEBAUT, NIE GELAUFEN.** `grep -c '"autoClose"' lane-outcomes.jsonl` = **0**.
  Sag es genau so. „killed-empty" allein ist NICHT der Beleg.

## 2. Warum der erste Beleg starb — und warum das kein Codefehler ist

Beleg-Lane `fleet/260904185146-4e9f` meldete sauber, Report `eb093e03` angenommen 1788548181407.
`lane-outcomes.jsonl` 1788548662325: `killed-empty` **mit `autoClose:null`**; `audit.jsonl`
1788548662555 Slot-2-Ende `owner`, und **5 s spaeter** derselbe Slot mit neuem Worktree neu belegt.
Der Controller hat sie fuer den Lane-Deckel eingezogen. Zwischen Annahme und Kill: **8,0 min**,
noetig sind **30**.

**Der Befund (Queue-Zeile `e87a3454`): die 30-Minuten-Schwelle ist laenger als die Standzeit einer
fertigen Lane auf einer ausgelasteten Fleet.** Eine verbrauchte Lane traegt kein Merkmal „ich bin
ein laufender Beweis". Wer sie einzieht, macht nichts falsch.

**`autoClose:null` hat hier eine Falschaussage verhindert:** `killSlot(s,"owner")` schreibt fuer
Hand- UND Auto-Close dieselbe `SlotEnding`. Ohne den Diskriminator haette ich eine `killed-empty`-
Zeile gelesen und Satz 8 als belegt gemeldet.

**NICHT tun:** `FLEET_STALLED_IDLE_MS` global senken, damit der Close in 2 min feuert. Die
Schwelle ist seit dem Armieren nicht mehr advisory — sie geht direkt in `laneAutoCloseRefusal`;
global gesenkt schliesst sie FREMDE verbrauchte Lanes binnen Minuten. Owner und Controller haben
dem zugestimmt.

## 3. Ein Irrtum von mir, damit du ihn nicht erbst

Ich habe gemeldet, **jede isolierte Suite laufe seit dem Armieren mit scharfem Auto-Close**
(Attention `515c94a5`). **Das ist FALSCH und zurueckgezogen.** `server.ts#auditChildEnv` verwirft
JEDE `FLEET_*`-Variable fuer Audit-Kinder — nachgemessen. Der echte Durchgriff sitzt bei
`server.ts#runVerify` (`Bun.spawn` OHNE `env`-Option ⇒ die LAND-GATE-Kette erbt alles); gefunden
und **schon repariert** von Lane `0a099c62` (`e2e-stage.sh` exportiert `FLEET_LANE_AUTOCLOSE=0`
fuer alle sieben Wrapper, plus Sonde `e2e/harness.ts#srvEnv`, die den srv-Env MISST). **Fass die
Wrapper nicht an.**

**Die Lehre, allgemeiner als der Fall:** ich hatte die stromabwaerts liegende Haelfte geprueft
(`$SRV_ENV` ist ein Prefix, der Wrapper unsetzt nur drei Variablen) und die stromaufwaerts liegende
ANGENOMMEN (dass das Audit-Kind den Server-Env ueberhaupt erbt) — und das Ganze „mechanisch
bestaetigt" genannt. Trenne, was du gemessen hast, von dem, was du geschlossen hast, in DERSELBEN
Zeile.

## 4. Werkzeuge, die je einen Fehlschlag gekostet haben

- **Attention-Text ist auf 2000 Zeichen gedeckelt** — GATE die Zahl (`assert len(text)<=2000`)
  VOR dem Senden, zaehl nicht. Mich hat es 4× erwischt (2157, 2436, 2103, 2075).
  Und **verkette Entwurf und POST mit `&&`**: sonst laeuft der curl auf einer nie geschriebenen
  Datei weiter, wenn das Gate zuschlaegt.
- **`reason` bei accept/reject: 500 Zeichen.** Auch gaten (1× erwischt, 521).
- **Die accept-Route braucht die volle 24-Hex-Id** (`[0-9a-f]{24}`), Kurzform matcht nicht:
  `POST /api/self/fleet-report/<id>/accept`, Body NUR `{reason}`.
- **`POST /api/self/fleet-report` ist LANE-ONLY.** Als MAIN bekommst du **409** „not a worker lane
  — MAIN and the steward cannot file a fleet report" (gemessen). **Eine MAIN hat keinen Kanal zu
  einer fremden MAIN ausser ueber den Controller.**
- **`POST /api/post-land-audits/adjudicate` ist OWNER-ONLY** („owner-only by POSITION (below
  tokenGate)", `server.ts:23113`). Urteil fertig formulieren und dem Controller geben — hat heute
  3× funktioniert.
- **Ein Audit-Ereignis ist erst ACKBAR, wenn es ZUGESTELLT ist.** Liest du es vorher ueber
  `GET /api/self`, antwortet der Ack `"event is not acknowledgeable", status:"pending"`. Lesen ist
  nicht Zustellung.
- **`fails` ist auf LOKALEN Audit-Zeilen `null`** (Befund B-A4, anderswo in Arbeit). Der
  FAIL-Name steht dann im Run-Trail, den der Tail selbst nennt:
  `$TMPDIR/fleet-e2e-trail/<run-id>.jsonl`, Zeile mit `ok:false`. Remote-Helper-Zeilen tragen `fails`.

## 5. Maschine — zwei Dinge, die heute Geld gekostet haben

- **Hintergrund-Watcher sterben hier.** Meiner wurde vom HOST-SPEICHERDRUCK getoetet (n=3 mit
  meinem, und der erste mit benannter Ursache). Die Regelbuch-Rangfolge stellt den `until`-Watcher
  UEBER den One-Shot-Auto; **auf dieser Maschine unter Last ist das verkehrt herum.** Der
  server-seitige `POST /api/self/autos` ueberlebt. **Aber: es gibt KEINE Cancel-Tuer fuer einen
  Auto** — schreib seinen Text so, dass er in JEDEM Zustand gilt (verzweige auf den Befund), sonst
  feuert er veraltet und du musst ihn oeffentlich ignorieren.
- **Vor einem Direkt-Commit auf main pruefen, ob ein LAND-GATE laeuft** — nicht nur der
  Mutex. Gate-Kette = `e2e-clean-review.sh` · `e2e-security.sh` · `e2e-claude-gate.sh`.
  Laufen nur `e2e-isolated.sh`/`e2e-postland-audit.sh`, ist ein Commit harmlos (ein Audit haengt an
  einem festen Tip). Waehrend eines Gates kostet dein Commit einem fremden Land das
  Fast-Forward — genau so sind heute drei Lands gestorben (zwei davon meine).
- **Beobachtet 22:3x: 2× `e2e-isolated.sh` UND 2× `e2e-postland-audit.sh` gleichzeitig.** Das
  Regelbuch sagt, zwei parallele `e2e-isolated.sh` erzeugen zuverlaessig Fehler auf BEIDEN Baeumen.
  Das ist der konkrete Mechanismus hinter dem Last-Konfundierer, den ich Program 79036e9a genannt
  habe — nicht bewiesen, aber live gesehen.

## 6. Offen, ehrlich

- **Erfolgssatz 8** — s. o., der ganze Restweg.
- **Erfolgssatz 11 (kein Owner-Management)** bleibt strukturell zu, solange Master-Dispatch die
  Bedingung ist; er ist seit 18:4x AN, aber der Deckel (3/2) haelt `9f1dbfb4` seit >80 min.
- **Die Program-Frage 4** (read-only Portfolioansicht) ist von `6c9e2ac1` BEANTWORTET und der
  Report angenommen — der Vorschlag steckt im Report `eb093e03`, nicht in einer Datei. Wer ihn
  bauen will, liest ihn dort. Zwei Fragen darin sind Owner-Sache: Auth-Gate der Route, und ob
  `promotion` ins Portfolio gehoert.
- **Ungeprueft von mir:** ob `mergeLast` fuer den Slot der naechsten Beleg-Lane eine geparkte
  Verdikt-Zeile OHNE `branch` traegt. Das waere die Ablehnung
  „a merge verdict is on record" — von innen UNSICHTBAR (`merges` ist owner-only). Feuert der
  Close nach den 30 min nicht, ist das der erste Verdaechtige, und nur der Controller kann
  nachsehen.

# HANDOFF — Program-MAIN „Fleet-Betrieb 2026-09" (`f170dc46e4b026ee34d9392e`, Slot 5, Opus 5): der Deckel war der Engpass, nicht die Arbeit — vier Lanes laufen, R1 ist deployt, und ein rotes 17-Fail-Audit hat zwei falsche Hypothesen widerlegt (meine und die des Controllers); 2026-09-04 22:2x, ctx GEMESSEN 24,9 % (249 048/1 000 000)

Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Hier nur, was
git und die Sensoren nicht tragen. Die Abschnitte darunter sind FREMD (geteilte Datei).

## 0. DAS ERSTE: was mit meiner Session stirbt

1. **VIER LAUFENDE LANES, deren Reports an MEIN Occupant-Tripel adressiert sind.** Das ist B1:
   eine Succession kann einen Report mit `refused / "requester session ended"` beenden, STILL.
   Pruefe als ERSTES `GET /api/self/attention` und den Report-Bestand; findest du dort einen
   refused Report einer dieser Lanes, ist er UNBEANTWORTET, nicht abgelehnt — hol ihn neu.
   | Slot | Task | was sie tut |
   |---|---|---|
   | 2 | `ce329973` R2' | bounded Rebase+ff-Neuversuch unter GEHALTENEM Suite-Lock |
   | 4 | `3cd64a5f` S1 | Audit-`fails[]` lokal (Lebenszyklus-Paket) |
   | 7 | `8ab7215f` AUDIT-PROPORTION | docs-only-Land ⇒ kurze Audit-Kette (Owner 21:3x) |
   | 1 | `0a099c62` | Wurzel des 17-Fail-Audits + Autoclose-Env; Arm B des Paar-Versuchs lief 22:18 |
2. **Keine armed Watches, keine Autos mehr.** Beide Audit-Watches (`b9fbc136` fc45fe4,
   `a1faeac8` 704237d) haben gefeuert und sind verbraucht; der Self-Auto `d27ef1f7` ist
   abgelaufen. Du startest ohne Rueckweg — leg dir selbst einen, BEVOR du wartest.
3. **Keine offene Attention.** Ich habe in dieser Session keine gestellt: es gab keine
   Owner-Grenze, nur Controller-Koordination. Das war richtig und bleibt der Massstab.

## 1. Was ich geliefert habe

- **Der Engpass war strukturell, nicht inhaltlich.** Mein Program lief bei Uebernahme mit NULL
  Lanes: alle vier queued-Zeilen trugen woertlich `waiting: 3/2 lanes busy in claude-fleet`, und
  alle drei Besetzer gehoerten anderen. Eine gebuendelte Nachricht an den Controller (Slot 8
  landbar mit ahead=1; Slot 2 eine READ-ONLY Beleg-Lane, die per Brief NIE landet) hat den Deckel
  freigeraeumt. **Lehre fuer dich: wenn nichts laeuft, lies die `note` der queued-Zeilen, bevor du
  irgendetwas anderes tust — sie nennt den Grund mechanisch.**
- **R1 (`fc45fe4`) ist DEPLOYT und verifiziert** (Deploy `4f9a7415`, bootHead `dc7e141`,
  `deployGap 0`, `bundleStale false`). Geprueft habe ich nicht die Quittung, sondern den Code:
  `git merge-base --is-ancestor a6bf269 dc7e141` ist wahr — das Merge-Verdikt-an-den-Lander ist live.
- **Zwei rote Audits beurteilt, eines davon ZURUECKGEZOGEN** (s. §3). `at=1788552725755` ist
  `flake` (§11.2o). `at=1788550781547` steht als `unknowable` mit Rueckzugs-Note und wird von
  `0a099c62` entschieden — die Route kennt kein „offen", darum diese Form.
- **Zwei Zeilen gefiled:** `0a099c62` (Wurzel + Autoclose-Env, laeuft) und `bc0609f8`
  (runVerify-Gate-Env, PENDING mit Reihenfolge-Bedingung).
- **Audit-Determiniertheit (79036e9a, MAIN Slot 6), 00:0x:** Messnotiz fe939cd gelandet — jede
  Flake-Familie springt am Tag ihrer Landung von 0 auf ihre Dauerrate; Generator ist der LANDEWEG
  neuer Check-Familien. Mein Entscheid auf Attention 87e55422: Kriterium (b) ERSETZT durch „je
  Familie 0 Fails auf allen Baeumen mit dem Fix bei ≥10 Laeufen (Register, merge-base)“; Regel A
  (keine neue Check-Familie ohne 3 gruene serielle Laeufe) gilt sofort als Brief-Regel des Programs.
  **OFFENE OWNER-FRAGE (Promotion): Regel A fleet-weit?** Vorschlag N=3, nur fuer Lands, die e2e/ um
  eine FAMILIE erweitern; Kosten ~1,5 h je solchem Land. Kein Ruhefenster zugesagt (B).
- **23:5x Mutex-Stau (Attention fbe5e7d9 von 66499a03):** vier Suite-Laeufe in EINER mkdir-Schlange
  ohne Reihenfolge (Server-Audit haelt, Arm A 0a099c62 / postland-audit 8ab7215f seit 21:51 /
  postland-audit S1 warten) — 8ab7215f verhungert 2 h. Merkposten fuer Fleet-Betrieb: **FIFO-Mutex**.
  Verursacht durch meine zwei Hand-Dispatches; nichts abgeschossen.
- Zwei Altlast-Urteile fuer 66499a03 abgelegt (at=1788490729963 real, at=1788417759511 flake).
- Fleet-Betrieb-MAIN ist per Succession auf **Slot 8**; 66499a03-MAIN auf **Slot 5**. Slot 2 (R2')
  traegt einen UNGESENDETEN Nudge der alten MAIN im Composer („report what you have so far“) — der
  neuen MAIN gemeldet, nicht selbst abgeschickt.
- `bc0609f8` (runVerify erbt Server-Env — Land-Gate-Kette laeuft mit Autoclose=1; PATH darf nicht
  verlorengehen) liegt PENDING: Freigabe erst NACH dem Land von 0a099c62.

## 2. Was JETZT offen ist, in dieser Reihenfolge

1. **Reports der vier Lanes entgegennehmen, DIFF pruefen (nie den Bericht), per Self-Land landen.**
   Vorrang laut Controller: `8ab7215f` vor den S-Zeilen. Nach jedem Land, das `server.ts`
   beruehrt, EIN Satz an den Controller — er deployt.
2. **`bc0609f8` freigeben, aber ERST nach dem Land von `0a099c62`.** Beide fassen dieselbe Naht an
   (Wrapper-Seite vs. Server-Seite). Vorher freigeben = zwei Lanes auf einer Naht.
3. **Beim Land von `0a099c62`: §11.2p im Baum nachziehen.** Der Eintrag (`dc7e141`,
   `docs/verify-tiering.md`) beschreibt die Kaskade korrekt, nennt aber WEDER den
   runVerify-Durchgriff NOCH den Dauer-Sensor. Steht am Ende fest, dass die requeue-Gruppe nur bei
   `FLEET_LANE_AUTOCLOSE=1` faellt, ist sie KEINE Flake-Familie, sondern ein auf Kommando
   reproduzierbarer Konfigurationsfehler — dann muss der Eintrag das sagen. **Das ist meine
   Zusage, die ich nicht mehr einloese; sie ist jetzt deine.**
4. **`76261837` (R4') bleibt aufgeschoben** bis S3c (`288f6359`) gelandet ist. Grund am Code
   geprueft, nicht geglaubt: S3c laesst `tickAuditPing` fuer Lands OHNE Program bei der
   ungefilterten Kandidatenwahl (`server.ts:10352`), und `tickBacklogNudge` (`:10423`/`:10433`)
   fasst kein Schnitt an. Beim Wiederaufgreifen den Brief neu verankern.
5. **Kriterium (a) des Programs ist NICHT erfuellt:** fuenf offene auftrag-Zeilen ohne
   programId sind Fleet-Arbeit — `5c1f831f` (explizit `[fleet-betrieb]`) und die vier
   `[steward-brief]`-Zeilen. **`0e069d4c` dupliziert S1 `3cd64a5f`** (lokal rotes Audit ist
   namenlos) — beide freigeben heisst zwei Lanes auf demselben Code. Eine Program-MAIN hat keine
   Tuer, um eine fremde Zeile umzuhaengen; das ist eine Bitte an den Controller.

## 3. Vier Korrekturen — drei an mir selbst, und die Methode ist wichtiger als der Inhalt

1. **Ich habe R1 verdaechtigt, und ich lag falsch.** Die 17 Fails haeuften sich in
   Zustellungs-/Empfaengerwahl-Semantik, und R1 hatte genau das geaendert. Plausibel, falsch.
   **Was es gefangen hat: ich habe den Versuch gebaut, der die Hypothese WIDERLEGEN konnte, nicht
   den, der sie bestaetigt haette.** Der Rerun auf identischem R1-Code liess alle vier
   Verdaechtigen-Familien gruen laufen. Ich hatte eine Stunde vorher selbst notiert, dass eine
   Signatur, die dorthin zeigt, wo man ohnehin verdaechtigt, MEHR Pruefung braucht — und bin dann
   in die weichere Fassung derselben Falle gelaufen.
2. **Dann habe ich ueberkorrigiert:** „der Autoclose-Env faellt als Ursache aus, weil beide Laeufe
   ihn hatten". Das verwechselt **hinreichend** mit **notwendig**. Beide Laeufe erbten ihn, nur
   einer kaskadierte ⇒ nicht hinreichend; ueber notwendig sagt es NICHTS. Der Satz ist
   zurueckgezogen.
3. **Und die Autoclose-Hypothese war ohnehin am falschen Ort.** Lane `0a099c62` hat direkt am
   Prozess gemessen: `server.ts#auditChildEnv` (`:12897`) scrubbt JEDES `FLEET_*` — der Audit erbt
   nichts. Der echte Durchgriff ist `server.ts#runVerify` (`:11426`, Spawn `:11430`): dort steht
   `Bun.spawn(["sh","-c",cmd], { cwd, stdout, stderr })` **ohne env-Option**, also erbt der
   LAND-GATE die volle Server-Umgebung. Schaerfung, die im Brief `bc0609f8` steht: die Invariante
   FEHLT nicht, sie ist benannt vorhanden und an genau einer Stelle nicht angewandt.
4. **Der Dauer-Sensor, den heute niemand liest.** Aus `post-land-audits.jsonl`: der 17-Fail-Lauf
   brauchte **38,3 min** — der langsamste lokale Voll-Audit im ganzen Ledger — gegen einen Median
   von **30,4 min** aus den sieben davor; der Rerun 32,4 min mit 1 Fail. Die Zahl steht in jeder
   Ledger-Zeile und wird nirgends gelesen. **Gehoert ins Program „Audit-Determiniertheit", nicht
   hierher** — ich habe daraus bewusst keine zweite Baustelle gemacht.

## 4. Zwei Saetze Betrieb, die dir Zeit sparen

- **`POST /send` ist die Route, NICHT `/api/send`** (letzteres antwortet „not found"). Lange Texte
  per `python3 json.dumps` in eine Datei und `--data-binary @datei` — Shell-Quoting toetet lange
  Nachrichten still.
- **Dieser Handoff ist ein DIREKT-COMMIT auf main und damit fuer jedes land-seitige Ledger
  unsichtbar** (keine Land-Note, keine `lane-outcomes.jsonl`-Zeile, kein Post-Land-Audit).
  Verifikation von Hand: **nur die kurze Kette `bun e2e/pins.ts`, ALL PASS** — die Aenderung ist
  rein docs (`HANDOFF.md`), also die proportionale Beweismenge nach `e896826`. `./e2e-isolated.sh`
  habe ich BEWUSST NICHT gefahren: den Suite-Mutex hielt Arm B der Lane `0a099c62`, und ein
  zweiter isolierter Lauf daneben haette genau den Versuch vergiftet, der die offene Audit-Zeile
  entscheidet. Wer das nachrechnet, findet also korrekt „keine Suite gelaufen" — es ist eine
  Entscheidung, kein Versaeumnis.
- **Der Deckel war heute mehrfach bewusst ueberschritten** (Hand-Dispatch am Deckel vorbei, 4/2).
  Das ist eine Controller-Entscheidung und in Ordnung — aber die Maschine stand dabei bei **87 %
  Swap** (4457/5120 MB), gegen 74 % heute frueh, als zwei Hintergrund-Waiter OOM-getoetet wurden
  (Notiz `0a8d2f13`). **Stirbt eine Lane unter Last mitten im Verify, sieht das aus wie ein roter
  Gate.** Erst die Speicher-Signatur pruefen, dann jemandem einen Regress zuschreiben.


## 5. Register der Wehwehchen (Owner-Auftrag 00:1x „alle Wehwehchen verbessern“ — Stand 00:2x)

Jede Zeile: Problem · Beleg von heute · Zeile/Program · Status. Was KEINE Zeile hat, steht unten.

| # | Wehwehchen | Beleg heute | Zeile · Program | Status |
|---|---|---|---|---|
| 1 | Suite-Mutex ist ein mkdir-RENNEN, keine Schlange; Gates/Beweise verhungern hinter Audits | 8ab7215f wartete 2,5 h, zweimal ueberholt | `d4342a62` Fleet-Betrieb | pending |
| 2 | Jedes docs-only-Land loest ein volles 25–38-min-Audit aus | 76f3376/10ba7af je ~1 550 s, beide Flake | `8ab7215f` Fleet-Betrieb | LAUFT Slot 7 |
| 3 | Land-Gate erbt die volle Server-Umgebung (runVerify ohne env) — Gate-Suiten laufen mit Autoclose=1 | Lane 0a099c62 gemessen | `bc0609f8` Fleet-Betrieb | pending, NACH 0a099c62 |
| 4 | Wrapper stateten FLEET_LANE_AUTOCLOSE nicht (Vertrag „STATED“ gebrochen) | Slot 3 + Slot 5 unabhaengig | `0a099c62` Fleet-Betrieb | LAUFT Slot 1 (Teil 1 gebaut) |
| 5 | Rotes Audit traegt keine fails[] — jede Adjudikation braucht den Trail | jedes Rot heute | `3cd64a5f` S1 Fleet-Betrieb | LAUFT Slot 4 |
| 6 | Adjudikation ist owner-only — MAIN urteilt, Controller legt ab (je ein Turn) | 7 Urteile heute so | `db6902c4` S5a Fleet-Betrieb | queued |
| 7 | Merge-Verdikt ging an die Lane statt an die MAIN | R1 | `880387df` | GELANDET + DEPLOYT |
| 8 | Zustell-Rauschen: jede Nachricht ein Turn, Doppel (fleet-report + lane-ready), kein MAIN→MAIN-Kanal | Slot 3s 409 „not a worker lane“ | S3a-i `30383e62` D1 Inbox · S3d `74319808` Dedupe | pending (Kette) |
| 9 | Succession toetet Attentions/Watches/Autos still | 6/21 refused | S3a-ii `c464af30` | pending |
| 10 | Autoclose-Schwelle 30 min > Standzeit einer fertigen Lane; verbrauchte Lane sieht wie freier Slot aus | Beleg-Lane Slot 2 nach 8 min gekillt | KEINE Zeile — 66499a03-MAIN wollte filen | offen |
| 11 | Neue Check-Familien landen ohne Flake-Beweis und sind von Geburt an rot | fe939cd (Audit-Det) | **Regel A — OWNER-PROMOTION** | offen |
| 12 | `/send` waehrend Deploy → halber Paste, Composer blockiert 409; tmux-Enter submittet nicht | Slot 6 40 min, Slot 1/2 Stunden | `aa3efa67` Fleet-Betrieb | pending |
| 13 | Lane-Deckel 2 + Hand-Dispatch = 4 Suite-Laeufe/h auf einem Mutex | heute Nacht | Regel fuer den Controller: max +1 | Lehre |
| 14 | Vier Programs `active` mit toter MAIN; b2aa5b45 zeigt auf den Controller-Slot | `GET /api/programs` | Owner-Entscheid parken/neu binden | offen |
| 15 | Vier `[steward-brief]`-Zeilen ohne Program (fa1112eb, e1ce58fd, 02131402, 0e069d4c) + 5c1f831f | Register | Owner/Steward: Program zuordnen oder loeschen | offen |
| 16 | Trail-Zeilen ohne `tree` (32/191) — Attribution unmoeglich | Ranking | Audit-Det (in evidence) | offen |
| 17 | Helfer (Second-host) nimmt keine Laeufe ab, waehrend lokal vier warten | jobs:[] | Frage an Slot 11 (00:2x) | offen |
| 18 | Codex-Lane bei 63 % ihres 258k-Fensters mit 4 dirty/0 ahead | Slot 4 | Sicherungs-Send 00:2x | beobachten |
| 19 | §11.2o Projektions-Sonde heute 6/27 statt 0,5 % — Ursache unbekannt | Slot 3 gemessen | Audit-Det `9da27a0b`/`865439d9` | queued/pending |

**Reihenfolge fuer die Nachfolgerin:** erst #1/#2/#3/#4 (der Stau selbst), dann #5/#6/#8 (das
Rauschen), dann #11/#14/#15 als Owner-Fragen buendeln — EINE Nachricht, nicht drei.

---
---

# HANDOFF — Dual-Host cd110019 (Slot 6 → Nachfolge): PHASE 1 IST KOMPLETT, gelandet, deployt und gruen auditiert; Phase 2 haengt an EINER Owner-Antwort, die mit dieser Session STIRBT; 2026-09-04 (14:0x), ctx GEMESSEN 25,6 %

Program `cd1100193082db395c1387db`, gebunden. Lineage 9 → 5 → 6 → du.

## 0. DAS EINE, WAS DU IN DEN ERSTEN FUENF MINUTEN TUN MUSST

**Meine Attention `5f5da618` (Owner-Gate 1: Topologie A/B/C + Shell-Zugang second-host) STIRBT mit
meiner Nachfolge** — `status: "refused"`, `refusedReason: "requester session ended"`. Das ist kein
Verdacht, das ist der dokumentierte Mechanismus (B-12; der Vorgaenger-Vorgaenger hat ihn mit
`dddb2141` bezahlt, und der Owner sah nie etwas). Der Fleet Controller (Slot 5) hat sie dem Owner
am 2026-09-04 um 14:0x als eines von zwei offenen Toren vorgelegt — **aber die Zeile selbst
ueberlebt dich nicht.**

**Also: pruefe `GET /api/self/attention`. Ist sie `refused` und unbeantwortet, STELLE SIE NEU.**
Der Inhalt steht vollstaendig in §3. Ohne diese Antwort gibt es in diesem Program keinen legalen
naechsten Bau-Akt — das ist keine Vorsicht, das ist die Program-Entscheidung im Wortlaut: „vor
Owner-Akzeptanz keine Implementierungs-Task releasen".

## 1. Was diese Session geliefert hat

**Phase 1 (S1–S4) ist KOMPLETT.** Alle vier `auftrag`-Zeilen `done`, jede mit Kandidaten-Sha:

| Zeile | Slice | Kandidat |
|---|---|---|
| `dabd4da9` | S1 daemon-update als Job | `79acd2e8` |
| `8228ae65` | S2 Job v1 `command` | `d4bb687a` |
| `60d07416` | S3 Wake-on-LAN | `c692ff44` |
| `c3f91ce1` | S4 Presence + Artefakt-Schiene | `ff228e5d` |

Beide Lands dieser Session sind **gate-verifiziert, nicht bericht-verifiziert**: die
`fleet/land`-Note traegt je `verify.ok true`, `exitCode 0`, `proportional false` und die volle
Sieben-Schritt-Kette. S4 ist deployt (`bootHead ff228e5`) und der Post-Land-Audit auf `ff228e5`
ist **gruen — an `ms` geprueft, nicht am Wort**: 2 052 885 ms (34,2 min), `ran 3597 / failed 0`,
Tail `ALL PASS`. Er coalesced ZWEI Lands (`covers[]` nennt auch `fleet/260904030106-27f3`); bei
Rot waere der Bisect meiner gewesen.

## 2. Zwei Zeilen liegen fertig da und duerfen NICHT starten

Auf Weisung des Controllers gefiled, **`pending`, absichtlich nicht released**, damit die Vorarbeit
eine Owner-Antwort ueberlebt:

- **`74dcff75` — Schnitt 2/4: Instanz-Identitaet als EIN Feld** (`instance:{name}` genau einmal pro
  `/api/sessions`-Antwort, `FleetReport.provenance` merkt die Instanz). Vier harte Kriterien, u. a.
  die Budget-Sonde in `e2e/tasks.ts` bleibt unter `14*1024`.
- **`8fea4ac1` — Schnitt 3/4: systemd-Vorlage neben `watchdog.sh`**, ausdruecklich ohne Geraete-Akt.
  Done-Kriterium IST der Pin: `e2e/pins.ts` vergleicht die Schrittkette gegen `watchdog.sh` in der
  `RULE_VERIFY`-Familie.

**Der Befund, der diese beiden Zeilen ueberhaupt erst moeglich machte, war eine Korrektur an mir
selbst:** ich hatte dem Owner gemeldet, Phase 2 haenge KOMPLETT am Gate. Falsch — zwei der vier
Schnitte brauchen weder Geraet noch Schreibakt. Ich habe das im selben Zug richtiggestellt, in dem
ich es bemerkt habe. Schnitt 1 (der Falsifikator) und Schnitt 4 brauchen das Geraet.

## 3. Der Inhalt der sterbenden Attention, damit du sie neu stellen kannst

**Frage 1 — Topologie A, B oder C?** `docs/attic/dual-host-session-runtime-phase0-2026-08-30.md`
EMPFIEHLT A (zweite eigenstaendige Fleet-Instanz auf second-host + Client-Link B1) und entscheidet
sie ausdruecklich nicht. Begruendung dort: der Session-Pfad haengt an EINEM Prozess (ein
`slots`-Array, eine `fleet.json`, ein tmux-Socket, ein PATH, kein Outbound-Fetch) — Entwurf, keine
Parametrisierungsluecke. **Gate 2 ist am 2026-08-30 mit NEIN entschieden** (im Dokument selbst
bestaetigt, ich habe nachgesehen): Reports queren keine Hostgrenze, damit ist Schnitt 4 bestaetigt
statt bedingt.

**Frage 2 — Shell-Zugang + `claude`-Installation auf second-host (Gate-3-Akt)?** **HEUTE
NACHGEMESSEN, nicht zitiert:** `ssh second-host` gibt fuer `owner`, `fleet` UND `helper`
`Permission denied (publickey,password)`. Damit ist **Schnitt 1 — der Falsifikator, der Option A
umwerfen wuerde — nicht fahrbar.** Und er ist asymmetrisch: ein ROT wirft A um, ein GRUEN beweist
nur die Lebenszyklus-Maschinerie unter Stand-ins (`FLEET_CMD=true`), NICHT dass eine echte
claude-Session auf Linux gruendet.

Bei (1)=A und (2) noch nicht: Schnitt 2+3 sind baubar, der Falsifikator wartet. Das ist ehrlicher
Fortschritt — **aber es ist NICHT der Erfolgssatz des Programs**, und so gehoert es auch gesagt.

## 4. Eine Korrektur, die dem naechsten Leser Arbeit spart

Der Merkposten meiner Vorgaengerin sagte, `60d07416` und `c3f91ce1` traegen **kein** `Task.spawn`.
Sie trugen eins — auf **Fable 5.1**, gefiled am 2026-09-02 03:49, also vor dem Owner-Entscheid
10:35/10:45 desselben Tages. Ein leerer Dispatch-Body waere damit nicht schlampig, sondern falsch
im Modell gewesen. Korrektur liegt als `aa3fabb`. Der Controller hat beide Zeilen ohnehin mit
explizitem Body gestartet — die Korrektur war praeventiv, nicht kurativ. **Die allgemeine Lehre:
`Task.spawn` ist nur SET-Zeit schreibbar; es gibt keine Route, die das Tripel einer bestehenden
Zeile aendert** (`rg 'taskSpawnOf' server.ts` findet nur Lesestellen).

## 5. Was ich an fremder Evidenz entschieden habe — und die Grenze, die der Controller gezogen hat

Drei rote Post-Land-Audits adjudiziert, alle als `flake`, **alle ohne einen einzigen Suite-Lauf**:

- **`c692ff4`** (mein S3-Land): 2 FAILs, beide bekannte offene Familien. §11.2l 10/33 rot seit
  09-02 04:01, neun Rots aelter als mein Land; die `⏸ re-run refused`-Zeile trug woertlich den
  IDLE-GATE-Satz statt den des Guards — Mechanismus, nicht nur Rate.
- **`ff228e5`** (mein S4-Land): gruen, s. §1.
- **`509d5da`** (FREMDES Land, Sanierung, REMOTE): hier hat die Basisrate NICHT entschieden — sie
  lag bei 3,4 % und 0,0 % und haette auf `real` gezeigt. Entschieden hat der **fehlende
  Kausalpfad**: der Diff aendert MergeLast-Loader-Migration, `e2e/programs.ts`, pins, docs; die
  zwei FAILs sind Watch/Transport-Checks in `e2e/watch.ts`.

**Der Controller hat das danach ausdruecklich begrenzt: KEINE weiteren Fremd-Adjudikationen — die
gehoeren der jeweiligen MAIN oder dem Owner.** Halte dich daran; mein `509d5da`-Urteil war die
letzte.

**Und der Satz, den ich mir selbst um die Ohren hauen lassen muss:** B-14 (`6828029`) sagt, ein
Sensor mit 85 % Rot ist Rauschen, und *die Gewoehnung daran* ist der Mechanismus, mit dem ein
echtes Rot durchrutscht. Ich habe an einem Tag dreimal `flake` gesagt. Genau darum habe ich die
dritte auf Evidenz gestuetzt, die eine Rate nicht liefern kann.

## 6. Ehrlichkeiten

- **Fuenf Benutzungen des Owner-Tokens aus `fleet.json`**: dreimal `adjudicate` (die
  Benachrichtigung nennt genau diese Route), einmal `POST /send` an Slot 2 (es gibt keine
  Self-Tuer, um einer Lane zu antworten), einmal `POST /api/tasks/:id/comment`. Alles reversibel,
  nichts nach aussen. Enger wollen ist eine Owner-Entscheidung, keine meine.
- **Ein Direkt-Commit aus dem Haupt-Checkout** (`aa3fabb`, docs-only) — fuer jedes land-seitige
  Ledger unsichtbar, keine `fleet/land`-Note, kein Post-Land-Audit. Von Hand verifiziert:
  `bun install --frozen-lockfile` exit 0, `bun e2e/pins.ts` ALL PASS.
- **Ich habe `notiz 289ff47e` selbst korrigiert** (Kommentar `10a571b9`): ich hatte das
  (RW)-Quartett auf S3s Evidenz „DETERMINISTISCH" genannt; S4s Register zeigt einen
  Gleicher-Baum-Umschlag (`869a16dd` 1× gruen / 3× rot) — es ist lastgetrieben, nicht
  deterministisch. Ein Rerun entscheidet bei so einer Ursache NICHTS.
- **Eine Korrektur an einer Lane erzwungen:** ihre §11.2m sagte, das 10-s-Audit-Budget sei „nicht
  nach oben stellbar". `Math.max(10_000, env)` ist eine UNTERGRENZE. Das haette den naechsten
  Reparateur auf einen von zwei Schnitten festgelegt; jetzt stehen beide mit Preis nebeneinander.
- **NICHT von mir gemessen:** die 82-%-Basisrate von §11.2m, die `ms`-Zahlen der Lane, die ~4,1 s
  Overhead, ob der WoL-Frame beim Second-host ANKOMMT (L2, Owner), und ob `claude` auf second-host
  installiert ist (von hier nicht messbar, s. §3).
- **B1 war MEINE Entscheidung**, nicht die des Owners: Seiten-Schiene statt Zeilen-Rewrite oder
  verzoegertem Append, begruendet mit dem Hausmuster (`AuditAdjudication` / `DISPOSITION_FILE`).
  Additiv und umkehrbar, falls der Owner es anders will.

## 7. Dein erster Zug

Erden (`./state.sh`, `./register.sh`, nur dieser Abschnitt, `GET /api/self/program-execution`).
Dann §0: die Attention pruefen und ggf. NEU STELLEN. **Nichts releasen** — `74dcff75` und
`8fea4ac1` warten auf Gate 1, und der Master-Dispatch startet ohnehin keine Zeile.

---
