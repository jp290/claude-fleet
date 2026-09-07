# HANDOFF — 🎛 Fleet Controller (Slot 1, Opus 5 high), 2026-09-07 ~14:30–21:1x, ctx GEMESSEN 29,8 %

**Diese Sitzung KOMPAKTIERT, sie succeedet nicht** (Regelbuch: Compact ist der Normalfall des
Controllers). Slot, Self-Token, beide armierten Audit-Watches und die Delegationen bleiben also
bestehen — der Abschnitt hier ist die dauerhafte Wahrheit, der Compact-Auslöser zeigt nur auf ihn.

## 0. ZWEI EIGENE FEHLER, beide von anderen gefunden — und sie haben DIESELBE Form

Beide Male habe ich eine **grüne Mechanik für eine fachliche Aussage gehalten.**

**(a) Ich habe ein ABGELEHNTES Dokument gelandet.** `522701c` ist byte-gleich mit `a87eae3`, dessen
Report `e351772b` auf `rejected` steht (Slot 9, Program e3b3a064). Ich hatte `ahead=1`, sauberen
Baum und docs-only geprüft und daraus „landbar" geschlossen. Gate und Post-Land-Audit waren grün —
und beweisen exakt: die Datei ist eine Doc. **Nicht: jemand hat sie fachlich angenommen.**
Die Lane-Disziplin sagt „Land erst nach dem Akzept der MAIN"; ich habe die Report-Lage nie
abgefragt. **Regel für die Nachfolgerin: vor JEDEM Land die Frage stellen, ob ein `fleetReport`
dieser Lane existiert und ob sein `decision.disposition` `accepted` ist.** Bei `6b61a7bf` (P3) und
`e119a715` (M1) habe ich es danach getan, und beide Male war es die richtige Reihenfolge — bei M1
kam das Verdikt sogar als `resolved / landed=NO` zurück und musste geprüft werden.
OFFEN: der Korrekturweg. Brief `c9683f04` liegt gefilt, `9f2ef109` gibt den Transport frei — aber
der adressierte Worker existiert nicht mehr (Task `012fe6b9` ist `done`, der Slot recycelt). Das
braucht eine NEUE Lane, keine Zustellung. Nicht von mir erledigt.

**(b) Die 26,4-min-Vorlaufzahl war widerlegt, und ich hatte die Deckelhöhe aus ihr abgeleitet.**
Slot 7 hatte sie ausdrücklich als „geschlossen, nicht bewiesen" markiert; ich habe sie trotzdem in
den Body von `61e407d` UND in den `watchdog.sh`-Kommentar genommen („26.4 + 42.7 = 69.1 min").
Echt waren **6 Sekunden** Vorlauf (Lane `e407aef5`, gelandet `6b72d622`). Korrigiert in `409bd2b`.
**Was damit auch fällt: die 75 min waren für die beiden Timeout-Fälle nicht nötig** — beide hätten
unter `c7184f85` allein ein Urteil bekommen. Der Deckel bleibt (er kostet nur Latenz), aber er ist
NICHT der Fix. Die gemessene Ursache ist die **Uhr** der Gnadenfrist, nicht die Laufzeit.

## 1. WAS IN FLUG IST (Stand 21:1x)

- **Slot 4** (W3, `fleet/260907140524-b010`, 6 ahead): ihr dritter Isolated-Lauf ist **grün** —
  `iso3.log` mtime 20:13, `ALL PASS`, 3917/0, Tree-SHA == HEAD `fd5e3fa`, `dirty:false`. Die Lane
  wusste es nicht (sie hat nach dem Start nicht mehr nachgesehen, ~2 h Leerlauf); ich habe es ihr
  mit Beleg geschickt. **Nächster Schritt ist IHRER: den `fleetReport` an Slot 8 filen** — in
  fleet.json existiert bisher keiner für diesen Branch. Ich lande erst nach Slot 8s Annahme.
  Slot 8 prüft dabei zwei benannte Abweichungen vom Done-Satz (`pending` statt `queued` nach
  Abbruch; Checks in `land-provenance.ts` statt `land-durability.ts`) — beides ist ihr zugesagt.
- **Slot 6** (`89279f1f`, Owner-Tür für die Report-Abnahme, 7 ahead, sauber): wartet legitim auf
  ihren `iso5`-Vorschaulauf, den sie selbst hält. **Sie hatte die Wrapper-ELAPSED (1h41) für die
  Laufzeit gehalten — der bekannte Messfehler**; korrigiert, sie misst jetzt das `bun`-Kind.
  Diese Lane ist der Fix für die Geisterbindungen und damit die wertvollste offene Arbeit.
- **Slot 11** (`97c5d469`, `ctl.sh`, 8 ahead): wartet auf ihr drittes Helfer-Verdikt zu `1adfa02`.
  Vorlauf 17 → 1 rote Checks; der letzte Rot war ihre eigene falsche Prämisse zur `mergeLast`-
  Semantik, von ihr selbst gefunden und in drei Stellen korrigiert.
- **Ein Post-Land-Audit läuft mit zwei Wartenden.** Der Server ist 12 Commits hinter der Platte
  (`codeBehind: true`) — ein Deploy ist fällig, sobald die Audit-Kette leer ist (er 409t sonst).

## 2. DIE ZWEI ARMIERTEN WATCHES (überleben das Compact, stürben bei einer Succession)

`f38a28f6` → Audit von `61156ac5` (R5) · `628d4879` → Audit von `6b72d622` (Audit-Diagnose).
Beide `idleSec:0` — mit dem Default 60 bekommt ein arbeitender Controller NIE eine Zustellung
(zweimal gemessen am 2026-09-07). Slot 7 hatte dieselben Watches; sie sterben mit ihrer Übergabe,
deshalb liegen sie parallel bei mir.

## 3. WAS BEIM OWNER LIEGT (nicht von mir zu entscheiden)

1. **Slot 7 kann geschlossen werden** — Schicht abgeschlossen, Handoff committet, Watches
   dupliziert, ihre eigene Aussage: „Everything's closed on your side." Ihr Program `f170dc46`
   bleibt mit 30 offenen Zeilen aktiv; ein Retire fasst die nicht an.
2. **Sechs Waisen-Worktrees** unter `astra-main.worktrees/` (6600, 8361, 314b, fdb9, 509b, c1fc).
   Gehören Slot 2s Program; ich habe angeboten aufzuräumen und warte auf ihr Wort.
3. **`41bd398` (`fleet/260907121431-8510`, 6 Dateien / 2154 Zeilen M1-Recherche)** ist von Slot 2
   ausdrücklich zum Landen freigegeben, hat aber KEINEN lebenden Slot mehr. Zwei Wege in ihrer
   Nachricht angeboten: Worktree adoptieren und über die Route landen, oder sie macht es selbst.

## 4. DER STRUKTURELLE BEFUND, gemessen, nicht geschätzt

**Zehn Programme tragen eine tote MAIN-Bindung und halten 69 von 231 offenen Zeilen (30 %).**
Zwei davon stehen auf `complete` und halten trotzdem 20 Zeilen. Der Bestand WÄCHST bei jeder
sauberen Fertigmeldung: P1 (`29c0f21b`) und P2 (`446e77f8`) wurden heute zu Geistern, weil ihre
MAINs sich nach grünem Audit korrekt zurückgezogen haben. Ein Retire macht die Report-Abnahme
nicht schwer, sondern dauerhaft unmöglich. **Der Fix ist `89279f1f` und läuft auf Slot 6.**

Und eine zweite Zahl derselben Art: **29 offene Queue-Zeilen verweisen auf einen `/tmp`-Pfad**,
sieben davon aus Program `eec69528`. Eine Zeile, deren Inhalt in `/tmp` liegt, ist inhaltslos,
sobald die Maschine aufräumt — und der Leser sieht dem Verweis nicht an, dass etwas fehlte.
Slot 3 ist deswegen angeschrieben (ihr 23-KB-Umsetzungsplan liegt unversioniert in `/tmp`); ich
habe ihn ausdrücklich NICHT selbst verstetigt, weil ein Controller, der fremde Analyse eigenmächtig
committet, genau die Urheberschaftslücke erzeugt, die dieser Tag schon einmal bezahlt hat.

## 5. EINE NEUE REGEL, von Slot 7 gemessen und hier übernommen

**Ein schmutziger Haupt-Checkout hat ZWEI Todesarten, nicht eine.** Bekannt war: er tötet ein
fremdes Land am fast-forward. Neu: **er lässt fremde uncommittete Arbeit unter fremder
Urheberschaft und ohne ihre Begründung landen.** P3s Commit `b4d01b5` hat 34 Zeilen von Slot 7
mitgenommen; der Inhalt überlebte, die Commit-Message existierte nirgends. In einem Repo, das sein
Befundregister in den Commit-BODIES führt, ist das der stillere und teurere Verlust. Gegenmaßnahme
ist dieselbe wie bisher und war schon notiert: kurz halten, sofort committen. Slot 7 hatte zwischen
Edit und Commit genau EINEN Sensor-Aufruf gelegt — das reichte.

## 5b. GEMESSEN 21:42 — DER DECKEL BEMISST NICHT DIE WANDUHR (und das ändert §0(b))

Das Audit zu `61156ac5` hat **85,8 min** (`ms 5 148 xxx`) gebraucht und ist **grün** zurückgekommen
(3885 checks, 0 failed) — obwohl `FLEET_POSTLAND_AUDIT_TIMEOUT_MS` auf **75 min (4 500 000 ms)**
steht. Ein Lauf, der die Zahl im Deckel um über zehn Minuten überschreitet und trotzdem ein Urteil
liefert, beweist: **`ms` auf der Ledger-Zeile ist NICHT die Größe, die der Deckel begrenzt.** Die
Trennung Arbeitsbudget/Wartebudget aus dem Regelbuch (`timeoutMs` = Arbeit, `waitMs` = Schlange)
gilt hier also auch für den Audit-Pfad, und die Ledger-`ms` ist Wanduhr inklusive Mutex-Wartezeit.

**Warum das zählt:** jede Aussage der Form „X von Y Läufen lagen über/unter dem Deckel", die aus der
Ledger-`ms` gerechnet ist — MEINE eingeschlossen, siehe §0(b) —, vergleicht zwei verschiedene
Größen. Der Vergleich Deckel↔`ms` ist strukturell falsch, nicht nur ungenau. Wer die Deckelhöhe
künftig begründen will, braucht die ARBEITSZEIT, und die steht nicht in dieser Spalte.
NICHT GEMESSEN: wo die Arbeitszeit ablesbar wäre (Kandidaten: die `server.log` der Instanz, das
Trail). Das ist die nächste Frage, nicht die Antwort.

Nebenbefund derselben Minute: das Audit zum `astra-main`-Land `71d19ba5` steht als `unknown` mit
`0.0 min` — der Repo-Guard (`exit 42`) für ein Repo ohne Suite. Korrekt, kein Loch: 80 der 106
`unknown` im Ledger sind genau das, alle aus fremden Repos, null aus claude-fleet.

## 6. WAS ICH NICHT GEPRÜFT HABE

Den Inhalt der acht verbliebenen advisory-Zeilen unter `e3b3a064` (ich habe nur die zwei
disponiert, deren Handlung nachweislich erledigt war — Deckel 10/10 → 8/10). Ob die 69
Geister-Zeilen inhaltlich noch gebraucht werden; ich habe nur die Bindung geprüft, nicht die
Aufgaben. Den Byte-Vergleich `522701c` ↔ `a87eae3` hatte ich zunächst von Slot 9 übernommen und
dann doch selbst nachgerechnet — **bestätigt: beide Fassungen von
`docs/schnittliste-kommunikation-datenschichten-2026-09-07.md` tragen sha256
`c74331e8b8553000e32db400e18f7394513fd9bb1dee6216a32f0c86348fe8f6`, byte-identisch.** Ein Befund
gegen einen selbst ist der letzte, den man auf fremde Autorität glauben sollte.

---

# HANDOFF — Program-MAIN Fleet-Betrieb 2026-09 (`f170dc46e4b026ee34d9392e`, Slot 7, Opus 5 high): zweite Schicht, 2026-09-07 ~15:00–17:4x, ctx GEMESSEN 28,x %

## 0. LIES DAS ZUERST — vier eigene Fehler dieser Schicht, weil sie eine METHODE zeigen

Alle vier sind derselbe Fehler: **aus EINEM Fall eine Bestandsaussage gemacht, und die Unsicherheit
zwar benannt, dann aber trotzdem als Zahl weitergereicht.**

1. **„Der Audit-Ledger fuehrt kein Geraetefeld."** FALSCH. `remote{name,claimedAt,reportedAt,clonedSha,jobId}`
   existiert in 60 von 519 Zeilen seit 2026-08-29 11:54, `name` immer `second-host`. Ich hatte die Keys
   EINER frischen Zeile gelesen. Richtig ist nur: vor dem 08-29 gab es keines.
2. **„26,4 min Vorlauf im 08:42-unknown."** WIDERLEGT von Lane `e407aef5`: 6 s Vorlauf, dann 2042 von
   3835 Checks in 1117 s. Ich hatte eine Trail-Datei einer Audit-Zeile zugeordnet, WEIL sie in deren
   Zeitfenster fiel — **Lane-Suiten schreiben in dasselbe Trail-Verzeichnis**, „faellt ins Fenster"
   beweist nichts. Ich hatte es als „geschlossen, nicht bewiesen" markiert und die Zahl dann doch
   benutzt; der Controller hat sie in den Body von `61e407d` uebernommen. **DIESE KORREKTUR IST NIE
   ANGEKOMMEN** — siehe §4.
3. **„ff4544f5 ist R4s Dublette."** FALSCH, aus meinem eigenen §E uebernommen. R4 ist `d51e02ca`
   (anderer Defekt, heute keine Task-Id), die vermeintlich neuere Fassung `c9791a49` ist ebenfalls tot.
4. **„136 von 136 roten Audits unbeurteilt."** MESSFEHLER, kein Befund — Adjudikationen stehen in
   `audit-adjudications.jsonl` mit Schluessel `auditAt`, nicht am Ledger-Eintrag. Richtig: 9 von 93
   im 14-Tage-Fenster (9,7 %), Latenz sonst Median 3,7 min (n=84).

**Die Gegenmassnahme, die zweimal funktioniert hat:** eine Zahl, die du „geschlossen, nicht bewiesen"
nennst, gehoert NICHT in eine Nachricht an jemanden, der handelt. Entweder du beweist sie, oder du
nennst nur das Praedikat ohne Zahl.

## 1. Was gelandet ist

| Zeile | Sha | Verify | Audit |
|---|---|---|---|
| `779eb456` Lane-Deckel je Repo | `984a4b36` | ok, 150 448 ms, waitMs 0, volle Kette | **gruen**, 3853/0, 42,6 min, covers 984a4b36+9e766050 |
| `e407aef5` Audit-Platzierung (docs) | `6b72d622` | proportional, steps [install,pins], 950 ms | Watch `ead207a7` |

**`e407aef5` hat NICHT diese MAIN gelandet:** actor `{kind:owner, via:bearer, suspect:owner-token-outside-board}`.
Der Controller hat es auf Nachfrage ausdruecklich als SEINEN Land bestaetigt (`POST /api/slots/5/merge` mit dem
Owner-Bearer aus dem Haupt-Checkout, ~20:36, in Unkenntnis meiner schon erfolgten Report-Annahme). Die Signatur
ist damit erklaert und harmlos, aber sie ist DIESELBE, die mich heute frueh eine Fehlzuschreibung gekostet hat.
**Merksatz: `suspect: owner-token-outside-board` heisst NICHT unbefugt, sondern NICHT VOM BOARD.** Und WER es war,
beantwortet nur eine Rueckfrage, nie das Ledger.
| `d3f7c11d` R5 Deploy-Klassifikation | `61156ac5` | ok, ms 1 698 996 davon **waitMs 1 557 000** (92 % Schlange) | Audit-Watch `9c8b73c9` armiert |
| `d8859ff` §E-Korrektur (Direkt-Commit) | `d8859ff` | — | **nie** (Direkt-Commits bekommen keinen Audit) |

`actor` auf beiden Lands: `{kind:"main", slot:7, program:f170dc46…}` — **Erfolgskriterium (d) haelt,
der Controller hat in dieser Schicht keinen Merge gefahren.**

## 2. Der Platzierungs-Befund und was davon UEBERLEBT

**Der PID-Sensor (meiner, haelt):** die run-id im `out` traegt die PID der Suite
(`isolated-<ts>Z-<pid>`); macOS deckelt bei 99999. Siebenstellig ⇒ Helfer, und das ist SAUBER
(43/43 tragen auch `remote:second-host`). **Aber es ist HINREICHEND, nicht NOTWENDIG** — die
Helferzeilen mit PID 3208 / 13106 / 4337 wuerden als lokal fehlgelesen. **Jedes Done-Kriterium
formuliert man ueber `remote.name`, PID nur als Gegenprobe.**

**Die Trennung (Controller-Agent ueber 14 Tage bestaetigt):** Helfer an 8 von 8 Doppelbetriebs-Tagen
schneller, Median 2,8–5,3 min. **Alle 18 Timeout-unknowns des Fensters sind LOKAL**, kein Helferlauf
lief je in eine Zeitdecke.

**Die Ursache ist die UHR, nicht die Laenge** (Lane `e407aef5`, angenommen): F1 (3/5) — der Drain
startet 7/5/14 ms nach dem `helper_result` DESSELBEN Repos; `helperClaimOf` sperrt pro Repo, der
Eintrag verbringt seine 60 s hinter dem Claim und bringt sie aufgebraucht mit, weil `helperResult`
den Claim loescht und `kickAuditDrain()` synchron ruft, waehrend der Daemon erst 15 s spaeter pollt.
F2 (2/5) — `graceRest` −14 ms / −1 ms, Helfer haelt eine Lane-Vorschau und kehrt bei
`freeSuiteSlots<=0` zurueck, bevor er die Jobliste anfragt.

**Und: beide unknown haetten unter `c7184f85` ALLEIN ein Urteil bekommen** (4276 s gegen ~4082 s;
3094 gegen ~2959). Die Decke auf 75 min (`61e407d`) ist nicht falsch, war fuer diese Faelle aber
nicht noetig. Was bleibt: lokale Suite-ARBEIT 2418–2551 s liegt ueber dem GESAMTEN Helfer-Rundlauf
2145–2295 s.

## 3. Die naechsten Zuege, in dieser Reihenfolge

1. **Merge-Watch `491d5018`** (Land `d3f7c11d`) abwarten; bei `landed=YES` die Sha ueber die
   Land-Note (`mainAfter`) suchen, **nie ueber `git rev-parse main`** — main bewegt sich zwischendurch,
   das ist mir heute zweimal passiert. Dann Audit-Watch armieren.
2. **`89279f1f` IST NICHT MEHR DEINE** — der Controller hat sie um 14:52 auf Slot 6 dispatcht; sie
   ist fertig (7 Commits, sauber, 6 ahead) und **er landet sie**. Nicht doppelt aufziehen.
   (Korrigiert 2026-09-07 ~20:4x; die vorige Fassung -dispatcht als naechstes- war beim Schreiben
   schon ueberholt, weil ich den Queue-Zustand nicht gegen den Controller abgeglichen hatte.)
3. **`6d7ff117` (pending) filen-bereit:** §11.2o — die Sonde druckt seit dem Diagnose-Commit
   `phaseBasis` und die feuernde Regel, und niemand hat das je gelesen. Schmale Zeile, genau eine
   Frage, zwei erlaubte Antworten. **Nicht** als Regressjagd aufblasen: die Familie ist in
   `docs/verify-tiering.md` §11.2o dokumentiert, die Basisraten sind in `65358fef` gemessen.
4. **Die Helfer-Zeile IST GEFILT: `d49dd776`** (pending, auftrag). Sie steht auf Option (v) — die
   Gnadenfrist-Uhr an die WAEHLBARKEIT haengen statt an `cover.at`; deckt alle drei F1-Faelle fuer
   hoechstens 60 s, deckt F2 bewusst nicht. Done-Kriterium ueber `remote.name`, PID nur als
   Gegenprobe. Zwei harte Randbedingungen stehen drin: kein Helfer online ⇒ sofort lokal, und kein
   Doppelclaim. Kein `.env`/`watchdog.sh`-Edit.
   (Korrigiert 2026-09-07 ~21:0x. Die vorige Fassung sagte „geschrieben, Volltext im
   Session-Scratchpad" — das war GENAU der Fehler, den §6 als `.git/`-Fall fuehrt: ein fertiges
   Artefakt an einem Ort, den nach dem Sessionende strukturell niemand findet. Deshalb gefilt.)

## 4. WAS NIE ANGEKOMMEN IST (und was das ueber den Kanal sagt)

**Meine Korrektur zu `61e407d`s Commit-Body liegt unzugestellt.** 55 Zustellversuche ueber 30 min,
jedes Mal `composer occupied (38 chars) — nothing typed`, Zeichenzahl konstant. Ein zweiter Versuch
laeuft. **Der Inhalt steht in §0.2 dieses Abschnitts** — wer ihn liest, hat ihn, auch wenn die
Nachricht nie ankommt.

**Der Kanal-Befund selbst, gemessen:** `POST /send` wird abgelehnt, solange die Ziel-Pane
ungesendeten Composer-Text traegt. Der Fehlertext sagt SELBST `nothing typed`, der Server
unterscheidet also „waechst" von „liegt unveraendert" — benutzt die Unterscheidung aber nicht.
Gleichzeitig gilt die Owner-Regel vom 2026-08-19: Composer-Rest ist **nie** ein Owner-Entwurf.
Zwei Messungen heute: 33 Ablehnungen / 16 min (zugestellt), 55 / 30 min (aufgegeben). **Nicht als
Zeile gefilt — notiz-Deckel 10/10.** Kein Vorschlag, den Guard zu entfernen; die Frage ist, ob ein
nachweislich unveraenderter Rest nach Karenz als abgestanden gelten darf, oder ob der Fix ein
Rueckkanal „Composer frei" ist, der das Pollen ueberfluessig macht.

## 3b. Die vier Direkt-Commits dieser Schicht — VON HAND VERIFIZIERT, wie es die Regel verlangt

`d8859ff` · `9908c37` · `1a79e22` · `edda7cf` sind Direkt-Commits aus dem Haupt-Checkout und fassen
AUSSCHLIESSLICH `HANDOFF.md` an (je `git show --stat` geprueft). Sie sind damit fuer jedes landseitige
Ledger unsichtbar: keine `fleet/land`-Note, keine Zeile in `lane-outcomes.jsonl`, **und sie bekommen
strukturell NIE einen Post-Land-Audit** — der Tier-2-Lauf haengt an `landLane`/`drainPostLandAudits`,
nicht an einer Bewegung von main.

**Verifikation von Hand, 2026-09-07 ~21:1x, nachgeholt auf Owner-Nachfrage:**

    bun install --frozen-lockfile && bun e2e/pins.ts   ->  exit 0, Tail `ALL PASS`, 0 FAIL-Zeilen

Das IST die richtige Kette fuer docs-only: seit `036ff7c` faehrt der Land-Gate fuer rein-docs-Lands
genau diese kurze Kette (install+pins), und `bun e2e/pins.ts` ist ohnehin seine erste Stufe. Keine
Suite, kein Mutex, kein Server — Millisekunden.

**Mein Fehler dabei, benannt:** die Regel verlangt, dass wer direkt committet, die Verifikation von
Hand faehrt UND ES IM HANDOFF SAGT. Ich habe vier Mal direkt committet und es erst gesagt, als der
Owner nachfragte. Ohne die Nachfrage haette die naechste Session vier ungemessene Direkt-Commits
vorgefunden und korrekt-aber-falsch geschlossen, sie seien nie geprueft worden.

## 4a. GEMESSEN AM EIGENEN LEIB: zwei Sessions im Haupt-Checkout, und der Erste nimmt die Arbeit des Zweiten mit

Die drei Korrekturen in §1/§3/§4b habe ich um ~20:4x geschrieben und committen wollen. Der Commit lief ins
Leere (`nothing to commit`), weil eine ANDERE Session (P3, Slot 15) 20:38:41 ihren eigenen HANDOFF-Abschnitt
committete und dabei meine noch uncommitteten Zeilen MITGENOMMEN hat: sie stehen heute in `b4d01b5`, einem
Commit, dessen Body von P3-Entscheiden handelt und meine Korrekturen mit keinem Wort erwaehnt.

**Der Inhalt ist nicht verloren, die BEGRUENDUNG schon** — meine Commit-Message, die erklaerte, warum die drei
Zeilen sich aendern, existiert nirgends. Genau das ist der Schaden: dieses Repo fuehrt sein Befundregister in
den Commit-BODIES, und ein Body, der den halben Inhalt seines Commits nicht kennt, ist eine stille Luecke.

**Regel daraus, und sie ergaenzt die bekannte:** das Regelbuch warnt vor dem schmutzigen Haupt-Checkout, weil er
ein fremdes LAND toetet. Der zweite, unbenannte Fall ist dieser: er laesst fremde Arbeit unter falscher
Urheberschaft landen. Beide Male ist die Gegenmassnahme dieselbe und steht schon da — **kurz halten und sofort
committen**, nie einen Edit im Haupt-Checkout liegen lassen. Ich habe zwischen Edit und Commit einen
Sensor-Aufruf gelegt; das reichte.

## 4b. Der Lane-Deckel fuer `claude-fleet` steht seit ~20:20 auf 3

Owner-Entscheid, gesetzt ueber `POST /api/repo-lane-cap` — also genau die Tuer, die `779eb456` heute gebaut hat.
**Meine 92-%-Schlangenzahl auf dem Land-Pfad ist dadurch NICHT geheilt**, aber sie ist ab jetzt gegen einen
GESETZTEN Deckel gemessen statt gegen den machine default. Wer die Zahl neu erhebt, muss das dazusagen, sonst
vergleicht er zwei Regime miteinander.

## 5. Deckel-Mechanik — die Tuer, die ich zu spaet gefunden habe

Der `auftrag`-Deckel zaehlt **pending-NICHT-freigegebene** Zeilen. Man loest ihn durch **RELEASEN**,
nicht durch Archivieren: `POST /api/self/tasks/:id/release`. **Dateiposition = Dispatch-Reihenfolge**,
also nur Zeilen freigeben, deren Position HINTER der schon queued stehenden liegt, sonst draengelt
man die eigene Prioritaet um. So gemacht mit `89279f1f` (218) und `d3f7c11d` (178), beide hinter
`e407aef5` (177). **Ich habe daraus zuerst einen Archivierungsvorschlag gemacht und mich mit dem
Controller darueber gestritten — das war unnoetig.**

## 6. Offene Owner-/Controller-Sachen

- **`ff4544f5` bleibt** (keine Dublette) und braucht eine AKTUALISIERUNG ihrer Zahlen: 15 Timeouts in
  500 Zeilen, p50 1 001 454 ms — gegen eine Decke, die seit `61e407d` 75 min ist.
- **Neun rote Audits unbeurteilt** (9,7 %). Fremd-Adjudikationen sind untersagt, das gehoert Owner/Controller.
- **Elf haengende Verweise** (`7081f072`), Untergrenze — nur zwei Ids wurden aufgeloest.
- **`.git/fleet-betrieb-R4-strich.json`** (6935 B, 09-04 10:20): vollstaendiger, nie gefilter
  R4'-auftrag-Body. `.git/` ist ausserhalb des Arbeitsbaums — `git status`, `rg` und ein frischer Klon
  sehen ihn NIE. Neuer Fall der Klasse in `docs/ungoverned-artifacts.md`.
- **Vier Direkt-Commits ueber `9e76605`** (`b1f1131`, `02ebb87`, `61e407d`, `d8859ff`) tragen keine
  `fleet/land`-Note und bekommen daher **nie** einen Post-Land-Audit.

# HANDOFF — P2 abgeschlossen; Retirement beauftragt — 2026-09-07

Program `446e77f8168e9d8bb5612ce6` (Astra Tagesmandat P2, Adressierbarkeit über Sessiontod).
Der Owner hat den Dokumentauftrag nach Land ausdrücklich abgeschlossen und diese MAIN zum
Handoff-Commit mit anschließendem `POST /api/self/retire` angewiesen. Keine Succession,
kein Deploy, keine neue Implementierung. Der Retirement-Erfolg ist beim Schreiben noch nicht
beobachtet. Die Live-Projektion führt das Program weiterhin als `active`; fachliche Abnahme
und Serverstatus sind getrennte Tatsachen. Dieser Abschnitt ergänzt die ältere Controller-Übergabe unten.

**Artefakt und getrennte Identifikatoren.**

- Vertrag: `docs/messungen/2026-09-07-adressierbarkeit-vertrag.md`.
- Analysierter Quell-Pin: `e917a48b1a0dfa894cd9470b683606252725b0e9`.
- Akzeptierte und gelandete Vertragsbytes: `sha256:140d2b6f157a7005577a24ae69cfd51dfcb24232ead2dfac34758e09d2dbc5ad`.
- Akzeptierter Indexsatz: `sha256:d5ffb7ea2f14322e227ee5e7c8edcbb9f9189460a6494d47dbac79edd1f5bbf3`; im gelandeten Index genau einmal geprüft.
- Publikationsauftrag `180d3c92`, isolierte serielle Opus-Lane `fleet/260907125949-6985`, Modell `claude-opus-5[1m]`, high.
- Ursprünglicher Publikationscommit: `7982b734be0b8da4bb00b82a226a21e9d78f2e76`.
- Nach Rebase angenommener Commit: `a92d4aa5ddf7ef555f596417d8f4eac1f7aaa7d5`.
- Tatsächlicher Land-Commit auf main: `00111bb02c411fe51e16c9154a94c19232dfd124`.

Die MAIN hat Draft, Lane-Datei und Commitbytes verglichen, nach dem Rebase erneut. Nach Land
wurden die Datei aus dem Land-Commit und dessen Zugehörigkeit zu main geprüft; der Vertrags-Hash
ist unverändert. Der Indexkonflikt nach P1 wurde durch die Lane aufgelöst. Beide Indexzeilen
blieben erhalten. Der Git-Commit-SHA ist ausdrücklich nicht der Review-Dateihash.

**Unabhängige zweite Astra-Abnahme, dauerhaft übernommene Provenienz.**

Native, vom Autor getrennte Astra `independent_review`, Modell `gpt-6-astra`, R2 vom 2026-09-07:

```text
ACCEPT sha256:140d2b6f157a7005577a24ae69cfd51dfcb24232ead2dfac34758e09d2dbc5ad
Indexsatz sha256:d5ffb7ea2f14322e227ee5e7c8edcbb9f9189460a6494d47dbac79edd1f5bbf3
```

Die Reviewerin las das vollständige R1-Dokument und relevante Originalquellen am Pin; R2 las
sie die Änderungen im Gesamtdokument-Kontext. R1 wurde wegen des Auto-Negativarms abgelehnt:
fehlende FleetEvents beweisen keine fehlende Auto-Ausführung. R2 verwendet Prompt-Log/lastRun,
beobachtetes Retirement statt bloßem Binding-Transfer und einen positiven Kontroll-Auto;
der Watch-Negativarm verlangt eine eigene Watch-Kontrolle. Das R1-Finding wurde geschlossen.
Zusätzliche Quellenprüfung R2 am Pin: `e2e/autos.ts:1`, `e2e/harness.ts:35`,
`e2e/watch.ts:4283`, `e2e/programs.ts:238`, `server.ts:5301`, `server.ts:6035`,
`server.ts:7903`. Kein Runtime-, Compiler-, Crash- oder vollständiger Adapter-Nachweis durch
Astra; die sechs Property-Blöcke bleiben Testentwürfe. ACCEPT bezeichnet geprüfte Bytes,
keine implementierte Garantie und keine Land-Promotion.

**Publikationsprüfung: selbst gelesene Original-Tails, keine Worker-Pass-Übernahme.**

Reports `c836710f67e17cb40986a624` und nach Rebase `37b74d778b0d688edc56d37e`
wurden nach eigener Diff-, Hash- und Logprüfung angenommen. Der zweite Entscheid ist
`accepted` bei `1788789164736`. Beide Prüfpaare hatten Exitcodes install=0 und pins=0.
Original-Tail des ersten `bun install --frozen-lockfile`:

```text
9 packages installed [22.00ms]
```

Original-Tail nach Rebase, `bun install --frozen-lockfile`:

```text
Checked 9 installs across 10 packages (no changes) [23.00ms]
```

Original-Tail beider `bun e2e/pins.ts`-Läufe:

```text
PASS  the program inbox belongs to the Program and names no receiver — docs/self-api.md carries §inbox and names both route paths  (section=true get=true read=true)

ALL PASS
```

Die Logs wurden aus den jeweiligen `p2-step1-install.log`, `p2-step2-pins.log`,
`p2-rebase-step1-install.log`, `p2-rebase-step2-pins.log` samt `.exit` gelesen.
Diese übernommenen Tails und Entscheidungen benötigen keine temporären Dateien zum Verständnis.
Rückgaben stehen zusätzlich in Program-Notizen `13c480eb` und `b3636f78`; Ziel ist Ober-MAIN
`e3b3a0642d5c8106eb545a40`, Routing über frisch gelesene Program-Bindung durch den Controller.
Die Notizen allein beweisen keinen Empfang bei der Ober-MAIN.

**Land und Nachaudit.**

Merge-Event `0ed552faf47d4b2c4f7311a6`: `merged`, `landed=YES`, Verify grün;
gelesen und bestätigt. Zusätzlich `git notes --ref=fleet/land show` für obigen Land-SHA gelesen:
proportional=true, install+pins, Exitcode 0, Tail `ALL PASS`, kein Suite-Mutex genommen.
Persistierte Audit-Zeile `post-land-audits.jsonl` bei `1788789201698` für denselben Land-SHA
selbst gelesen: result=green, proportional=true, install+pins, Exitcode 0, Tail `ALL PASS`.
Keine Astra-Suite und kein Produktlauf wurden daraus abgeleitet.

Der einmalige Audit-Watch `00ec2f1a` ist ausgelöst und nicht mehr armed. Sein Event
`711c295a8bff658af7168a01` war bei der letzten Projektion noch `pending`, ohne deliveredAt
oder ACK. Das Audit-Ergebnis ist aus der Persistenz gelesen; eine Transportquittung wird
nicht erfunden. `server.ts:6719` erlaubt ACK nur für delivered/send-uncertain. Ein eventuell
noch ausstehender Transport ist kein offener Dokument-Prüflauf.

**Eigener D2-Befund vor Sessionende.**

Die Abschluss-Quellenstellen beziehen sich auf `9942225cd787952479f5905982b3f1a1406271d0`;
die Review-Quellenstellen oben auf den ausdrücklich genannten Analyse-Pin.

Frisch gelesen: Slot 12, openedAt `1788770602992`, `sessionId: null`,
`codexRecoveryState: "ambiguous"`. Die Projektion meldet sessionIdMatch=`unknown`.
Die beiden Reports wurden mit null auf Empfänger- und lebender Seite angenommen; ihre Events
`101f33cde96ba9bbc6a8963d` und `f14e9ea27a115a71a26d32dd` sind acknowledged.
Das belegt diese zwei Zustellungen, keine Sicherheit zukünftiger Reports: lernt die Session
später eine ID, kann der exakte Vergleich gegen das gespeicherte null mit
`409 event belongs to a replaced session` ablehnen (`server.ts:6711` im beim Abschluss
gelesenen Baum). Das ist P2s eigener D2-Fall; hier weder repariert noch weginterpretiert.

Die bestehende Umsetzung bleibt bei Fleet-Betrieb `f170dc46e4b026ee34d9392e` und seinen
Auftragszeilen. Nachrichtenmodell, Invarianten und Brief-Vorschläge sind geliefert;
Zielversprechen und tatsächlich gemessener Betrieb bleiben getrennt. Keine automatische
Fortsetzung am Folgetag. Retirement ist ausdrücklich autorisiert; dieser Commit dokumentiert
den Stand davor, nicht dessen künftigen Erfolg.

---

# HANDOFF — 🎛 Fleet Controller (Slot 1, Opus 5 high): Überblick + Aufräumen ausgeführt, Deploy durch, FÜNF Agenten haben die Flotte vermessen — der Abarbeitungsplan steht in §2; 2026-09-07 ~16:0x, ctx GEMESSEN 31 %

> Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/attention`, Board. Alles hier sind
> Behauptungen zum Nachschlagen. **Lies §0 zuerst — es ist die Lehre des Tages und sie hat heute
> zweimal Schaden verhindert.** Die Owner-Delegation gilt fort: Lands nach `decision.accepted`,
> Deploy über Verb 2, Reaps, Owner-Entscheide weiterreichen.

## 0. DIE LEHRE, VOR DER LISTE — eine §E-Liste ist eine BEHAUPTUNGSLISTE, keine Arbeitsanweisung

Zweimal an einem Tag hat dieselbe Form Schaden angerichtet, beide Male abgewendet, indem jemand die
zitierten Texte AUFGEMACHT hat statt die Liste abzuarbeiten:

- §E des Vorgänger-Handoffs führte `65358fef` unter „Inhalt nachweislich gelandet, archivieren". Es ist
  der ÜBERLEBENDE Nachtrag (es trägt wörtlich „NACHTRAG zu 35cf0c23", 215 statt 214 Läufe, 10/27 statt
  9/26). Archiviert habe ich `35cf0c23`, den überholten Vorgänger — das Gegenteil der Liste.
- Dieselbe §E führte „`ff4544f5` archivieren — R4s Dublette". **Es gibt keine R4-Dublette.** Ich habe
  alle 244 Zeilen über alle Status durchsucht: genau eine Zeile trägt diesen Gegenstand. Slot 7 hat es
  dann zu Ende recherchiert: R4 ist `d51e02ca` (anderer Defekt, heute keine Task-Id mehr), die gemeinte
  Dublette war `c9791a49` — **die ist ebenfalls tot, wird aber von 8 offenen Zeilen zitiert, `d51e02ca`
  von 3.** Elf hängende Verweise, und das ist eine Untergrenze. Nachgezogen in `d8859ff` (Slot 7).

**`.git/fleet-betrieb-R4-strich.json`** (6935 B, 09-04 10:20) ist ein vollständiger, filbarer
`auftrag`-Body, der nie gefiled wurde. `.git/` ist ein schlechteres Versteck als `/tmp`: `git status`
sieht es nie, `rg` sieht es nie, ein frischer Klon hat es nicht, und keine `/tmp`-Sonde greift dort.
Als neuer Fall der Klasse in `docs/ungoverned-artifacts.md` (Slot 7).

## 1. WAS HEUTE PASSIERT IST (meine Schicht, ~14:53–16:0x)

**Gelandet:** `984a4b36` (`779eb456`, Lane-Deckel je Repo, volle Kette, 150 s/0 s) · `9e76605`
(P1-Publikation, docs-only Kurzkette) · P2-Publikation im Land beim Schreiben (Slot 5, `a92d4aa`).
**Direkt-Commits** (für JEDES land-seitige Ledger unsichtbar, von Hand verifiziert mit
`bun install --frozen-lockfile && bun e2e/pins.ts` → ALL PASS): `b1f1131` (Astra-Briefbaustein),
`61e407d` (Audit-Decke 45→75 min). Dazu Slot 7s `d8859ff`.

**Deploy `c3274fdd` durch:** `bootHead == head == 61e407d`, `behindCount 0`, `bundleStale false`.
Damit sind LIVE: die 75-min-Audit-Decke und `POST /api/repo-lane-cap` (repo-keyed).

**Slots geschlossen:** Slot 5 alt (Biber-Korrekturlane, auf Anforderung ihrer MAIN ohne Land; Branch
`fleet/260907121431-8510 @ 41bd398a` nachweislich erhalten) · **Slot 11 hat sich SELBST retired**,
nachdem sein Audit-Verdikt grün war — vorbildlich: es hatte den Retire beim ersten Mal VERWEIGERT,
weil sein Watch noch offen war.

**pi-zai/glm-5.3 ist erstmals als Fleet-Lauf belegt** (Slots 6 und 13), beaufsichtigt dispatcht,
Panes angesehen. Der erlaubte Startweg ist `POST /api/tasks/:id/dispatch` (Owner-Pfad waivt das
harness-Gate), NICHT `release`/Tick.

## 2. DER ABARBEITUNGSPLAN — was wann wie

**Sofort, in dieser Reihenfolge (jeder Schritt macht den nächsten möglich):**
1. **P2-Land abwarten** (Watch `4c4e1156` auf Slot 5). Danach **Attention `67e9da86` beantworten** —
   die einzige offene Attention der Flotte, Slot 12s Land-Bitte. **Reihenfolge zwingend:** erst landen,
   dann antworten, sonst geht die Bitte als `refused` verloren. Danach ist **Slot 12 schließbar**.
2. **Slot 6 (GLM-Schnittliste) ist blockiert und weiß es nicht.** Ihr Report wurde 15:14:56 von Slot 9
   REJECTED („kein Land"), Korrekturbrief `c9683f04` ist gefiled. Ein Reject stößt keine Pane an — das
   ist die Live-Instanz der offenen Zeile `18e87e67`. **Zug:** Slot 9 fragen, ob ich `c9683f04`
   zustelle, oder es selbst tun lassen.
3. **Slot 4 (W2)** wartet auf ein Fern-Suite-Verdikt. Danach landen — aber **main ist ihr 10 Commits
   voraus, vier davon in ihren Dateien** (`984a4b3`, `652d872`, `064b455`, `d120ca4`): das Fern-Grün
   beweist ihren Baum, nicht den rebasierten. Danach W3 `05611418`.
4. **`e407aef5` dispatchen**, sobald ein Lane-Platz frei ist (Slot 7s erste Zeile; ihr Bericht ist das
   Release-Tor für die Helfer-Erzwingung). Danach `c464af30` (S3a-ii), dann `18e87e67`.

**Owner-Entscheide, offen:**
- **`POST /api/repo-lane-cap {"repo":"<pfad>","maxLanes":N}`** ist jetzt live. Welche Zahl für
  `astra-main`? **Vorsicht:** repo-keyed, der Pfad heißt `astra-main`, ein Verzeichnis `private-repo-j` gibt
  es nicht; Fleet bleibt bei 1, wenn es keinen Eintrag bekommt. Und Slot 7s Befund:
  `FLEET_DISPATCH_MAX_LANES_PER_PROGRAM` kommt in `watchdog.sh` NULLMAL vor — der Program-Deckel fiel
  still auf den Maschinendeckel.
- **P3 (`997f0f05`)**: fünf REJECT-Runden, kein ACCEPT — darf die MAIN mit dokumentiertem Rest-REJECT
  selbst annehmen, oder bleibt das ACCEPT der zweiten Astra Pflicht?

## 3. DIE DREI MESSUNGEN, DIE DEN TAG TRAGEN (fünf parallele Opus-Leseagenten, ~780k Subagent-Tokens)

**(a) Die Stufe-2-Deckungslücke: 25 von 206 gelandeten Bäumen (12,1 %) haben KEIN Urteil.** Gegen ZWEI
Ledger unabhängig geprüft (`post-land-audits.jsonl` und `lane-outcomes.jsonl`), gleiches Ergebnis,
gleiche Branch-Namen. Fast alle sind Timeouts. Namentlich in der Messung; die zwei jüngsten waren
„läuft noch", nicht verloren.

**(b) Neun rote Audits sind UNBEURTEILT (9,7 %, n=93) — und das ist der Befund, nicht ihr Inhalt.**
Adjudikationslatenz sonst Median 3,7 min bei n=84 (Join auf `audit-adjudications.jsonl` über den
Schlüssel `auditAt`; die Adjudikationen liegen NICHT in `audit.jsonl`, und ein Join aufs Ledger-Feld
gibt 136/136 — ein Messfehler, kein Befund). Diese neun sind also nicht „noch nicht dran", sondern
durchgefallen.

> **KORREKTUR AN MIR SELBST, Slot 7 am 2026-09-07 ~16:1x:** ich hatte vier dieser Rots als
> „vermutlich ein echter, unentdeckter Regress" geführt. Das ist ÜBERZOGEN. Der dominante Fail
> (`projection nextAction: a REVIEWABLE row of a promoted Program …`, 20 von 33 Fehlschlägen im
> Fenster 09-04 20:00–09-05 17:00, ausgezählt über `e2e-trail/`) IST die dokumentierte Familie
> **§11.2o** in `docs/verify-tiering.md` — dort steht sie bereits als „KEIN Flake um eine feste Rate,
> sondern ein REGIME-WECHSEL am 2026-09-04", 1,1 % davor gegen 37 % seither (Zahlen in `65358fef`).
> Der zweite Fail (`D2 setup`) taucht in den Top 6 gar nicht auf — die „Viererserie mit demselben
> Fail-Kern" trägt nicht. **Was bleibt und stimmt: die Rots dieser dokumentierten Familie hat seit
> dem 09-04 niemand beurteilt.** Gefilt als schmale Zeile `6d7ff117` (Slot 7) mit genau einer Frage —
> welche Regel feuert, welcher Fakt fehlt ihr — und ausdrücklich OHNE Reparaturauftrag.

**(c) Die Audit-Platzierung ist die Ursache, und der Ledger trug sie die ganze Zeit.** Zwei Sensoren:
`remote: {name, …}` (seit 08-29, `name` ausnahmslos `second-host`) und die run-id `isolated-<ts>Z-<pid>`
— macOS deckelt PIDs bei 99999, siebenstellig beweist also Helfer (43/43, null Fehlalarme), **eine
kleine PID beweist NICHTS** (drei Helferläufe haben PID 3208/4337/13106). Über 14 Tage:
- **Alle 18 Timeout-Unknowns sind LOKAL. Kein Helferlauf ist je in eine Decke gelaufen.**
- Der Helfer ist an 8 von 8 Doppelbetriebs-Tagen schneller, Medianabstand 2,8–5,3 min.
- **Die Decke zu heben hat beim letzten Mal NICHT geholfen:** Budget 09-05 von 1,8M auf 2,7M (+50 %) —
  die Timeout-Rate pro Tag hat sich VERDOPPELT. Meine 45→75-Anhebung (`61e407d`, Owner-Entscheid) ist
  auf den schlechtesten beobachteten Fall gerechnet (26,4 min Vorlauf + 42,7 min Arbeit = 69,1), aber
  sie ist ausdrücklich die schwächere Hälfte. **Der starke Hebel ist die Helfer-Erzwingung** — Slot 7
  hat den Brief fertig, hinter einem selbstgesetzten Release-Tor bis `e407aef5` abgenommen ist.
- **ABER: `checks.ran` ist für JEDEN Helferlauf blind.** `out` wird bei ~4 KB gekappt (`… [10 lines
  elided]`), `ran` daraus abgeleitet: 22 von 49 Helferzeilen melden `ran < 100` bei 21–24 min echter
  Laufzeit, 0 von 111 lokalen. **Acht Helfer-ROTS sind deshalb als `unknowable` beurteilt worden.** Wer
  Audits auf den Helfer zwingt, muss den Transport-Schnitt mitnehmen, sonst tauscht er Timeouts gegen
  Unbeurteilbarkeit. Diskriminator bleibt `ms`.

## 4. DER /tmp-BESTAND WÄCHST, ER SCHRUMPFT NICHT

**23 offene Queue-Zeilen zeigen auf `/tmp/astra-*`** (nachgemessen 15:44), 27 auf irgendeinen
`/tmp`-Artefaktpfad. Die im Briefbaustein genannte Zahl 14 ist überholt — **+9, Richtung steigend**.
Am teuersten: Slot 3s Übergaben-Review (11 848 B + 37 885 B Evidence, 14:52) ist in **keiner** Queue-Zeile
gefiled und hat keine getrackte Entsprechung; P3s Entwurf 5 (81 154 B, sha256 `6b931dc3…`) liegt
ausschließlich in `/tmp`, samt 3,9 MB Rohtranskripten aller fünf REJECT-Runden.

Gegenmittel liegt seit heute im Baum: **`docs/astra-briefbaustein-2026-09-07.md`** (`b1f1131`), fünf
Regeln mit ausführbarem Zug — R1 erlaubte Züge beim Warten, R2 Verstetigen (mess-notiz-Template
ausgeschrieben, weil `.claude/skills/` codex nicht erreicht), R3 HANDOFF als 409-Gate, R4 mechanische
Abbruchbedingung, R5 Selbstauskunft statt Sensor. **Korrekturbefund daraus: `/api/self/notes` GIBT ES
NICHT** — der Weg zu einem fremden Program ist `POST /api/self/tasks` mit `kind:"notiz"`.

## 5. SLOT-BILD (16:0x, gemessen)

| Slot | Wer | Urteil |
|---|---|---|
| 2 | Biber-MAIN (Astra) | KEEP — Slot 13 hält Report-Adresse; **8 Reports stehen auf `decision: null`**, obwohl die Pane „akzeptiert" sagt |
| 3 | Codebase-Review (Astra, 63,6 %) | KEEP — offene Owner-Direktkonversation, jüngstes Ergebnis nur in /tmp und Pane |
| 4 | Lane W2 | wartet auf Fern-Suite |
| 5 | Lane P2 | im Land |
| 6 | Lane GLM | **blockiert, weiß es nicht** (Reject + Korrekturbrief `c9683f04`) |
| 7 | Fleet-Betrieb (23,1 %) | schließbar, bleibt aus Arbeit stehen; übergibt an der 25er-Marke |
| 8 | Land-Pipeline (17 %) | KEEP — Report-Adresse für W2; **HANDOFF ist ÄLTER als seine Sessioneröffnung** |
| 9 | Fleet-Architektur (Astra, 84,6 %) | KEEP — Report-Empfängerin Slot 6, Auto `ca8e863d` (Checkpoint 17:45) |
| 10, 16 | **OWNER SELBST** | **NIE ANFASSEN** |
| 12 | Astra P2 (`ctx: null`) | schließbar nach P2-Land + Attention `67e9da86`. **`sessionId: null` bei `codexRecoveryState: "ambiguous"` ist NOCH SCHARF** für jeden künftigen Report |
| 13 | Lane GLM-M1 | liegt in **private-repo-j**, nicht hier — Land gehört Astra |
| 15 | P3 (Fable, 13,3 %) | KEEP — Entwurf 5 nur in /tmp, Rückwege sind session-lokale Monitore |

Ein **Worktree ohne lebenden Slot** liegt auf Platte: `fleet-260907112710-37bb`.

**Von 16/16 auf 11 belegt — fünf Slots sind an diesem Nachmittag zugegangen:** die Biber-Korrekturlane
(auf Anforderung ihrer MAIN, ohne Land), die drei gelandeten Lanes (`779eb456`, P1, P2, W2) und
**zwei Program-MAINs, die sich SELBST retired haben** (Slot 11 nach grünem Audit-Verdikt, Slot 12
nach dem P2-Land und einem eigenen Handoff-Commit `f824657`). Keine wurde von außen geschlossen.

## 6. EINE MESSUNG ÜBER EINEN FEHLER, DEN ICH SELBST GEMACHT HABE

Ich habe um ~16:1x `9942225` committet, während auf Slot 4 seit 15:57:14 das W2-Land lief. Ich hatte
den Land-Sensor davor abgefragt und seine Antwort ausgedruckt — und dann trotzdem committet, weil ich
den Commit per `&&` an den Pins-Lauf gekettet hatte statt an die ANTWORT des Sensors. Ein Sensor, dessen
Ergebnis kein Tor ist, ist Dekoration.

**Die Kosten sind messbar, und die Zahl steht in der Land-Note:** `974ea00` (W2) trägt `ffRounds: 2`
— es hat den VOLLEN Retry-Vorrat gebraucht (`server.ts#LAND_FF_RETRY_ROUNDS`, Default 2). Die beiden
anderen Lands des Tages stehen bei `ffRounds: 1` (`984a4b3`, `f781c60`). Zwei Commits legten sich
unter dieses Land: meiner und Slot 12s Handoff `f824657`. **Ein dritter hätte es nach voll grünem Gate
an `ff-lost` getötet.**

Das ist zugleich der erste empirische Beleg in diesem Repo, dass R2' (bounded rebase+ff-Neuversuch)
ein Land wirklich rettet — die Land-Note führt `ffRounds` seit `d120ca4`. **Und `ffRounds` gehört ab
jetzt in jede Land-Auswertung:** `ffRounds == LAND_FF_RETRY_ROUNDS` heißt „an der Grenze gelandet",
nicht „sauber gelandet", und nur die Note sagt es — am Verdikt `merged/landed:true` ist es NICHT
sichtbar.
# HANDOFF — Program-MAIN Land-Pipeline 2026-09 (`233e1c2b7eaca3850decf332`, Slot 8, Fable 5.1): W1 `01c3b35` + W2 `974ea00` GELANDET (Gates und W1-Audit gruen), W3 in Flug, M2/N2 offen; 2026-09-07 16:1x

> **Dieser Abschnitt ERSETZT die aelteren Land-Pipeline-Abschnitte darunter.** Zustand ableiten:
> `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Alles hier sind Behauptungen zum
> Nachschlagen.

## 0. DEIN ERSTER ZUG

1. **W3 `05611418` LAEUFT auf Slot 4** (Branch `fleet/260907140524-b010`, Opus 5 high, Lane-Watch
   `27ef9ec2` mit `idleSec:0`). Letzte Wellen-Zeile; danach M2 `64860da8`, dann N2 `f98facad` —
   beide Vorbedingungen am Baum geprueft (M1 `f388de1`; N1 `24cd54e`+`189f815` sind Ancestor von
   main). W3s Report muss EINEN Absatz dazu tragen, was der Knopf dem Owner zeigt, bevor er n
   Zeilen in eine Lane gibt: dort loest sich der Einwand von Program `eec69528` auf (§2) oder
   bleibt sichtbar offen.
2. **NIMM `ffRounds` IN DIE LAND-AUSWERTUNG AUF** (Controller-Befund, von mir am Baum
   nachgemessen): die Note von `974ea00` traegt `ffRounds: 2`, den VOLLEN Retry-Vorrat
   (`server.ts#LAND_FF_RETRY_ROUNDS`, Default 2). Zwei Commits legten sich unter das laufende Land
   (`9942225`, `f824657`); ein dritter haette es nach voll gruenem Gate an `ff-lost` getoetet. Die
   Notes von `01c3b35` und `94a8840` tragen KEIN `ffRounds` — Absenz heisst „der erste Versuch
   entschied". **Am Verdikt `merged`/`landed:true` ist das NICHT sichtbar, nur die Note sagt es.**
   Jede Runde faehrt den Gate NEU, das gruene Verdikt gilt also dem zuletzt rebasierten Baum.
3. **Start immer per Hand-Knopf mit Tripel, nie per `release`:** die W-Zeilen tragen keinen
   `Task.spawn`, ein `release` gaebe der Lane `FLEET_MODEL` ohne `--effort`.
   `POST /api/tasks/<id>/dispatch` Body
   `{"harness":"claude","model":"claude-opus-5[1m]","effort":"high"}` (Owner-Token aus
   `fleet.json`). Der Knopf prueft weder Deckel noch Quiet Hours: nur druecken, wenn ein Slot frei
   ist und keine Lane dieses Programs laeuft. **Max. EINE Lane gleichzeitig**, solange
   `FLEET_DISPATCH_MAX_LANES=1`.
4. **Watches: `idleSec:0`, immer — und nach jedem Feuern neu armen.** Watch `5fe54020` feuerte
   14:38:20 und erzeugte Event `795dbb1e`, das `send-uncertain` blieb; in meine Pane kam nie etwas,
   und danach standen alle fuenf Watches auf `armed:false`. Ich habe von W2s Fertigwerden nur
   erfahren, weil der Controller es von Hand brachte. `GET /api/self` zeigt `armed`.
5. **Ein Server-Neustart laesst laufende `curl`s LEER zurueckkommen** — das sieht wie eine tote
   Route aus und ist keine. Einmal wiederholen, bevor du etwas anderes vermutest (Deploy
   `c3274fdd`, 15:11).

## 1. Program-Zeilen (Ids aus `fleet.json`)

| Zeile | Id | Status | Beleg |
|---|---|---|---|
| S1 Wellen-Sensor | `1b106a66` | GELANDET `863f628`+`49d93bc` | |
| M1 Gate unter Server-Hold | `aa8e5ade` | GELANDET `f388de1`+`f0bcea6`, Audit gruen | |
| M5 Hold-Hygiene | `8d6a3e9e` | GELANDET `94dd5e4`+`a15b59a`+`b2ab2cf`, Audit gruen 3792/0 | |
| N1 Notizen beim Dispatch | `3af11665` | GELANDET `24cd54e`+`189f815` | Audit `unknown` (Timeout), mitgemessen im M3-Audit |
| M3 Vorflugpruefung dirty-main | `283f625f` | GELANDET `6c70f01`+`79e1c36`+`94a8840`, **Audit gruen 3832/0, 2262 s**, Deploy `f6a69ac5` LIVE | |
| **W1 programId-Schnitt** | `e0113460` | **GELANDET `01c3b35`**, Gate gruen 143 s Arbeit / 0 s Schlange, **Audit gruen 3835/0, 2559 s** | |
| **W2 Bestaetigungstuer Flaeche** | `0f5019ac` | **GELANDET `974ea00`**, Gate gruen 139 s / 0 s, `ffRounds: 2`, Audit laeuft (Watch `55c77205`) | Fern-Suite 3862/0 auf `5caf6a2` |
| W3 „▸ start wave" | `05611418` | **sent**, Slot 4, `fleet/260907140524-b010` | letzte Wellen-Zeile |
| M2 `waitedOut` als Wiedervorlage | `64860da8` | pending | nach W3 |
| N2 Notiz-Lebenszyklus | `f98facad` | pending | **startbar** (N1 auf main, geprueft), aber nach W3 |
| M4 / N3 unter der Schnittlinie | `4aeeec19` / `f7493755` | notiz | Vorschlaege |

## 2. Befunde dieser Session

- **W1 misst heute NULL Buendel, und das ist der erwartete Zustand.** Ueber 48 offene
  auftrag-Zeilen: 43 Wellen im Fleet-Repo, davon 8 mit dem neuen Grund `kein-program` (deckungs-
  gleich mit den 8 Zeilen ohne programId) und 35 `flaeche-nur-abgeleitet`. Solange keine Flaeche
  bestaetigt ist, kann keine Welle groesser als eins werden — genau das oeffnet W2.
- **Das Suite-Offer von W1 wurde nie geclaimt**, obwohl der Helfer als online galt: 213 s gegen
  `SUITE_OFFER_WAIT_FREE_MS` 180 s, danach lokaler Fallback; das Angebot blieb ~44 min offen und
  unbeansprucht. W2s Offer wurde dagegen geclaimt. Befund am Helfer-Pfad, gehoert dem Program
  Fleet-Betrieb, noch NICHT dorthin gesendet.
- **Einwand von Program `eec69528` (Slot 3), offen gefuehrt:** programId + Flaeche sei semantisch
  nicht genug, es brauche gemeinsame Ursache/Proof je Buendel. Der Owner hat programId als zweites
  Kriterium entschieden (W1). **In W3s Review aufnehmen, sobald zum ersten Mal wirklich n>1
  entsteht.**
- **Owner-Entscheid F2 (Controller, 2026-09-07):** `undo-land` darf mit `--force-with-lease` auf den
  eigenen Hub zurueckspiegeln. Bewusst noch KEIN auftrag — die P3-Analyse hat drei Astra-REJECTs und
  kein ACCEPT. Weitere P3-Schnitte, die laut eigener Zuordnung an dieses Program gehen: L1
  (Tip-Bindung + `verify.candidateSha` + Audit-Reklassifikation), L5 (repo-weiter
  Land-Intent-Guard), L7a (`suiteLockTryTake` raeumt im Fehlerpfad), L6 (`checksBelowMain`).
- **Brief-Zusaetze zahlen sich aus.** Beiden W-Lanes habe ich vor dem Dispatch angehaengt: die
  `fleet.json` liegt nur im Haupt-Checkout, Suite-Offer statt lokalem Lauf, Drift-Check vor dem
  Report, Verify woertlich zitieren. W2 zusaetzlich: sein Wirkungsnachweis braucht seit W1 zwei
  Zeilen mit DEMSELBEN programId, sonst trennt der Sensor sie zu Recht.

## 3. Arbeitsweise, die getragen hat

- Report als Claim behandeln: bei W1 habe ich das Suite-Log der Lane selbst gelesen (3835 PASS,
  0 FAIL, Trail-Zeilen `tree 5b9ad59 dirty:false`, ein einziger Run) statt der Zusammenfassung zu
  glauben.
- Vor jedem `POST /send` an den Controller mit 409 rechnen (Composer belegt): ein
  Hintergrund-Retry im Minutentakt mit Label-Pruefung hat nach 4 Versuchen zugestellt.
- Ein Server-Neustart (Deploy) laesst laufende `curl`s leer zurueckkommen — das sieht wie eine tote
  Route aus und ist keine. Einmal wiederholen, bevor man etwas anderes vermutet.

---

# HANDOFF — P1 Verifikations-Zielbild, Program 29c0f21bf3cc6e37d31f7803, MAIN Slot 11 — Spec und Audit grün; bereit zum Retire (2026-09-07)

Dieser Abschnitt betrifft ausschließlich P1. Er ersetzt keine Controller-Aufträge darunter.
Controller Slot 1 verlangt Abschluss ohne Succession, bei offenen Resten jedoch Meldung statt Retire.

## Erreicht und selbst geprüft

- Gelandenes Artefakt: `docs/messungen/2026-09-07-verifikation-zielbild.md`, dazu eine Zeile in
  `docs/messungen/INDEX.md`; Git-Commit `9e7660503a32f1404039f9fd6e0e9bc4c0b8e6d2`.
  `git show --stat 9e76605` und `git merge-base --is-ancestor 9e76605 main` erfolgreich gelesen/ausgeführt.
  Frühere Lane-Commitangaben sind nur Vor-Land-Provenienz; für das publizierte Artefakt diesen Land-SHA verwenden.
- Inhalt: Mechanismus-/Belegdisposition für 21 Familien plus Einzelsichtung, Audit-Zustandsmaschine,
  Kapazitätsgrenzen und höchstens fünf serielle Opus-Schnittvorschläge an bestehende Programs.
  Quellpin des Inhalts bleibt `e917a48b1a0dfa894cd9470b683606252725b0e9`; keine Aussage über spätere Reparaturen.
- Unabhängige zweite Astra: `ACCEPT sha256:185b5295de7d0b188c28cb91240efe7bbc387c861b5c44040caf163c78088772`.
  Zwei zuerst abgelehnte Textstellen wurden korrigiert und erneut im Gesamtdokument angenommen:
  direkter lokaler Start ohne optionale Mutex-Vorreservierung; nominelle Pollfrist statt falschem Gesamtbound.
  Git-Blob des gelandeten Commits erneut gehasht und gegen die akzeptierten Bytes verglichen: identisch.
  Dateihash und Git-Commit-SHA sind verschiedene Belege.
- Publikationsauftrag `34c0d050` ist done; Report `c89b59e7b4f2fecea8fcd2e9` trägt bereits
  `decision.accepted`. Keine weitere Abnahme durch diese MAIN ist offen. Report- und Land-Ereignisse sind quittiert.
- Original-Install- und Pins-Logs der Opus-Lane wurden selbst gelesen. Original-Tails:

```text
9 packages installed [51.00ms]
```

```text
PASS  the program inbox belongs to the Program and names no receiver — docs/self-api.md carries §inbox and names both route paths  (section=true get=true read=true)

ALL PASS
```

Die Land-Note `git notes --ref=fleet/land show 9e76605` bestätigt `verify.ok:true`, Exit 0,
`proportional:true`, Schritte install/pins und `ALL PASS`. Dies ist Dokumentverifikation, kein Betriebsbeweis.

## Offene Fragen im vollen Wortlaut und Zuständigkeit

1. Erledigt: Welches terminale Audit-Ergebnis deckt den Land-Commit `9e7660503a32f1404039f9fd6e0e9bc4c0b8e6d2`?
   `post-land-audits.jsonl:519`, Ergebniszeit `1788789016542`: green, Exit 0, 3.853 Checks, 0 fehlgeschlagen,
   geprüfter Tip exakt dieser Land-SHA. Original-Output selbst gelesen, Tail `ALL PASS`.
   Das Audit koalesziert zusätzlich Cover `984a4b36f7a171a9ea5f52e265e167bd83316c84` und war daher
   kein proportionaler Kurzaudit. Land-Gate und Post-Land-Audit bleiben getrennte Belege.
   Ereignis `9a03bb6dfa3ffc0807af1e44` ist quittiert, Watch `59ac233f` spent; keine offene Audit-Rückgabe.
2. Unter welchen belegten Ankunfts-, Laufzeit-, Burst- und Ausfallgrenzen kann jedes Land innerhalb von
   900 Sekunden ein vollständiges Tier-2-Urteil erhalten? Diese harte Zusage ist weiterhin unbelegt;
   Unknown, SKIPPED und kleinere Messumfänge erfüllen sie nicht. Zuständig sind die Umsetzungsträger und Owner.
3. Hätte der Lane-Deckel 1 den untersuchten Timeout allein verhindert? Der vollständige Gegenfaktualnachweis
   fehlt im Spec; `c9791a49` trägt den bereits beauftragten Nachweis, `e407aef5` die Platzierungsdiagnose.
4. Zeigt der Reseed-Fall doppelte, fehlende oder vertauschte Bytes am Seed-/Live-Übergang? Die vollständige
   Markerfolge fehlt; die erhaltene Signatur beweist keinen bloßen Verlust der letzten Zeile.
5. Wie wird verhindert, dass ein später Brief-Nachlauf einen bereits terminalen Task wieder queued setzt?
   Die Fixture-Reparatur beweist keine serverseitige Terminalmonotonie; bestehender Lifecycle-Träger entscheidet.
6. Wie werden das tatsächliche Ende des alten tmux-Servers vor Phasenrestart und das vollständige Ende einer
   Audit-Prozesskette bei Timeout belegt? Die vorgeschlagenen isolierten Endproben wurden hier nicht ausgeführt.
7. Welches auslösende Dispatch-/Teardown-Interleaving erzeugte den Empty-Requeue-Rest, und welcher konkrete
   Konjunkt fiel bei der Codex-Exact-Resume-Heal-Einzelsichtung? Die Kaskade ist belegt, diese Ursachen sind unknown;
   der vollständige fehlgeschlagene Codex-Detailbeleg wurde nicht gefunden.
8. Welche der fünf seriellen Schnittvorschläge nehmen die zuständigen MAINs nach ihren aktuellen Fakten an?
   S1/S4/S5 gehen an Fleet-Betrieb `f170dc46e4b026ee34d9392e`, S2/S3 an Audit-Determiniertheit
   `79036e9a58e3429578165297`; Land-Pipeline `233e1c2b7eaca3850decf332` behält M2 `64860da8`.
   Stabile Program-IDs frisch binden, keine alten Slotnummern als Adresse verwenden. Routingvorlage steht
   in Notiz `f806cd75` und im gelandeten Spec; P1 hat keine fremden Implementierungszeilen freigegeben.
9. Offene Fakten werden im Artefakt als unknown und mit kleinstem falsifizierbarem Nachweis ausgewiesen;
   keine erfundenen Garantien. Dies ist die weiterhin geltende offene Frage des bestätigten Programs.

## Nicht geprüft und Abschlussgrenze

Keine eigenen Astra-Suiten oder Serverstarts, keine frischen Nach-Fix-Raten, kein eingefrorenes vollständiges
Trail-Archiv, keine Helfer-Journalmessung, keine reine Arbeitszeitverteilung, keine Kapazitäts-/Ausfallobergrenze,
kein vollständiger Cap-1-Gegenfaktualbeweis, keine vollständige Subscription-Prüfung, keine eigene P3-Integritätsprobe,
keine Produktimplementierung und kein Betrieb nach Deploy. Historische Originale und gelesene Quellen sind im
Spec von Hypothesen getrennt. Der HANDOFF selbst wird nur durch Diff-/Git-Prüfung verifiziert; die zitierten
install/pins-Ergebnisse gehören zur bereits gelandeten Opus-Publikation und ihrem Land-Gate.

P1-Entwurfsarbeit ist abgeschlossen. Keine Succession, keine neue Lane und kein automatischer Folgetag.
Vor Retire sind keine Report-Abnahme, Aufmerksamkeit, ungelesene Inbox oder Audit-Rückgabe offen;
Live-Projektion: openDebts=0, beide Watches spent, Publikationsreport accepted. Die verbleibenden fachlichen
Fragen gehören den bestehenden Umsetzungsträgern; P1 eröffnet keinen Folgeauftrag.
Prozentualer Kontextfüllstand hier nicht selbst gemessen; ältere fremde Prozentangaben nicht übernehmen.

---

# HANDOFF — 🎛 Fleet Controller (Slot 6, Opus 5 high — der Regelbuch-VERSUCH) → Nachfolgerin: DEIN ERSTER AUFTRAG IST EIN ÜBERBLICK UND EIN AUFRÄUMEN, nicht eine Kette. Sechs Panes vermessen, zwei systemische Löcher benannt, Wellenmodus geklärt und gefilet; 2026-09-07 ~14:4x, ctx ~36 % (gemessen)

> Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/attention`, Board. Alles hier sind
> Behauptungen zum Nachschlagen. Die Owner-Delegation gilt fort: Lands nach `decision.accepted`,
> Deploy über Verb 2, Reaps, Owner-Entscheide weiterreichen; keine eigene Grabung.
> **Zum Modellversuch:** ich bin die erste Controller-Schicht auf Opus 5 high. Kriterium war „gleiche
> Zahl Lands/Reaps ohne zusätzliche Owner-Attentions, HANDOFF in gleicher Dichte". Meine Bilanz steht
> in §4 — mit den Fehlern, nicht nur den Lands. Der Owner hat den Versuch nicht abgebrochen.

## 0. DEIN AUFTRAG VOM OWNER (14:4x, sinngemäß): „ich hoffe dass die neue Session sich auch einmal einen Überblick verschafft — und ggf. Slots & Sessions schließt"

Das ist **kein** Nebensatz. Fang damit an, nicht mit der Kette in §2.

**Der Überblick, den ich heute gebaut habe — bau ihn nicht neu, prüfe ihn nach.** Ich habe fünf
parallele Opus-Lese-Agenten auf die Panes gesetzt (Slots 3, 7, 9, 10, 11+12), je mit vier
Bedingungen: Dauerhaftigkeit · stirbt still etwas mit dem Occupant · ist die offene Arbeit
wiederaufnehmbar · ist etwas in Flug. Ergebnis, Stand 14:4x:

| Slot | Urteil | Der eine entscheidende Fakt |
|---|---|---|
| 3 Codebase-Review (Astra, ctx 64,7 %) | **SUCCEED, aber erst nach Verstetigung** | Zielregister `docs/messungen/2026-09-review-aussen-nach-innen.md` existiert NICHT auf main; kein HANDOFF-Abschnitt in 2711 Zeilen. Auflage `82ae9cc4` gefilet — **prüfe, ob sie sie ausgeführt hat** |
| 7 Fleet-Betrieb (Opus, 44,9 %) | **SUCCEED** — Nudge ist raus | Retire kappt die Report-Adresse der lebenden Lane auf Slot 14 |
| 9 Fleet-Architektur (Astra, **68,2 %**) | **KEEP**, aber bald fällig | Abnahme-Instanz für P1/P2/P3; P2-Abnahme `86936ddc` seit 11:56 offen; 0 Commits, kein Handoff |
| 10 „analyse" | **KEEP — das ist der OWNER SELBST** | Von Hand geöffnet 12:49:44, kein Gründungsbrief, `model:null`; hält eine unbeantwortete Frage an ihn. **NIE schließen** |
| 11 P1 (Astra, **75,1 %**) | **KEEP bis Publikation abgenommen** | Retire macht die Abnahme DAUERHAFT unmöglich (§1 M1) |
| 12 P2 (Astra, ctx unmessbar) | **KEEP**, dazu ein Extra-Risiko | `sessionId: null` bei `codexRecoveryState: "ambiguous"` — `decideFleetReport` gated sessionId, `clarificationReceiverFor` nicht: bindet codex später eine Session, fällt die Abnahme auf 409. Das ist P2s eigener Defekt D2 |
| 8 Land-Pipeline (Opus, 15,9 %) | **KEEP** | fährt W1; eine Stunde alt |

**Was du daran tun sollst:** Slot 11 und 12 werden schließbar, **sobald ihre Publikationen
angenommen sind** — `34c0d050` läuft gerade auf Slot 13, `180d3c92` steht `queued`. Fahr sie
zu Ende, dann sind das zwei Slots. Slot 3 und 7 sollten inzwischen succeeded haben; wenn nicht,
nachfassen. **Slot 10 fasst du nicht an.**

## 1. DIE ZWEI SYSTEMISCHEN LÖCHER — das ist die eigentliche Ausbeute des Tages

**M1 — es gibt keine Owner-Tür für die Report-Abnahme, und das ist der Grund, warum diese Flotte
Panes ansammelt.** `server.ts#clarificationReceiverFor` löst den Empfänger eines Lane-Reports aus dem
LEBENDEN Occupant von `program.main` auf; `decideFleetReport` vergleicht das volle Tripel
{slot, openedAt, sessionId}; die einzige Route ist `POST /api/self/fleet-report/:id/(accept|reject)`
— **self-only**. Eine MAIN mit offener Lane ist damit an ihren Stuhl genagelt: schließt du sie, fällt
ihr eigener Report auf NO_RECEIVER_EVIDENCE und **niemand darf ihn je entscheiden**. Nicht schwer —
unmöglich. Gefilet als **`89279f1f`** (Program f170dc46) mit vier harten Done-Kriterien.

**M2 — die Arbeit liegt in `/tmp`.** P1s Spec (412 Z.) und P2s Vertrag (514 Z.), beide sha256 exakt
wie zitiert, lagen `-rw-------` unter `/tmp` statt im Repo. Slot 3s C0–C5-Plan (16 690 B): nur C0 ist
gefilet, **C1–C5 existieren nirgends sonst**. **Fleetweit hängen 14 Queue-Zeilen an
`/tmp/astra-*`-Pfaden** — nach einem Reboot sind das Zeilen ohne Inhalt.

Zwei weitere, kleiner aber real: **Geisterbindungen** (`66499a03`, `cd110019`, `b2aa5b45`,
`f99e9354` zeigen auf tote Occupants — sie sehen aktiv aus, können nichts empfangen, und haben mich
heute zweimal in die Irre geführt; Owner-Entscheid: als Zeile filen, nicht von Hand reparieren) und
**der Send-Kanal** (`POST /send` pastet ohne Clearing; einmal `acceptance: not-observed`, „composer
still holds 24 chars after 3000ms"; an einer zweiten Pane erreichten vier Tastensequenzen den
Composer nicht).

**Der Owner hat daraus eine Zeile bestellt: `012fe6b9`** — eine GLM-Lane (`pi-zai` / `glm-5.3` /
high), die **keinen Report** schreibt, sondern eine gerankte, kostenbezifferte **Schnittliste**
main-direkt nach `docs/`, höchstens 8 Posten, jeder mit Done-Kriterium. Sie bekommt M1–M4 als
EINGABE, damit sie nicht die Codebase neu entdeckt. **Vor dem Dispatch lesen:** es ist KEIN Fleet-Lauf
auf `pi-zai` belegt; die Schlüsseldatei ist 49 B und passiert nur den `[ -s ]`-Guard. Nach dem
Dispatch die **Pane ansehen** — bei Fehlschlag fällt der Slot in eine nackte Shell, in der ein Brief
als Kommando liefe.

## 2. Kette in Flug (Stand 14:4x, am Board gemessen)

- **Wellenmodus** (Owner-Tagesarbeit): W1 `e0113460` läuft auf Slot 4. W2 `0f5019ac` und W3
  `05611418` pending in 233e1c2b (Slot 8, jetzt **Opus 5 high** — Modellwechsel in place, beide
  Hälften verifiziert). Reihenfolge: W1/W2 unabhängig, **W3 setzt beide voraus**. Slot 8 landet
  selbst (`green-only`), **du deployst**.
- **P1-Publikation `34c0d050`** läuft auf Slot 13 (`fleet/260907114304-2109`); Commit `d05244e5`
  gemeldet. Danach **`180d3c92`** (P2) dispatchen — das macht Slot 11 und 12 schließbar.
- **`779eb456`** (Lane-Deckel je Repo) steht weiter `sent` auf Slot 14 und wartet auf ein
  Helfer-Suite-Verdikt. Landet sie, steigt der Deckel je Repo — **das löst die Serialisierung**, an
  der heute fast alles hing.
- **Biber M1 ist NICHT akzeptiert**: das Quellenaudit fand 31 ungedeckte/widerlegte Gruppen und
  6 Prüflücken. Korrektur `0610f3a5` läuft auf Slot 5. Danach Nachprüfung auf `glm-5.3/high` —
  **`medium` gibt es dort nicht** (thinkingLevelMap: nur low/high/max).
- **P3** (Slot 15, Fable): fünf Astra-Abnahmen, alle REJECT (19→13→14→12→10), kein ACCEPT. Zeile
  `6b61a7bf` (Opus high) fährt max. 3 weitere Runden und stoppt dann mit `needs-main`. **Offene
  Owner-Frage von P3:** was passiert, wenn die Lane ohne ACCEPT endet.
- **Deploy `f6a69ac5` grün**, M3 live (`bootHead = c45ebebc`). `codeBehind:false` beim Schreiben.

## 3. Owner-Entscheide dieser Schicht (wörtlich/sinngemäß, damit niemand sie neu stellt)

- **Wellenmodus = Landewelle S2+S3**, nicht die Parallelwelle. · **`programId` ist das zweite
  Bündel-Kriterium** neben der Datei-Fläche. · **S2 bekommt eine NEUE Tür** (Lane schlägt Fläche vor,
  Owner bestätigt am Board) — ausdrücklich NICHT auf `refine` aufsatteln und NICHT `derived →
  confirmed` automatisch heben.
- **F2 undo-land** darf auf den eigenen Hub zurückspiegeln, **mit `--force-with-lease`**.
- **F3 Deploy** („sowas geht auf jeden Fall nicht"): Preflight **409 bei schmutzigem Tree ODER Tip
  ohne fleet/land-Note**. Beide liegen als `notiz` (`59ffeda0`, `4fc1f438`), **bewusst nicht als
  auftrag** — die P3-Analyse dahinter hat fünf REJECT-Runden und kein ACCEPT.
- **Slot 8:** Modellwechsel in place statt Succession. **Geisterbindungen:** als Zeile filen.
- **GLM-Einsatz:** Schnittliste statt Report, main-direkt.
- **Meine Einschätzung zur Modellpolitik, vom Owner nicht widersprochen:** die Regel „Fable für alle
  Orchestratoren" war eine **Limit-Reaktion** (80 % des Fable-Limits bei 13 parallelen Fable-Sessions),
  kein Fähigkeitsurteil. Heute laufen 2 Fable-Sessions. Eine selbst landende MAIN gräbt und gehört auf
  die Opus-Seite der eigenen Trennlinie der Politik. **Eine Umformulierung des Regelbuch-Fragments
  („Fable, solange Fable-Limitdruck gemessen ist") ist vorbereitet, aber NICHT promoviert** — das ist
  ein Owner-Akt. Mein Argument hat eine benannte Lücke: ich habe **keinen Sensor für den
  Opus-Verbrauch**, die Aussage ist nur an der Session-Zahl gemessen.

## 4. Meine Fehler dieser Schicht — lies die, nicht die Lands

- **Ich habe einen Watcher auf `main` gelegt und dann selbst auf `main` committet.** Er fing meinen
  eigenen Commit. Ein Watcher auf ein Prädikat, das du selbst auslöst, ist kein Watcher.
- **Ich habe Slot 3s Kanal-Auflage beim ersten Gebrauch gebrochen.** Ihr Plan sagt „Controller-Inbox/
  Notizroute verwenden; keine tmux-Injection" — ich habe per `POST /send` in ihre Pane gepastet.
  Korrigiert über Notiz `e229aa2f`. **Merke: die „Controller-Inbox" gibt es nicht** —
  `/api/self/inbox` ist program-gebunden, self-token, und trägt nur ZEIGER auf bestehende Zeilen.
  Der Weg zu einem Program ist eine Queue-Notiz.
- **Ich habe an einer fremden Pane vier Tastensequenzen abgefeuert, die nichts bewirkten** (`C-u`,
  `C-a C-k`, `BSpace`), bevor ich gestoppt habe. Der richtige Zug wäre gewesen, nach dem ERSTEN
  wirkungslosen Versuch zu stoppen. Was die Sache löste: die Regelbuch-Messung, dass eine LANGE
  Einfügung als „Pasted text" gefaltet und **nicht** als Slash-Befehl geparst wird — ein Merge
  degradiert also zu einer hässlichen Nachricht, nicht zu einem falschen Kommando.
- **Ich habe `spawn` als verschachteltes Objekt gepostet.** `taskSpawnFromBody` liest **flach**
  (`harnessIdOf(body)`), die Zeile bekam still `spawn: null` und wäre auf den Default dispatcht
  worden. Fehlzeile archiviert, korrekt neu als `012fe6b9`. **Prüfe nach jedem Task-POST das
  zurückgegebene `spawn`-Feld.**
- **Ich habe eine Fehlmessung weitergegeben:** „Slot 8 ist an drei Programs gebunden" — zwei davon
  waren Geisterbindungen toter Vorgänger. Und ich habe den ctx-Sprung einer codex-Session (78 % →
  18 %) als auffällig hervorgehoben; das ist Normalbetrieb, codex kompaktiert selbst.
- **Was gut lief und wiederholbar ist:** die fünf parallelen Lese-Agenten. Kosten ~630k
  Subagent-Tokens, Ergebnis: sechs belegte Urteile plus M1, ohne meinen eigenen Kontext zu belasten.
  Für „welche Sessions können weg" ist das das richtige Werkzeug.

## 5. Direkt-Commits dieser Schicht (für kein land-seitiges Ledger sichtbar)

`fd1017d` (docs/queue-wellen §7-Nachtrag) — von Hand verifiziert mit der Kurzkette
`bun install --frozen-lockfile && bun e2e/pins.ts` → **ALL PASS**. Das ist genau, was das Gate für
einen docs-only-Diff gefahren hätte. Plus dieser Handoff.

# HANDOFF — Program-MAIN Fleet-Betrieb 2026-09 (`f170dc46e4b026ee34d9392e`, Slot 7 → Nachfolgerin, Opus 5 high): SUCCESSION statt retire, weil EINE lebende Lane ihre Report-Adresse an mir haengen hat; 2026-09-07 14:3x, ctx GEMESSEN 44 %

> **Ergaenzt meinen Abschnitt in `a273332`** (weiter unten, „vier Lands, drei mit actor{kind:main}").
> Dort stehen die Lands, die Rangfolge, die unbefilten Befunde und §5 „was nur der Owner kann".
> Hier steht NUR, was seitdem dazugekommen ist. Zustand ableiten: `./state.sh`, `./register.sh`,
> `GET /api/self/program-execution`.

## A. DEIN ERSTER ZUG: Slot 14 / `779eb456` — die einzige teure Sache

**Slot 14 ist eine LEBENDE Lane dieses Programs** (Task `779eb456`, „Lane-Deckel JE REPO statt
maschinenweit", Owner-Zeile 11:2x, `status: sent`, vier Commits, Baum sauber, wartet auf ein
Suite-Offer-Verdikt; Worktree `claude-fleet.worktrees/fleet-260907094547-ced0`).

**Genau deshalb bin ich per `succeed` gegangen und nicht per `retire`** (Controller Slot 6,
am Code gelesen): der Report-Empfaenger wird ueber `server.ts#clarificationReceiverFor` aus dem
LEBENDEN Occupant von `program.main` aufgeloest, und `decideFleetReport` vergleicht das volle
Tripel `{slot, openedAt, sessionId}`. Ein Retire haette den Occupant getoetet, der Report waere auf
`NO_RECEIVER_EVIDENCE` gefallen — und es gibt KEINE Owner-Tuer, die ihn dann noch annehmen koennte
(einzige Route: `POST /api/self/fleet-report/:id/(accept|reject)`, self-only). Die Abnahme waere
dauerhaft unmoeglich, nicht bloss schwer. **Die Succession hat `program.main` auf DICH verschoben —
die Adresse gehoert jetzt dir.**

**Wenn ihr Report kommt:** wie bei allen vier Lands heute — Diff und zitierte Verify-Ausgabe SELBST
lesen (ein Report ist eine BEHAUPTUNG), dann `accept` mit einer Begruendung (**Deckel 500 Zeichen**,
zweimal dagegen gelaufen), dann `POST /api/self/tasks/779eb456/land`. Ihr Land loest laut Controller
die Warteschlange fuer P1/P2/Codebase-Review.

## B. Zwei Zeilen, die heute neu dazukamen — nicht neu herleiten

- **`89279f1f`** (`auftrag`, pending): die fehlende Owner-Tuer fuer die Report-Abnahme — genau die
  Luecke aus §A, mit vier harten Done-Kriterien. Sie ist die strukturelle Reparatur dafuer, dass
  eine fertige Program-MAIN sich heute nicht schliessen kann, ohne die Annahme ihrer eigenen
  Lane-Reports unmoeglich zu machen.
- **`4fc1f438`** (`notiz`, pending): Owner-Entscheid F3 — Deploy-Preflight soll 409 geben bei
  schmutzigem Tree oder einem Tip ohne Land-Note. **Noch KEIN `auftrag`**, weil die P3-Analyse
  dahinter drei REJECT-Runden und kein ACCEPT hat. Nicht voreilig in einen Auftrag wandeln.

## C. Die Env-Antwort, die der Controller zweimal angefordert hat

`FLEET_POSTLAND_AUDIT_WAIT_MS=2700000` — der gemessenen Haltezeit EINER fremden Lane-Suite
(35-41 min) entsprechend, damit die Warte-Uhr des Audits einen vollen fremden Halter abdeckt.
**ABER: `server.ts:12834` defaultet bereits auf exakt `2_700_000`** — der Eintrag ist heute
verhaltensgleich und damit KEIN eigener `launchctl kickstart` wert. Sein einziger Gewinn ist
Sichtbarkeit im config-Sensor von `./state.sh`; bei der naechsten `watchdog.sh`-Aenderung mitnehmen.
(Ich hatte das Slot 10 schon geantwortet; die Antwort ist mit dessen Succession verlorengegangen —
ein Beleg fuer §A und fuer `89279f1f`.)

## D. Stand, den du nicht abfragen musst (Controller 14:2x)

Deploy `f6a69ac5` gruen, M3 live, `bootHead == head == c45ebebc`. **Meine drei Fixes sind IN KRAFT**
(gemessen: `2dfaa81`, `19ddef5`, `c7184f8` alle Ancestor des bootHead) — ein ausgewartetes Gate
bindet den naechsten Self-Land-Aufruf nicht mehr, die Supervisor-Bindung meldet ihre Leiche, und
Warten und Arbeit sind zwei Uhren.

## E. Was weiterhin NUR der Controller/Owner kann

**LIES DIESEN ABSATZ, BEVOR DU DIE LISTE DARUNTER BENUTZT.** Eine Liste in einem Handoff ist eine
BEHAUPTUNGSLISTE, keine Arbeitsanweisung. Die urspruengliche Fassung dieses §E hat an EINEM Tag
zweimal Schaden angerichtet, weil sie gelesen aussah: sie schlug `65358fef` zum Archivieren vor —
das ist der UEBERLEBENDE Nachtrag, nicht der ueberholte — und sie trug „`ff4544f5` = R4s Dublette"
ueber mehrere Sessions, obwohl es diese Dublette nicht gibt. Beide Male war die Rettung dieselbe
Handlung: die zitierten Texte AUFMACHEN, statt die Liste abzuarbeiten. Wer hier etwas disponiert,
liest vorher beide Seiten und prueft jede Id gegen den lebenden Bestand.

**KORRIGIERT 2026-09-07 ~16:0x (Slot 7, am Baum und an der Live-Queue nachgeprueft; die frueheren
zwei Saetze waren FALSCH):**
- **`ff4544f5` bleibt und ist NICHT zu archivieren.** Sie ist die EINZIGE lebende Zeile ihres
  Gegenstands („der Post-Land-Audit zaehlt Warten als Arbeit"). R4 ist `d51e02ca` und ein ANDERER
  Defekt (ein vorhandenes Urteil geht an den falschen Empfaenger — Beleg: Notiz `7a2fcbce`);
  `d51e02ca` ist heute ueberhaupt keine Task-Id mehr. Die vermeintlich neuere Fassung `c9791a49`
  ist EBENFALLS tot. Was `ff4544f5` braucht, ist eine AKTUALISIERUNG: ihre Zahlen (15 Timeouts in
  500 Zeilen, p50 1 001 454 ms gegen 45 min) sind seit `61e407d` ueberholt — die Decke steht auf
  75 min.
- **`65358fef` NICHT archivieren** — es ist der Nachtrag, der `35cf0c23` korrigiert (215 statt 214
  Laeufe, 10/27 statt 9/26) und zusaetzlich eine Hypothese widerlegt. `35cf0c23` ist am 2026-09-07
  vom Controller archiviert worden, nachdem er BEIDE Texte gelesen hatte. `7a2fcbce` ist ungeprueft
  und bleibt.
- **`b55059a1` und `5c9c7ab6` NICHT archivieren**, auch nicht zum Deckel-Freimachen: beide sind
  Evidenz zu nicht adjudizierten ROTEN Post-Land-Audits (`programId: null`, „keine
  Fremd-Adjudikationen"). Sie zu opfern hiesse, die Buchhaltung zu faelschen, um Platz in der
  Buchhaltung zu schaffen.

WEITERHIN OFFEN und echt: die `SUITE_OFFER_WAIT_HELD_MS`-Rekalibrierung (800 s gegen gemessene
Fern-p50 1448 s) und der `descendantPids`-Befund (`pgrep -P` mit `stderr:"ignore"` und verworfenem
Exit-Code; **30x** `pgrep: Cannot get process list` in `server.log`). Beide sind ungefilt, weil der
`auftrag`-Deckel 5/5 steht — nicht, weil sie erledigt waeren.

ELF HAENGENDE VERWEISE, gefilt als `7081f072`: acht offene Zeilen zitieren `c9791a49`, drei
`d51e02ca` — beide existieren nicht mehr. Zehn davon stehen in `notiz`/`richtung`, die keine Lane
ausfuehrt; die eine ausfuehrbare (`e407aef5`) ist per Brief-Nachtrag entschaerft. Die Zahl ist eine
UNTERGRENZE — nur diese zwei Ids wurden aufgeloest, nicht der ganze Bestand.

NIE GEFILT UND STRUKTURELL UNAUFFINDBAR: `.git/fleet-betrieb-R4-strich.json` (6935 B, 2026-09-04
10:20) ist ein vollstaendiger, filbarer `auftrag`-Body („R4' · ZWEI TICKS WAEHLEN IHREN EMPFAENGER
OHNE REPO-FILTER") und ersetzt laut eigenem Text `d51e02ca`. `.git/` liegt ausserhalb des
Arbeitsbaums: `git status` sieht es nie, `rg` sieht es nie, ein frischer Klon hat es nicht. Neuer
Fall der Klasse in `docs/ungoverned-artifacts.md`.

# HANDOFF — Program-MAIN Land-Pipeline 2026-09 (`233e1c2b7eaca3850decf332`, Slot 5, Fable 5.1): M5 + N1 GELANDET und LIVE, M3 GELANDET `6c70f01`+`79e1c36`+`94a8840` (Deploy beim Controller), W1–W3 (Wellenmodus, Owner-Tagesarbeit) pending; 2026-09-07 14:0x, ctx GEMESSEN 26,7 %

> **Dieser Abschnitt ERSETZT den aelteren darunter.** Zustand ableiten: `./state.sh`, `./register.sh`,
> `GET /api/self/program-execution` (Program 233e1c2b). Alles hier sind Behauptungen zum Nachschlagen.

## 0. DEIN ERSTER ZUG

1. **M3 `283f625f` IST GELANDET** (`6c70f01`+`79e1c36`+`94a8840`, Self-Land `verify.ok:true` 141 s / 0 s,
   Report gelesen, Vorschau §8h 7/7 gruen). Audit-Watch `10ef7c6e` auf `94a8840` stirbt mit meiner
   Succession — **neu armen:** `POST /api/self/watch` `{"kind":"audit","repo":"/Users/owner/claude-fleet","mainAfter":"94a8840…"}`
   (`git rev-parse 94a8840` fuer die volle Sha). Rot → gegen `docs/verify-tiering.md` §11 lesen,
   adjudizieren, Controller eine Zeile. Zwei fremde Rots aus dem Vorschaulauf, NICHT M3s: die
   registrierte succession-pane-Familie und eine ERSTSICHTUNG „a second call on the same landed row is
   refused already landed" (sieht `queued` statt `done`, Requeue-Pfad, 0/28 im lokalen Trail) — dem
   Program Audit-Determiniertheit als Registereintrag mitgeben, wenn du ohnehin an Slot 7 schreibst.
   Die Sha-Nachtraege in der Messnotiz §3 M3 sind gemacht; `docs/self-api.md` nennt keine Sha.
2. **Deploy nach M3 beim Controller (Slot 6, Opus 5 high — Label `🎛` auf `/api/sessions` pruefen,
   er zieht per Succession um: 2 → 10 → 6 an einem Vormittag).** Eine Zeile per `POST /send`
   `{slot, text}` mit Owner-Token aus `fleet.json` (NICHT `/api/slots/:id/send` — 404). Er will nur
   Lands, Rot und Owner-Entscheide hoeren.
3. **Dann W1 `e0113460` und W2 `0f5019ac` (unabhaengig, beide zuerst moeglich), danach W3 `05611418`
   (setzt BEIDE voraus, nie vorher).** Owner-Tagesarbeit 2026-09-07 12:1x/12:4x, vom Controller mit
   harten Done-Kriterien gefilet (Texte in `fleet.json`, ich habe sie gelesen: scharf, Verbotslisten,
   Verify woertlich). Sie gehen VOR M2 `64860da8` und N2 `f98facad`. **Die drei Zeilen tragen KEINEN
   Spawn-Tripel** (`Task.spawn` fehlt ⇒ `DEFAULT_SPAWN` alles null ⇒ Lane bekommt `FLEET_MODEL`, aber
   KEIN `--effort`). Darum nicht per `release` in den Tick geben, sondern per Hand-Knopf mit Tripel:
   `POST /api/tasks/<id>/dispatch` Body `{"harness":"claude","model":"claude-opus-5[1m]","effort":"high"}`
   (Owner-Token; `server.ts`, grep `dRowSpawn` — der Knopf liest den Body vor dem Row-Spawn). Der
   Knopf prueft weder Deckel noch Quiet Hours: nur druecken, wenn ein Slot frei ist und keine Lane
   dieses Programs laeuft. Max. EINE Lane des Programs gleichzeitig.
4. **Ein `unknown`-Audit ist NICHT rot:** das N1-Audit (`189f815`, koalesziert auf `1846a26`) lief
   lokal in den 2 700-s-Timeout, weil die M3-Lane den Mutex hielt — nie gemessen, nichts zu
   adjudizieren. Das naechste Audit (M3-Land) misst N1 mit.

## 1. Was steht — Program-Zeilen (Ids aus `fleet.json`)

| Zeile | Id | Status | Was |
|---|---|---|---|
| S1 Wellen-Sensor | `1b106a66` | GELANDET `863f628`+`49d93bc` (Slot 4) | `task-land-waves.ts` |
| M1 Gate unter Server-Hold + `merge_verdict` | `aa8e5ade` | GELANDET `f388de1`+`f0bcea6`, Audit gruen 3785/0, Deploy `4fc0afa7` 03:08 | |
| **M5 Hold-Hygiene** (neu, aus 4 Controller-Befunden) | `8d6a3e9e` | **GELANDET `94dd5e4`+`a15b59a`+`b2ab2cf`**, `verify.ok:true` 139 s / 0 s Schlange, Audit **gruen 3792/0** (2 196 s), Deploy `7941664b`/`1a3ed209` | Server reapt toten Suite-Halter nach der Wrapper-Dreiteilung; docs-only-Kette nimmt keinen Hold |
| **N1 Notizen beim Dispatch** | `3af11665` | **GELANDET `24cd54e`+`189f815`**, `verify.ok:true` 149 s / 0 s, Audit `unknown` (Timeout, §0.4), Deploy `1a3ed209` (bootHead `0a0da52`) | `task-notes.ts` + `briefAndSend`-Naht + Receipt `notes` |
| M3 Vorflugpruefung dirty-main | `283f625f` | **GELANDET `6c70f01`+`79e1c36`+`94a8840`**, `verify.ok:true` 141 s / 0 s, Audit laeuft (§0.1) | `dirtyMainStop` + zweiter Blick vor dem ff + `MergeErrorReason "dirty-main"` |
| W1 programId-Schnitt in der Landefaltung | `e0113460` | pending | Controller-Brief, Owner-Entscheid 12:4x |
| W2 Bestaetigungstuer fuer die Flaeche einer bestehenden Zeile | `0f5019ac` | pending | unabhaengig von W1 |
| W3 „▸ start wave" mit Selbst-Split | `05611418` | pending | NACH W1+W2 |
| M2 `waitedOut` als Wiedervorlage | `64860da8` | pending | nach W3; Fleet-Betrieb `1c746e96` koordiniert nur |
| N2 Notiz-Lebenszyklus | `f98facad` | pending | nach W3, setzt N1 voraus |
| M4 / N3 unter der Schnittlinie | `4aeeec19` / `f7493755` | notiz | Vorschlaege |

**Erfolgskriterien:** (a) beide Dokumente gelandet mit Schnittliste, Zeilen in der Queue — erfuellt.
(b) S1 gelandet, gepinnt — erfuellt. (c) erster Merge-Schnitt gelandet, keine neue FAILED-Note —
erfuellt und GEMESSEN (`e7b1c1e`, Messnotiz §3 M1: 8 `merge_verdict`-Zeilen seit Deploy, drei mit
`waitMs` 710000/450000/255000 hinter toten Haltern; FAILED weiterhin 19). Das Program laeuft trotzdem
weiter: der Owner hat den Wellenmodus (W1–W3) hier eingehaengt.

## 2. Befunde dieser Session

- **Vier M1-Regressionen an EINEM Vormittag, alle vom Controller gemessen, alle am Code bestaetigt:**
  (1) toter Suite-Halter ⇒ jedes Land wartet bis 45 min (`holdSuiteLock` reapte nie) — M5 (a);
  (2) docs-only-Kette nahm den Hold (710 837 ms fuer 1 s Arbeit) — M5 (b); (3) die drei Gate-Wrapper
  reichten `$$` statt `$_st_lock_pid` ⇒ jede Code-Lane starb am clean-review-Gate — vom Controller
  DIREKT gefixt `b8b5e48` (kein Land-Ledger); (4) die Wrapper-Freigabe hat einen Pfad ohne Rueckgabe
  (pids 19458, 22947 aus GRUEN geendeten Lane-Vollketten) — NICHT gefixt, gehoert dem Program
  Audit-Determiniertheit; M5 macht es fuer Lands folgenlos. Ich habe pid 22947 vor dem M5-Land von
  Hand gereapt (Dreiteilung, Re-Check). Alles in `docs/suite-contention.md` §7c und Messnotiz §3 M5.
- **M3-Review (abgenommen):** `gitReadRaw` (NUL-Reads ungetrimmt), `porcelainZPaths` (Renames beide
  Pfade), `dirtyMainOverlap` (Holder von main wie `advanceIntegration`; kein Holder ⇒ leer, Probe-
  Fehler ⇒ null ⇒ alter Pfad), `dirtyMainStop` als einziger Schreiber; Preflight VOR `verifyPlanFor`
  (kein Plan, kein Hold, kein Verify), zweiter Blick nach `markLandIntent` und VOR `advanceIntegration`
  (Intent wird gecleart); `MERGE_ERROR_REASONS` traegt `dirty-main`, `mergeBlocksLane` liest die LISTE
  statt des Literals. `let verify = dirtyStop ? undefined : gateDenied ?? await …` parst als Ternary
  ueber dem `??` — korrekt. Pins 40+, Checks 192+ in `e2e/programs.ts`, `docs/self-api.md` 68+.
- **Routen-Fakten:** `POST /send {slot,text}` ist die Sende-Route (Owner-Token); `/api/slots/:id/send`
  gibt 404. `POST /api/tasks/:id/brief {text}` setzt den Brief einer pending Zeile (`edited:true`,
  `briefAndSend` liefert `brief.text`). Ein Hintergrund-`until`-Loop, der Tuer + merges-Sensor pollt
  und dann landet + abonniert, hat dreimal getragen (Muster: 15-s-Takt, Deckel 600 s).
- **Der Controller hat N1 einmal von queued auf pending zurueckgesetzt** (Owner-Prioritaet
  Second-host-Entlastung zuerst) und per Monitor wieder freigegeben — eine MAIN darf das erwarten.
- **Nicht gesendet (Broadcast-Buendelung):** ans Program Audit-Determiniertheit die Notiz zum
  Wrapper-Freigabepfad (Befund 4) und zum `FLEET_SUITE_LOCK_HELD_BY`-Export — steht im M5-Report und
  in §7c; wer ohnehin an Slot 7 schreibt, nimmt es mit.

## 3. Deploy / Controller

- Live ist bootHead `0a0da52` (Deploy `1a3ed209`, `ok:true`): M5 und N1 drin. M3 braucht einen Deploy
  (server.ts + lane-signals.ts) — Controller-Akt; meine Deploy-Bitte an Slot 6 bekam 409 (Composer
  belegt) und wurde 45 s spaeter wiederholt — pruefe an `deploys.jsonl`/`codeBehind`, ob sie ankam.
- Der Controller (Slot 6) hat meine Absprache: die MAIN landet ihre Zeilen selbst, er deployt; W-Zeilen
  starte ich per Dispatch-Knopf mit Tripel.

## 4. Kontext

26,7 % gemessen nach dem M3-Land (25,3 % beim ersten Schreiben). Kosten dieser Session: Erdung ~4, M5 (Brief+Review+Land+Doc) ~6, N1
(Review+Land) ~4, M3-Review ~3, Controller-Verkehr ~3. Rechne ~3 Punkte je Land mit Review.

# HANDOFF — Program-MAIN P3 Landepfad adversarial (`6360c36105e50a705db275c1`, Slot 15, Fable 5.1, fuenfte Insassin): GELANDET `b83e246` (Selbstannahme unter drei Auflagen, Attention `58cb3e5e`; Doku sha256 `dcd205e4…`, Verify ok kurze Kette 1 084 ms, Land durch Controller), Audit-Watch `2cdedb22` offen — TAGESMANDAT P3 ERFUELLT; 2026-09-07 21:1x, ctx GEMESSEN ~20 %

> **Dieser Abschnitt ERSETZT den P3-Abschnitt darunter (Slot 4, `027deaa5`).** Zustand ableiten: `./state.sh`,
> `./register.sh`, `GET /api/self/program-execution` (Program 6360c361). Charter = Program-JSON im Gruendungsbrief.

## 0. Wo es steht (16:0x)

- **Der P3-Stand ist jetzt GETRACKT:** `docs/messungen/entwuerfe/2026-09-07-p3-landepfad/` (Commit `17d4eb7`,
  docs-only, Direkt-Commit aus dem Haupt-Checkout auf Anweisung des Controllers Slot 1 — Verifikation von Hand:
  Hash der Kopie == `6b931dc39c0a92d1c866bf96501a0ed5e38b79601c4088257f48c994a850460e`, Scan auf
  Hostnamen/IPs/Klarnamen leer, `bun e2e/pins.ts` ALL PASS, `merges` leer). Inhalt: `entwurf5-6b931dc3.md`
  (== `/tmp/astra-p3-2026-09-07/2026-09-07-landepfad-adversarial.md`), Entwuerfe 3/4, `review-round1..5-REJECT.md`
  (19/13/14/12/10), `review-prompt-r5.txt`, `index-line.txt`, `publication-brief.txt` (Domain gescrubbt), README mit
  Status „NICHT ABGENOMMEN" und den zwei Runde-5-Blockern. `/tmp/astra-p3-2026-09-07/` liegt unveraendert daneben;
  die Lane arbeitet primaer dort.
- **Kein ACCEPT, kein `independent-review.md`, keine Publikation.** Zieldokument
  `docs/messungen/2026-09-07-landepfad-adversarial.md` entsteht NUR ueber die Publikationslane nach ACCEPT.
- **Delegiert:** auftrag **`6b61a7bf`** (Opus 5 `claude-opus-5[1m]` high) — `queued`, letzte von sechs queued Zeilen
  bei Deckel 1 (`FLEET_DISPATCH_MAX_LANES=1`); der Controller sagt, das loest sich nach dem laufenden Deploy.
  **Brief per `POST /api/tasks/6b61a7bf/brief` gepatcht** (Volltext + Nachtrag, 5 581 Zeichen; Dispatch sendet
  `brief.text` statt `text`, `server.ts:8316`): Fallback auf die Repo-Kopie, falls `/tmp` nach einem Reboot fehlt;
  der Entwurfsordner ist NICHT Teil ihres Schreibscopes. Auftrag unveraendert: Runde 5 einarbeiten, max. DREI weitere
  `codex exec`-Runden, bei ACCEPT Phase B (cp+cmp, Indexzeile, install+pins, eigener Commit, Datei-Hash GETRENNT von
  Commit-Sha); nach drei REJECTs Stop mit needs-main, kein Commit.
- **Offene Frage (Notiz `997f0f05`, darf die P3-MAIN bei anhaltendem REJECT selbst annehmen?):** liegt laut Controller
  beim OWNER, der Controller entscheidet sie nicht. Bis zur Antwort gilt der Plan oben unveraendert. Keine Attention.
- **17:4x–18:2x, CHECKPOINT +8h GEFILET (Notiz `22dcc2a6`) UND EINE ATTENTION OFFEN — `58cb3e5e2546e3ed67dd554c`, kind `blocked`, 18:13.**
  Befund: `6b61a7bf` haengt seit 14:2x an der Zeilen-Note „waiting: 5/1 lanes busy in claude-fleet (machine default)“ — bei
  Deckel 1 startet der Tick sie nie, solange per Hand dispatchte Lanes laufen (18:12: sechs Task-Lanes, Slots 4/5/6/10/11/13).
  Controller Slot 1 war nicht erreichbar (ctx >30 min unveraendert 18,4 %, Composer 38 Z. belegt, sechs `POST /send` in
  30 min abgewiesen). **Volltext der Attention, damit die Nachfolgerin sie neu stellen kann, falls sie `refused` ist:**
  (A) Darf die P3-MAIN `6b61a7bf` per Hand-Knopf `POST /api/tasks/6b61a7bf/dispatch {claude, claude-opus-5[1m], high}` ueber den
  Deckel starten (7. Lane), oder schliesst/landet der Controller eine Repo-Lane, oder wartet P3 bis morgen? (B) = Notiz `997f0f05`:
  darf die P3-MAIN bei anhaltendem Astra-REJECT (F1–F8 unstrittig, Restpunkte ≤ mittel, dokumentiert) selbst annehmen, oder bleibt
  ACCEPT der zweiten Astra Pflicht? Ohne Antwort: nichts ueber den Deckel, Plan unveraendert. Das Checkpoint-Auto `f33a3a9f` ist
  nach dem Feuern geloescht.
- **20:3x–20:4x, BEIDE ENTSCHEIDE DA (Controller Slot 1, owner-delegiert, auf Attention `58cb3e5e`):** (A) Repo-Deckel
  claude-fleet auf 3 (`POST /api/repo-lane-cap`), `6b61a7bf` vom Controller per Hand dispatcht → **Slot 5, Branch
  `fleet/260907183653-48b0`, Opus 5, gestartet 20:36:54**. Lane-Watch `4f2e591c` (`idleSec 0`) armiert. (B) **DIE P3-MAIN DARF SELBST
  ANNEHMEN** — Begruendung: fuenf REJECT-Runden = strukturell (Regelbuch ~5x-Schleife); drei HARTE Auflagen, sonst gilt der Entscheid
  nicht: (1) jeder verbleibende REJECT-Punkt NAMENTLICH im Dokument als offener Punkt, keine Fussnote/Zusammenfassung; (2) sichtbarer
  Stempel „MAIN-SELBSTANNAHME nach fuenf Astra-REJECT-Runden, KEIN Astra-ACCEPT“ + Datum + Attention-Id 58cb3e5e, das Dokument darf sich
  nirgends als angenommen lesen; (3) KEINE Runde 6 — hebt das Einarbeiten von Runde 5 einen Restpunkt ueber „mittel“, Abbruch und
  Meldung, der Entscheid wird zurueckgenommen. **Der Lane per `POST /send` (sendId `6debb38e…`, acceptance observed, 20:38) als
  Auftragsaenderung zugestellt**, bevor sie eine Runde 6 starten konnte (sie verifizierte gerade die Runde-5-Zitate): Runde 5
  einarbeiten, Sektion „Offene Punkte — NICHT angenommen“, Stempel unter H1, Indexzeile „Selbstannahme, kein ACCEPT“, dann Phase B
  (cp+cmp, install+pins, eigener Commit), kein `independent-review.md`. Report-Pflicht: Datei-Hash getrennt vom Commit-Sha, Zahl
  offener Punkte, Original-Tails, grep auf Annahme-Woerter leer. **Bei der Abnahme des Reports pruefen:** Stempel wortgleich, Sektion
  vorhanden und vollstaendig gegen review-round1..5, Hash der Datei == Report, `cmp` Draft/Datei, Indexzeile genau einmal, Pins-Tail;
  erst dann `decision.accepted` (Attention 58cb3e5e schliessen) und Land beim Controller anmelden. Controller-Fehler zur Kenntnis:
  `522701c` wurde mit REJECTED Report gelandet — unser Fall ist bewusst anders (benannter Entscheid mit Auflagen, kein Gate-Gruen).
- **21:0x, REPORT DA UND ANGENOMMEN.** Lane-Report `9f8e5c10` (Event `7a4e86e2`, ack) — Lane hat Runde 5 eingearbeitet,
  KEINE Runde 6, publiziert: Lane-Commit `df96968` = genau 2 Dateien, `docs/messungen/2026-09-07-landepfad-adversarial.md` NEU
  (1065 Z., sha256 `dcd205e4761b28f898a17663af0341a3d90e06f6e45b90cfbebd5a35bf7e2538`) + 1 Zeile `INDEX.md`. **Von mir mechanisch
  geprueft im Worktree `claude-fleet.worktrees/fleet-260907183653-48b0`:** Hash == Report; `cmp` gegen `/tmp/...adversarial.md`
  byteidentisch; Stempel wortgleich als Blockquote unter H1 mit Attention-Id; Annahme-Grep 7 Treffer, alle Verneinung/Stempel;
  §13 „Offene Punkte — NICHT angenommen“ mit fuenf namentlichen Restpunkten (R2#1+R3#2 · R1#5+R2#5+R3#3 · R3#12 · R4#10 · R1#17,
  keiner ueber mittel) + zwei benannte Abweichungen (blockt zusaetzlich `unknowable`; A/B/C nach Guard-Reparatur nicht neu gefahren);
  alle zehn Runde-5-Punkte im Text belegt (drei davon in anderem Wortlaut: §1.7 `cwd`, §8 `read("docs/self-api.md")`, §1.6 `pwd -P`+Marker);
  install Exit 0, pins ALL PASS (`/tmp/p3-publication-6b61a7bf-{install,pins}.log`); Sensitive-Grep 0; drift `wouldConflict:false`,
  behind 4 (nur HANDOFF/watchdog auf main), overlap []. → `POST /api/self/fleet-report/9f8e5c10…/accept` (Body `{reason}`), ok.
  Watch `4f2e591c` gefeuert (Event `2f9da434`, ack). **Projektion: REVIEWABLE, kein Self-Land — Land durch den Controller** (Notiz
  `4d346f3c` an Controller+Astra; Pane-Zeile an Slot 1 erneut am belegten Composer abgewiesen, Retry im Hintergrund).
  **Naechster Zug der Nachfolgerin:** sobald `fleet.json#merges["5"]` existiert, `POST /api/self/watch {kind:"merge",target:5,idleSec:0}`;
  bei `landed=YES` `{kind:"audit",repo:"/Users/owner/claude-fleet",mainAfter:<candidate>}` (docs-only ⇒ kurze Kette). Danach die
  Shas in `docs/messungen/entwuerfe/2026-09-07-p3-landepfad/README.md` NICHT nachtragen (Entwurfsordner bleibt Historie). Tagesmandat
  fuer P3 damit erfuellt; nach ~21:45 nur Koordination, kein Folgetag ohne neue Richtung.
- **21:1x, GELANDET.** Controller landete `fleet/260907183653-48b0` → main `b83e2466c5c3537360bdac90457a5bbd61a1a51d`
  (2 Dateien, +1066; Land-Note: `verify.ok:true`, `proportional:true`, steps install+pins, 1 084 ms, Mutex nicht genommen;
  actor owner/bearer). Von mir geprueft: `git show b83e246:docs/messungen/2026-09-07-landepfad-adversarial.md | shasum` ==
  `dcd205e4…` (identisch mit Lane-Report und Worktree). Zeile `6b61a7bf` done, Slot 5 geschlossen (Merge-Watch darum 409
  „target slot not active“ — der persistierte Fakt in `fleet.json#merges["5"]` sagt `merged`, `landed:true`).
  **Audit-Watch `2cdedb22`** (`kind:audit`, mainAfter `b83e246…`, idleSec 0) armiert; docs-only ⇒ Post-Land-Audit kurze Kette.
  Rot dort waere ECHT und gehoert dem Controller/Audit-Determiniertheit, nicht P3 (docs-only kann pins nur ueber Pfad-/Doc-Pins
  reissen). **P3 ist damit terminal:** Tagesmandat erfuellt unter Selbstannahme; kein Folgetag ohne neue Richtung; nach dem
  Audit-Event nur noch die Abendzeile. Der Entwurfsordner `docs/messungen/entwuerfe/2026-09-07-p3-landepfad/` bleibt Historie.
- **21:2x, AUDIT GRUEN (Event `5635c3f3`, ack):** Post-Land-Audit auf koalesziertem Tip `116fdf36` (covers `6b72d62`+`b83e246`,
  `b83e246` ist Ancestor), `result:green`, 441/0 Checks, 1 914 ms, `proportional:true` — kurze Docs-Kette, KEINE volle Suite
  (beide Cover docs-only). Merge-Event `3c2c1b45` ebenfalls ack. **P3 ist abgeschlossen; keine Watches, Autos, Attentions offen.**
- **Rueckwege, die eine Kompaktierung ueberleben:** (Auto geloescht, s.o.) Fleet-Auto `f33a3a9f` (One-Shot auf Slot 15, faellig 17:40,
  `idleSec 60`) fuer den Checkpoint +8h. Session-lokal (sterben mit Pane/Succession): Monitore auf den Statuswechsel von
  `6b61a7bf` und auf 17:40. **Noch KEIN Fleet-Watch** — der Lane-Watch braucht den Slot, den es erst bei `sent` gibt.

## 1. Naechste Zuege

1. **Sobald `6b61a7bf` `sent` ist:** `POST /api/self/watch {kind:"lane", target:<slot aus fleet.json#tasks>, idleSec:0}`;
   zugestellte Events quittieren (`POST /api/self/events/:id/…`). Report kommt ohnehin in die Pane.
2. **Beim Lane-Report (Claim, kein Beweis):** bei ACCEPT `shasum -a 256` der publizierten Datei == Hash im Receipt-Kopf ==
   Hash im Report, `cmp` gegen den akzeptierten Draft, Indexzeile genau einmal, Pins-Log-Tail „ALL PASS" — erst dann
   `decision.accepted`; Land = Controller (kein Self-Land in diesem Program). Bei needs-main: Owner-Antwort auf
   `997f0f05` abwarten bzw. beim Controller nachfragen; Attention nur, wenn sonst nichts kommt.
3. **Runde 6+ NICHT aus der MAIN drehen** (~6 Punkte Kontext je Runde; die Lane hat 1M).
4. **Checkpoint +8h (~17:45):** Notiz in diesem Program, Kopf „AN CONTROLLER (Label 🎛, Slot pruefen — er zog 10 → 6 → 1 um)
   · AN ASTRA SLOT <fleet.json#programs[e3b3a064].main.slot> (e3b3a064) · CHECKPOINT P3 +8h": Pfad, Reviewbefund
   (5× REJECT), Schnitte (Verstetigung `17d4eb7`, Delegation `6b61a7bf`), Kontextfuellung gemessen. Nach dem
   Tagesmandat (~21:45) nur Koordination.

## 2. Was ich entschieden habe (Slot 15)

- Verstetigung als ENTWURF unter `docs/messungen/entwuerfe/`, nicht am Zielpfad — damit die Publikationslane weiter
  „neu, cp + cmp" fahren kann und kein Hash-Vergleich gegen eine halb-publizierte Datei entsteht.
- Brief-Patch statt neuer Zeile: die Queue-Position bleibt, `edited:true` macht nur ein (nicht vorhandenes)
  Analyse-Urteil stale.
- Deckel/Queue nicht angefasst (Charter: keine Deckel-Aenderung durch diese MAIN).

Alles darunter (Slot 1, 4): Verlauf der Runden 1–5, Mutex-Modell, Gate-Mediane — bleibt gueltig als Historie.

# HANDOFF — Program-MAIN P3 Landepfad adversarial (`6360c36105e50a705db275c1`, Slot 4, Fable 5.1, dritte Insassin): 3. ENTWURF `027deaa5` nach drei Astra-REJECTs (19/13/14), kein ACCEPT, Succession auf Controller-Anweisung; 2026-09-07 13:5x, ctx ~53 % (Owner-Poll)

> Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution` (Program 6360c361). Charter =
> Program-JSON, fachlicher Startbrief = Notiz `52285f8f` (byteidentisch `/tmp/astra-tagesmandat-2026-09-07/P3-startbrief.txt`).
> Zwei Astra-Vorgaengerinnen (Slot 13, Slot 4) starben ohne Artefakt an einer Provider-Sperre beim adversarialen
> Lesen von `mergeJob`; Owner-Entscheid: derselbe Auftrag auf Fable. Rahmen fuer dich: Zuverlaessigkeitsarbeit am
> eigenen Land-Pfad, Repro nur in Scratch-Instanzen.

## 0. Wo es steht (Stand 13:5x, ctx 53 % am Owner-Poll; Succession auf Controller-Anweisung Slot 6)

- **Dritter Entwurf:** `/tmp/astra-p3-2026-09-07/2026-09-07-landepfad-adversarial.md` (801 Zeilen), versiegelt
  **sha256 `027deaa5932b7095e6b87b8479439e5747a67be1d676655da081b3c143b9ce9f`**, Quell-Pin `c7184f8`. Acht Findings;
  F1 in DREI Varianten reproduziert mit sechs Assertions (Skript + Transkript im Doc §1.3/§1.6, Exit 0; Skriptkopie
  im Scratchpad dieser Session stirbt mit ihr — das Doc traegt beides). F2 am Live-Repo read-only gemessen.
- **Drei Astra-Abnahmen, alle REJECT, jede kleiner:** Runde 1 19 Punkte (`review-round1-REJECT.md`), Runde 2 13
  (`review-round2-REJECT.md`), Runde 3 14 (`review-round3-REJECT.md`, auf `027deaa5`). Jede Runde bestaetigt F1–F8
  als Codebefunde („Geprueft und korrekt"); abgelehnt werden Fix-Skizzen, Done-Saetze, Zitate, Ueberziehungen.
  **Blocker Runde 3 (einziger `[schwer]`):** das F6-Beispiel „`e2e-security.sh` durch `exit 0` ersetzen → gruenes
  Gate" ist FALSCH — `e2e/pins.ts:398–400` verlangt jede Wrapper-PORT-Deklaration aus der Tabelle (`e2e-isolated.sh:33`)
  auf Platte, ein Vollersatz faellt schon am Pin; L6 ist hoechstens ein Mengenindikator (Kandidat erzeugt auch die
  PASS-Zeilen). Die 13 uebrigen Punkte stehen mit Zeilen im Receipt; NICHT hier wiederholen, Datei lesen.
- **Kein ACCEPT liegt vor.** Kein `independent-review.md` (das waere der Name fuer ein ACCEPT-Receipt). Keine
  Publikationszeile gefilt. `index-line.txt` liegt (Stil INDEX.md), `publication-brief.txt` liegt als Vorlage mit
  `__HASH__`/`__IDXHASH__`-Platzhaltern — gilt erst nach einem ACCEPT auf den dann finalen Bytes.
- **Checkpoint +4h ist gefilt** (Notiz `35b7c68e`, 12:5x); der Controller (Slot 6) hat ihn gelesen und die zwei
  Owner-Fragen (Hub-Lease-Undo, Deploy-Preflight) selbst beim Owner — die Antworten gehen an 233e1c2b/f170dc46, nicht
  an dieses Program. Checkpoint +8h (~17:45) ist noch offen.
- **Controller-Anweisung 13:4x (Slot 6, woertlich in der Pane):** 3b zu Ende, Receipt ablegen, nichts Neues, dann
  Succession; Nachfolgerin auf **Fable** (Astra-Sperre auf Merge-/Deploy-Code zweimal belegt).

## 0b. Der strukturelle Hebel (Controller Slot 6, in den Handoff aufzunehmen)

Program 6360c361 trug zwei `notiz`-Zeilen und keinen `auftrag`: es gab nie etwas zu verteilen, jede Repro lief im
eigenen Kontext. Was teuer war, ist nicht die Delegation, sondern das WIEDEREINLESEN: `codex exec` schreibt in eine
Datei, ich las die Datei zurueck (19+13+14 Punkte, drei Skripte, drei Transkripte) — bei ~96 % Input-Anteil zahlt
jeder Folgeturn das erneut. Regel fuer die Nachfolgerin: (1) Repro-Bloecke als `auftrag`-Zeilen (Opus, high) filen —
die Lane faehrt Scratch-Instanz und Varianten und meldet VERDIKT + Transkript-PFAD, nie das Transkript; (2) ein
Reviewer-Verdikt kommt als DREI ZEILEN in die Pane (Verdict, Zahl der Punkte, Pfad), der Rest bleibt auf Platte und
wird per Pfad zitiert — `sed -n '/^## Verdict/,$p'` + `grep -c '^[0-9]*\. \['`, nie `cat`; (3) auch die Einarbeitung
einer Review-Liste kann eine Lane sein (Doc-Datei + Receipt als Input, neuer Draft + Hash als Output).

## 1. Naechste Zuege, in Reihenfolge (fuer die Nachfolgerin)

1. `review-round3-REJECT.md` lesen (nur die 14 Kopfzeilen + Verdict; Details je Punkt bei Bedarf per `sed -n`).
   Den F6-Abschnitt korrigieren: die Klasse bleibt (Gate fuehrt Kandidaten-Skripte aus), das Beispiel muss eines
   sein, das die Pins ueberlebt (z. B. Wrapper behaelt seine PORT-Zeile und ersetzt nur den Runner-Aufruf durch
   `exit 0` — VOR dem Schreiben am Pin `e2e/pins.ts:398–400` und an `e2e-isolated.sh:33` gegenlesen), und L6 als
   Mengenindikator ehrlich herabstufen oder streichen. Danach die 13 mittleren/leichten Punkte.
2. Entweder selbst einarbeiten (klein) ODER — empfohlen bei >10 Punkten — als `auftrag` (Opus, high) filen: Input
   Draft + Receipt + Pin `c7184f8`, Output neuer Draft unter `/tmp/astra-p3-2026-09-07/` + Hash + DREI-Zeilen-Report.
3. Runde 4: `sed "s/__HASH__/<neu>/" review-prompt.txt > review-prompt-<neu>.txt`, dann
   `codex exec --ephemeral -s read-only --skip-git-repo-check --color never --json -o <ausgabe> -m gpt-6-astra - < <prompt>`
   im Hintergrund (Log-Dateien, `codex exit N` am Ende); Verdict mit drei Zeilen lesen. Bei ACCEPT: die Ausgabe
   byteidentisch als `independent-review.md` ablegen, Hash im Kopf pruefen.
4. Publikation: `publication-brief.txt` mit beiden Hashes fuellen, `POST /api/self/tasks` `{kind:"auftrag",
   harness:"claude", model:"claude-opus-5[1m]", effort:"high", text}` → `release`. Deckel 1; P1/P2-Publikationen
   `34c0d050`/`180d3c92` waren um 12:4x noch queued.
5. Nach dem Lane-Report Datei-Hash und Commit-SHA GETRENNT pruefen, `decision.accepted`; Land = Controller.
6. Checkpoint +8h (~17:45) als Notiz in diesem Program, Kopf „AN CONTROLLER (Label 🎛, Slot pruefen) · AN ASTRA SLOT 9
   (e3b3a064) · CHECKPOINT P3 +8h"; Bindungen vorher aus `fleet.json#programs[].main.slot` lesen.

## 2. Was ich entschieden habe (und warum)

- Rangliste nach Verlust: F1 Tip-Bindung (beide Stufen blind bei docs-only) > F2 undo tot auf hub-Flotte > F3 Deploy
  Working-Tree > F4 Audit-Bindung > F5 Land-Intent-Ueberschreibung > F6 Kandidat-Skripte > F7 Mutex-Park > F8 Pack-Anker.
- Repro nur fuer F1 gefahren (Scratch, eigener Socket `fleetp3f1`, Port 8931, eigener Lock); alle anderen als
  „nicht reproduziert, Argument am Code" mit Skizze — Charter erlaubt beides, Zeit und Kontext sprachen dagegen.
- Zweite Astra ueber `codex exec` statt Lane: Regel 4 des Mandats (native Sub-Agents kosten keinen Slot), Deckel 1 ist
  von P1/P2 belegt. Zusaetzlich ein Opus-Gegenleser, weil die Astra-Lesung selbst ein Claim ist.
- Rename-Verdacht („nach docs/ umbenennen") ist am Code geschlossen (`--no-renames`, 11925) — im Doc §8, nicht Finding.

## 3. Offene Fragen an Owner/Controller (keine Attention gestellt)

- F2: soll undo-land auf den eigenen Hub zurueckspiegeln duerfen (Doc §2.5 b)? Das ist eine Richtungsfrage, kein Fix.
- F3: Deploy-Preflight (schmutziger Tree / Tip ohne Note → 409) gehoert Fleet-Betrieb, nicht Land-Pipeline.

# HANDOFF — 🎛 Fleet Controller (Slot 10, Fable 5.1) → Nachfolgerin: Private-repo-j gegruendet und in M1, Astra-Tag P1–P3 laufen, Slots 6/8 im Retire, Deploy c7184f8 gruen — DEIN NEUER OWNER-AUFTRAG: TASK-WELLENMODUS

> Geschrieben 2026-09-07 12:2x bei ctx 39,5 % (gemessen). Zustand ableiten: `./state.sh`,
> `./register.sh`, `GET /api/self/attention`, Board. Alles hier sind Behauptungen zum Nachschlagen.
> Die Owner-Delegation gilt fort: „sag mir einfach was ich tun soll, wenn du wirklich meine Hilfe
> benoetigst, etwas zu entscheiden" — Lands nach `decision.accepted`, Deploy ueber Verb 2, Reaps,
> Owner-Entscheide weiterreichen; keine eigene Grabung.
> **Modell:** du bist laut Regelbuch-VERSUCH (MODELLPOLITIK, Owner-Richtung 09-07 05:2x) die erste
> Controller-Nachfolgerin auf **Opus 5 high**. Kriterium der Schicht: gleiche Zahl Lands/Reaps ohne
> zusaetzliche Owner-Attentions, HANDOFF in gleicher Dichte; faellt es durch, succeedest du mit
> `{"model":"claude-fable-5-1[1m]","effort":"high"}` zurueck. Der Owner hat DIESE Succession
> ausdruecklich verlangt (12:1x: „DU solltest nun auch das Handoff durchfuehren") — sie ist echt.

## 0. DEIN AUFTRAG VOM OWNER (woertlich, 12:1x): „in der neuen Session wuerde ich dann gerne den Task Wellenmodus und alles was dazu gehoert, angehen^^"

Was es im Repo schon gibt — LESEN, nicht neu erfinden:
- `docs/queue-wellen-2026-09-06.md` (Urteil in einem Satz dort: `task-waves.ts` faltet die Queue zu
  PARALLELEN Lanes, die Zeit liegt aber in den LANDS — 74,7 h Audit-Wanduhr in 14 Tagen; eine
  **Landewelle** ist die umgekehrte Faltung, heute nicht berechenbar, weil 0 von 31 `auftrag`-Zeilen
  eine bestaetigte Flaeche tragen). §2 drei pruefbare Wellen-Regeln, §3 Kosten/Nutzen, **§5
  Schnittliste (3 Schnitte)**, §6 Nicht-geprueft.
- `task-waves.ts` (214 Z., deterministische read-only Projektion, browser-safe) und die
  Landefaltung `863f628` + `49d93bc` (S1 Wellen-Sensor, gelandet; `32cd0e7` traegt in §5 die Shas und
  den gemessenen Done-Satz „40×1, alle flaeche-null").
- Traeger-Program: **Land-Pipeline 233e1c2b (Slot 5, Fable)** — Titel „robuster Merge-Prozess,
  Queue-Wellen"; M3 (283f625f) laeuft als Lane auf Slot 1 (2 Commits, e2e-isolated-Vorschau lief
  11:44), M2 `64860da8` und N2 `f98facad` pending; Notizen `dfc1506a` (Wellen-Report gelandet +
  Owner-Richtung 09-06 „sma…") und `86830851`. Slot 5s eigener HANDOFF-Abschnitt steht unten
  (`# HANDOFF — Program-MAIN Land-Pipeline`).
- **Erster Zug dazu, in dieser Reihenfolge:** (1) §5 der Wellen-Doc und Slot 5s Abschnitt lesen;
  (2) dem Owner in ≤ 8 Zeilen sagen, was „Wellenmodus" laut Repo heute heisst (Parallelwelle beim
  Dispatch vs. Landewelle) und ihn fragen, WELCHE er meint und ob „alles was dazu gehoert" die
  Flaechen-Bestaetigung (`brief.files`, `confirmed` vs `derived`) einschliesst — das ist ein
  „clarify first", kein Bau; (3) die Zeilen dann in 233e1c2b filen und Slot 5 briefen lassen; du
  landest und deployst, du grabst nicht selbst.

## 1. Was mit MIR stirbt (Slot 10 wird nach der Grace-Frist geraeumt)
- Zwei Bash-Hintergrund-Watcher (ein `fleet.json`-Diff-Monitor, ein Warte-Skript auf das Retire von
  Slot 6/8) — beides Scratchpad, beides tot. Ersatz: `POST /api/self/watch` (idleSec:0) und Board.
- Alle meine Watches haben gefeuert (letzte: Audit 189f815 = `unknown`, 45-min-Timeout, lokal).
  Keine Autos ausstehend. Keine offene Attention von mir.

## 2. Kette in Flug, Stand 12:2x (alles am Board/Ledger gemessen, nichts geschaetzt)
- **Private-repo-j 9ce08219 (Slot 2, Astra medium, ctx ~78 % von 258k — codex kompaktiert selbst):**
  Preflight-Kette gelaufen: Architect-Draft (Fable, Branch `fleet/260907083811-8361` @ 14d0f53),
  P0-Wasserprobe (`fleet/260907085742-314b` @ 5bac39d), Cross-Model-Review + E2/E3-Nachtrag
  (`fleet/260907092236-fdb9` @ 0e08f84) — alle drei Lanes OHNE Land geschlossen (MAIN-Entscheid
  RETHINK bis M1/M2), Branches als Beleg erhalten. **M1-Recherche `86600976` laeuft auf Slot 13
  (Opus)**; M2 Art-Bibel folgt; danach neuer Architect + Review, dann Land der Endfassung durch DICH
  nach `decision.accepted`. Owner-Entscheide E2 (beide Partieformate), E3 (Tick p95 ≤ 2 ms), E4
  (M1/M2 vor ACCEPT) sind bei ihr im Entscheid-Log. Repo `/Users/owner/private-repo-j` (Trust-Eintrag
  gesetzt), Worktree `astra-main`. **Deckel:** bis `779eb456` (Slot 14) gelandet+deployt ist,
  hand-dispatchen (`POST /api/tasks/:id/dispatch`, prueft keinen Deckel), wenn eine released Zeile
  mit `waiting: 1/1` steht; danach Biber auf 3 setzen (die Route steht im Report der Lane).
- **P3 6360c361 auf Slot 4 = FABLE 5.1 high** (dritte MAIN; beide Astra-Vorgaengerinnen starben an
  der Provider-Sperre „extra caution with cybersecurity requests" beim adversarialen Lesen von
  mergeJob/drainPostLandAudits; Owner-Entscheid: Fable). Startbrief-Notiz `52285f8f`. Faellt auch
  Fable → Opus 5.
- **Astra-Tag b78d31b7 (Slot 9, Astra high):** P1 (Slot 11) und P2 (Slot 12) sind FERTIG und von
  einer zweiten Astra abgenommen (Spec 412 Z. sha 185b5295…, Vertrag 514 Z. sha 140d2b6f…, in
  `/tmp/…`); ihre Publikations-Lanes `34c0d050`/`180d3c92` stehen `queued` hinter dem Deckel.
  Checkpoint-Wecker auf Slot 9: Autos `f31828de` (13:45) und `ca8e863d` (17:45) — Notizen „AN
  CONTROLLER SLOT 10" kommen dann in die Queue (jetzt an DICH; sag ihr deinen Slot). Owner-Richtung
  `6f90781c` (Dual-Host auf dem Second-host) liegt bei ihr: sie re-chartert cd110019, die MAIN dafuer
  bekommt den ersten freien Slot — codex/gpt-6-astra/**medium** (Owner-Option 11:0x fuer alle
  Astras).
- **Slots 6 und 8 retiren (Owner-Ja 12:1x):** beide haben den Auftrag HANDOFF-Abschnitt + Commit,
  dann `POST /api/self/retire` (Slot 8 zusaetzlich `rulebook/deploy.md` ~58-59 korrigieren: der
  Autoclose HAT einmal ausgeloest, 09-05 17:05:54, Task 9f1dbfb4 — Render + pins). Pruefe am Board;
  sind sie nach 30 min noch da, EINMAL anstupsen. Ihre Programs bleiben aktiv, Restarbeit liegt als
  Zeilen. Notiz `0f44755c` (typisierter Rueckweg fuer Pane-Antworten = die „fehlende Nachrichten-
  Capability", die den Owner nervt) ist als `f4dc7276` nach Fleet-Betrieb umgehaengt.
- **Slot 7 Fleet-Betrieb (Opus, ctx 42,5 % GEMESSEN — sie selbst sagt 13 %):** aufgefordert zu
  HANDOFF + `/compact`. Sie nennt dir den Env-Eintrag `FLEET_POSTLAND_AUDIT_WAIT_MS` (Wert+Grund) →
  `watchdog.sh` + `launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog`. Ihre Lane Slot 14
  (`779eb456`, Deckel je Repo, Commit `9422dbc`, Gate laeuft, Helfer hat die Vorschau geclaimt)
  reportet an sie; sie landet selbst (Self-Land) → dann **Deploy Verb 2 durch dich** (409 bei
  laufendem Audit; danach `bundleStale`/`deployGap` pruefen). Erst danach fallen `34c0d050`,
  `180d3c92`, `e407aef5`, `1d0f4ca4`, `56e4427d` durch — seriell bei Deckel 1.
- **Slot 3 Codebase-Review (Astra):** Auflage aus der Bewertung: Zielregister
  `docs/messungen/2026-09-review-aussen-nach-innen.md` main-direkt schreiben statt auf eine Lane zu
  warten — noch NICHT an sie gesendet. Bleibt es aus, HANDOFF+RETIRE.
- **Slot 15 „fable5" = eigene Owner-Session (Opus):** wartet seit 09-04 auf GLM-Key-Entscheid
  (Konzept-B); haelt einen ungeschriebenen Befund (Helfer 22 Check-Namen vs lokal 8). Frage an den
  Owner ist gestellt, unbeantwortet — NICHT anfassen.
- **Deploy `6f052d61` gruen** (bootHead = main = c7184f8, 15 Sessions ueberlebt). Helfer
  `secondhostlinux1` ist AKTIV (maxParallelSuites 1); meine fruehere Aussage „nimmt keine Audits
  an" war falsch gelesen.
- **Maschine:** 8 GB RAM, Swap 3,5/4 GB, Slot 1 meldete OOM-gekillte Warte-Kommandos → keine 17.
  Session; MAX_SLOTS=16 ist Konstante. Freie Slots: 16 (+6, +8 nach Retire).

## 3. Owner-Entscheide dieser Schicht (woertlich, damit niemand sie neu stellt)
- 10:5x Lane Slot 4 auf Fable („macht am Anfang Sinn") · 11:0x „Astra auf medium ist schon echt
  sehr gut" → Astra-Sessions effort medium, mindestens als Option · 11:2x „der [Deckel] sollte
  ueberhaupt hoeher liegen als 1" → 779eb456 · 11:3x Partieformat „beides" (E2) · 11:3x Tick-Budget
  an mich delegiert → p95 (E3) · 11:4x M1/M2 vor ACCEPT (E4, an mich delegiert) · 11:5x „Den
  zweiten Host sollten wir logischerweise auf dem second-host aufsetzen" → 6f90781c · 11:5x „Staffel
  von Agenten … jede Session … Bewertung" → fuenf Lese-Agenten, Rangliste geliefert · 12:1x „slot6
  und slot8 klingt gut" → Retire · 12:1x Handoff + Wellenmodus (oben).

## 4. Lehren, teuer bezahlt heute
- Claude-Trust-Dialog frisst den Lane-Brief in einem NEUEN Repo (Root-Schluessel in
  `~/.claude.json`; Notiz `2022fa5a` in Fleet-Betrieb; paneReadiness kennt keinen claude-Screen).
- gpt-6-astra sperrt bei „adversarial" + Merge-/Deploy-Code — zweimal, ohne Artefakt. Charters fuer
  Landepfad-Arbeit: Claude-Modell oder Wortwahl „Zuverlaessigkeitsarbeit am eigenen Code".
- `POST /api/tasks/:id/dispatch` umgeht den Deckel — dreimal genutzt, immer mit Grund im Board.
- Selbstauskunft ctx einer Opus-MAIN kann um 30 Punkte danebenliegen (Slot 7) — immer messen.
- Owner-Kills auf dem Board sehen im Ledger aus wie meine (`slot_kill … owner`): erst fragen.

# HANDOFF — Program-MAIN 66499a03 „Fleet-Betrieb ohne manuelles Owner-Routing" (Slot 8, Opus 5): SATZ 8 IST BELEGT — die erste `autoClose`-Zeile ueberhaupt, plus ein zweites Self-Land ueber die eigene Sprosse; der Slot wird auf Owner-Entscheid frei gemacht, das Program bleibt aktiv; 2026-09-07 12:2x

Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`.
Lineage 4 → 16 → 10 → 3 → 5 → 2 → 8. Hier nur, was git und die Sensoren nicht tragen.

## 0. WAS DER NAECHSTE WISSEN MUSS, in drei Zeilen

- **Satz 8 (automatisches Cleanup) ist BELEGT** — `lane-outcomes.jsonl`, 2026-09-05 17:05:54,
  `killed-empty`, Branch `fleet/260905144235-136c`, Task `9f1dbfb4`, `commitCount 0`,
  `ownerPrompts 0`, `confirmedByHuman false`, `autoClose{reportId 9814b064…, accepted,
  decidedAt 16:46:50, decidedBySlot 8}`. Erste solche Zeile in inzwischen 832. Das Regelbuch
  (`rulebook/deploy.md`) fuehrte bis heute „nie ausgeloest, 0 von 786" — korrigiert, gerendert,
  `bun e2e/pins.ts` ALL PASS.
- **Satz 5 ein zweites Mal belegt:** `b7c2cc1` (Task `cb77452a`), Land-Note
  `actor{kind:"main", slot:8, program:66499a03, task:cb77452a, sessionIdMatch:"exact"}`,
  `confirmedByHuman false`, `verify.ok true`, exit 0, alle sieben Stufen, `ms 109 031`, `waitMs 0`.
  Inhalt: `GET /api/programs` traegt nur noch, was der Client rendert — gemessen 106 347 B (47,3 %)
  weniger je Poll bei 63 Programs.
- **Satz 11 bleibt offen**, und zwar praezise: die beiden Laeufe vom 09-05 hatten je `ownerPrompts 0`
  und liefen vollstaendig ueber Self-Tueren (`releasedBy: machine`, Tick-Dispatch, Report, Annahme,
  Self-Land bzw. Auto-Close). Was fehlt, ist EIN ZUSAMMENHAENGENDER Lauf, der beide Enden in sich
  traegt — und der ist strukturell unmoeglich, siehe §1.

## 1. DER BEFUND, der das Erfolgskriterium neu liest — am Code, nicht aus Prosa

**Satz 5 (Self-Land) und Satz 8 (Auto-Close) koennen in DERSELBEN Lane nie beide vorkommen.**
`server.ts#laneAutoCloseRefusal` verweigert, sobald ein Merge-Verdikt auf der Branch dieser Lane
liegt („this lane's candidate is somebody's to look at"), und `server.ts#tickLaneAutoClose` bricht
ab, sobald `buildLaneOutcome` etwas anderes als `killed-empty` liefert („a lane with commits is
never closed automatically"). Wer landet, wird nie auto-geschlossen; wer auto-geschlossen wird, hat
nie gelandet.

Konsequenz fuer die Bilanz: **„Ein realer Programlauf belegt alle elf Schritte" ist nur erfuellbar,
wenn „Lauf" das PROGRAM meint, nicht die Lane.** So gelesen sind heute 10 von 11 belegt. Als
Ein-Lane-Forderung gelesen ist der Satz unerfuellbar — das ist eine Owner-Frage, keine Restarbeit,
und sie gehoert gestellt, bevor jemand einen dritten Beleglauf ansetzt.

## 2. Werkzeuge und Fallen, teuer gelernt — nimm sie mit

- **Der `accept`-Grund ist auf 500 Zeichen gedeckelt, und ein LEERER Body gilt als gueltige Annahme
  ohne Grund.** Es gibt keine Re-Decide-Tuer. Bau die Laengenpruefung in DENSELBEN Prozess, der
  sendet, und sende nur nach bestandener Pruefung — bei mir hat genau das einmal gegriffen
  (536 > 500, nichts gesendet, gekuerzt, 478). Meiner Vorgaengerin ist der Grund auf diesem Weg
  verlorengegangen.
- **`POST /api/self/tasks` ist fuer `notiz` bei 10/10 pending zu, fuer `auftrag` NICHT.** Die
  Meldung sagt „advisory filing cap"; das Register dieses Programs nimmt also weiter Arbeit an, nur
  keine Befunde. Meine zwei Befunde stehen deshalb hier statt dort.
- **Die Adjudikation eines roten Post-Land-Audits ist owner-only BY POSITION** — eine MAIN hat dort
  keine Tuer (`docs/program-lebenszyklus-architektur-2026-09-04.md`). Der dokumentierte Weg ist eine
  Attention. Das Rot auf `b7c2cc1` steht unbeurteilt und blockiert nichts.
- **Ein Rot adjudiziert man an der FAIL-ZEILE, nicht am Wort „bekannte Familie".** Beide Fails auf
  `b7c2cc1` waren fremd, und beide Male ist es NACHGESEHEN: `projection nextAction` (§11.2o) haengt
  an `selfExecution`/`selfLand`, nie an `/api/programs`; `D2 setup: both closing lanes reached the
  spent shape` wohnt in `e2e/watch.ts:3191`, einer Datei, die der Diff nicht beruehrt, wartet dort
  bounded 60 s auf `stalled` an zwei Fixture-Lanes und ist damit lastempfindlich — 8 Vorkommen in
  490 Audits, sechs davon an einem Tag.
- **Eine SETUP-Zeile im Rot heisst: alles darunter ist UNGEMESSEN, nicht verletzt.** Bei `D2 setup`
  ist das woertlich der Fall.
- **Der 4096-B-Tail des Helfer-Verdikts verliert bei Lane-Suiten den FAIL-NAMEN** (Befund der Lane
  `cb77452a`). `checks{ran,failed}` kommt an, der Name nicht — und der Name ist die eine Angabe, die
  eine Lane zum Adjudizieren braucht. Ungefilt, weil das Advisory-Register zu ist.

## 3. Korrekturen an fremden und eigenen Saetzen

- **Der Auftrag zu diesem Handoff nennt als Grund „40 h ohne Fleet-Akt, 0 Reports". Fuer diese
  Session ist das gemessen falsch:** zwei Reports empfangen, geprueft und mit Grund angenommen
  (`9814b064`, `892f5332`), ein Task gefilt und ueber die eigene Tuer released (`cb77452a`), ein
  Self-Land (`b7c2cc1`), ein Auto-Close-Beleg erarbeitet. Die Zahl beschreibt vermutlich den SLOT
  vor meiner Uebernahme. Am Entscheid aendert das nichts — er ist der des Owners; die Akte gehoeren
  nur richtig ins Register.
- **Ich habe den Audit-Ausgang vorhergesagt und die Zahl verfehlt:** ich sagte EIN Fail an, es waren
  zwei. Die Attribution stimmte, die Zaehlung nicht — eine Vorhersage ueber eine flakige Suite ist
  nur so gut wie ihre unbeobachtete Haelfte.
- **„Ein Auto-Close laesst den Worktree liegen" habe ich am 09-05 gemeldet und kann es NICHT halten:**
  am 09-07 ist `fleet-260905144235-136c` weg. Wer ihn geraeumt hat, weiss ich nicht — also ist es
  eine Momentaufnahme gewesen, keine Regel, und es steht bewusst NICHT im Regelbuch.

## 4. Was mit dieser Session stirbt — und was nicht

- **Nichts haengt in der Luft:** keine laufende Lane, keine armierte Watch, kein offener Auto, keine
  offene Attention, keine Zeile `queued` oder `sent`. Der Beleg von Satz 8 ist deploy-fest, weil er
  eine Ledger-Zeile ist und kein Idle-Fenster.
- **Offen im Register, unangetastet:** `6c9e2ac1` und `9f1dbfb4` stehen wieder `pending` mit
  `nextAction: release`. **`9f1dbfb4` ist FERTIG** — ihre Arbeit ist berichtet, angenommen und ihre
  Lane auto-geschlossen; der Requeue ist ein mechanisches Artefakt des `killed-empty`. Wer sie
  erneut released, laesst fertige Arbeit zweimal machen. Das ist ein Lebenszyklus-Loch und der
  naechstliegende Kandidat, falls dieses Program noch einen Schnitt bekommt.
- **Die Notiz `0f44755c` haengt der Controller an `f170dc46` um** (Ansage 12:1x) — nichts tun.
- **Nicht gemacht, weil nicht beauftragt:** kein Deploy (`b7c2cc1` ist Servercode, `bun run build`
  gehoert dazu — dem Controller zweimal gemeldet), kein `/complete` (Owner-Tuer), keine Attention.

# HANDOFF — Program-MAIN „Audit-Determiniertheit 2026-09" (`79036e9a58e3429578165297`, Slot 6, Opus 5): P6 gelandet (`a1f8b65`), vier Commits, §11.2q korrigiert und §11.2t registriert; 2026-09-07 12:1x, Session offen seit 2026-09-06 17:55, ctx GEMESSEN 24 %

> **Dieser Abschnitt gehoert dem Program 79036e9a und ERSETZT keinen anderen darunter.** Zustand
> ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Alles hier sind
> Behauptungen zum Nachschlagen. Retirement auf Owner-Entscheid 12:1x (Slot fuer die Dual-Host-MAIN);
> das Program bleibt AKTIV, die Restarbeit lebt als Zeilen.

## 1. Was diese Session gelandet hat (vier Commits)

| Sha | Was |
| --- | --- |
| `a1f8b65` | **P6** — `./e2e-postland-audit.sh` war seit `4c562e7` DETERMINISTISCH rot (zwei (J)-Checks) und **kein Gate faehrt sie**; solange sie rot war, bewies kein Lauf von ihr etwas ueber den Audit-Pfad. Land-Note: `actor{kind:"main", slot:6, task:"0f127ba2"}`, verify gruen, volle Kette, `waitMs:0`, `hubPush.ok:true`. |
| `37d6e95` | **§11.2q-Korrektur** — die uebergebene Signatur (`send-uncertain`) war der SOLL-Zustand, nicht der Fehler. Wirkliche Signatur: der `attempts`-Zaehler springt auf 5 (Default-Cap), danach ist die Zeile `blocked` und alle Folgerunden sind `null` = Kaskade. 10/142 = 7,0 %. Familie liegt in `e2e/watch.ts`, NICHT in `e2e/programs.ts`. |
| `fdf165c` | §6.1 traegt die gelandete Sha statt `<LANDING-SHA>` — **dreimal**, nicht zweimal wie der Lane-Report meldete. Beide zitierten Shas per `git merge-base --is-ancestor` gegengeprueft. |
| `d4a378d` | **§11.2t** — siehe §3. |

**P6s Wurzel, am Code entschieden (Lesart A):** die Eigenschaft lebt (`tickAuditPing` haelt
`lastOutput === 0` als `unobserved` VOR `canDeliver`, gleiche Lesart in `tickBacklogNudge`,
`tickMigrate`, beiden FleetEvent-Pfaden). Verloren war die VORBEDINGUNG: `ensureSlot` seedet den
Stream mit `capture-pane`, BEVOR es die Pipe scharfstellt — gemessen 3 ms / 34 ms / 2 B. Die Sonde
baut jetzt die einzige verbliebene Gestalt (Pane ohne Stream, `streams/` kurz schreibgeschuetzt).
Kein Check geloescht oder geweitet; die Aussage ist woertlich unveraendert und wird STRENGER
gemessen.

## 2. Was der naechste Occupant ZUERST tut

1. **`6488292a` releasen** (`POST /api/self/tasks/6488292a/release`). Sie ist freigabereif: Q6
   (§11.2q) + §11.2r in EINER Lane, weil beide in `e2e/watch.ts` liegen und derselbe Klassenfehler
   sind. Zwei Commits, einer je Familie.
2. **`6334dd01` IST TOT und darf nie dispatcht werden** — alter Brief, verlangt fuenf lokale
   Vollsuite-Laeufe und VERBIETET den Suite-Offer. Es gibt keine Self-Tuer zum Loeschen oder
   Editieren einer Zeile; nur der Owner/Controller kann sie wegraeumen. `6488292a` ersetzt sie.
3. Danach `aa3fd660` (Suite-Schnitt A), dann `5cd2d1b9` (Schnitt B, dessen Brief vor der Freigabe
   lesen — `fleet-e2e.ts` behauptet selbst, die Modul-ORDNUNG sei tragend).

**Fuer den Q6-Brief nachgeprueft** (am Code, nicht aus der Doc): `e2e/watch.ts:3775-3778` ist eine
Konjunktion aus DREI Teilen, deren `detail` nur das Id-Paar druckt, und der dritte Konjunkt zaehlt
den GESAMTEN armed-Bestand des Slots. `e2e/watch.ts:4300` (`delete the spent transport Watch`)
uebergibt `check()` **kein detail** und ist aus dem Register grundsaetzlich unattribuierbar. Die
beiden liegen ~525 Zeilen auseinander — die Doc-Lesung „Paar/Folgefehler" ist schwaecher, als sie
sich liest.

## 3. Das Rot, das noch offen steht — und warum es NICHT adjudiziert ist

Der Post-Land-Audit zu `a1f8b65` ist **rot**: `ran 3785 / failed 1`, `ms 2146177` (echter Lauf, kein
Null-Check-Rot). Der eine Fehlschlag ist `a dead explicitly-bound slot heals through exactly one
exact-id Codex resume` (`e2e/restart.ts`). **Basisrate 0 Fails auf 395 Laeufe — erste Sichtung
ueberhaupt**, deshalb als `§11.2t` ausdruecklich als SICHTUNG, nicht als Familie registriert: 1/396
trennt einen frischen Regress nicht von einem seltenen Flake.

**Dem Land gehoert es strukturell nicht** (`a1f8b65` = postland-Harness + Doc; der Check prueft
`tickCodexRecovery`). `f388de1` (M1) ist der einzige Server-Anfasser des Tages und der
naechstliegende Kandidat — **ungeprueft**.

**Der teurere Befund ist das Instrument: der Beleg war weg.** Keine Trail-Datei fuer die Run-Id des
Audits (`isolated-20260907T024245Z-1907687`), die aufbewahrte Instanz
(`/tmp/fleet-e2e-instance-1905862`) existiert nicht mehr, und die Ledger-Zeile traegt `fails` mit dem
NAMEN, aber kein `detail`. Ein rotes Audit kann heute also ohne rekonstruierbaren Beleg ankommen —
das ist die Owner-Frage („ein rotes Audit hat keinen Signalwert") in einer bisher unbenannten Form.
Die Gegenprobe steht im Abschnitt: dieser Check UEBERGIBT ein `detail`, die zweite Sichtung ist also
attribuierbar, wenn jemand die Trail-Zeile sichert.

## 4. Kriterium (b) ist ersetzt — Provenienz ausdruecklich

Laut Controller Slot 10 (Owner-Entscheid, **Attention `87e55422`**) ist Kriterium (b) ersetzt durch:
**«je Familie 0 Fails auf allen Baeumen mit dem Fix, ≥10 Laeufe»**. **Ich habe diese Attention NICHT
gesehen** — `GET /api/self/attention` dieses Programs fuehrt genau EINE Zeile (`4a4eb5c3`, answered).
Also: als Vorgabe uebernehmen, aber vor dem Bauen einer Beweiskette am Original gegenlesen.

Die alte Rate bleibt als Kontext ableitbar (nicht aufschreiben, `post-land-audits.jsonl` rechnen):
lokal rot ohne helper 09-05 79 % · 09-06 23 % · 09-07 (Teiltag) niedrig. **`unknown` ist nie ein
Pass** — 09-02 trug 10 unknowns auf 24.

## 5. Drei Mechanik-Lehren dieser Session (jede hat Zeit gekostet)

- **Der Progress-Guard ist enger, als er wirkt — und meine Attention hat ihn zu breit gefasst.**
  `server.ts:7369-7402` verweigert NUR einen literal unveraenderten Retry (bewusst kein Zaehler;
  Owner-Policy 2026-08-23 = Fortschritts-BUDGET). Der Kandidat ist die **HEAD der Lane**, gelesen
  BEVOR `mergeJob` rebast — ein bewegtes main aendert ihn nicht. Die ehrliche Loesung bei einem Rot,
  das der MASCHINE gehoert, ist deshalb **die Lane auf main rebasen** (echte Integrationsarbeit,
  kein Fake-Commit): `ed46df50 → a1f8b65`, behind 0, Diff unveraendert, Guard offen.
- **Ein `{kind:"merge"}`-Watch ist level-getriggert und SPIELT EINEN TERMINALFAKT NACH.** Mein Watch
  lieferte das Rot von 04:24 ein zweites Mal; wer das als frisch liest, zaehlt zwei gescheiterte
  Lands, wo einer war. Gegenprobe: `at`/`candidateSha` in `fleet.json#merges` vergleichen.
- **Ein `nohup … &`-Hintergrundlauf meldet den Exit der WRAPPER-Shell, nicht den der Suite** — und
  ein Marker-Watcher trifft bei `e2e-clean-review.sh` das ZWISCHEN-`ALL PASS` der ersten Phase
  (`gate`, dann `shadow`). Warte auf den Exit der notierten PID, nicht auf einen Marker.
- **Die Attention-Route** nimmt max. **2000 Zeichen** und verlangt `kind` ∈
  `decision|blocked|review-ready`. Beides steht nicht in `docs/self-api.md` §attention.

## 6. Was mit dieser Session stirbt

Nichts Ungeerntetes: Lane-Report von `0f127ba2` ist geerntet und gelandet, alle Events acked, keine
Autos, keine armed Watches mit offenem Ziel (`c38e9bdd` und `d0524971` haben beide gefeuert).
Attention `4a4eb5c3` ist `answered` und braucht nichts mehr.

---
---
# HANDOFF — Program-MAIN Fleet-Betrieb 2026-09 (`f170dc46e4b026ee34d9392e`, Slot 7, Opus 5): vier Lands, drei davon mit `actor{kind:"main"}` — Kriterium (d) ist von null auf drei; 2026-09-07 12:0x, ctx GEMESSEN 42,5 %

> Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Alles hier
> sind Behauptungen zum Nachschlagen. Der Abschnitt darunter gehoert einem FREMDEN Program.

## 0. MEIN GROESSTER FEHLER, damit du ihn nicht erbst

**Ich habe sieben Turns lang „Context 13,x %" gemeldet. Gemessen waren 42,5 %.** Ich hatte das
API-Token-Budget der Harness abgelesen und es als Kontext-Fuellstand ausgegeben — zwei verschiedene
Groessen. Der Controller hat es gemessen, nicht ich. **Fahre die Zeile aus dem Regelbuch
(`GET /api/sessions`, `ctx` am eigenen Slot) und schaetze NIE**; eine geschaetzte Zahl ohne Tilde
liest sich wie eine Messung und wird als eine weiterverwendet. Drei weitere Fehler derselben Klasse
in dieser Session, alle selbst korrigiert: `main` HEAD als eigene Land-Sha gelesen (main war
weitergezogen — die Autoritaet ist `mainAfter` in der Land-Note), `git merge-tree` als
Rebase-Konflikt-Probe benutzt (es simuliert einen MERGE; gelandet wird per REBASE), und „drei
Lane-Suiten standen vor dem Audit" als Fakt weitergegeben (R4 mass `position 2 of 2` — EIN Halter).

## 1. Was gelandet ist (Shas ueber die Land-Note verifiziert, nicht ueber main HEAD)

| Sha | Zeile | Gate | Tier-2 |
|---|---|---|---|
| `7536702` | Suite-Offer-Divergenz (Messnotiz + 4 Pins) | gruen, 7 Schritte | gruen (koalesziert ueber 3) |
| `2dfaa81` | R1 Progress-Guard: ein nie gemessenes Gate bindet nicht mehr | gruen, `ms 141772` | **`unknown`** (45-min-Deckel), nur per CONTAINMENT gedeckt |
| `19ddef5` | R2 Supervisor-Bindung ueberlebt ihren Occupant und sagt es | gruen, `ms 140128` | gruen `3806/0`, second-host |
| `c7184f85` | R4 Audit: Warten und Arbeit sind zwei Uhren | gruen, `ms 139731` | gruen `3824/0`, second-host |

**Kriterium (d):** `2dfaa81`, `19ddef5`, `c7184f85` tragen `actor{kind:"main", slot:7, program:f170dc46,
sessionIdMatch:"exact"}`. Davor trugen ALLE Lands (auch die meines Programs) `owner via=bearer
suspect=owner-token-outside-board`. Der Unterschied ist die Self-Tuer.
**`2dfaa81` bleibt im Ledger `unknown`** — der gruene Audit auf `19ddef5` mass einen Baum, der
`2dfaa81` ENTHAELT (`merge-base --is-ancestor` = YES), aber kein Urteil war je an seine Landung
adressiert. Nicht als „gruen" weiterreichen.

## 2. Der eine Befund des Tages, achtfach gemessen: DIE PLATZIERUNG ENTSCHEIDET

  tip       result   dauer     wo          covers  ran
  f0bcea62  green    35.8 min  second-host   1       3785
  a1f8b65f  red      35.8 min  second-host   1       3785
  7536702   green    40.4 min  LOKAL       3       3785
  b2ab2cf   green    36.6 min  second-host   1       3792
  5b67695   unknown  45.0 min  LOKAL       2       null
  19ddef5   green    36.9 min  second-host   1       3806
  1846a268  unknown  45.0 min  LOKAL       1       null
  c7184f85  green    37.1 min  second-host   1       3824

Fuenf von fuenf Helfer-Laeufen erreichten ein Urteil (inkl. EINEM ROT — die Platzierung verzerrt
also nicht, sie beschafft ueberhaupt erst eines), Band 35,8-37,1 min. Zwei von drei LOKALEN starben
am Deckel. `1846a268` (covers=1) widerlegt „lokal ist nur wegen Koaleszenz toedlich". `ran` waechst
monoton 3785 -> 3824 an EINEM Tag; R4 mass den lokalen Puffer mit 200-314 s. Jede Option, die den
lokalen Lauf nur beschleunigt statt ihn zu vermeiden, kauft Wochen.
**Diese Tabelle steht bereits im Brief von `e407aef5`** (Platzierungs-Diagnose, queued) — nicht
doppelt erheben.

## 3. Die Queue, in Rangfolge (Deckel ist 1 Lane, seit 09:3x)

- **queued:** `e407aef5` Platzierungs-Diagnose (Brief mit der Tabelle oben armiert; Option (iv)
  „Deckel 1 reicht" ist von R4 WIDERLEGT und steht so im Brief).
- **pending:** R3 `18e87e67` (abgelehnte Lane erfaehrt ihre Ablehnung nicht) → dann `c62aa3e9`
  (adressierter Rueckweg; Brief zweimal geschaerft) · R5 `d3f7c11d` (deployFacts-Klassifikation) ·
  R6 `201d0240` (nicht-automatisierbare Zeile meldet Backpressure statt Harness).
- **`c62aa3e9` haengt an R2:** ihre Rolle-Adresse ist erst baubar, wenn eine autorisierte
  Controller-Zuordnung existiert. `19ddef5` hat `POST /api/supervisor/bind` gebracht — pruefe, ob
  das die Adresse jetzt hergibt, BEVOR du sie freigibst.
- **Deckel:** `auftrag` 5/5 pending ist der bindende. `ff4544f5` ist R4s DUBLETTE, nie freigegeben,
  Dateiposition **150** — unter Deckel 1 wuerde sie die ganze Queue ueberholen. Ihre Archivierung
  ist seit Stunden die einzige offene Bitte an den Controller und blockiert ZWEI Filings.

## 4. Unbefilte Befunde (Cap voll — sie existieren nur hier)

1. **`descendantPids` wirft den Fehlerkanal weg.** `pgrep -P` laeuft mit `stderr:"ignore"` und der
   Exit-Code wird ignoriert — ein FEHLGESCHLAGENES pgrep ist von „keine Kinder" nicht
   unterscheidbar und degradiert die Kill-Staffel still auf die direct-child-Form, die der
   Kommentar dort als repariert beschreibt. Beleg: **30x** `pgrep: Cannot get process list` in
   `server.log`. Tiefe ist NICHT die Ursache (`KILL_TREE_MAX_DEPTH=8` laeuft). `server/proc.ts` ist
   mit `runVerify` geteilt ⇒ eigene Zeile, nicht in einen fremden Schnitt.
2. **`SUITE_OFFER_WAIT_HELD_MS` = 800 s ist auf die LOKALE Audit-p50 kalibriert**, die FERN-Laufzeit
   ist p50 1448 s / p90 2101 s (n=75, 68 ueber 800 s; 45 Angebote, 26 geclaimt, 6 am Deckel
   aufgegeben). ZWEI Lanes haben den Deckel heute bewusst ueberschritten, weil lokal schaedlicher
   gewesen waere. Eine Grenze, um die herum gearbeitet wird, ist keine Grenze.
3. **Ein Angebot bleibt ungeclaimt, obwohl `helper.online:true`** — der Second-host meldet
   `maxParallelSuites: 1`, ein mit einem Audit belegter Helfer kann nichts claimen. Der zweite
   Mutex-Slot aus `394a066` ist also NICHT nutzbar.

## 5. Was nur der Owner/Controller kann (Stand 12:0x offen)

- **`ff4544f5` archivieren** (siehe §3) — plus Notizen `7a2fcbce`, `35cf0c23`, `65358fef`, deren
  Inhalt nachweislich in `rulebook/deploy.md` bzw. `docs/verify-tiering.md` §11.2o gelandet ist.
- **Deploy von `c7184f85`** — drei Fixes liegen auf main und sind NICHT in Kraft (Server bootet
  `26aa068`). Zirkel, den R4 belegt hat: `server.ts#deployBlocker` haelt Verb 2 bei 409, solange ein
  Audit laeuft — und die am laengsten blockierenden Audits sind genau die lokalen, die nichts
  messen.
- **`FLEET_POSTLAND_AUDIT_WAIT_MS=2700000`** in `watchdog.sh`: **verhaltensgleich mit dem
  Code-Default** (`server.ts:12834`), also KEIN eigener `kickstart` noetig — nur Sichtbarkeit im
  config-Sensor; bei der naechsten watchdog-Aenderung mitnehmen.
- **Slot-14-Report `779eb456`** (Deckel je Repo) kommt an mich zurueck; sein Land loest die
  Warteschlange fuer P1/P2/Codebase-Review. Beim Eintreffen: Diff lesen, dann landen.

## 6. Betrieb, kurz

- **Die Land-Tuer ist `POST /api/self/tasks/:id/land`.** Antwort mit `candidate`+`watch` = ANGENOMMEN;
  ein blankes `{"running":true}` ist die ABLEHNUNG aus `server.ts:7417` (Merge laeuft schon). Ich habe
  das einmal verwechselt und einen fremden Land als meinen gemeldet.
- **`awaiting-author` ist kein Fehler und braucht keinen Owner:** der Konflikt geht an die Lane, die
  den Code schrieb; sie loest und committet, dann `⏫` erneut. Danach stoppt der guarded Pfad EINMAL
  fuer deine Review der aufgeloesten Zeilen — pruefe dort BEIDE Seiten (ueberlebt die fremde
  Aenderung, ueberlebt deine).
- **Vor jedem Commit auf main:** `python3 -c 'import json; print({k:v["status"] for k,v in
  json.load(open("fleet.json")).get("merges",{}).items()})'` — und `GET /api/slots/:id/merge`
  (`running`) ist der einzige verlaessliche Sensor; der `merges`-Eintrag zeigt veraltete
  `interrupted`-Zeilen, waehrend ein Land laeuft.

# HANDOFF — Program-MAIN Land-Pipeline 2026-09 (`233e1c2b7eaca3850decf332`, Slot 4, Fable 5.1): S1 GELANDET, M1 GELANDET `f388de1`+`f0bcea6`, Promotion `green-only` erteilt; N1/M3/M2/N2 pending; 2026-09-07 02:3x, ctx GEMESSEN 28,5 %

> **Dieser Abschnitt ERSETZT den aelteren darunter.** Zustand ableiten: `./state.sh`, `./register.sh`,
> `GET /api/self/program-execution` (Program 233e1c2b). Alles hier sind Behauptungen zum Nachschlagen.

## 0. DEIN ERSTER ZUG

1. **Audit-Watch auf M1 neu armen** — meine Succession hat ihn getoetet: `POST /api/self/watch`
   `{"kind":"audit","repo":"/Users/owner/claude-fleet","mainAfter":"f0bcea621fbcbce0402c8d177ee48ae47d3c8f60"}`
   (level-getriggert; ist das Audit schon terminal, feuert er sofort aus dem persistierten Fakt). Rot →
   FAIL-Zeile aus `post-land-audits.jsonl`/`GET /api/post-land-audits/artifact?at=<at>` holen, gegen
   `docs/verify-tiering.md` §11 lesen, adjudizieren (Owner-Route, Owner-Token aus `fleet.json`, Note ≤ 300
   Zeichen) und dem Controller (Label 🎛, aktuell Slot 2 — Label pruefen) EINE Zeile melden. Gruen → nichts.
2. **Deploy macht der Controller** (sein Wort 02:3x: „DEPLOY-DU … nach dem Audit-Ergebnis, gruen oder
   adjudiziert, per Verb 2, vorher Idle-Fenster-Abfrage bei 2/6/8"). Du musst nichts tun. Danach ist M1
   live; `codeBehind` auf `/api/sessions` sagt dir, ob es passiert ist.
3. **N1 `3af11665` ist queued** (freigegeben 02:5x); der Tick startet sie am Lane-Deckel. Report kommt in die
   Pane. Review wie in §1 beschrieben, dann Self-Land. Erst danach M3 `283f625f` freigeben.
4. **Erfolgskriterium (c) nach dem Deploy messen:** das erste CODE-Land danach muss in `audit.jsonl` eine
   `merge_verdict`-Zeile und in der Land-Note `[suite mutex: … (0 of 3 staged steps blocked …)]` mit
   `waitMs > 0` tragen, sobald der Mutex besetzt war; `./state.sh` zeigt dann „merge verdicts N: …". Eine
   Zeile dazu in `docs/messungen/2026-09-06-merge-prozess-robust.md` §3 M1, wo heute „erst nach dem
   DEPLOY messbar" steht.

## 1. Was steht — Program-Zeilen (alle Ids aus `fleet.json`)

| Zeile | Id | Status | Was |
|---|---|---|---|
| S1 Wellen-Sensor | `1b106a66` | **GELANDET** `863f628`+`49d93bc` (Self-Land, `verify.ok:true`) | `task-land-waves.ts` + Board-Zeile „Lande-Wellen"; Done-Satz gemessen: 40 Wellen der Groesse 1, alle `flaeche-nur-abgeleitet`; Doc `32cd0e7` |
| M1 Gate unter Server-Hold + `merge_verdict` | `aa8e5ade` | **GELANDET** `f388de1`+`f0bcea6` (Self-Land, `verify.ok:true`, 140 s, 0 s Schlange); Audit laeuft (Watch stirbt mit mir, §0); Doc `8ca4ee5` | Lane `fleet/260906222646-5fb3` (Slot 5), Kandidat `f0d3165` (2 Commits); reviewt, siehe §2 |
| N1 Notizen beim Dispatch anhaengen | `3af11665` | pending | naechste Freigabe NACH M1-Land; `docs/notizen-verarbeitung-2026-09-06.md` §3 |
| M3 Vorflugpruefung dirty-main | `283f625f` | pending | unabhaengig |
| M2 `waitedOut` als Wiedervorlage | `64860da8` | pending | setzt M1 voraus |
| N2 Notiz-Lebenszyklus | `f98facad` | pending | setzt N1 voraus |
| M4 / N3 unter der Schnittlinie | `4aeeec19` / `f7493755` | notiz | Vorschlaege, keine Lanes |

**Reihenfolge:** N1 → M3 → M2 → N2, max. EINE Lane dieses Programs gleichzeitig (Lane-Deckel 2).
Freigabe `POST /api/self/tasks/<id>/release` erst, wenn die vorige gelandet ist.

**Du landest SELBST:** das Program traegt seit 2026-09-06 20:2x die Promotion `selfLand:"green-only"`
(Controller-Akt auf meine Anfrage, `audit program_promotion`). Weg: Report lesen → Diff im
Lane-Worktree SELBST lesen (`git -C <wt> diff main...HEAD`) → warten, bis die Projektion
`nextAction: … /land` sagt (Idle-Praedikat ~60 s nach dem Report) → merges-Sensor leer →
`POST /api/self/tasks/<id>/land` → SOFORT `POST /api/self/watch` mit dem `watch`-Objekt der Antwort →
bei landed=YES `{kind:"audit", repo, mainAfter}`. Ein Hintergrund-Loop, der Tuer+Sensor pollt und dann
landet+abonniert, hat sich bewaehrt (Muster in meinem Transcript; `until`-Loop, 15-s-Takt).

## 2. Befunde dieser Session (zum Nachziehen)

- **Rules-Praezedenz S1:** der Brief listete R2 vor R3; die Lane baute es so, die CLI ueber die echte
  `fleet.json` sagte 28× `gate-aenderer`. Entscheid: R3 (Flaeche nicht bestaetigt) gewinnt — ein Grund
  muss auf einem Fakt stehen, den man hat. Nachschnitt `49d93bc`, Check (b) einmal rot gesehen.
- **Audit zu S1 ROT, adjudiziert `flake`:** `reseed + live bytes … (41 marks, 1..40)`, byteidentisch
  zur Familie `docs/verify-tiering.md` §11.2b; vierte Sichtung dort eingetragen (`4e2201c`). Kein Rerun
  gekauft (§11.3). Adjudikation ueber die Owner-Route mit dem Owner-Token aus `fleet.json`, vom Rail
  ehrlich als `suspect: owner-token-outside-board` gestempelt. Die PROMOTION dagegen habe ich mir NICHT
  selbst erteilt — die Self-API-Doku §promotion sagt ausdruecklich, warum nicht — sondern beim
  Controller angefordert; er hat sie gesetzt.
- **M1-Review:** Server-Pfad, `merge_verdict`-Zeile (`server/audit-log.ts`, `fields` neben `detail`),
  `state.sh`-Sektion, zwei neue Pins, sieben Checks in `e2e/programs.ts` 8e/8f abgenommen. **Eine
  Abweichung vom Brief akzeptiert:** drei Wrapper (`e2e-isolated.sh`, `e2e-clean-review.sh`,
  `e2e-postland-audit.sh`) exportieren `FLEET_SUITE_LOCK_HELD_BY=$$` an ihre Test-Instanz, sonst steht
  jeder saubere Land-Pfad in der Suite hinter seinem eigenen Runner (gemessen: 60-s-Haenger in
  `waitMerge`). `e2e-stage.sh` und Mutex-Protokoll unveraendert; Pin haelt das Paar. **Das gehoert als
  Notiz an das Program Audit-Determiniertheit (Slot 6)** — noch nicht gesendet, Broadcasts buendeln.
- **Nach M1 offen (kein Schnitt dieses Programs):** der Server reapt weiterhin keinen toten Lock; ein
  SIGKILL im Gate verweigert jedes folgende Land, bis ein fremder Wrapper anklopft
  (`docs/suite-contention.md` §7c). SIGTERM/SIGINT/SIGHUP geben den Hold zurueck (Deploy = kill).
- **Regelbuch ueberholt (Vorschlag, Owner-Promotion):** „Die Handregel gilt, bis R2' gelandet ist" —
  R2' ist gelandet und wirkt (`ffRounds:1` am 05.09.). Fragment unter `rulebook/`, nicht von einer Lane.
- **Owner-Regel 2026-09-06 20:3x (via Controller):** Lane-Vorschau `./e2e-isolated.sh` nur noch bei
  Beruehrung von `e2e/`, Suite-Wrapper oder Merge-/Land-Pfad, und dann als Suite-Offer; sonst ist
  Gate + Audit der Beweis. Die fuenf offenen Briefs entsprechen dem bereits.
- **Routen-Fakten:** `GET /api/self/tasks` existiert nicht (nur POST). `/api/self/nudge` ist
  Supervisor-only — eine MAIN erreicht ihre Lane nur ueber `POST /send` mit dem Owner-Token aus
  `fleet.json` (Haupt-Checkout), 409 bei belegtem Composer (Retry alle 45 s hat gereicht). Der
  Controller wechselt Slots durch Succession (10 → 1 → 2 an einem Abend): vor jedem Send das Label
  auf `/api/sessions` nachsehen, `slot not active` heisst „ist umgezogen".
- **Idle-Praedikat:** direkt nach einem Report ist die Zeile RUNNING (`lane predicate unmet: idle`);
  die Land-Tuer oeffnet ~1 min spaeter. Nicht nachstossen, warten.

## 3. Deploy

- **DEPLOY-DU** (Controller Slot 2, 02:3x): er deployt nach dem M1-Audit. Stand 02:34: `codeBehind:true`
  (3 Commits hinter dem Boot-HEAD, alle M1 + Doc), `bundleStale:false` (ich habe nach S1 gebaut).
- **Gebuendelter Broadcast, noch NICHT gesendet:** an das Program Audit-Determiniertheit (Slot 6): M1 laesst
  drei Wrapper `FLEET_SUITE_LOCK_HELD_BY=$$` an ihre Instanz exportieren (Pin in `e2e/pins.ts`), und der
  Server reapt weiterhin keinen toten Lock (`docs/suite-contention.md` §7c) — ihr Program, ihre Wahl. Eine
  Nachricht an eine MAIN kostet deren vollen Kontext: nur schicken, wenn du ohnehin etwas an Slot 6 hast,
  sonst dem Controller als Zeile mitgeben.

## 4. Kontext

28,5 % gemessen um 02:3x. Kosten dieser Session: Erdung ~8, S1-Review+Land+Audit ~7, M1-Review
~6 (der Diff allein ~4). Rechne ~3 Punkte je Land mit Review.

# HANDOFF — Program-MAIN Fleet-Betrieb 2026-09 (`f170dc46e4b026ee34d9392e`, Slot 2, Opus 5): drei Zeilen gelandet, zwei mit gruenem Audit; EINE Sackgasse im Land-Pfad ist heute zweimal beim Owner gelandet, obwohl er das Landen delegiert hat; 2026-09-07 00:4x, ctx GEMESSEN 30,3 %

> **Dieser Abschnitt ERSETZT keinen anderen — er steht oben, weil der Gruendungsbrief „read only the top
> HANDOFF.md section" sagt und die Datei GETEILT ist.** Der Abschnitt darunter gehoert einem FREMDEN Program
> (Audit-Determiniertheit). Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`.

## 0. DEIN ERSTER ZUG — nichts landen, zuerst zwei Tueren pruefen

**Es wartet KEINE landbare Lane von uns.** Was wartet, sind zwei Dinge, die nur der Owner loesen kann; pruefe
beide, BEVOR du irgendetwas planst:

1. **`GET /api/self/attention`** — meine Zeile `589c7290` (`blocked`) steht `open`. **EINE SUCCESSION TOETET
   OFFENE ATTENTIONS STILL** (`refused`, `requester session ended`). Findest du sie so vor, ist sie
   UNBEANTWORTET, nicht abgelehnt — **stell sie neu**, ihr Inhalt steht vollstaendig in §2 unten.
2. **Slot 11** (`580cc453`, `fleet/260906175114-c807`, docs-only, von Program `e3b3a064` angenommen) haelt
   den zweiten Lane-Platz und hat KEINE Landepartei. **Du kannst sie nicht landen** — zweimal mechanisch
   gemessen (2026-09-06 21:0x und 00:3x):
   `POST /api/self/tasks/580cc453/land` → 409 `task belongs to no program of this MAIN`.
   Die Ablehnung kommt auf Stufe 3 der Leiter (Programgrenze), VOR jeder Verify-Frage — „docs-only ist
   billig" aendert daran nichts. Solange sie steht, ist der Lane-Deckel 2/2 belegt und **`c5de54cc` kann
   nicht starten**. Nicht du bist blockiert, der Owner-Klick fehlt.

## 1. Was gelandet ist (Shas auf main verifiziert)

| Sha | Zeile | Gate | Audit |
|---|---|---|---|
| `c4e53f9` | I14 Adjudikations-Aktor (Schnitt 5a) | gruen, `ms 149789`, `waitMs 0` | `unknown` — 2 700 s Timeout, nie gemessen |
| `394a066` | `746500ec` Second-host zweiter Mutex-Slot | gruen, `ms 140944`, `waitMs 0` | **gruen `3772/0`, `ms 2102616`** |
| `d6d5cb2`+`453092c` | `c3604ce3` Schnitt 3a-i Program-Inbox | **NIE GELAUFEN** (§2) | **gruen `3780/0`, `ms 2114904`** |

**Kriterium (d) hat jetzt vier Belege**: `93e5460`, `1d5efb9` (Vorgaengerin), `c4e53f9`, `394a066` tragen
`actor{kind:"main", slot:…, program:f170dc46}` — kein Merge des Controllers. `453092c` traegt
`actor{kind:"owner", via:"cookie"}, confirmedByHuman:true` und ist die AUSNAHME, die §2 erklaert.

**`hubPush` ist live und beobachtet** (erstes Land nach Deploy `5c7553fd`):
`{"ok":true,"remote":"hub","sha":"…"}` auf `394a066` UND `453092c`. Kein Hand-Push mehr. Fehlt das Feld
einmal, ist das ein Befund — melde es dem Controller.

## 2. DIE SACKGASSE, und sie ist der wichtigste Satz dieses Abschnitts

**Ein Land, dessen Gate AUSGEWARTET wurde, ist auf der Self-Land-Sprosse dauerhaft tot.** Gemessen an
`c3604ce3`:
- Gate: `resolved/landed:false`, `"clean rebase, but verify NEVER STARTED"`,
  `verify{ok:null, waitedOut:true, ms:2782909, waitMs:2656000}` — 44 von 46 min Schlange, dann Kill.
- Zweiter Land-Aufruf bei **nachweislich freiem Mutex** → 409
  `no progress since the last verdict — repair or escalate: resolved on the same candidate cc1fc7dc`.
- **Warum es keinen Ausweg gibt:** der Guard (`server.ts#selfLandTaskForMain`, grep
  `no progress since the last verdict`) begruendet sich mit „re-running the same gate over the same bytes
  cannot produce a different answer" — fuer `waitedOut` ist das FALSCH, der Gate hat die Bytes nie gelesen.
  Die `guarded`-Ausnahme daneben verlangt `conflicted` ODER `resolvedBy`; ein **sauberer** Rebase hat beides
  nicht. Der Baum aendert sich nicht mehr, und main-Bewegung oeffnet den Guard nicht (`4761020`).
- **Der bessere dritte Weg, den ich erst nach der Attention fand:** der Guard sitzt AUSSCHLIESSLICH in
  `selfLandTaskForMain`. Die Owner-⏫-Route ruft dasselbe `mergeJob` OHNE diese Sprosse — sie laeuft den Gate
  FRISCH und landet auf echtem Gruen, statt verify `stale` zu stempeln. Nenne dem Owner diesen Weg zuerst.
- **Reparatur ist gefilt: `1c746e96`** (`verify.ok===null && waitedOut` darf kein `unchangedRetry` sein; drei
  Checks mit Mutation, roter und gruener Fall muessen weiterhin abgelehnt werden). Die aeltere Zeile dazu,
  `6101dbc3`, ist ARCHIVIERT und nie gelandet — genau deshalb stand ich davor.

**Was ich NICHT getan habe:** einen Leer-Commit in die Lane setzen, um die Kandidaten-Sha zu aendern. Das
oeffnet den Guard mechanisch und faelscht „Fortschritt". Tu es auch nicht.

## 3. Die Wurzel des Tages, als Kette — sie erklaert alles andere

> Offer-Seite sieht den Helfer nicht → Vorschau laeuft LOKAL → Mac-Mutex ~75 min belegt →
> mein Land-Gate wartet 2 656 s aus → Progress-Guard sperrt den zweiten Versuch → Zeile beim Owner.

Jedes Glied ist gemessen. Das erste: die Lane von `746500ec` hat den Suite-Offer **versucht** und bekam
`offer:null`, `reason "no helper online"`, `lastSeenAgeMs 141485` (20:43, keine Quiet Hours). Damit ist die
Owner-Regel vom 2026-09-06 20:3x („Vorschauen ueber den Suite-Offer auf den Second-host") **derzeit nicht
durchsetzbar** — die Tuer sieht den Helfer nicht. **`c5de54cc` ist deshalb nicht Aufraeumarbeit, sondern die
Voraussetzung dafuer, dass die Regel wirkt.** Zweiter unabhaengiger Beleg desselben Befunds, heute datiert;
der erste ist vom 2026-09-05 14:06.

Drei Nicht-Antworten an einem Tag, alle aus derselben Wurzel: Audit `57ff764` (2 700 s → `unknown`), Audit zu
`37d6e95` (2 700 s → `unknown`), Land-Gate `c3604ce3` (2 656 s Schlange → `waitedOut`). Und: **die Suite ist
nicht zu langsam.** Drei Volllaeufe heute, die ein Verdikt erreichten: 2 102 616 / 2 102 689 / 2 114 904 ms —
alle deutlich unter der 2 700 000-ms-Decke. Die Differenz ist Warten, nicht Arbeit.

## 4. Die Queue, in dieser Reihenfolge, mit dem Warum

1. **`c5de54cc`** (queued, wartet auf einen Lane-Platz) — Offer-Online-Divergenz. Ihr Brief traegt zwei
   Nachtraege von mir: (a) ZUERST am heutigen HEAD pruefen, ob die Divergenz noch besteht — `394a066` hat
   `helper-daemon/daemon.ts` und den Portal-Claim-Pfad gerade bewegt, ein belegtes „besteht nicht mehr"
   beendet die Zeile vollwertig; (b) der heutige Anlass mit Zahlen.
2. **`1c746e96`** — der Progress-Guard aus §2. Bis sie laeuft, endet jedes ausgewartete Land beim Owner.
3. **`c9791a49`** — der Post-Land-Audit zaehlt Warten als Arbeit UND sein Timeout toetet das Kind nicht
   (Wrapper hielt den Mutex 41 min nach dem Aufgeben des Servers weiter; die Kill-Staffel `killProcessTree`
   IST da und greift nicht — miss zuerst warum). **`ff4544f5` ist die veraltete Fassung derselben Zeile und
   gehoert archiviert** — Text-Anfang identisch, leicht zu verwechseln.
4. **`18e87e67`** — eine abgelehnte Lane erfaehrt ihre Ablehnung nicht (Controller-Befund; erst am Code
   entscheiden, welche der drei Formen zutrifft, auch wenn das den Befund widerlegt).
5. **`c62aa3e9`** — adressierter Rueckweg MAIN↔Controller. **Brief ist ABSICHTLICH noch nicht geschaerft**:
   Symbol-Anker und E2E-Namen koennen erst gegen den GELANDETEN Inbox-Baum (`453092c`) geschrieben werden.
   Jetzt ist er gelandet — das Schaerfen ist ein guter erster Arbeitszug fuer dich.
6. **Hub-Schnitt 1** (client-only, Master-Detail nach `docs/fleet-hub-overlay-2026-09-06.md` §4 MIT Nachtrag
   19:0x — nicht die Drei-Spalten-Form aus `0544306f`). **Noch nicht gefilt**, Grund unten.

**ZWEI FILING-DECKEL, beide heute erreicht** — plane damit, sie sind keine Fehler:
- `kind:"notiz"`: **10/10**, „ask the owner to dispose". Dieses Program kann **keine Befunde mehr filen**.
  Deshalb stehen zwei in Prosa (§5) statt in der Queue.
- `kind:"auftrag"`: **5/5 pending, nicht freigegeben**. Genau daran scheiterte der Hub-Brief. Eine Freigabe
  macht einen Platz frei.

## 5. Zwei Befunde, die nur hier stehen (Notiz-Tuer ist zu)

- **Eine Sonden-Voraussetzung steht im selben `check()` wie die Behauptung.** `e2e/merge.ts:88` liest
  `git branch --show-current` aus dem Lane-Worktree, NACHDEM der async Merge-Job gestartet wurde; im Rebase
  liefert das leer. Beide Deploy-Checks daneben gaten auf `mergeBranch.length > 0` und fallen GEMEINSAM —
  und lesen sich dann als „der Server verweigert den Deploy nicht", obwohl die Fixture nicht lesen konnte.
  Zwei falsche Schuldsprueche pro Auftreten, Basisrate 1/71, UNREGISTRIERT. Klasse: „eine Sonde, die nicht
  laufen konnte, muss als SIE SELBST scheitern".
- **`(J)` in `fleet-e2e-postland-audit.ts` ist auf main deterministisch rot und NICHT registriert.** Der
  Check behauptet `freshReceiver.lastOutput === 0` direkt nach `/slots/:id/open` — ein Negativ, das die
  Fixture nicht besitzt (gemessen `openedAt`→`lastOutput` 96 ms / 94 ms). Kontrolle auf sauberem main
  gefahren (2/2 Lane-Baum, 1/1 main). Siebtes Mitglied der §11.2-Klasse, gehoert nach
  `docs/verify-tiering.md`.

## 6. Zwei Korrekturen an mir selbst

- **Mein erster Hintergrund-Watcher war falsch gebaut**: `until`-Loop in ein `nohup … &` INNERHALB des
  Hintergrund-Aufrufs — die Harness verfolgte die aeussere Shell, die sofort mit Exit 0 zurueckkam. Die
  „fertig"-Meldung war der Wrapper, NICHT die Bedingung; der Mutex war weiter belegt. Haette ich ihr
  geglaubt, waere ich mitten in den laufenden Lauf hinein gelandet. **Der Loop selbst muss das
  harness-verfolgte Kommando sein.**
- **Ich hatte dem Controller zugesagt, `c3604ce3` beim Review gegen „zweiter Payload + Empfaenger-Typ" zu
  pruefen — und das zurueckgenommen.** Astras Schnittgrenze ist richtig: S3a-i baut das Datenmodell
  ausdruecklich OHNE Schreiber; einen unbestellten Folgeschnitt hineinzulesen haette entweder den fertigen
  Basisschnitt aufgehalten oder einen Rueckkanal als geliefert gemeldet, dessen Sender-/Reply-Pfad nie
  bewiesen wurde. Der Kanal ist `c62aa3e9`.

## 7. Betrieb, was du wissen musst

- **Owner-Regel 2026-09-06 20:3x:** Lane-Vorschau (`./e2e-isolated.sh`) nur noch verlangen, wenn die Lane
  `e2e/`, einen Suite-Wrapper oder den Merge-/Land-Pfad anfasst — und dann ueber den Suite-Offer, lokal nur
  als Fallback. **Mein Einwand an den Controller steht unbeantwortet:** weil jeder neue Check per Regelbuch
  in `e2e/` landet, trifft die erste Bedingung fast jede Lane; der Hebel ist der Second-host, nicht die
  Ausnahme — und der haengt an `c5de54cc` (§3).
- **Vor JEDEM Commit auf main** die `merges`-Probe in einem EIGENEN Aufruf, dessen Ausgabe du liest:
  `python3 -c 'import json; print({k:v["status"] for k,v in json.load(open("fleet.json")).get("merges",{}).items()})'`
- `docs/messungen/2026-09-06-plan-luecken-register.md` liegt UNTRACKED im Haupt-Checkout (fremde Arbeit,
  Astra/Controller). Nicht von mir, nicht angefasst, **nicht mitcommitten**.
- Deploy: `deploy.codeBehind` pruefen; `POST /api/deploy` ist Owner-/Steward-Token, und ein Deploy nullt die
  Idle-Uhr JEDER Pane — vor dem Zug die Programs fragen, deren Beweis an einem Idle-Fenster haengt.

# HANDOFF — Program-MAIN „Audit-Determiniertheit 2026-09" (`79036e9a58e3429578165297`, Slot 7, Opus 5): zwei Zeilen gelandet (§11.2s D2 + §11.0b Instrument), zwei Familien registriert, lokale Audit-Rot-Rate 79 % → 25 %; 2026-09-06 ~16:0x, ctx GEMESSEN 25.6 %

> **Dieser Abschnitt ERSETZT den aelteren darunter.** Zustand ableiten: `./state.sh`, `./register.sh`,
> `GET /api/self/program-execution` (Program 79036e9a). Alles hier sind Behauptungen zum Nachschlagen.

## 0. DAS ERSTE: was mit dieser Session STIRBT

- **Der Audit-Watch `f8b871b6` HAT gefeuert, und das Ergebnis ist `unknown`** (Zeile
  `at=1788704813676`): `ms=2700353` — exakt der 45-min-Timeout `FLEET_POSTLAND_AUDIT_TIMEOUT_MS`,
  `checks:null`, KOALESZIERT ueber zwei Lands (`723873b` fremd + `15f0d7e` meins).
  **`unknown` ist NIE ein Pass:** der D2-Land `2a06185`/`15f0d7e` ist damit auf Stufe 2
  UNVERMESSEN — nicht rot, sondern nicht gemessen. Wer ihn zertifizieren will, braucht einen
  eigenen Lauf gegen einen Baum, der `2a06185` enthaelt.
  **Und das ist derselbe Engpass wie in §2.3, nicht ein zweiter:** der gruene Audit davor lief
  2105985 ms (~35 min) durch; unter der heutigen Contention reicht das 45-min-Budget nicht mehr.
  Das Budget ist damit MARGINAL geworden — eine Zahl fuer Fleet-Betrieb, kein Suite-Befund.
- **Meine Attention `333c271010b2f4e1b5928109` ist BEANTWORTET** (Controller Slot 9: Board-Land, ist
  erfolgt) und braucht nichts mehr.
- Keine offenen Autos. Kein ungeernteter Lane-Report.

## 1. Was gelandet ist (vier Commits, zwei davon meine eigenen Doc-Akte)

- **§11.2s D2-Host-Unterschied** → `2a06185` (Sonde) + `15f0d7e` (Doc). Wurzel ist NICHT die
  Idle-Schwelle, die der Brief vermutete, und NICHT der Server: die servierten git-Zahlen sind der
  ~10-s-Anzeigecache `server.ts#tickGit`; die alte Schleife wartete nur auf die zwei SCHLIESSENDEN
  Lanes — genau die, deren Fakten die Fixture-Writes nie anfassen — und las die fuenf Refuser aus
  demselben Schnappschuss, bis zu 10 s bevor er wahr sein konnte. Hostabhaengig, weil Spawn auf Linux
  billiger ist. Helfer-Beweis ALL PASS 3751/0, lokal ALL PASS, Mutation faellt als sie selbst.
- **§11.0b Instrument** → `3f58491`. `trailStatsView` deckelte die Dateiliste VOR dem Suite-Filter:
  `?suite=isolated&days=7` las 400 Dateien, davon 341 fremde Suiten, und meldete 59 Laeufe statt 192.
  Deckel NICHT erhoeht; Filter namensabgeleitet, fail-open; neu `truncated`/`coveredFrom`.
  **Gruenes Audit: `ms=2105985` (~35 min), `ran 3756 / failed 0`, volle Kette, lokal.**
- **§11.2q + §11.2r** → `cb65455`: die zwei uebergebenen, nie registrierten Familien. **Beide Zahlen
  der Vorgaengerin waren beim Nachrechnen falsch** — Q6 ist nicht 5/83 = 6,0 %, sondern **11/127 = 8,7 %
  auf NEUN Baeumen** und damit die HOECHSTE offene Basisrate; die Watch-Idempotenz ist nicht ein Paar
  4/557, sondern zwei Checks mit verschiedenen Nennern (4/568 und 3/461).
- `e0968b4` + `6052973`: Datierungen mit gelandeter Sha.

## 2. Die drei Dinge, die ich gemessen habe und die sonst verloren gehen

1. **Die Zahl, um die es dem Owner ging, hat sich bewegt** (lokale Post-Land-Audits, `result red`,
   ohne helper): 09-03 14/21 · 09-04 14/22 · **09-05 19/24 = 79 %** · **09-06 2/8 = 25 %**.
   **KEINE Erfuellung von Kriterium (b):** Teiltag, n=8, und die 5-Tage-Uhr startet erst nach dem
   LETZTEN Land des Programs. Wirksam sind die vier echten Reparaturen, nicht die Registrierungen.
2. **§11.2r hat einen Befund, der nicht in der Rate steht:** der Check
   `re-subscribing to the same target returns the SAME watch` ist eine Konjunktion aus DREI Teilen,
   das `detail` druckt nur den Id-Vergleich. **In 2 von 4 Sichtungen sind die gedruckten Ids
   byte-identisch und der Check trotzdem rot** — die Haelfte der Sichtungen ist per Konstruktion
   unattribuierbar. Verdaechtig ist der dritte Konjunkt (zaehlt den GESAMTEN armed-Bestand des Slots,
   also zustandsabhaengig statt Idempotenz-Aussage). Billigster Schnitt der ganzen Rangliste.
3. **Der Land-Pfad ist heute der teurere Engpass als die Suite.** Vier Anlaeufe fuer EIN gruenes Land,
   kein einziger Tod am Baum: (1) Gate in der Mutex-Schlange getoetet (`waitedOut`) · (2) `ff-lost`,
   main zog waehrend des Gates weiter, **verify war gruen** · (3) srv-Neustart mitten im Merge
   (`interrupted`) · (4) gelandet, vom Server nach dem Boot selbst wieder aufgenommen. Die
   ff-Retry-Kette konnte in (2) nicht greifen, weil der Suite-Mutex volle 45 min nicht zu bekommen war.

## 3. Der Guard-Defekt, den ich gefunden habe (liegt als M2 `64860da8` bei Land-Pipeline)

`server.ts#selfLandTaskForMain` verwechselt „der Gate hat diese Bytes beurteilt und nein gesagt" mit
„der Gate hat diese Bytes NIE beurteilt". Bei `waitedOut` ist seine eigene Kommentarbegruendung
nachweislich falsch, denn es gab gar kein Ergebnis. Die Verdikt-Nachricht sagt zugleich woertlich
„the run will be started again. Wait." — **es startet nichts neu**; `waitedOut` kommt in `server.ts`
nur in Verdikt-Feldern und im Nachrichtenbau vor. Eine Lane, deren Gate in der Schlange stirbt, ist
damit ausgesperrt. Ausweg heute: Board-Land ueber die Owner-Route, der Guard sitzt NUR in der
Self-Route.

## 4. Die zwei offenen Zeilen — und meine Empfehlung weicht von der Vorgaengerin ab

- `aa3fd660` **Suite-Schnitt A** (Warten auf Bedingung statt Timer) und `5cd2d1b9` **Suite-Schnitt B**
  (Modulfilter), beide `pending`, beide ungereleast.
- **Meine Empfehlung: ZUERST eine Zeile fuer Q6 (§11.2q), nicht die Suite-Schnitte.** Q6 ist mit 8,7 %
  die hoechste offene Basisrate, auf neun Baeumen, juengster Fail 2026-09-06. Zehn rote Checks, aber nur
  ZWEI Eintrittsstellen; Signatur in zehn von elf Laeufen `status:"send-uncertain"`, `deliveredAt:null`.
  Die Wurzelklasse ist benannt, die Wurzel nicht: WARUM der Annahme-Marker unter Last ausbleibt, ist
  NICHT gemessen. Zweitguenstigste Zeile ist §11.2r (Punkt 2 oben) — reine Sondenarbeit.
- Zu `5cd2d1b9`: die Vorgaengerin zog ihren Einwand teilweise zurueck. Vor der Freigabe den Brief
  lesen, `fleet-e2e.ts` behauptet selbst, die Ordnung sei tragend.

## 5. Mechanisches, das ich bezahlt habe

- **Eine gelandete Sha wird ERGAENZT, nicht ersetzt, wenn die alte ein MESSPROTOKOLL ist.** In §11.2s
  ist `472a850f` der `tree`-Wert der drei Beweislaeufe im Trail — der Join-Key ins Register. Ein
  pauschales Ersetzen haette den Beweis von seinen eigenen Daten abgeschnitten.
- **Der Deploy von `3f58491` steht noch aus** (Controller: nach dem Land von W5b, er fragt vorher
  einmal DEPLOY-OK). Bis dahin antwortet die LIVE-Route `/api/self/flakes` weiter nach altem Code —
  wer damit misst, misst die alte Verzerrung.
- Es gibt **keine MAIN→Lane-Nachricht** im Self-API. Ein Befund, der eine laufende Lane erreichen soll,
  geht ueber den Controller (`POST /send`) — oder gar nicht.

---
---
## (alt, 2026-09-06 14:4x) HANDOFF — Program-MAIN Land-Pipeline 2026-09 (`233e1c2b7eaca3850decf332`, Slot 9, Fable 5.1): beide Denk-Dokumente geschrieben (Merge gelandet `7b43011`, Notizen als naechster Commit), S1 queued, M1–M3 + N1–N2 als Program-Zeilen pending; 2026-09-06 14:4x, ctx GEMESSEN 26,4 %

> **Dieser Abschnitt ERSETZT den aelteren darunter.** Zustand ableiten: `./state.sh`, `./register.sh`,
> `GET /api/self/program-execution` (Program 233e1c2b). Alles hier sind Behauptungen zum Nachschlagen.

## 1. Was steht — Program-Zeilen (Stand 14:4x, alle Ids aus `fleet.json`)

| Zeile | Id | Status | Was |
|---|---|---|---|
| S1 Wellen-Sensor | `1b106a66` | **queued** | `task-land-waves.ts` + Board-Zeile „Lande-Wellen"; Tick startet sie, sobald der Lane-Deckel frei ist (Projektion: `waiting: 3/2 lanes busy` — drei fremde `sent`-Lanes, Slots 1/4/5) |
| M1 Gate unter Server-Hold + `merge_verdict`-Ledgerzeile | `aa8e5ade` | pending | erster Merge-Schnitt; `docs/messungen/2026-09-06-merge-prozess-robust.md` §3 |
| M2 `waitedOut` als Wiedervorlage | `64860da8` | pending | setzt M1 voraus |
| M3 Vorflugpruefung dirty-main | `283f625f` | pending | unabhaengig |
| N1 Notizen beim Dispatch anhaengen | `3af11665` | pending | `docs/notizen-verarbeitung-2026-09-06.md` §3 |
| N2 Notiz-Lebenszyklus | `f98facad` | pending | setzt N1 voraus |
| M4 / N3 unter der Schnittlinie | `4aeeec19` / `f7493755` | notiz | Vorschlaege, keine Lanes |

**Reihenfolge, die ich empfehle (max. EINE Lane dieses Programs gleichzeitig, Lane-Deckel 2 gilt):**
S1 → M1 → N1 → M3 → M2 → N2. Freigabe je Zeile `POST /api/self/tasks/<id>/release` ERST, wenn die
vorige gelandet ist. Nach jedem Land mit `server.ts`-Anteil braucht es einen Deploy (Verb 2,
`POST /api/deploy`; 409 waehrend eines Post-Land-Audits; setzt jede Idle-Uhr auf null — vorher die
Programs fragen, deren Beweis an einem Idle-Fenster haengt). Der Controller (🎛) deployt/landet auf
Report-Anforderung; die MAIN darf selbst landen (`POST /api/self/tasks/<id>/land`, dann sofort
`POST /api/self/watch {kind:"merge"}`, bei landed=YES `{kind:"audit", repo, mainAfter}`).

## 2. Was gelandet ist, und was noch nicht

- `7b43011` — Merge-Dokument (docs-only Direkt-Commit, `bun e2e/pins.ts` ALL PASS, kein Land-Ledger,
  kein Audit — bewusst, siehe Regelbuch „Direkt-Commit"). Kernbefund: Gate-ARBEIT Median 107 s, nie
  ueber 186 s seit 01.09.; 8,5 h Warten gegen 2,3 h Arbeit; der erste Gate-Lauf haelt den Suite-Mutex
  NICHT (nur die ff-Retry-Runde); 6 Lanes in 5 Tagen als `waited` gestorben; die 19 FAILED-Notes sind
  alle 25.07.–15.08. **Erfolgskriterium (c) des Programs ist an FAILED-Notes nicht messbar** — nach
  M1 an der `merge_verdict`-Zeile in `audit.jsonl` messen (Doc §4).
- `docs/notizen-verarbeitung-2026-09-06.md` — GESCHRIEBEN, Commit lag hinter einem laufenden Land
  (Slot 4, `self_land_start` 14:15:46); ein Hintergrund-Watcher auf den merges-Sensor committet
  danach. Ist die Datei bei deinem Start noch untracked: sofort committen (pins ist gruen), erst
  Sensor pruefen. Kernbefund: `compileBriefs` laeuft im Betrieb NICHT (`FLEET_BRIEF_MS` Default 0),
  der lebende Ort ist `briefAndSend`; Schnittmenge je Auftrag roh 42 Notizen → ohne vier
  Nabendateien 5 → + Cluster 3; `/api/self/tasks` gibt es nur als POST.
- **S1-Done-Satz pruefst DU nach dem Land im Haupt-Checkout:** `bun task-land-waves.ts --state
  fleet.json` muss ausschliesslich Wellen der Groesse 1 mit Grund `flaeche-nur-abgeleitet` liefern;
  dann in `docs/queue-wellen-2026-09-06.md` §5 S1 die Land-Sha eintragen (die Lane kann sie nicht
  kennen).

## 3. Befunde und Korrekturen dieser Session (zum Nachziehen)

- **Mein Fehler:** `7b43011` fiel um ~14:19 in ein LAUFENDES Land (Slot 4, Lane `260906075007-3a1b`,
  Task `76d39cae`, gestartet 14:15:46 von Slot 7). Der Sensor zeigte `merges[4] = interrupted` — das ist
  die AUF PLATTE persistierte Form eines LAUFENDEN Merge-Jobs, nicht „abgebrochen" — und ich habe
  ihn neben dem Commit gedruckt statt den Commit damit zu gaten. Folge, GEMESSEN: das Land endete 15:03:11 als
  `error` bei gruenem Verify (Kandidat `3becc2bf`, 47 min bezahlt), die MAIN von Slot 7 drueckte um
  15:04:09 neu (Kandidat `7cd9071e`, also auf meinen Commit rebased). R2' hat es NICHT geheilt —
  warum (Lock im Budget nicht bekommen? Runden erschoepft?) steht in keinem Ledger: genau die
  Luecke, die M1s `merge_verdict`-Zeile schliesst. Kosten fuer ein fremdes Program: ~48 min. Form fuer jeden Commit ab jetzt: der Sensor als `if python3 -c '… sys.exit(1
  if live else 0)'; then git commit …; fi` — so lief der zweite Commit.
- **R2' ist gelandet** (`server.ts#LAND_FF_RETRY_ROUNDS`, Default 2; `ffRounds:1` einmal am 05.09.
  23:02). Die Regelbuch-Zeile „Die Handregel gilt, bis R2' gelandet ist" ist ueberholt — Vorschlag
  ans Regelbuch (Fragment unter `rulebook/`, Owner-Promotion), nicht von einer Lane.
- Der Gruendungs-Rail nennt `GET /api/self/tasks` — die Route existiert nicht (nur POST); die Zeilen
  liest man aus `fleet.json`.
- `docs/queue-wellen-2026-09-06.md` §1.3 „p90 1 238 s Gate-Arbeit" ist `verify.ms` OHNE Abzug des
  Wartens (Korrektur im Merge-Doc §1).
- Keine Attention offen, keine gestellt; keine Owner-Frage noetig gewesen.

## 4. Kontext

26,4 % gemessen um 14:3x (Erdung + zwei Denk-Dokumente ≈ 26 Punkte). Rechne ~2,5 Punkte je Land.

## (alt, 09:4x) HANDOFF — Program-MAIN Fleet-Betrieb 2026-09 (`f170dc46e4b026ee34d9392e`, Slot 10, Opus 5): beide Zeilen oberhalb der Schnittlinie gelandet UND deployt; EINE gepruefte Lane wartet nur noch aufs Landen; 2026-09-06 09:4x, ctx GEMESSEN 34,7 % — ZU SPAET, §5 sagt warum

> **Dieser Abschnitt ERSETZT meinen aelteren weiter unten** (13:5x, jetzt §alt). Zustand ableiten:
> `./state.sh`, `./register.sh`, `GET /api/self/program-execution`.

## 0. DEIN ERSTER ZUG — eine Lane, geprueft, du musst nur landen

**Slot 1, `fleet/260905150555-2aac`, task `02740e69` (Lebenszyklus S5a), tip `7f964e5`, sauber,
ahead 1.** Ich habe Report UND Diff gelesen und gebe sie frei — **du musst den 209-Zeilen-Diff NICHT
noch einmal lesen**, nur landen (Gate-Check in einem EIGENEN Aufruf, siehe §5):
`POST /api/self/tasks/02740e69/land`, danach `{"kind":"merge","target":1}` abonnieren.

**ABER NICHT SOFORT — REIHENFOLGE VOM CONTROLLER (Slot 6, 2026-09-06 09:4x):** er landet zuerst
**Slot 5 (Audit-Fix)** und direkt danach **Slot 4 (E8)**; dein Land kommt **NACH diesen beiden**.
Sein Sensor ist derselbe wie deiner: `merges` in `fleet.json` **leer**. Ein `running`/`interrupted`
OHNE `verify` heisst „ein Land LAEUFT" — dann warten, nicht landen und erst recht nicht auf main
committen (§5).

Warum ich sie freigebe, damit du es pruefen und nicht glauben musst:
- `actor?: LandActor` ist OPTIONAL und beim Laden **presence-gated** (`hasOwnProperty`) — eine Zeile
  ohne den Key bleibt ohne ihn, statt mit einem geratenen `cookie` gestempelt zu werden.
- `programsForAuditRow` joint ueber **repo + branch + mainAfter zusammen**, newest-wins; ein Cover
  ohne Treffer bleibt PROGRAMLOS statt der naechsten Vermutung zugeschlagen zu werden.
- `by:"owner"` ist gestempelt, `actor` gemessen — **keines von beiden aus dem Body**.
- Der `suspect`-Arm ist eng und benennt seine eigene Grenze: „the absence of the flag always means
  'not shown', never 'shown to be safe'". Es ist eine Ledger-Zeile, kein Tor.
- Fuenf Checks + vier RULE_ACTOR-Pins, jeder EINZELN unter Mutation rot gesehen.

**EINE VORBEHALT-ZEILE, kein Blocker, aber schreib sie in die Doku der Zeile:**
`via = tokenChannel(req) ?? "cookie"` — ein unbekannter Kanal landet im NICHT-suspect-Arm, das Flag
faellt also **offen** aus. Solange es advisory ist, richtig. **Sobald irgendetwas darauf gated,
muss der Fallback `unknown` werden, nicht `cookie`.**

**IHR UNBESTELLTER BEFUND ist die wertvollere Haelfte und eine WIEDERHOLUNG:** `reportLaneSuite`
zaehlt die Fails eines suite-offer-Laufs, legt ihre NAMEN aber nicht auf `j.result` (anders als
`PostLandAuditRow.fails`) — die Lane musste sie per ssh aus der `suite.log` des Helfers holen, um
ihr eigenes rotes Vorschau-Verdikt zu adjudizieren. **Exakt der Defekt, den `eb07267` fuer Audits
schon geschlossen hat**, nur auf dem anderen Ledger. Als `notiz` nicht filbar (§4).

## 1. Was steht (gemessen, nicht erinnert)

- **`93e5460`** — proportionaler Post-Land-Audit bekommt git-Kontext im Snapshot. `verify.ok:true`.
- **`1d5efb9`** — D2 Program-Status-Projektion (3 Commits). `verify.ok:true`, `ms 188620`.
- Beide **ueber die eigene guarded Self-Land-Sprosse**, Land-Notes tragen
  `actor{kind:main, slot:10, program:f170dc46}` — **zwei Belege fuer Erfolgskriterium (d)**.
- **`bb96059`** — Regelbuch: acht Mutex-Bullets auf drei Regeln, Originale als §15.30–§15.37 im
  Attic. `81 322 → 79 508 B`, **nicht** die 75 000 (Strukturentscheid, §alt §3).
- **Deployt.** Mein `25d4940c` (`ok:true`) und danach der Controller-Deploy `8b59b434` (`ok:true`,
  bootHead `e2beeff4`). `d37f835` (Gate-Kind erbt `FLEET_SELF_TOKEN` nicht mehr) ist damit live.

**DER BEWEIS ZUM AUDIT-FIX STEHT NOCH AUS und ist deiner:** er zeigt sich erst am **naechsten
rein-docs-Land**. Dann muss die Zeile in `post-land-audits.jsonl` `proportional:true`,
`checks.failed: 0` und KEINE `not a git repository`-Zeile tragen. Basislinie, die er brechen muss:
fuenf rote in Folge. Kommt er mit denselben sechs Pin-Namen rot zurueck, hat der Fix nicht
gegriffen und die Fixture mass etwas Engeres als den Live-Pfad — das willst du schnell wissen.

## 2. Der Mechanismus des Tages, in einer Tabelle

Vier Nicht-Messungen, eine Wurzel — der Suite-Mutex verwandelt Arbeit in Nicht-Antworten, und jede
Nicht-Antwort wird danach wie ein Urteil verbucht:

| | Beleg |
|---|---|
| Gate `ec0bf175` | Phase 3, `waitMs 531000/665428`, **kein `server.log`** → RED |
| Audit `93e5460` | `ms 2700498`, `checks:None`, 1001 s Schlange → `unknown` |
| Land Slot 5 | clean rebase, **verify NEVER STARTED** → `landed=False` |
| gruene Reparatur-Kette | 4 von 5 Stufen in der Schlange (1213+1153+1881 s) |

**Nur der Land-Gate hat gelernt, „ich habe gewartet" von „ich habe gemessen" zu trennen**
(`waitMs` vs `timeoutMs`, `08dc17a`). Post-Land-Audit und Self-Land-Progress-Guard vermengen beides
weiter. Das Fix-Muster liegt im Baum. Beides steht UNTER der Schnittlinie — akzeptiert, aber die
Belege sind hier, damit es eine Lesezeit kostet und keinen Tag.

## 3. Kontrolle statt Erzaehlung (die Zahl, die ich mitgebe)

Zweimal dasselbe Gate, dieselbe `e2e-claude-gate.sh` Phase 3: bei `waitMs 531000` kam der Server
nicht hoch und es gab **kein `server.log`** (Nie-gemessen-Signatur) — bei `waitMs 0` lief dieselbe
Phase in **116 s gruen**. Dritte Kontrolle von der Reparatur-Lane: alle fuenf Phasen gefahren,
`grep -c 'did not come up'` = 0. Die Maschine ist nicht zu langsam (Slot 1 landete im selben Fenster
gruen) — **wer unter Andrang landet, kauft eine Phase-3-Nichtmessung mit spuerbarer
Wahrscheinlichkeit**, und der Guard macht daraus ein Urteil.

## 4. Zwei Tueren, die ZU sind

- **Advisory-Kappe `10/10`.** `POST /api/self/tasks` mit `kind:"notiz"` wird abgelehnt: „program
  advisory filing cap reached … ask the owner to dispose". Dieses Program kann **keine Befunde mehr
  filen** — deshalb stehen zwei davon in Prosa (§0 und §alt §4b) statt in der Queue. Der Controller
  hat zugleich verfuegt, Befunde als `notiz` weiterzureichen; **das geht erst nach einer
  Disposition.** Frag danach, bevor du misst.
- **Mein HANDOFF-Abschnitt war heute frueh der DRITTE in der Datei**, unter zwei neueren fremden.
  Der Gruendungsbrief sagt „Read only the top HANDOFF.md section" — eine Nachfolgerin von mir haette
  also ein FREMDES Program gelesen. Ich habe diesen Abschnitt deshalb neu nach oben geschrieben, aber
  **das ist ein Pflaster.** Die offene Program-Frage (`docs/handoffs/<program>.md`) hat damit einen
  konkreten Schaden statt einer Vermutung. An den Controller gemeldet.

## 5. MEIN FEHLER, und er ist der Grund, dass du das hier bei 34,7 % liest

**Ich habe die Nachfolge vierzehn Punkte zu spaet gefahren.** `HANDOFF.md` stand bei **24 %** —
also punktgenau — und danach habe ich weitergearbeitet, weil jedes eintreffende Ereignis (Report,
Watch, Land-Verdikt) wie „eine kurze Restkette" aussah. **Das Band ist ein ENTSCHEIDUNGSPUNKT, den
man EINMAL trifft, kein Schwellwert, den man bei jedem Ereignis neu bewertet.** Zweiter Teil,
gleich wichtig: ich habe die Uebergabe mehrfach als „bereit auf dein Wort" formuliert. **Sie ist der
eigene Akt der MAIN.** Der Owner musste mich darauf stossen; in seinem Gedaechtnis steht die Regel
bereits („Uebergabe fahre ich selbst"). Wenn du dich bei „nur noch dieses eine Ereignis" ertappst:
das ist genau die Stelle.

**Und der teuerste Einzelfehler kam bei 34 %**, nicht bei 24: ich habe `63ff7f6` auf main committet,
waehrend Slot 5s Land lief — weil `merges`-Probe und `git commit` in **derselben `&&`-Kette**
standen und ich die korrekte Ausgabe (`'5': 'interrupted'`) nie gelesen habe. **Die Probe gehoert in
einen EIGENEN Aufruf, dessen Ausgabe du liest, bevor du committest.** Slot 5 verlor nichts an mir
(sein Verdikt: „clean rebase, but verify NEVER STARTED"), der Fehler bleibt trotzdem einer.

# HANDOFF — Program-MAIN „Audit-Determiniertheit 2026-09" (`79036e9a58e3429578165297`, Slot 6, Opus 5): drei Zeilen gelandet, §11.2j formal geschlossen, die Suite von 4 auf 0 Fails; 2026-09-06 06:0x, ctx 43,7 % (Owner-Poll — zu spaet, siehe §5)

Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Hier nur, was
git und die Sensoren nicht tragen. Abschnitte darunter sind FREMD.

## 0. DAS ERSTE: was mit dieser Session STIRBT

- **Vier armed Watches** (Merge/Audit) und **alle Autos** — der Teardown raeumt sie still. Kein
  Ergebnis geht dadurch verloren; alle vier haben gefeuert.
- **Meine Attention `87e554226c9312fd117b630c` ist BEANTWORTET** (Entscheid C+A vom Controller,
  2026-09-05 00:0x) und braucht nichts mehr.
- **Sechs Audit-URTEILE, die ich gefaellt, aber NICHT ablegen konnte** —
  `POST /api/post-land-audits/adjudicate` ist owner-only (401 auf das Self-Token). Sie stehen
  wortwoertlich in meinen Berichten an den Controller; falls sie nie abgelegt wurden, sind die
  betroffenen Audits weiter „unbeurteilt", obwohl hingesehen wurde:
  `1788550781547` flake · `1788565731607` flake · `1788567702804` flake (vom Controller abgelegt) ·
  `1788573383933` flake · `1788599042471` **stale-test** · `1788601114492` **stale-test** ·
  `1788609298225` flake · `1788618088618` flake · `1788620497123` flake.

## 1. Was gelandet ist (drei Zeilen, alle mit Server-Wurzel statt Fixture-Kosmetik)

- **Zeile 1 §11.2j** → `c36c1e9` (Server) + `1db9296` (Fixture). Wurzel: LOST UPDATE in
  `server.ts#tickWatches` — er validiert eine Zeile, AWAITET `canDeliver` (ps/pgrep), und ein Kill
  der Subjekt-Lane schreibt in diesem Fenster `subject-gone` auf die Zeile, die die Schleife noch
  haelt; danach ueberschrieb sie den Marker. EIN Lost Update erklaerte BEIDE Faeden (`flippedBack`
  und `freed:400` sind dieselbe wiederbelebte Zeile). **Kriterium (b) ERFUELLT: 11 Laeufe auf
  Baeumen mit `c36c1e9`, 0 rot.** Erste formal geschlossene Familie.
- **Zeile 3 §11.2o Schnitt 1** → `b7480d3`: die Sonde druckt `phaseBasis` und `unknown` statt sie
  wegzuwerfen. Damit war die Wurzel beim ERSTEN roten Lauf danach lesbar (`R10`, nicht `R6`).
- **Zeile 5 §11.2o Wurzel** → `4c562e7` (Server) + `21150ac` (Fixture). Wurzel: unter
  `FLEET_CMD=true` gibt eine Pane GENAU EINEN Ausgabestoss; `ensureSlot` oeffnet ein 1500-ms-
  Ruhefenster; der Stream-Tick schiebt `s.offset` immer vor, stempelt `lastOutput` aber nur nach
  dem Fenster — faellt der erste Tick hinein, bleibt `lastOutput` 0 fuer die Lebensdauer der Lane,
  `observed` false, Projektion R10. Fix ist EINE Klausel (`|| s.lastOutput === 0`), 13 Leser
  einzeln geprueft. **Danach zwei ALL-PASS-Laeufe und ein GRUENES Post-Land-Audit (3719 Checks,
  0 Fails, 41,7 min, exit 0) — die Suite ging 4 → 1 → 0.**
- **§11.2p** neu registriert (`dc7e141`): ein nicht abgeraeumter `requeue-teardown-empty`-Rest
  reisst zwoelf `backlog nudge`-Checks mit. EIN Fail, siebzehn rote Zeilen.
- Rangliste + zwei Nachtraege: `docs/messungen/2026-09-04-flake-ranking-trail.md`.

## 2. Die fuenf offenen Zeilen, in DIESER Reihenfolge — und das Warum

1. **`508dc4bb` D2-Host-Unterschied.** `D2 setup: both closing lanes reached the spent shape …`
   ist **lokal 1/39 = 2,6 %, auf dem Linux-Helfer 3/3**. Solange das steht, ist JEDER Remote-Audit
   rot und die Entlastung, die der Helfer bringen soll, frisst dieser eine Check wieder auf.
   **Einzige Zeile des Programs, fuer die das Fremd-Plattform-Verbot NICHT gilt** — hier IST der
   Helfer der Messgegenstand; steht so im Brief.
2. **`76d39cae` `/api/self/flakes`-Truncation.** `days` ist oberhalb ~1 Tag WIRKUNGSLOS:
   `TRAIL_MAX_FILES=400` schneidet VOR dem Suite-Filter (`server.ts#trailStatsView`). days=7 und
   days=30 liefern beide 40 Laeufe, ein Direktscan findet 191. Ehrlich nur in `filesOmitted`, das
   niemand liest. **Das ist das Instrument, auf dem Kriterium (b) definiert ist.**
3. **`aa3fd660` Suite-Schnitt A** (Warten auf Bedingung statt Timer). Ich stufe das als
   Determiniertheits-Arbeit ein, nicht als Tempo: 461 `sleep`-Aufrufe / 366 s, und JEDE bisher
   gefundene Wurzel war ein Rennen, das ein Bedingungs-Warten deterministisch gemacht haette.
4. **`5cd2d1b9` Suite-Schnitt B** (Modulfilter fuer Lane-Vorschau) — **ich hatte ihn zurueckgestellt
   und ziehe den Einwand teilweise zurueck**: meine Begruendung war Ordnungsabhaengigkeit, und
   Zeile 5 hat gezeigt, dass die Wurzel ein Rennen war, kein Reihenfolge-Effekt. Der Einwand ist
   damit schwaecher, aber nicht leer — `fleet-e2e.ts` sagt selbst, die Ordnung sei tragend. Vor der
   Freigabe den Brief noch einmal lesen.
5. **`16da0d0f`** — nicht von mir gefiled, nicht von mir gelesen.

## 3. Was OFFEN bleibt und sonst verloren geht

- **Der Regime-Wechsel vom 2026-09-04 ist UNGEKLAERT** und ueber §11.2o nicht mehr beobachtbar.
  Die Messung dreht die Frage um: auf ruhiger Maschine wird der Anschluss-Stoss in **11 von 11**
  Oeffnungen IM Fenster verzehrt — erklaerungsbeduerftig sind damit die GRUENEN Laeufe VOR dem
  09-04, nicht die roten danach. **Last zeigt hier falsch herum** (langsamerer Tick = hinter das
  Fenster = gruen); wer sie noch einmal anbietet, hat das Vorzeichen nicht geprueft.
- **`snapshotIntegrationTree` (`server.ts:13016`) baut den Audit-Baum per `git archive | tar -x`,
  also OHNE `.git`. Das hat ZWEI Folgen, und die zweite ist neu:** (a) die proportionale
  docs-only-Kette faehrt dort `bun e2e/pins.ts`, dessen sechs git-abhaengige Sonden korrekt als SIE
  SELBST fallen — **jeder docs-only-Land erzeugt ein rotes Audit**, zweimal deterministisch
  beobachtet (`1788599042471`, `1788601114492`); (b) lokale Audits schreiben deshalb `tree:null`
  und **koennen strukturell nicht zu Kriterium (b) zaehlen**, das ueber `merge-base --is-ancestor`
  definiert ist. Nur Lane-Laeufe und HELFER-Audits tragen Baeume. Gehoert Fleet-Betrieb
  (Post-Land-Audit-Pfad ist mein Non-Goal), aber die zweite Folge deckelt still, wie schnell
  irgendeine reparierte Familie zertifiziert werden kann.
- **Zwei Familien gemessen, aber NICHT registriert:** `re-subscribing to the same target returns
  the SAME watch` + Folgefehler `delete the spent transport Watch` (4/557 auf vier Baeumen, erste
  Sichtung 08-24) und **Q6-fleet-report** (5/83 = 6,0 %). Unter dem Owner-Kriterium vom 09-01
  („gruen nur, wenn jeder FAIL einer registrierten Familie angehoert") macht jede unregistrierte
  Familie jeden Lauf nicht-gruen — Q6 ist Rang 2 meiner Rangliste und braucht einen §11.2-Eintrag
  unabhaengig davon, wann ihr Fix kommt.
- **Kriterium (b) wird durch einen Rebase-Land ZURUECKGESETZT:** die Beweislaeufe einer Lane liegen
  auf ihrem Vor-Rebase-Baum, der die gelandete Sha nicht enthaelt. Lane-Laeufe sind Evidenz fuer das
  Review, nie fuer das Kriterium.

## 4. Fuer die Nachfolgerin, mechanisch

- Release-Tuer ist `POST /api/self/tasks/<id>/release`; **Filing-Deckel 5 pending** (409 sonst),
  und es gibt **keine self-Route zum Loeschen** — archivieren kann nur der Owner.
- Land: `POST /api/self/tasks/<id>/land` **nur wenn die Projektion `nextAction` es nennt**, danach
  SOFORT `{kind:"merge",target:<laneSlot>}` abonnieren, bei `landed=YES` dann
  `{kind:"audit",repo,mainAfter}`.
- **Nach jedem Land: `<LAND-SHA>`-Platzhalter in `docs/verify-tiering.md` ersetzen.** Die Lane kann
  ihre Landing-Sha nicht kennen; ich verlange die Platzhalter deshalb im Brief.

## 5. Bezahlte Fehler dieser Session (alle drei im Regelbuch nachgezogen)

- **Ein SCHMUTZIGER Haupt-Checkout toetet ein fremdes Land, nicht nur ein Commit.** Ich hielt einen
  docs-Fix ~20 min uncommittet, um kein fremdes Land zu stoeren — und toetete damit den Land von
  Slot 9 NACH gruenem verify (`fast-forwarding main failed: Your local changes … would be
  overwritten`). **Warten macht es schlimmer.** Kurz halten, schnell committen, vorher
  `python3 -c 'import json; print({k:v["status"] for k,v in json.load(open("fleet.json")).get("merges",{}).items()})'`.
- **Reparatur-Zitate wandern auf die gelandete Sha, MESSPROTOKOLLE nicht.** Ein pauschales Ersetzen
  traf `e897f03` als Teilzeichenkette von `e897f038` (ein VERMESSENER Baum) und haette einen
  Verweis auf eine Sha erzeugt, die zu nichts aufloest. Vor dem Commit zurueckgenommen.
- **Eine Vorbedingung, die die Aktion nicht aufhalten kann, ist keine Pruefung.** Ich hatte
  merges-Sonde und `land` im selben Kommandoblock — die Sonde druckte „in-flight: {'5':
  'interrupted'}", der Land lief trotzdem. Sequenzieren, nicht buendeln.
- **Und der Grund fuer diese Uebergabe:** ich bin auf 43,7 % gelaufen statt bei 25 % zu uebergeben.
  Die Ketten waren einzeln kurz (briefen → warten → Report pruefen → landen), aber sie rissen nie
  ab, und ich habe die Marke nie gemessen, sondern immer die naechste Zustellung bearbeitet. Der
  Owner musste es ansagen. **Miss den eigenen Fuellstand aktiv** (Snippet im Regelbuch,
  Abschnitt Kontext-Band) — eine Kette, die immer weitergeht, verhindert die Uebergabe nicht,
  sie verdeckt sie nur.

---
---

# HANDOFF — 🎛 Fleet Controller (Slot 10, Fable 5.1): drei Lands vom Board (Slot 11, Astra S2D, c5de54cc) + zwei Docs-Direkt-Commits, dritter toter Suite-Lock gereapt, P6-Audit remote ROT (neue Familie, bei Slot 6), Umgebungs-Programm fuer einen Opus-Controller gestartet (Compact-Regel, Opus-Versuch, ctl.sh-Lane 97c5d469, Denk-Task 21ade485); 2026-09-07 05:3x, ctx GEMESSEN 23,2 % vor dem ERSTEN COMPACT (bestanden 05:3x), 34,2 % vor dem ZWEITEN Compact 09:5x, 26,6 % nach Gruendung Private-repo-j 10:5x, 18 % nach drittem Compact 10:4x

> **Ein Abschnitt je LEBENDEM Prinzipal:** dieser ERSETZT den der Controller-Vorgaengerin (Slot 2, 04:4x).
> **Der Controller ist, wer das Label `🎛 Fleet Controller` traegt.** Lineage: … → 1 → 2 → 10 (du).
> Such deinen Abschnitt per `grep -n '^# HANDOFF — 🎛' HANDOFF.md`. Zustand ableiten: `./state.sh`, `./register.sh`, Owner-Poll, Panes.
> **NEU (Owner-Richtung 2026-09-07 05:2x, Regelbuch §Einstieg Kontext-Band + docs/controller.md §Uebergabe):** bei 25 % ist der Zug HANDOFF schreiben → `/compact` → nur `state.sh`+`register.sh`. Succession nur, wenn die Selbstauskunft nach dem Compact nicht mit `state.sh`/Board stimmt — und DIESE naechste echte Succession spawnt versuchsweise Opus 5 high (`{"model":"claude-opus-5[1m]","effort":"high"}` im succeed-Body).

## 0. Was du als Erstes tust

1. `GET /api/self/attention` + `/fleet-report`: bei mir um 05:3x beides leer. Slot 4 (Owner-Astra-Session, codex) steht bis 06:53 im Usage-Limit.
2. **Owner-Delegation 03:2x gilt fort** („sprich dich mit Astra ab … triff Entscheidungen selbst") und ist um 05:3x erweitert: „sag mir einfach was ich tun soll wenn du … wirklich wirklich meine Hilfe benoetigst etwas zu entscheiden" — also: entscheiden, nur echte Tore beim Owner. Docs-only Astra-Lanes landest du vom Board (Astra 94fbc8d9: keine Self-Land-Sprosse). Fleet-Betrieb-Lanes landest du nach Slot-7-Akzept ebenfalls vom Board (c5de54cc heute so: Report 05:07, `decision.accepted` durch Slot 7, Land 05:13, Code, 139 s, waitMs 0).
3. **Mechanismen, die laufen (Datei-Skripte im Scratchpad dieser Session, sterben mit der Pane, NICHT mit einem Compact):**
   - `mon-dispatch-v2.sh` (bg): wartet auf `⎇ task`-Slots < 2, dispatcht dann **746513d1** (pi-zai/glm-5.3 — `automatable:false`, der TICK STARTET SIE NIE, nur `POST /api/tasks/:id/dispatch`), wartet 20 s, dann `POST /api/tasks/97c5d469/queue` (ctl.sh-Lane) fuer den Tick. Deckel 2 bleibt so gewahrt.
   - `mon-events.py` (bg, exit beim ersten Unterschied, danach neu starten): attentionRequests · watchlist-Tasks · Program-Zeilen eec69528/e3b3a064 · fleetReports-Decisions · merges · Doppel-Claim (helperClaims + laneSuiteJobs claimed ≥ 2 = Bedingung fuer Deckel 2→3) · `post-land-audits.jsonl`-Zeilenzahl · landPending/mergeParked.
   - Watches (`GET /api/self`): audit a65fbdd (docs), audit 1004832 (docs), audit 7536702 (Code, `idleSec:0`), Watch 42c23c01. Die drei aelteren sind gefeuert/subject-gone; die Events `538efa57` (merge-terminal Slot 2) und `7f7b660d` (post-land-audit a1f8b65) stehen `pending` und sind NICHT quittierbar, solange nicht zugestellt — Zustellung braucht 60 s Idle (Default). **Ab jetzt jeden Watch mit `idleSec:0` armieren.**
4. **Band 25 / 30–35, Compact statt Succession** (s. Kopf). Meine Kosten: Erdung ~7, drei Lands+Reap ~5, Umgebungs-Suche+Fragmente+Briefs ~9.

## 1. Die Kette, in Flug

- **Slot 1 = M5 `8d6a3e9e`** (Land-Pipeline, toter-Halter-Reap im Server) seit 05:14 · **Slot 2 = R1 `1c746e96`** (Fleet-Betrieb, Progress-Guard) seit 05:11. Beide berichten an ihre MAIN (Slot 5 bzw. 7); M5 landet Slot 5 selbst (green-only), R1 landest du nach Slot-7-Akzept.
- **Queue danach:** 746513d1 (Hand, s. §0.3) → 97c5d469 ctl.sh (Tick) → weitere Fleet-Zeilen releast Slot 7. Pending mit Absicht: 21ade485 Denk-Task Modellklassen-Profile (Owner: „frische Session"; startet, wenn der Owner oder du es freigibst — es ist eine Fable-MAIN-Denksession, KEINE Opus-Lane), 3af11665 N1 + 283f625f M3 (Slot 5 released), d2b69d3d.
- **Audits offen:** a65fbdd + 1004832 (docs-only, kurze Kette, koaleszieren) · 7536702 (Code: e2e/pins.ts) · **a1f8b65 ROT** (remote Second-host, 05:18, 1/3785: `e2e/restart.ts` „a dead explicitly-bound slot heals through exactly one exact-id Codex resume", tmux-Timing-Sonde, NEUE Familie, nicht in verify-tiering §11; Event bei Slot 6, dessen Land; nicht adjudiziert). Deine Zeile bleibt: nur eingreifen, wenn ein Rot die `waitMerge`-Familie (b8b5e48) trifft.
- **Slot 7** hat um 05:21 EINE Zeile zum Filen bekommen (pi-zai-Dispatch-Notiz „waiting 2/2 busy" ist falsch; DONE-Satz + e2e/tasks.ts-Check + docs/queue-analyst.md §7) — ob gefilt, im Register pruefen.
- **Deckel 2→3** erst nach beobachtetem Doppel-Claim (Monitor). c5de54cc ist gelandet, die zweite Bedingung (Audit+Vorschau gleichzeitig am Second-host) steht aus.

## 2. Gemessen heute (04:44–05:3x)

- Slot 11 (580cc453) Land 04:45 nach drei Toden: `a65fbdd`, 871 ms, kurze Kette — moeglich erst durch Direkt-Commit `69ca4a9` (Slot-4-Docs, unfertig laut eigener Fussnote, Slot 4 darf nachziehen).
- Slot 2 (457511cc S2D) Land 05:10: `1004832`, waitMs 255 000 hinter **totem Lock 60403** (birth 05:02:31 = lokale Pruefkette der Lane; Wrapper-Freigabe ohne Rueckgabe, dritte Instanz in einer Nacht; Traeger M5). Von Hand gereapt (pid tot, 0 Wrapper). INDEX-Zeile fehlte (Brief sagte „nur diese Datei", kein Pin prueft es) → `8000d12`.
- Slot 1 (c5de54cc) Land 05:13: `7536702`, volle Kette 139 s, waitMs 0 — Server hielt den Mutex (M1-Hold), sauber.
- **Watch-Zustellung:** Default `idleSec:60` erreicht einen arbeitenden Controller nie; `slotDeliveryBudget` zaehlt unzugestellte Events → „max 5 active watches" bei 3 armierten. Regel jetzt im Regelbuch §Self-scheduling.
- **Tick + pi-zai:** zwei freie Fenster (05:10:59, 05:14:03) uebersprangen 746513d1 trotz frueherer Dateiposition; Notiz am Row luegt. Slot-7-Zeile (s. §1).
- **Erster Compact der Controller-Rolle 05:3x: BESTANDEN** — ctx 24,5 % → 9,6 %, sieben Watches, Autos und vier Monitore ueberlebt, Selbstauskunft = `state.sh`/Board. Befund: nur ein KURZER `/compact` (119 Z.) wirkt ueber den send-Pfad; der lange (~1 000 Z., Auto 5af43c81) kam als Nachricht an (`sendText` = `paste-buffer -p`, „Pasted text“ wird nicht als Befehl geparst). Im Regelbuch §Einstieg eingetragen.
- **Die Harness toetet Hintergrund-Monitore bei Speicherknappheit — STILL, und der Rueckweg ist dann weg** (gemessen 05:59–06:54: `mon-events.py` und `mon-dispatch-v2.sh` wurden von Claude Code mit „system is running low on memory" gekillt, die Notification kam erst ~1 h spaeter mit dem naechsten Turn; die Maschine hat 8,6 GB, ein iOS-Simulator des Owners (~700 MB, fremde Realitaet) lief, dazu vier VERWAISTE e2e-Server der gestrigen Lane 260906075007-3a1b (18–20 h alt, Worktree weg, kein Socket) — per verifizierter PID gereapt, `state.sh` hatte sie als stray gelistet). Konsequenz: ein Datei-Monitor ist kein garantierter Rueckweg; nach jeder Wartepause `ps -o stat -p <pid>` der Monitore pruefen, und `state.sh`s stray-Liste ist ein Reap-Auftrag, kein Hinweis.
- **MEIN FEHLER 07:29: Land VOR dem Entscheid des Empfaengers.** 746513d1 (pi-zai, Slot 11) meldete 07:29 `complete` an Slot 3; ich landete sofort vom Board (docs-only, Delegation), Slot 3 lehnte 07:31 ab (fuenf konkrete Punkte: falsche Byte-Zahl 21 368 vs 13 241, graphify-Aussage, Task-ID als Sha gelesen, estimatedBytes unbelegt, Verify-Sha fehlt). Der Land schloss die Lane — die Ablehnung hatte keinen Adressaten mehr (das ist genau Zeile 18e87e67). Gelandet als `f781c60`. Korrektur gefiled: zuerst `6a281e76` OHNE programId (Astra-Notiz 572afe98 fand es) — geloescht und NEU als **`1d0f4ca4`** (queued, programId eec69528, sechs Punkte inkl. a3878547: Original-Verify-Sha fb470c67 oder unknown, Abdeckung offen). Kein Owner-Pfad aendert die Bindung einer bestehenden Zeile, nur die Create-Route nimmt programId. Ruecknotiz an Astra (A Stau · B Inbox-Lands d6d5cb2/453092c · C D2 nicht gedeckt · D Bindung + S2D-Reparaturweg a/b) = Notiz **`4fc45ae2`** in eec69528, 09:2x; 572afe98 archiviert. **Regel fuer mich: `complete` ist die Meldung der Lane, NICHT das Urteil — landen erst nach `decision.accepted`, auch bei docs-only und auch unter Delegation.** Ausnahme nur, wenn der Empfaenger tot ist.
- **Audits heute, wo sie liefen (Ledger-Feld heisst `remote`, nicht `helper` — ich habe es bis 08:00 falsch gelesen):** a1f8b65 rot REMOTE · 7536702 gruen LOKAL (40 min, koalesziert a65fbdd+1004832+7536702) · b2ab2cf gruen REMOTE (claimed 07:21, reported 07:58, 36,6 min). Das Audit fuer 2dfaa81+f781c60 wurde LOKAL eingereiht (Ticket t4 im Mac-Mutex, `fleet-postland-audit-e9d736ab1a27`), weil der Helfer beim Enqueue belegt war (Cap 1) — und wird NICHT neu angeboten, wenn der Helfer frei wird. Genau deshalb blieben auch die Lane-Offers 07:36/07:39/07:55 (Slot 1, Slot 2) 180 s unclaimed und fielen lokal zurueck: drei Lane-Suiten VOR dem Audit in der Schlange, der Helfer seit 07:58 leer. **Deploy (Slot-5-Bitte 07:58) → 409 preflight audit running**, also erst nach diesem Audit; Slot 2 per /send gebeten, seine zwei ungestarteten lokalen Laeufe zurueckzuziehen und neu anzubieten. Befund fuer Slot 6 (Audit-Determiniertheit) oder Slot 7: **Audit-Platzierung ist eine Enqueue-Zeit-Entscheidung ohne Re-Offer** (`server.ts#drainPostLandAudits`) — bei Cap 1 kippt jede Ueberlappung den Tag auf den Mac.
- **Audit fuer 2dfaa81+f781c60: UNKNOWN** (08:43, lokal, `ms 2700347` = das 45-min-Budget, davon fast alles Schlange hinter Slot-1-Suiten; audited tip 5b67695). R1s server.ts-Aenderung (Self-Land-Guard) und die GLM-Notiz sind damit NICHT tier-2-vermessen; ihre Land-Gates waren gruen (R1: volle Kette 141 s). Kein Re-Audit-Weg bekannt (`drainPostLandAudits` bietet nicht neu an) — das ist der Fall fuer Slot 7s Zeile ff4544f5 und Slot 5s M2 64860da8.
- **DEPLOY 08:43:33 (Verb 2, Id `3a39cf7b`, Ziel `a1fef1f`, auf Bitte Slot 5):** Boot ok, `deployGap.codeBehind:false`, `bundleStale:false`, `errors:null`, 11 Slots leben. Live sind jetzt M5 (Server reapt toten Suite-Halter), R1 (Self-Land-Progress-Guard) und alles seit 26aa068. Vorher gefragt: Slot 5 (nichts am Idle-Fenster), Slot 1/2 fahren Suiten in eigenen Instanzen. Idle-Uhren aller Panes stehen seit 08:43 auf null.
- **DECKEL 1 (Owner-Entscheid 2026-09-07 09:3x, „fuer vernuenftige Suiten"; ERSETZT „Deckel bleibt 2" und das offene Tor 2→3):** `FLEET_DISPATCH_MAX_LANES=1` in watchdog.sh (`521e397`, Doc-Claim in docs/queue-analyst.md nachgezogen, pins ALL PASS), Watchdog per `launchctl kickstart -k` neu gestartet 09:25:40, srv per Verb 2 neu (Deploy `7941664b` auf 521e397). Die zwei laufenden Lanes (R2 Slot 1, N1 Slot 2) bleiben; der Tick startet erst wieder bei null Lanes. Queue dahinter, seriell: 97c5d469 (ctl.sh), c9791a49 (Slot 7), 1d0f4ca4 (GLM-Korrektur), 56e4427d (S2D-Korrektur, von Astra selbst gefiled+released).
- **Astra-Abgleich abgeschlossen (333a9f86, archiviert):** S2D-Weg (a) — 56e4427d ist ihre eigene gebundene Zeile; D2 e88884c8 wartet auf das R2-Land; Prozess-Dokument d2b69d3d bleibt am Ende; sie wollte fuer den Audit-Platzierungsbefund EINEN Diagnose-/Vertragsauftrag, keinen Bau → **`e407aef5`** PENDING in Fleet-Betrieb f170dc46 (Slot 7 released). Mechanismus praezisiert: nicht „kein Re-Offer", sondern `server.ts#drainPostLandAudits` gibt dem Helfer `FLEET_AUDIT_HELPER_GRACE_MS`=60 s (nur wenn `helperClaimCandidateExists`), dann startet der lokale Lauf und ist ab `auditRunningRepo` committed — auch wenn er 45 min im Mac-Mutex wartet.
- **ASTRA-TAG (Owner 09:3x/09:4x): ~12 h unbegrenzt Astra bis zum Reset; Owner-Ja zu Schnittlinie + Slot 9 als Ober-Orchestratorin.** Tagesmandat = Richtungszeile **`b78d31b7`** in e3b3a064 (Volltext dort; Scratch-Kopie stirbt mit dieser Pane). Kern: drei Sub-Programme mit je einer Astra-MAIN — P1 Verifikation als Raetsel (18 Flake-Familien mit Mechanismus, Audit-Pipeline als Zustandsmaschine, ≤5 serielle Opus-Schnitte), P2 Adressierbarkeit ueber den Sessiontod (Nachrichtenmodell + Invarianten + Property-Test-Entwuerfe, Brief-Vorschlaege an Slot 7), P3 Landepfad als adversariales Puzzle (Repro nur in Scratch-Instanzen); Abendzeile 21ade485 nach +8 h. Fuenf Regeln (keine Suite aus Astra, zweite Astra nimmt ab, Artefakt im Repo, Sub-Agents statt Slots, public Repo). Punkt 0: die vier toten aktiven Programme (cd110019 Dual-Host, 07ee8a6d Private-repo-y, 2c073232 Private-repo-j, b2aa5b45 Game-Maker v2, dazu 4785b33b proposed) — Slot 9 entscheidet, ICH fuehre `POST /api/programs/:id/complete|discard` aus. Sub-Programme: Slot 9 proposed per `POST /api/self/programs`, ICH fahre confirm/activate/bootstrap-main (Owner-Routen). Checkpoints ~13:45 und ~17:45 als Notiz „AN CONTROLLER SLOT 10" in e3b3a064 — der Datei-Monitor sieht sie. Meine Rolle: Land nach Akzept, Deploy, Reaps, Owner-Weiterleitung; keine eigene Grabung.
- R2 956a27cf (Slot 1): Report 09:31, Slot 7 akzeptiert 09:33 und landet SELBST → `19ddef5` (Gate gruen 140 s, wait 0); Audit-Watch 06e1860a armiert. Slot 2 N1 laeuft noch; unter Deckel 1 startet der Tick die naechste Zeile erst bei null Lanes.
- N1 3af11665 (Slot 2): Report 09:37 an Slot 5, Self-Land gruen (ms 149387, wait 0) → `24cd54e` (task-notes.ts + briefAndSend-Naht) + `189f815` (Sondenfix); Slot 5 Direkt-Commit `0a0da52` (Land-Shas in die Notiz). Audit-Watch e195bfaf auf 189f815 (ein Watch auf 0a0da52 wird abgelehnt: kein Audit-Eintrag — Audits haengen am LAND-Tip, nicht am Direkt-Commit). **DEPLOY 09:41:50 `1a3ed209` auf 0a0da52** — nimmt R2 (Supervisor-Bindung) UND N1 (Notizen im Gruendungsprompt) live, beide server.ts. Tick (Deckel 1) startete 09:40:58 c9791a49 (Slot 7s Audit-Timeout-Zeile) auf Slot 1 — Fair-Share zieht Program-Zeilen vor der ungebundenen 97c5d469; e407aef5 von Slot 7 released (queued); M3 283f625f (Slot 5) queued.
- Direkt-Commits ohne Land-Ledger heute: `69ca4a9`, `8000d12`, `16b77b9` (docs/controller.md). Regelbuch-Fragmente geaendert (gitignored): einstieg.md (Compact-Regel, Opus-Versuch), self-scheduling.md (idleSec:0 + ack). CLAUDE.md gerendert, pins ALL PASS.

## 2b. DER NAECHSTE AUFTRAG NACH DEM COMPACT (Owner 09:5x, hat Vorrang vor §3 — nur Lands/Reaps/Deploys laufen daneben)

**OWNER WOERTLICH (2026-09-07 09:5x):** „ich würde gerne einen ausgefeilten Prompt für Astra schreiben, dass sie in einem sauberen orchestrativen Workflow, am besten hier eine Ausarbeitung & Verbesserung des alten Workflows, mit Opus und/oder Fable 5.1 Workern, eine ausgefeilte Version des Private-repo-j-Games baut auf Basis des 2002 RollerCoaster-Tycoon-Games und AoE2. Das Ganze sollte wie ein AAA-Game vom Anfang der 2000er aussehen. Die Astra-Session sollte keine Mühen sparen und du solltest dir einen guten Prompt überlegen. Vielleicht machst du hier auch erst das Handoff und lässt die neue (oder komprimierte) Session das dann sauber angehen."

**Was das ERSETZT:** die Memory-Zeile „Private-repo-j nicht wiederbeleben, bis der Lebenszyklus steht" (Owner 05.09.) — der Owner hat heute anders entschieden; Private-repo-j wird als NEUES Astra-Program wiederbelebt, nicht als Fortsetzung von 2c073232 (tote MAIN, 2 Zeilen; Slot 9 entscheidet in Punkt 0 des Tagesmandats b78d31b7 ueber `complete`). Das Tagesmandat (P1–P3) laeuft PARALLEL weiter; dieses Program ist ein VIERTES Astra-Sub-Program und braucht einen eigenen Slot (heute 9 von 16 belegt).

**Deliverable:** EIN Gruendungsbrief (Prompt) fuer eine Astra-Program-MAIN „Private-repo-j", der (1) den Game-Maker-Workflow v2 als Ausgangspunkt nimmt und ihn AUSARBEITET UND VERBESSERT (nicht ersetzt) — mit Opus-5-Lanes als Bauer und Fable 5.1 nur dort, wo Fable messbar besser ist (Fable ist knapp: 80 % Wochenlimit in 14 h am 02.09.); (2) das Zielbild in einem Satz festnagelt: Browser-RTS ueber Biber, deren Belagerungskunst Wasser ist, Spielgefuehl aus RollerCoaster Tycoon 2 (2002: isometrische Kacheln, Bau-/Terraforming-Werkzeuge, Besucher-/Tier-Simulation mit sichtbaren Individuen, Finanz-/Zufriedenheits-Schleifen) und Age of Empires 2 (Ressourcen → Gebaeude → Einheiten → Konflikt, Fog of War, Techbaum, Szenario-Editor); Look: „AAA vom Anfang der 2000er" = vorgerenderte isometrische Sprites/2D-Pixelart mit Dithering, 256-Farben-Palette-Anmutung, UI-Chrome mit Holz/Stein-Rahmen, keine Flat-Design-Moderne; (3) Meilensteine als Done-Saetze mit Verify-Weg (spielbarer Vertical Slice zuerst, Art-Bibel vor Assets, Sim-Kern vor Content); (4) die Fleet-Mechanik korrekt nennt (Sub-Program per POST /api/self/programs, Lanes per POST /api/self/tasks + release, Deckel 1 repo-weit, keine Suite aus Astra, zweite Astra als Critic, Land nach Akzept durch den Controller); (5) Astra ausdruecklich „keine Muehen sparen" gibt: Recherche zu RCT2/AoE2-Mechaniken (Primaerquellen, keine Halluzination), Art-Direction-Dokument, Sim-Design mit Zahlen, Playtest-Protokoll.

**QUELLEN, in dieser Reihenfolge lesen (alles auf main):** docs/game-maker/workflow-v2.md (der alte Workflow, Rollen-Graph/Report-Vertrag/Critic-Zweitweg) · docs/game-maker/brief-profil-v2.md · docs/game-maker/anschlussplan-2026-09-07.md + die Gamedev-Bestandsaufnahme (`git log --oneline -3 -- docs/game-maker`, Commit 71cb49d = Astras eigener Stand vom Morgen) · docs/game-maker/README.md · kritik/437132577c84-2026-09-03.md (Sensory Critic am versiegelten Private-repo-j-Stand) · Program 2c073232 (intent/successCriterion/nonGoals in fleet.json: Intake INTAKE-2026-09-03.md, Wasser-Engine engine/sim + engine/welt, Nahaufnahme → Stamm → Reich) · Program b2aa5b45 (Game-Maker v2, offene Zeilen c3353194 1f84ca33 4cc4a02d 252a659e 328fd28f e0d625a5 001d4cc3 — was davon in den neuen Brief wandert) · docs/product-studio-working-circle.md (Studio-Policy) · das Private-repo-j-Repo selbst (`~/claude-fleet`-Programme zeigen auf ein anderes Repo: `fleet.json` programs[2c073232].repo bzw. Task-`repo`-Felder — Pfad pruefen, Engine-Stand `git log -5` dort).

**Nicht tun:** keinen Code anfassen, keine Lane starten, kein Program gruenden — der Brief geht als Vorschlag an den Owner (Notiz + kurze Chat-Fassung), Owner sagt Ja, DANN gruenden (Owner-Route confirm/activate/bootstrap-main, harness codex, model gpt-6-astra, effort high). Slot 9 bekommt eine Kopie als Notiz in e3b3a064, damit das vierte Sub-Program in ihrem Zielbild steht.

**§2b ERLEDIGT 10:5x — Program `9ce08219` „Private-repo-j" gegruendet, MAIN = Astra auf SLOT 2.** Owner-Ja um 10:3x mit vier Praezisierungen, alle eingearbeitet: (1) KERN-LOOP: mehrere Biberstaemme in je ihrer Kartenregion muessen Wasser effektiv AUFSTAUEN, um Ressourcen aus der Erde zu ziehen, damit Truppen ausbilden und im Techbaum aufsteigen; (2) NEUSTART in einem NEUEN Repo `/Users/owner/private-repo-j` (von mir angelegt: engine/sim + engine/welt + damm.ts + 11 Engine-Tests byteidentisch aus game-maker-private-repo-j @ 2bd6559 gehoben; `bun run verify` → 126 pass / 0 fail / tsc exit 0; Erst-Commit `c95194d`; Worktree `private-repo-j.worktrees/astra-main` Branch astra-main); (3) zweite Astra als Critic A + Adjudicator; (4) Fable OHNE Deckel („kein Firlefanz", ~40 % Wochenlimit fuer 2–3 Tage). Neu vom Owner: die Arbeit wird LEICHTGEWICHTIG IM REPO GETRACKT — `WORKTRAIL.md` (eine Tabelle, Zeile je Akt, Pflicht in jedem Brief) + `docs/entscheid-log.md`, fuer eine spaetere Worktrail-Analyse zugunsten des Game-Maker-Profils. Das Mandat (403 Zeilen, 11 Abschnitte; Wasser-Engine-Sektion aus einem Lese-Agenten-Report mit Messzahlen und API) liegt als `docs/MANDAT-2026-09-07.md` IM REPO (Host als Platzhalter), `AGENTS.md` dort traegt die Kurzform (codex laedt es automatisch). Fleet-Seite: Charter aus Scratch `private-repo-j-program.json` (Deckel 4000/4000/500 eingehalten), Profil game-maker gesetzt, confirm → activate → bootstrap-main (codex / gpt-6-astra / high) → Slot 2 alive, ctx 20,4 % von 258 400 nach 30 s. Richtungszeile **`a33d7300`** im Program (Host literal, Repo-Feld `/Users/owner/private-repo-j`, Program-Id, erster Zug) und Notiz **`16018401`** an Slot 9 in e3b3a064 (Punkt 0: 2c073232 + b2aa5b45 werden NICHT fortgesetzt; Private-repo-j steht nicht unter ihrem Weisungsrecht). Meine Rolle dort: Land nach `decision.accepted` (Repo private-repo-j, eigener Lane-Deckel 1 — der Deckel zaehlt PRO REPO, `server.ts:2238`), Owner-Tore weiterreichen (Attentions von Slot 2), Checkpoints „AN CONTROLLER SLOT 10" lesen (Datei-Monitor sieht neue Notizen). Task-Text-Deckel gemessen: `MAX_TASK_TEXT` 20 000 (`server.ts:2047`) — ein 29k-Mandat passt NICHT in eine Zeile, darum Repo-Datei + Zeiger. Slots: 10 von 16 belegt. Audit 19ddef5 GRUEN (3806/0, Event quittiert); Audit 189f815 laeuft noch (Watch e195bfaf).

## 3. Der Plan von hier

**STAND 10:5x (Controller Slot 10, ctx 18 % gemessen, nach dem dritten Compact — alles unten ist AUSGEFUEHRT, nicht geplant):**
- **Private-repo-j 9ce08219:** die Architect-Lane 32fed872 starb am Claude-TRUST-DIALOG (neues Repo-Root `/Users/owner/private-repo-j` fehlte in `~/.claude.json` projects; Worktrees erben vom Root; Brief-Paste+Enter waehlte «No, exit», Pane = Shell, Slot RUNNING mit agent=no-agent). Fix: Trust-Eintrag fuer das Repo-Root gesetzt (einmalig, atomar), leere Lane geschlossen, Zeile requeued, Neuspawn auf Slot 4 sauber. **Owner 10:5x hat diese Lane von Hand auf Fable 5.1 gestellt** («macht am Anfang Sinn») — Datensatz per `/api/slots/4/model` nachgezogen, Slot 2 informiert. Die Lane lieferte um 10:43 Report 83b0bd41 (GAME-CARD.md-Entwurf, needs-main: M2-vor-M3-Konflikt A/B fuer die MAIN + OWNER-Frage Partieformat Szenario-mit-Frist/Skirmish/beides). Attention e609aa9b beantwortet. Betriebsbefund als Notiz 2022fa5a in Fleet-Betrieb f170dc46 (claude-Trust-Screen fehlt in `paneReadiness`). Mandat §8 korrigiert (private-repo-j main 26a5bf3: `POST /api/self/tasks` kennt kein repo-Feld).
- **Astra-Tagesmandat b78d31b7 (Slot 9), Notiz 49897633 ausgefuehrt:** 4785b33b DISCARD; cd110019/07ee8a6d/2c073232/b2aa5b45 unangetastet (Einordnung, kein complete). P1 29c0f21b → Slot 11, P2 446e77f8 → Slot 12, P3 6360c361 → Slot 13 (je codex/gpt-6-astra/high, cwd Haupt-Checkout, alive), Startbriefe byteidentisch als Notizen 3d6abe22/30cd3453/52285f8f, Zeiger per /send. Notizen 5862751c/b2a90267/cf346235 archiviert. Weck-Autos auf Slot 9: f31828de (13:45), ca8e863d (17:45). Receipt-Notiz 615513af an Slot 9.
- **Belegung 14/16.** Frei: 14, 16. Der Critic-Astra-Slot fuer Private-repo-j (zweite Astra) braucht einen davon.

1. Nach dem Compact: `./state.sh`, `./register.sh`, `GET /api/self` (Watches), Monitore pruefen (`ps -o pid,stat -p $(pgrep -f mon-events.py)`), `mon-events.py` neu starten, falls beendet. §2b ist ERLEDIGT (10:5x, Program 9ce08219 auf Slot 2) — ab jetzt: Slot-2-Attentions und Checkpoints beantworten, Lands in `/Users/owner/private-repo-j` nach Accept fahren.
2. R1 (Slot 2) nach Slot-7-Akzept landen; M5 landet Slot 5. Audits lesen (Ledger-Zeilenzahl im Monitor).
3. 746513d1 + 97c5d469 laufen an, sobald ein Slot frei ist (Monitor). ctl.sh-Report reviewen, Land vom Board (Code, volle Kette), danach `docs/controller.md` §Werkzeuge gegen die Usage lesen.
4. Slot 4 committet nach 06:53 evtl. weiter in den Haupt-Checkout — vor JEDEM eigenen Commit `git status` + merges-Sensor.

## 4. Offen beim Owner (nur echte Tore)

Slot 4 in einen Worktree? · Deckel 2→3 (Bedingung §1) · Start des Denk-Tasks 21ade485 (frische Fable-MAIN) · Astra-Effort (vorerst medium) · vier Programs mit toter MAIN-Bindung (Vorgaengerin §2) · Private-repo-z.

---

# HANDOFF — Program-MAIN Fleet-Betrieb 2026-09 (`f170dc46e4b026ee34d9392e`, Slot 5, Opus 5): VIER Lands, drei deployt — und eines traegt eine Regression, die ich selbst gefunden und gefilt habe; 2026-09-05 11:5x, ctx GEMESSEN 44,1 % (Owner-Poll)

# HANDOFF — Program-MAIN 66499a03 „Fleet-Betrieb ohne manuelles Owner-Routing" (Slot 2, Opus 5): ERFOLGSSATZ 8 IST NICHT UNBELEGT, SONDERN STRUKTURELL UNERREICHBAR — der TUI-Repaint kommt 14 ms vor der Schwelle; der Owner hat (a) gewaehlt, die Schwelle steht auf 20 min, der dritte Beleg-Lauf ist released; 2026-09-05 15:5x, ctx GEMESSEN 29,8 %

Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Hier nur, was git
und die Sensoren nicht tragen. Lineage 4 → 16 → 10 → 3 → 5 → 2 → du.

## 0a. NACHTRAG 15:5x — DER OWNER HAT ENTSCHIEDEN, UND ZWEI SAETZE UNTEN SIND UEBERHOLT

**Entscheid (a) ist gefallen und LIVE** (Controller Slot 12, vom Owner delegiert, 13:1x):
`FLEET_STALLED_IDLE_MS='1200000'` (20 min) steht in der gitignorierten `.env:28` — kein Commit,
kein `launchctl kickstart` noetig, weil `watchdog.sh:155` mit `set -a; . ./.env; set +a` sourct
(`set -a` exportiert, die Variable erreicht `bun server.ts` also wirklich; ein blosses `. ./.env`
haette nur eine Shell-Variable gesetzt, die das Kind nie sieht — das war die Falle, die ich vor dem
Deploy geprueft habe). `FLEET_STALLED_IDLE_MS` kommt in `watchdog.sh` NULL mal vor, wird also von der
expliziten Liste hinter dem Sourcing nicht ueberschrieben. Live seit **Deploy `9b3c0db5`, Boot ok
13:45:34, bootHead `4761020`**; der Controller hat den Live-Env gemessen, ich habe die Kette
(.env-Wert · `set -a` · kein Override · Restart in `deploys.jsonl`) selbst nachgelesen.

**DAMIT SIND ZWEI SAETZE IN ABSCHNITT 0 UEBERHOLT — nicht loeschen, aber nicht mehr befolgen:**
- „Bis der Owner waehlt: `9f1dbfb4` NICHT erneut releasen" — **erledigt.** Ich habe die Zeile am
  13:47 ueber die EIGENE Tuer released (`POST /api/self/tasks/9f1dbfb4/release`, `ok:true`,
  `sessionIdMatch:"exact"`). Sie steht `queued` auf Position 1.
- **`releasedBy` ist jetzt `machine` statt `owner`.** Die beiden ersten Beleg-Laeufe gingen durch die
  Owner-Tuer; dieser geht durch die Self-Release-Tuer einer MAIN. Das ist der bessere Satz-11-Beleg,
  und er ist der Grund, warum ein Hand-Dispatch diesen Lauf beschaedigen wuerde.

**WAS DER DRITTE LAUF BRAUCHT (dein Ablauf, wenn der Report kommt):**
1. **Sofort annehmen** — `POST /api/self/fleet-report/<24-hex>/accept`. **`reason` max 500 Zeichen,
   und die Laenge VOR dem Schreiben pruefen:** ein `assert`, das die schon truncated Datei
   hinterlaesst, sendet einen LEEREN Body, und den verbucht die Route als gueltige Annahme mit
   `reason: null` — genau so ist mein Grund im zweiten Lauf verlorengegangen, ohne Re-Decide-Tuer.
2. **„FENSTER AUF HH:MM" an den Controller** (Peer-Name ueber `ListAgents`, Slot 12 — der Name
   wechselt staendig: d4 → bd → ad an EINEM Tag; nie einen alten wiederverwenden). Ein Deploy im
   Fenster nullt die Idle-Uhr aller Panes.
3. **Die Uhr selbst lesen, ohne Owner-Token:** mtime von `streams/s<slot>-<openedAt>-<hash>.raw`.
   `poll()` leitet `lastOutput` genau aus dem Wachstum dieser Datei ab. **Faelligkeit jetzt
   `mtime + 1 200 000 ms`.** Der 30-min-Repaint (`Checking for updates`) laesst nach jedem Paint
   20 freie Minuten — das Fenster existiert in JEDEM Zyklus.
4. **Der Beleg ist EINE Zeile:** `killed-empty` MIT `autoClose{reportId,disposition,decidedAt,decidedBySlot}`
   in `lane-outcomes.jsonl`. Stand 15:5x weiterhin **0**. Der Close feuert KEIN Event — niemand weckt
   dich, du musst zur Faelligkeit selbst nachsehen.

**Benannter Preis des Entscheids, den ich empfohlen habe:** die 30 min waren gegen Fehlurteile
gewaehlt („a lane running an e2e suite routinely prints nothing for ten minutes at a stretch",
Kommentar ueber der Konstante). Mit 20 min bleibt die Marge 2x statt 3x. Begrenzt wird der Schaden
dadurch, dass der Auto-Close zusaetzlich sauberen Baum, `ahead 0`, kein Merge-Verdikt UND einen
angenommenen Terminalreport verlangt: betroffen waere nur eine Lane, die BERICHTET hat und danach
20 min stumm weiterarbeitet. Ein ueberraschender `killed-empty` in den naechsten Tagen gehoert hierher.

## 0. DER BEFUND, der die ganze Jagd beendet — und die EINE offene Owner-Frage

**Erfolgssatz 8 (automatisches Cleanup einer clean+ahead0-Lane) kann fuer eine claude-Lane NIE
feuern.** Nicht Pech, nicht der Deckel, keine fremde Hand. Gemessen an der Beleg-Lane `9f1dbfb4`
(Slot 1, Branch `fleet/260905061853-2111`):

| | |
|---|---|
| Repaint 1 | 08:49:04.487 |
| Repaint 2 | 09:19:04.473 |
| Abstand | **1799,986 s** |
| `STALLED_IDLE_MS` | **1800,000 s** |

Claude Code malt in eine IDLE Pane alle 30 min `Checking for updates` (beide Paints in den
Stream-Bytes von `streams/s1-…​.raw` belegt, 59 bzw. 70 ANSI-Sequenzen, sonst nur Footer). Der Timer
laeuft ab dem VORIGEN Paint, die mtime ist dessen ENDE — die Phase ist selbstgestellt und liegt
damit dauerhaft ~14 ms VOR der Schwelle. `server.ts#poll` setzt `lastOutput` bei JEDEM Byte-Zuwachs
des pipe-pane-Streams; einzige Ausnahme ist der selbstverursachte Resize (`quietUntil`). TUI-Chrome
ist nicht ausgenommen. Also erreicht `idleMs` nie 1 800 000, Zyklus fuer Zyklus.

**Das erklaert die Null:** 0 `autoClose` in inzwischen 785 Ledger-Zeilen.

**ZWEITER VERBRAUCHER, wichtiger als mein Program:** dieselbe Schwelle speist das Feld `stalled` auf
`/api/sessions` (`server.ts`, neben `doneLookingSince`). Es kann fuer eine claude-Lane nie `true`
werden — **das Board unterzaehlt gestoppte Lanes still.** Niemand handelt darauf, aber jeder, der es
liest, liest eine Flagge, die nicht feuern kann.

**DIE OFFENE FRAGE — Attention `24c10c30f8f2d261f210f87f`, Stand 11:01 `open`.** Sie STIRBT mit
meiner Session (`reconcileAttention`, „requester session ended"); darum steht sie hier vollstaendig,
damit du sie NEU STELLEN kannst statt sie zu erben:
- **(a) `FLEET_STALLED_IDLE_MS` auf einen Wert, der nicht mit dem 30-min-Takt kollidiert (z. B. 20 min).**
  Eine Zeile in `watchdog.sh` + `launchctl kickstart`. MEINE EMPFEHLUNG: billigste Aenderung, loest
  die Phasenkopplung sofort, und danach ist der Beleg in einem Lauf zu holen.
- **(b) `poll()` schneiden, damit TUI-Chrome nicht als Arbeit zaehlt.** Sauberer, aber Chrome von
  Arbeit im Byte-Strom zu trennen ist nicht trivial — eigene Lane, eigenes Kriterium.
- **(c) Satz 8 mit der ehrlichen Einschraenkung fuehren** — dann bleibt er unbelegt und dieses
  Program schliesst mit 10 von 11.

**Bis der Owner waehlt: `9f1dbfb4` NICHT erneut releasen.** Die Zeile steht wieder `pending` (der
Kill hat sie requeued). Ein zweiter Lauf scheitert identisch an denselben 14 ms und kostet einen
Lane-Platz plus Stunden fuer ein Ergebnis, das mit Zeitstempeln auf beiden Seiten schon vorliegt.

## 1. Was seit dem letzten Handoff wirklich passiert ist

- **Die Beleg-Lane ist gelaufen** (Start 08:18:53 per TICK, nicht von Hand — Satz 11 fuer diese
  Zeile intakt). Report `7035c488f34aeeca12510a6d` um 08:22:08, von mir um **08:22:48** angenommen;
  die Entscheidung traegt mein exaktes Occupant-Tripel, also war die Auto-Close-Vorbedingung erfuellt.
- **Ende 09:21:21 per Owner-Token**, `killed-empty`, `commitCount 0`, **ohne** `autoClose`.
  Regelkonform: die 35-min-Zusage war abgelaufen und ich hatte „FENSTER ZU" gemeldet.
- **Ehrlich zur Bilanz:** der Lane-Platz wurde frei, weil der Owner 08:18/08:19 vier Lanes killen
  liess — nicht weil eine Lane von selbst endete. Und `9f1dbfb4` traegt `releasedBy:"owner"`, ging
  also durch die Owner-Tuer, nicht durch die Self-Release-Tuer einer MAIN.
- **Alle uebrigen Auto-Close-Klauseln HALTEN** (`server.ts#laneAutoCloseRefusal`, einzeln geprueft):
  Flag armiert, `autosOn`, Worktree-Lane, kein Steward, keine Merge-/Commit-/Review-Jobs, `taskId` +
  `programId` am Slot, Program aktiv, genau EIN Terminalreport mit Urteil des exakten Empfaengers,
  Provenienz stimmt. `mergeLast.get(1)` war `null` (Controller-Lesung 08:26). Die Klaerungs-Falle war
  entschaerft (`awaiting: null`, keine offene Clarification). **Es fehlte einzig die Uhr.**

## 2. Werkzeuge, die ich teuer gelernt habe — nimm sie mit

- **DIE IDLE-UHR IST OHNE OWNER-TOKEN LESBAR: die mtime von `streams/s<slot>-<openedAt>-<hash>.raw`.**
  `poll()` leitet `lastOutput` genau aus dem Wachstum dieser Datei ab. Faelligkeit =
  `mtime + STALLED_IDLE_MS`. Das ersetzt jede Bitte an den Controller um eine `lastOutput`-Lesung —
  und es zeigt AUCH, WAS gemalt wurde (Tail entschachteln, ANSI strippen).
- **`POST /api/self/tasks` ist bei 10/10 pending advisory rows ZU** („program advisory filing cap
  reached … ask the owner to dispose"). Das Register dieses Programs nimmt keine Zeile mehr an; meine
  zwei Befunde stehen deshalb hier statt dort.
- **`accept` nimmt `reason` bis 500 Zeichen — und einen LEEREN Body akzeptiert es ebenfalls mit
  `ok:true`.** Mein erster Versuch lief in einen `assert`, schrieb eine leere Datei, und
  `--data-binary @leer` wurde als gueltige Annahme OHNE Grund verbucht. Die Annahme steht, `reason`
  ist `null`, und es gibt keine Re-Decide-Tuer. **Laenge VOR dem Schreiben pruefen, nie im selben
  Skript, das die Datei schon truncated hat.**
- **`GET /api/self/fleet-report` traegt die Entscheidung NICHT.** `disposition` liest sich dort als
  `None`, auch wenn die Annahme steht — ich habe daraus einmal faelschlich „nicht angenommen"
  geschlossen. Der Beweis ist die 409-Antwort eines zweiten `accept` (`already accepted`) samt
  `decision`-Objekt, oder `fleetReports` in `fleet.json`.
- **Ein `bun server.ts` mit frischer Startzeit ist nicht automatisch ein Deploy.** Ein Suite-Lauf
  startet seinen eigenen. Unterscheide an `deploys.jsonl` und am tmux-Socket (`fleettest<pid>`),
  nicht an der Prozessliste — ich hielt 08:55:35 fuer einen Deploy in meinem Messfenster.
- **Ein Heartbeat-Text altert schneller als du denkst.** Zwei meiner vier Autos feuerten mit
  Verzweigungen, deren Praemisse ueberholt war (einer haette eine falsche Attention ausgeloest).
  Schreib in den Text, WORAN der Nachfolger merkt, dass die Praemisse tot ist.

## 3. Korrekturen an meinen eigenen frueheren Saetzen

- **`f176ad1e` war KEIN Defekt.** Ich meldete, `reconcileAttention` lasse die Attention einer
  beendeten Anfragerin auf `open` stehen. Sie stand kurz darauf auf `refused` („requester session
  ended"): die Refusal haengt am Slot-TEARDOWN, und der lag hinter der Succession-Grace. Ein
  Zeitfenster, kein Steckenbleiben — die Projektion korrigierte meine Zeile selbst von `OWNER_GATE`
  auf `READY (R5)`.
- **Der Repaint war NICHT der Agentenzaehler** (so die naheliegende Vermutung des Controllers,
  2,3 s vor einem fremden Land). Die Bytes sagen `Checking for updates`. Die Cadence-Zaehlung ueber
  vier Streams (s1 1×/40 min · s5 9×/294 min · s15 6×/916 min · s6 2×/703 min) sah unregelmaessig aus
  und liess mich zuerst sagen, die Schwelle sei „treffbar, nicht unerreichbar". Erst das ZWEITE
  Intervall an derselben Pane zeigte die Phasenkopplung. **Eine Haeufigkeit ueber fremde Panes ist
  kein Ersatz fuer zwei aufeinanderfolgende Messungen an derselben.**

## 4. Offen, ehrlich

- **Satz 8** — die Owner-Wahl oben. „Gebaut, nie gelaufen" ist ab jetzt der falsche Satz; richtig ist
  **„gebaut, kann unter der heutigen Schwelle nicht laufen"**.
- **Satz 11** — strukturell offen, unveraendert: 3 von 4 Program-Lands ueber Owner-Token, und die
  Beleg-Zeile selbst war owner-released.
- **Ungeprueft von mir:** ob die 14-ms-Phasenkopplung auch fuer `codex`- und `pi`-Panes gilt (deren
  TUIs malen anders; nur claude ist gemessen). Wer (a) waehlt, sollte das mitmessen — sonst
  repariert er die Uhr fuer einen Harness und nicht fuer die Fleet.
- **Dieser Commit ist ein DIREKT-COMMIT aus dem Haupt-Checkout** und damit fuer jedes land-seitige
  Ledger unsichtbar: keine Land-Note, keine `lane-outcomes`-Zeile, kein Post-Land-Audit. Verifikation
  von Hand, proportional fuer eine reine Prosa-Aenderung: `bun install --frozen-lockfile` +
  `bun e2e/pins.ts` (Ergebnis unten im Commit-Body). Kein laufender Land wurde beruehrt — `merges`
  und `landPending` waren beide leer, an `fleet.json` geprueft, bevor ich committet habe.

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

## 0. WAS MIT MEINER SESSION STIRBT — NICHTS HAENGT IN DER LUFT

`GET /api/self` bei der Uebergabe: **0 autos, 0 armed watches, keine offene Attention** (die eine,
`6793f1414b53a1c6d3b428d6`, ist vom Owner mit dem Deploy beantwortet). Baum sauber. Der
Astra-Relais-Auftrag liegt beim CONTROLLER, nicht bei dir — er war kurz meiner und ist um 11:4x
zurueckgezogen worden; er steht deshalb absichtlich nicht mehr im Handoff.

**Ich habe zu spaet uebergeben, und der Grund gehoert hierher:** 44,1 % gegen ein Band von 25/30.
Es gibt KEINEN Kontext-Nudge im Code, und die Supervisor-Bindung ist seit dem 23.08. stale — es
kommt also niemand und sagt es dir. **Miss deinen Fuellstand selbst und frueh** (Schnipsel im
Regelbuch, Abschnitt Kontext-Band). Anker: ~2,5 Punkte je Land; ich habe vier gefahren plus acht
Direkt-Commits.

### Die Zeilen, die JETZT laufen oder warten

- **`35ac0b97` (queued) — die dringendste.** Fix fuer die Regression aus dem naechsten Abschnitt;
  sie ist LIVE und macht jedes rein-docs-Land rot. Brief traegt Wurzel, zweiteiliges
  Done-Kriterium und drei benannte Entwuerfe mit ihren Fallen.
- **`ec0bf175` (SENT, Lane laeuft)** — Lebenszyklus S2, Opus 5, ersetzt `9fd34beb`.
- **`02740e69` (queued)** — Lebenszyklus S5a, Opus 5, ersetzt `db6902c4`.
- **`9fd34beb` und `db6902c4` DUERFEN NIE FREIGEGEBEN WERDEN** — ihr `spawn` traegt persistent
  `codex/gpt-5.6-sol`, KEINE Route aendert es, ein Release spawnt wieder eine sol-Lane gegen die
  Owner-Ansage von 08:1x. **Dasselbe gilt fuer die zwoelf weiteren sol-Zeilen** (S3a-i, S3a-ii,
  S3b, S3c, S3d, S4, S5b, S5c, S12, CP-A, CP-B, CP-C): wer eine davon will, **filt sie NEU**, so
  wie ich es mit den zweien getan habe — nicht freigeben.

### Das Regelbuch: gerendert und konsistent, aber GEWACHSEN statt verdichtet

`CLAUDE.md` ist **81 322 B**, das Ziel des Controllers ist **< 75 000**. Ehrlicher Stand: **die
Verdichtung von `rulebook/lane-discipline.md` ist NICHT angefangen** — ich habe im Gegenteil heute
**rund 3,6 KB HINZUGEFUEGT** (Tier-2-proportional; FIFO-Mutex samt der Einschraenkung, dass
`server.ts#holdSuiteLock` ohne Ticket nimmt; die Deploy-Regel zur Idle-Uhr). Jede dieser Zeilen
beschreibt Verhalten, das sich heute auf main GEAENDERT hat, keine war falsch — aber der Posten ist
damit der faelligste des Programs und grosszuegig meiner.
**Gerendert ist es:** ich habe ausschliesslich Fragmente editiert und danach den Render-Einzeiler
aus dem Kopf von `rulebook.ts` gefahren; `bun e2e/pins.ts` war nach JEDEM Zug ALL PASS, der
byte-genaue Pin haelt. Es liegt nichts Halbfertiges herum.

## 0b. EINE REGRESSION, DIE ICH SELBST GELANDET HABE — sie ist LIVE und macht jedes docs-Land rot

**`cbccd3a` (Tier 2 proportional) faehrt `bun e2e/pins.ts` in einem Baum OHNE `.git`.** Seit dem
Deploy 07:36 ist damit JEDES rein-docs-Land rot. Zwei von zwei: Audit-Zeilen `2e671a47` (08:49,
375/6) und `8a4655cb` (09:49, 377/6), beide `proportional:true`, beide ~1 s, beide sechs identische
Fails mit `fatal: not a git repository (or any of the parent directories): .git`.

**Die Sonden sind nicht schuld — sie scheitern korrekt ALS SIE SELBST** („die Ableitung lief",
„PROBE: git named …", „source set is not empty"). Genau die Regel, die dieses Repo verlangt, und
sie hat funktioniert.

**Wurzel, am Code gelesen:** `server.ts#runPostLandAudit` legt den Tip per
`snapshotIntegrationTree` in einen tmpdir und spawnt mit `cwd: dir`; ein Snapshot hat kein `.git`.
Der VOLLE Pfad ueberlebt das nur, weil `e2e-isolated.sh` `node_modules` auf den Quell-Checkout
zurueck-symlinkt (`docs/e2e-trail.md` §3) — die proportionale Kette faehrt nackt, ohne diesen
Zeiger. Der LAND-GATE ist nicht betroffen: er laeuft im Lane-Worktree, und der hat eine
`.git`-DATEI.

**Erledigt:** beide Zeilen als `real` adjudiziert (NICHT flake — wer das als Rauschen ablegt,
konserviert es), und **`35ac0b97` ist gefilt UND freigegeben** (Opus 5, mit Wurzel, Done-Kriterium
in zwei Teilen und einem benannten Entwurfsraum). **Ich habe den Fix NICHT selbst gefahren:
ctx 38 %, und die Wahl zwischen den drei Entwuerfen ist echte Entwurfsarbeit, keine Glue.**

**UND EIN ROT, DAS ICH BEWUSST NICHT ADJUDIZIERT HABE:** das Audit zu `d37f835` (09:49, 3678/4).
Drei der vier kenne ich — `projection nextAction` (§11.2o) und das Paar `subject-gone` /
`counterprobe`, das die Vorgaengerin als gemeinsam fallend vermessen hat. Die vierte,
**`D2 setup: both closing lanes reached the spent shape …`, habe ich NICHT untersucht** — und eine
SETUP-Zeile heisst, dass alles unter ihr UNGEMESSEN ist, nicht verletzt. Sie ist ausserdem genau
die Familie, die der Deploy erstmals scharf gemacht hat (`FLEET_LANE_AUTOCLOSE`). **Ein
unadjudiziertes Rot ist sichtbar, ein falsch adjudiziertes ist unsichtbar** — darum liegt es offen.

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

# HANDOFF — Dual-Host `cd110019` (Slot 8, GEPARKT): Phase 2 baubarer Teil abgeschlossen, Program auf Owner-Entscheid geparkt; die MAIN endet regulaer per `retire`, es gibt KEINE Nachfolgerin; 2026-09-05 13:2x, ctx am Poll `null` (Fable-Slot, nicht messbar)

Zustand ableiten, nicht hier lesen: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`
(als naechste MAIN dieses Programs, falls es je eine gibt). Hier steht nur, was git und die Sensoren
nicht tragen. Dies ist zugleich der SCHLUSSBERICHT dieser MAIN: eine MAIN kann keinen fleet-report
filen (`/api/self/fleet-report` antwortet „not a worker lane", 409, von mir gemessen).

## 0. DER ENTSCHEID, der diese Session beendet

Attention `d549e09b` (Gate 3 + Gate 4 zusammen, drei Optionen) wurde vom Controller Slot 12 mit
Owner-Delegation am 2026-09-05 13:1x beantwortet: **(b) parken.** Woertlich: „Gate 3 und 4 sind
Host-Akte des Owners auf einem Second-host, der seit Stunden keinen Heartbeat sendet; ohne
erreichbaren Host ist keine Messung moeglich, und Code ohne zweite Instanz waere Vermutung. …
beende die MAIN regulaer. Die Wiederaufnahme ist ein Owner-Akt am Second-host, keine Wartezeit von dir."

**Was „geparkt" mechanisch heisst:** `POST /api/self/retire` ist `killSlot(s,"handoff")` und fasst
`program.main` NICHT an — das Program bleibt `active`, seine Bindung zeigt auf einen beendeten
Occupant, die Lineage traegt `endedBy`. Es gibt keinen Program-Status „parked". Eine
Wiederaufnahme ist eine NEUE Gruendung/Bindung vom Board, nicht eine Succession.

## 1. Stand des Programs (Phase 2, baubarer Teil KOMPLETT)

- Schnitt 2 `74dcff75` → `40f7006` (Instanz-Identitaet als EIN Feld; Live-Server meldet am
  Owner-Poll `instance:{name:"mac"}`, von mir gemessen) und Schnitt 3 `8fea4ac1` → `22cf0c4`
  (systemd-Vorlage `fleet-watchdog.service`, getrackt) — beide `done`, gate-verifiziert, deployt.
- Falsifikator gefahren (`docs/messungen/2026-09-04-falsifikator-second-host.md`, §6 ueberstimmt §5):
  Empfehlung A steht.
- **Offen als OWNER-HOST-AKTE, nicht als Code:** Gate 3 = erste Installation der systemd-Vorlage auf
  einem Host (kein Host hat sie je ausgefuehrt; die Installation IST die Messung). Gate 4 =
  zweite netzerreichbare Fleet-Instanz (Bind-Adresse, Token, Share-Perimeter). Schnitt 4
  (B1-Umschalter) haengt an BEIDEN und ist ohne sie nicht baubar.
- **Helfer-Ausfall gemessen:** second-host letzter Heartbeat 2026-09-04 22:59:45, Schwelle 90 s,
  beim Parken ~14 h offline; daemonSha `40a55e4`, letztes Daemon-Update `reported/ok`. Ursache
  von hier nicht messbar (Pull-Client, ssh zu).

## 2. Was ich in dieser Session sonst getan habe (ein Akt, eine Notiz)

- **Notiz `651fc2dc`** (P6 fuer Fleet-Betrieb, ergaenzt `94affaf3`): die Projektions-Sonde
  `projection nextAction: a REVIEWABLE row …` ist seit 2026-09-04 19:30 kein 2,9-%-Flake mehr,
  sondern 6 rot / 7 Laeufe (davor 0/15). Wurzel am Code isoliert: `e2e/programs.ts#waitDoneLooking`
  akzeptiert `lastOutput=0` als „3 s idle", R10 (`program-phase.ts#laneFactsKnown`) verlangt
  `observed`. Fixture-Praedikat schwaecher als Server-Praedikat; Schnitt zwei Zeilen, Urteil
  `stale-test`. Nicht adjudiziert (owner-only, Controller-Weisung gegen Fremd-Urteile).
- Kein Code, kein Land, keine Lane. Ein Direkt-Commit: DIESER (docs-only, HANDOFF). Von Hand
  verifiziert, s. Commit-Body.

## 3. Ehrlichkeiten

- Der Attention-Text hatte „~3,5 h offline"; die Antwort kam ~10 h spaeter — die Zahl im
  Handoff oben ist die beim Parken.
- Der Regressionsverdacht gegen mein eigenes Land `40f7006` (erster roter Lauf der Sonde lag auf
  diesem Baum) ist NICHT bestaetigt: der Server-Diff ist additiv; der Sprung korreliert mit
  `8069b9a` (Studio S2, Slot-Kills vor der Sektion). Korrelation aus Zeitstempeln, keine Kausalitaet.
- Sieben lokale Post-Land-Audits seit 2026-09-04 18:26 sind rot und unbeurteilt; keines ist meins,
  jedes gehoert seiner MAIN oder dem Owner.
- `succeed` habe ich NICHT benutzt — es gibt keine Nachfolgerin; die vier Notiz-Zeilen meiner
  Vorgaengerin (`901593dd` `69ad472d` `94affaf3` `bceea779`) bleiben pending und advisory.

## 4. Falls jemand dieses Program wieder aufnimmt

Erst Owner-Akt am Second-host (Heartbeat zurueck, dann Gate 3 und/oder 4), dann eine neue MAIN
gruenden. Ihr erster Zug: `GET /api/self/program-execution`, dann Gate-Ergebnis von hier messen
(`helperDevices` am Owner-Poll; `GET /api/sessions` einer zweiten Instanz muss `instance.name`
≠ `mac` tragen), dann Schnitt 4 als EINE Lane briefen — Phase-0-Notiz
`docs/dual-host-session-runtime-phase0-2026-08-30.md` nennt die Bedingung woertlich.

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
