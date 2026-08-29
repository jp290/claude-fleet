---
frage: War der in docs/transkript-forensik-2026-08-29.md beschriebene Weg (Suche §3–§5, Rückhol §6) der kürzeste zuverlässige Zug, und stimmen seine Zahlen am Baum vom 2026-08-29?
urteil: Nein, der Weg war nicht der kürzeste: die Suche war in einem 1,6-s-Zug möglich (rg -i -l + Schema-Schnitt, 11/11 Treffer gegen 10,9 s Vollpass), der Hardlink-Workaround ist durch den gemessenen Zug "claude --resume <orig> --fork-session --session-id <pin>" ersetzbar (Original blieb bytegleich, Fork trug Historie plus neuen Turn), und zwei Dokumentzahlen sind Artefakte der Shim-Umgebung (Vorfilter-Rangfolge gilt nur im Subprozess; die 44-Dateien-Zeile liefert ohne -E genau 1 Datei).
bereich: [verify, regelwerk]
belege: [find-conv.py#main, server.ts#transcriptFile, server.ts#stewardRecentSends, server.ts#laneDossier, server.ts#readLedger, e2e-isolated.sh#fakeverify, review-sweep.ts#checkCasts]
nicht-gemessen: e2e-isolated.sh (bewusst nicht gefahren), Kaltcache-Zeiten, Fork-Verhalten unter /compact und mit Subagent-Verzeichnissen, ugrep-Shim nur als ARGV0-Nachbau auf dasselbe Binary, nie in einer echten Claude-Code-Zelle.
stand: 2026-08-29
---

# Frage

2026-08-29, Lane `fleet-260829100923-85ad`. War der Weg aus
`docs/transkript-forensik-2026-08-29.md` der kürzeste zuverlässige Zug — und stimmen seine
Behauptungen am Baum? Prüfung als Review: alle Zahlen dieser Notiz sind auf dieser Maschine am
gleichen Tag nachgemessen (warme Cache, `date +%s.%N`); die Werkzeugumgebung dieser Lane ist
allerdings pi, nicht Claude-Code — `grep` ist hier `/usr/bin/grep` (echt), weshalb der Shim überall
explizit als `ARGV0=ugrep ~/.local/bin/claude -G --ignore-files …` nachgebaut wurde, mit der
exakten Flagliste aus `~/.claude/shell-snapshots/snapshot-zsh-1787996478746-hsn3qh.sh`.

## Befunde (nach Wirkung sortiert)

### B1 (Auftrag A §6) — Der Hardlink-Workaround war unnötig: `--fork-session --session-id` ist einfacher und robuster

`transcriptFile()` fällt tatsächlich exakt wie dokumentiert (server.ts#transcriptFile: bei
gesetzem `s.sessionId` wird ausschließlich `<pin>.jsonl` geliefert, sonst `null`; der
mtime-Fallback gilt nur für ungepinnte Slots). Aber genau das macht den Fork-Zug möglich, denn der
Pin muss ja nur **existieren** — und `claude --fork-session` (claude --help Zeile 94–96, „use with
--resume") erzeugt ihn als Datei mit der ganzen Historie. Gemessen an Wegwerf-Sessions in
`/tmp/forktest` (2 Mini-Prompts):

```
claude -p "Antworte nur mit dem Wort: eins" --session-id <A>          # A.jsonl: 29566 B
claude -p "Antworte nur mit dem Wort: zwei" --resume <A> --fork-session --session-id <B>
# → B.jsonl: 31835 B, enthält "eins" (kopierte Historie, 1×) und "zwei" (neuer Turn, 1×)
# → A.jsonl danach unverändert 29566 B (Original nicht angefasst)
```

Der dokumentierte Zug für Slot 5 wäre damit, ohne Hardlink und ohne Stub-Beiseite-Schaffen:

```
tmux send-keys -t s5 '/exit'
tmux send-keys -t s5 "claude --resume 665ac9d3-3a14-4dee-ad00-a5490449e5e4 --fork-session \
  --session-id c4cc80f7-10db-4b6c-b39a-319b43f8498f --model 'claude-opus-5[1m]' --effort high \
  --prompt-suggestions false"
```

Pin, Pane und Transkript zeigen auf dieselbe Datei (`B.jsonl` = Pin-Name, von `transcriptFile`
gefunden), und von den drei selbst genannten Kosten des Workarounds entfallen zwei komplett:
Kosten 1 (In-Place-Rewrite bricht den Link) kann nicht eintreten — es gibt nur eine Inode unter
einem Namen —, und Kosten 3 (Pane-Heal fällt auf den Pin zurück) ist ungefährdet, weil die
Pin-Datei vom Fork dauerhaft existiert (server.ts#ensureSlot resumed genau dann, wenn
`projDir/<pin>.jsonl` existiert). Kosten 2 (alte Zeilen tragen die alte sessionId) bleibt — die
kopierten Zeilen sagen intern weiter `665ac9d3…`, ebenso wie beim Hardlink. Einzelfallgrenze des
Tests: geprüft sind Existenz, Historienkopie und Unverändertheit des Originals, nicht das Verhalten
unter Kompaktierung oder mit `subagents/`-Verzeichnissen (siehe Vermutungen).

### B2 (Auftrag A §3/§4) — Die Suche war in einem Zug möglich; §4s „Vorfilter ist 2,4× langsamer" ist ein Subprozess-Artefakt

Alle Zeiten über `date +%s.%N`, Korpus 2046 `*.jsonl` / 1,4 G (Doku: 2048 / 1434 MB — innerhalb
der von ihr selbst notierten Schwankung; Verzeichnisse 435 vs 436, das Korpus wächst):

| Variante (ausführbar) | Zeit | Ergebnis |
|---|---|---|
| `python3 find-conv.py 'hugging ?face'` | 10,94 s / 11,39 s | 11 Zeilen in 11 Transkripten |
| `rg -i -l 'hugging ?face' --glob '*.jsonl' ~/.claude/projects` **+** Schema-Schnitt auf die Kandidaten | 1,17 s + 0,43 s | 11 Zeilen in 11 Dateien, identisch |
| Python-Subprozess mit `grep -ril`-Vorfilter | 20,96 s | 1 Datei (s. B5) |
| `/usr/bin/grep -rilE` Vollpass | 20,86 s | 43 Dateien |
| Shim-Nachbau (`ARGV0=ugrep …claude -G --ignore-files …`) Vollpass | 1,38 s | 1 Datei (s. B5) |

Damit: Ja, die Suche hätte mit einem einzigen Aufruf enden können — nachträglich gebaut als
`find-conv.py` (10,9 s), oder ohne Hilfsdatei als zweistelliger Ein-Zellen-Zug in 1,6 s. §4s
Zahl (Subprocess-Vorfilter ≈ 2× Vollpass) ist reproduziert, aber ihre Verallgemeinerung trägt
nicht: sie misst, dass ein Python-Subprozess das **echte BRE-grep** erbt, nicht eine Eigenschaft
des Vorfilters. Aus der Shell ist der Text-Vorfilter (rg, 1,2 s) plus Schema-Schnitt auf den
Kandidaten (0,4 s) rund **7× schneller** als der Schema-Vollpass — bei identischem Ergebnis. Die
Doku-Lehre „erst Schema schneiden, dann Text" bleibt als Prinzip richtig (der Schema-Schnitt ist
es, der 43 Dateien zu 11 Zeilen macht); die gemessene Rangfolge „Vollpass schlägt Vorfilter" gilt
nur in der Subprozess-Umgebung.

Ein Messfehler dieser Prüfung, der selbst B5 unterstreicht: der erste rg-Vorfilter-Lauf ohne `-i`
(das `find-conv.py` als `re.I` impliziert) fand 33 statt 43 Dateien und verlor einen Treffer —
still. Wer Vorfilter und Schnitt baut, muss ihre Semantik angleichen.

### B3 (Auftrag B, W2) — Die Regelwerk-Zeile „(oder schlicht `grep`)" ist live falsch; Nachmessung im Haupt-Checkout

`CLAUDE.md` Zeile 212 (Lane-Kopie, generiert aus `rulebook/`): „getrackter Code → `rg` gern; alles
Operative → **`rg -uu`** (oder schlicht `grep`)". Nachgemessen im Haupt-Checkout mit der Phrase
„Beerdigtes nicht wieder aufmachen" (Muster aus dem Dokument):

```
shim (ARGV0=ugrep …)  -rl → 3 Dateien
command grep          -rl → 7 Dateien
Differenz (git check-ignore belegt alle vier): CLAUDE.md · rulebook/einstieg.md ·
                                   streams/prompts.jsonl · streams/s8.raw  (alle .gitignore)
```

Doku: 2 vs 5 — gleiche Richtung, gleiche Ursache, Baum heute größer (drei der Differenzkandidaten
sind inzwischen getrackt). Der Mechanismus stimmt exakt: Der Shim mit `--ignore-files` überspringt
die gitignorten Dateien still, das Ergebnis ist leer statt fehlend. Einziger W2-Fall dieser Art im
Regelwerk (keine `docs/*.md` schickt rg/grep ungefiltert an die Ledger; Sonden
`rg 'jsonl' --glob '*.md'` und `rg "rg [^u]" docs | rg jsonl` leer). Der Doku-Vorschlag, den
Klammerausdruck durch „(oder `command grep` …)" zu ersetzen, wird hiermit zur belegten
Empfehlung — als Text, nicht editiert: CLAUDE.md ist gitignored und wird beim Lane-Spawn kopiert;
die Zeile gehört im `rulebook/`-Fragment des Haupt-Checkouts geändert (dasselbe Fragment, das
`rulebook.ts#renderRulebook` nach CLAUDE.md rendert).

### B4 (Auftrag B, W1) — Dieselbe Wurzel im Server: Vollparse bekannter Schemas, Schnitt danach

- **server.ts#stewardRecentSends** (um Zeile 3099): liest pro Steward-Send das ganze `audit.jsonl`
  beider Rotationen via server.ts#readLedger (jede Zeile `JSON.parse`), um danach auf
  `event === "steward_send"` zu filtern. Selektivität heute: **1 Treffer in 13 333 Zeilen**
  (gemessen mit `command grep -c` auf dem Ledger des Haupt-Checkouts; 1,37 MB). Identischer
  Mechanismus wie der Doku-Fall (1434 MB für 11 Zeilen), kleinere, aber wachsende Amplitude
  (Rotationsschwelle 5 MB × 2). Der Code-Kommentar begründet bewusst den Verzicht auf einen
  Speicherzähler — erwägt aber nicht den dritten Weg, den find-conv.py vorlebt: Rohzeilen-Vorfilter
  vor dem Parse (dieselbe Zeile als Text testen, erst dann `JSON.parse`). Der hätte dieselbe
  Restart-Dauerhaftigkeit und reduzierte das Parse auf die passende Minderheit.
- **server.ts#laneDossier** (um Zeile 13905): liest drei Ledgers komplett und filtert danach; das
  dritte, `streams/prompts.jsonl`, ist laut README.md:90 „Never capped, never rotated" und heute
  **11,5 MB / 7 931 Zeilen** — die Kosten dieses on-demand-Dossiers (Route `/api/slots/:id/…`,
  server.ts:21117) wachsen monoton mit jeder je gesendeten Promptzeile der ganzen Fleet. Der
  Schnitt (`cwd === worktree`) kennt das Schema (`{ts, slot, cwd, label, source, text}`) und
  liefe als Rohzeilen-Filter vor dem Parse genauso, nur billiger.
- Nebeninstanzen desselben Musters auf Testfixtures mit minimaler Amplitude:
  `fleet-e2e-postland-audit.ts` Zeile 94 (post-land-audits.jsonl Vollparse),
  `fleet-e2e-harness.ts` Zeile 154–162 (audit.jsonl Vollparse, Filter auf `send_boot_timeout`
  danach). Keine eigenen Rangplätze — die Dateien sind dort frische, kleine Fixtures.

Nicht W1/W2 trotz Sonde: `state.sh`/`register.sh` laufen als `/bin/sh`-Skripte, bekommen das echte
grep und lesen keine jsonl-Schemas; `e2e-isolated.sh`#fakeverify nutzt `git grep` über den
getrackten Baum — beabsichtigt, denn die Marker werden laut Kommentar „in a lane's committed
content" gepflanzt; `review-sweep.ts#checkCasts` ist der bereits geheilte W2-Fall (ast-grep exit 1
mit `[]` wird ausdrücklich als „no match", nicht als Fehler gelesen — der Kommentar nennt genau
die leer-statt-fehlend-Todesart).

### B5 (Auftrag C) — Zwei Dokumentzahlen sind nicht reproduzierbar

- **§3 Schritt 2** („`grep -ril 'hugging ?face' --include='*.jsonl'` → 44 Dateien"): Das Kommando,
  wie geschrieben, liefert **1 Datei** — unter dem Shim (ugrep 7.8.4, gemessen) wie unter echtem
  BSD-grep: beide werten das Muster als BRE aus, in der `?` literal ist (Shim auf der
  Zieldatei: `'hugging ?face'` → 0, `'hugging face'` → 93, `'huggingface'` → 13 Treffer). Mit `-E`
  sind es 43 Dateien (echtes grep, gemessen 20,86 s). Die dokumentierten 44 sind weder mit noch
  ohne `-E` erreichbar; sie sind vermutlich einem `-E`-Lauf des gewachsenen Korpus geschuldet. Die
  Zeile sollte `-rilE` sagen — so, wie sie dasteht, führt sie jeden Nachvollzieher auf eine Suche,
  die die gesuchte Session selbst nicht findet (Zieldatei hat „Hugging Face", matcht in BRE-`?`
  nicht).
- **§5(a) Tempo** („der Shim macht die 1434 MB in 0,04–0,24 s"): Shim-Nachbau auf dem vollen
  Korpus: **1,38 s**. Die Richtung stimmt und ist krass (Shim 1,38 s vs. echtes grep 20,86 s ≈
  15×), aber 0,04 s für 1,4 GB wären ~35 GB/s Scandurchsatz — auf dieser Maschine nicht
  reproduzierbar. Da beide Messungen in Claude-Code-Zellen liefen, bleibt die Differenz offen
  (vermutlich kürzerer effektiver Scanpfad durch `--ignore-files`/`-I` im projektfremden Korpus);
  die Größenordnung der Doku ist zu gut.
- Bestätigt (nur die wirklich geprüften): Korpuszahlen 435/2046/1,4 G ✔ (Doku 436/2048/1434 MB,
  eigene Schwankungsnotiz); `transcriptFile()`-Verhalten ✔ wörtlich (server.ts#transcriptFile);
  `/open` nimmt keine `sessionId` (server.ts:22675–22698), `/restart` liest keinen Body
  (server.ts:22738) ✔; codex-candidates/codex-bind nur für codex (server.ts:20905/20921) ✔;
  `src/client.ts` kennt resume nur als Restart (client.ts:2352) ✔; `fleet.json.slots` ist ein
  Objekt, Slot 5 trägt `c4cc80f7-10db-4b6c-b39a-319b43f8498f` ✔; Shim-Definition im Shell-Snapshot
  ✔ (inkl. `command grep`-Fallthrough für Sonderflags). Präzisierung zu „GET /api/sessions trägt
  kein sessionId": für Claude-Slots stimmt es, aber Codex-Slots tragen
  `codexRecovery.sessionId` (server.ts:20864–20867) — die Zeile ist global zu absolut formuliert,
  praktisch aber nur für Claude-Slots benutzt.

## Vermutungen

- Der Fork-Zug dürfte auch unter claude-interner Kompaktierung stabil sein (es gibt keine zweite
  Inode, die brechen kann) — nicht provoziert, also Vermutung, nicht Befund.
- Ob der Fork `subagents/`-Verzeichnisse der Original-Session mitkopiert oder referenziert, habe
  ich nicht geprüft (Wegwerf-Sessions hatten keine).
- §5(a)s 0,04–0,24 s könnten daher rühren, dass der Shim in der Claude-Zelle ein anderes
  CLAUDE_CODE_EXECPATH/Binary nutzt als mein Nachbau — beide Male `ugrep 7.8.4` wäre Zufall.
- `rg` ohne `-i` als Vorfilter (B2-Messfehler) ist vermutlich der häufigste stille Auslassungsfehler
  bei genau dieser Werkzeugkombination — ein Satz für die Werkzeuggrundlinie, nicht mehr.

## Was ich nicht gemessen habe

`./e2e-isolated.sh` bewusst nicht gefahren (Auftragsverbot; berührt weder e2e/ noch Merge-/Land-Pfad).
Keine Kaltcache-Zahlen (alle Läufe nach vorherigen Vollscans desselben Korpus). Der ugrep-Shim nur
als ARGV0-Nachbau auf `~/.local/bin/claude` mit der Snapshot-Flagliste, nie in einer echten
Claude-Code-Zelle — Zellen-spezifische Effekte (EXECPATH-Varianten, Alias-Lagen) blieben unsichtbar.
Server-Laufzeitverhalten von stewardRecentSends/laneDossier nur aus Code plus Ledger-Größen
gelesen, nicht am laufenden Server profiliert. Der Fork-Test mit zwei Wegwerf-Sessions ohne
Subagenten und ohne Kompaktierung; beide `/tmp`-Artefakte sind entfernt.
