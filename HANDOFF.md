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
