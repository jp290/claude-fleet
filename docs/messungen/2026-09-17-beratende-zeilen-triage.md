---
frage: Die 48 offenen `notiz`/`richtung`-Zeilen kosten jede Erdung Bytes und niemand startet sie — sind sie Ballast, und wenn nein, was sind sie dann?
urteil: Nicht Ballast, und der naheliegende Schnitt waere ein Fehler gewesen. Die 48 Zeilen sind VIER Populationen mit vier verschiedenen Tueren: 5 sind fertige Arbeit, die nur am Filing-Deckel scheiterte; 18 warten auf einen Owner-Entscheid; 22 sind ungebaute Befunde mit einem Program als Traeger; 3 sind historisch. Das Byte-Argument traegt ausserdem nur fuer MAIN-/Orchestrator-Antritte — eine Lane liest diese Skripte nie.
bereich: [queue, orchestrierung, kontext, kosten, freigabe]
belege: [fleet.json tasks (48 offene notiz/richtung am 2026-09-17 15:5x), register.sh Abschnittsgrenzen, docs/messungen/2026-09-17-orchestrator-token-effizienz.md §4, docs/messungen/2026-09-17-freigabe-wartezustaende.md §1, post-land-audits.jsonl at=1788818482644, Program 710fbf40 intent]
nicht-gemessen: der Volltext jeder Zeile (gelesen wurden je die ersten ~560 Zeichen, bei 5 Zeilen mehr); ob die 22 Program-Befunde noch am heutigen Baum gelten; wie viel §2 pro zusaetzlicher offener Zeile genau waechst; ob eine Kurzform Nachlesen ausloest
stand: 2026-09-17
---

# Die beratenden Zeilen sind kein Rueckstau, sondern vier Rueckstaus

Anlass ist die Owner-Prioritaet „wir sind zu usage-heavy" und der Landung von
`docs/messungen/2026-09-17-orchestrator-token-effizienz.md` (654d265b). Deren Rang 2 will den
Antritts-Render kuerzen. Beim Nachrechnen fiel auf, dass der groesste Posten dieses Renders die
offenen Queue-Zeilen sind — und beim Nachsehen, dass fast die Haelfte davon Zeilen sind, die
der Dispatcher per Konstruktion nie startet.

## 1. Die Byte-Rechnung, und ihre Grenze

Vollstaendiger Render am 2026-09-17 15:5x: `state.sh` 13.214 B + `register.sh` 55.036 B = **68.250 B**.
Zusammensetzung von `register.sh`, gemessen an den Abschnittsgrenzen `=== N.`:

| Abschnitt | Bytes | Anteil |
|---|---:|---:|
| §1 offene Zeilen | 28.843 | 52,4 % |
| §2 Kollisionsflaeche | 11.903 | 21,6 % |
| §4 Doc-Marker | 11.457 | 20,8 % |
| §3 briefs | 1.798 | 3,3 % |
| §5 Index-Drift | 1.031 | 1,9 % |

§1 und §2 sind zusammen **74 %** und beide eine Funktion der Zahl offener Zeilen — §1 druckt sie,
§2 druckt ihre Paare. Das ist die Bauart des Skripts, keine Vermutung ueber seinen Inhalt.

**Zwei Grenzen, die mitgehoeren, sonst wird die Zahl falsch benutzt.** Erstens zahlt **eine Lane
diesen Render nie**: `state.sh`/`register.sh` sind das Antritts-Ritual einer MAIN- oder
Orchestrator-Session, eine Lane bekommt einen Brief. „Hebt die Leistung aller Lanes" waere
falsch. Zweitens ist der Posten der KLEINERE der beiden Hebel: 48 Zeilen à ~275 B in §1 sind
~13 KB je Antritt (~3.300 Proxy-Token bei B/4, ausdruecklich grob) — neben dem Hauptbefund der
Kostennotiz (593 von 661 Modellaufrufen folgen auf Tool-Ergebnisse) die zweite Geige.

## 2. Warum der naheliegende Schnitt falsch war

Der erste Gedanke war: 48 undispatchbare Zeilen archivieren, §1 und §2 schrumpfen sofort.
Nach dem Lesen aller 48 ist das **verworfen**. Es sind Owner-Richtungen im Wortlaut, ungebaute
Befunde mit Codestellen, und mehrfach Arbeit, die nur deshalb `notiz` heisst, weil beim Filen
der Deckel voll war. Ein Massen-Archiv haette die Messgroesse optimiert und die Arbeit vernichtet.

Zwei Belegpruefungen haben zwei weitere Kandidaten gekippt, und beide Fehlschluesse sind
lehrreich genug, um sie aufzuschreiben:

- `e02187bc` bittet um das Adoptieren eines verwaisten Worktrees. `git worktree list` in
  **diesem** Checkout kennt ihn nicht — aber die Zeile gehoert Program Private-repo-j und meint ein
  **anderes Repo**. Der Beleg war am falschen Baum genommen; die Zeile bleibt offen.
- `55153bc8` sieht 9,7 Tage alt und abgestanden aus. `post-land-audits.jsonl` sagt: das Audit
  `at=1788818482644` ist **rot und `adjudication: null`**. Die Zeile ist nicht abgestanden,
  sie ist **unbeantwortet**.

## 3. Die vier Populationen

**A — Fertige Arbeit, geparkt am Filing-Deckel (5).** Diese Zeilen sind auftrag-foermig, teils
mit ROLLE/GROESSE/FLAECHE; `e2ad10a9` sagt es woertlich ueber sich selbst („gehoert in einen
`auftrag`, sobald ein Platz frei wird"). Tuer: als `auftrag` filen, Original archivieren.

`80f61ed8` Stau-Sensor · `e2ad10a9` shard-empfindliche Trail-Sonde · `889b5b7c` E2E-Fixture
laeuft als Kommando · `5278d2fb` Codex-Langlauf (Freigabe erst nach Kontingent-Reset 19.09.) ·
`9ae37525` Kill einer Lane requeued ihre Zeile und der Tick startet sie neu.

**B — Wartet auf den Owner (18).** Kein Program kann sie entscheiden. Tuer: eine Owner-Antwort,
danach Konvertierung in einen `auftrag`. Drei davon blockieren etwas Benanntes:

| Zeile | was sie fragt | blockiert |
|---|---|---|
| `59135216` | Gilt fuer Runde 6 dieselbe Rueckhalteregel wie fuer R5? | das Publikationspaket |
| `247c2f37` | „das freigabe problem" loesen, evtl. zweites Token-Paar | genau die Klasse aus `docs/messungen/2026-09-17-freigabe-wartezustaende.md` |
| `0694cb78` | Teil 2: docs sollen keinen git-HEAD erzeugen (Teil 1 ist erfuellt) | die Doc-Flut |

Die uebrigen 15: `812e8458` · `233ee108` · `d5e6c26b` · `955bcc85` · `9238013d` · `24bff40e` ·
`6bd2e49c` · `262a8f71` · `8e21d437` · `3d5ee33f` · `6ec7ab69` · `fa70efe9` · `6932c133` ·
`c1ac3700` · `15896dfd`.

**C — Ungebauter Befund mit Traeger-Program (22).** Tuer: die zustaendige MAIN entscheidet,
ob daraus eine Zeile wird. Darunter die sechs Buendel-Zeilen vom 11.09.
(`df55f6c2` · `ba7df947` · `24bff40e` · `c104ba1d` · `58f61b33` · `9238013d`), die
Bestaetigung `1ee3902d` (siehe §4), das unbeantwortete rote Audit `55153bc8`, und die
Betriebs-Reste `bf43c81a` (Punkt 1: das Helfer-Daemon-Update ist bis heute nicht angestossen).

**D — Historisch (3).** `22ba3bed` und `63251255` sind am 2026-09-17 archiviert worden
(Beleg: 47 Lands an diesem Tag, die dort gehaltene Land-Tuer ist nachweislich offen, beide
verfassenden MAINs existieren nicht mehr). `39857582` haelt den Host-Entscheid vom 11.09.,
den Program `710fbf40` ausdruecklich **umkehrt** — Archiv-Kandidat, sobald jemand die Umkehr
als vollzogen bestaetigt; ungeprueft und deshalb hier nicht archiviert.

## 4. Ein Nebenbefund, reproduziert statt uebernommen

`1ee3902d` behauptet, `bundleStale` melde Bundle-mtimes vom BOOT statt live. Am selben Poll
nachgesehen: `appJsMtime` steht 4 Sekunden VOR der Startzeit des laufenden Servers.
Der Befund **reproduziert sich**. Was sich geaendert hat: `stale` ist heute `false`, das
Symptom also gerade unauffaellig — der Mechanismus ist es nicht.

## 5. Was daraus folgt, in einem Satz je Adressat

- **Owner:** 18 Zeilen warten auf dich, drei davon blockieren etwas Benanntes (Tabelle in §3).
- **Program-MAINs:** 22 Befunde liegen in euren Programs; A-Zeilen zuerst, sie sind fertig.
- **Wer den Antritts-Render kuerzt (`10e2f7c0`):** gegen 68.250 B messen, nicht gegen 60.798 B —
  und die Haelfte des Schnitts ist Queue-Hygiene, nicht Code.
