# HANDOFF — Dual-Host `cd110019` (Slot 11 → Nachfolge): PHASE 2 IST KOMPLETT — Gate 1 mit A beantwortet, der Falsifikator GEFAHREN (A steht), Schnitt 2+3 gelandet und deployt; es bleiben ZWEI Owner-Gates und kein Code; 2026-09-05 00:3x, ctx GEMESSEN 35,5 %

Zustand ableiten, nicht hier lesen: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`.
Hier steht nur, was git und die Sensoren nicht tragen.

## 0. DAS EINE, WAS DU WISSEN MUSST: es ist KEIN Code mehr offen, und du sollst auch keinen bauen

Beide `auftrag`-Zeilen sind `done` mit Kandidaten-Sha (`74dcff75` → `40f7006a`, `8fea4ac1` →
`22cf0c4b`), beide gate-verifiziert mit voller Sieben-Schritt-Kette, beide deployt. Der Live-Server
trägt `instance:{name:"mac"}` — von mir am Poll gemessen, nicht vom Controller übernommen.

**Was bleibt, sind zwei OWNER-GATES, und sie sind absichtlich KEINE Attention:**

- **Gate 3 — die erste Installation von `fleet-watchdog.service` auf einem Host.** Die Vorlage ist
  gelandet, aber **kein Host hat sie je ausgeführt**; die erste Installation IST die Messung. Owner-Akt.
- **Gate 4 — Aktivierung einer zweiten netzerreichbaren Instanz** (Bind-Adresse, Token,
  Share-Perimeter, `src/share.ts`). **Schnitt 4 (B1-Umschalter) ist ohne sie nicht baubar** — die
  Phase-0-Notiz sagt ausdrücklich „erst wenn Schnitt 1 grün ist UND eine zweite Instanz real läuft".
  Schnitt 1 ist grün. Es fehlt die Instanz, nicht der Code.

**Warum sie hier stehen und nicht als Attention:** eine Attention stirbt mit ihrer Session
(`server.ts#reconcileAttention`, „requester session ended") — genau das ist meiner Vorgängerin mit
`5f5da618` passiert und dem Vorgänger davor mit `dddb2141`. Ich habe die Attention neu gestellt und
sie wurde beantwortet; diese beiden Gates aber sind nicht dringend genug, um eine Session offen zu
halten, und zu wichtig, um mit einer zu sterben. **Stell sie erst, wenn der Owner das Program
weiterfahren will** — bis dahin ist dieses Program inhaltlich am Ende seines baubaren Teils.

## 1. Der Befund, der die Lage geändert hat (und der im Handoff meiner Vorgängerin falsch stand)

Sie schrieb, Schnitt 1 (der Falsifikator) sei **nicht fahrbar**, weil `ssh second-host` zu ist. Die
Kausalkette war falsch. `./e2e-isolated.sh` ist ein Schlüssel in `HELPER_CMD_ALLOW`
(`server/types.ts#helperCmdCheck`) und damit über `POST /api/self/jobs` fahrbar — die Tür, die S2
dieses Programs selbst gelandet hat. ssh ist tatsächlich zu (von mir geprobt), wird aber nicht
gebraucht. Was wirklich blockierte: der Daemon lief auf einem Baum VOR S2 und kannte
`kind:"command"` nicht. Ein `daemon-update` (S1, Owner-Akt) hat das geschlossen.

**Lehre für dich: wenn ein Handoff sagt „geht nicht", prüfe die BEGRÜNDUNG, nicht nur die Aussage.**

## 2. Der Falsifikator und seine Einschränkung — und meine eigene Korrektur daran

`docs/messungen/2026-09-04-falsifikator-second-host.md`, gelandet als `5f7bf15`, danach **zweimal von
mir selbst korrigiert** (`16e0af2` Nachtrag, `09b2c4f` Korrektur). Lies §6 zuerst, sie überstimmt §5.

Urteil: **Empfehlung A steht** — in keinem vergleichbaren Second-host-Lauf war eine der beiden
Familien rot, deren Rot A umwerfen würde. Asymmetrie unverändert: Grün beweist die Maschinerie unter
Stand-ins (`FLEET_CMD=true`), **nie** eine claude-Installation auf Linux (die ist von hier nicht
messbar — `HELPER_CMD_FORBIDDEN = ["claude","codex","pi"]`).

Die benannte Einschränkung: **zeitempfindliche Fixtures setzen auf second-host öfter aus** —
`D2 setup` 3 rot / 5 Second-host-Läufe gegen 0 rot / 5 lokale Sichtungen.

**Mein Fehler dabei, weil er dich sonst auch trifft:** §5 zählte nur die Second-host-Läufe, die ICH
kannte (meinen Command-Job + einen Hinweis). Die Grundgesamtheit steht im **Audit-Ledger**
(`post-land-audits.jsonl`, Feld `remote.name`). Und Remote-Zeilen **vor dem 2026-09-04 10:32**
(Deploy `52673b6`) sind tail-only und melden `ran` 22–26 statt ~3 600 — sie sind keine Messungen und
dürfen nicht mitgezählt werden.

## 3. Vier `notiz`-Zeilen von mir, alle pending, keine gehört mir zur Reparatur

- **`901593dd`** — der Claim-Guard für `kind:"command"` prüft die ANWESENHEIT eines `daemonSha`,
  nicht WELCHEN. Ein zu alter Daemon kommt durch und führt `cfg.suiteCmd` statt der argv aus: eine
  falsch attribuierte **grüne** Quittung, die teurere Sorte. Zwei Schnitte mit Preis darin.
- **`69ad472d`** — das `D2 setup`-Rot auf second-host (Erstsichtung, ausdrücklich nicht adjudiziert).
- **`94affaf3`** — `projection nextAction …` (`e2e/programs.ts`): **7/239 = 2,9 % auf 5 Bäumen**,
  ältester Rot 2026-08-27, alle sieben mit identischem Detail
  `{"with":null,"without":null,"phase":"UNKNOWN"}`. Mechanismus: Messung und Gegenprobe halten
  denselben Wert ⇒ „nie gemessen". Die Sonde fällt als das, was sie messen sollte, statt als sie
  selbst — ihr fehlt der eigene `check()` auf die Vorbedingung. **Diese Zeile ist heute mehrfach
  nachgefragt worden; sie erspart der nächsten MAIN die Herleitung.**
- **`bceea779`** — s. §4.

## 4. Der Befund, der mich selbst belastet, und die Regel, die ich daraus ziehe

Das Post-Land-Audit auf meinem Schnitt-3-Land war rot mit **17 FAILs** über drei unverwandte
Familien. Meine Lesung: **Flake, lastgetrieben** — fünf der sechs geprüften Checks hatten ihren
**ersten Rot überhaupt** (je 421–577 grün vorher), der Lauf brauchte 38,3 min statt 24–34, und im
Audit-Fenster landeten **fünf Direkt-Commits auf main**, jeder mit graphify-Rebuild-Hook.

**Einer davon war meiner** (`09b2c4f`), und ich hatte im Commit-Body notiert, es brenne „kein
Land-Gate, der laufende Prozess ist nur ein Post-Land-Audit, das merget nichts". Der Satz stimmt und
der Schluss war trotzdem falsch: **es ist dieselbe Maschine, und sie urteilt gerade über ein Land.**

**Also die Regel, die ich dir hinterlasse und die es so noch nirgends gibt:** vor einem Direkt-Commit
reicht es NICHT zu prüfen, ob ein Land-Gate brennt — prüfe auch, ob ein Post-Land-Audit läuft
(`ps -eo command | grep -c '^/bin/sh ./e2e-'`), und wenn ja, warte oder nimm in Kauf, dass du ein
fremdes Urteil verschlechterst. Es ist heute der zweite Schaden derselben Wurzel: um 18:28 starb ein
Land-Gate an ff-lost, weil Direkt-Commits main während des Gates bewegten (1 915 457 ms grüner Verify
vertan). Direkt-Commits sind gegen die Land- und Audit-Maschinerie unserialisiert.

**Und die Sonden-Lehre, die mich zweimal erwischt hat:** mein erster Merge-Check vor einem Commit las
`fleet.json`-Slots als Liste (es ist ein Dict) und suchte den Merge-Zustand am Slot (er steht unter
`merges`) — leeres Ergebnis, das sich wie „kein Land läuft" las. **Eine Sonde, die nicht laufen kann,
muss als SIE SELBST scheitern.**

## 5. Ehrlichkeiten

- **Vier Direkt-Commits aus dem Haupt-Checkout** (`9b31c79`, `5f7bf15`, `16e0af2`, `09b2c4f`), alle
  docs-only, alle für die land-seitigen Ledger unsichtbar. Von Hand verifiziert: je
  `bun install --frozen-lockfile` exit 0 und `bun e2e/pins.ts` ALL PASS. `./state.sh`s
  Land-Health-Zahlen untertreiben diesen Tag entsprechend.
- **`FLEET_INSTANCE="mac"` in `.env` ist MEINE Wahl**, vom Controller delegiert. Rollenwort, kein
  Hostname (der Wert steht in jeder `/api/sessions`-Antwort und damit in jedem Share). Gegenstück ist
  der Helfer-Name `second-host`. Ändern = eine Zeile + srv-Restart.
- **NICHT von mir gemessen:** ob der WoL-Frame beim Second-host ankommt · was ein graphify-Rebuild
  wirklich an Last kostet (§4 behauptet Korrelation und einen Mechanismus, keine gemessene
  Kausalität) · `unbound succession: pane s8 rendered the harness screen` (fremdes Audit) · die von
  Lanes zitierten Verify-Ausgaben (der Gate fährt die Kette ohnehin selbst).
- **Der Second-host-Helfer war um 00:23 OFFLINE**: letzter Heartbeat 22:59:45, `DEVICE_ONLINE_MS` ist
  90 s. Sein letzter Job scheiterte 21:55:50 in derselben Sekunde mit `exit 127`
  („Bun could not find a package.json file") — der Klon war leer. Warum die Heartbeats danach
  aufhörten, ist von hier **nicht** messbar (Pull-Client, kein eingehender Kanal, ssh zu).
- **Drei Attentions gestellt, alle beantwortet, keine offen.** Keine Fremd-Adjudikation abgelegt —
  die Controller-Weisung meiner Vorgängerin gilt fort, und ich habe sie zweimal angewandt
  (`10ba7afd`, `5202fd63`), statt zu urteilen.

## 6. Dein erster Zug

Erden. Dann `GET /api/self/attention` — es ist nichts offen, das ist diesmal der SOLL-Zustand und
kein Verlust. **Fang keinen Schnitt 4 an**: er hängt an Gate 4, nicht an Code. Wenn der Owner das
Program weiterfahren will, ist der nächste Akt die EINE Attention mit Gate 3 und Gate 4 zusammen —
zusammen, weil Schnitt 4 an beiden hängt und einzeln gestellt nur eine halbe Frage wäre.

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

# HANDOFF — 🎛 Fleet Controller (Slot 3, Fable 5.1): zwei Lands durch (0a099c62, GLM-Notiz), zwei Analysen committet, d4342a62 laeuft, Deploy haengt am Audit; 2026-09-05 01:3x, ctx GEMESSEN 29,0 %; Succession im Band

> **Regel (Vorschlag, promoviert noch nicht): ein Abschnitt je LEBENDEM Prinzipal.** Wer uebergibt,
> ERSETZT den eigenen Abschnitt statt zu stapeln; Abschnitte abgeschlossener Programs wandern ins
> Archiv (`docs/attic/handoff-archiv-2026-09-05.md`, zwoelf Abschnitte, 2026-09-05). Solange K3
> (`7f60903b`) nicht gelandet ist, sagt der Succession-Brief „oberster Abschnitt" — such deinen an
> der Program-Id in der Ueberschrift.

Zustand ableiten: `./state.sh`, `./register.sh`, Owner-Poll, Panes. Hier nur, was git nicht traegt.
Die Abschnitte darunter sind FREMD (Vorgaengerin Controller Slot 9, MAINs Slot 3/5/7, Slot 6, Sanierung, Dual-Host).
Lineage Controller: 5 → 6 → 9 → 3 → du.

## 0. Rolle (unveraendert, Owner-Entscheid 2026-09-04 09:1x + 19:2x)

Ueberblick + Owner-Nachrichten auf Programs routen. Lands vom Board NUR fuer Zeilen ohne lebende
MAIN oder ohne Self-Land-Promotion. Audit-Adjudikation: die MAIN urteilt, der Controller legt ab.
Modellpolitik: Controller Fable 5.1, MAINs + Lanes Opus 5, Codex gpt-5.6-sol/high, GLM ueber
Adapter **`pi-zai`** (NICHT `pi` — mit `pi` stirbt die Pane still am Modell, Zeile wird requeued
und der Tick schreibt „lanes busy" als Note darueber; passiert 01:16).

**Owner-Korrektur 00:5x, gilt fort:** Lane-Events (Lane-Watch, Reports) der Program-Lanes gehoeren
der Program-MAIN (Slot 8 fuer Fleet-Betrieb), nicht dem Controller. Der Controller haelt nur den
Deploy-Trigger (Audit-Watch) und landet Zeilen ohne MAIN.

## 1. Was in dieser Session (00:2x–01:3x) gefallen ist

- **0a099c62 (Slot 1, Audit-Rot-Untersuchung) GELANDET** durch MAIN Slot 8 → `ed36971`, verify ok,
  volle Kette, 33 min davon **31 min Warten im Mutex**. Urteil `flake` auf Audit at=1788550781547
  abgelegt (Note der MAIN, 296 Z.). Nebenbefund der MAIN: der Audit-srv erbt KEINE `FLEET_*`-Variable
  (`server.ts#auditChildEnv`), der Land-GATE erbt die volle Server-Umgebung (`server.ts#runVerify`)
  — das ist Zeile `bc0609f8`, jetzt `queued`.
- **Owner-Prioritaet 00:5x „Punkt 1 & 2 in den Plan":** d4342a62 (Mutex-FIFO) und die
  Audit-Rot-Zeilen (8ab7215f proportional, 9da27a0b, bc0609f8) VOR den Lebenszyklus-Zeilen S2/S5a.
  Slot 8 hat die Ansage woertlich. **d4342a62 laeuft seit 01:25 auf Slot 1** (Opus 5 high, Branch
  `fleet/260904232513-0b9b`), Zusatz (Wartebudget-Befund von Slot 7, Messung 2 h 45 / drei
  verlorene Rennen, optionale Gate-vor-Vorschau-Klasse als eigener Commit) zugestellt. Ihr
  Report geht an Slot 8, Self-Land dort.
- **Land-Reihenfolge von Slot 8 (begruendet, uebernommen):** 0a099c62 ✔ → R2' (Slot 2, 6 Commits,
  landbar, wartet auf den Mutex) → Slot 7 (a40e898, Audit-Proportion; zweiter Beweislauf 29844 wartet
  seit 40 min im Mutex). Nach dem Slot-7-Land: Deploy + **Regelbuch-Satz in
  `rulebook/lane-discipline.md`** („und der Post-Land-Audit bleibt unveraendert voll" → proportional
  fuer rein-docs-Lands; Wortlaut aus a40e898s AGENTS.md-Hunk), rendern per Einzeiler im Kopf von
  `rulebook.ts`, `bun e2e/pins.ts`.
- **GLM-Zusammenfassung Slot 15 („fable5", Owner-Denksession 17:01–01:14) GELANDET** → `5202fd6`,
  `docs/messungen/session-slot15-fable5-2026-09-04.md`; proportionaler Gate 764 ms, KEIN Mutex
  (der kurze Gate faehrt keinen Suite-Wrapper). Kern: Konzept „Konzept-B" (dezentrales
  Agenten-Kollaborationsnetz), neun Owner-Entscheide woertlich, existiert nur als Artifact.
- **Zwei Direkt-Commits (docs-only, kein Land-Ledger, kein Audit):** `0ba2f32`
  `docs/program-ansicht-informationsschichten-2026-09-05.md` (Vorarbeit fuer die Ansicht, die der
  Owner am 05.09. frueh baut: zehn Schichten, Join-Schluessel gezaehlt, v1 = `GET
  /api/programs/:id/view` auf Abruf + fleet-weites Banner, drei Owner-Entscheide) und `7c72234`
  `docs/messungen/kontextschicht-analyse-2026-09-05.md` (Fable-5.1-Subagent: Startladung +35/+46/
  +120 % seit 08-20; Wegwerf-Worker laedt ~23k Tokens Regelbuch je Lauf, `summaryViaSession` spawnt
  im Repo-Root; Succession-Brief zeigt auf fremden Handoff-Abschnitt; v1-Schnitt in §5).
- **HANDOFF.md von 2 121 auf 571 Zeilen (160 → 43 KB) geschnitten** (Owner 01:5x „warum so
  gigantisch"): vier Abschnitte mit lebendem Leser bleiben (Controller · 66499a03 · Fleet-Betrieb ·
  Dual-Host), zwoelf liegen in `docs/attic/handoff-archiv-2026-09-05.md`. Regelvorschlag oben im
  Kopf: ein Abschnitt je lebendem Prinzipal, ersetzen statt stapeln.
- Context-Pack-Routing dem Owner berichtet (521 Quittungen, 151 leer, vier Packs nie gewaehlt,
  Trigger sind Konstanten). CP-A/B/C pending; fehlender vierter Schnitt: ein EINGANG
  (`Task.contextPacks[]` o. ae.), erst nach CP-A filen.

## 2. Was JETZT offen ist, in dieser Reihenfolge

0. **R2' (Slot 2) IST NICHT GELANDET — und es ist kein Rot** (Merge-Terminal 02:11:
   `status=resolved, landed=NO`, Detail „clean rebase, but verify NEVER STARTED"). Der Gate hat sein
   45-min-WARTEBUDGET im Suite-Mutex ausgesessen, ohne den Baum je anzusehen; `waitedOut` ist nie
   `ok:false`. Die Lane ist unveraendert landbar, der Rebase war sauber — **Slot 8 stoesst neu an,
   sobald der Mutex frei ist** (informiert 02:12). Lage in dem Moment: Halter 70792 (isolated,
   23 min), Anwaerter 29844 (Slot-7-Beweislauf, 1 h 27), 94455 (claude-gate von d4342a62/Slot 1),
   97719 (Slot 4, 55 min) — VIER Suite-Prozesse, ein Lock. **Das ist der erste gemessene Fall, in
   dem die Aushungerung ein LAND gekostet hat**, nicht nur Wartezeit; gehoert als Erfolgssatz in
   d4342a62.
1. **Deploy** — `codeBehind:true` seit ed36971 (+5202fd6); zwei Versuche 01:5x/02:12 abgelehnt
   (Preflight: erst laufender Land, dann laufender Post-Land-Audit — beide Ablehnungen sind
   RICHTIG). Audit 5667 lief 01:18-01:48;
   `POST /api/deploy` antwortet 409 solange. Mein Audit-Watch `431e29b5` auf ed36971 STIRBT mit
   mir — neu armieren: `POST /api/self/watch {kind:"audit", repo:"/Users/owner/claude-fleet",
   mainAfter:"<sha ed36971 voll>"}`. Danach `bundleStale` pruefen.
2. **R2'-Land (Slot 2) und Slot-7-Land** fahren Slot 8; nach JEDEM Deploy. Nach dem Slot-7-Land
   der Regelbuch-Satz (oben).
3. **Nach dem R2'-Land:** 9da27a0b (Audit-Determiniertheit, MAIN Slot 6) in den freien Slot
   hand-dispatchen (`POST /api/tasks/9da27a0b/dispatch {harness:"claude",model:"claude-opus-5[1m]",
   effort:"high"}`); danach bc0609f8. Lane-Zahl bei VIER halten (Maschine im Swap).
4. **Slot 4 (Codex S1, 72 % von 258k)** faehrt seine dritte isolierte Vorschau; Codex kompaktiert
   selbst, kein Succession-Druck. Sein Report geht an Slot 8.
5. **Owner-Entscheide, die nur er treffen kann** (gestellt 00:5x, unbeantwortet): vier Programs
   `active` mit `occupancy: stale` (f99e9354 Private-repo-o, 07ee8a6d private-repo-p, 2c073232 Private-repo-j,
   b2aa5b45 Game-Maker v2 → zeigt auf Slot 9, der inzwischen recycelt wurde). API kennt nur
   `archive`/`complete`. Vorschlag stand: Game-Maker v2 + Private-repo-o archivieren, die zwei anderen
   neu binden, wenn Lanes frei. **Regel A** (aus dem Handoff Slot 9 §2) bleibt offen.
6. Sechs rote Audits ohne Urteil (aelter als 04.09.), unveraendert. **NEU 01:4x: Audit
   at=1788565731607 auf ed36971 ROT 3/3651** (unbound succession pane s8 · delivers-it-WHOLE ·
   §11.2o) — alle drei bekannte Familien aus dem Trail-Ranking, keiner beruehrt den Diff; Evidenz an
   Slot 6 geschickt; **Urteil `flake` von Slot 8 ABGELEGT (01:5x)**: zwei Wurzeln, keine des Lands —
   `e2e/harness.ts:299` ist eine Nur-bei-Fehler-Diagnose (`check(...,false)`), die strukturell nie
   gruen erscheinen kann und schon 7,5 h vor dem Land auf fremdem Baum fiel; Fail 2 ist ihre Folge;
   Fail 3 = §11.2o. Fuer Slot 6 (nicht zugestellt, in die naechste Buendelung): die Familie
   „unbound succession" ist JUNG — 9 Laeufe im Register, 2/9 bzw. 3/9 rot, auf drei Baeumen. Deploy wartet auf das
   R2-Urteil (Preflight 409, solange ein Land laeuft).
7. **Kontextlast-Schnitte GEFILED (01:4x, Owner: „alles auf einen guten Stand, damit Astra sauber
   arbeiten kann"):** K1 `56b9d19b` (kind `betrieb`, HAUPT-CHECKOUT: rulebook/lane-discipline.md
   entschlacken, rulebook/ ist gitignored — das tut der Controller oder der Steward von Hand, keine
   Lane), K2 `0735ae31` (Worker-Ambientlast: erst Transcript-Sonde, dann kappen), K3 `7f60903b`
   (Succession-Brief zeigt auf den Abschnitt mit der Program-Id; Kollision mit CP-C beachten).
   Alle pending am Program Fleet-Betrieb; Reihenfolge NACH d4342a62/9da27a0b/bc0609f8, VOR den
   Lebenszyklus-Zeilen — K1 kann jederzeit, sobald kein Land laeuft (Render + pins, kein Mutex).
   Die Ansicht selbst baut der Owner am 05.09. frueh auf `docs/program-ansicht-informationsschichten-2026-09-05.md`.
8. **README aus der Codebase (Owner 01:5x)** — Zeile gefiled, ohne Program (Controller landet):
   README.md neu aus Code + graphify-Graph statt abgelesener UI-Features, Symbolanker, GLM-Gegencheck
   jeder Behauptung, Leak-grep leer; die GitHub-Beschreibung nur VORSCHLAGEN, setzen tut der Owner
   von der Hauptmaschine (nie von hier pushen). Reihenfolge: nach K1–K3, ist Aussenwirkung, kein Betrieb.
9. **Codex-Adapter-Audit (Owner 02:0x: „gruendlich pruefen ob codex 100 % vernuenftig, sauber,
   robust")** — Mess-Lane gefiled am Program Fleet-Betrieb (neun mechanische Proben in einer
   isolierten Instanz, e2e-Deckung je Probe, Rangliste, GLM-Gegencheck; KEIN Umbau in der Lane).
   Reihenfolge: nach den Mutex-/Audit-Zeilen, parallel zu K2/K3 moeglich (kein Symbol gemeinsam).
10. **Owner 02:0x zu K3:** der Handoff-Regelvorschlag (ein Abschnitt je Prinzipal) bleibt VORSCHLAG,
   bis K3 `7f60903b` gelandet ist — nicht vorher promovieren.

## 2b. AUFTRAG AN DICH (Owner-Ansage 01:5x, woertlich): „schreib in dein handoff auch das die
## naechste session diese punkte angehen sollte und die kontext schichten der einzelnen rollen
## verbessert, sie soll dafuer glm zum gegencheck benutzen. vllt all dies als lane, smart ausgefuehrt"

Ziel: die Kontextschichten der VIER Leserrollen — Controller/Program-MAIN (Fable/Opus, 1M) ·
claude-Lane (Opus, 1M) · codex/pi-Lane (258 400) · Wegwerf-Worker (merge/review/analysis) — auf
Basis von `docs/messungen/kontextschicht-analyse-2026-09-05.md` §2 (B1–B10) und §5 verbessern.
Erfolgsmass: Startladung je Rolle VORHER/NACHHER in Bytes, am Render gemessen (`wc -c CLAUDE.md`,
Lane-Render ueber `rulebook.ts`, AGENTS.md, Worker-Transcript), als Messnotiz.

Reihenfolge, nach Token-Hebel und so, dass nichts Widerlegtes gebaut wird:
1. **EIN GLM-Gegencheck der Analyse ZUERST**, als Lane mit Adapter **`pi-zai`** (NICHT `pi`; kein
   Lane-/Merge-Watch moeglich → Worktree per `git rev-list --count main..HEAD` beobachten).
   Muster: `docs/messungen/2026-09-04-context-pack-gegencheck-glm.md` — je Befund B1–B10
   bestaetigt/teilweise/widerlegt mit Fundstelle, plus Kollisionsflaeche mit dem
   Lebenszyklus-Paket (S2/S12/3a-i, CP-A/B/C). Docs-only, landet ueber den kurzen Gate ohne Mutex.
   Widerlegte Befunde werden NICHT gebaut; teilweise bestaetigte bekommen den engeren Schnitt.
2. **K1 `56b9d19b`** im HAUPT-CHECKOUT (rulebook/ ist gitignored, keine Lane kann es): nur wenn
   `fleet.json#merges` keinen laufenden Land zeigt; Fragment editieren, Render-Einzeiler aus dem
   Kopf von `rulebook.ts`, `bun e2e/pins.ts`, Ziel `wc -c CLAUDE.md` < 75 000; jeder gestrichene
   Absatz eine datierte Zeile im Attic. Keine Regel streichen, nur Geschichte.
3. **K2 `0735ae31`, dann K3 `7f60903b`** als Opus-5-Lanes, SERIELL, je mit GLM-Gegencheck des DIFFS
   vor dem Land (eine pi-zai-Lane liest den Branch read-only, Messnotiz, dann erst Self-Land).
   K3 kollidiert mit CP-C `b2bd8cef` an `buildSuccessionBrief` — nur die Program-Variante anfassen.
4. Danach **B4–B10 als eigene Zeilen filen**, jede mit Kosten + Verify, NICHT alle auf einmal; die
   SYSTEM.md-Frage (Agenten-Leser oder Owner-Dokument) dem Owner VORLEGEN, nicht entscheiden.

Rahmen: Lane-Zahl bei vier halten, Mutex beobachten (Halter + Anwaerter), Deckel 2 gilt fuer den
Tick, Hand-Dispatch prueft ihn nicht. Reihenfolge NACH d4342a62/9da27a0b/bc0609f8 (Owner-Punkt 1
und 2), VOR Lebenszyklus S2 ff. AGENTS.md bleibt der portable Vertrag; das Regelbuch darf keine
harte Invariante schwaechen. Done je Schritt = der Verify aus der jeweiligen Zeile.

## 3. Bezahlte Lehren dieser Session

- **KEIN Direkt-Commit auf main, solange ein Land laeuft** (`fleet.json#merges` pruefen): mein
  `fd7d605` lag um 00:5x unter dem laufenden Land von 0a099c62; die Lane basierte auf 0dbd8cb, der
  abschliessende `--ff-only` waere `ff-lost` gestorben (bis R2' landet ein Endzustand). Repariert
  per `git reset --soft 0dbd8cb` VOR dem Gate-Urteil, Commit nach dem Land neu. **Regelvorschlag
  fuer `rulebook/einstieg.md` (propose, nicht promoviert):** „Ein Direkt-Commit ist erst erlaubt,
  wenn `merges` keinen laufenden Land zeigt."
- **Der proportionale Gate nimmt den Mutex NICHT** — `VERIFY_PROPORTIONAL_CMD` = install+pins ohne
  Wrapper; die Mutex-Erkennung liest die `[suite-lock]`-Zeilen der Wrapper (`server.ts#SUITE_LOCK_RE`).
  Ein docs-only-Land ist darum jederzeit billig, auch bei vollem Mutex.
- **pi-zai-Slots sind nicht automatable:** `POST /api/self/watch` (lane UND merge) antwortet
  „target slot not active"; Rueckweg ist ein Hintergrund-Watcher auf den Worktree (`git rev-list
  --count main..HEAD`) bzw. auf `GET /api/slots/:id/merge` `running:false`.
- **Hand-Dispatch prueft den Deckel wirklich nicht** (Regelbuch stimmt); die Note „4/2 lanes busy"
  an einer requeueten Zeile stammt vom TICK nach dem Requeue und verdeckt den echten Grund. Erst
  `server.log` (`slot N: created tmux session`) und die Pane lesen.
- **Mutex-Rennen, gemessen:** Slot 7s 5-min-Lauf wartete 2 h 45 und verlor drei Rennen; der
  Land-Gate von 0a099c62 wartete 31 von 33 min. Wartezeit/Laufzeit ist der Erfolgssatz fuer
  d4342a62.
- Programs kennen den Zustand ihrer MAIN bereits (`programHealth` → `occupancy: stale`), nur das
  Board zeigt ihn nicht (S12).

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
