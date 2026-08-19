# Die Sanierungswelle vom 2026-08-19 — sechs Aufträge, und was das Landen dabei über sich selbst verriet

Sechs vom Owner freigegebene Queue-Zeilen, gebaut von sechs Opus-Lanes, gelandet von einer
Sanierungs-MAIN (Slot 5). Dieses Dokument hält **die Entscheidungen und ihre Gründe** fest — nicht
die Ergebnisse. Was gebaut wurde, steht in den Commit-Bodies; die sind hier das Befund-Register:

    git log --oneline 14c6046~5..HEAD    # und die BODIES lesen, nicht die Subjects

| | Zeile | Commit |
|---|---|---|
| A | `d72823a7` + `f5834dfc` — ctx-Sensor kennt Fable 5 nicht | `beda7a3` |
| B | `8e64409e` — der `isBoundSupervisor`-Pin | `4614da8` |
| C | `ca630f68` + `911bdb73` — Send-Boot-Sondenfamilie | `889bbe1` `a6a90e3` `e8e95e1` |
| D | `17068154` — `never-failed` über einem Deckel | `de72807` |
| E | `95bf15cc` — `resolved` heißt zwei Dinge | `14c6046` |
| F | `95f893b7` — der Suite-Gate nennt seinen Halter nicht | `73cf06d` |

---

## 1. Der Befund, der sich während der Welle selbst bewies

Die Welle hat E **dreimal live reproduziert, während sie E briefte** — und dabei den Befund
erweitert. Die Queue-Zeile beschrieb den `waitedOut`-Fall. Gemessen wurde:

| | Land | Verdict | Guard-Antwort |
|---|---|---|---|
| 1 | `4614da8` (B) | `waitedOut:true`, 909 s von 937 s hinter dem Mutex | `conflict resolution awaits your review` |
| 2 | `beda7a3` (A) | **`verify.ok === false`** — echtes Rot, 30 s Wartezeit, `exitCode 1` | dieselbe Meldung |
| 3 | Slot 4 (von der E-Lane an `fleet.json` gefunden) | `verify.ok:false`, `exitCode:3` | dieselbe Meldung |

In allen drei Fällen: `conflicted: null`, `resolvedBy: null` — **keine** Konfliktauflösung, über die
jemand hätte urteilen können. Damit war die Behauptung „alle vier `resolved`-Schreibstellen fallen
unter den Guard" keine Ableitung mehr, sondern gemessen; sie ging als Nachtrag in Es Brief.

**Die teuerste Folge steht in keiner der beiden Queue-Zeilen** und wurde erst beim Landen sichtbar:
ein **rotes** Gate ist nicht per Re-Run überprüfbar. Der vorgeschriebene Flake-Beweis
(`docs/verify-tiering.md` §11.7 — „denselben Baum erneut laufen lassen") kann also nicht über den
Gate geführt werden; er muss von Hand neben dem Fleet laufen, und der einzige Ausgang aus dem
Verdict bleibt `{confirm:true}` — ausgerechnet der Weg, der die Messung überspringt. Genau das war
zweimal nötig, siehe §2.

---

## 2. Zwei Confirm-Lands, und warum sie nicht dasselbe sind

`confirmedByHuman:true` neben `verify.ok:null` ist eine ehrliche, aber teure Provenienz. Beide Male
war Confirm der **einzige** Weg vorwärts (`parkMergeVerdict` parkt per BRANCH, ein Kill bewahrt das
Verdict für den nächsten Slot). Die Beweislage war aber verschieden, und das gehört unterschieden:

**B (`4614da8`) — kein Beweis geführt, nur Indizien.** Die Lane hatte die volle Kette selbst grün
gefahren; der Gate kam durch `pins`, `tsc`, `build`, `clean-review` und wurde erst in einer
gestagten Stufe am `waitMs`-Deckel getötet; `mainSha` = HEAD, Diff = eine Test-Datei, +46 Zeilen.
Stark, aber es war kein Lauf, der diesen Baum vollständig gesehen hat.

**A (`beda7a3`) — Beweis geführt.** Der Gate fiel mit *einem* FAIL:
`boot-race fixture: the pane is still unobserved before immediate /send (1787093186550)` — ein
**Zeitstempel** dort, wo die Zusicherung `0` verlangt. Ich habe denselben Baum (`beda7a3` auf
`4614da8`, sauber) seriell erneut gefahren: **116 PASS / 0 FAIL**, drei Phasen ALL PASS, und
dieselbe Fixture las `(0)`. Nicht-Determiniertheit direkt bewiesen, nicht über den schwächeren
HEAD-Worktree-Umweg.

**Regel, die daraus folgt:** ein Confirm-Land muss sagen, welcher der beiden Fälle es ist. „Die Lane
hat lokal grün gemeldet" ist ein Indiz; „derselbe Baum lief erneut grün" ist ein Beweis. Das Ledger
kann sie nicht unterscheiden — der Bericht muss es.

---

## 3. Der Takt: warum das Landen auf einen freien Mutex wartet

Nach Instanz 1 habe ich vor jedem Land geprüft, ob `/tmp/fleet-e2e.lock` frei ist, und andernfalls
gewartet. Das steht so **nicht** im Regelbuch — dort steht nur „nie zwei Lands gleichzeitig" und
„das nächste Land darf sofort, ohne auf den Audit zu warten".

Die Begründung ist keine neue Regel, sondern eine Rechnung: der Post-Land-Audit ist ein voller
`./e2e-isolated.sh` (~11 min), `FLEET_VERIFY_WAIT_MS` ist 900 s. Ein Land, das dicht hinter einem
Audit startet, hat also ~60 s Marge, bevor es in den `waitedOut` läuft — und solange E nicht
gelandet ist, kostet ein `waitedOut` einen Confirm, also eine unvermessene Provenienz auf dem
Ledger. Warten kostet Wanduhr; nicht warten kostet Beweiskraft.

**Ergebnis, zwei Datenpunkte, kein Beweis:** die ersten zwei Lands waren confirm-pflichtig, die
folgenden vier liefen grün durch — bei freiem Mutex gestartet, und nach `e8e95e1` (C) auch ohne die
Send-Boot-Familie als Störquelle.

---

## 4. Ein Fehler, benannt: E wurde zu früh gestartet

Die Vorgabe war „D, E und F fassen alle drei `server.ts` an — strikt seriell". Ich habe E
dispatcht, während D noch lief. Nach ~2 Minuten gestoppt (`killed-empty`, 0 Commits, Worktree
entfernt, Queue-Zeile zurück auf `pending`), E danach regulär gestartet.

**Warum nicht einfach laufen lassen**, obwohl Ds und Es `server.ts`-Regionen ~2000 Zeilen
auseinanderliegen und textuell kaum kollidiert hätten: ein Rebase-Konflikt zwischen beiden hätte ein
`resolved`-Verdict **mit** gesetztem `conflicted` erzeugt — und das ist der eine Zustand, aus dem
man zu diesem Zeitpunkt nur per Confirm herauskam. Die Regel schützte hier gegen genau den Fehler,
den E repariert. Eine Regel, deren Kosten man selbst kleinrechnet, ist der übliche Anfang.

---

## 5. Was die Lanes gefunden haben, das im Brief nicht stand

Die Briefe nannten Fläche, Schnitt, Verbote und Done-Kriterium. Vier Dinge kamen von den Lanes
selbst, und drei davon waren schärfer als die Vorgabe:

- **C:** `sendText` liest `lastOutput` **überhaupt nicht** — die drei `lastOutput === 0`-Zeilen waren
  Vorbedingungen für einen Pfad, den `94b1362` entfernt hat. Dazu ein Selbstwiderspruch: bei
  `silent-alive` pollt `awaitAgent` bis 20 s, das Frischefenster ist 15 s; ein schnelles Ergebnis
  hätte dort Abgelaufenheit bewiesen, nicht den No-Settle-Pfad.
- **C:** `§11.2c-bis` war eine **Fehlablage** — dieselbe Signatur lag als Geschwister der sechsten
  Familie mit falschem Mechanismus und gehört zur achten (`e8e95e1`).
- **D:** die Asymmetrie, die den Schnitt trägt: `never-failed` ist die einzige der drei beobachteten
  Antworten, die eine **Absenz** behauptet — also die einzige, die ein Deckel falsifizieren kann.
  `not-your-diff` ruht auf zwei bereits gesehenen Fehlschlägen; ungelesene Dateien können dort nur
  einen dritten hinzufügen. Dazu ein dritter, nicht bestellter Check („ein Deckel schwächt
  `not-your-diff` nie"), ohne den ein späterer überbreiter Fix die einzige positive Antwort
  zerstört hätte.
- **E:** `resolvedBy` ohne `conflicted` ist von **keinem** Schreiber erzeugbar (drei Pfade
  strukturell geprüft) — und trotzdem `ODER` statt `UND`, weil der Boot-Restore `mergeLast` per
  Cast setzt, der weder Feld validiert. Auf einer Zeile, die kein Schreiber gemacht hat, ist `ODER`
  die fail-safe Richtung für einen Guard, der unreviewte Arbeit am Landen hindern soll.

---

## 6. Gemeldet, nicht gebaut

Scope-Disziplin: jede Lane hatte das Verbot, einen siebten Befund zu bauen. Fünf sind angefallen.

1. **Eine neunte Flake-Familie** — siehe §9, sie hat nach dem letzten Land der Welle ein zweites Mal
   gefeuert und ist dort vollständig beschrieben.
2. **`not-in-window`** (D): dieselbe Absenz-Behauptung über demselben Deckel wie `never-failed`.
   Weil `newest-first` schneidet, trifft es ausgerechnet umbenannte und ältere Checks — also genau
   die Population, für die `not-in-window` als ehrlicher Split gedacht war. Nur Schnitt (a) war
   freigegeben.
3. **Der Kommentar über `isBoundSupervisor`** (B): sagt weiterhin „the whole authorization story of
   both routes below" und ist seit `fa69586` überholt. `server.ts` war Bs Fläche verboten.
4. **`sendBootTimeouts()`** (C) ist in beiden Phasen-Harnessen dupliziert; gemeinsamer Ort wäre
   `e2e/harness.ts`.
5. **`postLandAuditLiveView` und Fs neue slotlose Zeile** rendern beide den laufenden Audit in
   derselben Gate-Sektion — kein Widerspruch (Audit-Fachsicht vs. Mutex-Halter-Sicht), aber ein
   Kandidat für eine Zusammenlegung.

---

## 7. Eine Fehlmessung, und warum sie zweimal durchkam

**Behauptet wurde** (von der E-Lane als Nebenbefund, von mir „nachgeprüft" und dem Owner gemeldet):
dem laufenden Land-Gate fehlten im `FLEET_VERIFY_CMD` `bun run build` und `merge-prompt.ts`, der
srv-Prozess stamme von vor dem 2026-08-15, jedes Land der Periode sei durch einen Gate ohne
Client-Build gelaufen.

**Das war falsch. Es gab nie eine Lücke.** Der laufende `bun server.ts` trägt die Kette
byte-identisch zu `watchdog.sh:91`.

**Der Fehler:** `ps -eo command | grep 'exec bun server.ts'` trifft auf dieser Maschine den
**tmux-SERVER** (pid 669, `comm=tmux`), nicht den Server-Prozess. Sein argv ist die eingefrorene
`tmux -L claudefleet new-session -d -s srv …`-Zeile des ALLERERSTEN Spawns — hier vier Tage alt.
Spätere srv-Respawns rufen `new-session` gegen den bestehenden tmux-Server; **pid 669s
Kommandozeile ändert sich dabei nie.** Sie sieht aus wie ein Env-Dump des Live-Servers, ist aber ein
Schnappschuss von dessen Geburt.

Richtig misst man so:

    pgrep -f 'bun server.ts'      # → die echte pid
    ps eww <pid>                  # → deren tatsächliche Umgebung

**Drei Lehren, und die zweite ist die teuerste:**

1. **Ein argv ist ein Geburtsprotokoll, kein Zustand.** Wo ein Prozess Kinder in einem langlebigen
   Server spawnt (tmux, launchd), altert die Kommandozeile des Elternteils gegen die Realität.

2. **Eine Verifikation, die die Messmethode der Behauptung wiederholt, ist keine.** Ich habe den
   Befund der Lane „nachgeprüft", indem ich exakt ihr Kommando erneut fuhr — und damit ihren Fehler
   reproduziert statt ihn zu fangen. Nachprüfen heißt: eine **andere** Messung, oder wenigstens eine
   Gegenprobe, die bei falschem Befund anders ausfällt.

3. **Der Gegenbeweis lag längst vor.** Im Gate-Lauf von B — dem ersten Land der Welle, Stunden vor
   jedem Neustart — steht `$ bun build src/client.ts --outfile public/app.js …` im stderr. Ich hatte
   dieses Verdict gelesen. Eine Behauptung gegen bereits gelesene Evidenz zu stellen, ohne sie zu
   konsultieren, ist der eigentliche Fehler; das falsche `ps` war nur die Gelegenheit.

**Folge:** ein `launchctl kickstart` wurde auf falscher Grundlage gefahren. Er war folgenlos (alle
zehn Sessions überlebt, `deployGap:false`, `bundleStale:false`) — aber er war ein Eingriff in den
laufenden Betrieb ohne echten Anlass.

**Was bestehen bleibt**, unabhängig von diesem Irrtum: `RULE_VERIFY` in `e2e/pins.ts` vergleicht die
Schrittkette über `watchdog.sh`, `AGENTS.md` und `verify-proportion.ts` — alles **Dateien**. Der
laufende Prozess ist kein Vergleichspartner. Wo eine Datei erst durch einen Neustart wirksam wird,
sind „die Dateien stimmen überein" und „die Maschine tut das" zwei verschiedene Aussagen, und nur
die erste ist gepinnt. Das ist hier **nicht** schlagend geworden — aber es ist die Lücke, die den
Befund plausibel machte, und der `config sensor` in `./state.sh` zeigt die Live-Werte bereits an;
ihm fehlt nur der Vergleich gegen die Datei.

## 8. Was diese Welle nicht getan hat

- **Keine Queue-Zeile archiviert, gelöscht oder konvertiert** — das Buchen gehört dem Owner.
- **`arbeitskreis-atlas/**` und `docs/arbeitskreis-*.md` nicht angefasst** (zwei fremde Lanes).
- **`.env`, `fleet.json`, `.env.bak-*` nicht angefasst.**
- **Weg (2) bei E nicht gefahren** (Statuswort trennen) — nicht freigegeben, und die Lane hatte den
  Auftrag, bei Nichttragen von Weg (1) zu stoppen statt zu driften. Weg (1) trug.

---

## 9. Die neunte Flake-Familie: ein Check, der eine Fläche liest, in die Fleet selbst schreibt

**Signatur:** `FAIL  transcript endpoint returns entries  (total=4 entries=0 source=<uuid>.jsonl)`
**Fundort:** `e2e/history.ts:124`, Suite `isolated`.
**Zweimal gemessen:** von der D-Lane (Runde 1 rot, Runde 2 auf demselben Baum grün, 2656 PASS) und
im Post-Land-Audit von `73cf06d` (`ms 990026`, `ran 2672, failed 1` — ein echter Lauf, kein Phantom).

**Der Mechanismus, am Code belegt statt vermutet.** Der Kommentar über dem Check nennt seine eigene
Konstruktion:

> slot 1 cwd is `~/claude-fleet`, whose project dir has transcripts; `FLEET_CMD=true` means no
> pinned session id, so this exercises the **mtime fallback**

Der Check liest also absichtlich `~/.claude/projects/-Users-owner-claude-fleet/` — und
`src/protocol.ts:174-176` sagt, wer sonst noch dort hineinschreibt:

> A worker's transcript lands in the same `~/.claude/projects/<cwd>` directory as the slot it was
> run for, so the transcript view's newest-by-mtime fallback would serve it as that slot's own
> conversation.

**Das ist die Klasse, und sie ist schärfer als „ein geteiltes Artefakt außerhalb des Repos":** der
Check liest per mtime-Fallback ein Verzeichnis, **in das die getestete Anwendung selbst schreibt** —
aus jeder Session mit diesem cwd (zum Messzeitpunkt fünf: Slots 5, 6, 9, 11, 15) und aus jedem
Wegwerf-Worker. Eine frisch angelegte Transcript-Datei enthält zunächst nur `mode`/
`permission-mode`-Kopfzeilen und **null** Nachrichten; wird sie zwischen Suite-Start und
Check-Ausführung die neueste, antwortet die Route korrekt `total=4 entries=0`, und der Check fällt.
Der Check misst dann die Belegung der Maschine, nicht die Route.

**Der Produktionscode ist NICHT betroffen und das ist der Witz:** `runWorker` hat genau gegen diesen
Fehlmodus eine Abwehr — den `mark`, eine ins Prompt interpolierte Phrase, an der ein Streuner
erkannt wird. Die Sonde fährt den **ungeschützten** Pfad absichtlich. Sie testet damit eine
Eigenschaft, die der Server bewusst nur als Fallback hat, gegen eine Fläche, deren Ruhe niemand
garantiert.

**Warum die Wahrscheinlichkeit gestiegen ist:** je mehr Sessions in `~/claude-fleet` laufen, desto
öfter feuert es. Diese Welle fuhr durchgehend vier bis fünf davon. Die Familie ist also nicht neu
entstanden, sie ist **sichtbar geworden** — genau wie die Send-Boot-Familie (§11.2f), als der
Durchsatz stieg.

**Nicht gebaut, bewusst.** Der Schnitt gehört nicht in diese Welle: er berührt `e2e/history.ts`,
nicht die sechs Flächen, und die Richtung ist eine Entscheidung (die Vorbedingung herstellen — eine
eigene, ruhige Fixture-Projektdirectory statt der Live-Fläche — oder sie als eigener `check()`
führen, der als er selbst fällt; dasselbe (a)/(b)-Paar wie bei §11.2f). Bis dahin gilt: **ein Rot
dieser Signatur ist wie jedes andere DEINS, bis der gleiche Baum erneut grün läuft.**
