# P4 Slice 4 — Vorbereitung: die Abhaengigkeitsflaeche, vom COMPILER gemessen

Stand `c98b1ec` (server.ts 24313 Z.). Tier 1 des Plans nennt sechs Subsysteme; vier sind
gelandet oder in Flug — `errors`/`tmux` (Slice 2), `transport`/`dir-explorer` (Slice 3, haengt).
Offen: **audit-log** und **auth**.

## Warum diese Notiz existiert

Der Slice-3-Brief behauptete „der Bereich 8629-8857 hat NULL freie Bezeichner aus dem Kern". Es
waren fuenf. Die Behauptung war **gegrept**, und eine verfeinerte zweite Sonde meldete LEER —
geglaubt wurde die bequemere. Konsequenz: −351 statt der versprochenen −470 und ein Slice, der
anders geschnitten werden musste, als sein Brief sagte.

**Die Methode hier ist darum eine andere: der Block wird probeweise in eine Datei gezogen und
`tsc` nennt die ungeloesten Namen.** Ein Grep kann eine Bindung uebersehen; der Compiler nicht.

```
awk 'NR>=<von> && NR<=<bis>' server.ts > $SCRATCH/probe.ts
bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler \
  --types bun "$SCRATCH/probe.ts"
```

**Zwei Fallen, beide heute dreimal ausgeloest — die Sonde muss als SIE SELBST scheitern:**

1. **Ausserhalb des Repos laufen lassen** ⇒ `TS2688: Cannot find type definition file for 'bun'`.
   tsc bricht VOR der Namensaufloesung ab, `grep "Cannot find name"` ist leer, und das liest sich
   wie „null freie Bezeichner". Die Sonde muss aus dem Repo-Root laufen (dort liegen die
   Typwurzeln), die Probe-Datei darf im Scratch liegen.
2. **Die Zeilenspanne mitten in eine Funktion schneiden** ⇒ `TS1005: '}' expected`. Wieder
   Abbruch vor der Namensaufloesung, wieder ein leeres Ergebnis, das wie eine Antwort aussieht.
   Darum: **erst `syntax errors` zaehlen (`TS1005|TS1128|TS1109`), und nur bei 0 das
   Namensergebnis lesen.** Grenze auf einem echten Top-Level-Konstrukt schneiden.

## Ergebnis A — audit-log (`server.ts:2439-2624`, 186 Zeilen): ZWEI freie Bezeichner

| Name | Woher | Folge fuer den Move |
| --- | --- | --- |
| `appendEvent` | **schon `server/persist.ts:34`, exportiert** | schlichter Import, keine Kernbindung |
| `AUDIT_FILE` | `server.ts:116`, `` `${import.meta.dir}/audit.jsonl` `` | **die Slice-3-Falle, woertlich** |

`AUDIT_FILE` ist derselbe `import.meta.dir`-Anker, an dem Slice 3 fast still gebrochen waere: in
`server/audit-log.ts` zeigt `import.meta.dir` auf `<repo>/server/`, das Audit-Ledger wuerde
lautlos nach `<repo>/server/audit.jsonl` wandern — kein Compiler sieht das, und das ALTE Ledger
sieht danach einfach aus, als haette es aufgehoert zu wachsen. Gleiche Reparatur wie dort
(EIN `PUB`-Anker im Modul) und gleiche Beweispflicht: der Pfadvergleich wird **AUSGEFUEHRT**, die
absoluten Strings vorher/nachher verglichen, nicht gelesen. `AUDIT_ADJUDICATION_FILE` (:146) und
die Rotationskonstanten liegen im selben Anker-Nest — mitpruefen, nicht annehmen.

Bewertung: **sauberster naechster Slice.** 186 Zeilen, eine echte Bindung, und die ist bekannt.

## Ergebnis B — auth (`server.ts:16602-16668`, 67 Zeilen): SIEBEN, und drei davon blockieren

Inhalt: `shareAuthed`, `authFails`, `failStrike`, `shareCookieOffered`, `shareGate`,
`closeShareClients`, `ALLOWED_HOSTS`, `guard`.

| Name | mal | Art |
| --- | ---: | --- |
| `json` | 5 | **Kernhelfer** |
| `Share` | 3 | Typ — liegt in `server/types.ts` ✅ |
| `PORT` | 3 | **Kernkonstante** |
| `secretEq` | 1 | **Kernhelfer** |
| `audit` | 1 | Kernfunktion — waere nach Slice A importierbar |
| `Slot` | 1 | Typ — `server/types.ts` ✅ |
| `HOST` | 1 | **Kernkonstante** |

**auth ist heute KEIN reiner Move.** Regel 2 des Slice-Protokolls verbietet
`server/` → `server.ts`; vier Nicht-Typ-Bindungen (`json`, `PORT`, `secretEq`, `HOST`) zeigen
genau dorthin. Der Slice-3-Brief hatte `json` ausdruecklich im Kern gelassen („Kernhelfer, von
hunderten Stellen benutzt") — richtig fuer transport, aber es ist die Bindung, die auth festhaelt.

**Reihenfolge, die sich daraus ergibt und die einzige ist, die ohne Regelbruch geht:**

1. **Slice 4 = audit-log** (oben). Danach ist `audit` importierbar.
2. **Slice 5 = ein kleines gemeinsames Fundament**, bevor auth ueberhaupt gehen kann: `json`,
   `secretEq`, `HOST`, `PORT` in ein Modul, das Kern UND `server/` importieren duerfen. `json`
   nach `server/transport.ts` zu ziehen ist der naheliegende Kandidat (es ist ein
   Response-Konstruktor und transport existiert nach Slice 3 bereits) — **aber ungeprueft**, und
   `HOST`/`PORT` sind Konfiguration, kein Transport. Die Entscheidung gehoert in den Brief, nicht
   hierher.
   *Kostenhinweis:* der Move von `json` selbst ist eine Zeile plus ein Import; die hunderten
   Aufrufstellen im Kern aendern sich NICHT.
3. **Slice 6 = auth**, dann ein reiner Move.

**Was hier NICHT gemessen ist** und vor dem Brief gemessen werden muss: ob `authFails`,
`ALLOWED_HOSTS` und die Rotationskonstanten modul-weite `let` sind, die der Kern reassignt
(ESM-Bindings sind read-only — ein solcher Move ist ein Laufzeit-TypeError und kein tsc-Fehler).
Die Sonde dafuer steht im Regelbuch: `rg -n '^let ' <modul>` und je Treffer `rg -n '<name>\s*='
server.ts`. Nach Augenschein sind beide `const` — **Augenschein ist hier aber genau das, was den
Slice-3-Brief falsch gemacht hat.**

## Was diese Notiz ueber „audit-queue" NICHT sagt

Der Plan listet Tier 1 als „error-channel, tmux, transport, dir-explorer, **audit-queue**, auth".
Ob damit das Audit-LOG (2439, hier vermessen) oder die Post-Land-Audit-QUEUE (`auditQueue`,
:12127, mit Drain, Helfer-Portal und Retention) gemeint ist, ist aus dem Plansatz nicht
entscheidbar. Gemessen ist das Log. Die Queue ist deutlich groesser und beruehrt den Helfer-Pfad —
sie waere ein eigener Slice mit eigener Messung, kein Anhaengsel.
