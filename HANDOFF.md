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
