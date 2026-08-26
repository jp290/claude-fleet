# HANDOFF — Controller (Slot 9), Abendsession 2026-08-26 (vierte) → Übergabe

Zustand wird ABGELEITET: `./state.sh` · `./register.sh` · Live-Queue. Hier steht nur, was daraus
nicht hervorgeht. Vorgänger-Handoff: `c73e24d` (dritte Tagsession).

## Dein Auftrag: ERNTEN. Drei Lanes und ein Deploy sind in Flug

**Watches sterben mit meinem Slot — neu verankern, bevor du irgendetwas anderes tust.** Genau das
hat heute einmal Zeit gekostet: eine fertige Lane lag ~20 min unbeachtet, weil der Watch nach dem
vorigen Land verbraucht war und die Folge-Lane ohne frischen Watch spawnte.

1. **Slot 1 — Entwurfs-Lane „Lane-Suiten im Helper-Portal"** (Task `00bef3fc`, Branch
   `fleet/260826183744-2af3`, Opus xhigh). Anlass, Owner wörtlich: er wollte die laufende Suite der
   Lane auf Slot 5 über das Audit-Helper-Portal annehmen, „aber es tauchte nicht auf". Ursache
   (von mir vorab gemessen, die Lane verifiziert sie): `helperJobsView` (`server.ts#helperJobsView`)
   iteriert ausschließlich über `auditQueue`, also Post-Land-Audits — der Vorschau-Lauf einer Lane
   steht dort nie drin, obwohl er dieselben ~11 min Suite-Mutex frisst. Sie liefert
   `docs/helper-lane-suiten-entwurf-2026-08-26.md` mit einem Schnittplan (je Schritt Datei, Symbol,
   Sonde, Breaker). **Danach ist eine ZWEITE, gestaffelte Lane zu briefen, die nach diesem Dokument
   implementiert — so vom Owner angeordnet.** Erst landen, dann Lane B aus dem gelandeten Dokument
   briefen.
2. **Slot 5 — Fix des Proportional-Pfads** (Task `4a257283`, Branch `fleet/260826175851-f68e`).
   Fasst den Land-Pfad an ⇒ volle Verify-Kette + `./e2e-isolated.sh` sind Pflicht, und sie liefert
   eine Sonde MIT vorgeführtem Breaker. Beim Land: der Post-Land-Audit ist selbst ein
   `e2e-isolated`-Lauf — nichts danebenstellen.
3. **Slot 6 — Private-repo-j-Lane** (`fleet/260826180624-8796`), liefert das Stück, das S3 für die
   Route-(b)-Owner-Frage aus Stufe 2 §3 braucht. Land per Confirm über den Controller.
4. **Der Gate-Fix ist HALB durch — das ist die wichtigste offene Zeile.** Owner-Go liegt vor, der
   Watchdog-Kickstart ist gefahren (neue pid, srv und alle Sessions haben überlebt), **aber der
   Deploy steht noch aus**: der Preflight lehnt ihn ab, solange ein Post-Land-Audit läuft
   (`a post-land audit is running on claude-fleet — killing srv now would leave a red that measured
   nothing`). Ein Hintergrund-Watcher rückte ihn nach; **prüfe als Erstes, ob er durch ist, und
   MISS das Ergebnis**, statt es anzunehmen:
   ```
   for p in $(pgrep -f 'bun server.ts'); do ps eww -p "$p" | grep -o 'src/helper\.ts' | wc -l; done
   ```
   Erwartet: `1`. Kommt `0`, ist der Deploy nicht gelaufen — dann `POST /api/deploy` wiederholen,
   sobald kein Audit läuft. (Token-Hygiene: `ps eww` NIE ungefiltert ausgeben, nur zählen.)

## Der Befund hinter Punkt 4 (Stichprobe `dffef24`, von mir nachgemessen)

**Der laufende Land-Gate typprüfte `src/helper.ts` nicht**, obwohl `watchdog.sh:91`, `AGENTS.md:148`,
`CLAUDE.md:65` und das Rulebook-Fragment es einig behaupten: die Live-Kommandozeile enthielt sie 0×,
`src/share.ts` dagegen 2×. `VERIFY_CMD` wird zur SPAWN-Zeit in den Watchdog gebacken; der lief seit
dem 19.08., der Eintrag kam heute früh (`13451c0`). Ein Server-Restart zieht das NICHT nach, nur
`launchctl kickstart`. Der Diff, den der Kickstart nachzieht, ist genau zwei Zeilen (helper.ts in
die tsc-Liste · `FLEET_VERIFY_WAIT_MS`, fährt live schon) — also praktisch nur die eine.
**Offen geblieben und ehrlich als offen zu führen:** warum der Live-Server den WAIT_MS-Wert vom
20.08. fuhr, obwohl der Watchdog vom 19.08. stammte. Mein Modell der Naht erklärt das nicht; die
helper.ts-Messung steht davon unabhängig.

## Drei Fallen, heute bezahlt — sie kosten die nächste Session sonst dieselbe Zeit

- **`dispatch` antwortet `ok:true`, bevor der Brief in der Pane ist.** Der Zustell-Tail läuft
  asynchron (`server.ts`, `r.tail.catch(() => {})` vor der `audit("task_dispatch")`-Zeile). Bei der
  Fix-Lane blieb der Brief im Composer stehen; **der Owner musste das Enter selbst drücken**.
  `rawAcknowledged` ist KEIN Sensor dafür (markiert nur „bewusst unanalysiert gestartet"), der
  Task-Status auch nicht (steht auf `sent`, gepastet wurde ja). **Regel: nach jedem Dispatch die
  Pane lesen** — `tmux -L claudefleet capture-pane -p -t s<N> | tail`; steht Text im Composer und
  nichts läuft, `send-keys -t s<N> Enter`. Heute beim vierten Dispatch angewandt und bestätigt.
- **Eine Pane in einem AskUserQuestion-Menü ist für `POST /send` „composer occupied"** — die Frage
  erreicht das Board nie und der Owner sieht sie nicht. So standen Private-repo-rs Tür 1 und Private-repo-ts Gate 0
  unbemerkt. Notweg: Menü per `capture-pane` lesen, mit `send-keys` navigieren. **Ist „Type
  something" schon markiert, tippt eine Ziffer TEXT ins Freitextfeld statt zu navigieren** (`❯ 5. 3`)
  — dann `BSpace`, und entweder mit Pfeiltasten navigieren oder das Freitextfeld bewusst nutzen
  (`send-keys -l "<text>"` + `Enter`), was für ein Urteil mit Begründung ohnehin besser ist.
- **Der Lane-Watch feuert nach dem Land noch einmal** (heute 2×), mit Fakten von VOR dem Reap. Kein
  Defekt — das Prädikat war zur Auswertungszeit wahr. `tmux has-session -t s<N>` plus
  `ls -d <worktree>` ist die Zwei-Sekunden-Antwort; danach acken und nichts tun. Wer stattdessen
  `POST /merge` schickt, bekommt `not a fleet-created worktree lane` und hält es für einen Fehler.

## Betriebsbefund: Fable-5-Credits sind erschöpft

„out of usage credits" — eine private-repo-r-Lane wurde MITTEN im Lauf abgeräumt (Deliverable war zum Glück
schon geschrieben). Geprüft und ENTWARNT für neue Arbeit: `FLEET_DEFAULT_MODEL` ist
`claude-opus-5[1m]` (`src/protocol.ts#FLEET_DEFAULT_MODEL`), `SUMMARY_MODEL` ist
`claude-sonnet-5[1m]`. Betroffen sind nur explizit auf Fable gepinnte Slots. **Die Programm-MAINs
haben in ihrer Pane selbst auf Opus gewechselt, ihr Slot-Datensatz sagt weiter `fable`** — bei
Nachfolge oder Pane-Heal fällt das still zurück (keine Route ändert Modell/Effort eines LEBENDEN
Slots). Nach jeder Succession in der Pane `/model` prüfen. Worker-Lanes: Opus für Kern/Kritik,
Sonnet für mechanische Arbeit; beiden betroffenen MAINs so zugestellt.

## Was diese Session geschlossen hat (Bodies: `git log c73e24d..HEAD`)

1. **Gate-Naht zu**: `FLEET_VERIFY_CMD_REPOS` trägt jetzt private-repo-r `./verify` · private-repo-t `bun verify.js` ·
   private-repo-j `bun run verify` · private-repo-q `./verify.sh`. Zwei Deploys (`fa61d842`, `97cd40dc`), beide
   grün, Keys in der Server-Env nachgemessen. `.env`-Backup `~/.env.fleet.bak-2026-08-26`.
   private-repo-s fehlt bewusst — dort existiert noch kein Code.
2. **Norm-Sätze als PROPOSAL** (`037d246`): Breaker-Pflicht für Prädikat-Beweise · maschinenlesbare
   Waiver-Form. **Promotion steht aus (Owner-Akt).** Private-repo-r hat die Norm noch am selben Abend
   erfüllt (V8-Stale-Detektor mit vorgeführter Mutation).
3. **Vier Lands**: Private-repo-j Stufe 1 (`5ddfcea`) und Stufe 2 (`6d9a1cd`), beide über Hand-Verify +
   Confirm · **private-repo-r main = `7f21ac8`** (ff über vier Commits, `./verify` ALL PASS V0–V8 vorher
   selbst gefahren) · **private-repo-t main = `4ad9c03`** (Archiv). Dazu die Stichprobe `dffef24`.
4. **Drei Owner-Türen entschieden**: Private-repo-r Tür 1 = „Ja, mit Ort-Auflage" (steht als bindendes
   Abnahme-Kriterium in private-repo-rs `AGENTS.md`: bester ORT-Zug über bestem TERMIN-Zug, sonst ist
   Slice 1 nicht done; heutige Latte laut Lane C: reiner Orts-Zug erreicht 31 % des Termin-Zugs) ·
   Private-repo-s Gate 1 = Option A + Dichte-Latte „unter ~5 % Fehlgriffe nach 1 min" · **Private-repo-t
   EINGESTELLT**.
5. **Private-repo-t sauber beendet**: Owner-Urteil „Ich mag das Spiel nicht", auf Rückfrage als
   KONZEPT-Urteil präzisiert (nicht die Geste, nicht das fehlende Duell). `ARCHIV.md` mit
   Schlussbilanz, `bun verify.js` ALL PASS, Kanarienvogel ehrlich als OFFEN. **Slot 14 hat
   retired.** Der Festkomma-Kern (95 Checks) bleibt als Baustein. Der Programm-Datensatz in
   `fleet.json` steht noch auf aktiv — Board-Akt für den Owner.
6. **S1→S3-Succession** (Private-repo-j), neue MAIN läuft Opus 5.

## Vier neue Queue-Zeilen aus der Stichprobe (nicht dispatchen ohne Lesen)

`e5792d0b` **auftrag** — zwei Sonden-Lücken mit Mutationsbeweis schließen: `e2e/dirs-pins.ts:70`
(„never descends into .git") KANN NICHT FALLEN, auf Scratch-Kopie bewiesen; und
`e2e/context-packs.ts` prüft 12 von 38 Validator-Codes, alle 26 ungeprüften feuern.
· `d5ea3b5d` **auftrag** — `server.ts#buildCodeGraph`: die Invariante „Bau außerhalb des Worktrees"
hat keine Sonde; ihr Bruch kostete schon einmal 54 rote Checks und tarnte sich als fremde
Flake-Signatur. · `aadb6754` **notiz** (abgeleitet, nicht gemessen) — `#fleetReportsFor` bindet auf
slot+openedAt+sessionId, geprüft wird nur slot. · `b2265631` **notiz** — Off-by-one in
`docs/rollen-evidenz-2026-08-21.md` §1.

## Offene OWNER-Entscheide (neueste zuerst)

- **Norm-Sätze-Promotion** (Proposal steht in `docs/product-studio-working-circle.md`).
- **Private-repo-qs drei Türen** (Modalität · Kartenbasis inkl. Extrakt-Freigabe + Owner-Stadt ·
  On-Device-Auslegung) — als Entscheidungsfragen angefordert, noch nicht eingetroffen.
- **Private-repo-j Route-(b)-Frage** — S3 hält sie bewusst zurück, bis ihre Lane geliefert hat. Gutes
  Urteil, nicht drängen.
- **Private-repo-t-Programmzeile** in `fleet.json` auf beendet setzen (Board).
- **Stufe-1½-Session** (Audit §236): Startbedingung erfüllt, aber als OPUS-Lane fahren (Fable ist
  credit-los) und weiter als FRISCHE Lane, nicht S3 — der Audit verlangt einen frischen Critic.
- Bestand: d70d-Promotion · Rail-Commit `3600618` · 13 Worktree-remove-Zeilen (nur auf Go) ·
  Lizenz-Trio · Publish-Rückstand (~1020 Commits) · Fragment-Promotion geschmack/owner ·
  Programm-Triage.

## Arbeitsmodus (Owner-gesetzt, gilt fort)

Controller erörtert, AGENTEN fixen — selbst nur briefen, landen, deployen, ernten. Programm-Lands
per Confirm über den Controller. Supervisor-Rolle vakant. **Slot 2 gehört dem OWNER selbst** (er
arbeitet dort an einer Auftragsmarkt-/App-Idee) — nicht anfassen, nicht beobachten.
