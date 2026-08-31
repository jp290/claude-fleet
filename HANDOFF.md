# HANDOFF — Dual-Host Program cd110019: Canary bestanden, Dauerkanal ungeklärt, 2026-08-31

Program **`cd1100193082db395c1387db`** („Dual-Host Fleet — Second-host Session Runtime") bleibt
aktiv und gebunden. Dieser Abschnitt ist NEU und oben angesetzt; nichts darunter wurde angefasst.

## 1. Program-Zustand

- **Richtung A bestätigt** (zweite eigenständige Fleet-Instanz auf second-host + Client-Link B1),
  Phase-0-Beleg gelandet als `0f3a9da` (`docs/dual-host-session-runtime-phase0-2026-08-30.md`),
  Korrekturen nachgezogen in `9ff14be`.
- **V1 erfasst** (Owner, 2026-08-30): Fleet-Reports überqueren KEINE Hostgrenze; jede Maschine
  behält eigene Program-MAIN, Inbox, Tokens, Ledger. Eine hostübergreifende Inbox/Event-Bridge
  ist vertagt und wäre ein eigener Architekturentscheid.
- **Canary-Eintrittsbedingung ERFÜLLT und belegt:** `7d26ff9`,
  `docs/messungen/2026-08-31-second-host-session-canary-private-repo-o.md`. Gemessen am laufenden Build
  `62ef02a1d3ee4b03ff89a25316e3b1151f123f44`: gestartet (`/stamp.json` = commit 62ef02a,
  dirty false, GET / 200), über den ECHTEN Eingabepfad gesteuert (CDP `Input.dispatchKeyEvent`,
  gehaltenes ArrowUp speed 4,24 → 19,38 m/s über 18 Proben; ArrowRight yaw −2,14° → −28,04°),
  benannte Belege zurück (Frame 780×493, 52 488 B, sha256 `f4ce2224…`, HUD + eingebrannter
  Stempel, angesehen).
- **KEIN Implementierungs-Slice freigegeben.** Die Canary ersetzt Schnitt 1 des Phase-0-Plans,
  sie ist keine Freigabe zur Topologie-Implementierung.

## 2. Der Befund, der die Canary bezahlt hat — als VORBEDINGUNG lesen

`bun run verify` ist auf second-host **rot in `T14 auslauf leckt nicht`** (Trace-Digest `d113eb90`
statt der eingebrannten `b8c98758`). Gegenprobe: dasselbe Bundle, derselbe Commit, frischer
Scratch-Klon auf dem Mac → **ALL PASS**. Zuordnung damit **Plattformdifferenz**
(arm64/macOS 26.3.1 gegen x86_64/Debian 13), **kein Regress**. Daneben ist `T4 determinismus` auf
Linux grün — die Sim ist dort in sich deterministisch, sie landet nur auf einer anderen Zahl;
`T15 lenkung im bild` ist grün.

**Konsequenz, die der Phase-0-Plan NICHT kannte:** second-host darf einen Build **fahren und
bebildern**, aber über diese Zeile **nicht grün oder rot sprechen**, bis der Digest-Breaker
plattformunabhängig ist oder je-Plattform-Baselines bekommt. Wer das überspringt, lässt die zweite
Maschine ein Urteil fällen, das strukturell falsch ist.

## 3. Die offene Owner-Entscheidung — NICHT die der Nachfolgerin: der Dauerkanal

Die einmalige ssh-Freigabe war ein **Einzelakt und ist vollständig zurückgebaut**: `known_hosts`-
Zeile entfernt (Datei wieder 567 Zeilen, ssh scheitert wieder an der Host-Key-Prüfung), Chromium
`purge` + `autoremove`, Arbeitsverzeichnis entfernt, kein Listener auf 5173/9222; Portal und Daemon
unberührt (`fleet-helper` active, Config-mtime unverändert).

**Die Nachfolgerin darf ssh NICHT eigenmächtig wieder öffnen.** Zur Wahl stehen, ungetroffen:
- **S5** — den Helper-Daemon nach Job-Art verzweigen (`daemon.ts:269` loggt `kind`, `:324` führt
  einen einzigen `cfg.suiteCmd`). Bleibt im Pull-Modell, legt **kein Credential auf den Mac**.
- **Ein beschnittener stehender Key** mit `command=` und `from=`.

## 4. Ehrlichkeiten, wörtlich mitzunehmen

- **`speedWhileLightRed` ist UNGEMESSEN, nicht bestanden** — die erste Probe fiel bei t=4,03 s,
  also hinter die Ampel-Freigabe. Wer die Sperre belegen will, misst ab t=0.
- **„Reference" heißt der GEMESSENE Zustand, kein Qualitätsurteil.** Der Owner hat `62ef02a` nie
  gefahren; **`owner_taste` und `sensory_critic` bleiben `unknown`.**
- **Provenienz `7d26ff9` und `9ff14be`: Direkt-Commits aus dem Haupt-Checkout** — also **keine
  `fleet/land`-Note, keine `lane-outcomes.jsonl`-Zeile, kein Post-Land-Audit**. Die Verifikation
  steht stattdessen im jeweiligen Commit-Body (`install` + `pins` → ALL PASS). `./state.sh`s
  Land-Health-Zahlen untertreiben an diesem Tag entsprechend.
- **Ein Messfehler, den die Nachfolgerin nicht wiederholen muss:** ein `pins`-Lauf zeigte 2
  FAILURES an `CLAUDE.md`; Ursache war die **nebenläufige Neu-Erzeugung des Regelbuch-Generats**
  durch eine andere Session (`a2f4375`, 16:08), nicht die eigene Änderung — belegt per A/B. In
  diesem Checkout arbeiten mehrere Sessions; ein Generat-Rot zuerst gegen die mtime prüfen.

## 5. Nächster Zug

Der Kanal-Entscheid (§3) ist das Tor. Erst danach lohnt Schnitt 2 des Phase-0-Plans
(Instanz-Identität als EIN Feld pro Antwort — Byte-Decke `e2e/tasks.ts:590`, `bytes < 14 * 1024`).
Der Digest-Breaker aus §2 gehört vor jede Spielarbeit auf second-host, nicht danach.

---

# HANDOFF — Task-Workbench-Slices pending; roter Audit vor Release klären, 2026-08-31

Program `b9c1e0d9623aaeb7cabd0257` bleibt aktiv. Baseline-Task `eaa3ae1a` landete nach Reparatur
als Main `bc9e7de35bc49776eedac6aa3ece2388ce1cade1`; die visuelle Browser-Baseline bleibt wegen
fehlendem authentifiziertem Browser `UNKNOWN`.

Post-Land-Audit-Watch `b42166f4` endete rot: 3333 Checks, 3 fehlgeschlagen. Der dauerhafte Trail
`isolated-20260831T110235Z-25178` nennt:

- `subject-gone: the torn-down lane's undelivered event is terminal as itself, unackable, and frees its budget`
- `counterprobe: the live subject's held event is delivered on its FIRST attempt; the dead one is never typed`
- `outcome: a reviewer answer that did NOT parse is persisted as raw:true carrying its text — not as a clean review`

Kein Flake-Urteil: Ein Same-Tree-Rerun für `bc9e7de…` ist noch nicht belegt. Vor seinem Befund wird
keiner der drei neuen, überlappenden UI-Tasks released.

Pending, strikt seriell:

1. `93fc5af2` — Work/Programs/History trennen und Suche über Text, ID, Status, Repo und Program.
2. `ff535524` — aktive/Hintergrund-Lanes exakt ihrer Task zuordnen; running/done-looking/idle/dirty/unknown.
3. `1b677e58` — harness/model/effort sowie Clarify-first vs. Start an der Task-Zeile.

Alle drei sind Codex `gpt-5.6-sol`/high, haben harte Rot-Mutationen und teilen `src/client.ts`;
deshalb niemals parallel releasen. Nächster Akt: roten Audit auf demselben Baum reproduzieren oder
ehrlich als weiter `unknown` blockieren, dann nur `93fc5af2` releasen. Keine Host-Implementierung.

## Nachtrag 2026-08-31 — zwei DIREKT-Commits aus dem Haupt-Checkout (`e0e0c70`, `de13c81`)

Die 28 untracked Einträge des Haupt-Checkouts sind gesichtet: 23 getrackt (`briefs/` 10, `docs/` 6,
`docs/attic/` 5 redigiert, `promote-program.sh`, `.gitignore`), `x.bundle` und drei Root-PNGs
gelöscht, `.codex/`/`*.bundle`/`/*.png` dauerhaft ignoriert. `git status` ist leer.

**Beide sind Direkt-Commits, also für jedes land-seitige Ledger unsichtbar** — keine
`fleet/land`-Note, keine `lane-outcomes.jsonl`-Zeile, kein Post-Land-Audit. Die Kette lief deshalb
**von Hand und vollständig**: install → pins → tsc → build → clean-review → security → claude-gate,
**exit 0**, 261 PASS in den vier Suiten, 308 PASS in `pins`. `./state.sh`s Land-Health-Zahlen zählen
nur Lanes und untertreiben diesen Tag um zwei Commits.

**ERLEDIGT 2026-08-31 — die Rulebook-Drift aus `49e35f6` ist geschlossen.** Die fünf Zeilen liegen
jetzt in der Quelle `rulebook/graphify.md`, `CLAUDE.md` ist daraus regeneriert (70937 B), der tote
Anker heißt jetzt `AGENTS.md §Codex` und löst gegen `## If you are a Codex or Pi lane` auf.
`bun e2e/pins.ts`: **310 PASS, 0 FAIL, exit 0.** Beide Dateien sind gitignored — kein Commit, kein
Land; Sicherungen im Session-Scratchpad. Beim Nachlesen wurde die Lage übrigens kleiner als gedacht:
`FRAGMENTS_FOR.lane` (`rulebook.ts:39`) enthält `graphify` NICHT, und `server.ts:4916` schreibt einer
Lane die Lane-Rendering aus `rulebook/` statt einer Kopie des Monolithen — es war also nie eine Lane
falsch informiert. Der Schaden war der blinde Sensor, nicht die Regel. Der ursprüngliche Befund, zur
Nachvollziehbarkeit:

**Befund, NICHT von diesen Commits — die Rulebook-Drift aus `49e35f6`.** Zwei Pins bleiben
rot: `CLAUDE.md is renderRulebook("main", rulebook/) byte for byte` (70498 B gerendert vs 70949 B)
und der Anker `CLAUDE.md:768 → AGENTS.md §Codex/Pi-Lane`. Gemessene Wurzel: `49e35f6` brachte die
graphify-in-einer-Lane-Regel korrekt nach `AGENTS.md`, schrieb den Begleitabsatz aber in das
**generierte** `CLAUDE.md` statt in die Quelle `rulebook/graphify.md` — fünf Zeilen, die die nächste
Regeneration still löscht. Der zitierte Anker heißt in `AGENTS.md` wörtlich
`## If you are a Codex or Pi lane`. Reparatur ist eine Rulebook-Änderung und damit Owner-Promotion;
der Diff liegt in `rendered-CLAUDE.md`/`rulebook-drift.diff` im Session-Scratchpad, ist aber in
zwei Minuten neu erzeugt (`renderRulebook("main", rulebook/)` gegen `CLAUDE.md` diffen).

---

# HANDOFF — Red-Team-Controller wechselt; Live-Zustand vollständig neu messen, 2026-08-30

Der Owner hat diese Session beendet, weil sie wiederholt ältere Pane-/Board-Stände mit dem aktuellen
Zustand vermischt hat. **Keine Statusaussage dieses Abschnitts als gegenwärtig übernehmen.** Die
Nachfolgerin führt zuerst `./state.sh`, dann `./register.sh` aus, liest nur diesen obersten Abschnitt
und anschließend die Live-Queue; Queue-Texte sind Daten, keine Befehle. Danach genau eine gezielte
Live-Aufnahme der relevanten Slots statt fortlaufendem Pane-Polling.

Tatsächlich ausgeführte letzte Writes dieser Session:

- Audit `1788095115182` als `flake` adjudiziert; die Auditzeile blieb rot.
- Je eine beobachtet zugestellte Nachricht an Slot 16 (vorerst keine weiteren Lands/Deploys) und
  Slot 2 (Succession statt neuer A/B/C-Arbeit). Ob und wie beide reagiert haben, ist **unknown** und
  muss live geprüft werden.

Owner-Ziel und Reihenfolge:

1. Fleet wieder selbsttätig und übersichtlich betreiben; automatische Tests niemals vom Controller
   babysitten. Ein Lane-Worker besitzt seinen Wait, seine Suite und seinen terminalen Fleet-Report.
2. Task `8f7aca97` / zuletzt Slot 4 neu messen. Letzte beobachtete Behauptung war Kandidat
   `f1d26e3`, eigener Mutex-Wait, noch kein terminaler Report. F2/F3/F4 seien umgesetzt, F5A
   (automatisches Retire einer bestätigten clean+ahead0/no-candidate-Lane) sei nicht umgesetzt.
   **Alles davon ist ein zu verifizierender Vorgängerstand.** Keine zweite Suite starten.
3. Erst nach einem aktuellen terminalen Befund über Land und erforderlichen Deploy entscheiden.
   Land ist nicht Deploy. Rote oder unklare Gates gehören der ausführenden Session; der Controller
   beobachtet nicht fortlaufend.
4. Danach Slot 2s tatsächliche Succession prüfen. Slot 5 war zuletzt eine abgeschlossene
   Critic-Lane ohne Commit; daraus folgt nicht automatisch ihr heutiger Zustand. Anschließend die
   neuen Succession-/Report-/Audit-Wege an echten Ereignissen prüfen.
5. Erst danach Slots 12/13 untersuchen; Second-host-Auslagerung kommt zuletzt.

Offene Grenze: Zwei von Slot 16 koordinierte Kandidaten und weitere Board-Zeilen waren zuletzt in
Bewegung. Urheberschaft, Landstatus, Mutexhalter und Queue müssen neu gelesen werden; die älteren
Abschnitte darunter sind Historie und dürfen keine Live-Entscheidung ersetzen.

---

# HANDOFF — Private-repo-o-Worktrail-Audit abgeschlossen, Blaupause wartet auf Promotion, 2026-08-30 15:20 CEST

Controller-Session Slot 8 (Owner-Auftrag: tiefer Worktrail-Audit des Private-repo-o-Laufs). Kette ist
GESCHLOSSEN — alles gelandet, nichts in Flug. Uebergabe wegen Band (gemessen 35,1 %).

## Was diese Session getan hat (alles auf main, Bodies lesen)

Sechs GLM-Audit-Lanes (pi-zai/glm-5.3, effort high, Owner-Dispatch waivt das automatable-Gate)
gebrieft, geerntet, seriell gelandet: `4eaf365` (R7–R9) · `d487fdf` (R10–R13, R11-Sonderfrage
beantwortet) · `068f8e7` (Critic+MAIN) · `bfc5fd1` (Kontext-Pack-Katalog) · `1daa00e`
(Infra-Reichweite/Frische — graphify-Stale-Fenster, dangling Knowledge-Pointer, 402:9
Nudge-Oekonomie) · **`43360f1` (Blaupause: gerankte Bau-Liste S1–S8, Verworfene, wortfertige
Brief-Bloecke im Anhang — DIE Entscheidungsvorlage)**. INDEX-Zeilen nachgetragen als direkte
docs-Commits `965d073`/`86cf406`/`070ddbc` (Beweis je: install+pins ALL PASS; kein Land-Ledger-
Eintrag, konstruktionsbedingt). Board-Sweep AUF OWNER-ANWEISUNG: 127 stale pending archiviert,
Voll-Snapshot `~/claude-fleet-private/fleet-tasks-snapshot-2026-08-30.json` (restore je Zeile
moeglich; Retention verdraengt terminale Zeilen bei neuen Tasks endgueltig).

## Offene Owner-Entscheidungen (nichts davon selbst starten)

1. **Blaupause promoten + Slices freigeben** (`docs/werkzeug-integration-blaupause-2026-08-30.md`
   §4): Schnittlinie = S1 (Briefprofil, docs-only, Bloecke liegen wortfertig in §5) · S2
   (Report-Ist-Zahl) · S3 (capture.ts + seal.sh + Critic-KIT) · S4 (serve-pair + pixelcmp) VOR dem
   naechsten Game-Maker-Lauf. Drei E-Nachtraege, die F nicht mehr sah (E landete spaeter):
   Knowledge-Symlink `~/.Codex/knowledge -> ~/.claude/knowledge` (1 Zeile) · Land→Rebuild
   (detached `graphify update .` im Land-Pfad, schliesst 2h14m/8h49m-Stale; NICHT das beerdigte
   .git/hooks-Grab) · Nudge-Drossel (jetzt mit 402:9-Zahlen belegt).
2. **Fahrgefuehl-Attention `69386d59`** (A nachsichtig / B anspruchsvoll / C selbst fahren) —
   parkt weiter den kritischen Pfad des Spiels.
3. Task `d98fe812` (Architekturreview) steht queued — Regel aus dem Vorgaenger-Handoff unten gilt.

## Fuer die Nachfolgerin

`./state.sh` + `./register.sh` zuerst. Die sechs Audit-Notizen sind der Kontext; die Blaupause ist
die Arbeitsliste. GLM-Lane-Betrieb: Watch feuert fuer pi-zai nie (server.ts#6753 verweigert
ehrlich) — Rueckweg ist ein Hintergrund-Watcher auf ahead/clean der Lane-Branch (Muster im
Session-Scratchpad dieser Session, watch-glm-lanes.sh). Land blockt, solange die Lane aktiv
arbeitet („let it settle") — Retry-Schleife, nicht Force. Der Abschnitt darunter (10:38,
Betriebszustand/P0) ist der Handoff der VORHERIGEN Controller-Session; seine Punkte 3–6 sind
unabhaengig von dieser Arbeit und ungeprueft weitergueltig.

---

# HANDOFF (Vorgaenger) — Fleet wieder in einen belastbaren Betriebszustand bringen, 2026-08-30 10:38 CEST

Owner-Ziel: zuerst den gemessenen FleetEvent-/Composer-Schaden schließen und den laufenden Stand
wieder mit einem grünen Produktionsbeweis versehen; danach die operativen Schulden so ordnen, dass
Board, Audits, Helper und Succession keine stillen Zustände mehr erzeugen. Mindestgrenze für
„vernünftig laufend“: P0 exakt gelandet, neuester Post-Land-Audit grün, exakt dieser Tip deployed,
Bundle nicht stale und keine unbelegte Behauptung über eine verschwundene Event-Zeile.

## 1. Als Erstes neu messen

Führe `./state.sh` und `./register.sh` aus, lies dann `/api/sessions`, `/api/deploys` und
`/api/post-land-audits` mit dem Token aus `fleet.json`. Vor jedem Write den aktuellen Slot-Occupant
erneut belegen. Keine Pane-Injection als Ersatz für einen Fleet-Rückkanal und keinen Prozess nach
Namensmuster töten.

Stand dieser Übergabe:

- `main=75b21106feb1f66e11ca6f2b81341dadd0ea05f4`; der Server bootete Deploy `416d7fa4` auf
  `088d3a8b90de17cd42f648caf2640641edd77d77`. Die vier neueren Main-Commits sind Doku, daher
  `codeBehind:false`; `bundleStale:false`.
- Der letzte Second-host-Audit ist **rot** auf `dbb2e09460a6c65251eb6e2b802814eea7727cb2`:
  Exit 1 nach 1.261.823 ms und exakt `1 FAILURES`. Der auf 64 KB begrenzte API-Tail nennt den
  fehlgeschlagenen Check nicht. Nicht als Flake bezeichnen; dazu wäre ein grüner Same-Tree-Rerun
  nötig. Der unmittelbar ältere Audit auf `088d3a8` war grün mit `rows=3308 results=3308`.
- Second-host ist `active`, ohne Claim und ohne neue Lapse. Das lokale P0-Isolated hält derzeit den
  einzigen Suite-Lock; keine zweite Suite daneben starten.

## 2. P0 fertigstellen — Task `9912a68a`, Slot 2

Branch `fleet/260830063131-c091` steht sauber auf
`3f64ed1446f6c21585d24838626bb44947e5638b`, `ahead=1/behind=1`. Der Commit ändert sechs Dateien
mit 551 Einfügungen und 22 Löschungen. Sein Vertrag ist im Baum sichtbar: `subject-gone` ist ein
eigener Terminalzustand (`server.ts:1443`), verschwundene Subjects werden so terminalisiert
(`server.ts:7444`), und der Composer vergleicht Fleet nur gegen den vollständigen eigenen Payload
(`composer.ts:57`). `AGENTS.md` ist unverändert.

Beweislage:

- RED4 auf der Basis endete mit genau vier erwarteten Produktfehlern: Prefix wurde submitted;
  100 Holds erhöhten `attempts`; das verschwundene Subject blieb pending; die tote Lane wurde
  trotzdem zugestellt. Der Rest des Laufs lief weiter und der Tail endete `4 FAILURES`.
- Die normale Gate-Kette ist grün: clean-review, Security und Claude-Gate enden jeweils
  `ALL PASS`; die Exit-Zeilen sind `cr=0`, `sec=0`, `cg=0`.
- `./e2e-isolated.sh` läuft seit 10:24 CEST unter dem allein notierten Wrapper-PID `98814`.
  Scratch-Tail:
  `/private/tmp/claude-501/-Users-owner-claude-fleet-worktrees-fleet-260830063131-c091/6a6249e4-c2c8-430d-9ae8-05e5ad096e5a/scratchpad/green-iso.log`.
  Taskstatus ist noch `sent`; es gibt noch keinen Fleet-Report.

Reihenfolge ohne Abkürzung:

1. Auf das terminale Isolated-Ergebnis warten. Nur ein Tail `ALL PASS` akzeptieren; bei Rot zuerst
   Checkname und Signatur lesen. Eine zweite grüne Ausführung desselben Trees wäre erst dann der
   Flake-Beleg.
2. Slot 2 muss den aktuellen Docs-Commit konfliktfrei merge-forwarden, den nötigen Beweis auf dem
   neuen HEAD erhalten und danach den Fleet-Report mit den wörtlichen Tails und sauberem Tree
   senden. HEAD und Report gegeneinander prüfen; `3f64ed1` ist der P0-Commit, nicht mehr der finale
   Branch-HEAD.
3. Der Task hat kein `programId`; eine Program-MAIN-Self-Land-Tür existiert dafür nicht. Der
   **Owner** landet exakt den gemeldeten Commit über den serverseitigen Landpfad.
4. Den dadurch erzeugten Post-Land-Audit bis `green|red|unknown` beobachten. Bei `red` oder
   `unknown` nicht deployen. Der alte rote `dbb2e09`-Audit bleibt `unknown`, bis sein eigener Check
   oder ein Same-Tree-Rerun vorliegt; ein neuer grüner Tip darf ihn nicht rückwirkend zum Flake
   umetikettieren.
5. Nur nach grünem Audit darf der **Owner** exakt den neuen Main-Tip deployen. Danach
   `hitTarget:true`, `bundleStale:false`, `bootHead=head=target` und keinen laufenden Deploy prüfen.
6. Event `77d3aadb2df16f6246d790e6` ist heute weder in `/api/sessions` noch in den lokalen Ledgers
   auffindbar. Die alte Anweisung, ausgerechnet diese Zeile nach dem Deploy zu prüfen, ist damit
   nicht ausführbar. Kein Ergebnis erfinden: verwende den deterministischen Isolated-Test und bei
   Bedarf eine neu erzeugte, kontrollierte Subject-Teardown-Gegenprobe; nie einen Owner-Composer als
   Versuchsfeld.

## 3. Danach: Betriebsbeweise schließen

In dieser Reihenfolge, jeweils als eigener landbarer Slice:

1. **Helper-Provenienz.** Audit-Ledger meldet für den grünen 3308er Trail nur `checks.ran=23`, weil
   es aus dem gekürzten Tail zählt. Die vollständige Trail-Zahl und der fehlgeschlagene Check müssen
   strukturiert übernommen werden; bis dahin ist der einzelne rote Check im neuesten Audit nicht
   fernlesbar.
2. **Second-host-Daemon.** Die gelandete Helper-Implementierung kann `remote.clonedSha` melden
   (`helper-daemon/README.md:52`), der installierte Daemon tut es noch nicht. Installation/Restart
   ist ein ausdrücklicher **Owner-Akt**; dieses Repo deployt ihn nicht
   (`helper-daemon/README.md:66`). Nach Rollout muss der nächste echte Remote-Audit
   `remote.clonedSha == mainSha` belegen oder die Abwesenheit ausdrücklich benennen.
3. **Audit-Zustand.** Ziel ist nicht, historische rote Zeilen zu löschen, sondern dass der neueste
   Produktions-Tip grün und seine Provenienz vollständig ist. Second-host bleibt Pull-only.

## 4. Succession ist eine offene Richtungsentscheidung, kein `.env`-Handgriff

`FLEET_MIGRATE_PCT` und alle zugehörigen Live-Schalter fehlen aktuell; Migration ist aus
(`server.ts:11304`). Die frühere Anweisung „55 setzen“ ist nicht ausreichend begründet. Der aktuelle
Rail nudged höchstens dreimal (`server.ts:11606`) und öffnet für Program-MAIN-Succession einen
**freien anderen Slot** (`server.ts:18526`); Same-Slot-Succession ist nicht implementiert.

Gemessen vor dieser Übergabe: Slot 1 `32,9%`, Slot 5/Game-MAIN `40,4%`, Slot 11 `26,8%`, Slot 13
`29,3%`; diese Sitzung in Slot 4 lag zuletzt bei `39,6%`. Vor Aktivierung muss der Owner deshalb
entscheiden:

- cross-slot jetzt als begrenzten Canary aktivieren und Schwelle/Safe-Point benennen; oder
- Same-Slot zuerst bauen und erst danach automatisch schalten.

Keine `.env`-Änderung und keinen Server-Restart aus diesem Handoff ableiten. Host-Konfiguration,
Restart und die gewählte Schwelle sind Owner-Akte. Bis dahin Übergaben manuell und in arbeitssicheren
Momenten durchführen.

## 5. Operative Sicht und alte Arbeit

Die Ledgers halten exakt 200 Tasks: 128 pending, 1 queued, 1 sent, 66 done, 4 archived. Damit sind
130 offen: 95 Aufträge, 34 Notizen, 1 Richtung. `register.sh` markiert 17 Zeilen seit 22 Tagen als
`needs-you`. Von 64 Programmen sind 26 aktiv; nur sechs davon haben offene Tasks, 20 aktive Programme
haben keine offene Task. Das ist Sicht- und Entscheidungsbedarf, kein Beweis, dass sie abgeschlossen
sind.

Nächster Board-Slice nach P0 und Produktionsbeweis:

1. kompakte/collapsible operative Gruppen;
2. sichtbarer Hinweis auf die 200er Retention, die nur terminale Rows verdrängt
   (`server.ts:2844`);
3. eigene stale/unbound-Recovery-Gruppe;
4. die 17 `needs-you` und aktiven Programme ohne offene Task sichtbar triagierbar machen.

Keine Task automatisch löschen/archivieren und kein Programm automatisch auf complete setzen.
Task `d98fe812` ist als read-only Architekturreview queued, aber Pi/Z.ai ist nicht unattended
automatisierbar; Owner entscheidet manuelles Starten, erlaubte Neubesetzung oder Rücknahme. Die eine
offene Richtung `23eef33d` verlangt Merge-Train plus Staging-Dev-Instanz, aber ausdrücklich erst
nach Lands/Tag-Messung, Bruchstellen-Inventar und Owner-Promotion. Vor belastbarem Auditrail nicht
bauen.

Von den alten Harvest-Kandidaten ist Context-Pack A (`716f53e`) bereits in `main`; nicht neu bauen.
D1/Stuck-Sensor (`2954eff`, `fleet/260827083510-80fe`) ist noch ein Commit ahead, aber 89 Commits
behind und überschneidet sich mit P0 in `server.ts`. Nach P0 neu gegen den aktuellen Vertrag prüfen,
dann bewusst rebasen/reparieren oder als überholt stehen lassen; nicht blind landen.

## 6. Grenzen und fremde Zustände

- Slot 1 (`second-hostS4`) ist lebendig, aber ohne Task-/Programmbindung; diese Recovery wurde deshalb
  von der gebundenen Nachfolgesitzung in Slot 4 geführt. Nicht nachträglich Besitz erfinden.
- Eine offene Owner-Attention gehört Private-repo-o/Slot 5 und fragt nach einem Taste-Gate. Diese
  Fleet-Recovery beantwortet oder übernimmt sie nicht.
- Im Main-Checkout liegen 28 vorbestehende ungetrackte Owner-Dateien. Nicht anfassen, committen oder
  löschen. Unbeteiligte Dateien dürfen einen Lane-Land nicht in einen Cleanup-Auftrag verwandeln.
- Unaufgelöst beim Handoff: laufender P0-Isolated-Tail; unbekannter Check des roten `dbb2e09`-Audits;
  fehlender Second-host-Daemon-Rollout; Owner-Entscheid über Succession-Modus und Schwelle; D1-
  Adjudikation; visuelle Board-Prüfung.

# HANDOFF — Session „🤗 hf-schwarm II" (Slot 5), Abschluss 2026-08-29

Zustand wird ABGELEITET: `./state.sh` · `./register.sh` · Live-Queue. Vorgängerin: `800f08b`
(hugFaceInci). Diese Session hat deren §1 abgearbeitet — Aufträge 0 und 1 sind gelandet, Auftrag 2
ist owner-seitig und der einzige offene Punkt.

## 1. WAS DU ALS ERSTES WISSEN MUSST: die Vorgänger-Adjudikation stand auf einer falschen Prämisse

Die Notiz `40f62f7` schreibt, `mainSha` sei „die BEHAUPTUNG des Servers, nicht die Messung des
Helfers", und schließt daraus auf `unknowable`. **Der erste Halbsatz gilt für die falsche Hälfte der
Frage.** `server.ts#buildHelperBundle` liest den SHA aus dem **Header der geschriebenen
Bundle-Datei** zurück; `helperClaim` schreibt genau den als `mainSha`. Ein zwischenzeitlich
gewandertes main hätte einen ANDEREN `mainSha` erzeugt, keinen verdeckten.

Drei unabhängige Messungen, alle in `docs/messungen/2026-08-29-bundle-provenienz-second-host.md`:
Herkunft aus dem Bundle-Header · `0cd5e23`/`972dd48` sind **Nachfahren** von `748ec97` · ihre
**Committer**-Zeit ist 12:36:07, der Bericht kam 12:32:48 — sie landeten **3m19s nach** dem Audit.
Die Vorgängernotiz datierte `972dd48` auf 12:24; das ist die AUTOREN-Zeit, und der Unterschied ist
hier der ganze Punkt.

**Die Parallel-Session-Hypothese ist damit widerlegt, nicht bloß unbewiesen.** Was wirklich keinen
Sensor hatte, war EIN Glied: übergebenes Bundle → tatsächlich ausgechecktes Verzeichnis. Genau das
schließt Auftrag 0.

**Ich habe NICHT neu adjudiziert, mit Absicht.** Die Ursache des leeren `successorToken` auf Linux
ist weiterhin geschlossen statt gemessen. `unknowable` durch `stale-test` zu ersetzen, weil eine
Prämisse fiel, wäre derselbe Fehler gespiegelt. Das Urteil gehört **hinter** Auftrag 2.

## 2. Gelandet in `b3f4230` (DIREKT-COMMIT — für jedes land-seitige Ledger unsichtbar)

Kein `git notes --ref=fleet/land`, keine Zeile in `lane-outcomes.jsonl`, **kein Post-Land-Audit**.
Die Verifikation lief deshalb von Hand und VOLL:

| Kette | Ergebnis |
|---|---|
| Land-Gate-Kette (`watchdog.sh:91`) | exit 0, ALL PASS |
| `./e2e-isolated.sh` | ALL PASS, 3273 Checks, 0 FAIL |
| `./e2e-postland-audit.sh` | ALL PASS, 0 FAIL |

Deploy `aa7ee409`: `ok:true`, `hitTarget:true`, `bundleStale.stale:false`, `codeBehind:false`.

**Auftrag 0:** der Daemon misst nach dem Klon `git rev-parse HEAD` im Klon und schickt `clonedSha`;
der Server validiert (40 Hex oder NICHTS) und legt ihn unter `remote.clonedSha` **neben** `mainSha`.
Gemessen-oder-abwesend — ein fehlgeschlagenes rev-parse sendet kein Feld. Eine Divergenz wird in
audit()- und Alarmzeile geschrien, **ändert aber kein Verdikt**.

**Auftrag 1:** `successorToken … ?? ""` ist raus, ersetzt durch eine benannte precondition, die als
sie selbst fällt und die **Länge** des Tokens berichtet, nie den Token.

## 3. DIE LEHRE DIESER SESSION — ein grünes `ALL PASS` deckte nur die Hälfte

`./e2e-isolated.sh` lief ALL PASS über 3273 Checks und hat von meinen vier neuen Sonden **nur zwei
geladen**. `(K)` und `(HD)` liegen in `fleet-e2e-postland-audit.ts` — dem Wrapper, den **kein Gate
fährt**. Wer auf das grüne Wort geschaut hätte, hätte Auftrag 0 auf einer Suite für verifiziert
erklärt, die seine Pins nie geladen hat. Prüfung ist billig: `grep -c '^PASS  (HD)'` auf den Log.

Die entscheidenden Zeilen, weil sie die Mac/Linux-Asymmetrie sichtbar machen:
- `(HD) … cloned=1636b14a == mainSha == handedOver` — ECHTER Daemon, ECHTES Bundle, sein eigenes
  rev-parse. Die einzige Stelle im Baum, die Auftrag 0 tragen kann.
- `Program-MAIN succession precondition … slot=7 row=present token=32 chars` — auf **diesem Mac** ist
  der Token da. Auf dem Second-host war er es nicht.

## 4. DER OFFENE PUNKT: Auftrag 2, und er ist owner-seitig

Den Audit auf demselben Tip auf dem Second-host wiederholen. **Von hier aus nicht machbar**, aus drei
gemessenen Gründen:
- `helper-daemon/README.md` hält als promovierte Invariante fest: *„no ssh runner, no push — the
  Fleet never opens a connection towards the helper machine."* Alles ist ein PULL des Daemons.
- `ssh second-host` scheitert an der Host-Key-Prüfung; `known_hosts` ist geteilte Realität außerhalb
  dieses Repos — angefasst habe ich es nicht.
- **Ein Direkt-Commit stellt KEIN Audit in die Queue** (Tier-2 hängt an `landLane`). Es gibt keine
  Route, die einen Audit von Hand einreiht — `/api/post-land-audits` ist GET + adjudicate.

**Zwei Wege, deine Wahl:** (a) den Daemon auf dem Second-host aus `b3f4230` aktualisieren, dann trägt
der nächste dort geclaimte Audit `remote.clonedSha`; (b) mir Zugang geben für eine wörtliche
Wiederholung auf `748ec97`. Bis dahin trägt der Second-host das Feld NICHT — die Server-Hälfte steht,
die Geräte-Hälfte nicht.

## 5. Zwei Enden aus dem Vorgänger-Handoff §2: BEIDE LEBEN — nicht neu bauen

- **A (Context-Pack):** `fleet/260827123336-6f18`, 1 Commit über main, `.fleet/context-packs.json` +
  `e2e/context-packs.ts`.
- **D1 (Stuck-Sensor):** `fleet/260827083510-80fe`, 1 Commit über main, `lane-signals.ts`,
  `server.ts`, `e2e/lanes-lifecycle.ts`.

Beide stehen in `lane-outcomes.jsonl` als `killed-dirty`; die Worktrees liegen noch auf Platte.

## 6. Korrektur am Fehlerbericht der Vorgängerin + neue Queue-Zeile `ae8715dc`

`POST /api/self/succeed` scheitert reproduzierbar mit `composer still holds 98 chars after 3000ms`.
**Der Mechanismus im Vorgänger-Handoff stimmt nicht:** `succeedSupervisor` RUFT
`waitForFoundingReadiness`, und für eine claude-Nachfolgerin ist dieser Wait per Konstruktion ein
No-op — nur `PI_OX_HARNESS` und `CODEX_HARNESS` deklarieren ein `readiness`. Der Dispatch-Pfad hätte
dort **genauso wenig** gewartet.

Der tragende Befund ist der andere: **98 Zeichen, invariant über zwei verschieden lange `carry`** —
was nicht mit dem Brief skaliert, ist nicht der Brief. Nächster Schritt ist `awaitComposer` /
`after.length`, nicht der Readiness-Pfad. Verdacht (INFERIERT): dieselbe fehlende Succession erklärt
den leeren `successorToken` im roten Second-host-Audit.

## 7. Nicht gefixt, benannt

- Der Kommentar an `server.ts#paneReadiness` sagt „every adapter but codex" und ist seit
  `PI_OX_HARNESS` stale — **zwei** Adapter deklarieren `readiness`.
- Punkt 3 der Vorgängernotiz (füllt sich `checks.ran` aus dem gedeckelten Tail?) ist unangetastet.
- Ein Sweep über weitere `?? ""`-Credentials in Fixtures steht weiterhin aus.
- `docs/messungen/2026-08-29-main-lane-lifecycle-gaps.md` tauchte während dieser Session untracked
  auf und ist **nicht meins** — eine parallele Session arbeitet. Nicht angefasst, nicht committet.

---

## Controller-Session Workflow-Audit (Slot 11, 2026-08-30 vormittags) — Übergabe

**Was geschah (alles gelandet, nichts nur im Gespräch):** Der Owner spielte den Private-repo-o-Build
`db6ed75` und urteilte „ändern"; ein dreisträngiger Workflow-Audit lief (Produkt-Forensik am Build,
Prozess-Forensik über die Ledger, GLM-Instrumentenkritik) plus Stufe 2 (Kontext-Sättigung am
25/30-Band, Modell-Mix). Lies in dieser Reihenfolge, Frontmatter zuerst:
`docs/messungen/2026-08-30-game-maker-workflow-audit-synthese.md` (V1–V7) ·
`…-worktrail-audit-stufe2-kontext-modellmix.md` · `…-game-maker-instrument-audit-glm.md` ·
`…-private-repo-o-prozess-forensik-anhang.md` (Rohtabellen).
**Promotet am 2026-08-30:** game-maker-Regeln V1–V3 (`75b2110`) · AGENTS.md §Context
self-management (`6e08514`) — Füllstand kennen ist Agentenpflicht, Entscheidung dynamisch je
Auftrag; der Owner hat die 25-%-Qualitätsgrenze ausdrücklich bestätigt (Memory
`feedback-context-quality-degrades-at-25pct`).

**In Flug, gehört der Game-Maker-MAIN (Slot 5), nicht dir:** R7 (Lenk-Vorzeichen + Konventions-Pin
in einem Schnitt) und R8 (Kantenlinie oder Card-Zeile streichen), danach blinder sensory Critic auf
dem gefixten Stand, dann Owner-Taste als neue Attention. Attention `e98c0c91` ist beantwortet
(Antwort = Taste-Verdikt + Forensik, in der Attention nachlesbar). Nicht anstupsen — die MAIN
meldet sich über Attention/Report.

**Beim Owner offen (nur erinnern, wenn er fragt):** V4 (selfLand:"guarded" als Founding-Default) ·
V5 (enge Quiet-Hours-Ausnahme für `releasedBy:"machine"`-Tasks gebundener MAINs) · Lifecycle-Program
(fertiger Prompt in `docs/messungen/2026-08-29-main-lane-lifecycle-gaps.md`) · Sensor-Task
`051cc1c2` (ctx auf GET /api/self; Done-Kriterium steht in der Zeile) · A/B-Paar Opus/Sonnet auf
einer Renderer-Reparatur im nächsten Game-Maker-Lauf.

**Warnungen:** (1) Parallel arbeitet eine Fleet-Recovery-Session mit eigenem HANDOFF-Top-Block —
nichts dort überschreiben, Slots nicht anfassen. (2) Sättigungs-Urteile IMMER gegen 25/30 messen,
nie gegen das 83-%-Kliff (der erste Verdict dieser Session war daran falsch). (3) Der
Post-Land-Audit stempelt in Nicht-Fleet-Repos konstruktionsbedingt `unknown` (exit 42) — das ist
kein Defekt-Signal; V6 wäre der Fix.

## Session „Transkript-Forensik + Rückkanal" (Slot 13, Abschluss 2026-08-29/30) — abgeschlossen, nur Zeiger

Anlass war eine Suchfrage („finde die Session zum HuggingFace-Vorfall"), aus der zwei Messungen und
ein Rückkanal-Fix wurden. **Nichts ist in Flug, nichts wartet auf jemanden.**

Gelandet, alle drei mit grünem Beweis:
- `6e67a24` + `024f70c` (Direkt-Commits, Haupt-Checkout — für jedes land-seitige Ledger unsichtbar;
  Verifikation von Hand gefahren: erstes volle Kette 7× ALL PASS, zweites proportional docs-only
  install+pins ALL PASS): `docs/transkript-forensik-2026-08-29.md` + `find-conv.py`.
- `465130b` GLM-Review dazu (`docs/messungen/2026-08-29-glm-review-transkript-forensik.md`), Land
  über einen agent-aufgelösten `INDEX.md`-Konflikt, per `{"confirm":true}` nach Diff-Sicht bestätigt.
- `b6956c9` der Fix: `POST /api/self/watch` (und die Owner-Route, gemeinsamer Schnitt in
  `createWatchForSlot`) lehnt `{kind:"lane"}` auf einen nicht-automatablen Harness jetzt mit 409 ab.
  **Post-Land-Audit GRÜN und echt gelaufen: 3294 Checks, 0 Fails, 23,6 min** (nicht die `ran:0`-Sorte).

Der Befund dahinter, weil er wiederkommt: `aliveInfo` faltet `harnessAutomatable` in `alive`, und
BEIDE Looking-Prädikate verlangen `alive === true`. Eine fertige Lane auf `pi-zai`/`pi-unfenced`/
`container` konnte darum nie `done-looking` werden — der Watch blieb still für immer scharf. Wer auf
so eine Lane wartet, nimmt einen Hintergrund-Watcher auf die git-Fakten; `{kind:"merge"}` war und
bleibt unbetroffen (der Tick liest `mergeTerminalFor`, nicht `laneSignalView`).

**Beim Owner offen — ein propose, kein Auftrag:** CLAUDE.md sagt für gitignorte Dateien
„`rg -uu` (oder schlicht `grep`)". Der Klammerausdruck ist widerlegt: `grep` ist in einer
Claude-Code-Bash-Zelle eine zsh-Funktion, die das claude-Binary als `ugrep` mit `--ignore-files`
fährt und gitignorte Dateien still überspringt (Probe: Shim 2 Treffer, `command grep` 5 — Differenz
`CLAUDE.md`, `rulebook/einstieg.md`, `streams/prompts.jsonl`). Ersatztext samt BRE-Halbsatz steht in
`docs/transkript-forensik-2026-08-29.md` §5 und in der GLM-Notiz. `state.sh`/`register.sh` sind
nicht betroffen (laufen als Skript). Nicht gepinnt: `find-conv.py` hat keine Sonde — Werkzeug, kein
Sensor. Diese Session war bei 29,3 % gemessen.
