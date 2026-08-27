---
frage: Was ist die Ursache dafür, dass vier Checks der Familie Program-MAIN Fleet frame/succession in ./e2e-isolated.sh seit dem 2026-08-21 reproduzierbar rot sind?
urteil: Der Fehler liegt in der Sonde, nicht im Produktcode; waitForLabel liefert den Slot vor ensureSlot (Label-Fenster 25 bis 41 ms gegen den 50-ms-Sampler), der Fix 8ad4192 lässt die Sonde auf die Pane warten und als sie selbst scheitern
bereich: [verify, lane-lifecycle]
belege: [e2e/programs.ts#waitForLabel, server.ts#openSlot, 8ad4192, e2e/tasks.ts]
nicht-gemessen: Warum die Fleet-Gründung im roten Lauf 3/3 verliert ist erschlossen, nicht gemessen; weitere Wege ins Rot nicht ausgeschlossen; die ~62-Minuten-Lücke vor dem Beweislauf blieb unerklärt
stand: 2026-08-21
---

# Warum die vier "Program-MAIN Fleet frame/succession"-Checks rot sind

2026-08-21, Lane `fleet/260821172714-5d3b` (ACP-18). Frage: **Was ist die Ursache dafür, dass vier
Checks der Familie "Program-MAIN Fleet frame/succession" in `./e2e-isolated.sh` seit dem
2026-08-21 reproduzierbar rot sind?**

Kurzfassung: der Fehler liegt in der SONDE, nicht im Produktcode. `waitForLabel`
(`e2e/programs.ts:141-149`) liefert den Slot zurück, sobald `openSlot` `s.cwd`/`s.label`
veröffentlicht hat (`server.ts:4459` / `server.ts:4471`) — das ist **vor** `await ensureSlot(s)`
(`server.ts:4531`), das die tmux-Pane erst anlegt (`server.ts:4340`). Trifft der Sampler dieses
Fenster, antwortet `respawnScreen` (`e2e/programs.ts:393-395`) mit `can't find pane: sN`, der
Codex-Banner wird nie gemalt, und `bootstrap-main` stirbt in `waitForFoundingReadiness`
(`server.ts:4777-4792`) mit **HTTP 500 `{"error":"Program-MAIN pane never showed its ready marker
within 3s"}`**. Der Exit-Code von `respawnScreen` wird an keiner der acht Aufrufstellen geprüft.

## Ergebnis

### (a) Status und Body der fehlschlagenden `bootstrap-main`-Antwort — GEMESSEN

```
HTTP 500 after 7451 ms
{"error":"Program-MAIN pane never showed its ready marker within 3s"}
```

Gegen den roten Trail gehalten: der Check
"Program-MAIN Fleet frame: founding prompt keeps exactly the four existing grounding steps in order"
steht im Trail `isolated-20260821T161952Z-31042.jsonl` mit `msSincePrev: 7535`. Der grüne Lauf
(`isolated-20260821T085027Z-69684.jsonl`) hat an derselben Stelle `4753`. Meine erfolgreiche
Nachstellung derselben Gründung braucht **4632–4759 ms**, meine fehlschlagende **7436–7490 ms**
(6 von 6). Die zwei Zahlen sind die zwei Zweige derselben Route: der Erfolgspfad enthält
`await Bun.sleep(4000)` (`server.ts:13649`), der Fehlpfad zusätzlich die volle
`FLEET_READY_WAIT_MS=3000`-Wartezeit (`e2e-isolated.sh:595`, `server.ts:4618`).

### (b) Die Ursache — GEMESSEN, mit Reproduktionskommando

Das Rennen ist ein **Fenster von 25–41 ms gegen einen 50-ms-Sampler**. Gemessen in einer eigenen
Wegwerf-Instanz (5 Läufe je cwd, enger Poll ohne `sleep`, danach `tmux has-session` bis Erfolg):

| Lauf | cwd = `manifestrepo` (target-repo) | cwd = Instanz-Wurzel (fleet-control) |
|---|---|---|
| 0 | Label sichtbar @131 ms, Fenster 26 ms | Label sichtbar @90 ms, Fenster 28 ms |
| 1 | @116 ms, 27 ms | @90 ms, 29 ms |
| 2 | @122 ms, 34 ms | @92 ms, 28 ms |
| 3 | @118 ms, 28 ms | @95 ms, 41 ms |
| 4 | @141 ms, 28 ms | @91 ms, 25 ms |

„Label sichtbar" = früheste Antwort von `GET /api/sessions`, in der der Slot `cwd` UND `label`
trägt. „Fenster" = Abstand von dort bis `tmux has-session -t sN` erstmals 0 liefert.

Zwei Zahlen daraus, beide 5/5 getrennt:

1. Das Fenster ist bei **beiden** cwds gleich groß (25–41 ms). Das Rennen hängt also **nicht** am
   Fleet-Checkout — die Familie hat acht `waitForLabel`-Aufrufstellen (`grep -c 'waitForLabel(' e2e/programs.ts`),
   und alle acht sitzen darauf.
2. Die **Phase** hängt am Frame: die Fleet-control-Gründung veröffentlicht ihr Label systematisch
   ~30–50 ms FRÜHER (90–95 ms) als eine target-repo-Gründung (116–141 ms). Damit fällt bei der
   Fleet-Gründung eine andere Poll-Probe ins Fenster als bei den drei Carrier-Gründungen davor —
   und genau das ist im roten Lauf zu sehen: die drei Carrier-Checks sind grün (`msSincePrev`
   4674/4781/4648), die Fleet-Gründung fällt.

Reproduktion des Fehlschlags (6/6 deterministisch, sobald man den Sampler auf die früheste
Sichtbarkeit stellt): eine gestagte Wegwerf-Instanz bauen, Server mit eigenem Socket/Port starten,
dann `POST /api/programs` → `confirm` → `activate` → `POST /api/programs/:id/bootstrap-main`
mit `{cwd:<instanz>, harness:"codex", model:"gpt-5.5", effort:"high"}`, das Label eng pollen und
`tmux respawn-pane` sofort bei erster Sichtbarkeit feuern — siehe §Methode. Ausgabe:

```
slot=3 label@75ms  respawn code=1 err="can't find pane: s3"
  -> HTTP 500 after 7471ms: {"error":"Program-MAIN pane never showed its ready marker within 3s"}
```

Die vier roten Checks sind danach reiner Folgeschaden, in der Reihenfolge des Trails:
`fleetResponse.ok=false` und leerer Prompt (kein `slot` im Body) · `fleetReceipt=null` (die Route
schreibt die Quittung erst NACH `sendText`, `server.ts:13676-13690`) · `"0 null"` (Manifest-Commit
war `0`, also erfolgreich — nur die Quittung fehlt) · `"401 "` (`cleanup()` killt den Slot,
`server.ts:13645-13647`, damit ist `selfToken` weg und `POST /api/self/succeed` antwortet 401).

**Gegenprobe, dass der Produktcode trägt:** dieselbe Gründung mit korrekt gesetztem Banner
antwortet in einer frisch gestagten Instanz aus DIESEM Lane-Baum (HEAD `67418a8`) mit HTTP 200,
und die Quittung hat genau die Form, die Check 2 und Check 3 verlangen:

```
selected ['portable-core', 'verify-e2e', 'fleet-frame-carrier-probe']
omitted  [('land-mechanics','harness-unsupported'), ('task-queue','trigger-not-matched'),
          ('harness-adapter','trigger-not-matched'), ('private-deploy-overlay','harness-unsupported')]
renderer v2
```

### (c) Urteil je Hypothese

| | Urteil | Beleg |
|---|---|---|
| **H1** `bootstrap-main` mit `cwd: ROOT` antwortet nicht-2xx | **BELEGT** | HTTP 500, Body oben, 7436–7490 ms in 6 von 6 Nachstellungen; Signatur deckt sich mit `msSincePrev: 7535` im roten Trail. |
| **H2** Kapazitäts-/Timing-Rennen um `waitForLabel` | **BELEGT in der Timing-Hälfte, WIDERLEGT in der Kapazitäts-Hälfte** | Timing: Fenster 25–41 ms gegen 50-ms-Sampler, gemessen (Tabelle oben). Kapazität: `server.log` der roten Instanz zeigt `slot 6: created tmux session 's6' in <instanz-wurzel>` — ein freier Slot war da, `openSlot` lief durch, ein 409 „no free slot" hat es nie gegeben. |
| **H3** Etwas Quellbaum-Abhängiges, das das Staging kopiert | **WIDERLEGT** | Eine frisch aus DIESEM Baum (`67418a8`, inkl. `HANDOFF.md` und `AGENTS.md` in ihrer heutigen Fassung) gestagte Instanz gründet mit HTTP 200 und der erwarteten Quittung. |
| **H4** Die Ursache ist älter als `9cdb77a`, der grüne Lane-Lauf war der Ausreißer | **BELEGT** | `waitForLabel` und `respawnScreen` stammen unverändert aus `971c8da` (2026-08-14, `git log -L 141,149:e2e/programs.ts`), also fünf Tage vor dem Fleet-frame-Block (`870593a`, 2026-08-19). Der Block hat keine neue Bruchstelle gebaut, sondern eine vierte Gründung auf eine bereits vorhandene gesetzt. |

### (d) Der eine empfohlene nächste Schnitt

**`respawnScreen` auf die PANE warten lassen statt auf das Label — und als sie selbst scheitern.**
Ein eigener Act, ein Diff, kein Produktcode. Deckt alle acht Aufrufstellen in `e2e/programs.ts`
auf einmal ab (`e2e/tasks.ts` benutzt dasselbe Muster und sollte im selben Schnitt mitgezogen
werden):

```diff
--- a/e2e/programs.ts
+++ b/e2e/programs.ts
@@
-  const respawnScreen = (slot: number, screen: string): Promise<{ out: string; code: number }> =>
-    tmuxOut("respawn-pane", "-k", "-t", `s${slot}`,
-      `${NODE} -e 'console.log(process.argv[1]); setInterval(() => {}, 1e9)' ${JSON.stringify(screen)}`);
+  // openSlot veroeffentlicht s.cwd/s.label (server.ts:4459/4471) BEVOR `await ensureSlot(s)`
+  // (server.ts:4531) die Pane anlegt (server.ts:4340). waitForLabel kann also einen Slot
+  // liefern, dessen tmux-Session noch nicht existiert — gemessenes Fenster 25-41 ms gegen den
+  // 50-ms-Sampler dieses Helfers. respawn-pane antwortet dann `can't find pane: sN`, der
+  // Codex-Banner wird nie gemalt, und die Gruendung stirbt in waitForFoundingReadiness mit
+  // "pane never showed its ready marker within 3s". Auf die PANE warten, nicht auf das Label.
+  const respawnScreen = async (slot: number, screen: string): Promise<{ out: string; code: number }> => {
+    for (let i = 0; i < 60; i++) {
+      const r = await tmuxOut("respawn-pane", "-k", "-t", `s${slot}`,
+        `${NODE} -e 'console.log(process.argv[1]); setInterval(() => {}, 1e9)' ${JSON.stringify(screen)}`);
+      if (r.code === 0) return r;
+      await Bun.sleep(50);
+    }
+    // Eine Sonde, die nicht laufen konnte, scheitert als SIE SELBST — nie als das, was sie
+    // messen sollte (Regelbuch, Block vom 2026-08-19).
+    throw new Error(`respawnScreen: pane s${slot} never appeared — the founding probe could not run`);
+  };
```

Nicht empfohlen, weil es die Ursache nicht trifft: `FLEET_READY_WAIT_MS` hochdrehen (die Pane wird
NIE bereit, nicht spät bereit) und den Fleet-frame-Block zurückdrehen (die Bruchstelle ist fünf
Tage älter als er).

### (e) Nachtrag 2026-08-21: der Schnitt aus (d) ist gefahren

Owner-Freigabe lag vor; der Fix ist committet als **`8ad4192`** (das Land fährt der Owner),
Write-Set `e2e/programs.ts` +
`e2e/tasks.ts`, `server.ts` unberührt.

Ausgeführte Form, in zwei Teilen — der zweite ist der, den (d) noch nicht benannt hatte:

1. **`waitForLabel` wartet jetzt auf die PANE**, nicht auf das Label: ein per Label gefundener Slot
   wird nur zurückgegeben, wenn `tmux has-session -t sN` gleichzeitig 0 liefert. Damit kann der in
   §Ergebnis vermessene Zustand („Label sichtbar, Pane fehlt") den Aufrufer nicht mehr erreichen.
2. **Beide Sonden scheitern als SIE SELBST.** `respawnScreen` wiederholt `respawn-pane` gebündelt
   (60 × 50 ms) und meldet nach Ablauf einen eigenen `check()` mit dem Exit-Code; `waitForLabel`
   meldet nach Ablauf einen eigenen `check()`, der zwischen „nie ein Slot mit dem Label" und
   „Slot da, Pane nie gewachsen" unterscheidet. Beide Checks feuern NUR im Fehlerfall — ein grüner
   Lauf behält seine Checkzahl, ein kaputtes Fixture nennt sich künftig beim Namen statt sich als
   Produktregress zu tarnen. Dieselbe Fehlerform in `e2e/tasks.ts` an der einen Stelle, die
   dasselbe Muster hat (`screenLane`, Dispatch-Tail der Readiness-Sonde).

Die drei vorhandenen `Bun.sleep(250)`-Umgehungen an den Nachfolge-Aufrufstellen sind bewusst
STEHEN GEBLIEBEN: sie zu entfernen wäre unbestelltes Aufräumen in derselben Lane.

Beleg: ein serieller `./e2e-isolated.sh`-Lauf aus dieser Lane (Trail
`isolated-20260821T184923Z-2724.jsonl`, Baum `e4dd0da` + die beiden Sonden-Dateien uncommittet)
endet wörtlich auf `ALL PASS`: **2774 PASS-Zeilen, 0 FAIL-Zeilen** — dieselbe Checkzahl, die der
rote Audit-Lauf auf `850d27b` als `ran: 2774` meldete. (Die im Lauf sichtbare Zeile
`rows=2765 results=2765` ist eine Momentaufnahme aus der Trail-Familie: ihr Detail wird gebaut,
bevor die neun Checks dieser Familie selbst gezählt sind — 2765 + 9 = 2774.) Gegengeprüft über die
Namensmengen beider Trails: 2774 Zeilen und 2768 verschiedene Namen auf BEIDEN Seiten, **null Namen
nur im roten, null nur im grünen Lauf**. Es wurde also kein Check hinzugefügt, entfernt oder
umbenannt; der einzige Unterschied sind vier FAIL, die PASS wurden.

Die vier vorher roten Checks, einzeln, mit ihrem `msSincePrev` vorher/nachher:

| Check | rot (2026-08-21) | nach dem Fix |
|---|---|---|
| Fleet frame: founding prompt keeps exactly the four existing grounding steps in order | FAIL 7535 ms | **PASS 4916 ms** |
| Fleet frame: binding, bytes, git facts, six-way plan, anchors, and the receipt hash stay equivalent | FAIL 0 ms | **PASS 111 ms** |
| Fleet frame: a manifest tracked in the Fleet checkout IS read, delivered, and receipted beside the seeds | FAIL 0 ms | **PASS 1 ms** |
| Fleet succession: the byte-stable grounding and carry frame remains Fleet-control | FAIL 4312 ms | **PASS 4988 ms** |

Die beiden neuen `check()` feuern nur im Fehlerfall — deshalb ist die Checkzahl identisch
geblieben, statt um zwei zu wachsen. Nichts übersprungen, nichts wegdefiniert.

## Methode

Alles in einer Wegwerf-Instanz mit eigenem Socket (`fleetacp18`), eigenem Port (23500, außerhalb
aller Bänder in `e2e-isolated.sh:26-32`) und `FLEET_CMD=true`. Kein `./e2e-isolated.sh`-Lauf, kein
Land, kein Deploy. Abbau ausschließlich per `tmux -L fleetacp18 kill-server`.

**P0 — die drei aufgehobenen roten Instanzen gelesen** (`$TMPDIR/fleet-e2e-instance-29353`, `-98400`,
`-66611`, nur lesend):

```
python3 -c "..."   # context-receipts.jsonl der roten Instanz: 22 Zeilen, KEINE mit programId der
                   # Fleet-Gruendung; die beiden Zeilen mit repo=<instanz-wurzel> liegen 42 s spaeter
                   # und gehoeren zu e2e/supervisor.ts
grep -n "instance-29353$" server.log    # Zeile 334: slot 6 wurde in der Instanz-Wurzel angelegt
git -C $TMPDIR/fleet-e2e-instance-29353 log --oneline -8
```

Damit stand fest: `openSlot` lief durch (Pane wurde angelegt), alle vier git-Commits des Blocks
haben `status 0`, und die Quittung fehlt vollständig — der Abbruch liegt zwischen `openSlot` und
`appendEvent`.

**Trail-Vergleich grün vs. rot:**

```
python3 -c "
import json,sys
for l in open(sys.argv[1]):
    r=json.loads(l)
    n=r.get('check','')
    if 'Program-MAIN' in n and ('Fleet' in n or 'carrier' in n):
        print(('OK  ' if r.get('ok') else 'FAIL'), r.get('msSincePrev'), n[:70], '|', r.get('detail'))
" $TMPDIR/fleet-e2e-trail/isolated-20260821T161952Z-31042.jsonl
```

**P1 — Staging, Server, Gründung per curl/fetch.** Staging exakt nach `e2e-isolated.sh:56-70`:

```sh
SRC=<lane-worktree>; DIR=$SCRATCH/inst
rm -rf "$DIR"; mkdir -p "$DIR"
. "$SRC/e2e-stage.sh"; stage_instance "$SRC" "$DIR" server.ts fleet-e2e.ts
mkdir -p "$DIR/docs"
for f in AGENTS.md HANDOFF.md docs/verify-tiering.md docs/land-mechanics.md \
         docs/plan-queue-refinement-2026-08-11.md docs/container.md; do cp "$SRC/$f" "$DIR/$f"; done
( cd "$DIR" && git init -q -b main && git config user.email t@t && git config user.name t \
  && git config commit.gpgsign false && git add -A && git commit -qm init )
```

Danach das Probe-Manifest wie in `e2e/programs.ts:562-567` nach `.fleet/context-packs.json`
schreiben und committen, dann:

```sh
tmux -L fleetacp18 new-session -d -s srv \
  "cd '$DIR' && PATH='$DIR:$PATH' FLEET_HOST=127.0.0.1 FLEET_PORT=23500 FLEET_SOCK=fleetacp18 \
   FLEET_CMD=true FLEET_HARNESS_AUTOMATION=0 FLEET_READY_WAIT_MS=3000 FLEET_AUTOS_TICK_MS=250 \
   FLEET_DISPATCH_TICK_MS=250 FLEET_ANALYSIS_MS=0 FLEET_BRIEF_MS=0 FLEET_BACKLOG_NUDGE_MS=0 \
   FLEET_AUTO_REVIEW_MS=0 exec bun server.ts >> server.log 2>&1"
```

Die drei Treiberskripte (Gründung mit Banner · Gründung ohne Banner · Gründung mit sofortigem
`respawn-pane` bei erster Label-Sichtbarkeit · Fenstermessung) lagen im Session-Scratchpad und sind
mit der Lane weg; ihr Kern ist jeweils:

```ts
const pending = post(`/api/programs/${id}/bootstrap-main`,
  { cwd, label, harness: "codex", model: "gpt-5.5", effort: "high" });
while (Date.now() - t0 < 20000) {                       // ENGER Poll — kein Bun.sleep(50)
  const hit = (await sessions()).slots.find(x => x.cwd && x.label === label);
  if (hit) { slot = hit.id; tLabel = Date.now() - t0; break; }
}
spawnSync("tmux", ["-L", SOCK, "respawn-pane", "-k", "-t", `s${slot}`, /* node banner */]);
const res = await pending;                              // <- Status und Body
```

Der Unterschied zwischen "grün" und "rot" ist in diesem Skript genau eine Zeile: ob zwischen
Label-Treffer und `respawn-pane` noch auf `tmux has-session` gewartet wird.

**Gegenprobe zur Last:** dieselbe Sequenz (drei target-repo-Gründungen, dann die
Fleet-control-Gründung) mit dem ECHTEN 50-ms-Sampler aus `e2e/programs.ts`, einmal auf ruhiger
Maschine und einmal unter 14 CPU-Brennern (load average 6.49). Beide Male 4/4 grün, 4571–4759 ms.
Reine CPU-Last verbreitert das Fenster also nicht messbar.

## Was nicht gemessen wurde

- **Warum genau die Fleet-Gründung im roten Lauf 3/3 verliert und die drei Carrier davor 3/3
  gewinnen, ist ERSCHLOSSEN, nicht gemessen.** Gemessen ist der 30–50-ms-Phasenversatz zwischen
  fleet-control- und target-repo-Gründung (5/5 getrennt). Die Erklärung dafür — der
  target-repo-Zweig in `preflightProgramMain` fährt einen zusätzlichen git-Prozess
  (`git cat-file -s HEAD:AGENTS.md`, `server.ts:12888`), den der fleet-control-Zweig nicht fährt —
  ist aus dem Code gelesen und nicht einzeln vermessen. **Der grüne Lauf berührt diese Erklärung
  nicht**: der Fix entfernt die Abhängigkeit von der Phase überhaupt, statt sie zu verschieben —
  er kann also weder für noch gegen `server.ts:12888` sprechen.
- ~~Die Bestätigung, dass der Diff aus (d) die Familie grün macht, steht aus.~~ Nachgeholt in
  (e): ein Lauf, `ALL PASS`, die vier Checks als PASS. Im ersten Schnitt waren 0 von 2 Läufen
  verbraucht, im zweiten 1.
- `e2e/tasks.ts` benutzt dasselbe `respawn-pane`-Muster; ich habe es nicht gelesen und keine
  Aussage über seine Aufrufstellen gemacht.
- Ob es außer dem Readiness-Timeout weitere Wege ins Rot gibt (Gate `not-alive`,
  `blocked-screen`, `sendText`-Fehler), ist nicht ausgeschlossen — nur nicht nötig: die gemessene
  Signatur (Status, Body, 7.4 s) deckt den beobachteten Fall vollständig.
- Die drei aufgehobenen Instanzen wurden nur gelesen; nichts darin gestartet, nichts gelöscht.
- **Unerklärt und NICHT untersucht:** zwischen dem Start des Beweislaufs (Suite-Lock genommen
  17:47Z) und dem Anlegen seines Instanzverzeichnisses (18:49:15Z, `stat -f %SB`) liegen ~62
  Minuten ohne Ausgabe. Kein zweiter Suite-Lauf im Trail-Verzeichnis in diesem Fenster, kein
  Sleep-Eintrag in `pmset -g log`. Danach lief die Suite in normaler Zeit durch. Wer das aufgreift,
  fängt bei `_stage_closure` in `e2e-stage.sh` an — die einzige Stelle zwischen beiden Zeitpunkten.

## Entscheidungs-Trail

```
ts	phase	entscheidung	warum	beleg	ergebnis
2026-08-21T17:29:00Z	P0	zuerst Trail grün-vs-rot statt Instanz-Forensik	msSincePrev trennt die zwei Codepfade der Route ohne jeden Lauf	isolated-20260821T161952Z-31042.jsonl	7535 vs 4753 ms
2026-08-21T17:31:00Z	P0	Kapazitäts-Hypothese fallengelassen	server.log:334 zeigt die angelegte Pane in der Instanz-Wurzel	instance-29353/server.log:334	kein 409, openSlot lief durch
2026-08-21T17:34:00Z	P1	eigene Wegwerf-Instanz statt Suite-Lauf	Status und Body der Route sieht kein Check	e2e-isolated.sh:56-70	HTTP 200, Quittung korrekt
2026-08-21T17:35:00Z	P1	Gegenprobe ohne respawnScreen gefahren	trennt "Route kaputt" von "Banner fehlt"	found.ts SKIP_RESPAWN	HTTP 500 nach 7451 ms
2026-08-21T17:36:00Z	P1	respawn-pane bei erster Label-Sichtbarkeit gefeuert	das ist genau das, was die Sonde tut	race2.ts	6/6 can't find pane -> 500
2026-08-21T17:37:00Z	P1	Fenster für beide cwds vermessen	trennt "hängt am Fleet-Checkout" von "hängt am Sampler"	window.ts	25-41 ms bei beiden; Phase 90 vs 116-141 ms
2026-08-21T17:38:00Z	last	CPU-Last-Hypothese geprüft und verworfen	load average 6.49 ändert nichts	seq.ts unter 14 Brennern	4/4 grün
2026-08-21T17:42:00Z	urteil	kein e2e-isolated-Lauf gefahren	Ursache steht ohne ihn; Budget bleibt für den Fix-Act	—	0 von 2 Läufen verbraucht
2026-08-21T18:20:00Z	fix	Fix in die Sonde, nicht ins Produkt	server.ts:4459/:4531 ist gewolltes Verhalten; die Sonde liest es falsch	Owner-Freigabe ACP-18 zweiter Schnitt	e2e/programs.ts + e2e/tasks.ts
2026-08-21T18:22:00Z	fix	neue check() nur im Fehlerfall	ein gruener Lauf soll seine Checkzahl behalten	2774 Trail-Zeilen vorher wie nachher	Checkzahl unveraendert
2026-08-21T18:23:00Z	fix	Bun.sleep(250)-Umgehungen stehen gelassen	unbestelltes Aufraeumen in derselben Lane	Auftrag "kein Aufraeumen nebenbei"	3 Stellen unveraendert
2026-08-21T19:03:00Z	verify	ein serieller e2e-isolated-Lauf	Write-Set beruehrt e2e/	isolated-20260821T184923Z-2724.jsonl	ALL PASS, 2774 PASS / 0 FAIL
2026-08-21T19:35:00Z	verify	Checkzahl gegen den roten Lauf aufgerechnet	"2765 results" war eine Momentaufnahme, nicht die Endzahl	Namensmengen beider Trails	2774 = 2774, 0 Namen Differenz
2026-08-21T19:40:00Z	verify	volle Gate-Kette gefahren (localProof nannte alle sieben Schritte)	Write-Set beruehrt e2e/	verify-chain.log	7x ALL PASS, 411 PASS / 0 FAIL
```
