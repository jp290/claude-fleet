# P6-Befundregister — Generalsanierung 2026-09

**Warum diese Datei existiert.** Erfolgsmass 6 des Plans verlangt, dass jeder P6-Befund
disponiert wird — „gefixt / begruendet verworfen / als Queue-Zeile uebergeben, nichts still".
Der vorgesehene Weg dafuer ist eine `notiz`-Zeile am Program. Dieser Weg ist **verstopft**:
`POST /api/self/tasks` lehnt mit 409 ab, sobald zehn `pending` advisory-Zeilen mit
`source:"main"` an diesem Program haengen (`server.ts#PROGRAM_MAX_PENDING_ADVISORY`, Default 10,
Ablehnung an der Stelle mit dem Text `program advisory filing cap reached`). Der Deckel ist
richtig konstruiert — er zwingt zur Disposition —, aber solange der Owner nicht disponiert hat,
hat ein Befund **kein Zuhause**, und am 2026-09-02 ist genau deshalb einer im Scratchpad einer
sterbenden Session gelandet. Diese Datei ist das getrackte Zwischenlager, nicht ein zweites
Register: Zeilen, die als Queue-Zeile existieren, stehen hier nur als Verweis auf ihre ID.

**Der Deckel bleibt bei 10 — Entscheid des Owners, an den Fleet Controller delegiert, 2026-09-02.**
Nicht aus Sparsamkeit, sondern weil ein Anheben das falsche Problem loest: `server.ts:2093-2098`
rechnet die Gesamtsumme selbst vor und nachgeprueft stimmt sie — 16 Slots x (5 Arbeits- + 10
Advisory-Zeilen) = 240 gefilete plus 16 x 5 = 80 freigegebene ergeben **320 nicht-terminale Zeilen
gegen nominal `MAX_TASKS = 200`** (`server.ts:1861`). Der Deckel laeuft also SCHON ueber; ihn
global anzuheben verdoppelt den Ueberhang fuer alle Programme, um das lokale Problem eines
einzigen zu loesen. Und der Druck hat gewirkt: er hat genau diese Datei erzeugt — ein
git-getracktes Zuhause, das eine sterbende Session ueberlebt. **Rueckfalltuer**, falls Disponieren
zur wiederkehrenden Steuer wird: `FLEET_PROGRAM_MAX_PENDING_ADVISORY` in `.env`.

Ein Eintrag hier ist **kein** Auftrag. Er wird zur Arbeit erst durch eine Queue-Zeile oder einen
Owner-Entscheid.

---

## B-01 — Der Vorschau-Pfad wirft die Fehlernamen weg (der Audit-Pfad daneben nicht)

*Erfasst 2026-09-02 von der Sanierungs-MAIN Slot 1; hier am Baum `847c17a` nachgeprueft,
korrigiert und um zwei Messungen erweitert. Nicht uebernommen.*

**Die Naht ist eine Asymmetrie zwischen zwei Zeilen, die 130 Zeilen auseinanderliegen.**
Der Helfer-Daemon schickt die Fehlernamen auf BEIDEN Remote-Pfaden: `helper-daemon/daemon.ts`
berechnet sie in `failNamesOf(logPath, trail)` aus der VOLLEN Logdatei (Deckel `FAILS_KEEP = 50`,
daemon.ts:277/284) und legt sie als `fails` in den Report.

  * **Audit-Pfad, `server.ts:13834`** — persistiert sie:
    `...(fails !== undefined ? { fails } : {})`.
  * **Lane-Vorschau-Pfad, `server.ts#reportLaneSuite:13703`** — persistiert sie NICHT. Sie werden
    gelesen (`const fails = helperFailNames(body?.fails)`, :13690) und ausschliesslich als drittes
    Argument von `postLandAuditChecks(tail, exitCode, fails)` benutzt. Gespeichert wird
    `{exitCode, result, reason?, tail, trail?, checks, remote, treeSha, ms}` — die Namen ueberleben
    nur als Zahl in `checks.failed`.

**Was KEIN Befund ist, und das war die erste Fassung dieses Eintrags falsch.** Dass LOKAL
gefahrene Audits keine Namen tragen, ist Absicht und am Typ dokumentiert:
`server.ts:12105` — `fails?: string[];  // remote-only, validated and capped names; absent on
local and historical rows`; der lokale Pfad ruft `postLandAuditChecks(text, exitCode)` ohne
drittes Argument (`server.ts:12904`). Das ist eine Entwurfsgrenze, kein Defekt. Ihre KOSTEN
bleiben trotzdem real und stehen unten als B-02.

**Messung am Ledger `post-land-audits.jsonl` (425 Zeilen, Stand 2026-09-02):**

| Pfad | Zeilen | mit `fails`-Feld | rote Zeilen mit Namen |
| --- | ---: | ---: | ---: |
| lokal | 404 | 0 | 0 von 73 |
| remote | 21 | 3 | 0 von 11 |
| **gesamt** | **425** | **3** | **0 von 84** |

**Und die dritte Messung, die den Fix von `3974883` betrifft:** das `fails`-Feld taucht im Ledger
zum ersten Mal am 2026-09-02 16:02 auf. Seither gibt es drei Remote-Zeilen — `unknown`, `unknown`,
`green`. **Der rote Remote-Pfad mit Namen ist noch NIE gelaufen.** `3974883 fix: carry remote audit
failure names` (2026-09-01 17:54) ist damit fuer genau den Fall, fuer den er geschrieben wurde,
unbewiesen. Das ist keine Anklage gegen den Fix, sondern die fehlende Gegenprobe.

**Kosten.** Ein rotes Remote-Vorschau-Verdikt kann nicht sagen, WELCHE Checks fielen. Die Lane muss
den Lauf lokal wiederholen — also genau die Ersparnis aufgeben, fuer die das Angebot existiert.
Am 2026-09-02 an P4 Slice 3 bezahlt: Remote rot mit 4 Fails bei 3457 Trail-Zeilen, Namen nicht
beschaffbar, derselbe Baum lokal gruen 3466/0. Der Widerspruch blieb ungeklaert und musste als
„nicht als Flake bewiesen" berichtet werden.

**Der groessere Verlust liegt auf der Daemon-Seite.** `tailOf(end, 40)` (daemon.ts:269, aufgerufen
:483) ist ein dummer Letzte-40-Zeilen-Schnitt, nicht signal-first. Fails aus der MITTE eines
3457-Check-Laufs erreichen den Server ueber den Tail nie. `fails` ist die vorhandene Reparatur
dafuer — und sie wird auf dem Vorschau-Pfad fallengelassen.

**Vorgeschlagene Reparatur.** Ein Feld: `fails` auf `j.result` persistieren, so wie `:13834` es
tut. **Gegenprobe gehoert in `e2e/helper-portal.ts`:** ein rot gemeldetes lane-suite-Ergebnis MUSS
seine Fehlernamen fuehren. Ohne diese Sonde ist der Fix nicht bewiesen — und die Messung oben
zeigt, dass genau diese Luecke beim Schwesterfix `3974883` heute offen ist.

**Status:** offen, nicht disponiert. Kein Fix ohne Owner-Freigabe — P6 beginnt laut Plan nach P5,
und der Feature-Freeze steht bis P7.

**Rang:** hoechster der Liste — mit der schwaecheren und darum haltbareren Begruendung.
**B-05** zeigt einen Rot-Abstand von 86 % remote gegen 39 % lokal IM SELBEN ZEITFENSTER. Das ist
kein Alarm (main war in diesem Fenster oft wirklich rot), aber es ist erklaerungsbeduerftig — und
**ohne die Fehlernamen aus B-01 ist der Abstand nicht entscheidbar.** Solange er es nicht ist, darf
die Auslagerung nicht ausgeweitet werden. Das ist der Rang: nicht „das Geraet ist kaputt", sondern
„die Frage ist mit den heutigen Daten unbeantwortbar, und B-01 ist das, was sie beantwortbar
macht".

---

## B-02 — Ein rotes LOKALES Audit nennt seine Fehlernamen nur im Check-Trail, und das weiss niemand

*Gemessen 2026-09-02, unabhaengig bestaetigt vom Fleet Controller Slot 1.*

Aus B-01 folgt betrieblich: fuer 73 rote lokale Audits ist die Ledger-Zeile stumm darueber, WELCHE
Checks fielen. Weder die Zeile noch ihr `out`-Tail tragen es — beide sind auf 4096 B gekappt und
zeigen nur „N FAILURES" plus Elisionsmarker. **Die Namen existieren, aber im Per-Check-Trail**,
und der Weg dorthin ist heute muendliche Ueberlieferung statt Doku:

```
ls -t "${TMPDIR}/fleet-e2e-trail" | head -3
python3 -c "import json;rows=[json.loads(l) for l in open('<trailfile>')];print([r['name'] for r in rows if r.get('ok') is False])"
```

Die richtige Datei ist die, deren Zeilenzahl `checks.ran` der Audit-Zeile entspricht.

**Zweimal belegt, nicht mehr nur behauptet** (Controller Slot 1, 2026-09-02):
`isolated-20260902T161436Z-31724.jsonl` = 3481 Zeilen / 2 fails (deckt Audit `d4bb687a`,
`ran 3481, failed 2`) und `isolated-20260902T135103Z-50990.jsonl` = 3443 / 11 (deckt Audit
`01ccfb30`, `ran 3443, failed 11`).

Das Rezept gilt NUR fuer lokal gefahrene Laeufe — ein Remote-Lauf laesst seinen Trail auf dem
Helfergeraet, und genau dort greift B-01.

**Vorgeschlagene Disposition:** kein Code-Fix noetig, sondern eine Zeile in `docs/e2e-trail.md`
plus ein Verweis aus der Audit-Ansicht. Billigste Variante zuerst pruefen: die Audit-Zeile traegt
`trail` bereits als Feld auf dem Remote-Pfad — ob der lokale Pfad denselben Dateinamen mitschreiben
kann, ist ungeprueft.

---

## B-03 — Auf einer REMOTEN Audit-Zeile ist `checks.failed` belastbar, `checks.ran` nur eine untere Schranke

*Queue-Zeile `8244622e`, gemessen 2026-09-02 von der Sanierungs-MAIN Slot 1. Hier als Volleintrag
uebernommen, damit die Zeile archiviert werden kann, ohne dass der Befund verschwindet.*

Korrigiert die aeltere, zu starke Lesart von `f9db018e`/`df22cf14` („`checks` ist auf dem
Remote-Pfad unbrauchbar"). Das stimmt fuer `ran` und ist fuer `failed` zu grob — und der
Unterschied entscheidet, wie man ein remotes ROT liest.

**Mechanismus** (an `server.ts#postLandAuditChecks` gelesen): findet die Funktion eine Zeile
`N FAILURES` und weicht N von der Zahl der im Tail sichtbaren FAIL-Zeilen ab, rekonziliert sie
gegen `fails[]` — das Array, das der Daemon SEPARAT und UNGEKAPPT schickt. Passt es nicht (`fails`
fehlt, Laenge != N, oder mehr sichtbare FAILs als N), gibt sie `null` zurueck statt einer Zahl.
`exitCode 0` zusammen mit irgendeinem Fehlerbeleg gibt ebenfalls `null`.

**Folge, dreiteilig:**
1. `checks.failed` auf einer remoten Zeile ist entweder RICHTIG oder `null` — nie still falsch
   (Einschraenkung: B-04).
2. `checks.ran` ist eine UNTERE SCHRANKE, gedeckelt durch `HELPER_TAIL_CAP` = 4096 B (~31 Zeilen).
   Es kann einen vollen Lauf nicht bestaetigen und, bei jedem Wert > 0, einen leeren nicht
   ausschliessen.
3. Der Regelbuch-Sensor „`ran:0` bei `green`" verliert remote nicht seine Richtung, sondern seine
   AUFLOESUNG: ein voller 3434-Check-Lauf meldet `ran:22` (Beleg: die Ledger-Zeile fuer `ffdcece` —
   `out` 3990 B, genau 22 PASS-Zeilen darin, `checks.ran` 22, `ms` 1373734, `exitCode` 0), ein fast
   leerer Lauf meldete `ran:3`. Beides sieht „klein aber nicht null" aus.

**Belegbar auf einer remoten GRUENEN Zeile:** `exitCode`, `ms` gegen das Laufzeitband,
`clonedSha == mainSha`, und `ALL PASS` im Tail. **Nicht von dieser Maschine nachpruefbar:** die
Trail-Zahlen eines remoten Laufs — die `ffdcece`-Zeile traegt gar kein `trail`-Feld, und das
Report-Feld ist ohnehin auf 120 Zeichen geschnitten (`server.ts#reportLaneSuite`). Wer eine remote
Trail-Zahl zitiert, zitiert die Selbstauskunft des Helfers.

---

## B-04 — Die eine Bedingung, unter der remote `failed` doch still unterzaehlt

*Queue-Zeile `76e6aa3b`, Korrektur zu B-03, gemessen 2026-09-02.*

B-03s Satz „entweder richtig oder `null`, nie still falsch" gilt nur, WENN die `N FAILURES`-
Summenzeile im 4-KB-Tail steht. Fehlt sie, ist `failureSummaries` 0, es wird nichts rekonziliert,
und auf einem ROTEN Lauf greift weder die allPass- noch die `exitCode`-0-Schranke: `failed` waere
dann die Zahl der im Tail sichtbaren FAIL-Zeilen — eine stille **Unterzaehlung**. Das ist der
einzige bekannte Pfad dorthin.

**Drei unabhaengige Lagen stehen heute dagegen, alle am Code gelesen:**
1. `helper-daemon/daemon.ts#report` schickt `tailOf(end, 40)` — die letzten 40 nicht-leeren Zeilen
   der letzten 64 KB; `N FAILURES` ist die letzte Zeile von `./e2e-isolated.sh`.
2. `server.ts#retainSection` nimmt Signalzeilen RUECKWAERTS vom Ende
   (`for (let i = lines.length - 1; ...) if (FAIL_LINE.test(...))`), und `FAIL_LINE` matcht
   `FAILURES?` — die Summenzeile wird also ZUERST genommen, nicht zuletzt.
3. `fails` stammt aus `failNamesOf` auf der VOLLEN Logdatei, Deckel `FAILS_KEEP = 50`; bei mehr als
   50 Fehlern weicht `fails.length` von N ab und `postLandAuditChecks` gibt `null` — es faellt nach
   ehrlich, nicht nach falsch.

**Ausloesebedingung, falls sie je jemand sieht:** ein Suite-Wrapper, der NACH seiner Summenzeile
noch mehr als 40 Zeilen druckt. Wer einen solchen Wrapper baut, macht `failed` remote still falsch.
Das ist die eigentliche Nutzung dieses Eintrags — er ist eine Warnung an kuenftige Wrapper-Autoren,
kein offener Defekt.

**Nebenbefund, der hier festgehalten gehoert:** eine Task-Zeile ist nicht editierbar (es gibt kein
`PATCH` auf `/api/tasks`). Genau deshalb musste die Korrektur zu `8244622e` eine ZWEITE Zeile
werden und hat einen zweiten Advisory-Platz verbraucht. Im Register kostet dieselbe Korrektur
einen Absatz.

---

## B-05 — Der Rot-Abstand des Helfergeraets ist offen; die Auslagerung ist schneller, nicht langsamer

*Messung des Fleet Controller (Slot 1) an `post-land-audits.jsonl`, Filter `ms >= 300000`.
Von der Sanierungs-MAIN unabhaengig nachgerechnet und bestaetigt. **Zweite Fassung** — die erste
verglich schief, siehe „Methodensatz" unten; sie ist der Grund, dass dieser Abschnitt existiert.*

Vergleichsfenster = die Spanne, in der es ueberhaupt Remote-Laeufe gibt (2026-08-29 12:32 bis
2026-09-02 21:44). Zahlen der Sanierungs-MAIN, erhoben ~20:15; der Controller erhob ~20:10 und
kam auf `remote n=13` / `lokal n=36` — die Differenz ist Zuwachs des Ledgers in fuenf Minuten,
keine Abweichung.

| | n | rot | Rot-Quote | gruen | unknown | p50 | p90 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **remote** | 14 | 12 | **86 %** | 2 | 0 | **1323 s** | 1419 s |
| **lokal, GLEICHES Fenster** | 38 | 15 | **39 %** | 19 | 4 | **1557 s** | 1801 s |
| lokal, ganze Historie | 324 | 70 | 22 % | 242 | 12 | 963 s | 1557 s |

Die dritte Zeile steht nur da, um zu zeigen, warum sie NICHT hierher gehoert.

**(1) Remote ist SCHNELLER als lokal — rund 15 % (1323 s gegen 1557 s).** Die erste Fassung dieses
Eintrags behauptete das Gegenteil („remote ist langsamer, der Gewinn ist NICHT die Laufzeit"). Das
war falsch, und zwar in beiden Haelften. Der Mechanismus dahinter ist der eigentliche Befund:
**lokale Laeufe sind unter Last langsam, weil sie sich am Suite-Mutex gegenseitig behindern** — an
diesem Nachmittag liefen zeitweise drei Wrapper gleichzeitig —, waehrend das Helfergeraet bei
load 0 arbeitet. Die Auslagerung zahlt also DOPPELT: der lokale Mutex bleibt frei UND der Lauf ist
schneller. Genau darum ist die p50-Zahl der ganzen Historie (963 s) hier irrefuehrend: sie mittelt
ueber ruhige Tage, an denen niemand ausgelagert haette.

**(2) Der Rot-Abstand ist 86 % gegen 39 % — erklaerungsbeduerftig, aber kein Alarm.** Drei der
zwoelf Remote-Rots sind abgebrochene Kurzlaeufe (597 / 656 / 660 s — `./e2e-isolated.sh` exitet auf
dem ersten FAIL, ein schneller Lauf ist ein abgebrochener); ohne sie bleiben 9 von 11 gegen 39 %.
Der Abstand bleibt, aber `main` war in diesem Fenster tatsaechlich oft rot, und bei `n = 14` ist
das eine OFFENE FRAGE, keine Anklage gegen das Geraet. Dazu der Einzelfall vom selben Tag: P4
Slice 3, derselbe Baum, remote ROT mit 4 Fails — lokal GRUEN 3466/0.

**Rangordnung, die daraus folgt:** das Helfergeraet bleibt als Entlaster des lokalen Suite-Mutex
wertvoll und soll weiterlaufen. Als alleinige Quelle eines VERDIKTS taugt es erst, wenn der
verbleibende Abstand erklaert ist — und erklaerbar wird er erst mit den Fehlernamen aus **B-01**.
Deshalb traegt B-01 den Rang, nicht dieser Eintrag.

**Ehrlich zur Belegstaerke:** `n = 14` traegt die Perzentil-Aussage knapp; die Rot-Quoten-Aussage
ist ein Indiz, keine gesicherte Rate. Was hier NICHT gemessen ist: die Ursache des Abstands —
Geraet, Umgebung, Nichtdeterminismus unter fremder Last, oder echte Defekte, die nur dort sichtbar
werden. Diese Frage ist ohne B-01 nicht beantwortbar, und das ist der ganze Punkt.

---

## B-06 — Ein Deploy toetet einen laufenden LAND, obwohl er einen laufenden AUDIT schuetzt

*Gemessen 2026-09-02 23:46 an der eigenen Land-Kette der Sanierungs-MAIN Slot 3. Neu, keine
Queue-Zeile.*

`POST /api/deploy` lehnt mit **409** ab, solange ein Post-Land-Audit laeuft — ausdruecklich, weil
ein `srv`-Kill mitten im Audit ein falsches Rot erzeugt. **Fuer einen laufenden LAND gibt es diese
Sperre nicht.**

**Beobachtet, nicht hergeleitet:** waehrend der dritte Land-Versuch von `c74706b0` lief, hat ein
Deploy auf `668d6ff` den Server neu gestartet (`bun server.ts` seit 23:45:59, Ledger-Zeile
`deploys.jsonl` 23:46:00 `ok:true`). Der Merge-Job kam terminal als
`status:"interrupted", landed:false, verify.ok:null` zurueck — **verify hat nie gelaufen**, es gab
also gar kein Urteil ueber den Baum. Die Lane war zu diesem Zeitpunkt bereits rebased (`ee020be` →
`a5fea1c`); kein `land-inflight.json` blieb liegen, der Worktree blieb sauber.

**Warum das die falsche Haelfte ist, die geschuetzt wird.** Ein unterbrochener Audit kostet ein
falsches Rot auf einer Ledger-Zeile, die nichts gated. Ein unterbrochener LAND kostet einen
Gate-Lauf (hier 4 min) und laesst eine Lane in einem Zustand zurueck, den ihr eigener Bericht nicht
mehr beschreibt: rebased auf einen Stand, den niemand verifiziert hat. Landet zwischen Abbruch und
Wiederholung fremde Arbeit auf `main`, verschiebt sich der Kandidat erneut.

**Kosten hier gering, weil der Zufall guenstig lag:** der Abbruch traf die Phase VOR dem
Ledger-Schreiben. Ein Abbruch NACH der `main`-Bewegung, aber vor der Land-Note, haette einen
Commit auf `main` ohne Provenienz-Note hinterlassen — und die Note ist die einzige Quelle dafuer,
wer gelandet hat und mit welchem Verify.

**Vorgeschlagene Reparatur:** dieselbe 409-Sperre, die der Audit schon hat, auf einen laufenden
Merge-/Land-Job ausweiten (`mergeJob`-Inflight). Gegenprobe gehoert neben die bestehende
Audit-Sperre in `e2e/` — ein Deploy bei laufendem Land MUSS 409 antworten. **Nicht** als
stiller Retry loesen: der Operator soll sehen, dass er wartet.

**Status:** offen. Ein Advisory-Platz ist seit der `d2e4f219`-Konvertierung frei, falls der Owner
das lieber als Queue-Zeile fuehrt.

---

## B-07 — Nachtrag zu `372b3cef`: der SPENTe merge-Watch ist PERSISTIERT und meldet `ok:true`

*Gemessen 2026-09-02/03 an drei Land-Versuchen derselben Zeile. Ergaenzt die Queue-Zeile
`372b3cef`, die nicht editierbar ist (kein `PATCH` auf `/api/tasks`, s. B-04).*

`372b3cef` fuehrt „ein SPENT merge-Watch blockiert die Re-Subscription desselben Ziels". Drei
Beobachtungen schaerfen das:

1. **Die Antwort sieht wie Erfolg aus.** `POST /api/self/watch {"kind":"merge","target":2}` gibt
   `ok: true` zurueck — und darin den ALTEN Watch: gleiche `id` (`6fa290fe`), `armed: false`,
   `firedAt` noch auf dem ERSTEN Land gestempelt. Es gibt kein `error`. **Der einzige Unterschied
   zwischen „abonniert" und „wird nie feuern" ist das Feld `armed`.**
2. **Er ueberlebt einen Server-Neustart.** Nach dem Deploy aus B-06 (frischer `bun server.ts`)
   lieferte dieselbe Anfrage denselben spent Watch. Der Zustand ist also persistiert, nicht
   in-memory — ein Neustart ist kein Rueckweg.
3. **Die Folge trifft genau den vorgeschriebenen Ablauf.** Der Gruendungsbrief einer Program-MAIN
   sagt woertlich: das zurueckgegebene `watch` abonnieren und **ohne zu beobachten** warten. Wer
   das beim ZWEITEN Land derselben Zeile tut, wartet unbegrenzt auf eine Nachricht, die
   strukturell nicht kommt — und nichts in der Antwort sagt es ihm.

**Rangvorschlag:** hochstufen. Das ist kein Komfortmangel, sondern ein Benachrichtigungskanal, der
Erfolg meldet und nichts liefert, auf dem vorgeschriebenen Pfad. Der Ausweg (auf
`GET /api/slots/:id/merge` pollen) ist genau das, was `5da9c4d` abschaffen wollte.

**Reparatur-Richtung** (nicht gemessen, darum als Frage): entweder einen spent Watch bei
Re-Subscription ERSETZEN statt zurueckzugeben, oder die Re-Subscription mit einer eigenen
Ablehnung beantworten („dieser Watch ist verbraucht") — Hauptsache, `ok:true` bedeutet nie wieder
`armed:false`. **Bis dahin gilt operativ: nach jedem `POST /api/self/watch` das Feld `armed`
lesen, nie `ok`.**

---

## Methodensatz — der Zeitfenster-Vergleich (aus dem Fehler in B-01/B-05 gelernt)

> **Ein Vergleich zweier Populationen mit unterschiedlicher Zeitspanne misst die Zeit, nicht den
> Unterschied.**

Die erste Fassung von B-05 stellte 13 Remote-Laeufe aus vier Tagen gegen 324 lokale Laeufe aus der
GANZEN Historie und schloss daraus zwei Saetze, die beide falsch waren: „remote ist ~37 % langsamer"
und „der Gewinn der Auslagerung ist NICHT die Laufzeit". Im gemeinsamen Fenster kehrt sich das um —
remote ist ~15 % SCHNELLER —, und die Rot-Quote schrumpft von Faktor ~4 auf 86 % gegen 39 %.

Es ist dieselbe Fehlerklasse, vor der das Regelbuch bei Flake-Urteilen warnt: eine Population, die
unter anderen Bedingungen entstanden ist, als Kontrollgruppe zu benutzen. Die Maschinenlast dieses
Repos schwankt um mehr als den gemessenen Effekt — die ganze Historie mittelt ueber ruhige Tage.

**Regel fuer jede kuenftige Messung in diesem Register:** das Fenster wird vom SELTENEREN Arm
bestimmt, und beide Arme werden darauf beschnitten. Die unbeschnittene Zahl darf danebenstehen,
aber ausdruecklich als „nicht vergleichbar" beschriftet — nie als Kontrollgruppe. Und: der Fehler
wurde vom Messenden selbst gefunden und gemeldet; das ist der Grund, warum dieser Absatz
existiert, statt dass die falsche Zahl weiterwandert.

## B-08 — ein committeter `HANDOFF.md`-Abschnitt wurde auf `main` still geloescht

**Gemessen** 2026-09-03 11:50–12:00 (Sanierungs-MAIN Slot 9), an den Zeilenzahlen der Commit-Kette:

| Commit | Zeilen | was passierte |
| --- | ---: | --- |
| `ba75249` | 4029 | Stand vor meinem Commit |
| `60884cc` | 4179 | **+150 = mein Handoff-Abschnitt**, committet 11:50:01 |
| `48d3353` | 94 | fremde Session **ERSETZT** die Datei durch nur ihren eigenen Abschnitt |
| `eb89431` | 4170 | „Wiederherstellung des geloeschten Korpus" — aus `ba75249` + eigenem Abschnitt, also aus einem Stand **VOR** `60884cc` |

Meine 150 committeten Zeilen waren damit von `main` verschwunden — **ohne Konflikt, ohne
Fehlermeldung, ohne dass eine der beiden Seiten es haette bemerken koennen**. Wiederhergestellt in
`4a412e6`.

**Zwei getrennt behebbare Fehler:**
1. `48d3353` hat den Korpus **ersetzt statt ergaenzt**. `HANDOFF.md` ist append-only: der eigene
   Abschnitt wird vorangestellt, der Rest bleibt stehen.
2. `eb89431` hat **aus einer Kopie restauriert statt aus git**. `git checkout <parent-des-schadens>
   -- HANDOFF.md` haette den Stand unmittelbar vor der Loeschung geholt (`60884cc`, 4179 Z.) und
   nichts verloren. Eine Wiederherstellung, die ihre Quelle nicht am Elternteil des Schadens
   festmacht, ist eine zweite Loeschung mit gutem Gewissen.

**Warum das strukturell ist und nicht ein Ausrutscher:** `HANDOFF.md` ist die einzige Datei, an der
ALLE Sessions des Fleets gleichzeitig schreiben — und zugleich die Datei, auf der die Nachfolge
beruht. `POST /api/self/succeed` prueft nur, dass ein `HANDOFF.md`-Commit **juenger als die Session**
ist; der Inhalt kann laengst von einem Dritten ueberschrieben sein, und succeed ginge trotzdem
durch. Die Nachfolgerin erbt dann eine Datei ohne den Abschnitt ihrer Vorgaengerin und merkt es nie.

**Done-Kriterium, drei Stufen, getrennt entscheidbar:**
- (a) ein Pin/eine Fixture lehnt einen `HANDOFF.md`-Commit ab, der die Datei um mehr als N Prozent
  **verkuerzt**, ohne dass die Commit-Nachricht das ausdruecklich benennt. Die Loeschung von 4029 auf
  94 Zeilen waere daran gescheitert.
- (b) `succeed` prueft zusaetzlich, dass der juengste `HANDOFF.md`-Commit der **eigenen** Session
  gehoert und die Datei seither nicht gekuerzt wurde.
- (c) Alternative, die die Kollisionsflaeche ganz aufloest: ein Abschnitt je Datei unter
  `docs/handoffs/<slot>-<ts>.md` statt einer gemeinsamen Datei.

**Nicht als Queue-Zeile gefilet:** der Advisory-Deckel stand auf 10/10
(`program advisory filing cap reached — ask the owner to dispose or drop one first`). Genau der
Grund, aus dem dieses Register existiert.

## B-09 — der `ff-lost`-Fix ist NICHT rueckwirkend: ein Merge-Record von VOR dem Deploy sperrt seine Lane dauerhaft

**Gemessen** 2026-09-03 18:0x (Sanierungs-MAIN Slot 9) an Lane 6 / Task `8990eeb0` (P4 Slice 5+6).
Die Lane ist **fertig, sauber, verifiziert — und strukturell nicht landbar**.

**Der gespeicherte Merge-Record** (`GET /api/slots/6/merge`, `last`):

| Feld | Wert |
| --- | --- |
| `status` | `"error"` |
| `errorReason` | **`null`** ← der Kern des Befunds |
| `landed` | `false` |
| `detail` | „rebase ok, but fast-forwarding main failed: … Diverging branches can't be fast-forwarded … — lane kept" |
| `verify` | **`ok: true`, `exitCode: 0`**, `ms 2064136` (34,4 min), `waitMs 1956000` (32,6 min Schlange) |
| geschrieben | **12:22:19** |

**Der Gate hat gemessen und BESTANDEN** — 108 s Netto-Arbeit nach 32,6 min Warten. Erst danach
scheiterte das Fast-Forward, weil `main` waehrend des Laufs weiterzog.

**Warum das dauerhaft sperrt.** `server.ts` (grep `MERGE_BLOCKING`, `withValidErrorReason` und
`laneSignalView`) sagt es selbst: *„A persisted `errorReason` is the ONE field on this record that
can make a lane done-looking [again]"*. Der Fix `24f9cfc` mintet `errorReason: "ff-lost"` genau
dafuer. Aber:

- Der Record wurde **12:22:19** geschrieben.
- Der Fix wurde **17:23:52** deployt (`0deb6aef`, target `903f5163`).

Also fuenf Stunden zu spaet. `withValidErrorReason` laesst einen Record mit fehlendem
`errorReason` unveraendert durch, `mergeBlocksLane` sperrt weiter, und **der Fix hilft nur Records,
die nach ihm entstehen.** Der laufende Server TRAEGT den Fix (`bootHead 903f5163`, Vorfahre-Probe
positiv) — er kann diesen Record nur nicht heilen.

**Die Sperre ist zirkulaer:** `mergeBlocksLane` verhindert `done-looking` → die Land-Tuer verlangt
`done-looking` → nur ein erfolgreicher Merge ersetzt den Record → ein Merge braucht die Land-Tuer.
Ein Rebase loest es NICHT (selbst gefahren: `247d483`, sauber, 2 ahead, Module byte-identisch,
`server.ts` genau −92 gegen `main`), weil der Record am SLOT haengt, nicht am Baum.

**Zweiter, getrennt behebbarer Defekt — die Ablehnung nennt die Ursache nicht.** Der exakte
Wortlaut der Land-Tuer, woertlich:

> `the lane is not done-looking (no signal) — it must be alive, idle, clean and ahead of its base; let it finish, or commit its work, then call again`

Sie nennt vier Bedingungen und einen Rat. Der Rat ist falsch: die Lane IST fertig und HAT
committet (sauber, 0 untracked, 2 ahead — von zwei Seiten gemessen). Die tatsaechlich verletzte
Bedingung — der blockierende Merge-Record — **kommt in der Nachricht nicht vor**. Wer ihr folgt,
schickt die Lane in eine Arbeit, die nichts aendert; genau das ist hier zweimal passiert
(Land-Versuche 6 und 7, beide mit dieser Meldung).

**Done-Kriterium, drei Stufen, getrennt entscheidbar:**
- (a) **Backfill:** beim Boot bekommt jeder persistierte `status:"error"`-Record, dessen `detail`
  das Fast-Forward-Muster traegt, `errorReason: "ff-lost"` nachgetragen — dieselbe Stelle, an der
  `withValidErrorReason` heute schon jeden Record beim Laden prueft. Fixture: ein Record ohne
  `errorReason` plus ff-`detail` macht die Lane nach dem Boot wieder `done-looking`; ein Record mit
  fremdem `detail` NICHT.
- (b) **Die Ablehnung nennt die verletzte Bedingung**, statt vier zu aufzuzaehlen und die fuenfte
  zu verschweigen — inklusive „ein gespeicherter Merge-Fehler sperrt diese Lane; Grund: <detail>".
- (c) **Ein Ausgang, der keinen Merge braucht:** eine Owner-/Controller-Route, die einen
  blockierenden Merge-Record verwirft (nicht faelscht — verwirft), damit ein zirkulaerer Zustand
  ueberhaupt aufloesbar ist, ohne die Lane wegzuwerfen.

**Kosten dieses einen Slices, weil er beide Defekte getroffen hat:** sieben Land-Versuche, vier
verschiedene Ursachen (§11.2i-Flake · no-progress-Guard 2× · `waitedOut` nach 44,5 min Schlange ·
verlorenes Fast-Forward), plus dieser Deadlock. Der Code selbst ist seit 12:22 vom autoritativen
Gate gruen bestaetigt.

**Nicht als Queue-Zeile gefilet:** Advisory-Deckel 10/10.

---

## B-10 — zwei Checks der Watch/Event-Naht fallen ohne jedes `detail`, und damit ist ihr Rot aus dem Artefakt heraus unerklärbar

**Gemessen** 2026-09-03 am roten Post-Land-Audit auf `5848207f`
(`isolated-20260903T162559Z-69549`, 3527 Checks, 4 FAILs).

Zwei der vier gefallenen Checks in `e2e/watch.ts` rufen `check()` **ohne detail-Argument**:

- `deleting a Watch does not delete its acknowledged event` (`e2e/watch.ts:3457`)
- `subject teardown after event creation leaves the event trail intact` (`e2e/watch.ts:3460`)

Ihre `detail`-Spalte im Trail ist leer, und die aufbewahrten Audit-Ausgabezeilen nennen sie
ohnehin nicht — das ist B-02, eine Ebene tiefer. Wer adjudiziert, hat für diese beiden also
**nur die Basisrate**; die Frage, WARUM sie fielen, ist aus dem Artefakt nicht beantwortbar.

Das ist billig zu schließen, weil beide sichtbar an **derselben** Vorbedingung hängen: beide
prüfen, ob `eventRows()` die Zeile `eventA` noch enthält. Ein einziges `detail` an der ersten
Stelle beantwortet beide.

**Done-Kriterium:** beide `check()`-Aufrufe tragen ein `detail`, das mindestens `eventA?.id`,
das Vorhandensein der Zeile und bei `:3457` zusätzlich `watchRow(wAJ.watch.id)` nennt.
**Verifikation:** die beiden Zeilen zeigen das Argument, und nach einem `./e2e-isolated.sh`-Lauf
trägt die Trail-Zeile beider Checks eine nicht-leere `detail`-Spalte.

**Kosten, wenn es liegen bleibt:** jeder künftige rote Post-Land-Audit mit diesen beiden
Mitgliedern zwingt zu einem ~28-min-Rerun auf dem Suite-Mutex, weil das Artefakt schweigt.

**Nicht als Queue-Zeile gefilet:** Advisory-Deckel 10/10.

---

## B-11 — die aufbewahrte Instanz eines roten Laufs hat ihr eigenes `audit.jsonl` schon weggerottet, und eine Absenz darin liest sich wie eine Antwort

**Gemessen** 2026-09-03 an `$TMPDIR/fleet-e2e-instance-67371`, der Instanz, die derselbe rote
Audit-Lauf „kept … for inspection" hinterlassen hat.

| | |
| --- | --- |
| Laufzeit des Audits | 1 744 s (Beginn ~`1788452759`, Ende `1788454498`) |
| `audit.jsonl` | 438 Zeilen, ältester Zeitstempel **`1788454415020`** |
| `audit.jsonl.1` | 47 Zeilen |
| überlebte Spanne | **die letzten ~83 s von 1 744** |

`AUDIT_ROTATE_BYTES` rotiert, und es bleiben zwei Generationen. Eine Post-mortem-Frage an den
Verlauf des Laufs ist damit strukturell unbeantwortbar — **ohne dass die Datei das sagt.**

**Wie es mich getroffen hat**, und das ist der Grund, warum der Befund hier steht: ich wollte die
Hypothese „`pruneFleetEvents` hat `eventA` verdrängt" an der Abwesenheit von
`fleet_event_prune`-Zeilen prüfen. Die Null war **keine Messung**, sondern das Rotationsfenster.
Eine Absenz sah aus wie eine Antwort — dieselbe Klasse wie „ein grünes Audit mit `ran: 0`".

**Done-Kriterium (eines von beiden reicht):** entweder schreibt eine aufbewahrte Instanz ihr
Zeitfenster sichtbar hin (erster und letzter Zeitstempel je Ledger), oder die Suite hebt
`AUDIT_ROTATE_BYTES` für ihre Instanzen so weit an, dass ein Lauf nicht rotiert.
**Verifikation:** nach einem Lauf deckt der älteste Zeitstempel in `audit.jsonl(.1)` den
Laufbeginn ab, ODER die Marker-Datei existiert und nennt beide Grenzen.

**Nicht als Queue-Zeile gefilet:** Advisory-Deckel 10/10.

---

## B-12 — eine Attention stirbt mit der Session, die sie stellt, und ein Program-MAIN wechselt schneller als der Owner hinsieht

**Beobachtet** 2026-09-03, und es ist die **dritte** Instanz derselben Sache am selben Tor.

`5954d4da` („Zwei Tore der Generalsanierung") trägt heute den Status `refused`. Ihre Geschichte
steht in ihrem eigenen Text: eine Vorgängerin stellte sie 19:13, die Nachfolge tötete sie 19:19
als `requester session ended` — „du hast sie nie gesehen". Meine unmittelbare Vorgängerin hat sie
neu gestellt; sie ist mit deren Nachfolge wieder gestorben. Ich stoße beim Filen von B-10/B-11
auf **exakt dasselbe Tor** (Advisory-Deckel 10/10) und könnte sie ein drittes Mal stellen — mit
derselben Lebenserwartung, denn das Kontextband schickt eine Program-MAIN alle paar Stunden in
die Nachfolge.

**Der Mechanismus ist nicht falsch** — eine Attention ohne lebenden Fragesteller kann keine
Antwort entgegennehmen. Falsch ist die Kombination: **die Frage ist langlebig, der Fragesteller
ist es nicht.** Ein Owner-Tor, das nur so lange sichtbar ist, wie eine Session lebt, ist für
jedes Program mit Nachfolge unerreichbar.

**Was ich statt einer vierten Attention getan habe:** die Befunde stehen getrackt hier (B-10,
B-11), und das Tor steht als erster Punkt im HANDOFF. Das ist ein Zwischenlager, keine Lösung.

**Kandidaten für eine Lösung, keiner davon entschieden:** eine Attention an das PROGRAM binden
statt an die Session (die Bindung existiert bereits — `boundSlot`/`lineage`); oder die
Nachfolge die offenen Attentions der Vorgängerin erben lassen, so wie sie `HANDOFF.md` erbt.

**Nicht als Queue-Zeile gefilet:** Advisory-Deckel 10/10 — was zugleich der Befund ist.

### ENTSCHIEDEN 2026-09-03 (Sanierungs-MAIN Slot 4): der Deckel ist KEIN Owner-Tor, und dies ist die vierte Attention, die NICHT gestellt wird

Ich habe das Tor nachgerechnet statt es weiterzureichen. `POST /api/self/tasks` zählt für den
Deckel ausschließlich Zeilen mit `source: "main"` (`server.ts`, die Cap-Prüfung neben
`PROGRAM_MAX_PENDING_ADVISORY`): **10 von 14** offenen Advisory-Zeilen dieses Programs sind so
gezählt, die anderen vier sind Owner-Entwürfe und zählen nie mit. Der Deckel ist also wirklich
voll — und trotzdem blockiert er Erfolgsmaß 6 nicht.

**Der Grund steht im Erfolgsmaß selbst.** Es verlangt je Befund einen von drei AUSGÄNGEN:
gefixt · begründet verworfen · als Queue-Zeile übergeben. Dieses Register ist keiner der drei —
es ist die **Befundliste**, die dort disponiert wird. Der Deckel verschließt genau EINEN der drei
Ausgänge, und auch den nur so lange, wie zehn Zeilen undisponiert liegen. Ein Befund, der hier
getrackt und committet steht, ist nicht „still"; er ist gelistet und wartet auf seinen Ausgang.

**Damit ist der ehrliche Satz nicht „das Zwischenlager ist keine Lösung", sondern:** das
Zwischenlager ist der richtige Ort, und was fehlt, ist die Disposition der zehn Zeilen — und die
gehört in P6, nicht vor P4. Wer vor P6 hierher zeigt, verwechselt eine Reihenfolge mit einem Tor.

**Was der eigentliche Befund von B-12 bleibt** (unverändert, und er ist ein echter): eine
langlebige Frage hängt an einem kurzlebigen Fragesteller. Das ist ein P6-Befund am Attention-
Mechanismus, kein Grund, das Programm anzuhalten.

---

## B-13 — die Begründung der Flake-Adjudikation zu `6b8b89d` (Slice 7a), weil sie in 300 Zeichen nicht passt

**Ereignis** `at=1788462365585`, Audit auf `mainSha 6b8b89d` (Slice 7a, `server/proc.ts`),
gefahren vom Remote-Helfer `second-host`, `exitCode 1`, `checks {ran: 24, failed: 3}`,
`ms 1398441`. Adjudiziert **`flake`** — die Kurznote an der Zeile verweist hierher.

**Zuerst die Zeile selbst lesen, sonst liest man sie falsch.** `ran: 24` sieht wie eine
Enthauptung aus (ein echter Lauf liegt bei ~3.500). Ist es nicht: auf einer REMOTEN Zeile ist
`ran` nur eine untere Schranke (**B-03**), belastbar ist `failed`. Die 23,3 Minuten Laufzeit
belegen einen vollen Lauf. Wer hier „nichts wurde gemessen" schließt, verwirft ein echtes
Ergebnis; wer `ran: 24` für die Checkzahl hält, meldet einen Absturz, den es nicht gab.

**Die drei FAILs** — alle drei in der Watch/Event-Transportfamilie von `e2e/watch.ts`:

1. `subject-gone: the torn-down lane's undelivered event is terminal as itself, unackable, and frees its budget`
2. `counterprobe: the live subject's held event is delivered on its FIRST attempt; the dead one is never typed`
3. `restart keeps the busy pending event with the same id and no invented attempt` (§11.2l)

**Beleg 1 — das lokale Trail-Register, selbst ausgezählt** (30 `isolated-*`-Läufe auf Platte,
`$TMPDIR/fleet-e2e-trail`; die Route `/api/self/flakes` sieht nur die 400 neuesten Dateien und
taugt für eine historische Familie per Konstruktion nicht — `docs/e2e-trail.md` §7):

| Check | rot / Läufe | Basisrate | jüngstes Rot |
| --- | --- | --- | --- |
| `subject-gone` | 7 / 30 | 23 % | `isolated-20260903T162559Z-69549` |
| `counterprobe` | 5 / 30 | 17 % | `isolated-20260902T135103Z-50990` |
| `restart …busy pending` | 8 / 30 | 27 % | `isolated-20260903T162559Z-69549` |

Der Lauf `162559Z` trägt **zwei der drei** rot und liegt **~65 min vor** dem Commit `887bf29`.
Ein Rot auf einem früheren Baum widerlegt die Attribution — das ist dieselbe Beweisform, mit der
§11.2l entschieden wurde, und sie ist stärker als jeder Rerun.

**Beleg 2, unabhängig vom ersten.** Die Lane hat die volle `./e2e-isolated.sh` **zweimal seriell
auf genau diesem Baum** (`887bf29`) gefahren: 3547 Checks, beide Male **exakt ein** FAIL — Nr. 3.
`subject-gone` und `counterprobe` waren dort **grün**. Gleicher Code, gleiche Maschine, grün: die
beiden können vom Schnitt nicht verursacht sein.

**Beleg 3, mechanisch.** Der Slice bewegt vier Funktionen (`byteLen`, `retainRunOutput`,
`descendantPids`, `killProcessTree`) als reinen Move — im `diff --color-moved=dimmed-zebra`
bleiben 17 nicht-Move-Zeilen übrig (Import, vier `export`-Präfixe, Modulkopf, Leerzeilen).
`tickWatches` und der Event-Zustellpfad haben **null** Referenzen auf eines der vier Symbole.

**Was dieses Urteil NICHT stützt, und das gehört dazu:** der Trail dieses konkreten Laufs liegt
unter `/var/lib/fleet-helper` auf dem Helfergerät und ist von hier nicht lesbar (`df22cf14`). Für
DIESES Artefakt bleibt die Innensicht unzugänglich; das Urteil steht auf dem lokalen Register und
den zwei Lane-Läufen, nicht auf dem Lauf selbst. Ein `unknowable` wäre die vorsichtigere, aber
falschere Antwort gewesen: zwei unabhängige Beweislinien zeigen auf dieselbe Ursache.

**Nebenbefund, dritte Instanz von `7e984bde`:** die 300-Zeichen-Grenze der Adjudikationsnote hat
diese Begründung erneut aus der Zeile in ein Dokument gedrängt. Das Urteil steht damit an einem
Ort, den `state.sh` und die Audit-Ansicht nicht lesen.

---

## B-14 — der REMOTE-Audit-Pfad ist dreimal so rot wie der lokale, und die Rots sind fast alle EINE Testfamilie

**Gemessen** 2026-09-03 an `post-land-audits.jsonl` (448 Zeilen), ausgelöst durch zwei
aufeinanderfolgende rote Audits mit *identischen* FAIL-Namen auf *verschiedenen* Bäumen
(`6b8b89d` Slice 7a, `1e5419c` B-06).

| Pfad | Zeilen | rot | grün | unknown | Rot-Anteil der ENTSCHIEDENEN |
| --- | ---: | ---: | ---: | ---: | ---: |
| remote (`second-host`) | 29 | 17 | 3 | 9 | **17/20 = 85 %** |
| lokal | 419 | 82 | — | — | **82/419 = 20 %** |

**Und die Rots sind nicht gestreut.** Jeder rote Remote-Lauf, dessen `fails[]` überhaupt Namen
trägt (die älteren sind leer — das Feld kam erst mit `3974883`), zieht ausschließlich aus der
Watch/Event-Transportfamilie von `e2e/watch.ts`: `subject-gone` · `counterprobe` ·
`restart keeps the busy pending event …` · `a dead receiver leaves its event inspectable as
receiver-gone in the owner view` · `busy -> later idle delivers the SAME pending event exactly
once`. Fünf Namen, eine Naht.

**Der Beleg, der die Maschine als Ursache ausschließt:** die B-06-Lane hat denselben Inhalt
Minuten vorher über das Suite-Portal auf **demselben `second-host`** fahren lassen — 3542 Checks,
**0 FAILs, grün**. Gleiche Maschine, gleicher Baum-Inhalt, entgegengesetztes Ergebnis. Der
Unterschied liegt also nicht am Gerät, sondern an der Art, wie der AUDIT dort läuft (Timing,
Nebenlast, oder eine Vorbedingung, die der Audit-Pfad nicht herstellt und der Portal-Pfad schon).

**Warum das mehr ist als „noch eine Flake-Zeile":** ein Sensor, der bei 85 % seiner entschiedenen
Läufe rot zeigt, ist kein Alarm mehr, sondern Rauschen. Jedes einzelne Rot kostet heute eine
Adjudikation von Hand (zwei allein an diesem Abend), und die Gewöhnung daran ist genau der
Mechanismus, mit dem ein echtes Rot künftig durchrutscht. Das gehört neben E1: E1 macht die
Fail-Namen und `checks.ran` ehrlich — **dieser Befund fragt, warum der remote gefahrene Audit
überhaupt so viel häufiger fällt.**

**Was ich NICHT kontrolliert habe, und es könnte die Zahl erklären:** die Remote-Zeilen sind
jünger und dichter beieinander (der Helfer-Pfad ist neu), die lokalen decken die ganze Historie
ab. Die 20 % lokal sind also über einen anderen Zeitraum gemittelt als die 85 % remote. Ein
sauberer Vergleich nimmt nur Läufe seit dem ersten Remote-Audit — das habe ich nicht gerechnet.
Die Assoziation ist gemessen, die Kausalität ist es nicht.

**Vorgeschlagenes Done-Kriterium:** entweder fällt die Remote-Rotrate dieser Familie nach einer
benannten Ursache auf die lokale Basisrate, oder der Audit-Pfad stellt die Vorbedingung her, die
der Portal-Pfad offenbar hat. **Verifikation:** zehn aufeinanderfolgende Remote-Audits, Rotrate
dieser fünf Checks gegen die lokale Basisrate.

---

## B-15 — die neue Spent-Watch-Ablehnung kennt den Merge-LAUF nicht, nur die Lane-Identität

**Gefunden** 2026-09-04 beim Review von B-07 (`30cc5d5`), VOR dem Land, und bewusst nicht als
Blocker behandelt.

B-07 schließt einen echten Fehler: ein verbrauchter merge-Watch wurde als `existing:true`
zurückgegeben, was für den Abonnenten ein stilles Für-immer-Warten war. Der Fix ist ein strikter
Fortschritt. Er hat aber einen Rest, den der Brief nicht abdeckte:

`createWatchForSlot` löst die Merge-Identität als `{t, cwd, branch, terminal}` auf —
`mergeTerminalFor(t.id, t.cwd, branch)`. **Es gibt keine Kennung des einzelnen Merge-LAUFS.** Die
neue 409-Bedingung fragt „hat für diesen Empfänger *irgendein* Watch auf (Slot, cwd, Branch)
schon gefeuert" — nicht „auf dieses Terminal".

**Der Restfall:** Merge 1 auf einer Lane settlet (z. B. `blocked`), der Watch feuert. Später läuft
auf **derselben** Lane-Identität Merge 2 und settlet ebenfalls, BEVOR der Empfänger erneut
abonniert. Dann ist `identity.terminal` gesetzt, ein gefeuerter Watch existiert — und der
Empfänger bekommt 409 mit der Begründung „no newer merge is running", die in genau diesem Moment
wörtlich stimmt und trotzdem in die Irre führt: ein neuerer Merge *ist gelaufen*, und sein Ausgang
ist über einen Watch nicht mehr erreichbar.

**Warum das trotzdem kein Blocker war:**
- Der dokumentierte Ablauf abonniert unmittelbar nach dem Land-POST; ein Merge braucht die volle
  Gate-Kette (100–140 s gemessen), ist also beim Abonnieren praktisch nie schon terminal.
- Das ALTE Verhalten war im selben Szenario schlechter (stiller Für-immer-Wait statt einer
  irreführenden 409).
- Zwei Merges auf derselben `(Slot, cwd, Branch)`-Identität entstehen fast nur beim Re-Land nach
  einem blockierten Merge — das ist B-09s Szenario, und dort abonniert der Empfänger ebenfalls
  direkt nach dem POST.

**Done-Kriterium:** die Ablehnung unterscheidet den Lauf — entweder trägt `MergeLast` eine
Lauf-Kennung (oder einen Zeitstempel), die der gefeuerte Watch mitschreibt und die Bedingung
vergleicht, oder die Ablehnung nennt ehrlich, dass ein neuerer Merge bereits terminal ist, und
verweist auf `GET /api/slots/:id/merge`. **Verifikation:** eine Fixture mit zwei
aufeinanderfolgenden Terminals auf derselben Lane-Identität, bei der das zweite Abo den zweiten
Ausgang erfährt.

**Nicht als Queue-Zeile gefilet:** Advisory-Deckel 10/10 (siehe B-12) — hier als Registerzeile
disponiert, so wie es der B-12-Entscheid vorsieht.

---

## B-16 — OFFEN: hat B-06 die Fehlerrate des Merge-Resolution-Guards angehoben? (Testreihenfolge, nicht Verhalten)

**Angestossen** 2026-09-04 durch den roten Vorschaulauf der E1-Lane. Der zweite FAIL,
`⏸ a re-run is refused while the resolution is still rebased onto main (guard unchanged)`
(`e2e/merge.ts#⏸-re-run-guard`), war keiner der bekannten drei und wurde deshalb eigens
ausgezählt: **2 rot in 27 lokalen `isolated`-Trails (7,4 %).**

**Die E1-Lane ist damit entlastet, und das ist entschieden:** der eine Rot-Lauf
`isolated-20260902T220305Z-86314` liegt am 2026-09-03 00:03 Ortszeit — **rund 22 Stunden vor**
dem Land von B-06 (`1e5419c`, 22:52) und lange vor E1s Ast. Ein Rot auf einem früheren Baum
widerlegt die Attribution.

**Was NICHT entschieden ist, und darum steht diese Zeile hier:** der *zweite* Rot-Lauf
`isolated-20260903T221141Z-89964` liegt am 2026-09-04 00:11 — **1 h 19 min nach** dem B-06-Land.
Und B-06 hat ausgerechnet `e2e/merge.ts` angefasst: es setzt für seine Deploy-Sonden ein
`restartSrv({FLEET_DEPLOY_BUILD_CMD, FLEET_DEPLOY_RESTART_CMD})` **mitten in die Sequenz** und
stellt am Ende mit `restartSrv()` wieder her. Ein Server-Neustart mitten in einer Suite ist genau
die Art Eingriff, die nachgelagerte Zustands-Fixtures perturbieren kann — und der
Resolution-Guard bei `:450` ist nachgelagert.

**Zwei rote Läufe sind keine Rate.** 2/27 lassen sich mit einer bereits vorher existierenden
Flake genauso erklären wie mit einer neuen Reihenfolge-Fragilität. Ich behaupte hier nichts;
ich halte fest, dass die Frage nach meinem eigenen Land offen ist, statt sie mit der
Entlastung der E1-Lane mit zu erledigen — das sind zwei verschiedene Fragen, und nur die erste
ist beantwortet.

**Done-Kriterium:** die Rate dieses Checks über zehn `isolated`-Läufe auf Bäumen MIT B-06 gegen
die zehn davor. Bleibt sie bei ~7 %, ist die Sache erledigt und diese Zeile wird geschlossen;
steigt sie, gehört B-06s `restartSrv()` aus der Mitte der Sequenz heraus (z. B. eigene Sektion
am Ende, oder Sonden ohne Neustart). **Verifikation:** Auszählung im Check-Trail, dieselbe Form
wie oben.

**Billiger Zwischenschritt, falls jemand ihn zuerst will:** prüfen, ob der Guard-Check
überhaupt auf einen Server-Neustart empfindlich ist — dann entscheidet ein Blick statt zwanzig
Läufe.

---

## B-17 — die Tier-2-VORSCHAU verhungert den Land-GATE: ein optionaler Lauf blockiert einen pflichtigen

**Gemessen** 2026-09-04 (03:2x), nachdem der zweite B-07-Landeversuch nach **2 703 s**
(`FLEET_VERIFY_WAIT_MS`, 45 min) mit `status:"resolved"`, `landed:false`, `verify.ok:null` und
`detail: "clean rebase, but verify NEVER STARTED"` aufgegeben hat.

**Der Maschinenzustand in diesem Moment:** drei `./e2e-isolated.sh`-Wrapper, einer hält
`/tmp/fleet-e2e.lock` (pid 97309, 21 min im Lauf), die anderen warten — **einer davon seit
45:37 min, also länger als das gesamte Wartebudget eines Lands.** Ein isolated-Lauf braucht
~25 min; drei in der Schlange sind ~75 min. Ein Land mit 45 min Budget kommt da strukturell
nicht durch.

**Die Asymmetrie ist das Eigentliche.** Der Mutex in `e2e-stage.sh` behandelt alle sieben
Wrapper gleich. Aber sie sind nicht gleich:

| Lauf | Rolle | Konsequenz beim Ausfall |
| --- | --- | --- |
| `./e2e-isolated.sh` als Lane-Vorschau | **Tier-2, ausdrücklich KEIN Gate** | nichts — der Post-Land-Audit fährt denselben Lauf danach ohnehin |
| Land-Gate (`VERIFY_CMD`) | **Gate** | das Land findet nicht statt |

**Ein optionaler Lauf verdrängt also einen pflichtigen, und zwar ohne dass irgendwo eine
Priorität behauptet würde.** Das Regelbuch sagt seit dem Owner-Entscheid vom 2026-08-07
ausdrücklich, die Vorschau sei „Tier-2-Vorschau, kein Gate, und keine Pflicht in jeder Lane" —
der Mutex weiß davon nichts.

**Drei Vorfälle EINER Nacht, die derselbe Mechanismus erklärt:**
1. Die E1-Lane wartete **2 000 s** auf ihr Acquire (`[suite-lock] acquired after 2000s`).
2. Dieselbe Lane hing davor 3 h fest und musste eine Klärung stellen.
3. Dieser Land-Waitout, 2 703 s, ohne dass der Baum je angesehen wurde.

**Und es hängt mit B-14 zusammen:** weil lokale Vorschauläufe die Maschine sättigen, wandern
Audits auf den Remote-Helfer — dessen Rotrate 85 % beträgt. Die Überlastung erzeugt also nicht
nur Wartezeit, sie verschiebt die Messung auf den unzuverlässigeren Pfad.

**Vorgeschlagene Richtungen, keine davon entschieden und keine von mir gebaut:**
- Der Land-Gate bekommt Vorrang am Mutex (eine Prioritätsstufe, kein zweiter Lock).
- Oder: Lane-Vorschauläufe nehmen den Lock gar nicht mehr, sondern werden abgewiesen, solange
  ein Gate wartet — sie sind per Entscheid verzichtbar.
- Oder: das Wartebudget eines Lands wird an die gemessene Schlangentiefe gekoppelt statt an eine
  feste Zahl.

**Done-Kriterium:** ein Land, das startet, während zwei Vorschauläufe in der Schlange stehen,
erreicht seinen Gate innerhalb seines Budgets. **Verifikation:** die `waitMs`/`ms`-Felder der
Land-Note gegen die gleichzeitige Wrapper-Zahl, über zehn Lands.

**Sofort-Umgehung für die nächste Session, kostet nichts:** die Vorschau ist verzichtbar —
brief Lanes so, dass `./e2e-isolated.sh` NUR gefahren wird, wenn der Schnitt `e2e/`, einen
Wrapper oder den Merge-/Land-Pfad berührt, und sonst gar nicht. Genau so steht es ohnehin im
Regelbuch; die E5-Briefs haben es pauschal verlangt, und das war zu viel.

---

## Bereits als Queue-Zeile abgelegte P6-Befunde (nur Verweis, Inhalt lebt an der Zeile)

| ID | Kurz |
| --- | --- |
| ~~`8244622e`~~ | **als B-03 uebernommen** — Zeile darf archiviert werden |
| ~~`76e6aa3b`~~ | **als B-04 uebernommen** — Zeile darf archiviert werden |
| `d2e4f219` | **2026-09-02 vom Controller per `/adopt` zu `kind: auftrag` konvertiert** — `SUITE_OFFER_WAIT_HELD_MS = 800_000` falsch dimensioniert (remote p50 1323 s; 3/13 unter Budget, alle drei ROT — das Budget selektiert auf rot). Bleibt `pending`: der Freeze gilt. Kein Registereintrag noetig, sie ist jetzt Arbeit. |
| `df22cf14` | ein vom Remote-Helfer gemeldeter Audit ... (s. Zeile) |
| `f0c28e8f` | No-Progress-Pfad am Land von `d7b89fd6` |
| `0ac22a00` | Post-Land-Audit hat EIN Budget fuer Warten UND Arbeit |
| `6d2a4d4b` | Land-Gate, gemessen an der Land-Note von `e9c10ee` |
| `af8dd29c` | `server.ts#teardownSlotOccupant` raeumt `reviewCache`, aber nicht `reviewInflight` |
| `e4a001b0` | Claude-Trust-Dialog eines frischen cwd frisst die erste Zustellung |
| `9c7d6e02` | `POST /api/se…` (zweimal identisch reproduziert) |
| `372b3cef` | ein SPENT merge-Watch blockiert die Re-Subscription desselben Ziels |
| `563ec115` | `program-execution` kennt den … (s. Zeile) |
