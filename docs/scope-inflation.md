# Wenn aus einem Befund ein Programm wird

*Fallstudie und Ideensammlung, 2026-07-26. Ausgelöst vom Datensparmodus
(`data-saver.md` ist die Fallakte mit den Zahlen). Hier steht **nichts Gebautes** —
nur was passiert ist, wo genau es kippte, und welche Ideen es gefangen hätten.
Bewusst ein Dokument und keine Maßnahmenliste: eine Fünf-Punkte-Antwort auf einen
Fünf-Punkte-Fehler wäre derselbe Fehler in Textform.*

---

## 1 — Der Fall, in Zahlen

**Vorgabe des Owners, wörtlich:** „Es muss nichts super ausgefeiltes sein, aber wenn
wir hier auf eine robuste Weise 80-90% der Datenmenge einsparen könnten wäre das echt
gut."

**Die Diagnose** (Messung am Live-Server, ~1 h): `/api/sessions` liefert 112 410 B und
wird alle 2 s gepollt. **107 521 B davon sind ein einziges Feld** — das `tasks`-Array
mit vollen Prompt-Texten. Der naheliegende Verdächtige, der Terminal-Strom, war es
nachweislich nicht: 96–186 KB/min über alle Panes.

**Was daraus wurde:** ein Fünf-Punkte-Programm, aufgeteilt auf vier parallele Lanes,
zusammen ~740 Zeilen Diff, davon der größte Teil dauerhaft in `server.ts`.

**Was gereicht hätte:** Punkt ① allein — das `tasks`-Feld aus dem Poll nehmen. ~87
Zeilen, **95 % der gemessenen Dauerlast**. Das ist innerhalb der Vorgabe, und es war
zum Zeitpunkt der Planung bereits ausgerechnet.

## 2 — Die eine Stelle, an der es kippte

Nicht die Messung. Die war das Beste an der Sache und hat die Richtung gedreht.

Nicht die Zustimmung des Owners. Der sagte „starte all diese Punkte als Lanes" — aber
**die Punkte hatte ich geschrieben.** Eine Zustimmung zu meiner eigenen Aufzählung ist
keine unabhängige Bestätigung des Umfangs.

Der Fehler sitzt exakt dazwischen: **beim Übergang von Diagnose zu Vorschlag.** Ich habe
die gefundenen Hebel nach Wirkung sortiert — richtig — und die Liste dann **nicht
abgeschnitten**. Eine sortierte Liste ohne Schnittlinie ist ein Portfolio, kein Plan.
Der Schnitt war hier mechanisch offensichtlich: wenn ① 95 % liefert, ist alles danach
per Konstruktion optional.

Verschärfend: ich hatte den Schnitt sogar hingeschrieben — „④ nur, wenn ①–③ nicht
reichen" — und ④ dann trotzdem gestartet. Ein notierter Vorbehalt, der die eigene
Handlung nicht bindet, ist Dekoration.

**Merksatz:** der Fehler lag in dem, was ich angeboten habe, nicht in dem, was
genehmigt wurde. Wäre die Liste zwei Punkte lang gewesen, wäre „alle" die richtige
Antwort gewesen.

## 3 — Ideen, die es gefangen hätten

Jede hier steht mit der konkreten Stelle aus diesem Fall, an der sie gegriffen hätte.
Keine davon ist gebaut, keine ist beschlossen.

**a) Die Vorgabe wörtlich zurückzitieren.** Mein Plan hat die Formulierung „muss nichts
super ausgefeiltes sein" nie wiederholt. Ein Plan, der die Latte des Auftraggebers nicht
zitieren und sich daran messen kann, ist bereits abgedriftet. Der Test ist billig und
hätte hier sofort ausgeschlagen.

**b) Die Schnittlinie ist Pflichtbestandteil einer Rangliste.** Nicht „hier sind fünf
Hebel, nach Wirkung sortiert", sondern „diese zwei erfüllen die Vorgabe, die anderen
drei sind ein separater Vorschlag, den du gesondert annehmen oder ablehnen kannst".
Der Unterschied ist nicht kosmetisch: im zweiten Fall muss der Owner drei Dinge aktiv
wollen, im ersten muss er sie aktiv abwehren.

**c) Diagnostik ist kein Sparen.** Punkt ⑤, der Byte-Zähler, spart **null Bytes**. Er
war da, weil ich 430 der 500 MB nicht erklären konnte — ein legitimes Anliegen, aber ein
anderes Ziel. Er ist mitgefahren, weil er benachbart war. Idee: jeden Punkt mit dem
Ziel etikettieren, dem er dient; was dem genannten Ziel nicht dient, braucht eine eigene
Begründung und eine eigene Entscheidung.

**d) Die billige Variante neben der richtigen notieren.** Punkt ③ war als Konstante
erreichbar: `REPLAY_TAIL` von 2 MB auf 64 KB, eine Zeile, fast derselbe Effekt. Gebaut
wurde stattdessen ein sauberer `seedUntil`/`afterSeed`-Mechanismus (~219 Zeilen) — nicht
falsch, die naive Variante hat ein echtes Gap/Overlap-Problem, aber es ist die
strukturell richtige Version, nicht die geforderte. Idee: zu jedem Punkt die **billigste
Variante mit dem Großteil der Wirkung** neben die Variante schreiben, die man bauen
würde, wenn es die einzige Aufgabe wäre. Der Abstand zwischen beiden *ist* die
Umfangsentscheidung, und er gehört sichtbar gemacht statt still zugunsten der
teureren aufgelöst.

**e) „Wer hat die Liste geschrieben?" vor jeder Freigabe.** Wenn der Owner einer
Aufzählung zustimmt, die der Assistent verfasst hat, ist das Zustimmung zur *Rahmung*,
nicht zum *Umfang*. Der ehrliche Zug an dieser Stelle wäre gewesen: „① allein reicht für
deine 80–90 %. Willst du die anderen trotzdem?" — statt vier Lanes zu spawnen und den
Vorbehalt in einem Nebensatz zu vermerken.

## 4 — Warum es unsichtbar blieb: der Fleet-spezifische Teil

Vier Lanes zu starten kostete **einen API-Call und ~40 Sekunden.** Die Kosten fallen
woanders an: beim Review, beim Merge, und dauerhaft als ~740 Zeilen, die jemand am Leben
halten muss.

In einem seriellen Arbeitsablauf hätte ich die Größe spätestens bei Lane 2 körperlich
gespürt — Wartezeit ist die natürliche Reibung, die Überdimensionierung meldet. **Billige
Parallelität entfernt genau diese Reibung.** Sie macht Über-Scoping zum Zeitpunkt der
Entscheidung gratis und erst Stunden später teuer, und zwar für den Owner, nicht für den,
der es beschlossen hat.

Das ist keine Kritik am Lane-Modell — es ist der Preis seines Vorteils. Aber es heißt:
**die Umfangsdisziplin muss vor den Spawn**, weil danach nichts mehr bremst.

### Anmerkung zur Fähigkeitentabelle in `README.md`

`README.md` §"Four capabilities" ordnet **(a) Selection** die Blast Radius „a wasted
lane" zu. Dieser Fall ist ein Selection-Fehler, und die Zahl stimmt nicht: er erzeugte
**drei überflüssige Lanes plus dauerhafte Wartungsfläche in `server.ts`.** Vorschlag,
nicht eingetragen: die Zeile sollte anerkennen, dass ein Selection-Fehler sich
multipliziert, weil Selection auch über die *Anzahl* der Lanes entscheidet, nicht nur
über ihren Gegenstand.

## 5 — Was ausdrücklich NICHT die Lehre ist

**Nicht: weniger analysieren.** Die Messung vorweg war der einzige Grund, warum
überhaupt das Richtige gebaut wurde. Ohne sie hätten wir Kompression gebaut (der Reflex)
und 3× gewonnen statt 20×, und am Terminal-Strom optimiert, der nachweislich unschuldig
ist. Die richtige Form ist **billige Diagnose, schmaler Bau** — die erste Hälfte war
korrekt.

**Nicht: keine Parallelität.** Die vier Lanes haben sauber gearbeitet, sich nicht
verrannt, und ihre Diffs stapeln sich bis auf zwei triviale additive Konflikte. Das
Werkzeug hat funktioniert. Falsch war, wie viel Arbeit hineingegeben wurde.

## 6 — Offen

Der Fall ist **nicht abgeschlossen**. C und D laufen noch. Ob sie sich lohnen, ist
**ungemessen** — genau das ist der Punkt: A landet, dann wird gemessen, und erst
dann entscheidet sich, ob C und D in `server.ts` gehören oder in die Ablage. Wenn
dieses Dokument später gelesen wird und die Frage immer noch offen ist, ist das ein
eigener Befund.

## 7 — Vorschlag für `CLAUDE.md` (nicht eingetragen)

`CLAUDE.md` ist gitignored und wird beim Lane-Spawn nur kopiert — Änderungen daran
gehören als Text gemeldet, nicht aus einer Lane eingetragen (`ungoverned-artifacts.md`).
Zur Übernahme im Haupt-Checkout vorgeschlagen, eine Zeile:

> Bevor aus einem Befund ein Programm wird: die Vorgabe des Owners wörtlich zitieren
> und die Rangliste dort abschneiden, wo sie erfüllt ist. Was danach kommt, ist ein
> separater Vorschlag, keine Lane. Billige Parallelität macht Über-Scoping beim Spawn
> gratis und erst beim Review teuer (`scope-inflation.md`).
