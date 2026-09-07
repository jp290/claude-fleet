# Der Landepfad als Puzzle — adversariale Zuverlässigkeitsprüfung des eigenen Land-, Undo-, Audit- und Deploy-Pfads (2026-09-07)

**Quell-SHA (gepinnt):** `c7184f853a3501a4f97e48df3d35e60ed0476b5b` — alle `datei:zeile`-Angaben zeigen auf diesen Baum
(`git show c7184f85:server.ts | sed -n '<a>,<b>p'`). Während der Arbeit zog main nur docs-only weiter (`a273332`,
`9a736da`, `6b0873f`); keine der gelesenen Quelldateien hat sich geändert (`git diff --stat c7184f8..HEAD -- server.ts
server/ verify-proportion.ts e2e-stage.sh e2e/ context-packs.ts e2e-isolated.sh` leer).
**Program:** 6360c361 (Astra-Tagesmandat P3, Sub-Program von e3b3a064). **Autor:** Program-MAIN Slot 4 (Fable 5.1,
dritte Insassin — zwei Astra-Vorgängerinnen scheiterten ohne Artefakt an einer Provider-Sperre beim Lesen von
`mergeJob`). **Fünfter Entwurf** nach vier Astra-Ablehnungen (19, 13, 14 und 12 Punkte) und einer Opus-Gegenlesung (19 Punkte);
alle Listen sind eingearbeitet, die Kernbefunde F1–F8 haben beide Reviewer in jeder Runde bestätigt — die Ablehnungen
trafen Fix-Skizzen, Done-Sätze, Zitate und Überziehungen der Lesart (Runde 3: das F6-Beispiel fiel am Pin
`e2e/pins.ts:398–400`, §6 trägt jetzt eines, das die Pins überlebt). **Verify des Dokuments:**
`bun install --frozen-lockfile && bun e2e/pins.ts` (docs-only).

**Rätsel (Owner-Tagesmandat, wörtlich):** „Finde einen Weg, mit dem ein Land einen Commit verliert, einen roten Baum auf main
bringt, ein Verify-Urteil fälscht, undo-land ins Leere greift oder ein Deploy einen ungemessenen Baum live nimmt."

**Rahmen:** Verifikationsarbeit am eigenen Code — Race-Fenster, Bindungslücken, Unterbrechungen. Kein Live-Server wurde
angefasst; alle Sonden liefen gegen eine Wegwerf-Instanz (eigener tmux-Socket `fleetp3f1`, Port 8931, eigener Suite-Lock,
`FLEET_CMD=true`, Fixture-Repo) oder als **read-only** git-/JSON-Lesungen der Ledger im Haupt-Checkout.

---

## 0. Ergebnis in einem Absatz

Das Rätsel hat für **alle fünf** Formulierungen eine Antwort, und die teuerste liegt nicht in der Fehlerbehandlung,
sondern in einer fehlenden **Bindung**: der Clean-Pfad von `mergeJob` verifiziert einen **Worktree-Zustand** und
fast-forwardet danach einen **Branch-Namen** — nichts zwischen Gate-Start und `advanceIntegration` hält den Lane-Tip
fest. Ein Commit, der während des Gates in die Lane kommt, landet mit `verify.ok:true` (**reproduziert**, drei
Varianten, §1.3): ein Commit, den das Gate nie klassifiziert hat; in der docs-only-Variante entscheiden **beide
Stufen** ihre Kette über einen Baum, der nicht mehr existiert; und mit einem inhaltssensitiven Gate steht danach ein
Baum auf main, auf dem dasselbe Gate-Kommando **rot** ist. Zweitens ist `↩ undo-land` auf dieser Flotte
**praktisch tot**: `recordLand` legt den Stack-Eintrag an und pusht Sekunden später an den Hub;
`remoteHoldsLandedRange` liest genau diesen Tracking-Ref, und die Route eskaliert die Ablehnung zu `killUndoStack` —
der einzige heute undo-bare Eintrag würde beim Druck 409 antworten UND den Stack löschen (F2, **am Live-Repo
read-only gemessen**). Drittens nimmt `POST /api/deploy` den **Working-Tree** des Haupt-Checkouts live, vergleicht
ihn mit keinem gelandeten oder auditierten SHA, blockt nur auf einen *laufenden* Audit und **kann** nach einem
Boot-Crash-Loop `ok:true` schreiben — sobald ein Boot durchkommt, HEAD liest und das Bundle frisch ist (F3). Viertens bindet der Audit sein Urteil an `rev-parse main` **zur Laufzeit**, nicht an
die Covers, die es benennt; ein Undo zwischen Land und Lauf produziert eine grüne Zeile für einen Baum, der das Land
nicht enthält (F4). Dazu: zwei gleichzeitige Lands eines Repos überschreiben sich den Land-Intent-Marker (F5), die
Gate-Kette führt die Skripte des Kandidaten aus (F6), `suiteLockTryTake` kann den unreapbaren Park erzeugen (F7),
und sieben Context-Pack-Anker in fünf DOC_RULE-Dateien werden nur in der vollen Suite geprüft (F8). Ein
Rename-Verdacht („Datei nach `docs/` umbenennen, Kurzkette erschleichen") ist am Code **geschlossen** (§8).

## 0.1 Rangliste

| Rang | Finding | Rätsel-Ziel | Beleg | Verlust |
|---|---|---|---|---|
| 1 | F1 Clean-Pfad bindet keinen Lane-Tip zwischen Gate und ff — inkl. Vererbung der Kettenwahl an Tier 2 | roter Baum auf main · Verify-Urteil über einen anderen Baum · Kettenwahl beider Stufen veraltet | **reproduziert** (3/3 Varianten, Scratch) · Live-Ledger: kein Fall nachweisbar, Ledger kann ihn aber nicht unterscheiden | unklassifizierter Commit auf main mit grüner Note; nachweislich roter Baum (Variante C) |
| 2 | F2 undo-land auf hub-konfigurierter Flotte 409 UND Stack-Tod; transiente git-Fehler eskalieren gleich | undo greift ins Leere | **live gemessen** (read-only): einziger Eintrag komplett auf `hub/main`; 14/14 Notes `hubPush ok`; 344 gedroppte Einträge | Rollback des Tier-2-Designs existiert nicht |
| 3 | F3 Deploy nimmt den Working-Tree, vergleicht nichts, blockt nur `running`, ein Boot-Crash-Loop kann `ok:true` enden | ungemessener Baum live | Argument am Code, Repro-Skizze | „deployed" impliziert keine Messung |
| 4 | F4 Audit bindet `mainSha` zur Laufzeit, nicht an Covers; Remote-`clonedSha` nur Log; Append-Fehler verschluckt; `ran:0` grün | Verify-Urteil falsch (Tier 2) | Argument am Code, Repro-Skizzen | grüne Zeile für fremden Baum; stiller Audit-Verlust |
| 5 | F5 `landPending` je Repo, Lands je Slot: zwei Lands überschreiben den Marker → Boot verwirft ein echtes Land als „unaccounted" | Commit ohne Note/Undo/Audit | Argument am Code, Repro-Skizze (Latch) | Land ohne jede Ledger-Spur |
| 6 | F6 Gate-Kette führt Wrapper UND Runner des Kandidaten aus — ein `process.exit(0)` am Kopf eines Runners ist ein grünes Gate (die Wrapper selbst sind gepinnt, §6) | Verify-Urteil fälschbar | Argument am Code (Designentscheid) | jede Lane kann sich selbst grün schalten |
| 7 | F7 `suiteLockTryTake` kann den unreapbaren Park erzeugen; ererbter Hold ist nicht „für mich"; ff-Absage nennt 45 min bei 0 ms | Maschine parkt · Doppelsuite · falscher Messwert | Argument am Code | jede volle Kette stirbt `waitedOut`, bis ein Mensch `rmdir` tippt |
| 8 | F8 sieben Context-Pack-Anker in fünf DOC_RULE-Dateien; die Kurzkette prüft keinen, die volle Suite die der selektierten Packs — das Rot trifft ein späteres fremdes Code-Land | Verify-Urteil falsch attribuiert | Argument am Code, git-only-Repro | falsches Rot Tage später, falscher Beschuldigter |

Unter der Schnittlinie (§9): Beobachtungen ohne bezifferbaren Verlust.

---

## 1. F1 — Der Clean-Pfad bindet keinen Lane-Tip zwischen Gate und Fast-Forward

### 1.1 Mechanismus (alle Zeilen @c7184f8)

Der Clean-Pfad von `server.ts#mergeJob` (18267) liest die Lane an **vier** Stellen, jede zu einer anderen Zeit, keine
gegen die andere geprüft:

1. `verifyPlanFor` (11920) klassifiziert `git diff --no-renames --name-only <mainSha>...HEAD` (11925) → Plan
   `{cmd, proportional, steps}`. Zeitpunkt T0.
2. `runVerify` (12005) spawnt `sh -c <cmd>` mit `cwd = Lane-Worktree` (12011) — es prüft den **Arbeitsbaum**, wie er
   während T0…T1 auf Platte liegt (uncommittete Edits eingeschlossen); jeder Schritt der Kette sieht den Baum zu
   seiner eigenen Zeit.
3. `markLandIntent(root, main, branch, mainBefore, (await git(root,"rev-parse",branch)).out, prov)` (18693) liest den
   Branch-Tip erst **nach** dem Gate, Zeitpunkt T2 — und vergleicht ihn mit nichts.
4. `advanceIntegration(root, main, branch)` (18695) → `git merge --ff-only <branch>` (3883) bzw. `branch -f main <branch>`
   — fast-forwardet auf den **Namen**, also auf den Tip zu T2+ε.

`prov` (18691) trägt `verify`, `confirmedByHuman:false`, `actor`, `ffRounds` — **kein `candidateSha`**; die Land-Note
(`writeLandNote`, 12647) schreibt `candidateSha` nur, wenn `prov` es trägt. `verify.mainSha` bindet das Urteil an die
Main-Seite, **nichts** bindet es an die Lane-Seite. Die Self-Land-Route liest zwar einen `candidate` (`headRead`, 7356)
für die Duplikatprüfung (7366) und die Antwort, ruft aber `mergeJob(lane, cwd, repo, branch, …)` (7510) mit dem
Branch-Namen.

Kontrast, der zeigt, dass das Repo die Bindung kennt: `confirmResolvedCandidate` (17733) liest
`{mainSha, candidateSha, diffHash}` zweimal (17761 vor dem Replay, 17806 nach dem Ref-Sync) und lehnt mit
`status:"stale"` ab, wenn Tip oder patch-id vom reviewten Stand abweichen; auf dem MAIN-Arm läuft danach noch ein
frisches Verify (Aufruf 17828), dann `markLandIntent` (17859) und `advanceIntegration` (17860). Auch dort bleibt das Fenster
zwischen dem zweiten Identitätsvergleich und dem ff offen — aber es ist ein Vergleich, den der Clean-Pfad gar nicht
hat.

### 1.2 Die Vererbung der Kettenwahl an Tier 2 (docs-only)

`recordLand` (12689) ruft `schedulePostLandAudit(repo, main, branch, mainAfter, prov.verify?.proportional === true)`
(12717; Definition 13564); der Cover trägt `proportional:true`, wenn **das Gate** zu T0 docs-only sah.
`entryRunsShortChain` (12879) entscheidet `covers.every(c => c.proportional === true) && repoRunsShortChain(repo)`, und
`drainPostLandAudits` (13648) fährt dann `VERIFY_PROPORTIONAL_CMD` (11599: `bun install --frozen-lockfile && bun
e2e/pins.ts`) statt `FLEET_POSTLAND_AUDIT_CMD`. Der Audit **re-klassifiziert den gelandeten Bereich nicht** — er
glaubt dem Stempel, den das Gate über einen anderen Baum geschrieben hat. Die Kurzkette kompiliert und startet
keinen Servercode (sie ist `install + pins`); ein `server.ts`-Commit, der so durchrutscht, wird von keiner der beiden
Stufen ausgeführt — das ist ein Argument über die Kette, kein Messergebnis (§1.3 misst die Kettenwahl, nicht die
Blindheit einer Kette gegenüber einer bestimmten Datei).

### 1.3 Beleg: Repro (Scratch-Instanz, 2026-09-07 13:5x, Exit 0)

Skript in §1.6. Drei Varianten, ein Server, Fixture-Repo mit `fleet-e2e.ts` + `e2e/pins.ts` (10 s Sleep, dann `PASS`;
liest nichts — das echte `pins.ts` liest Servertext für seine Pins (`e2e/pins.ts:111`, 1135–1148), führt aber nichts aus;
die Fixture steht für die Kettenwahl, nicht für die Prüfkraft einer Kette), Gate-Kommando
`test ! -f red.marker; R=$?; sleep 20; [ $R -eq 0 ] && echo gate ok; exit $R` — es bewertet den Baum **am Anfang** und
arbeitet dann 20 s (eine echte Kette ist ebenso sequentiell: eine Datei, die einen frühen Schritt betrifft und nach
dessen Bestehen committet wird, hat genau diese Form). Der zweite Commit wird erst gesetzt, nachdem der Server selbst
auf `/api/sessions` eine `suite:"land gate"`-Zeile meldet (`reportServerRun`, 18488), plus 2 s. Diese Zeile erscheint
auch schon während `holdSuiteLock` (18541, innerhalb `gateRun`), vor dem Spawn (18549); in dieser Instanz ist der Lock
privat und frei, das Take dauert Millisekunden — die Zeile ist praktisch der Spawn, ein Beweis des Spawns ist sie nicht.
Das Skript **prüft** je Variante `main == C2`, Note `ok:true`, `verify.mainSha == mainBefore`, kein `ffRounds`, für B
`proportional:true`, für C das Gate-Kommando rot auf einem Snapshot von main und für B die Kurzkette in der Audit-Zeile;
Exit 0 nur, wenn alles hält. Original-Ausgabe (Lauf 3, 2026-09-07 13:1x, gekürzt auf die Urteilszeilen):

```
=== variant A: first commit code.txt, second commit code.txt while the server reports 'running land gate'
C1=4dea5d41…  C2=a67beda4…  (second commit +3s after running:true, after the gate row appeared)
RESULT A: main == C2 — the commit made DURING the gate landed
ASSERT note(A): ok
=== variant B: first commit docs/README.md, second commit code.txt …
C1=7f7c3f15…  C2=35097d72…  (second commit +3s after running:true, after the gate row appeared)
RESULT B: main == C2 — the commit made DURING the gate landed
ASSERT note(B): ok   (proportional:true, steps [install, pins])
--- files changed by the landed range: code.txt  docs/README.md
=== variant C: first commit code.txt, second commit red.marker …
C1=86c8ae2b…  C2=65844220…  (second commit +3s after running:true, after the gate row appeared)
RESULT C: main == C2 — the commit made DURING the gate landed
ASSERT note(C): ok
--- files changed by the landed range: code.txt  red.marker
=== variant C: the SAME gate command, run on a snapshot of main as it is now:
gate on main exits 1 (0 = green, 1 = red)
ASSERT gate-on-main(C): ok
=== post-land audit rows (cmd column shows which chain tier 2 ran): three green rows; B's row:
{'result': 'green', 'mainSha': '35097d72…', 'cmd': '[ -f fleet-e2e.ts ] || { … exit 42; }; bun install --frozen-lockfile && bun e2e/pins.ts', 'covers': [('…', '35097d72', True)]}
ASSERT audit-short-chain(B): ok
done; … failed assertions: 0
exit 0
```

**Lesart, präzise:**
- **A** (voll, Code→Code): main == C2; Note `ok:true`, `verify.mainSha` = `mainBefore`, kein `candidateSha`, kein
  `ffRounds`. Der Commit C2 wurde nie **klassifiziert** und lag dem Gate nur für dessen Restlaufzeit auf Platte.
  Alle drei Notes tragen `candidateSha: None` und `ffRounds: None` (Lauf-2-Ausgabe, byteidentische Struktur).
- **B** (docs-only, Docs→Code): main == C2; Note `proportional:true, steps [install,pins]`; die Audit-Zeile für genau
  diesen Tip trägt als `cmd` die Kurzkette. **Bewiesen:** die Kettenwahl beider Stufen wurde über den Baum zu T0
  entschieden, der gelandete Bereich enthält `code.txt`. **Nicht bewiesen:** dass die Kurzkette eine bestimmte Datei
  nicht sieht — die Fixture-Kette liest nichts; das echte `pins.ts` liest Servertext (`e2e/pins.ts:111`, 1135) und ist
  damit **nicht** inhaltsblind, es führt nur nichts aus. **Stärkste Alternative, vom Transkript nicht ausgeschlossen:**
  der Fixture-Kurzkettenlauf lief im veränderlichen Worktree weiter und meldete PASS, obwohl C2 schon auf Platte lag —
  B belegt die **vererbte Kettenwahl** (Gate-Stempel → Audit), nicht, dass eine echte Kette C2 übersehen hätte.
- **C** (voll, inhaltssensitiv): das Gate bewertete den Baum ohne `red.marker` grün; C2 fügt `red.marker` hinzu;
  main == C2; **dasselbe Gate-Kommando auf einem Snapshot von main endet rot.** Das ist der „rote Baum auf main" des
  Rätsels, gemessen — und der Audit-Stand-in dazu ist grün, weil er ein Stand-in ist. Ob ein echter Audit diesen Baum
  rot gemessen hätte, ist **nicht gemessen** (§12): er fährt `proportional ? VERIFY_PROPORTIONAL_CMD : chosen.cmd`
  (13853), nicht das Gate-Kommando; belegt ist nur das Rot des hier definierten Marker-Kommandos.
- **Alternative Lesarten, ausgeschlossen:** „das erste Verify galt einem anderen main" — nein, `verify.mainSha` =
  `mainBefore` in allen drei Notes, `ms` entspricht je einer Kettenlaufzeit. „Es lief die ff-Retry-Schleife mit
  Re-Rebase und Re-Gate" — nein, `ffRounds` fehlt auf allen drei Notes, main wurde von nichts anderem bewegt.
  „Der zweite Commit lag vor dem Spawn" — praktisch nein (nach der Server-eigenen `land gate`-Zeile + 2 s, bei freiem
  privatem Lock), streng nicht bewiesen (§1.3 oben); für die Kettenwahl (B) ist es ohnehin unerheblich — die
  Klassifikation liegt vor dem Take.

### 1.4 Beleg: Live-Ledger (read-only, 482 Notes mit `verify`)

Sonde: je Note `git log --format=%ct <mainBefore>..<mainAfter>` gegen `verify.startedAt` (bzw. `at - ms`; das
persistierte `startedAt` ist `startedAt - heldWait` (12114) und liegt damit **vor** dem Spawn, wenn der Server für
den Hold gewartet hat — die Sonde misst also „nach Beginn des Gate-Takes einschließlich Schlange", mit 2 s Spielraum).
Ein Commit, dessen **Committer-Zeit** danach liegt, gilt der Sonde als „nach diesem Zeitpunkt erzeugt" — das ist ein
**Metadaten-Indikator**, kein beobachtetes Ereignis: er setzt unveränderte Committer-Zeiten (kein Amend, kein
`--date`), eine gemeinsame Uhr von Server und Lane-Shell und die Pre-Pass-Rebase strukturell davor voraus (§12). Ergebnis: **7 von 396** Lands mit Zeitinformation; alle 7 sind **Confirm-Lands**
(`confirmedByHuman:true`) — 3× nach `ok:false`, 2× nach `waitedOut`, 2× grün mit `stale:true` (`8990fcb7`,
`87c5be66`: der Confirm-Pfad replayte auf ein bewegtes main und stempelte korrekt). **Kein nachweisbarer F1-Fall im
Live-Ledger**, und die sieben Treffer sind **keine** F1-Fälle (Confirm-Pfad, korrekt gestempelt) — aber die Sonde
ist nur an der Committer-Zeit möglich, weil die Note den Lane-Tip zur Gate-Zeit nicht
trägt; ein Amend in derselben Sekunde oder ein Commit unter Hostlast wäre unsichtbar. Das ist selbst ein Befund:
**der Ledger kann F1 nicht unterscheiden.**

### 1.5 Kosten

- Ein Commit auf main, den das Gate nicht klassifiziert und höchstens teilweise gesehen hat, mit einer Note, die
  `ok:true` sagt; in der docs-only-Variante wählt auch Tier 2 die Kette nach dem alten Baum.
- Exponierte Menge live: 60 von 482 Notes fahren die Kurzkette (`proportional:true`) — eine Größe der Klasse, kein
  Maß des Fensters. Das Fenster ist die Gate-**Arbeitszeit**: ~1 s Kurzkette, **109 s** volle Kette (Median von `ms − waitMs` über
  91 nicht-proportionale Land-Notes mit `verify.at ≥ 2026-09-01`, Ledger-Stand 2026-09-07 13:4x; `ms` allein enthält
  die Hold-Wartezeit, 12078, und liegt bei 140 s Median — die Zahl, die man sieht, ist nicht das Fenster), plus bis zu
  45 min Schlange — in der Schlange darf die Lane-Session frei committen, weil der Idle-Gate der
  Route (`canDeliver`, 25810) nur den **Start** bewacht. Schätzung, keine Messung.
- Undo hilft nicht: der Eintrag ist korrekt kontiguierlich; das Rollback trifft, falls es je greift (F2), den ganzen
  Bereich.

### 1.6 Repro-Skript (isoliert; nie `claudefleet`/8790; kein e2e-stage.sh, weil dessen Sourcen den Suite-Mutex nimmt)

```sh
#!/bin/sh
# repro-f1-tip-unbound.sh — P3 Finding 1: the clean land path binds no lane tip between the gate
# and the fast-forward. Runs ONLY against a throwaway instance: private tmux socket, private port,
# private suite lock, FLEET_CMD=true, fixture repo. Never touches the live fleet.
#
# Three variants, one server. The gate command evaluates the tree ONCE at its start, then works
# for 20 s (a real chain is sequential too: a file that matters to an early step, committed after
# that step passed, is exactly this shape):
#   A  full chain, code→code: a second commit lands during the gate; note says ok:true.
#   B  docs-only: lane diff at gate start is docs/ only → the plan is the short chain (fixture
#      pins: 10 s, reads nothing — the real pins.ts reads server TEXT for its pins but executes
#      none of it, so it stands in for the chain CHOICE, not for any chain's power); a CODE commit lands during it, and the post-land audit ALSO runs the
#      short chain because the cover says proportional. What B proves: the CHAIN CHOICE of both
#      tiers is decided on a tree that no longer exists. Not proved: that any specific chain is
#      blind to any specific file.
#   C  full chain, content-sensitive: the gate passes because `red.marker` does not exist at its
#      start; the second commit ADDS red.marker during the gate; main then carries a tree on which
#      the very same gate command is RED. That is "ein roter Baum auf main".
# Each variant commits only after the server itself reports `running land gate` on /api/sessions.
# That row appears while the server TAKES the suite lock too (holdSuiteLock runs inside gateRun); in
# this instance the lock is private and free, so the take is milliseconds and the row is, in
# practice, the spawn — a proof of the spawn it is not, and the 2 s sleep after it is slack.
# Exit code: 0 only if EVERY assertion held: per variant main == C2, note ok:true with
# verify.mainSha == mainBefore and no ffRounds; B's note proportional:true; C's gate command red
# on a snapshot of main; B's audit row ran the short chain. Any miss → exit 1.
#
# usage: sh repro-f1-tip-unbound.sh <fleet-checkout> <scratch-dir>
set -u
SRC="$1"; DIR="$2"
PORT=8931; SOCK=fleetp3f1
[ "$DIR" = "$SRC" ] && { echo "refusing: scratch dir must not be the checkout"; exit 9; }
rm -rf "$DIR"; mkdir -p "$DIR/inst" "$DIR/repo"
INST="$DIR/inst"; REPO="$DIR/repo"

# the pinned source tree, exactly as committed (no e2e-stage.sh: sourcing it takes the suite mutex)
( cd "$SRC" && git archive --format=tar c7184f853a3501a4f97e48df3d35e60ed0476b5b ) | ( cd "$INST" && tar -xf - )
ln -s "$SRC/node_modules" "$INST/node_modules"

# fixture repo: has fleet-e2e.ts (so repoRunsShortChain says yes) and a pins.ts that takes 10 s
( cd "$REPO" && git init -q -b main && git config user.email t@t && git config user.name t \
  && mkdir -p docs e2e vendor/fixture-dep \
  && printf '{"name":"fixture-dep","version":"1.0.0"}\n' > vendor/fixture-dep/package.json \
  && printf '{"name":"fixture","version":"1.0.0","dependencies":{"fixture-dep":"file:./vendor/fixture-dep"}}\n' > package.json \
  && printf '// runner stand-in\n' > fleet-e2e.ts \
  && printf 'await Bun.sleep(10000); console.log("fixture pins PASS");\n' > e2e/pins.ts \
  && printf 'node_modules\n' > .gitignore && printf 'base\n' > docs/README.md && printf 'v1\n' > code.txt \
  && bun install --silent >/dev/null 2>&1 && git add -A && git commit -qm base )

GATE='test ! -f red.marker; R=$?; sleep 20; [ $R -eq 0 ] && echo gate ok; exit $R'
tmux -L "$SOCK" kill-server 2>/dev/null
tmux -L "$SOCK" new-session -d -s srv "cd '$INST' && FLEET_HOST=127.0.0.1 FLEET_PORT=$PORT FLEET_SOCK=$SOCK \
  FLEET_CMD=true FLEET_MODEL= FLEET_INSTANCE=p3-repro FLEET_HARNESS_AUTOMATION=0 FLEET_LANE_AUTOCLOSE=0 \
  FLEET_ANALYSIS_MS=0 FLEET_BRIEF_MS=0 FLEET_AUTO_REVIEW_MS=0 FLEET_BACKLOG_NUDGE_MS=0 \
  FLEET_SUITE_LOCK='$DIR/suite.lock' FLEET_AUDIT_HELPER_GRACE_MS=0 \
  FLEET_VERIFY_CMD='$GATE' FLEET_VERIFY_TIMEOUT_MS=120000 FLEET_VERIFY_WAIT_MS=60000 \
  FLEET_POSTLAND_AUDIT_CMD='echo PASS full-audit-stand-in' FLEET_POSTLAND_AUDIT_TIMEOUT_MS=120000 \
  FLEET_LAND_FF_RETRY_ROUNDS=2 FLEET_DISPATCH_REPO='$REPO' exec bun server.ts >> server.log 2>&1"
tok() { python3 -c "import json;print(json.load(open('$INST/fleet.json'))['token'])" 2>/dev/null; }
i=0; until curl -sf "http://127.0.0.1:$PORT/api/sessions" -H "authorization: Bearer $(tok)" >/dev/null 2>&1; do
  i=$((i+1)); [ $i -gt 60 ] && { echo "server did not come up"; tail -20 "$INST/server.log"; exit 3; }; sleep 1; done
TOKEN=$(tok); api() { curl -s -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' "$@"; }
j() { python3 -c "import json,sys; d=json.load(sys.stdin); print($1)"; }
FAILS=0

run_variant() {  # $1 = A|B|C ; $2 = first-commit file ; $3 = second-commit file
  V="$1"; F1="$2"; F2="$3"
  echo "=== variant $V: first commit $F1, second commit $F2 while the server reports 'running land gate'"
  LANE=$(api -X POST "http://127.0.0.1:$PORT/api/lanes" -d "{\"repo\":\"$REPO\"}")
  SLOT=$(echo "$LANE" | j 'd["slot"]'); CWD=$(echo "$LANE" | j 'd["cwd"]')
  ( cd "$CWD" && printf "$V one\n" >> "$F1" && git add -A && git commit -qm "$V first ($F1)" )
  C1=$(git -C "$CWD" rev-parse HEAD)
  k=0; while :; do
    R=$(api -X POST "http://127.0.0.1:$PORT/api/slots/$SLOT/merge" -d '{}')
    echo "$R" | grep -q '"running":true' && break
    k=$((k+1)); [ $k -gt 40 ] && { echo "merge never started: $R"; FAILS=$((FAILS+1)); return 1; }; sleep 1
  done
  T0=$(date +%s)
  # the server's OWN statement that the gate chain has been spawned (reportServerRun, suite "land gate")
  k=0; until api "http://127.0.0.1:$PORT/api/sessions" | grep -q '"suite":"land gate"'; do
    k=$((k+1)); [ $k -gt 60 ] && { echo "gate never reported running"; FAILS=$((FAILS+1)); return 1; }; sleep 0.5; done
  sleep 2
  ( cd "$CWD" && printf "$V two\n" >> "$F2" && git add -A && git commit -qm "$V second ($F2) during the gate" )
  C2=$(git -C "$CWD" rev-parse HEAD)
  echo "C1=$C1  C2=$C2  (second commit +$(( $(date +%s) - T0 ))s after running:true, after the gate row appeared)"
  k=0; while :; do
    M=$(api "http://127.0.0.1:$PORT/api/slots/$SLOT/merge")
    echo "$M" | grep -q '"running":true' || break
    k=$((k+1)); [ $k -gt 120 ] && { echo "merge never settled"; FAILS=$((FAILS+1)); return 1; }; sleep 1
  done
  echo "--- merge verdict (status/landed/ffRounds/errorReason):"; echo "$M" | python3 -c '
import json,sys; d=json.load(sys.stdin); l=d.get("last") or {}
print({k:l.get(k) for k in ("status","landed","ffRounds","errorReason")}, "detail:", (l.get("detail") or "")[:120])' 2>/dev/null || echo "$M" | head -c 300
  MAIN=$(git -C "$REPO" rev-parse main); echo "main now: $MAIN"
  if [ "$MAIN" = "$C2" ]; then echo "RESULT $V: main == C2 — the commit made DURING the gate landed"
  else echo "RESULT $V: main != C2 (main==C1? $([ "$MAIN" = "$C1" ] && echo yes || echo no))"; FAILS=$((FAILS+1)); fi
  echo "--- land note on main:"
  git -C "$REPO" notes --ref=fleet/land show main 2>/dev/null | python3 -c '
import json,sys; d=json.load(sys.stdin); v=d.get("verify") or {}
print({"mainBefore":d["mainBefore"][:8],"mainAfter":d["mainAfter"][:8],"candidateSha":d.get("candidateSha"),"confirmedByHuman":d.get("confirmedByHuman"),"ffRounds":d.get("ffRounds")})
print({"ok":v.get("ok"),"exitCode":v.get("exitCode"),"proportional":v.get("proportional"),"steps":v.get("steps"),"ms":v.get("ms"),"mainSha":(v.get("mainSha") or "")[:8]})
want_prop = sys.argv[1] == "B"
ok = v.get("ok") is True and v.get("mainSha") == d["mainBefore"] and d.get("ffRounds") is None and (v.get("proportional") is True) == want_prop
print("ASSERT note(" + sys.argv[1] + "):", "ok" if ok else "FAILED")
sys.exit(0 if ok else 1)' "$V" || FAILS=$((FAILS+1))
  echo "--- files changed by the landed range (what the gate classified was the FIRST commit only):"
  git -C "$REPO" diff --no-renames --name-only "$(git -C "$REPO" notes --ref=fleet/land show main | j 'd["mainBefore"]')..main"
}

run_variant A code.txt code.txt
sleep 3
run_variant B docs/README.md code.txt; B_TIP=$(git -C "$REPO" rev-parse main)
sleep 3
run_variant C code.txt red.marker
echo "=== variant C: the SAME gate command, run on a snapshot of main as it is now:"
SNAP="$DIR/main-snapshot"; mkdir -p "$SNAP"; ( cd "$REPO" && git archive --format=tar main ) | ( cd "$SNAP" && tar -xf - )
( cd "$SNAP" && sh -c "$GATE" ); GE=$?; echo "gate on main exits $GE (0 = green, 1 = red)"
[ "$GE" -eq 1 ] && echo "ASSERT gate-on-main(C): ok" || { echo "ASSERT gate-on-main(C): FAILED"; FAILS=$((FAILS+1)); }
echo "=== post-land audit rows (cmd column shows which chain tier 2 ran):"
sleep 25
python3 - "$INST/post-land-audits.jsonl" "$B_TIP" <<'EOF' || FAILS=$((FAILS+1))
import json,sys
rows=[json.loads(l) for l in open(sys.argv[1])]
for d in rows: print({k:d.get(k) for k in ("result","mainSha","cmd")} | {"covers":[(c["branch"][-4:],c["mainAfter"][:8],c.get("proportional")) for c in d.get("covers",[])]})
b=[d for d in rows if d.get("mainSha")==sys.argv[2]]
ok = bool(b) and "bun e2e/pins.ts" in b[0].get("cmd","") and all(c.get("proportional") is True for c in b[0].get("covers",[]))
print("ASSERT audit-short-chain(B):", "ok" if ok else "FAILED"); sys.exit(0 if ok else 1)
EOF
tmux -L "$SOCK" kill-server 2>/dev/null
echo "done; instance kept at $INST (server.log) — repo at $REPO; failed assertions: $FAILS"
[ "$FAILS" -eq 0 ]
```

Exit 0 heißt: alle **acht** Assertions hielten — dreimal `main == C2`, drei Notes (`ok:true`, `verify.mainSha ==
mainBefore`, kein `ffRounds`; B zusätzlich `proportional:true`), das Gate-Kommando rot auf dem main-Snapshot in C,
und für B eine Audit-Zeile mit `mainSha == B-Tip`, deren `cmd` `bun e2e/pins.ts` enthält und deren Covers alle
`proportional:true` tragen. **Nicht** geprüft wird `result === "green"` (ein eigenes Verdict, 14028) oder die Zahl
grüner Audit-Zeilen — der Stand-in-Audit ist Kettenwahl-Beleg, nicht Urteil. Bei behobenem
F1 enden alle drei mit `RESULT … main != C2`, das Verdict ist `error` mit einer Zeile, die den bewegten Tip nennt, main
steht auf `mainBefore`, und das Skript endet mit Exit 1. Was das Skript NICHT prüft: die Kill-Reihenfolge (kein
Prozesstod im Spiel) und den exakten Spawn-Zeitpunkt (siehe oben).

### 1.7 Fix-Skizze und Done-Satz

**Schnitt L1 (Land-Pipeline):** Tip pinnen, SHA fast-forwarden, Tip in die Note, Audit re-klassifizieren.
1. In `mergeJob` unmittelbar nach der git-verifizierten Rebase (vor `verifyPlanFor`): `const tip = rev-parse HEAD` im
   Lane-Worktree; `candidateSha` in `prov` und in `verify` (neues Feld `verify.candidateSha`, analog `mainSha`).
2. `advanceIntegration(root, main, branch, tip)`: `merge --ff-only <tip>` bzw. `branch -f main <tip>`; davor
   `rev-parse <branch> === tip`, sonst Verdict `error` mit `errorReason:"tip-moved"` (neuer geschlossener Enum-Wert
   neben `ff-lost`; `lane-signals.ts#mergeBlocksLane` entscheidet, ob er done-looking blockiert — ja, bis zum nächsten
   ⏫). Jede ff-Retry-Runde liest den Tip nach ihrer Rebase neu und läuft durch dieselbe Prüfung.
3. **Was der SHA-Pin nicht einfriert:** `runVerify` liest weiter den Arbeitsbaum. Vollständig wird die Bindung erst,
   wenn das Gate gegen einen `git archive <tip>`-Snapshot läuft (wie der Audit, `snapshotIntegrationTree`, 13707) —
   das ist der zweite, größere Schritt; Schritt 1–2 schließen den Commit-Fall, nicht den Uncommitted-Fall. **Done für
   Schritt 3:** ein Check, der während des Gates eine uncommittete Datei in den Lane-Worktree schreibt, die das Gate rot
   machen würde, und beweist, dass das Gate grün bleibt (Snapshot) **und** die Datei nicht auf main ist — nicht durch
   eine Ablehnung: der Advance ist `merge --ff-only <branch>` im Holder des Integrationsbranches (3883) und nimmt
   **Commits**, nie Working-Tree-Bytes; der Cleanliness-Check der Lane liegt **vor** dem Gate (18466), ein danach
   schmutziger Lane-Worktree ist für den Advance unsichtbar. Der gepinnte Advance ist also ausdrücklich **zulässig**;
   geprüft wird `main == tip`, `git show main:<datei>` fehlt, Note `verify.candidateSha == tip`. Kein Dirty-Guard —
   er wäre ein zweiter Zaun um Bytes, die der Snapshot schon nicht misst.
4. Der Post-Land-Audit re-klassifiziert **selbst**: `entryRunsShortChain` zusätzlich mit
   `verificationProportionFor(git diff --no-renames --name-only <base>..<mainSha>)`, wobei `<base>` der `mainSha` der
   letzten Audit-Zeile dieses Repos ist (fehlt sie: volle Kette). Der Stempel des Gates wird zur notwendigen, nicht
   hinreichenden Bedingung. (`AuditCover` trägt heute nur `branch, mainAfter, at, proportional?`, 12853 — kein
   `mainBefore`; der Vorschlag braucht keines.)
5. Pins: `advanceIntegration` nimmt ein SHA-Argument; die Note trägt `verify.candidateSha`; `MERGE_ERROR_REASONS`
   enthält `tip-moved`.

**Done-Satz:** Ein neuer Check in `e2e/merge.ts` (Muster `FLEET_TEST_LAND_FF_LATCH`, `e2e/programs.ts:7787`) committet
während des Gates in die Lane und beweist: Verdict `error`/`tip-moved`, main unbewegt, keine Note; ein zweiter Check
prüft Schritt 4 **unabhängig von Schritt 1–2, ohne Rennen und ohne Wartefenster** (eine Grace gibt es für docs-only
nicht: `entryRunsShortChain` → sofort drainbar, 13608, und die Grace verlangt ohnehin einen Helfer, 13592):
**zuerst** ein direkter Code-Commit auf main (kein Land, kein Cover; `state.sh` zählt 31 solche Commits im
Live-Ledger), **danach** ein docs-only-Land (rebased auf diesen Commit; Cover `proportional:true`). Die Audit-Zeile
für den Tip muss die **volle** Kette nennen (`proportional` fehlt, `cmdSource !== "proportional"`), weil
`<letzter Audit-mainSha>..<mainSha>` den Code-Commit enthält. @c7184f8 wählt `entryRunsShortChain` (12879) allein
über die Cover-Stempel → Kurzkette → der Check ist heute rot und wird durch Schritt 4 grün; Schritt 1–2 ändern an ihm
nichts, weil kein Commit während eines Gates fällt und kein Halt nötig ist — die Reihenfolge ist die Isolation. Das Skript in §1.6 endet mit Exit 1 und dreimal
`main != C2`.

**Falsifikator dieses Findings:** ein Aufruf von `advanceIntegration` mit SHA-Argument oder ein Vergleich
`rev-parse <branch>` gegen einen vor `runVerify` gelesenen Tip im Clean-Pfad @c7184f8. Alle drei Aufrufe (3876
Definition, 17860 Confirm, 18695 Clean) nehmen den Branch-Namen.

---

## 2. F2 — `↩ undo-land` greift auf dieser Flotte ins Leere und löscht dabei den Stack

### 2.1 Mechanismus

- `recordLand` (12689): `pushUndo(…)` (12691) **vor** `pushLandToHub` (12706 → 12619: `git push <HUB_REMOTE>
  <mainAfter>:refs/heads/<main>`, ohne `--force`). Der Stack-Eintrag existiert also zuerst; ein erfolgreicher Push
  (Sekunden später) aktualisiert den lokalen Tracking-Ref `refs/remotes/<hub>/<main>` — das Repo pinnt genau das:
  `e2e/land-durability.ts:609/611` (`trackingMain() === one.after`). Zwischen Eintrag und Push-Ende ist undo
  theoretisch möglich; danach nicht mehr.
- Die Undo-Route (25720) prüft nach dem `cur.out === rec.mainAfter`-Gate (25739) `remoteHoldsLandedRange` (12457):
  `rev-list <range> --not --remotes` — jeder Commit, der von **irgendeinem** Remote-Ref erreichbar ist, gilt als geteilt.
- Ein Treffer → `killUndoStack(top.out, "a commit of the … land is on a remote")` (25748) → **Stack gelöscht**, 409.
- Zusätzlich eskaliert die Route **jede** nicht-null-Antwort von `remoteHoldsLandedRange` gleich, auch die beiden
  fail-closed-Zweige „cannot list …"/„cannot tell …" (12460, 12462) — ein `GIT_TIMEOUT_MS`-Ablauf (30 s, 2428; der
  Timer killt den `rev-list`, 2747) unter Suitenlast löscht bis zu drei Rollback-Zeiger, bevor irgendetwas bewegt wurde.
  (`index.lock` ist hier **kein** Auslöser: `rev-list` fasst den Index nicht an; der Index-Lock-Retry an 2761 gilt
  Status/Diff.) Der
  Kontrast steht eine Zeile tiefer: `resetIntegration`-Fehler werden ausdrücklich als transient behandelt (25752,
  „record kept for a retry").

### 2.2 Beleg (Live-Repo, read-only git + zwei `fleet.json`-Felder, 2026-09-07 12:5x)

```
FLEET_HUB_REMOTE   live=hub (state.sh config sensor); git remote: hub origin
undoLands (claude-fleet)   depth 1  [4a87fc67 -> c7184f85]
rev-list 4a87fc67..c7184f85 --not --remotes | wc -l   → 0     (range size 1)
git branch -r --contains c7184f85                      → hub/main (und hub/HEAD -> hub/main); origin hält ihn NICHT
Notes der letzten 60 main-Commits: hubPush ok 14, failed 0, absent 0
undoDrops (claude-fleet)   n=344  why="the next land did not start where the previous land ended (main was left at 189f815b, the next land started at 4a87fc67) …"
```

Lesart: Der **einzige** heute undo-bare Land dieses Repos ist vollständig auf `hub/main`; ein Druck auf ↩ auf dem
Board (das den Knopf rendert, weil `src/client.ts:2584` nur `mg?.undoable` fragt und Remote-Zustand nie) antwortet 409
und löscht den Stack. Alle 14 Lands mit Note in den letzten 60 main-Commits sind erfolgreich gepusht. Über ältere
Lands, frühere Hub-Konfigurationen oder frühere Undo-Versuche sagt die Messung nichts (`pushLandToHub` kann
`ok:false` liefern, 12637 — ein solcher Eintrag bliebe undo-bar). Die 344 gedroppten Einträge sind ein **kumulativer** Zähler
über alle drei Drop-Gründe — Kettenbruch (12429–12432), Kappung auf drei (12436), `killUndoStack` (12447) — mit nur dem
**jüngsten** `why` (12406); der jüngste Grund ist ein Kettenbruch, der laut Code durch einen Direkt-Commit auf main
**oder** ein konkurrierendes Land entstehen kann (12417). Eine Ursachenhistorie je Drop gibt es nicht; die Zahl belegt
den Umfang, nicht die Todesart.

### 2.3 Kosten

Das Tier-2-Design nennt ↩ undo-land als **das** Rollback („Rollback stays the owner's ↩ undo-land", 12776). Auf einer
hub-konfigurierten Flotte greift es ab dem erfolgreichen Push nicht mehr, und der erste Versuch zerstört die
Information, die ein Hand-Revert bräuchte (`mainBefore`/`mainAfter` je Land — die Note bleibt, die Kette nicht). Das
Regelbuch („`undo-land` reicht nur DREI Lands tief") beschreibt eine Tiefe, die live 1 ist und beim Druck 0 wird.

### 2.4 Repro-Skizze (nicht gefahren; Scratch-Instanz)

Fixture-Repo + `git init --bare hub.git`, `git remote add hub …`, Server mit `FLEET_HUB_REMOTE=hub`. Lane öffnen,
committen, landen (Note trägt `hubPush.ok:true`). `POST /api/repos/undo-land {repo}` → erwartet 409 „already on a
remote", danach `fleet.json#undoLands` ohne Eintrag und `undoDrops.why` mit „on a remote". Dreimal landen, einmal
drücken → drei Einträge weg. Für die Eskalation: `chmod 000 <repo>/.git/objects` für die Dauer des POST → 409 mit
„cannot list …" und geleerter Stack; Rechte zurück, Eintrag bleibt weg.

### 2.5 Fix-Skizze und Done-Satz

**Schnitt L2 (Land-Pipeline):**
(a) `remoteHoldsLandedRange` gibt ein **dreiwertiges** Ergebnis `{shared:true, detail} | {shared:false} |
{unknown:true, detail}`; die Route killt nur bei `shared:true`, antwortet bei `unknown` 409 und **behält** den Eintrag.
(b) Der Hub ist **unser eigenes** Bare-Repo (W5b). Ein Undo, dessen Bereich ausschließlich auf
`refs/remotes/<HUB_REMOTE>/*` liegt, läuft unter dem **Repo-weiten Land-Mutex aus L5** (derselbe, der
`markLandIntent…recordLand` schützt). **Modell, einmal festgelegt:** ein **Land** wartet an diesem Mutex (bounded,
Sekunden — es ist ohnehin ein langer Job), ein **Undo** wird bei belegtem Mutex mit 409 `land in flight` abgewiesen und
behält den Eintrag (ein Undo ist ein Owner-Klick, der Retry kostet nichts). Reihenfolge unter dem Mutex: (1) Hub zurück, **atomar mit Erwartungswert**: `git push <hub>
--force-with-lease=refs/heads/<main>:<mainAfter> <mainBefore>:refs/heads/<main>` — die Lease lehnt ab, wenn der Hub-Tip
nicht mehr `mainAfter` ist (ein Commit von anderswo ist angekommen) → 409, Eintrag behalten, nichts bewegt; (2) lokal
**ebenfalls mit Erwartungswert**: auf dem Holder-Pfad bleibt `resetIntegration`s `cur.out === mainAfter` (3904) plus
`reset --hard` unter dem Mutex; auf dem Pfad ohne Holder ersetzt `git update-ref refs/heads/<main> <mainBefore>
<mainAfter>` (Compare-and-swap mit altem Wert) das heutige `branch -f` (3910), das keinen Erwartungswert kennt.
Scheitert (2) nach erfolgreichem (1), meldet die Route beide Zustände getrennt (Hub zurück, lokal nicht) und behält den
Eintrag. Hält ein **anderer** Remote den Bereich: wie heute ablehnen. Kein separater `ls-remote`-Vorcheck — die Lease
ist der Check.
(c) Der Board-Knopf fragt `undoable` erst nach einer server-seitigen Vorprüfung (`GET /api/slots/:id/merge` liefert
`undoable:{ok, why}` mit denselben drei Werten wie (a)).

**Done-Sätze:** `e2e/land-durability.ts` erhält vier Checks: (1) Land mit `hubPush.ok:true`, dann undo-land → 200,
Hub-Tip = `mainBefore`, lokal = `mainBefore`, Stack-Tiefe um 1 kleiner; (2) Land, dann ein **fremder** Commit auf den
Hub (`git push hub` aus einem zweiten Klon), dann undo-land → 409 mit Lease-Ablehnung, Hub unverändert, Stack
unverändert; (3) `rev-list` schlägt fehl (unlesbare Objekte) → 409 „unknown", Stack unverändert; (4) ein **lokales**
Land, das während des Undos advanct (`FLEET_TEST_LAND_PAUSE_MS` auf dem Land, Undo-POST in der Pause): der Undo
antwortet **409 `land in flight`** und ändert nichts (Stack-Tiefe, Hub-Tip, lokaler Tip unverändert), das Land
terminiert normal mit Note; danach ein zweiter Undo-POST → 200 und beide Tips auf `mainBefore` des Lands. Gegenrichtung
(Undo hält den Mutex, Land-POST trifft ein): das Land wartet und liest **danach main neu** — sein `landMain` stammt
von vor dem Gate (18478, 18676) und wäre nach einem Undo veraltet; ein Mutex allein aktualisiert es nicht. Ist main
jetzt ein **Vorfahr** von `landMain` (zurückgespult), endet das Land mit Verdict `error`/`main-rewound`, ohne
Advance, ohne Note — ein Re-Rebase würde die zurückgenommenen Commits, die die Lane seit ihrer Rebase als Vorfahren
trägt, still wieder einspielen; das Re-Land ist ein neuer Owner-Akt. Ist main **vorgezogen** (kein Undo, ein anderes
Land), greift die bestehende ff-Retry-Runde (Re-Rebase + Re-Gate). Check: Undo in der Pause eines Lands mit
`FLEET_TEST_LAND_FF_LATCH` vor dem Advance → Verdict `error`/`main-rewound`, main == Undo-Ziel, keine Note.
In allen Fällen steht main nie auf einem SHA, den weder Note noch Undo-Eintrag beschreibt. Für (c): ein Check,
dass `undoable.ok:false` mit `why` geliefert wird, wenn der Bereich auf dem Hub liegt und keine Lease möglich ist.

---

## 3. F3 — `POST /api/deploy` nimmt den Working-Tree live und vergleicht ihn mit nichts

### 3.1 Mechanismus (verifiziert am Code, Zeilen @c7184f8)

- `deployRun` (23294): Blocker (23295) → Marker-Alter (23297–23308) → **eine** git-Lesung `rev-parse HEAD` (23310–23314,
  `target`) → Build (`runDeployBuild()` 23319; der Spawn `sh -c $FLEET_DEPLOY_BUILD_CMD` mit cwd = Haupt-Checkout
  steht in der Definition, 23231) → Marker → Restart. Kein
  `status --porcelain`, kein Branch-Vergleich, keine Lesung von `post-land-audits.jsonl`, `lastPostLandAudit` oder
  einer Land-Note. `watchdog.sh:154-155` startet `bun server.ts` **aus dem Verzeichnis** — der Restart re-exekutiert
  Bytes auf Platte, keinen SHA und keinen Branch.
- `judgeDeploy` (23161): `ok` beginnt bei `true` ohne `extra` (23167), fällt auf `false` bei `bootHead !== head` oder
  `bundle.stale` und auf **`null`** bei unlesbarem HEAD oder unbestimmbarem Bundle-Zustand (23168, 23176). `bundleStale` (23024–23031) vergleicht **Mtimes** von `public/*.js` gegen `src/` — kein Inhalts-,
  kein Commit-Nachweis (uncommittete `src/`-Edits zählen mit, uncommittete `server.ts`-Edits gar nicht). Ein
  schmutziger Tree, ein fremder ausgecheckter Branch oder ein `server.ts`-Direkt-Commit erfüllt beide Tests →
  `ok:true, hitTarget:true`. `hitTarget` (23186) fließt nicht in `ok` ein.
- `deployBlocker` (23212): blockt auf `mergeStart`/`mergeInflight`, `runningPostLandAudit`, `auditDraining`. **Nicht**
  geblockt: ein letzter Audit, der ROT war; ein Tip ohne Audit-Zeile; ein per Helfer geclaimter Audit (der Drain
  verlässt die Schleife, `auditDraining` fällt im `finally`, 13666).
- `resolveDeployMarker` (23198): kein Alters-/Lebendigkeits-Check; `DEPLOY_INFLIGHT_MAX_MS` (23083) gilt nur im
  Preflight eines **lebenden** Prozesses. Stirbt der neue Server vor Zeile 23368 (vier fatale Modul-Awaits davor:
  `claimInstanceLock` (Modul-Aufruf 21191; Wettlauf-Exit 21171/21185), `tmux start-server` 21205, `finishLandsInFlight` 21833,
  `recoverInterruptedProgramFoundings` 21871), respawnt `watchdog.sh:111-164` alle 5 s; der erste Boot, der
  durchkommt, schreibt `stage:"boot"` mit `ok:true`, **sofern** er HEAD liest und das Bundle frisch ist (sonst `null`,
  23168/23176; `false` nur bei HEAD-Abweichung oder altem Bundle) — die Zeit im Crash-Loop steht nur in `ms`, das kein
  Konsument liest.
- Der Blocker wird **einmal** vor einem bis zu 300 s langen Build geprüft (23319); ein Land, das im Build-Fenster
  startet, wird vom Kill getroffen (Signal-Handler 17516: `releaseSuiteLock(); process.exit(0)`); der Merge-Pfad liest
  den Deploy-Zustand nirgends.

### 3.2 Kosten

„Deployed" trägt keine Aussage, dass der Baum je gemessen wurde — weder Gate noch Audit noch Commit. Ein Deploy während
eines Gates kostet bis zu 8 min Arbeit (`FLEET_VERIFY_TIMEOUT_MS=480000`) plus 45 min Schlange und lässt die Lane
potenziell mid-rebase (die Wedge-Meldung 3055/21840 nennt genau diese Ursache).

### 3.3 Repro-Skizze (nicht gefahren)

Scratch-Instanz mit `FLEET_REPO_DIR=<fixture>`, `FLEET_DEPLOY_BUILD_CMD='printf x >> buildruns'`,
`FLEET_DEPLOY_RESTART_CMD=true`: eine uncommittete Zeile an `<fixture>/server.ts` anhängen, `POST /api/deploy`, Boot →
`GET /api/deploys` zeigt `ok:true, hitTarget:true` bei nicht-leerem `git status --porcelain`. `e2e/deploy-facts.ts`
konstruiert den Fall nicht (jedes `openGap()` committet zuerst, 218–227).

### 3.4 Fix-Skizze und Done-Sätze

**Schnitt L3 (Fleet-Betrieb f170dc46, Vorschlag via Controller):** (a) Deploy-Preflight liest `status --porcelain`
(nur getrackte Server-Dateien: `isServerCode`, 22912) und den ausgecheckten Branch; schmutzig oder ≠ Integrationsbranch
→ 409 mit Dateiliste. (b) `target` muss eine Land-Note tragen **oder** der Owner sendet `{"unmeasured":true}` — der
Boot-Row-`ok` wird `null` mit Grund „no land note on target", nie `true`. (c) Ein RED-Audit auf dem Tip blockt wie ein
laufender — **repo-bezogen**, nicht über `lastPostLandAudit` (das ist eine repoübergreifende Variable, 14055/15223, die
ein späteres Audit eines anderen Repos überschreibt), sondern über `newestAuditFor(repo, target)` (Definition 5651; 11128 ist ein Aufrufer) — die Funktion liefert die
**rohe** Zeile ohne Urteil; das Urteil kommt getrennt aus `adjudicationsByAudit()` (15562, `Map<auditAt, …>`), also:
`row.result === "red" && !(await adjudicationsByAudit()).has(row.at)`. Ohne diesen Join blockte (c) auch schon
beurteilte rote Zeilen. (d) `resolveDeployMarker`
schreibt `ok:null` mit Grund „marker older than DEPLOY_INFLIGHT_MAX_MS — cause unknown (a boot may have failed, the
restart may have been delayed, the machine may have slept)", wenn `Date.now() - m.at > DEPLOY_INFLIGHT_MAX_MS`
(`m.at` wird nach dem Build gesetzt, 23337) — das Alter ist messbar, die Ursache nicht. (e) **nach** dem Build zweierlei: `deployBlocker` erneut (ein Land, das über das Build-Ende hinausläuft) **und**
`rev-parse HEAD` erneut gegen `target` (ein Land, das **innerhalb** des Builds begann und endete, ist für den Blocker
unsichtbar — `deployBlocker` sieht nur `mergeStart`/`mergeInflight` **jetzt**, 23213 — hat aber main bewegt); Treffer in
einem von beiden → Marker nicht schreiben, 409 mit Grund (`land in flight` bzw. `HEAD moved during the build:
<target>→<now>`).

**Done-Sätze (je einer, `e2e/deploy-facts.ts`):** (a) schmutziger Tree → 409 mit Dateiname; (b) Tip ohne Note →
Boot-Row `ok:null`; (c) RED-Tip in DIESEM Repo → 409, ein späteres Grün eines ANDEREN Repos hebt das nicht auf, und **derselbe RED-Tip
nach `POST /api/post-land-audits/adjudicate` → 200** (der Join, nicht die rohe Zeile, entscheidet); (d) Marker mit `at` älter als `DEPLOY_INFLIGHT_MAX_MS` beim Boot → Row `ok:null`
mit dem Grund; (e1) Land, das über das Build-Ende hinausläuft (Build = `sleep 20`, Lane-Kette `sleep 40`, Merge-POST im Fenster) →
kein Restart, 409 `land in flight`, Verdict des Lands normal terminal; (e2) Land, das **im** Build beginnt und endet
(Build = `sleep 60`, Fixture-Kette 5 s) → kein Restart, 409 `HEAD moved during the build`, `GET /api/deploys` ohne
Boot-Row für diese Id.

---

## 4. F4 — Der Post-Land-Audit bindet sein Urteil an die Laufzeit, nicht an das, was er benennt

### 4.1 Vier Lücken, eine Klasse (Zeilen @c7184f8)

1. **Kein Ancestry-Guard Covers→mainSha.** `runPostLandAudit` liest `rev-parse main` **beim Start** (13876–13877) und
   kopiert `covers` unverändert in die Zeile. Keiner der `is-ancestor`-Aufrufe in `server.ts` liegt im Audit-Pfad.
   Die Undo-Route (25720) fasst weder `auditQueue` noch das Ledger an. Sequenz: Land X (Cover `mainAfter:S1`) wartet
   (Helfer-Grace, Claim, Drain in anderem Repo, Boot) → ↩ undo → main = S0 → Audit archiviert S0 → Zeile
   `mainSha:S0, green, covers:[X]`; `auditRowMatches` (5637–5639) feuert den Audit-Watch von X **grün** über den
   `covers.some`-Zweig; `state.sh` druckt „green on S0 covering [X]". Milder dieselbe Klasse: ein Direkt-Commit auf main
   zwischen Land und Lauf legt einen nie gegateten Baum unter die Cover-Namen.
2. **Remote-Bindung ist Log, kein Gate.** `helperResult` (15175): Zeile trägt `mainSha: claim.mainSha` (15210), der
   vom Helfer gemeldete `clonedSha` ist optional (15203) und wird nur in eine `audit()`-Zeile verglichen
   (15248–15254, „It changes NO verdict"); `console.log` nur bei `result !== "green"` (15255). Weder `auditEventPayload`
   (5660) noch `postLandAuditSummary` (14078) noch `programStatusView.lastAudit` (6869–6875) tragen `clonedSha`. Der
   Daemon erzwingt den Vergleich auf seinem **Update**-Pfad (`helper-daemon/daemon.ts:662`), nicht auf dem Audit-Pfad.
   Eine Suite, die einen divergenten `clonedSha` auf dem **Audit**-Pfad postet und das Verdict prüft, gibt es nicht
   (die Stellen in `e2e/watch.ts`/`e2e/helper-daemon.ts` betreffen Command-Jobs, `job?.kind === "command"`).
3. **Der Append kann still scheitern — auf beiden Pfaden, remote zusätzlich in der falschen Reihenfolge.**
   `server/persist.ts:35`: `appendEvent` = `queueEventWrite(file, obj).catch(() => undefined)` — ein aufgelöstes
   `await` beweist keinen geschriebenen Eintrag. Lokal: Zeile schreiben (14063) → Covers splice (13656): bei
   Schreibfehler werden die Covers trotzdem verbraucht. Remote: Covers splice + `savePostLandAuditQueue()`
   (15230–15238, `writeFileSync`+`renameSync`) → **danach** `await appendEvent` (15242): zusätzlich ein Prozesstod
   dazwischen verliert Covers und Zeile. Der Schreibfehler landet einmal in `logError("eventLog")` (`server/persist.ts:30`) und damit in `errors` auf
   `/api/sessions` (`server/errors.ts:64`, `server.ts:25051`) — ein Diagnosekanal, kein Audit-Surface: der Aufrufer
   bekommt keine Ablehnung, verbraucht die Covers, und der einzige Alterssensor `postLandAuditLive.waiting`
   (14114–14119) sieht nur Covers, die noch in der Queue sind.
4. **`ran:0` grün ist nicht verhindert.** `postLandAuditChecks` (13816) lehnt drei Widersprüche ab (13835, 13836, 13839),
   keiner prüft `ran === 0`; der letzte Arm der Verdict-Kette setzt bei `exitCode === 0` `result = "green"` (14028),
   nach den Armen `killed`/42/126/127. Gepinnt ist nur die **rote** Variante (`fleet-e2e-postland-audit.ts:840`). Das
   ist die `613faa3`-Klasse, die das Regelbuch zweimal benennt — erkennbar über `ms`, nicht verhindert.

### 4.2 Kosten

Ein grünes Urteil über einen Baum, der das benannte Land nicht enthält, genau in der Sequenz, in der der Owner am
ehesten hinsieht (nach Undo, nach Hand-Commit). Ein Helfer-Grün ohne jeden Beleg, welcher Baum gemessen wurde. Ein
Land, das Tier 2 still verlässt. Und `checks{ran:0}`+`green` bleibt schreibbar.

### 4.3 Repro-Skizzen (nicht gefahren; alle Scratch)

(1) `FLEET_POSTLAND_AUDIT_CMD='sh -c "echo PASS x; exit 0"'`, `FLEET_AUDIT_HELPER_GRACE_MS` hoch, Lane landen, während
der Cover in `postLandAuditLive.waiting` steht `POST /api/repos/undo-land`, Grace ablaufen lassen → Zeile `green`,
`covers[0].mainAfter` kein Vorfahr von `mainSha`. (2) Helfer enrollen, Job claimen (die Claim-Antwort trägt die zwölfstellige `jobId`; ohne gültige `jobId` antwortet
`helperResult` 400, 15176–15177), Bundle **nicht** laden, `POST /api/helper/result {jobId, exitCode:0, tail:"PASS x"}`
ohne `clonedSha` → grüne Zeile ohne `remote.clonedSha`; mit `clonedSha:"f"*40` → Event-Payload byteidentisch zum
passenden Fall. (3) `POSTLAND_AUDIT_FILE` ist eine **Konstante** unter `import.meta.dir` (155), kein Knopf — in der
Scratch-Instanz also per Dateisystem: `post-land-audits.jsonl` im Instanzverzeichnis durch ein **Verzeichnis** gleichen
Namens ersetzen (oder `chmod 000` auf die Datei) → `appendEvent` scheitert still, Queue-Datei ist verbraucht, keine
Zeile — lokal wie remote. (4) `FLEET_POSTLAND_AUDIT_CMD='sh -c "sleep 1; exit 0"'` → `{green, checks:{ran:0}}`.

### 4.4 Fix-Skizze und Done-Sätze

**Schnitt L4 (Audit-Determiniertheit 79036e9a, nicht Land-Pipeline — Querverweis §10):** (a) `runPostLandAudit` prüft
je Cover `merge-base --is-ancestor <mainAfter> <mainSha>`; Nicht-Vorfahren werden aus `covers` in ein neues Feld
`coversOrphaned` verschoben und der Watch-Join (`auditRowMatches`) liefert für sie `unknown` mit Grund. (b) Remote:
`clonedSha` **Pflicht** für `green`; fehlt er oder weicht er ab → `result:"unknown"`, Grund „helper measured
<clonedSha|nothing>, filed under <mainSha>". (c) beide Audit-Pfade nutzen das **vorhandene** `appendEventStrict` (`server/persist.ts:39`, in `server.ts:99`
importiert) statt `appendEvent`; Reihenfolge: Append → bei Erfolg `lastPostLandAudit = row` (heute vor dem Append,
14055/15223) → Covers splice; bei Fehler: Covers bleiben, `lastPostLandAudit` unverändert, eine `audit()`-Zeile
`postland_audit_unwritten` mit Grund, und der Eintrag wird beim nächsten `kickAuditDrain` (Claim-Ablauf, Helfer-Report,
Boot) erneut gefahren — der Auslöser des Fortschritts ist damit benannt: Boot oder nächster Kick, kein eigener Timer. (d) `postLandAuditChecks`: `exitCode === 0 && ran === 0 && completeOutput` →
`null`, und `checks === null` bei vollständiger Ausgabe → `result:"unknown"` („measured nothing").

**Done-Sätze (`fleet-e2e-postland-audit.ts`):** (a) Undo vor dem Lauf → Zeile mit `coversOrphaned`, Watch liefert
`unknown`; (b) divergenter/abwesender `clonedSha` → `unknown`; (c) Ledger-Datei unschreibbar → Covers bleiben in der
Queue-Datei, `lastPostLandAudit` unverändert, `audit.jsonl` trägt `postland_audit_unwritten`; nach Reparatur und einem
Boot entsteht die Zeile; (d) `exit 0` ohne PASS → `unknown`.

---

## 5. F5 — Zwei Lands eines Repos überschreiben sich den Land-Intent-Marker

**Mechanismus:** `landPending` ist `Map<repoToplevel, LandPending>` (12482), `markLandIntent` (12676) setzt den Schlüssel
ohne zu prüfen, ob er belegt ist; die Serialisierung von Lands ist **slot**-keyed (`mergeInflight`/`mergeStart`), und
der Suite-Mutex hält seit M5 nur die **volle** Kette (docs-only nimmt ihn nicht: 18535–18537, `!gateProportional`).
Zwei Lands A (voll) und B (docs-only) desselben Repos laufen also parallel; B markiert **nach** A und überschreibt A's
Marker. A advanct, stirbt vor `recordLand` (Deploy-Kill, F3) → Boot: `finishLandsInFlight` (12735) findet B's Marker,
main steht auf A's Tip = weder B's `mainBefore` noch B's `laneTip` → dritter Zweig (12750): „UNRECORDED and not
undoable" — A's Land hat keine Note, keinen Undo-Eintrag, keine Audit-Zeile, keine Outcome-Zeile.

**Beleg:** Argument am Code (Map-Schlüssel + fehlender Guard gelesen; der Kommentar an 12674 setzt „one in flight at a
time" voraus, nichts erzwingt es). Nicht reproduziert. **Repro-Skizze (nicht gefahren; Scratch):** der Marker wird erst **nach** dem Gate geschrieben (18693,
unmittelbar vor `advanceIntegration`); wer ihn überschreibt, ist also das Land, dessen Gate **später endet**, nicht das
schnellere. Die Sequenz braucht deshalb kein Rennen: `FLEET_TEST_LAND_PAUSE_MS=120000` (prozessweit; die Pause liegt
**nach** `advanceIntegration` und **vor** `recordLand`, 18764 — genau das Fenster, und sie gilt für **jedes** Land
dieses Prozesses). (1) Lane B (docs-only, Kurzkette ~1 s) landen; **Eintritt bestätigen:** `rev-parse main == B-Tip`
und `GET /api/slots/<B>/merge` noch `running` (B steht in seiner Pause; B's Marker liegt, `mainBefore` = alt). (2) In
dieser Pause Lane A (Code, volle Kette = `sleep 20`) landen: A's Gate endet nach ~20 s, A's `markLandIntent`
**überschreibt** B's Marker, A's `advanceIntegration` fast-forwardet B-Tip → A-Tip; **Eintritt bestätigen:**
`rev-parse main == A-Tip` (A steht jetzt in seiner eigenen Pause, B's Pause hat noch ≥ 90 s). (3) **Kontrollierter
Halt:** jetzt `tmux -L <scratch> kill-session -t srv` — beide Lands stehen bestätigt zwischen Advance und
`recordLand`, keine feste Pause muss „passen", nur `Pause ≫ A-Kette` (120 s ≫ 20 s). Boot: der Marker ist A's
(`mainBefore` = B-Tip, `laneTip` = A-Tip), main steht auf A-Tip → `finishLandsInFlight` **zeichnet A auf** (zweiter
Zweig) — und **B's Land ist unrecorded**: main hat sich von B's `mainBefore` wegbewegt, B's Marker existiert nicht
mehr, keine Note auf B-Tip, kein Undo-Eintrag für B, keine Audit-Zeile mit B's Cover. Das ist der Verlust — als Skizze,
nicht gemessen.

**Kosten:** ein gelandeter Commit ohne jede Ledger-Spur außer einer `audit.jsonl`-Zeile — der Zustand, „den kein
Ledger beschreibt".

**Fix-Skizze (L5, Land-Pipeline):** `markLandIntent` lehnt ab, wenn `landPending.has(repo)` und der Eintrag jünger als
`VERIFY_WAIT_MS + VERIFY_TIMEOUT_MS` ist → Verdict `error` „another land of this repo is between its gate and its
record"; besser: ein Repo-weiter Land-Mutex um `markLandIntent…recordLand` (Sekunden, kein Suite-Lock), an dem ein
zweites **Land wartet** (bounded) und ein **Undo abgewiesen** wird — dasselbe Modell wie L2(b). **Done-Satz:** Check in
`e2e/land-durability.ts` nach der Skizze oben (B pausiert nach Advance, A landet in der Pause, Kill, Boot): A's Gate
endet, A **wartet** am Mutex (Note fehlt, main == B-Tip), bis B's Pause endet und B seine Note schreibt; danach advanct
A. Nach Kill und Boot in A's Pause: **jeder** Commit in `rev-list <main-vor-B>..<main-nach-Boot>` liegt in genau einer
Land-Note und in genau einem Undo-Eintrag (B's Note vor dem Kill, A's aus `finishLandsInFlight`). Ein
`interrupted`-Verdict (18349–18351 wird vor der Rebase persistiert) zählt ausdrücklich **nicht** als Aufzeichnung.

---

## 6. F6 — Die Gate-Kette führt die Skripte des Kandidaten aus

`FLEET_VERIFY_CMD` (watchdog.sh:91) und `VERIFY_PROPORTIONAL_CMD` (11599) laufen mit `cwd = Lane-Worktree` (12011) und
rufen `bun e2e/pins.ts`, `./e2e-clean-review.sh`, `./e2e-security.sh`, `./e2e-claude-gate.sh` — Dateien **des
Kandidaten**. Ein **vollständiger Wrapper-Ersatz** durch `exit 0` fällt an Stufe 1: `e2e/pins.ts:364–367` verlangt je
Wrapper den Runner-Aufruf `bun fleet-e2e-*.ts` **als Text** und `exit $code` als letzte Nicht-Kommentar-Zeile (der
Decapitation-Pin aus `613faa3`), 398–400 die PORT-Deklaration aus der Band-Tabelle (`e2e-isolated.sh:33`), 338–339
das Paar `stage_instance`/`. e2e-stage.sh`. Das sind **Textprüfungen** — sie beweisen keine Erreichbarkeit: ein
Wrapper, der `code=0` nach dem Runner-Aufruf setzt, trägt beide Zeilen und endet grün. Widerlegt ist allein der
Vollersatz, nicht die Angriffsklasse. Der kürzeste Weg ist trotzdem der **Runner**: kein Pin liest
`fleet-e2e-security.ts` oder `fleet-e2e-claude-gate.ts` (`e2e/pins.ts` liest von den Runnern nur
`fleet-e2e-clean-review.ts`, 4394/4410, und dort zwei Strings), und `tsc --strict` meldet unerreichbaren Code ohne
`allowUnreachableCode:false` nicht als Fehler. **Das Beispiel, das die Pins überlebt:** ein Commit, der in
`fleet-e2e-security.ts` nach den Imports `process.exit(0)` einfügt (Wrapper byteidentisch: PORT-Zeile, Staging,
Runner-Aufruf, `exit $code` alle intakt) — der Wrapper startet seinen Server, ruft den Runner, der Runner beendet sich
mit 0, `exit $code` propagiert 0: grünes Gate ohne eine gemessene Zeile. Gleiches für das Entfernen einzelner
`check(…)`-Aufrufe in `e2e/*.ts` (Clean-Review-Kette) oder im Security-Runner. Der Post-Land-Audit fährt
`./e2e-isolated.sh` aus dem Snapshot **desselben** Baums (13890, `cwd: dir`) — aber einen **anderen** Runner:
`bun fleet-e2e.ts` (`e2e-isolated.sh:839`), der `./e2e/security` als Modul importiert (`fleet-e2e.ts:48`);
`fleet-e2e-security.ts` ist ausdrücklich „not a module of the main suite" (Zeile 2). Das `process.exit(0)`-Beispiel
schaltet also das **Gate** grün und lässt Tier 2 unberührt; wer beide Stufen will, entfernt `check(…)`-Aufrufe in
`e2e/security.ts` (Kandidatenbytes, die beide Runner-Familien nicht teilen, aber beide aus dem Kandidaten laden).
Beide Stufen messen also, was der Kandidat zu messen erlaubt — jede mit ihren eigenen Kandidatendateien. Das ist ein Designentscheid (Tests müssen den Kandidaten testen) und
im eigenen Betrieb keine Bosheit, aber die Klasse ist real und bezahlt: „eine Sonde, die nicht laufen konnte, muss als
SIE SELBST scheitern" (Regelbuch) beschreibt genau den versehentlichen Fall. **Nicht reproduziert, Argument am Code.**

**Kosten:** jede Lane kann sich selbst grün schalten; der Ledger sieht `ok:true`. **Fix-Skizze (L6, klein):** ein
Vergleichswert, der **nicht** im Kandidaten liegt und **nicht** aus `verify.out` kommt — das ist auf `VERIFY_OUT_CAP`
(2048 B, 11725) gekürzt (`retainRunOutput`, 12107) und `suiteWait` zählt Lock-Erwerbe, keine Checks (11837).
Stattdessen zählt `runVerify` im **Stream** (`onLine`, 12063ff — er liest jede Zeile, bevor die Kürzung greift) die
`PASS`-Zeilen **je Wrapper** (getrennt an der `[suite-lock] <wrapper> acquired`-Zeile, die jeder Wrapper genau einmal
druckt) und schreibt sie als **Zahlen** `verify.passLines:{"e2e-clean-review.sh":n,…}` auf Verdict und Note. Baseline
ist die **jüngste volle grüne Land-Note von main** mit `passLines` (eine proportionale Note trägt keine Wrapper und
dient nie als Baseline; fehlt jede → kein Stempel, aber `verify.passBaseline:"none"`). `checksBelowMain:true`, wenn
ein Wrapper unter 80 % seiner Baseline liegt; der Clean-Pfad behandelt das wie Rot (Stop-and-review). Kein
`grep -c 'check('` in `pins.ts` — das findet dort nichts, weil Pins `pin(` heißen.

**Was L6 ist und was nicht — ausdrücklich NICHT behoben:** die Baseline liegt außerhalb des Kandidaten, die **Messung
nicht** — `runVerify` zählt Zeilen, die der Kandidat druckt (12011, `cwd` = Lane; die `acquired`-Zeile kommt aus dem
Kandidaten-`e2e-stage.sh:348`). Ein Runner, der die Baseline kennt (sie steht in `git notes --ref=fleet/land` auf
main) und `N` Zeilen `PASS …` plus die passende `[suite-lock] … acquired`-Zeile druckt, dann `exit 0`, erhält keinen
Stempel. Und die 80-%-Schwelle lässt bis zu 20 % Prüfverlust je Wrapper **unbemerkt** durch. L6 ist damit ein
**Mengenindikator gegen den versehentlichen Fall** (Enthauptung, gelöschte Checks, ein Runner, der früh stirbt) — kein
Integritätsnachweis gegen einen Kandidaten, der zählen kann. Die Klasse schließt nur ein Gate, dessen Prüfskripte aus
einem Baum kommen, den der Kandidat nicht schreibt (Wrapper, Runner und `e2e/*.ts` aus `main:` staged, der
Kandidat liefert allein den Prüfling) — das ist ein eigener, größerer Schnitt und steht hier nicht als Fix.

**Done-Sätze (`e2e/merge.ts`):** (1) erst ein volles grünes Land (setzt die Baseline; die Note trägt `passLines` mit
allen drei Wrappern > 0), dann eine Lane, deren `fleet-e2e-security.ts` nach den Imports `process.exit(0)` ausführt
(Wrapper unverändert): das Gate läuft **wirklich bis in den manipulierten Runner** — `verify.passLines` trägt
`"e2e-security.sh": 0` **und** für die zwei anderen Wrapper den Baseline-Wert, die Kette selbst endet mit Exit 0 —
und das Verdict ist `resolved` mit `checksBelowMain:{"e2e-security.sh":{n:0,baseline:N}}`, kein Land; (2)
Kontrollgruppe: unveränderte Runner → kein Stempel, `passLines` je Wrapper > 0; (2b) **Isolation der Schwelle:** eine
Lane, die genau **einen** `check(…)` im Security-Runner entfernt → `passLines["e2e-security.sh"] === N-1`, kein
Stempel, Land — der Zähler ist je Wrapper und die Schwelle, nicht die Änderung, löst aus; (3) ein docs-only-Land
dazwischen ändert die Baseline nicht (die proportionale Note wird übersprungen); (4) **Fälschungsgegencheck als
Grenzmarker:** eine Lane, deren Security-Runner die Baseline-Zeilen wörtlich druckt und mit 0 endet → **kein**
Stempel, Land. Dieser Check ist absichtlich rot für L6s Anspruch und grün für L6s Code: er dokumentiert die Grenze
und kippt erst, wenn der Trusted-Tree-Schnitt landet — dann wird er umgeschrieben, nicht gelöscht.

---

## 7. F7 — Suite-Mutex: drei Restlöcher und ein falscher Messwert

Quellen: `server.ts` 17363–17530 (`suiteLockTryTake`, `suiteLockReapStale`, `inheritedSuiteHolder`, `holdSuiteLock`,
`releaseSuiteLock`, Signal-Handler) gegen `e2e-stage.sh` 1–330 (Ticket + Lock-Schleife). Alle Punkte **Argument am
Code, nicht reproduziert**.

1. **`suiteLockTryTake` kann den permanenten Park erzeugen, den sein Kommentar ausschließt.** 17364 `mkdirSync`
   (Claim) → 17368 `processBirthFingerprint` (ein `ps`-Spawn, Millisekunden) → 17371 `writeFileSync pid` → 17372
   `writeFileSync birth`. Wirft die **erste** `writeFileSync` (ENOSPC/EIO auf `/tmp`), fängt 17373 und gibt `false`
   zurück, **ohne `rmdir`** — ein Verzeichnis ohne `pid` und ohne `birth`. Beide Reaper klassifizieren genau das als
   **manuellen Park** und rühren es nie an (Server 17458–17462 `reap = hb !== ""`; Shell 281–282 „parked … nothing will
   ever reap it"). Zweiter Weg: SIGKILL zwischen `mkdir` und der ersten Schreibung — das Fenster ist der `ps`-Spawn.
   Die Shell hat ein **kleineres** Fenster derselben Form (`mkdir` 267 → `echo $$ > pid` 330, ohne Spawn dazwischen,
   weil `_st_self_birth` vor der Schleife steht, 222) — verkleinert, nicht beseitigt. **Kosten:** maschinenweit — jede
   folgende **volle** Land-Kette (die docs-only-Kurzkette nimmt den Lock nicht, 18537) stirbt `waitedOut` nach 45 min,
   jede Suite blockiert, bis ein Mensch `rmdir` tippt; das ist die M5-Klasse (17429–17434, pid 77910, 710 s
   docs-only-Land) durch eine Tür, die M5 nicht deckt. **Fix (L7a):** im `catch` der Schreibungen das eben selbst
   angelegte Verzeichnis entfernen (`mkdir` hat gerade `true` gesagt, wir sind der Ersteller); Birth **vor** dem
   `mkdir` berechnen wie die Shell. **Done:** braucht eine Fehlerinjektion (die erste Schreibung muss scheitern, obwohl
   `mkdir` gelang — auf POSIX ohne Seam nicht herstellbar): ein test-only Env `FLEET_TEST_SUITE_LOCK_FAIL_WRITE=1`,
   unter dem `suiteLockTryTake` nach dem `mkdir` wirft; Check: nach `holdSuiteLock` existiert kein Verzeichnis und
   `suiteLockView` sagt nicht „parked".
2. **`inheritedSuiteHolder` beweist „ein lebender Prozess hält", nie „hält für mich".** 17398–17408 prüft Variable
   gesetzt ∧ `pid`-Datei = Variable ∧ Prozess lebt — die Shell (213–217) dasselbe Tripel. Ein Server, der **innerhalb
   eines Holds** gestartet wurde (`e2e-isolated.sh:810,818` mintet genau das), bekommt `gateInherited !== null` für
   **jeden** gleichzeitigen Clean-Pfad-`mergeJob` (18536, je Job ausgewertet, je Prozess gespeist) → N Gate-Ketten
   gleichzeitig in einem Hold. Im Baum setzt nichts die Variable in eine Pane (kein `process.env.FLEET_SUITE…=`;
   `verifyChildEnv` mintet sie je Spawn, 11989); ob der **laufende** Live-Server sie geerbt hat, wurde nicht gemessen.
   **Fix (L7b):** ein prozessinterner Mutex serialisiert Clean-Pfad-Gates untereinander, unabhängig von der Herkunft
   des Holds. **Done:** Scratch-Server **innerhalb eines Holds** gestartet (wie `e2e-isolated.sh:810,818`: Lock-Dir mit
   `pid`/`birth` des Wrappers, `FLEET_SUITE_LOCK_HELD_BY=<pid>` in der Server-Env — der Name, den
   `inheritedSuiteHolder` liest, 17399), Gate-Kommando = `mkdir <gemeinsamer Marker> || exit 7; sleep 15; rmdir …`
   (der `mkdir` ist der **atomare** Claim, dieselbe Form wie `mkdirSync(SUITE_LOCK)`, 17364 — Prüfen-dann-Anlegen
   ließe beide „frei" sehen); zwei Lanes mit Code-Diff landen, und der **Überlappungsversuch wird bestätigt**: beide
   Slots zeigen gleichzeitig `suite:"land gate"` auf `/api/sessions`, bevor eines der Gates endet (sonst hat der
   Check nichts gemessen und fällt als er selbst). @c7184f8 laufen beide Gates parallel (18536 je Job
   `gateInherited !== null`) → genau eines endet `exit 7` (Verdict `resolved`); mit L7b enden beide grün und die
   zweite Note trägt `suiteWait.waitMs ≥ 15000` mit Grund `same-process-gate`.
3. **Die ff-Retry-Absage schreibt eine Wartezeit, die nie verging.** Zweiter `mergeJob` im selben Prozess, während
   der erste hält: `suiteLockHeldHere()` (18537) überspringt das Take, die Kette queued **ohne** Hold-Variable
   (korrekt, bounded durch `VERIFY_WAIT_MS`). Verliert dieser Job den ff, ist `ffHeld=false` (18674) und
   `holdSuiteLock` antwortet **sofort** `false` (17491 „one hold per process"); die Note (18756) sagt dann „could
   not be taken within ${VERIFY_WAIT_MS}ms" — **0 ms vergangen, 2 700 000 ms behauptet** (`watchdog.sh:155`). Die
   Aussage „another land of this server" stimmt, die Zahl ist erfunden und liest sich wie eine Messung.
   **Fix (L7c):** die Absage nennt die gemessene Dauer und den Grund `same-process-hold` getrennt. **Done:** Check in
   `e2e/merge.ts` (Muster `FLEET_TEST_LAND_FF_LATCH`): erstes Land hält den Lock (volle Kette, Latch vor dem Advance),
   zweites Land desselben Prozesses verliert den ff → seine Note trägt `verify.ffRetry:{reason:"same-process-hold",
   waitedMs:<n>}` mit `waitedMs < 1000`, und der Note-Text enthält den Wert von `VERIFY_WAIT_MS` **nicht**; @c7184f8
   steht dort „could not be taken within 2700000ms" (18756) bei 0 ms Wartezeit.
4. **Liveness-Divergenz (latent):** Server `suiteLockHolderAlive` (17447–17451) liest EPERM als „lebt", die Shell
   (`kill -0`, 287/297) als „tot → reap" — ein Halter unter fremder UID würde von der Shell gereapt; auf dieser
   Ein-Nutzer-Maschine nicht beobachtet und nicht gemessen. Ein **Zombie**-Halter (`<defunct>`) antwortet beiden
   Seiten als lebend mit passender Birth → Park bis der Elternprozess reapt (nicht gemessen). PID-Recycling in
   derselben Sekunde (Birth-Auflösung 1 s, 17233) ist auf macOS unwahrscheinlich, nicht ausgeschlossen. `pid`-Datei
   mit `0`: Board sagt „stale, reap on next contender" (17312–17314), Reaper behält es für immer (17448).
5. **Der Server steht nicht in der Ticket-Schlange** (`holdSuiteLock` 17490–17505 kennt `.q` nicht; pollt 5 s gegen
   15 s; nach einem Reap `Bun.sleep(0)`) — seit M1 bei **jedem** Clean-Land, nicht nur im Retry. Im Regelbuch
   benannt; hier nur als Kostenposten: die mit 2 h 45 min bezahlte FIFO-Garantie von `d0befb9` bindet den häufigsten
   Kontrahenten nicht.

Ticket-Numerierung und Tie-Break: `_st_qmax` wird vor dem Liveness-Test gehoben (181), eine Regel für den Gleichstand
(198–204, niedrigere PID vorn, beidseitig gegen `$$`) — **total geordnet, aber PID-Ordnung ist keine
Ankunftsordnung** (ein wiederverwendeter niedriger PID gewinnt den Gleichstand); Birth-Normalisierung Server/Shell
äquivalent (17234–17236 vs. 150–157, beide `LC_ALL=C`). Fairness-Restunschärfe, kein Loch.

---

## 8. Wann ist „docs-only" lügbar? — ein geschlossener Verdacht, zwei offene Antworten

- **Rename in `docs/`:** `verifyPlanFor` diffft mit `--no-renames` (11925); eine Umbenennung `x.ts → docs/x.md`
  erscheint als Löschung von `x.ts` (SERVER/DEFAULT-Regel) plus Neuanlage → volle Kette. **Geschlossen.**
- **Symlink unter `docs/`:** `verify-proportion.ts#ruleFor` (44–46) ist reine Pfadstring-Logik (kein lstat, kein
  Modus); ein Symlink `docs/x → ../server.ts` ist ein docs-only-Diff. Nichts im Baum tut das; `git archive` legt den
  Symlink als Symlink ab, `e2e-stage.sh` kopiert per `cp` (441–445) und folgt ihm. **Geschlossen als Argument, benannt.**
- **`.gitignore` als DOC_RULE:** ändert keine getrackten Bytes; der Audit-Snapshot entschärft es ausdrücklich
  (`git add -A -f`, 13737), das Staging kopiert per `cp`. **Geschlossen.**
- **Offen, Antwort 1 — Zeit:** docs-only ist lügbar durch das Fenster aus F1 (Variante B): die Klassifikation ist
  ein Schnappschuss zu T0 über einen Baum, den nichts einfriert.
- **Offen, Antwort 2 — Anker in DOC_RULE-Dateien, die nur die volle Suite prüft (F8).** Sieben Context-Pack-Anker
  liegen in fünf Dateien: dreimal `AGENTS.md` (`## Portable operating contract`, `## Verify`, `## Landing`),
  `docs/verify-tiering.md`, `docs/land-mechanics.md`, `docs/plan-queue-refinement-2026-08-11.md`, `docs/container.md`
  (`context-packs.ts:97,114,115,133,134,152,172`). Die Seed-**Auswahl** liest keine Ankerbytes (`context-plan.ts`
  wählt nach Verfügbarkeit, Status, Harness, Modus, Trigger, Fähigkeiten); geprüft werden die Anker in der **vollen
  Suite**: `e2e/programs.ts:638–643` (`anchorsResolve`) löst jeden Anker jedes **selektierten** Packs per
  `git show <head>:<path>` auf, und der Fleet-Frame-Check (803–811) verlangt das für eine Gründung mit den Triggern
  `always` + `verification` (`server.ts:18896`) — also für die Packs `always` (`## Portable operating contract`) und
  `verification` (`## Verify`, `docs/verify-tiering.md`); das Pack mit `## Landing` hat den Trigger `landing`
  (`context-packs.ts:130/133`) und ist in dieser Gründung **nicht** selektiert. `e2e-isolated.sh:66–72` kopiert die fünf Quelldateien (plus `HANDOFF.md`) von Hand in
  die Instanz. `e2e/pins.ts` importiert `CONTEXT_PACKS` nur für Id-Kollision (1815) und Trigger-Erreichbarkeit (1883)
  — **kein Pin prüft einen Seed-Anker gegen Bytes.** Konsequenz: `## Portable operating contract` oder `## Verify` in `AGENTS.md` oder die
  `## 6.`-Überschrift in `docs/verify-tiering.md` umbenennen ist ein docs-only-Diff → Gate `install+pins` grün →
  Audit `install+pins` grün (Stempel-Vererbung, 12879) → der **nächste volle Lauf** — der Audit eines späteren,
  fremden Code-Lands — ist rot im Fleet-Frame-Check und benennt dessen Covers. Für `## Landing`, `container.md`,
  `plan-queue-refinement`, `land-mechanics.md` gilt dasselbe genau dann, wenn ein Check ihr Pack selektiert — nicht
  gemessen (nachgewiesen sind drei von sieben Ankern). Der Gegenfall (Datei **löschen**) wird für `docs/…md`-Pfade von `RULE_DOCPATH` (`e2e/pins.ts:3156–3175`)
  gefangen, für eine gelöschte **`AGENTS.md`** von `RULE_VERIFY` (1010: `agents === null` → Pin rot „no AGENTS.md"; `RULE_ANCHORS`
  wird bei fehlender Datei **übersprungen**, 1176, und prüft nur die aus ihr zitierten Pfade); die Lücke sind Überschriften-Renames und
  Inhaltsverschiebungen. Zusätzlich: `e2e-isolated.sh` läuft unter `set -u`, nicht `set -e` (Zeile 7) — ein
  fehlschlagendes `cp` bricht das Staging nicht ab, die Instanz bootet ohne die Datei und das Rot erscheint Minuten
  später als Anker-Fehler statt als benannter Staging-Fehler (Inversion des `e2e-stage.sh`-Kontrakts „FATAL at
  staging time", 37–40). **Nicht reproduziert; git-only-Repro:** Branch, `sed` auf `## Verify` in `AGENTS.md`,
  `git diff --no-renames --name-only main...HEAD` → nur `AGENTS.md` (DOC_RULE); `bun e2e/pins.ts` bleibt grün,
  solange `RULE_VERIFY` die Abschnittsreihenfolge noch findet — das ist der zu prüfende Punkt: `RULE_VERIFY` pinnt
  die **Kette**, nicht die Überschrift. **Fix (L8):** ein Pin in `e2e/pins.ts`, der jeden `CONTEXT_PACKS`-Seed-Anker
  gegen die Bytes des Baums prüft — dann deckt die Kurzkette ihn. **Done:** Überschrift umbenennen →
  `bun e2e/pins.ts` rot mit Pack-Id und Pfad.
- **`attic/` als DOC_RULE** hält `attic/steward-arena.sh`, das `e2e-stage.sh` sourct (Zeile 164; Zeile 6 ist
  Kommentar) und für dessen
  `set -e`-Semantik drei Guards geschrieben sind (166–167, 268, 318) — „Prosa" über eine Datei, über die der
  Mutex-Code Annahmen trifft. Kein Gate fährt sie; Kosten heute null, die Klassifikation ist trotzdem falsch benannt.
- **Was sonst DOC_RULE-Dateien liest:** die drei Land-Gate-Wrapper und ihre Harnesse lesen keine (jede `docs/`-Nennung
  dort ist Kommentar); `tsc` hat eine feste Liste, `build` bündelt `src/`. `e2e/pins.ts` liest DOC_RULE-Bytes an
  einer **benannten** Menge von Stellen: `AGENTS.md` (`RULE_ANCHORS` 1175, `RULE_VERIFY`), `docs/…md`-Zitate auf
  Existenz (`RULE_DOCPATH` 3156–3175), Konfigurationsmarker `<!-- pin:watchdog-spawn … -->` in Docs (1481),
  Index-Verweise in `docs/README.md` (1608) und Aussagen über vorhandene Quellsymbole (1656, 1680). **Diese fünf Leser
  sind gedeckt** — für alle anderen DOC_RULE-Konsumenten gilt die Aussage nicht, und die Seed-Anker gehören zu keinem
  von ihnen (F8 bleibt).
  `server.ts` liest zur Laufzeit `HEAD:AGENTS.md` als Größe (18951) und die Quellen des Manifests
  `.fleet/context-packs.json` per `git show` in `sourceBytes` (19018, 19066) — deren Pfade pinnt `e2e/pins.ts`
  (1789–1828). Die Exposition liegt damit **auf der Tier-2-Seite** und bei den **Seed**-Ankern; sie wurde mit
  `036ff7c` geöffnet, als die Kurzkette vom Gate auf den Audit ausgedehnt wurde.

---

## 9. Unter der Schnittlinie

- `SUITE_LOCK_LINE` (11849; gelesen 12064 im Gate, 13941 im Audit): eine Kette, die `[suite-lock] … waiting` druckt
  und nie `acquired`, läuft auf dem 45-min-Wartebudget statt 8 min Arbeit — nur Budget, kein Urteil.
- `VERIFY_SKIP_MARK` (11759) über `out+err`: eine Testausgabe, die `verify skipped:` am Zeilenanfang enthält, macht ein
  grünes Gate zu SKIPPED — fail-closed, kein Verlust.
- Die zwei Confirm-Lands vom 01./02.09. (`8990fcb7`, `87c5be66`): Note grün, `stale:true`, gelandeter Commit ~30 min
  nach dem Verify erzeugt — korrekt gestempelt, Owner-Latitude; erwähnt, weil die Sonde aus §1.4 sie zuerst als
  F1-Kandidaten fand.
- `undoDropped.n` kumulativ mit jüngstem `why` (12406) — 344 Einträge, ein Grund; nur Lesbarkeit.
- Zwei Audit-Zeilen für einen Tip können sich widersprechen (at-least-once + Flake); Watch-Zustellung nimmt die erste,
  Projektion die jüngste, Ping das älteste Rot — kosmetisch, weil der Ping ein Rot nie begräbt.

---

## 10. Querverweise an P1 / P2 (Ober-Orchestratorin e3b3a064)

- **P1 (Scheduling/Audit-SLA):** F4(3) ist Integrität (hier), aber die **Grace-/Claim-Wartezeit** ist das Fenster, in
  dem F4(1) überhaupt eintritt — je länger ein Cover wartet, desto wahrscheinlicher ein Undo/Hand-Commit dazwischen.
  L4(a) sollte im Zielbild der Zustandsmaschine als Invariante stehen: „eine Zeile benennt nur Covers, deren
  `mainAfter` Vorfahr ihres `mainSha` ist".
- **P2 (Adressierbarkeit):** Audit-Events (`auditEventPayload`, 5660) tragen weder `clonedSha` noch eine
  Orphan-Markierung; wer ein Audit-Event empfängt, kann F4(1)/(2) nicht sehen. Vorschlag: Feld
  `binding:{ancestry:"proven"|"orphaned"|"unknown", clonedSha?}` im Event. **Done (P2-Schnitt):** ein Audit-Watch auf
  ein Cover aus L4(a)-Fall (a) liefert `binding.ancestry:"orphaned"`, einer auf L4(b) `"unknown"` mit `clonedSha`;
  Pin: `AuditWatchEventPayload` (5660) trägt `binding` als Pflichtfeld.
- **Fleet-Betrieb (f170dc46):** F3 gehört dorthin (Deploy-Verb); die Idle-Uhr-Nullung beim Deploy (Regelbuch §Deploy)
  ist dieselbe Nahtstelle.

## 11. Serielle Opus-Schnitte, Reihenfolge (Done-Sätze oben)

An **Land-Pipeline 233e1c2b**: 1. **L1** Tip-Bindung + `verify.candidateSha` + Audit-Reklassifikation (§1.7; Schritt 1–2
und 4 zuerst, Schritt 3 als Folgezeile). 2. **L2** undo-land dreiwertig + Hub-Rückspiegelung mit Lease (§2.5).
3. **L5** Repo-weiter Land-Intent-Guard (§5). 4. **L7a** `suiteLockTryTake` räumt im Fehlerpfad, mit Test-Seam (§7.1).
5. **L6** `checksBelowMain` (§6), optional nach L1 — Mengenindikator, kein Integritätsnachweis (§6, „nicht behoben").
6. **L7b** prozessinterner Gate-Mutex, **L7c** ehrliche ff-Absage (§7.2/§7.3).
An **Audit-Determiniertheit 79036e9a**: **L4** (§4.4) und **L8** Seed-Anker-Pin (§8).
An **Fleet-Betrieb f170dc46** (Vorschlag via Controller): **L3** Deploy-Preflight (§3.4).
Ohne Done-Satz und außerhalb jedes Schnitts: der Trusted-Tree-Gate (§6, „nicht behoben") — Richtungsfrage.

## 12. Nicht gemessen / nicht gelesen

- Nicht gefahren: F2–F8-Repros (Skizzen); keine Suite, kein Live-Server, kein Deploy, kein Undo.
- Nicht gemessen: Häufigkeit von F1 auf der Live-Flotte — die Sonde §1.4 ist ein **Metadaten-Indikator** (Committer-Zeit
  gegen `startedAt − heldWait`, 12114), kein Ereignismaß: sie setzt unveränderte Committer-Zeiten und eine gemeinsame
  Uhr voraus und kann F1 weder nachweisen noch ausschließen; „Untergrenze" wäre zu viel gesagt; ob zwei Lands desselben
  Repos live je überlappten (F5 — `audit.jsonl` trägt Land-Enden, keine Starts); die Live-Prozessumgebung des Servers
  (F7.2); Zombie-/EPERM-/PID-Recycling-Verhalten (F7.4); `git grep` ohne HEAD; welche der sieben Anker in welchem
  Check selektiert sind (F8 — nur `always`+`verification` am Fleet-Frame-Check belegt); historische Hub-Pushes und
  Undo-Versuche (F2); ob ein echter Audit (statt des Stand-ins) den Variante-C-Baum rot gemessen hätte — **offen**: der Audit fährt
  `proportional ? VERIFY_PROPORTIONAL_CMD : chosen.cmd` (13853), nicht das Gate-Kommando; `red.marker` macht nur das
  hier definierte Marker-Kommando rot, über die echte Suite sagt es nichts.
- Nicht gelesen: `carriedFromPendingVerdict`, `wakeAuthor`/`runMerge`/`runRepair` (Konfliktpfad — landet nie
  unbeaufsichtigt), `context-plan.ts` über die Auswahlkriterien hinaus, `helper-daemon/daemon.ts` außer den zitierten
  Zeilen, `src/client.ts` außer 2584 und 10918, `readLedger`-Rotation, `e2e/merge.ts` über die Check-Titel hinaus,
  `docs/suite-contention.md` §7 und `docs/messungen/2026-09-06-merge-prozess-robust.md` (nur über Code-Kommentare zitiert).
- Grenzen des Repro-Skripts (§1.6): es prüft keinen Prozesstod und keine Kill-Reihenfolge (kein Kill im Spiel), es
  beweist den Spawn-Zeitpunkt nicht (Gate-Zeile erscheint schon im Lock-Take), und seine Fixture-Kette steht nur für
  die Kettenwahl. Die PASS-Baseline aus L6 existiert heute nirgends (`verify.out` ist gekürzt) und ist Teil des Schnitts,
  keine vorhandene Zahl. Der Trusted-Tree-Gate (§6) hat keinen Done-Satz und steht außerhalb jedes Schnitts.
- Gelesen durch Sub-Agents mit Nachlesung der tragenden Zitate durch die Autorin: Deploy-Verb, Undo-Route,
  Audit-Bindung, Mutex; die beiden Abnahmen des ersten Entwurfs haben je ~15 Zitate korrigiert, alle hier nachgezogen.
