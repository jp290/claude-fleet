# Triage-Batch E-harness — Harness, Isolation, Container, Worker-Modelle

**5 Zeilen.** Erzeugt 2026-08-09 aus `fleet.json` (gitignored — deshalb steht der Text hier).
Der Auftrag, das Urteilsvokabular und die Beweisregeln stehen in `docs/triage/README.md`. **Lies die zuerst.**

---

## `54af57d6`  ·  kind=lane  ·  angelegt 2026-08-08 11:51  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — Kein Done-Kriterium: die Zeile erklärt sich selbst zum "ZIELBILD, KEIN AUFTRAG" und schickt sich durch `▸ clarify first`; ihr erster Schritt ist ein offener SPIKE mit noch ungemessenen Fragen (greift Approval bei READS?), den keine Suite im Repo abnehmen kann. Zusätzlich reach: der Spike startet einen `codex app-server`-Daemon samt Websocket-Port auf dem Host unter der Codex-Anmeldung des Owners —
- Analyst sagt kollidiert mit: f85d1244, b634236c, fleet/260808114656-6e86
- Analyst-Blocker: ["criterion", "reach"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[harness, Zielbild] Der Codex app-server als ZWEITER Slot-Typ — und damit der erste Kontrollpunkt, an dem Fleet einem fremden Agenten etwas VERBIETEN kann.

OWNER 2026-08-08, woertlich: "aber koennte man es nicht trotzdem irgendwie ueber einen websocket oder sowas automatisieren?" — gefragt, nachdem `automatable:false` fuer Codex gesetzt wurde. Die Antwort ist ja, und sie ist besser als Automatisierung.

BEFUND, gemessen 2026-08-08 an codex 0.147.0 (nicht aus der Doku, sondern aus dem Binary):
  - `codex app-server` (experimental) ist ein Daemon mit einem SPEZIFIZIERTEN Protokoll: `generate-json-schema` liefert JSON-RPC-Schemata, die v2-Datei traegt 557 Definitionen; `generate-ts` erzeugt TypeScript-Bindings. Ein Bun/TS-Server kann das nativ sprechen.
  - `codex remote-control start|stop|pair` fuehrt denselben Daemon mit Fernsteuerung und kurzlebigen Pairing-Codes.
  - `codex --remote ws://host:port` haengt eine TUI an einen ENTFERNTEN app-server. Das trennt, WO der Agent laeuft, von dort, WO er bedient wird — und ist damit dasselbe Bauteil, das `29cd2610` (Repo auf der Main-Maschine, Container auf der Dev-Maschine) braucht.
  - `CommandExecParams` traegt Terminalgroesse/Resize, dazu Output-Delta-Notifications: ein solcher Slot koennte weiterhin wie eine Pane AUSSEHEN.

DER EIGENTLICHE FUND, und er ist der Grund fuer diese Zeile: das Protokoll stellt Sandbox- und Berechtigungsentscheidungen als ANFRAGEN AN DEN KLIENTEN — `CommandExecutionRequestApprovalParams`, `PermissionsRequestApprovalParams`, `FileSystemSandboxEntry`, `NetworkApprovalContext`. Heute setzt der Adapter `--ask-for-approval never`, weil eine PANE sonst an einer Rueckfrage haengenbleibt, auf die niemand antwortet. Ueber den app-server ist Approval kein Mensch an einem Dialog, sondern eine Anfrage, die der SERVER nach Regel in Millisekunden beantwortet — der Zwang zu `never` faellt weg. Damit koennte Fleet erstmals mechanisch sagen "nein, du liest ~/[privates Owner-Repo] nicht", statt darauf zu vertrauen, dass das Modell es nicht tut. Gemessen ist naemlich das Gegenteil (CLAUDE.md, 2026-08-08): `--sandbox workspace-write` ist ein Schreib-Zaun, kein Lese-Zaun.

DREI KOSTEN, die den Zuschnitt bestimmen und nicht wegdiskutiert werden duerfen:
  1. ALLES DAVON IST `[experimental]`. Ein experimentelles Protokoll als tragende Integration bricht bei `npm update`, und zwar STILL. Was auch immer gebaut wird, braucht eine Version-Sonde, die LAUT scheitert, statt in ein Fallback zu rutschen.
  2. Es ist ein ZWEITER SLOT-TYP, keine Adapter-Variante. Fleets Modell ist "ein Slot ist eine tmux-Pane": `capture-pane`, `sendText`, `paneAgentAt`, `doneLooking`, die Suiten, die Sonden — nichts davon greift bei einem app-server-Slot. Wer das als Flag am Adapter baut, baut eine Luege in die Faktschicht.
  3. Ein websocket allein loest die Lese-Reichweite NICHT. Laeuft der app-server auf diesem Host, liest er diesen Host. Er hilft nur zusammen mit (a) dem Ort (Container/andere Maschine, siehe `29cd2610`) ODER (b) einer tatsaechlich implementierten Approval-Policy.

DIESE ZEILE IST EIN ZIELBILD, KEIN AUFTRAG — vor dem Start durch `▸ clarify first`. Offen und zuerst zu klaeren: greift die Approval-Anfrage ueberhaupt bei READS (ein `cat` ist ein Command-Exec, also vermutlich ja — aber gemessen ist es nicht)? Was passiert bei `sandbox_mode` + Policy gleichzeitig? Und der ehrlichste erste Schritt ist ein SPIKE: Daemon starten, eine Verbindung aufmachen, EINE Turn fahren, eine Approval-Anfrage beantworten — read-only, ohne eine Zeile Fleet-Code.
```

## `b634236c`  ·  kind=lane  ·  angelegt 2026-08-08 14:18  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — Die Arbeit greift weit über einen Worktree hinaus: eine colima-VM starten (`colima start fleetbuild`), ein Image bauen, `~/.claude-fleet-workers/deepseek.key` als Bind-Mount einhängen, Netz-Ausgang zu api.deepseek.com öffnen und per `POST /api/repo-worker` die laufende Server-Konfiguration umstellen — Credential, geteilter Maschinenzustand und Netz in einem Schnitt. Dazu attribution: die Zustandsb
- Analyst sagt kollidiert mit: fleet/260808114656-6e86, 54af57d6
- Analyst-Blocker: ["reach", "attribution"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[worker] DeepSeek im Container verdrahten — die Umsetzung von "es sollte einfach sicher in einem container laufen".

OWNER 2026-08-08, woertlich: "was fuer ein wort willst du von mir zu deepseek? es sollte einfach sicher in einem container laufen". Das ist eine ANWEISUNG, kein offener Entscheid — der Schalter ist damit vom Tisch, die Verdrahtung ist die Arbeit. Vorgeschichte: `worker-deepseek.py` ist gebaut, gemessen (5 Laeufe gegen die echte API) und am 2026-08-08 live geprueft (65 prompt / 12 completion Token, exit 0, gueltiges Conventional-Commit-Subject). `b64cd54` machte den Worker pro Repo speicherbar, `2a86cec` schickte den Worker-Spawn durch den Harness-Adapter. Was fehlt, ist der Container selbst.

MASCHINEN-BEFUND, gemessen 2026-08-08 (nicht angenommen):
  - `docker context ls`: `default` ist TOT — `failed to connect ... /var/run/docker.sock: no such file or directory`. Der Container-Adapter hat aber genau `default` als CONTAINER_CONTEXT-Default und `fleet` als CONTAINER_NAME-Default. Er zeigt heute auf nichts.
  - Laufende Container: NUR `fleet-guest` und `fleet-guest-2`, beide auf `colima-fleetguest`. Das sind die GAST-Container mit Credentials und NET_ADMIN — ein Worker gehoert dort ausdruecklich NICHT hinein.
  - colima-Profile: `default` (gestoppt, 2 CPU / 8 GiB / 50 GiB), `fleetbuild` (gestoppt, 2 CPU / 2 GiB / 20 GiB), `fleetguest` (laeuft). `fleetbuild` ist der naheliegende neutrale Ort.
  - Images: nur `claude-fleet:guest` (912 MB), auf fleetguest.

VORBEDINGUNG, die BEREITS LAEUFT: `25e7c086` (Container UND Kontext pro SLOT) — heute sind beide fleet-weite Modul-Konstanten aus dem Prozess-Env. Ohne sie kann ein Worker nicht in einen ANDEREN Container zeigen als alles uebrige. Diese Zeile beginnt erst danach.

WAS ZU TUN IST, und die Reihenfolge ist die Sicherheit:
  1. Eine neutrale VM laufen lassen (`colima start fleetbuild`) — NICHT fleetguest mitbenutzen.
  2. Ein MINIMALES Image: python3 und sonst nichts. Nicht `claude-fleet:guest` wiederverwenden — das ist ein Gast-Image mit anderem Zweck und 912 MB.
  3. Den Key hineinreichen, ohne ihn ins Image zu backen: `~/.claude-fleet-workers/deepseek.key` als read-only bind-mount, 0600, und NICHT als Env-Variable (ein Env-Wert steht in `docker inspect`).
  4. Den commitMsg-Worker dieses Repos darauf zeigen lassen (`POST /api/repo-worker`), NUR fuer claude-fleet — `[privates Owner-Repo]` und `private-repo-b` bleiben unberuehrt.
  5. Netz: der Wrapper MUSS api.deepseek.com erreichen. Das ist der einzige Ausgang, den der Container braucht — alles andere zu.

DONE-KRITERIUM: ein Commit ueber den `⌨ commit`-Knopf in claude-fleet erzeugt eine Message vom Wrapper IM CONTAINER (belegt am Subject, nicht an der Abwesenheit eines Fehlers), waehrend ein Commit in einem anderen Repo weiter den Fleet-Default nimmt. Und: der Fehlschlag-Pfad bleibt intakt — stirbt der Container, gelingt der Commit mit `wip:` und `messageFallback: true`.

WARUM DER CONTAINER HIER UEBERHAUPT ETWAS BRINGT, ehrlich benannt: er reduziert NICHT, was rausgeht — der Prompt wird vom Server gewaehlt, nicht vom Worker. Er macht aus dem Versprechen des Wrappers ("liest nie den FLEET-Env, fasst nur seine Key-Datei an") eine DURCHSETZUNG. Das ist der richtige Grund, nicht der dringende.
```

## `d9b9b4c4`  ·  kind=lane  ·  angelegt 2026-08-08 14:43  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — Die Zeile erklärt sich selbst zur "Registerzeile, kein Auftrag" und lässt drei Schnittfragen offen (persistiert der Slot den Harness bis zum terminalen Ereignis, gehört das Feld auf den Land-Zettel, zeigt state.sh es an) — welcher Endzustand abgenommen wird, entscheidet sich erst danach; (a) würde den Schnitt auf die Lane-Geburt verschieben. Der Befund selbst prüft sich sauber: `interface LaneOutc
- Analyst sagt kollidiert mit: f85d1244, 34a12839, fleet/260808114656-6e86
- Analyst-Blocker: ["criterion"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[harness/ledger] Kein Ledger sagt, WELCHER Harness eine Lane gefahren hat — die Adaption von pi/codex ist damit unmessbar.

BEFUND (gemessen 2026-08-08 an HEAD 69c94da): `interface LaneOutcome` (server.ts:6877) traegt `model`, aber
KEIN `harness`. Nachgezaehlt ueber alle 177 Zeilen `lane-outcomes.jsonl`: das Feld `harness` kommt 0 mal vor.
Dieselbe Absenz im Land-Zettel (`git notes --ref=fleet/land`) und in `post-land-audits.jsonl`.

WARUM DAS JETZT ZAEHLT: seit 2026-08-08 gibt es vier Adapter, und die Frage "koennen wir pi und codex
wirklich benutzen" ist hinterher aus keinem Ledger zu beantworten. `model` reicht dafuer NICHT: eine
Codex-Lane ohne Modell-Pin schreibt `model:null` — buchstabengleich mit einer unpinned claude-Lane. Die
Unterscheidung existiert also genau so lange, wie sich jemand erinnert.

RICHTUNG (nicht der fertige Schnitt): `harness` als Feld auf `LaneOutcome`, geschrieben wo `model`
geschrieben wird (`buildLaneOutcome`, server.ts:7037), mit derselben Ehrlichkeitsregel wie die Nachbarn —
Absenz heisst "diese Zeile kann es nicht sagen", nie ein geratener Default. Fuer eine Zeile aus der Zeit vor
dem Feld ist die Absenz die Wahrheit; sie darf nicht zu "claude" gefaltet werden.

ZU KLAEREN VOR DEM BAU:
  (a) Persistiert der Slot den Harness ueberhaupt so, dass buildLaneOutcome ihn beim TERMINALEN Ereignis
      noch lesen kann (ein Kill raeumt den Slot)? Wenn nicht, muss er wie `base`/`briefHash` bei der
      Lane-Geburt festgehalten werden — dann ist das der eigentliche Schnitt.
  (b) Gehoert dieselbe Zeile auch auf den Land-Zettel (`git notes`)? Der Zettel ist die Provenienz eines
      Commits auf main; "welcher Agent hat das geschrieben" ist genau eine Provenienz-Frage.
  (c) Zeigt `./state.sh` es an? Die Land-Health-Zahlen dort sind heute harness-blind.

Das ist eine Registerzeile, kein Auftrag: sie braucht ein hartes Done-Kriterium und einen Verify-Weg,
bevor sie startet — `clarify first` oder eine Brief-Schaerfung.
```

## `29cd2610`  ·  kind=lane  ·  angelegt 2026-08-08 11:42  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — The brief says it of itself — "DIESE ZEILE IST EIN ZIELBILD, KEIN AUFTRAG", with the cut (volume layout, push-back, netloss, repo-dir vs remote URL) explicitly undecided — so there is no finished state to judge. It also reaches well past a worktree: cloning the [privates Owner-Repo] repo from the MAIN machine over Tailscale and pushing back, Docker volumes and containers on the host, and opening `automa
- Analyst sagt kollidiert mit: fleet/260808114656-6e86
- Analyst-Blocker: ["criterion", "reach"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[isolation, Zielbild] Ein Repo, das auf der MAIN-Maschine wohnt, auf der Dev-Maschine per Knopf vollstaendig IM CONTAINER fahren — ohne dass seine Dateien je die Host-Platte beruehren.

OWNER 2026-08-08, woertlich: "was ich ab da so richtig interessant faende, waere es so zu bauen das das [privates Owner-Repo] repo auf meiner mainMaschiene liegt und nicht auf dieser dev maschiene. Ich das repo aber dann ueber den client einfach in einem container auf der dev maschiene, voll laufen lassen kann". Anlass ist der Satz davor: "bevor wir codex vollen zugriff geben sollte ich auch erst den [privates Owner-Repo] irgendwie abtrennen".

WARUM DAS EIN ECHTES PROBLEM LOEST UND NICHT NUR HYGIENE IST (gemessen 2026-08-08, Details in CLAUDE.md): Codex' `--sandbox workspace-write` ist ein SCHREIB-Zaun, kein Lese-Zaun. Ein `cat` ausserhalb des Workspace gelang auf dem echten Agenten-Pfad in 0 ms, der Inhalt kam als Modell-Antwort zurueck; Schreiben ausserhalb wurde mechanisch verweigert. Ein Codex-Slot kann heute also `~/[privates Owner-Repo]` (CVs, Profil) lesen, egal in welchem Worktree er laeuft.

DIE FALLE, an der der naheliegende Bau scheitert: der heutige Container-Adapter (`ec7d191`) BIND-MOUNTET den Worktree vom Host. Ein bind-gemounteter Checkout liegt auf der Host-Platte und ist von genau dieser Lese-Reichweite erfasst — der Container sieht dann nach Isolation aus, ohne welche zu sein. Die Arbeitskopie muss in einem VOLUME liegen und der Agent DRINNEN laufen. Wer das uebersieht, baut die Fassade.

BAUTEILE, zwei davon existieren schon — das ist kein Neubau:
  1. Container UND Kontext PRO SLOT statt fleet-weiter Env-Konstanten. Liegt als gebriefte Zeile `25e7c086` bereit und ist Vorbedingung: ohne sie kann ein Slot nicht sagen, in WELCHEM Container er laeuft.
  2. Arbeitskopie als KLON neben dem Worktree — heute frueh gelandet (`ff5d713` + `b320c24`). Genau die Abstraktion, die ein Volume-Klon braucht.
  3. NEU: Transport. Die Main-Maschine ist die Wahrheit; der Container klont ueber Tailscale von dort und pusht zurueck. Der Host der Dev-Maschine bekommt die Dateien nie zu sehen.
  4. NEU: ein Knopf im Client — "dieses Remote-Repo hier in einem Container fahren".

REIHENFOLGE, und sie IST die Sicherheit: erst 1-3, dann `automatable` fuer Codex aufmachen. Andersherum ist es ein Vertrauensvorschuss statt einer Konstruktion.

DIESE ZEILE IST EIN ZIELBILD, KEIN AUFTRAG. Sie gehoert vor dem Start durch `▸ clarify first` oder eine Brief-Schaerfung — der Schnitt (Volume-Layout, wie ein Push zurueck aussieht, was bei Netzausfall passiert, ob der Client ein Repo-Verzeichnis oder eine Remote-URL nimmt) ist noch nicht entschieden.
```

## `34a12839`  ·  kind=lane  ·  angelegt 2026-08-08 12:24  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — Der behauptete Mechanismus steht so nicht im Baum: der Boot-Abgleich adoptiert nur bestehende tmux-SESSIONS (server.ts:9253-9273), und `killSlot` beendet genau diese Session (server.ts:2881) und leert den Slot-Datensatz — nichts ordnet einen verwaisten Worktree einem FREIEN Slot zu; Orphans erscheinen in `/api/slots/:n/worktrees` (server.ts:12030 ff.) und werden nur per explizitem `attach` (12113 
- Analyst sagt kollidiert mit: d9b9b4c4, fleet/260808114656-6e86
- Analyst-Blocker: ["attribution", "criterion"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.
- Owner-Kommentare auf der Zeile:
  > LIVE-MESSUNG 2026-08-08 (main-42), die diese Zeile praezisiert — und der Owner hat es unabhaengig am
Board bemerkt ("there was some bugs with the worktrees of this session").

BEOBACHTET, mit Beleg in audit.jsonl: um 16:50 habe ich vier fertige Lanes gekillt (Slots 1, 7, 11, 12).
Innerhalb von 17 Sekunden erschienen vier `slot_open`-Ereignisse auf GENAU DIESELBEN Worktree-Pfade,
jeweils in ANDEREN Slots (1, 7, 11, 12, 14), begleitet von `created:no-session`. In den re-adoptierten
Slots liefen da
  > NACHTRAG zur Messung darueber — die offene Stelle ist vom Owner geschlossen (2026-08-08):
"die beiden war glaube ich selbst weil ich auf zwei geister-slots gedrueckt habe wo 'on-disk' daneben
stand". Damit ist geklaert, WER `fleet-260808133304-b442` und `fleet-260808133336-673f` erzeugt hat.
Meine Zuschreibung an den srv-Neustart war eine Vermutung und ist hiermit zurueckgezogen.

ABER die Frage wird dadurch praeziser statt kleiner, und sie gehoert in den Schnitt: der Code kennt
diese Zeilen aus

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[queue/ui] Eine gekillte LEERE Lane taucht nach dem naechsten srv-Neustart auf einem anderen Slot wieder auf — das sieht aus wie Wiederbelebung.

BEOBACHTET 2026-08-08, vom Owner bemerkt: Lane `fleet/260808083750-ae59` (leer, null Commits, nie ein Prompt zugestellt) wurde per `POST /api/slots/7/kill` beendet. `kill` beendet die tmux-Session, entfernt aber den WORKTREE nicht. Beim naechsten srv-Neustart (Deploy-Ritual, ~10x/Tag) hat der Boot-Abgleich den verwaisten Worktree gefunden und einem freien Slot zugeordnet — sie stand danach auf Slot 5, mit Label und Branch, aber ohne Aufgabe. Der Owner fragte darauf "wofuer ist die lane ae59? wenn sie keine aufgabe hat, dann schliess sie" — also genau die Verwirrung, die das Verhalten erzeugt.

DASS DER WORKTREE UEBERLEBT, IST RICHTIG und darf nicht wegoptimiert werden: eine gekillte Lane MIT Arbeit muss wiederfindbar bleiben, das ist der Sinn (`land` behaelt den Branch aus demselben Grund). Der Defekt ist, dass die Adoption nicht unterscheidet zwischen "hier liegt Arbeit, die jemand retten muss" und "hier liegt eine leere Huelle, die niemand vermisst".

RICHTUNG, nicht der Schnitt — drei Kandidaten, und der dritte ist vermutlich der beste:
  (a) `kill` verwirft den Worktree, WENN er sauber ist UND `ahead == 0`. Praezise, aber unwiderruflich im Moment des Klicks.
  (b) Die Adoption laesst leere Huellen liegen, statt sie einem Slot zu geben. Dann verschwinden sie vom Board, bleiben aber auf der Platte — `./state.sh` fuehrt sie ohnehin schon als "a worktree with no slot is an orphan".
  (c) Die adoptierte Row SAGT, was sie ist: "leer, 0 Commits, keine Aufgabe — verwerfen?" statt wie eine normale Lane auszusehen. Loescht nichts, macht den Zustand aber lesbar, und Lesbarkeit war hier das Problem.

ZU PRUEFEN VOR DEM BAU: wo genau adoptiert der Boot (grep den Worktree-Abgleich beim Start), und welche Faelle haengen sonst noch daran — eine Lane mit Arbeit, deren Session starb, MUSS weiter adoptiert werden, sonst wird aus einem kosmetischen Fix ein Datenverlust.
```
