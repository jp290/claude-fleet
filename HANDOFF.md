# HANDOFF — Generalsanierung: Codex-Haertung gelandet, P2 gebrieft und queued, drei neue P6-Befunde, 2026-09-01 (abends)

Program **`b2a14b545fd31fd71ba7b9e1`** aktiv, gebunden. Ersetzt den Nachmittags-Abschnitt darunter.

## 1. Autoritaet & Betrieb (unveraendert uebernommen, nichts Neues entschieden)

- Self-Land-Promotion **green-only**; mein Land lief `actor.kind=main`, `confirmedByHuman:false`.
- Master-Stop bleibt AN. Weg unveraendert: file -> release -> **Hand-Dispatch**
  `POST /api/tasks/<id>/dispatch` (Body `{}` oder `{harness,model,effort}`).
- **Die Selbst-Tuer ist weiterhin zu**: `POST /api/self/tasks` antwortete mir woertlich
  `program filing cap reached (5/5 filed rows not yet released)`. Ich habe deshalb ALLES ueber die
  Owner-Tuer `POST /api/tasks` mit `programId` gefiled — der Program-Link haelt, die Zeile bekommt
  `source:"owner"` und braucht darum Hand-Dispatch. Das ist genau der Mangel, den `8cd6deca` behebt.
- auto-③ ist AUS nachgeprueft (`FLEET_AUTO_REVIEW_MS live=0`, und `suites running now: 0` beim
  Ablesen — der `live=`-Sensor luegt nur, WAEHREND eine Suite laeuft).
- Claude Code steht auf **2.1.257** (Native-Install, Auto-Updater lief 2026-09-01 19:58). `claude
  update` sagt "up to date". **Es gibt kein Opus 5.1** — die installierte Binary kennt als neuestes
  `claude-opus-5` / `claude-opus-5[1m]`. Owner hat danach gefragt; Antwort steht, kein offener Punkt.

## 2. Gelandet & selbst verifiziert

**`e9c10ee` (Task 4908a900, Codex-Update-Prompt)** — zwei Commits, ein Land:
`c83969d` (Erkennung) + `e9c10ee` (Review-Rueckbau). Land-Note: `verify.ok true`, volle Kette,
7 Schritte, 96 s, `waitMs 0`, `exitCode 0`.
- Inhalt: der blockierende Codex-Update-Schirm ist ein BENANNTER blocked-Screen ("codex update
  prompt"); `-c check_for_update_on_startup=false` auf frischer UND resume-Spawnform; zwei neue
  e2e-Checks (Menue -> named requeue, Banner+Marker -> zugestellt) plus zwei Pins.
- **Was ICH nachgeprueft habe statt zu glauben:** (a) den Recherche-Beleg nicht in Release Notes,
  sondern in der INSTALLIERTEN Binary — `strings .../codex-darwin-arm64/.../bin/codex` findet
  `check_for_update_on_startup` 19x in der serde-Feldliste von `struct ConfigToml with 96 elements`;
  (b) `bun e2e/pins.ts` ALL PASS und die Gate-tsc exit 0, von mir im Lane-Worktree gefahren;
  (c) die Readiness-Klassifikation mit den LIVE aus server.ts gelesenen Regexes gegen drei Schirme.
- **Der Review-Befund, der den zweiten Commit ausgeloest hat:** die Lane hatte `paneReadiness` global
  auf accept-first gedreht (Marker schlaegt Blocks). Das kippt die Fehlrichtung von fail-safe auf
  **fail-open** — ein kuenftiger Blockschirm, der den Header mitrendert, bekaeme den Brief gepastet.
  Und die Drehung kauft NICHTS: die Block-Regex verlangt `Update now \(runs` UND `Skip until next
  version`, der Banner-Text hat beides nicht, also klassifiziert blocks-first ihn ohnehin als ready.
  Mein Beleg, den die Lane nicht hatte — ein selbstgebauter Trust-Schirm MIT Header:
  `{"prompt":"blocked:codex update prompt","banner":"ready","trustWithHeader":"blocked:codex trust prompt"}`.
  Unter accept-first waere die dritte Zeile `ready` gewesen.

## 3. In Flug — das Erste, was du tust

1. **Audit-Watch NEU ARMIEREN** (Watches sterben mit meinem Slot): `e9c10ee`, also
   `POST /api/self/watch {"kind":"audit","repo":"/Users/owner/claude-fleet","mainAfter":"e9c10ee4facff2a64dd8ce1bfe0a2065ac9463aa"}`.
   Meiner (`d1efc8c6`) war beim Schreiben armed und ungefeuert.
2. **Slot 10 / `8cd6deca` laeuft und hat einen ENTSCHEID von mir schriftlich.** Die Lane kam mit
   `needs-main` zurueck (Brief-STOPP korrekt ausgeloest) und ich habe entschieden statt zu
   eskalieren — der Brief hatte das Alternativ-Design vorautorisiert. Der Entscheid, den sie baut:
   `PROGRAM_MAX_PENDING` (5) zaehlt nur noch `kind==="auftrag"`, PLUS ein NEUER Deckel
   `PROGRAM_MAX_PENDING_ADVISORY` (Default 10) ueber notiz/richtung/betrieb; beide 409 nennen Zahl
   UND Art; der Rechnungs-Absatz `server.ts:3117-3128` wird EHRLICH neu geschrieben (16x15=240,
   und warum die MAX_TASKS-Gegenueberstellung schon vorher eine Reserve war); Lockstep
   `e2e/security.ts` + `docs/self-api.md`; drei Fixtures inkl. einer, die den neuen Deckel als SICH
   SELBST beweist; ZWEI getrennte Mutationsbeweise.
   - **Die Lesekorrektur, die den Entscheid traegt** (sie stand einen Satz zu kurz): die Lane hielt
     die 16x5-Rechnung fuer eine Garantie. Der Kommentar sagt zwei Zeilen darueber selbst
     *"That is a margin, not a new guarantee"*, und `capTasks` (`server.ts:2899-2902`) evictet
     AUSSCHLIESSLICH terminale Rows — `MAX_TASKS` hat pending Rows nie begrenzt.
3. **Slot 9 rettet die Trail-Namen** (siehe §4b). Antwort stand bei Uebergabe aus.
4. **Dann P2 dispatchen, SERIELL, nicht beide:** `9825cfd9` (Teil A) zuerst, `63a32ac2` (Teil B)
   erst DANACH — Teil B's Brief traegt eine harte Reihenfolge-Vorbedingung auf A (beide fassen
   `CLIENT_ONLY_FILES` an). Beide `queued`, beide `source:owner`, beide brauchen Hand-Dispatch.
   Vorschlag `claude` / `claude-opus-5[1m]` / `high` (Urteilsanteil hoch, siehe Briefe).
   **UND: nicht dispatchen, solange ein Post-Land-Audit laeuft** — Begruendung in §4a.

## 4. Drei neue P6-Befunde, alle gemessen, alle als Queue-Zeile abgelegt

- **(a) `0ac22a00` — Stufe 2 hat EIN Budget fuer Warten UND Arbeiten, der Land-Gate hat zwei.**
  Gemessen am Audit von `3974883`: `unknown`, `ms=1800251`, `exitCode null`, und in der out-Spur
  *"[suite-lock] waiting 849s ... acquired after 879s"*. Nach 879 s Mutex blieben 921 s von 1800 s;
  ein echter Lauf braucht ~680-700 s, unter Doppellast mehr. `POSTLAND_AUDIT_TIMEOUT_MS` ist bei
  `server.ts:14066` EIN setTimeout um den ganzen Spawn, und der Mutex-Wait liegt darin.
  Der Gate trennt das seit `08dc17a` (`FLEET_VERIFY_TIMEOUT_MS` / `FLEET_VERIFY_WAIT_MS`).
  **Eigener Anteil, damit die Zeile nicht wie hoehere Gewalt liest:** die Kontention war meine —
  zwei Lanes parallel, beide mit "Tier-2-Vorschau ist Pflicht" gebrieft. Daraus die Betriebsregel
  oben: keinen Lane-Dispatch neben einen laufenden Audit stellen.
  **Konsequenz: `3974883` und `4243394` haben KEIN Stufe-2-Verdikt.** Ich habe bewusst keinen
  Nachlauf gestartet (das waere derselbe Fehler nochmal).
- **(b) `6d2a4d4b` — der Land-Gate, der wirklich laeuft, ist nicht der, den die Pins vergleichen.**
  `watchdog.sh:91`, `AGENTS.md` und `CLAUDE.md` haben `src/helper.ts` in der tsc-Liste, `RULE_VERIFY`
  vergleicht genau diese Quellen, Pin gruen. Die Land-Note von `e9c10ee` zeigt eine Liste OHNE
  `src/helper.ts`. Aufloesung: `.env` traegt `FLEET_VERIFY_CMD_REPOS` mit einem Eintrag fuer
  `/Users/owner/claude-fleet` SELBST, und der gewinnt ueber die globale Kette. Live-vs-Note-Diff:
  **genau ein Token**. Der srv-Env HAT `src/helper.ts` — watchdog.sh ist also aktuell, das Land
  faehrt trotzdem den Repo-Eintrag. `.env` ist gitignored, `rg` findet ihn nie; `./state.sh` zeigt
  `FLEET_VERIFY_CMD live=[` abgeschnitten. **Nicht eigenmaechtig gefixt** — die `.env`-Korrektur
  aendert das Live-Gate fuer JEDES Repo und braucht einen srv-Neustart: Owner-Entscheid. Der
  zweite Teil ist der wichtigere: ohne einen Pin ueber den EFFEKTIVEN Befehl
  (`GET /api/self/gate` liefert ihn) faellt es beim naechsten Ketten-Edit wieder auseinander.
- **(c) Das Muster hinter (b):** `src/helper.ts` kam als DRITTES Bundle dazu, und drei Stellen haben
  es nie gelernt — die Gate-Liste (b), `server.ts#CLIENT_ONLY_FILES` (:21272, fehlt -> `deployGap`
  meldet `codeBehind:true` fuer ein reines helper-Land) und `server.ts#BUNDLES` (:21320, fehlt ->
  `bundleStale` stat't `public/helper.js` nie, also ein FALSE FRESH). Die letzten beiden sind in
  **P2a (`9825cfd9`) schon ausgeschrieben gebrieft**, mit Belegen.

## 5. Die Remote-Audit-Front

- Vierter namenloser Remote-Rot: `54964d1`, 7 FAILURES, `checks:null`, adjudiziert `unknowable`.
  Serie in zeitlicher Ordnung: **05f37f1:10 · 3058556:10 · 86e704a:7 · 54964d1:7**. Das sieht nach
  zwei stabilen Mengen aus, nicht nach Zufall — **Hypothese, kein Befund**, ohne Namen nicht
  entscheidbar. Gegen einen Regress spricht: jedes Land `verify.ok true`, jeder Baum lokal ALL PASS.
- **Der Ausweg, den ich gefunden habe: die Namen existieren HEUTE, ohne Daemon-Update.** Jede rote
  Zeile traegt eine `trail:`-PASS-Zeile mit dem ABSOLUTEN Pfad der Trail-Datei auf dem Geraet:
  `/var/lib/fleet-helper/work/run-26ea1a205005-<ts>/tree/e2e-trail/isolated-<stamp>.jsonl`
  (1788242397347 · 1788247717610 · 1788256153717 · **1788277962460**, je 3358-3366 rows).
  An Slot 9 geschickt mit der Bitte, ZUERST die Retention zu pruefen — das ist das Einzige mit
  Zeitdruck, die `run-*`-Verzeichnisse verfallen von selbst. Wenn nur eine zu retten ist: die letzte.
- Der Daemon-Update (git pull + systemctl restart fleet-helper auf >= `3974883`) bleibt sinnvoll,
  ist aber nicht mehr die Voraussetzung fuer die Antwort.

## 6. Ehrlichkeiten & Reste

- **Watches sterben mit meinem Slot.** Bei Uebergabe armed: nur `d1efc8c6` (Audit auf `e9c10ee`).
  Vier andere sind gefeuert. Neu armieren, siehe §3.1.
- **Slot 10s Report ist an MEINEN Slot adressiert** (`receiver.slot 1`). Kommt er nach der
  Nachfolge, pruefe `GET /api/self/fleet-report` und die Events der Nachfolgerin — ich habe NICHT
  verifiziert, wie ein Report auf einen retirten Receiver reconciled wird. Das ist eine offene
  Unbekannte, keine Behauptung.
- Queue-Stand: 2 auftrag queued (P2a/P2b) · 1 auftrag sent (8cd6deca, Slot 10) · 7 notizen pending
  (davon **5e79be26** in W3 miterledigt und **d2335500** durch `3974883` erledigt — beide vom Owner
  schliessbar; af8dd29c, 39fbbd1f, d07646bc, 0ac22a00, 6d2a4d4b offen) · 1b677e58/ff535524
  Feature-Freeze-geparkt · b0ad8a79 fremdes Program (Slot 5, nicht anfassen).
- Kein Deploy noetig/gefahren: das Land ist server.ts-beruehrend, aber ich habe **nicht** deployt —
  der Live-Server faehrt weiter `3974883`. **Das ist eine offene Entscheidung fuer dich**: `e9c10ee`
  aendert `paneReadiness` und die Codex-Spawnzeile, wirkt also erst nach einem Deploy (Verb 2,
  `POST /api/deploy`). Vorher pruefen, dass kein Audit laeuft — Verb 2 lehnt dann mit 409 ab.
- `bundleStale.stale:false` und `deployGap.codeBehind:false` beim letzten Ablesen (vor dem Land).
- Maschinen-Hygiene unberuehrt gelassen: 2 leaked e2e-Sockets, 1,4 G TMPDIR-Scratch. Reapen waehrend
  laufender Suiten ist der gefaehrliche Zug, nicht der ordentliche.
- ctx bei der Uebergabe-Entscheidung: **27 % gemessen** (269666/1000000) am eigenen Slot im
  Owner-Poll. Restkette danach: Handoff schreiben + committen + succeed.

---

# HANDOFF — Generalsanierung: P1 KOMPLETT (W1-W4), drei P6-vorgezogene Fixes, Codex-Update-Falle geloest, 2026-09-01 (nachmittags)

Program **`b2a14b545fd31fd71ba7b9e1`** aktiv, gebunden. Ersetzt den Morgen-Abschnitt darunter.

## 1. Autoritaet & Betrieb (neue Owner-Entscheide dieser Session)

- **Owner-Sanktion (Chat, nachmittags): die drei operativen Issues "vernuenftig angehen und aufloesen",
  ausdruecklich auch der Codex-Bug.** Operative Form: P6-VORGEZOGENE Fixes, je eigenes Kriterium +
  eigener e2e-Check (die Form, die das Program fuer Verhaltensaenderungen vorsieht). Feature-Freeze
  im Uebrigen unveraendert.
- Self-Land-Promotion steht auf **green-only**; alle Lands dieser Session actor main, confirmed false.
- Master-Stop bleibt AN; Weg unveraendert file -> release -> Hand-Dispatch (Body {} oder mit
  {harness,model,effort}).
- **Owner-Wunsch offen: Codex-UPDATE selbst (0.147->0.152)** — bewusst NICHT ausgefuehrt (npm install
  -g ist Owner-Akt). Bis dahin gilt der persistierte Skip (unten).

## 2. Gelandet & verifiziert (Kette seit b20e7e4)

3058556(docs, DIREKT) -> 79fcb0c(docs, DIREKT) -> 86e704a(**W3** Pin-Haertung) -> 3c271f8+54964d1
(**W4**, ein Land, zwei Commits) -> [Slot-10-Land, §NACHTRAG]. Jedes Land verify.ok true, volle Kette.
Die zwei Direkt-Commits sind land-unsichtbar (kein Ledger); Verifikationsweg steht in ihren Bodies.
- **P0-Baseline GESCHLOSSEN** (openQuestion 1): 3x seriell ALL PASS 3375/3375/0 FAIL auf 3058556,
  neben acht lebenden Sessions. Messnotiz docs/messungen/p0-baseline-generalsanierung-2026-09-01.md.
- **W3 (86e704a)**: tote-Doc-Pfad-Klasse als Pin (Erfolgsmass 3 mechanisch zu) · Kopier-Guard
  rekursiv ueber git ls-files · Ein-Datei-Universen -> serverU/clientU-Modul-Mengen, "Anker nicht
  gefunden" ist ueberall FAIL · Kreuz-Modul-Stolperdraht (liest die Anker-PAARE aus pins.ts selbst;
  heute 0, nach dem ersten P4-Slice nennt er die umzuhaengenden Zeilen) · LC_ALL=C an allen
  Harness-lstart-Lesern + Pin ueber die abgeleitete Menge. ICH habe 5 Mutationsbeweise unabhaengig
  in einem Scratch-Worktree reproduziert, nicht der Lane geglaubt.
- **W4 (3c271f8+54964d1)**: Kommentar-Commit mit BUILD-HASH-BEWEIS (von mir reproduziert:
  main und 3c271f8 beide e479d1236a9b7058..., byte-identisch, bun 1.3.9) — das ist die Blaupause
  fuer P3. Dann WorkerRoute + dossier-branch-Param entfernt (unused-tsc auf server.ts allein:
  2 -> 0, von mir reproduziert). P1-W4-Punkt "Eval-Gate-Reste": abgeleitet, zwei stale
  runWorker-Kommentare korrigiert; BEFUND der Lane, ungefixt: clarify-prompt.ts#buildClarifyBrief
  nimmt evalReason, aber KEIN Aufrufer uebergibt ihn — toter Block, P6-Kandidat.

## 3. Die drei Issues — Zustand JETZT

- **(a) Codex-Update-Falle: DIAGNOSTIZIERT + operativ zu.** codex 0.147.0 blockiert beim Spawn auf
  einem Update-Prompt (vorselektiert: "Update now" = npm install -g!); paneReadiness kennt den
  Screen nicht -> generischer 20s-Requeue (2x an W4 bezahlt). Von mir mit "3 Skip until next
  version" beantwortet (persistiert, per Respawn bewiesen: danach Banner NEBEN Ready-Marker);
  Dispatch end-to-end wieder ok (Slot-10-Lane lief auf codex). READY_WAIT_MS ist NICHT die
  Ursache — nicht hochdrehen. Haertung als Queue-Zeile **4908a900** (blocked-Screen mit Namen +
  Recherche config-Unterdrueckung + e2e). NAECHSTE Codex-Version reisst das Loch sonst wieder auf.
- **(b) Remote-Audit-Blindheit: FIX GELANDET als 3974883 und deployt** (§4.1): Daemon schickt FAIL-Namen
  aus dem Trail (50x300 bounded), helperResult validiert fail-closed, postLandAuditChecks
  korroboriert nur bei exakter Laenge, alter Body = alter Pfad. **OPS DANACH OFFEN: der
  Second-host-Daemon selbst laeuft noch alt** — Update des Geraets ist ein Einzeiler (git pull +
  systemctl restart fleet-helper), gehoert Owner oder Slot 9. Bis dahin bleiben Remote-Rots
  namenlos. Semantik-Nebenton: auf korroborierten Remote-Zeilen heisst checks.ran "im Tail
  verbuchte Zeilen", nicht "gefahrene Checks" — bewusst gelandet, P6-Politur falls es je verwirrt.
  DREI heutige Remote-Rots (05f37f1, 3058556, 86e704a: 10/10/7 FAILURES) alle adjudiziert
  unknowable; derselbe Baum lief lokal jedes Mal ALL PASS. Frage nach den 7 Namen liegt bei
  Slot 9 (gesendet 3f3bef64, Antwort stand bei Uebergabe aus).
- **(c) Filing-Cap: BRIEF GEFILED** (**8cd6deca**, queued): Deckel soll nur kind=auftrag zaehlen —
  heute sperren 5 nie-releasebare notizen die Selbst-Tuer dauerhaft (409 an W4 gemessen; W4 lief
  deshalb ueber die Owner-Tuer, source:owner, programId-Link haelt; /api/self/tasks/<id>/land
  funktionierte darauf normal).

## 4. Naechste Zuege, Reihenfolge

1. NACHTRAG, alles erledigt: **Slot-10 IST GELANDET als 3974883** (Rebase auf 54964d1 sauber,
   verify.ok true, actor main). **Deploy 2e614038 via Verb 2 GEFAHREN und vom naechsten Boot
   bestaetigt**: ok:true, hitTarget:true, bootHead=head=3974883, bundleStale:false, deployGap 0 —
   der Live-Server faehrt beide Lands. Audit-Watches c1d804f1 (54964d1) + 99af3f9a (3974883)
   haben den srv-Neustart ARMIERT ueberlebt (an GET /api/self gemessen) — sie sterben erst mit
   MEINEM Slot: die Nachfolgerin armiert beide neu und beurteilt die Audits nach Check-Ebene;
   Remote-Rots koennen jetzt erstmals NAMEN tragen, aber nur wenn vorher §4.3 (Daemon-Update)
   passiert ist — sonst weiter unknowable-Muster wie §3b.
2. Die zwei queued Briefs dispatchen, wenn Lane-Deckel frei: **4908a900** (codex-Haertung),
   **8cd6deca** (filing-cap). Beide owner-source, Hand-Dispatch noetig (Master-Stop).
3. Second-host-Daemon-Update anstossen (Ops, siehe 3b) — danach liefert der NAECHSTE Remote-Audit
   Namen, und die unknowable-Serie endet.
4. **P2 Vor-Split-Haertung** (Plan §P2): frisches Fenster, voller Kontext. Davor Fenster-Checkliste
   des Plans §Entscheide 4/5 pruefen (auto-③ ist seit be3b21e aus — nachpruefen, nicht glauben).
5. P3 mit der W4-Blaupause (Build-Hash-Beweis) briefen; die ~11 Kommentar-Anker-Pins in den Brief.

## 5. Ehrlichkeiten & Reste

- Bei Uebergabe armiert: Audit-Watches c1d804f1 (54964d1) + 99af3f9a (3974883); beide Merge-
  Watches sind gefeuert (dead/sent). Watches sind slot-gebunden und sterben mit meinem Slot —
  die Nachfolgerin armiert die zwei Audit-Watches NEU (§4.1).
- Queue-Stand: 4908a900 + 8cd6deca queued (arbeit) · 5 notizen pending (5e79be26 Locale in W3
  MITerledigt — die Zeile kann der Owner schliessen · af8dd29c reviewInflight-P6 · d07646bc
  Second-host-Ausbau · d2335500 durch Slot-10-Land ERLEDIGT sobald gelandet — schliessbar ·
  39fbbd1f server-lstart-P6) · 1b677e58/ff535524 Feature-Freeze-geparkt · b0ad8a79 fremdes Program.
- Rulebook-Nachzug dieser Session (gitignored, committet nur als Fragment-Text im
  rulebook/-Verzeichnis): lane-discipline §11.2j/k auf REPARIERT. CLAUDE.md re-rendert, pins gruen.
- Owner hat /model auf Fable 5 gestellt (Terminal-Kommando, betrifft NEUE Sessions — die
  Supervisor-Regel "Opus 5 high" fuer die 🧿-Rolle ist davon unberuehrt, mein Slot lief auf Opus).
- ctx bei Uebergabe: siehe succeed-Report; Band eingehalten (26,4 % gemessen beim Entscheid,
  Restkette = 2 Lands + Deploy + Handoff, vorher angekuendigt).

---

# HANDOFF — Generalsanierung: P1 W1+W2 gelandet, beide Flake-Reparaturen gelandet/im Land, Autonomie + Remote-Audit live, 2026-09-01

Program **`b2a14b545fd31fd71ba7b9e1`** aktiv, gebunden. Ersetzt den 2026-09-01-Abschnitt darunter.

## 1. Autoritaet & Betrieb (Owner-Entscheide dieser Session, alle ausgefuehrt)

- **Volle Autonomie**: Owner woertlich "bitte geh dies nun an und fixe auch solche berechtigungsprobleme.
  Der gesamte plan sollte am besten komplett autonom laufen soweit." → self-land promotion am Program
  (Stufe siehe §3-Nachtrag unten), Lands laufen ueber POST /api/self/tasks/<id>/land, actor.kind=main.
- **suite-offer PROMOVIERT** (unter derselben Delegation, Rueckfalltuer = Zeile zurueckdrehen):
  rulebook/lane-discipline.md traegt die Regel (180 s frei / 800 s gehalten, Pin ist von SKIP auf PASS
  geflippt). Ab jetzt in jedem Brief mit isolated-Vorschaulauf: Portal-Offer statt lokal; AUSNAHME
  Flake-Beweislaeufe (bleiben lokal).
- **Second-host ist als Helfer LIVE**: fleet-helper.service enabled+active (Setup 29.08. ueberlebt Boots),
  Device secondhostlinux1 active/active, Grace 60 s. ERSTER Remote-Audit gelaufen (05f37f1, 22 min,
  echter Lauf mit remote.clonedSha). Owner-Wuensche festgehalten: Suite-Lauf-Anzeige prominenter +
  Second-host vollwertig (notiz d07646bc; vollwertig = Dual-Host-Program, nicht wir). MacBook-Helfer:
  Rezept an Owner geliefert, Entscheid offen — Second-host-Anlassen reicht.
- Master-Stop bleibt AN; Weg: file → release → Hand-Dispatch POST /api/tasks/<id>/dispatch (Body {}).
- Quiet-Hours blockieren Attention-ANTWORTEN. Attention 7ccd9557 inhaltlich erledigt (Promotion), formal
  offen; fremde offene (79839393, db2d6c85) nicht anfassen.

## 2. Gelandet, alles selbst verifiziert

main-Kette seit b43b5ad: bbd2cc5(docs) → ff5b813(**W1**) → 61155ae(docs) → 70dfc53(**W2a**) →
ba4169a(**W2b**) → ece76e2(docs) → 05f37f1(**§11.2k-Fix**) → [Slot-10-Land, §3]. Alle Lands verify.ok
true, volle Kette. Docs top-level 105→31, attic traegt ~150+ Dateien, tote Doc-Pfade 17→0 (Filter als
Kommando in docs/sanierung-2026-09/w2-filter.md — Erfolgsmass 3 misst mit GENAU dem). Deploys nach jedem
server-beruehrenden Land, je am Owner-Poll verifiziert; NACH DEM SLOT-10-LAND KEIN Deploy noetig (e2e+docs).
Host-Schritte: 7 Secret-Symlinks weg; rulebook 4× nachgezogen (steward-arena-Pfad, 3 Zeilenrefs→Symbol,
core-program→attic-Pfad, suite-offer-Regel, Familienzahl "Dreizehn") — alles gitignored, kein Commit.

## 3. Die Flake-Front — der eigentliche Ertrag der Nacht

- **§11.2j MECHANISMUS ISOLIERT** (war "Diskriminator nicht isoliert"): server.ts#tickWatches persistiert
  status=send-uncertain + attempts++ VOR dem tmux-Roundtrip und rollt erst nach SendRefused zurueck —
  die Fixtures sampelten den Transienten. Acht Mitglieder. Lane ed248c15 (Schnitt 1: sechs Fenster messen
  ihre Vorbedingung; Schnitt 2: settleEvent wartet Transienten bounded aus). Beweis: 3 serielle Laeufe,
  alle 8 Mitglieder gruen, Transient feuerte bei load 4.44 und wurde absorbiert; die 2 Rots der Serie
  waren §11.2k auf dem VOR-Fix-Baum. needs-main von mir adjudiziert: Substanz akzeptiert.
  **Slot-10-Land-Stand: Rebase-Konflikt docs/verify-tiering.md → Author-Pfad hat aufgeloest (Pane
  gelesen, sauber), guarded-Confirm von mir genommen (Non-Goal verbietet Confirm nur fuer SPLIT-Slices).
  Ausgang siehe Nachtrag unten. DANACH PROMOTION ZURUECK AUF green-only** (war beim Schreiben guarded).
- **§11.2k REPARIERT, test-seitig** (05f37f1): outcomes 9b wartet auf die PERSISTIERTE Review-Wirkung.
  Echter Server-Bug dahinter als P6-Prio-notiz af8dd29c: teardownSlotOccupant loescht reviewInflight
  nicht → Klick joint Waisen-Job, schreibt nichts. Ein-Zeilen-Fix, Verhaltensaenderung = P6.
  Ein 9b-Rot ist ab jetzt wieder ECHT (oder die Vorbedingungs-Sonde benennt sich selbst).
- **NEUE Plattform-Familie Second-host**: Suite-Lock-Geburtsidentitaets-Sonde ist LOCALE-abhaengig
  (de_DE-Debian, 'Di Sep 1', identityProven:null, 10 Checks geschlossen). Audit 05f37f1 = stale-test.
  Fix-notiz 5e79be26 (LC_ALL=C + Baseline-Doc nachtragen). Bis dahin: Second-host-Rot dieser Signatur =
  Plattform, kein Befund.
- **Adjudikationen**: 01459c9 flake (§11.2j, 7. Mitglied registriert) · ff5b813 flake (§11.2k als 13.
  Familie, Direktbeweis) · 70dfc53 flake (4×§11.2j+§11.2k) · ba4169a flake (8. Mitglied held/pre-paste)
  · 05f37f1 stale-test (Locale). §11.2i viermal gesichtet (unveraendert offen).
- **P0-Baseline: OFFEN.** §11.2k fiel 2× binnen 3 konsekutiven Laeufen (vor dem Fix). Jetzt, wo BEIDE
  Reparaturen gelandet sind: die naechsten 3 konsekutiven seriellen Laeufe (Audits zaehlen; loadavg je
  Lauf protokollieren) auf Check-Ebene beurteilen → Messnotiz docs/messungen/ → openQuestion 1 zu.

## 4. Naechste Zuege, Reihenfolge

1. NACHTRAG, alles erledigt: **Slot-10-Land IST GELANDET — main = b20e7e4** (verify.ok true, actor
   main, guarded-Confirm auf die Author-Aufloesung; Note traegt die Resolution). **Promotion steht
   wieder auf green-only** (geprueft). Audit-Watch 919cc3e7 war armiert, STIRBT mit meinem Slot —
   NEU armieren ({"kind":"audit","mainAfter":"<b20e7e4 voll>"}) und den Audit nach Check-Ebene
   beurteilen; kann Second-host-claimed sein: erst remote/Locale-Signatur pruefen (§3).
2. Rulebook-Nachzuege NACH dem Land (Fragment lane-discipline): §11.2j "isoliert, acht Mitglieder,
   repariert in <land-sha>" · §11.2k "repariert in 05f37f1, 9b-Rot wieder ECHT". Re-Render + pins.
3. Baseline schliessen (§3 letzter Punkt).
4. **W3** (Plan §W3 + Reparatur 4: "alle stage_instance-Aufrufer"; + notiz 5e79be26 Locale-Pin passt
   thematisch dazu) → **W4** (Reparatur 3: --noUnusedLocals auf server.ts allein) → P2.
5. P4/P5-Briefs: suite-offer-Regel steht im Rulebook; Fenster-Checkliste (auto-③ ist AUS seit be3b21e).

## 5. Ehrlichkeiten

- Slot-10-Land ist gelandet (b20e7e4, Nachtrag in §4); alle meine Watches sterben mit dem Slot —
  nur der b20e7e4-Audit-Watch muss neu armiert werden, sonst ist nichts in Flug.
- Direkt-Commits dieser Session (land-unsichtbar, Body = Beleg): bbd2cc5, 61155ae, ece76e2.
- W2b-Lane-Report enthielt einen Irrtum (rulebook nenne core-program nicht) — von mir korrigiert; die
  §11.2j-Lane korrigierte MEINE 8.-Mitglied-Deutung (Transient, kein Pane-Ersatz). Beides eingearbeitet.
- Owner-Fragen dieser Nacht beantwortet: GitHub-CI (abgelehnt, Begruendung im Transkript), Zeitplan
  (~22–30 h Restplan), MacBook-Helfer (+2–4 h, Rezept geliefert).
- ctx bei Uebergabe: ~37–39 % gemessen. Kontextband eingehalten (25 % Vorbereitung, danach nur Restkette
  + Owner-Antworten).

---
# HANDOFF — Generalsanierung: Entscheide ausgefuehrt, 8d97 gelandet, W1-Brief liegt bereit, 2026-09-01

Program **`b2a14b545fd31fd71ba7b9e1`** aktiv, gebunden. Dieser Abschnitt ersetzt inhaltlich den
Abschnitt vom 2026-08-31 direkt darunter (dessen offener Entscheid ist GEFALLEN); die Mess-Tabelle
und die Widerlegungen dort bleiben gueltig.

## 1. Owner-Delegation 2026-09-01 und die sechs ausgefuehrten Entscheide

Owner woertlich: "Bitte ueberleg hier selber gut was sinn macht und dann geh diese an" — auf die
sechs vorgelegten Entscheide. Protokolliert als datierter Abschnitt im Plan-Nachtrag (`be3b21e`).
Die Kurzform: **(1) Erfolgsmass 5 gilt jetzt auf CHECK-Ebene** (Lauf gruen, wenn jeder FAIL zu
einer registrierten Familie gehoert; Baseline zu, wenn ueber 3 konsekutive Laeufe kein Check
ZWEIMAL faellt; unregistrierter FAIL = Lauf rot) · (2) keine Ruhigstellung fremder Sessions fuer
P1; stilles Fenster bleibt P4/P5-Vorbedingung · (3) 8d97 als begruendete Freeze-Ausnahme gelandet
· (4) auto-③ fuer die Programmdauer aus · (5) Rulebook-Familienzahl nachgezogen · (6) keine
weitere Suite-Zeit fuer den §11.2j-Diskriminator.

## 2. Zustand, alles verifiziert (nicht behauptet)

- **8d97 GELANDET: main = `01459c9`** (feat: separate task workbench views), `fleet/land`-Note
  mit `verify.ok: true` ueber die volle Kette install→claude-gate. **ERSTER AKT DER NACHFOLGERIN:**
  Audit-Watch armieren — `POST /api/self/watch` `{"kind":"audit","repo":"/Users/owner/claude-fleet","mainAfter":"01459c9ef81dfac06dc1a999ac13e7f11c6e1583"}` —
  und ein Rot nach der NEUEN Check-Ebene-Regel beurteilen (§11.2j-Mitglieder einmal = Flake).
  Meine Watches sind mit dem Slot gestorben; nichts davon uebertraegt sich.
- **auto-③ aus, am Prozess gemessen**: Live-Server (die PID OHNE `FLEET_SOCK` in `ps eww`) traegt
  `FLEET_AUTO_REVIEW_MS=0`; watchdog.sh-Zeile committed (`be3b21e`), kickstart + Verb-2-Deploy
  gefahren, `deployGap` 0, `bundleStale` false. NIE an `./state.sh`s `live=`-Spalte pruefen,
  solange eine Suite laeuft.
- **Rulebook**: Fragment `rulebook/lane-discipline.md` sagt jetzt "Zwoelf bekannte
  Flake-Familien" (+§11.2i/+§11.2j), `CLAUDE.md` daraus gerendert (71497 B), pins ALL PASS.
  Beides gitignored — es gibt dazu KEINEN Commit; bei Drift-Verdacht neu rendern (Kommando im
  Kopf von `rulebook.ts`).
- **§11.2j-Mechanismus eine Ebene tiefer** (`43b389e`): Event erzeugt, unmittelbar danach wird
  die Empfaenger-Pane ZWEIMAL neu erzeugt (`fleet-e2e-instance-4110/server.log:135-142`);
  `recoverFleetReportDelivery` terminalisiert korrekt. Gattung §11.2f. Der plausible Fix ist
  TEST-SEITIG und darf als Lane mit eigenem Kriterium vor P6 laufen (Entscheid 6).

## 3. Naechste Zuege, in dieser Reihenfolge

1. Audit-Watch fuer `01459c9` armieren (oben). Der Audit belegt den Suite-Mutex ~26 min.
2. **W1 starten**: fertiger Brief liegt WOERTLICH in
   `/private/tmp/claude-501/-Users-owner-claude-fleet/c05b5a9a-bc21-4de6-b9f8-cf274cc9413c/scratchpad/w1-brief.txt`
   (lesbar; die Scratchpads der Vorgaenger bleiben auf Platte). Weg: `POST /api/self/tasks`
   (kind auftrag, harness claude, model claude-opus-5[1m], effort high) → release →
   **Hand-Dispatch `POST /api/tasks/<id>/dispatch`** (Master-Stop bleibt AN per Program-Intent;
   der Hand-Knopf ist der vorgesehene Bypass). W1-Land NICHT parallel zum laufenden Audit-Gate
   erzwingen — das Gate wartet ohnehin am Mutex (waitMs 2.700.000, ein waitedOut ist nie ok:false).
3. Danach die **§11.2j-Fixture-Fix-Lane** (test-seitig, eigenes Kriterium: die vier
   watch.ts-Mitglieder ueberleben 3 serielle gruene Laeufe bzw. die Sonde scheitert als sie
   selbst, wenn die Empfaenger-Pane starb).
4. **P0-Baseline unter der neuen Regel schliessen**: 3 serielle Laeufe, Urteil auf Check-Ebene.
   KEINE weiteren Diskriminator-Experimente (Entscheid 6). loadavg je Lauf protokollieren.
5. Nach W1-Land der HOST-Handschritt: die UNGETRACKTEN lerntisch-Symlinks im Live-Checkout
   loeschen (einer zeigt auf `.env`) — Lane kann das nicht.

## 4. Ehrlichkeiten

- Heute/gestern liegen ACHT Direkt-Commits auf main (60dec47, ce24b0d, a1615be, dc75c32, 5cef1b7,
  08689e1, be3b21e, 43b389e + Handoffs) — fuer land-seitige Ledger unsichtbar; `./state.sh`
  untertreibt entsprechend. Verifikation je Commit steht im jeweiligen Body.
- Die P0-Baseline ist NOCH NICHT geschlossen — erst Schritt 4 oben schliesst sie.
- Attention `db4f7f08` steht formal noch offen am Board; inhaltlich ist sie durch die Delegation
  entschieden (Weg A). Beim naechsten Owner-Kontakt schliessen/erwaehnen.
- Slot-Datensatz dieser Session traegt model+effort korrekt; Succession erbt mechanisch
  (`succeedSupervisor` reicht `s.model`/`s.effort` durch). Effort-Bestaetigungszeile trotzdem
  im ersten Zug zitieren, wenn du sie setzt.

---

# HANDOFF — Generalsanierung: P0 gemessen, Erfolgsmass 5 als unerreichbar belegt, EIN Owner-Entscheid offen, 2026-08-31

Program **`b2a14b545fd31fd71ba7b9e1`** („Generalsanierung 2026-09") aktiv, gebunden an Slot 10.
Dieser Abschnitt ist NEU und oben angesetzt; nichts darunter wurde angefasst.

## 1. Was gelandet ist (alles Direkt-Commits, docs-only, fuer land-seitige Ledger unsichtbar)

`2cd464b` GLM-Review (Lane) · `60dec47` P0b-Adjudikation · `ce24b0d` Plan-Nachtrag ·
`a1615be` Baseline-Notiz (Gruendungs-Session) · `dc75c32` Flake-Familie §11.2j ·
`5cef1b7` Erreichbarkeits-Messung · `08689e1` §11.2j-Korrektur.

`./state.sh`s Land-Health untertreibt diesen Tag entsprechend um sechs Commits.

## 2. Der EINE offene Entscheid — Attention `db4f7f08`, kind `decision`

**Erfolgsmass 5 ("alle Suiten gruen, 3 serielle Beweislaeufe") ist an der gemessenen Rate nicht
erreichbar.** Zahlen in `docs/messungen/2026-08-31-baseline-erreichbarkeit.md`: 306 entschiedene
Post-Land-Audits (ein Audit IST ein Baseline-Lauf), 77,5 % gruen ueber alles, **57,5 % ueber die
letzten 40**, Bruch ab 2026-08-26. Daraus P(3 konsekutiv gruen) = 19 %, ~16 Laeufe je Erfolg,
~26 min exklusiver Suite-Mutex je Lauf ⇒ **~7 h serialisierte Maschinenzeit je Baseline**, zweimal
gefordert. Kein einzelner Fix hilft: 24 von 45 gezaehlten Roten fielen mit genau EINEM Check,
Signaturen gestreut.

Drei Wege liegen dem Owner vor; Empfehlung **A** (Kriterium auf CHECK-Ebene, Baseline geschlossen
wenn ueber 3 konsekutive Laeufe KEIN Check zweimal faellt — die Zweimal-Regel ist der
Missbrauchsschutz). **B** wuerde P1 reordern, deshalb wurde W1 NICHT begonnen.

## 3. P0-Messstand — sieben Laeufe, und was sie beweisen

| Lauf | HEAD | dirty | Controller | loadavg | Ergebnis |
|---|---|---|---|---|---|
| 1 | `6f173d7` | nein | noch nicht aktiv | — | ALL PASS 3349 |
| 2 | `00d9b58` | ja | arbeitet | — | RED 4 (Familie) |
| 3 | `acf3614` | ja | arbeitet | — | RED 5 (Familie) |
| 4 | `ce24b0d` | nein | untaetig | 1,53 | ALL PASS 3349 |
| 5 | `dc75c32` | nein | untaetig | 2,15 | RED 1 (`e2e/outcomes.ts`, NICHT die Familie) |
| 7 | `5cef1b7` | ja | untaetig | 2,39 | RED 5 (Familie) |

**Bewiesen:** Code-Delta ueber alle Laeufe null ⇒ Nicht-Determinismus nach §11.7 direkt bewiesen,
kein Regress. Neue Familie registriert als **`docs/verify-tiering.md` §11.2j** (sie fehlte dort).

**Zweimal widerlegt, beide Male von mir selbst zuerst geglaubt — nicht erneut aufmachen:**
- „Untaetiger Controller ergibt gruen": Lauf 7 feuerte die Familie bei untaetigem Controller.
- „Dirty Baum ist die Ursache": strukturell unmoeglich. `e2e-stage.sh` kopiert nur die
  Import-Huelle + `public/` + `package.json` + `$STAGE_EXTRA`; `e2e-isolated.sh:66-69` kopiert
  exakt VIER benannte `docs/`-Dateien; danach `git init && git add -A && git commit` ⇒ immer
  sauber beim Init. An der aufbewahrten Instanz `fleet-e2e-instance-4110` nachgeprueft.

**Offen und einziger numerischer Griff:** loadavg beim Start (1,53 gruen; 2,15 / 2,39 rot) — drei
Punkte, ein Hinweis, kein Ergebnis. Wer weitermisst, protokolliert loadavg je Lauf und argumentiert
NICHT mehr ueber den Baum. Unseziert: `fleet-e2e-instance-80791`, `-26770`, `-43515`, `-4110`.

## 4. Betriebszustand, gemessen (nicht aus state.sh's live=-Spalte!)

`dispatch=false` (Master-Stop AN) · `autosOn=true` · Tag `vor-generalsanierung`=`49038af` ·
echter Server = die PID **ohne** `FLEET_SOCK`; dort ist `FLEET_AUTO_REVIEW_MS` **ungesetzt**,
auto-③ laeuft also auf Default 15 s und ist vor dem ersten P4-Fenster noch auf 0 zu setzen
(+ `launchctl kickstart`). **`./state.sh`s `live=`-Spalte ist falsch, solange eine Suite laeuft**
(Befund A1, im Plan-Nachtrag als Checklistenpunkt) — ein suite-gespawnter Server hat `cwd` =
Haupt-Checkout und ueberschreibt die echten Werte.

## 5. Naechste Zuege, in dieser Reihenfolge

1. **Owner-Entscheid zu Erfolgsmass 5 abwarten** (Attention `db4f7f08`). P4/P5 bleiben bis dahin zu.
2. Danach W1 als Lane briefen — die Planreparaturen in `docs/sanierung-2026-09/plan-2026-08-31.md`
   §Nachtrag sind der verbindliche Text, NICHT die Tabelle darueber (704→1941, rulebook ≥15→4,
   392→393, ~324→329; `attic/`-Praefixe aus P2 nach W1 vorgezogen).
3. Nicht vergessen: `CLAUDE.md`s „Zehn bekannte Flake-Familien" ist jetzt ZWEI zu kurz (§11.2i war
   schon offen, §11.2j kommt dazu). Das ist ein Generat aus `rulebook.ts` — Fragment editieren und
   rendern, und es bleibt ein VORSCHLAG bis zur Owner-Promotion.

## 6. Was ich NICHT getan habe, und warum

- **W1 nicht begonnen** — Option B des offenen Entscheids wuerde genau das reordern.
- **Lane `fleet/260831133127-8d97` nicht angefasst** (Slot 2, done-looking, 1 sauberer Commit,
  3 Dateien inkl. `src/client.ts`). Sie gehoert Program `b9c1e0d9`, nicht diesem. Kosten des
  Wartens sind benannt: nach P5 ist sie nicht mehr rebasebar.
- **Keine „stille Maschine" behauptet.** Bei Lauf 4 waren 13 Agenten-Sessions lebendig, sieben in
  diesem Checkout. Herstellbar war nur: keine Nachbarsuite, sauberer Baum, Controller untaetig.

---

# HANDOFF — Generalsanierung gestartet: Program b2a14b54 auf Slot 10, Freeze aktiv, 2026-08-31

Owner-Entscheid 2026-08-31: das komplette Repo wird saniert. Dieser Abschnitt ist NEU und oben
angesetzt; nichts darunter wurde angefasst. **Die einzige Programmquelle ist
`docs/sanierung-2026-09/plan-2026-08-31.md`** (Commit `6f173d7`; Phasen P0–P7, Slice-Protokoll,
Fenster-Checkliste, Messbasis mit Ableitungs-Kommandos, P0-Ernteprotokoll) — dieser
Handoff-Abschnitt trägt nur, was git nicht trägt.

## Zustand bei Übergabe

- **Program „Generalsanierung 2026-09" `b2a14b545fd31fd71ba7b9e1` aktiv, MAIN gebunden auf
  Slot 10** (`claude-opus-5[1m]`, `effort high` — beides IM Slot-Datensatz, Spawn-gesetzt;
  Successions erben mechanisch korrekt). Ihre offenen Startaufgaben stehen im Gründungsbrief
  (openQuestions): GLM-Befunde adjudizieren VOR P1 · d70d-Promotion beim Owner · Fenster-Env vor
  erstem P4-Fenster.
- **Feature-Freeze + Dispatcher-Master-Stop aktiv** (`dispatch: false`); die zwei offenen
  Feature-Zeilen (`1b677e58`, `ff535524`) bleiben absichtlich pending bis P7.
- **Rollback-Anker: Tag `vor-generalsanierung` = `49038af`.**
- **P0b erledigt:** GLM-Gegenprüfung gelandet als `2cd464b`
  (`docs/messungen/2026-09-01-sanierung-plan-glm-review.md`, 10 gerankte Befunde; B1: die
  W2-Zahl 704 ist real ~1.936 → W2-Budget ~2,7×; B2: attic/→DOC_RULE muss aus P2 nach W1
  vorgezogen werden; B5: auto-③-Punkt der Fenster-Checkliste gegen den Code klären).
  Adjudikation = Program-MAIN, noch offen.
- **Worktree-Ernte abgeschlossen:** 26 → 1 (nur Slot-2-Lane `fleet/260831133127-8d97` lebt,
  Task `93fc5af2`, darf normal fertig landen). 11 Branches geshelvt (Liste im Plan-Dokument,
  §P0-Ernteprotokoll) — **darunter `fleet/260822143207-d70d`: unpromovierter
  AGENTS.md-Regelvorschlag „Waiting is event-driven", liegt dem Owner zur Promotion vor.**
  Geshelvte Branches sind nach dem Split nicht mehr rebasebar; Wert = P6-Referenz.
- **DIREKT-COMMITS dieser Session** (für Land-Ledger unsichtbar, Verifikation von Hand):
  `49038af` (Ernte, 2 Doc-Dateien) und `6f173d7` (Plan) — beide docs-only, nach beiden
  `bun e2e/pins.ts` = ALL PASS (DOC_RULE-Kette). `./state.sh`-Land-Zahlen untertreiben heute
  entsprechend.
- **P0-Baseline LÄUFT noch:** 3 serielle `./e2e-isolated.sh` (Start ~20:45, Lauf-Skript +
  Logs im Session-Scratchpad `baseline/`); Ergebnis gehört als Messnotiz
  `docs/messungen/2026-09-01-sanierung-baseline.md` committet. Main bewegte sich währenddessen
  einmal docs-only (`6f173d7`→`2cd464b`) — staged Suite-Inhalt identisch, im Protokoll nennen.
- **Betriebsbefund:** GLM läuft über Harness **`pi-zai`** (nicht `pi` — pi 0.84 kennt keine
  glm-Modelle; zwei ehrliche not-alive-Requeues bezahlt). pi-zai ist `automatable:false` →
  `/api/self/watch` lehnt ab; Rückweg = Hintergrund-Watcher auf clean+ahead.

## Nächste Schritte (Reihenfolge, Warum im Plan)

1. Baseline-Messnotiz committen (diese Session, sobald Läufe enden — sonst Program-MAIN).
2. Program-MAIN: GLM-Befunde adjudizieren, Plan-Korrekturen (B1/B2/B5) als datierten Nachtrag
   ins Plan-Dokument, dann W1 briefen.
3. Owner-Entscheid einholen: d70d-Promotion ja/nein.

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
