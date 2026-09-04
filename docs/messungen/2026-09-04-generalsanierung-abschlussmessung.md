---
frage: Sind die sechs Erfolgsmasse der Generalsanierung 2026-09 erreicht — nachgemessen am Baum a09d9e5, in der Fassung, die RESCOPE und die Entscheide vom 2026-09-01 ihnen gegeben haben?
urteil: "Drei von sechs sind erfuellt (3 tote Doc-Pfade = 0 von 43 und als Pin-Klasse in Stufe 1 des Land-Gates gehalten; 4 attic/repo-map/Symlinks mit 88 getrackten Dateien, NULL Symlinks im ganzen Baum und byte-gepinnter repo-map; 6 P6-Disposition auf der Registerseite geschlossen). Drei sind verfehlt, jedes mit benanntem Grund: 1 nur zur Haelfte (Blatt-Invariante und Modulgroessen halten, src/client.ts steht bei 11 067 statt <=2 000, weil der RESCOPE P5 gestoppt hat), 2 mit 33,6 % Kommentaranteil gegen <20 % und STEIGEND, 5 weil von drei Beweislaeufen einer gruen war (3602/0), einer rot an einem damals unregistrierten Check und der dritte vom Speicherdruck des Hosts nach einer Minute abgeschossen wurde. Der rote Check ist als sechzehnte Flake-Familie registriert (verify-tiering §11.2n, Basisrate 11/655 = 1,7 % auf elf verschiedenen Baeumen) — die Registrierung erfolgte NACH und WEGEN des eigenen roten Laufs und ist als solche gekennzeichnet."
bereich: [sanierung, verify, flake, struktur, ledger]
belege: [a09d9e57e471d404aba70bdf5911ae8424dfe967, 49038af, 5f8153c, 52673b6, 1e5419c, d32b69d, 509d5da, 2627564, docs/sanierung-2026-09/plan-2026-08-31.md, docs/sanierung-2026-09/p6-befundregister.md, docs/sanierung-2026-09/w2-filter.md, docs/verify-tiering.md, docs/messungen/2026-09-03-flake-basisrate-settle-for-merge.md, e2e/lane-helpers.ts#settleForMerge, e2e/merge.ts]
nicht-gemessen: Der dritte Beweislauf (vom Host abgeschossen, kein Urteil ueber den Baum); ob ein Wiederholungs-Triple gruen waere; die Ursache des Speicherdrucks jenseits der gezaehlten Posten; ob der Kommentaranteil-Filter (Zeilen, nicht Kommentarsorten) das Maass ueberhaupt richtig abbildet; die Rot-Ursache von B-05/B-14 (Remote-Audit-Abstand) — dafuer existieren die Fehlernamen jetzt, gemessen ist nichts
stand: 2026-09-04
---

# Abschlussmessung der Generalsanierung 2026-09 (P7)

**Baum:** `a09d9e5` (Suite-Beweisläufe; die drei Doc-Commits danach ändern keinen Codepfad).
**Gemessen:** 2026-09-04, Program-MAIN Slot 6, Program `b2a14b545fd31fd71ba7b9e1`.
**Gegen:** die sechs Erfolgsmaße aus `docs/sanierung-2026-09/plan-2026-08-31.md` §Erfolgsmaße,
in der Fassung, die der RESCOPE 2026-09-03 und die Entscheide vom 2026-09-01 ihnen gegeben haben.

Jede Zahl unten steht mit dem Kommando da, das sie erzeugt hat. Wo ein Maß verfehlt ist, steht
das als erstes Wort — nicht als Nebensatz.

---

## Vorbemerkung: eine Messung, die auf dem Weg falsch war

Der erste Zeilen-Trend, den ich erhob, lief als `for … git show $sha:server.ts | wc -l` in einer
Schleife und lieferte 85 / 95 / 344 / 119 Zeilen für Bäume, die zwischen 19 000 und 25 000 Zeilen
tragen. Die Pipe brach in der Schleife ab; die Zahlen sahen wie eine Messung aus. Erst der
Datei-Umweg (`git show … > f; wc -l < f`) lieferte die echten Werte. **Alle Trendzahlen unten
stammen aus der Datei-Fassung.** Der Vorfall steht hier, weil er die billigste Sorte Fehlmessung
ist: kein Fehler, kein Exit-Code, nur falsche Zahlen.

---

## Erfolgsmaß 1 — Struktur (in der RESCOPE-Fassung)

Die ursprüngliche Fassung (`server.ts`-Kern ≤ ~8 000) ist **per RESCOPE 2026-09-03 aufgehoben**;
der Plan sagt das selbst und begründet es (Blatt-Wand ab Slice 7a). Gemessen wird die
Ersatzfassung: **Kern stabil · Blatt-Invariante für `server/*` · kein Modul > ~2 000 ·
`client.ts`-Entry ≤ ~2 000.**

| Teilmaß | Ist | Urteil |
| --- | --- | --- |
| kein `server/*.ts` > ~2 000 Z. | größtes Modul `server/types.ts` = **1 641** | **erfüllt** |
| Blatt-Invariante | `grep -n '^import' server/*.ts` → **kein** Import aus `../server` | **erfüllt** |
| `src/client.ts` ≤ ~2 000 Z. | **11 067** | **VERFEHLT** (P5 ist nie gelaufen — der RESCOPE hat den Split gestoppt) |
| Kern stabil | s. u. | **teilweise** |

**Zehn Module, 2 701 Zeilen** (`wc -l server/*.ts`): `types` 1 641 · `transport` 221 ·
`audit-log` 218 · `dir-explorer` 147 · `proc` 127 · `auth` 99 · `errors` 88 · `persist` 75 ·
`tmux` 72 · `http` 13.

**„Kern stabil" — die ehrliche Zahl ist eine Differenz zweier Kräfte:**

| | Zeilen |
| --- | ---: |
| `server.ts` am Anker `vor-generalsanierung` (49038af, 2026-08-31) | 25 522 |
| `server.ts` heute | **24 603** |
| netto | **−919** |
| daneben herausgeschnitten nach `server/` | **+2 701** |
| ⇒ Server-Fläche gesamt (server.ts + server/) heute | **27 304** |
| ⇒ Wachstum der Server-Fläche gegen den Anker | **+1 782 in vier Tagen** |

`git diff --numstat 49038af..HEAD -- server.ts` = `2971 / 3890`. Der Split hat 2 701 Zeilen
bewegt; im selben Fenster ist die Fläche um 1 782 gewachsen. **Der Kern ist gefallen, die Fläche
nicht.** Über ein 7-Tage-Fenster gerechnet (Stop-Regel ii des GLM-Ersatzplans) wächst `server.ts`
sogar absolut: 22 830 (2026-08-28) → 24 603 = **+1 773**, obwohl Split-Slices landeten. Stop-Regel
ii feuert damit — was den RESCOPE-Entscheid vom 2026-09-03 **bestätigt** statt ihm zu
widersprechen: das Splitten wurde bereits gestoppt, und diese Messung ist die nachgereichte
Begründung.

**Woher das Wachstum kommt, gezählt statt vermutet.** 44 Commits berührten `server.ts` seit dem
Anker: 19 `fix`, 11 `refactor`, 11 `feat`, 2 `chore`, 1 `docs`. **Alle elf `feat`-Commits stammen
aus FREMDEN Programmen** (helper/Dual-Host ×5, studio, context, fleet-report, program-lineage,
audit-worker, slot-model) — **keiner aus der Generalsanierung.** Der Feature-Freeze hat also
innerhalb des Programs gehalten und außerhalb nie existiert; er war nie durchsetzbar, weil eine
Program-MAIN keine Autorität über fremde Programme hat. Das ist dieselbe Beobachtung, die die
GLM-Gegenprüfung als F2 führte, hier am Commit-Register nachgezählt.

## Erfolgsmaß 2 — Kommentaranteil Server-Code < 20 %

**VERFEHLT, und der Abstand ist gewachsen.**

| Menge | Kommentarzeilen / gesamt | Anteil |
| --- | --- | ---: |
| `server.ts` | 8 272 / 24 603 | **33,6 %** |
| `server.ts` + `server/*.ts` | 9 159 / 27 304 | **33,5 %** |
| `server/types.ts` allein | 493 / 1 641 | 30,0 % |

Filter: `grep -cE '^[[:space:]]*(//|\*)'` — derselbe, mit dem die GLM-Gegenprüfung am 2026-09-03
**33,3 %** maß (7 979 / 23 966). Vier Tage später: 33,6 %. Das Ziel < 20 % verlangte, ~3 300
Kommentarzeilen aus `server.ts` zu entfernen; die drei P3-Slices haben Narrative ins Archiv
(`docs/sanierung-2026-09/server-narrativ-archiv.md`, 3 148 Zeilen) verlagert, aber der Anteil ist
seither wieder gestiegen — dieselbe Fremdarbeit wie bei Erfolgsmaß 1, mit derselben
Kommentar-Dichte.

**Narrative im Archivdokument auffindbar: erfüllt** — `server-narrativ-archiv.md` existiert und
trägt 3 148 Zeilen.

**Das Maß selbst ist die Schwachstelle, nicht nur sein Ergebnis.** Es zählt Zeilen, nicht
Kommentarsorten, und die Hausregel dieses Repos verlangt ausdrücklich Kommentare, die den
Mechanismus und seinen Preis erklären. Ein Anteilsziel bestraft genau die Kommentare, die
erwünscht sind. Dieselbe Kritik steht seit `docs/messungen/video-codebase-klarheit-2026-08-25.md`
§C6 im Repo und wurde nie aufgelöst.

## Erfolgsmaß 3 — 0 tote Doc-Pfade, als Pin-Klasse geschlossen

**ERFÜLLT, und zwar mechanisch statt per Handzählung.**

```
git grep -ohE 'docs/[A-Za-z0-9._/-]+\.md' -- '*.ts' '*.sh' ':!e2e/*' ':!attic/*' \
  | sort -u | while read -r p; do [ -f "$p" ] || echo "$p"; done
```

→ **leere Ausgabe** bei **43 zitierten Pfaden**. Der Filter ist wörtlich der aus
`docs/sanierung-2026-09/w2-filter.md`, wie Planreparatur 2 es verlangt.

Die Klasse hält nicht durch diese Handmessung, sondern durch `e2e/pins.ts`
(`RULE_DOCPATH = "no docs/ path cited from live code is dead"`) — und die ist die **erste Stufe
des Land-Gates**. Zwei Zeilen, nicht eine: die erste beweist, dass der Scan lief und seine
Quellenmenge nicht leer ist, die zweite ist die Regel. Damit kann diese Null nicht mehr still
verrotten.

## Erfolgsmaß 4 — attic/, repo-map, keine Secret-Symlinks

**ERFÜLLT.**

| Teilmaß | Ist | Kommando |
| --- | --- | --- |
| Dateien im `attic/` | **88**, alle getrackt, davon 73 `.md` | `git ls-files attic/ \| wc -l` |
| ungetrackte Dateien im Baum | **0** | `git status --porcelain` |
| Symlinks im Baum (getrackt oder nicht) | **0** | `find . -type l` (ohne `node_modules`/`.git`) |
| `repo-map` frisch | byte-genau, per Pin | `RULE_MAP` in `e2e/pins.ts`, ALL PASS |
| W1-Verschiebungen | `arbeitskreis-atlas/`, `commands/`, `lerntisch/`, `studio-kit/` sind aus dem Top-Level verschwunden | `ls -d …` |

Das Ziel „~100" war laut P0b-Nachtrag ausdrücklich eine **Schätzung** („~100 Archiv-Kandidaten …
sind Schaetzungen und aus der Kommando-Spalte als solche zu lesen"). 88 ist damit nicht unter
einer Zielzahl, sondern die gemessene Menge. Die Secret-Symlinks aus dem `lerntisch/` (einer zeigte
auf `.env`) sind weg — heute existiert **kein einziger** Symlink im Baum.

**Ein Rest, der eine Entscheidung ist und kein Defekt** (`./register.sh` §5): drei Dokumente stehen
nicht im Index `docs/README.md` — `portfolio-plan-2026-09-02.md`,
`repo-map.generated.md`, `system-capabilities.generated.md`. Der Index nennt zwölf OPERATIVE
Dokumente mit Absicht; die zwei `.generated.md` sind Artefakte, das Portfolio-Dokument gehört
einem anderen Program. Nicht gepinnt, nicht von mir entschieden.

## Erfolgsmaß 5 — alle Suiten grün (3 serielle Beweisläufe), Demo baut, Live-Server auf neuem Code

### (a) Demo baut — **ERFÜLLT**

`bun run typecheck` exit 0. `bun run build` **schlägt absichtlich fehl** („this build has NO
way-back link, but the served demo-dist/ has one") — das ist der eingebaute Wächter, nicht ein
Defekt. Das Rezept dieser Maschine ist **`bun run build:live`**: exit 0, „way-back link: on
(FLEET_SITE_URL)". Wer nur `bun run build` fährt und den Fehler für einen Regress hält, jagt ein
Phantom.

### (b) Live-Server auf neuem Code — **ERFÜLLT**

Aus dem Owner-Poll `/api/sessions`: `bundleStale.stale: false` · `deployGap.codeBehind: false`
(`bootHead 84e32979`, `head a09d9e5`, `behindCount 2` — beide Commits dazwischen sind
Handoff-Prosa, kein Serverpfad) · `errors: null`.

### (c) Drei serielle Beweisläufe — **NICHT ERFÜLLT**, und zwar aus zwei getrennten Gründen

Alle drei Läufe fuhren `./e2e-isolated.sh` aus einem **auf `a09d9e5` gepinnten Worktree**
(`git worktree add --detach … a09d9e5`, `bun install --frozen-lockfile`, `git status` leer). Der
Pin war der Punkt: `main` hat sich während der Messung bewegt, die drei Läufe messen trotzdem
denselben Baum. Belegt in den Trail-Zeilen jedes Laufs:
`tree=a09d9e57e471d404aba70bdf5911ae8424dfe967`, `dirty=false`.

| Lauf | Zeit | Dauer | exit | PASS / FAIL | Verdikt |
| --- | --- | ---: | ---: | --- | --- |
| 1 | 14:37 → 15:02:02 | ~25 min | 0 | **3 602 / 0**, `ALL PASS` | **grün** |
| 2 | 15:02:25 → 15:32:41 | 30 min 16 s | 1 | 3 601 / **1** | **rot** |
| 3 | 15:33:39 → ~15:35 | ~1 min | — | — | **nicht gemessen** |

**Lauf 1** ist sauber: eine `ALL PASS`-Zeile, ein einziger Run-Identifikator im Log. (Die zweite
`isolated-…`-Zeichenkette darin ist eine Fixture-Konstante in `e2e/lane-suite.ts`, kein zweiter
Lauf — geprüft, weil zwei Run-IDs in einem Log die Signatur zweier verschränkter Läufe sind, und
dann wäre keine der Zahlen ein Urteil.)

**Lauf 2 fiel an genau einem Check:**
`⏸ a re-run is refused while the resolution is still rebased onto main (guard unchanged)`
(`e2e/merge.ts`), mit dem `detail`
`{"status":"blocked","detail":"the session is actively working right now — let it settle for a moment, then land"}`.
Das ist der Satz des **IDLE-Gates**, nicht der des Guards unter Test. Mechanismus am Code gelesen:
`e2e/lane-helpers.ts#settleForMerge` pollt 80 × 150 ms = 12 s und **kehrt danach still zurück** —
kein Fehler, kein `check()`. Der folgende merge-POST trifft dann den Idle-Gate, und der Check fällt
unter dem Namen des Guards. Basisrate über das ganze lokale Trail-Register: **11 von 655 Läufen =
1,7 %**, auf **elf verschiedenen Bäumen, jeder genau einmal**, verteilt vom 2026-08-04 bis heute.

Zum Zeitpunkt des Laufs war dieser Check in `docs/verify-tiering.md` **nicht registriert**, und das
Owner-Kriterium vom 2026-09-01 sagt dazu wörtlich: *„Ein unregistrierter FAIL macht den Lauf rot."*
**Also war Lauf 2 rot, und daran ändert sich rückwirkend nichts.**

**Lauf 3 wurde vom Host nach ~1 Minute abgeschossen** — `Terminated: 15`, ausgelöst von
Speicherdruck der Maschine, nicht von der Suite. Das ist **kein rotes Ergebnis, sondern gar keins**:
der Baum wurde nie angesehen. Der Lauf hinterließ einen Stale-Lock (`/tmp/fleet-e2e.lock`, pid
33401, Halter tot), einen tmux-Socket und ein Instanzverzeichnis; alle drei sind über die
**notierte** PID bzw. den notierten Socket geräumt worden, nie über ein Namensmuster — auf dieser
Maschine läuft immer auch der Post-Land-Audit des Servers unter denselben Namen. Der Lock war der
wichtige Teil: ein toter Halter blockiert jede fremde Suite bis zum nächsten Reap.

**Der Maschinenzustand, gemessen statt vermutet, weil er die Ursache ist:**

| | |
| --- | ---: |
| freie Speicherseiten | 3 721 × 16 KB = **~58 MB** |
| lebende `claude`-Sessions | 7 (die vier größten je 122–249 MB) |
| `bun`-Prozesse | 23 |
| **unreapte `fleet-e2e-instance-*`-Verzeichnisse** | **115 (2,7 GB)** |
| Datenträger | **89 % voll**, 22 GiB frei |

Nichts reapt diese 115 Verzeichnisse — das steht so in `./state.sh` unter „machine hygiene". Sie
sind zugleich die Post-mortem-Artefakte, aus denen §11.2m und §11.2n ihre Wurzeln gelesen haben;
sie pauschal zu löschen wäre der falsche Zug. Ein **Aufbewahrungsfenster** wäre der richtige, und
es gibt keines.

### Das Urteil zu Erfolgsmaß 5, in zwei Lesarten — und die Wahl gehört nicht mir

- **Wie gemessen (strikt): NICHT ERFÜLLT.** Ein grüner Lauf, ein roter Lauf, ein nicht gefahrener.
  Drei konsekutive Läufe gab es nicht.
- **Nach der Registrierung von §11.2n:** Lauf 2s einziger FAIL gehört jetzt einer registrierten
  Familie an und zählte damit grün. Dann fehlt nur noch Lauf 3 — also **immer noch nicht erfüllt**,
  aber aus einem reinen Maschinengrund statt aus einem Codegrund.

**Und die Registrierung selbst gehört unter Vorbehalt gelesen:** ich habe §11.2n geschrieben,
*nachdem* mein eigener Lauf daran gefallen war. Sie steht auf 655 Läufen und einem am Code
gelesenen Mechanismus, beides unabhängig von meinem Lauf — aber die Konstellation ist genau die,
vor der B-14 warnt. Deshalb stehen Messung und Registrierung hier getrennt, und die Frage „welche
Lesart zählt" ist ein Owner-Entscheid, keiner der Program-MAIN.

**Was ein Wiederholungsversuch kosten würde, damit die Entscheidung eine Zahl hat:** drei Läufe à
25–30 min = **~85 min exklusiver Suite-Mutex**, auf einer Maschine mit ~58 MB freiem Speicher, drei
lebenden fremden Lanes und 89 % Plattenfüllung. Bei 1,7 % Basisrate für §11.2n allein liegt die
Chance, dass dieselbe Familie nicht wieder feuert, bei ~95 % — die anderen fünfzehn Familien sind
darin nicht eingerechnet. Ich habe den Versuch **nicht** gestartet: Lauf 3 starb am Speicherdruck,
und ein vierter Lauf auf derselben Maschine hätte dieselbe Ursache getroffen.

## Erfolgsmaß 6 — P6-Befundliste vollständig disponiert

**ERFÜLLT auf der Registerseite, OFFEN am Owner-Tor.**

Die Disposition ist am 2026-09-04 gebaut worden (`5f8153c`) und steht als Tabelle in
`docs/sanierung-2026-09/p6-befundregister.md` §Disposition — je Befund ein Ausgang, jede Zeile am
Baum `a09d9e5` nachgesehen statt aus dem Eintrag abgeschrieben:

| Ausgang | n |
| --- | ---: |
| gefixt (Codepfad gelesen, Commit genannt) | 8 |
| begründet verworfen / als Wissen oder Methode abgelegt | 4 |
| offen, klein, ohne Owner-Entscheid baubar | 4 |
| offen, wartet auf eine Messung | 3 |
| offen, gehört dem Owner | 4 |

Dabei sind zwei Dinge sichtbar geworden, die vorher niemand hatte:

1. **B-01 ist gefixt, aber unbewiesen.** Der Codepfad trägt die Fehlernamen heute
   (`reportLaneSuite`s `j.result` hat `fails`) — eingebracht von `1748417`, einem Commit des
   Dual-Host-Programs, also als Nebenwirkung fremder Arbeit. Die Gegenprobe, die B-01 selbst
   verlangt (`e2e/helper-portal.ts`), fehlt. B-01 steht damit genau dort, wo er `3974883`
   kritisiert hat.
2. **Fünf Queue-Zeilen fehlten in der Verweistabelle des Registers** (`d07646bc`, `18a14e37`,
   `7e984bde`, `04fdfc77`, `e48ab251`). Sie waren nicht „still", aber vom Register aus unsichtbar
   — und Erfolgsmaß 6 wird an dieser Liste gemessen.

**Was fehlt, und es ist keine Arbeit:** die 14 `pending` `notiz`-Zeilen am Program sind per
Definition „als Queue-Zeile übergeben"; ihr Ausgang ist die **Disposition des Owners**. Der
Advisory-Deckel steht bei 10/10 (`program advisory filing cap reached`), also kann von hier aus
auch keine weitere Zeile entstehen. Das ist das eine echte Owner-Tor dieses Programs.

---

## Was dieses Programm geliefert hat, in einem Satz je Phase

- **P0/P0b** — Messbasis korrigiert (704 → 1 941 `server.ts:NNNN`-Zitate), sechs Planreparaturen,
  Baseline nach drei Anläufen geschlossen (`79fcb0c`: 3× ALL PASS, 3 375/3 375).
- **P1 (W1–W4)** — `attic/` als getracktes Archiv (88 Dateien), Secret-Symlinks weg, Pin-Härtung,
  Mikro-Putz. Erfolgsmaß 3 und 4 hängen daran.
- **P2** — Präfix-Regeln + Client-Bundle-Fakten, `server/`→SERVER_RULE, `attic/`→DOC_RULE.
- **P3 (a–c)** — Kommentar-Exkavation Kern mit Build-Hash-Beweis; Narrative im Archivdokument.
- **P4 (Slices 1–7a)** — zehn Blatt-Module, 2 701 Zeilen, Blatt-Invariante hält. Ab Slice 7a gibt
  es kein nächstes Blatt; der RESCOPE hat daraus die Konsequenz gezogen.
- **P5** — **nie gelaufen.** Der RESCOPE hat den Client-Split gestoppt, bevor er begann.
  `src/client.ts` ist der eine offen verfehlte Strukturposten.
- **E1/E5** (nach dem RESCOPE an P4/P5s Stelle) — Audit-Sensoren ehrlich gemacht
  (`ranIsLowerBound`, lokaler Trail-Dateiname mit Sonde) und die drei Land-Pfad-Befunde behoben
  (`1e5419c` Deploy-vs-Land, `d32b69d` spent merge watch, `509d5da` ff-lost-Backfill).
- **P6** — 23 Registerbefunde, 14 Queue-Zeilen, seit `5f8153c` je mit Ausgang.
- **P7** — dieses Dokument.

## Vier Sätze, die nicht in einer Bewertung untergehen sollen

1. **Drei der sechs Maße sind verfehlt, und sie zerfallen in zwei Sorten.** Zwei haben denselben
   Grund: `src/client.ts` (11 067 statt ≤ 2 000) und der Kommentaranteil (33,6 % statt < 20 %)
   hätten P5 bzw. eine Kommentar-Kampagne über die ganze Datei gebraucht — der RESCOPE hat beides
   gestoppt. Er hat nicht das Ziel verfehlt, er hat das Ziel geändert, und diese Messung ist die
   Quittung dafür. **Das dritte (Erfolgsmaß 5) ist anders:** es scheitert nicht am Code, sondern an
   einem roten Check aus einer inzwischen registrierten Flake-Familie und an einem Lauf, den der
   Host abgeschossen hat. Diese Unterscheidung ist der Unterschied zwischen „das Programm hat sein
   Ziel nicht erreicht" und „die Maschine konnte die Frage nicht beantworten".
2. **Der Feature-Freeze war innerhalb des Programs real und außerhalb Fiktion.** Elf
   `feat`-Commits auf `server.ts` in vier Tagen, keiner davon von hier. Ein Program-MAIN kann
   keinen repoweiten Freeze durchsetzen; wer das nächste Mal einen ausruft, braucht dafür einen
   Owner-Akt und nicht eine Programmzeile.
3. **Die zwei Maße, die halten, halten mechanisch** — Erfolgsmaß 3 als Pin-Klasse in der ersten
   Stufe des Land-Gates, Erfolgsmaß 4 über `repo-map`s Byte-Pin. Die vier, die von einer
   Handmessung abhängen, altern ab heute wieder.
4. **Das Programm endet nicht an einer Arbeit, sondern an einer Disposition.** Erfolgsmaß 6 ist
   auf der Registerseite geschlossen; was fehlt, sind die 14 Owner-Entscheide am Advisory-Deckel.
