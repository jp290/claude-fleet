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
