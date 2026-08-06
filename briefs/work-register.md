# Das Arbeits-Register — Entwurf, 2026-08-06

*Gehört zu Queue-Zeile `1a08e5db`. Der Befund, aus dem es entsteht, steht in
`docs/work-register-2026-08-06.md`; hier steht die **Form**, nicht der Anlass.*

## 1. Wofür es da ist — fünf Fragen, sonst nichts

Ein Register ist gerechtfertigt, wenn es genau diese fünf beantwortet, und es ist überbaut,
sobald es mehr tut:

1. Was ist offen?
2. Was hängt woran?
3. **Was kann gleichzeitig laufen** (Kollisionsfläche)?
4. Wessen Entscheidung ist es?
5. **Gilt die Behauptung noch** (Frische)?

Frage 3 und 5 sind die, für die es heute keinen Ort gibt. Frage 1 und 2 beantwortet die Queue
schon; Frage 4 halb (`needs-you`, `awaiting`).

## 2. Das tragende Prinzip: kein zweites Register, sondern ein Join plus Prüfungen

Der Fehler wäre, eine dritte Liste zu bauen. Die Aufteilung:

- **Die Queue IST die Liste.** Eine offene Sache existiert als Zeile — oder sie existiert nicht.
- **Dokumente sind Erzählung** und zeigen auf Zeilen-IDs. Sie führen nie eine zweite Liste.
- **`register.sh` ist ein LESER**: es leitet die Sicht ab, die zum Orchestrieren fehlt, und
  schreibt nichts, was es nicht neu ausrechnen könnte.
- **Der Rot-Detektor ist ein PRÜFER** in der Pins-Familie: er fängt genau die Drift, die Prosa
  gegenüber Code entwickelt.

Begründung aus dem eigenen Haus: `state.sh` hat gewonnen, weil es ableitet. Von Session 8s
Handoff wurde exakt der Teil benutzt, der ein Skript war.

## 3. Die Quellen — und was jede von ihnen wirklich weiß

| Quelle | Weiß | Weiß NICHT |
|---|---|---|
| Queue (`fleet.json`) | Status, kind, Analyse-Verdict + Alter, `collides` (Modell), Brief, Kommentare | welche Dateien eine Zeile anfassen wird |
| git (Branches, Diffs, Notes, Ledger) | was eine LAUFENDE Lane anfasst, was gelandet ist, wer was bestätigt hat | was eine ungestartete Zeile vorhat |
| Code (Symbol da / nicht da) | ob eine „ungebaut"-Behauptung noch stimmt | ob das Symbol auch benutzt wird |
| Docs/Briefs | Absicht, Begründung, Historie | ob sie noch gilt |

**Daraus folgt die wichtigste Regel des Registers:** es kennt **drei Wahrheitswerte**, nie zwei
— *mechanischer Fakt* · *Modell-Behauptung* · *unbekannt*. Sie werden nie zusammengefaltet. Das
ist dieselbe Disziplin wie `verify.ok: true|false|null` und `wouldConflict: null` = UNKNOWN, und
sie ist hier genauso tragend: eine Kollisionsaussage, die raten darf, hält echte Arbeit an
(live passiert am 2026-08-06, Zeile `db02104d`).

## 4. Der Join, der heute fehlt: `files` auf der Zeile

Kollision ist eine Frage über **Dateien**. Für eine laufende Lane ist sie mechanisch
beantwortbar (`git diff`), für eine ungestartete Zeile nicht — heute rät dort ein Modell.

Der Entwurf verlangt deshalb **ein** neues Feld: `Task.files` (string[], optional). Wer es
setzt: der Owner beim Anlegen, der Refine-Kompiler beim Schneiden (die Landkarte fordert
genau das als Punkt **5.3** — `RefineChild.files` existiert im Vorschlag und wird beim Confirm
in Fließtext gefaltet). Wer es liest: das Register, und später der Dispatcher.

Regel dazu: **`files` fehlt ⇒ Kollision ist `unknown`, nie `nein`.** Das ist die einzige Fassung,
die den Fehlalarm von heute strukturell ausschließt und trotzdem nicht ins Gegenteil kippt.

## 5. Die Ausgabe — Form, an der man sie messen kann

`register.sh` druckt Abschnitte, jeder für sich lesbar, jede Zeile mit Herkunft:

```
=== OFFEN (Queue: 14) ==========================================
id        st       kind  verdict(alt)  fläche              wartet auf
25b79c23  pending  lane  ready (2h)    server.ts,merge-…   —
05ba5609  pending  lane  ready (1h)    server.ts:other…    gehört zu db02104d
db02104d  pending  lane  needs-you     unbekannt           owner
2784427e  pending  lane  needs-you     src/client.ts       owner (brief-drift)

=== IN FLUG (Lanes auf Platte) =================================
slot branch              dateien (git)         a/b   idle   task
5    …7852               docs/…md              1/0   4m     1981be9a

=== BEHAUPTUNGEN, DIE NICHT MEHR GELTEN ========================
FAIL docs/x.md:42 nennt "ungebaut: foo" — server.ts definiert foo
WARN BACKLOG.md:611 Item 13 ohne Zeilen-ID; Text deckt sich mit ed5c352

=== BRIEFS OHNE ZUHAUSE ========================================
briefs/stalled-parked-and-ledger.md — kein gelandeter Commit, keine offene Zeile

=== WAS NEBENEINANDER LAUFEN KANN ==============================
25b79c23 × 2784427e   verschieden (server.ts vs src/client.ts)   [mechanisch]
05ba5609 × 25b79c23   BEIDE server.ts — Datei-Ebene, Funktion ungeprüft  [grob]
db02104d × alles      unbekannt (keine files)                    [unbekannt]
```

Was die Ausgabe **nicht** tut, und zwar bewusst:

- **Sie rankt nicht.** Wichtigkeit ist eine Wertung; ein Skript, das rankt, erzeugt falsche
  Autorität. Sortiert wird nach mechanischen Fakten (blockiert/frei, Alter).
- **Sie ruft kein Modell.** Sie muss in Sekunden laufen, sonst wird sie nicht gefahren.
- **Sie startet nichts.** Dispatchen ist die Aufgabe des Dispatchers.

## 6. Der Rot-Detektor — und warum er eine Fluchttür braucht

Zwei Prüfungen (BACKLOG P-10, seit Juli gefordert, `0` Treffer in `e2e/pins.ts`):

1. Jeder `docs/*.md`-Zeiger in `docs/README.md` löst auf.
2. Kein Doc nennt „ungebaut/unbuilt/nicht gebaut", was `server.ts` definiert.

**Prüfung 2 hat einen bekannten Fehlalarm, und ohne Antwort darauf wird der Detektor innerhalb
einer Woche abgeschaltet:** `promotionEligible` ist *definiert* und wird an zwei Stellen
gelesen — aber **nichts handelt darauf**, und genau das sagt BACKLOG Track A zu Recht. „Definiert"
ist also nicht dasselbe wie „gebaut". Zwei zulässige Auswege, beide vertretbar:

- die Prüfung fragt nach einem **Konsumenten**, nicht nach einer Definition, oder
- die Doc-Zeile trägt eine explizite Marke (`<!-- rot-ok: definiert, aber ohne Konsumenten -->`),
  die der Detektor akzeptiert und **zählt** (eine stumme Ausnahme wäre wieder Drift).

Wer Prüfung 2 ohne einen dieser beiden Auswege baut, hat einen Detektor gebaut, der beim ersten
echten Fall lügt.

## 7. Reichweite: wo es läuft und wo nicht

Die Queue liegt in `fleet.json` (0600) bzw. hinter dem Owner-Token. Also:

- **Haupt-Checkout: volle Ausgabe** (liest `fleet.json` direkt, wie `state.sh` die Ledger liest).
- **Lane: kein Zugriff** — eine Lane sieht nur `/api/self/*`. Das Register ist ein
  **Main-Session-Instrument**, und das gehört in seinen Kopf geschrieben, statt dass es in einer
  Lane still leer ausgibt.
- **Kein Server nötig.** Fällt srv aus, muss das Register trotzdem antworten.

## 8. Die Kosten, ehrlich benannt

1. **Die Queue wird zum Single Point of Failure.** Am 2026-07-28 sind schon einmal alle 39 Zeilen
   gelöscht worden. Wer die Queue zum einzigen Register macht, erhöht den Preis dieses Vorfalls.
   Konsequenz, die zum Entwurf gehört: ein Export (`register.sh --export` in eine gitignorierte
   Datei, oder eine Zeile im Handoff-Ritual), damit ein Verlust rekonstruierbar bleibt.
2. **Ein Register kann nur zeigen, was seine Quellen wissen.** Ein Faden, der nur in einem Kopf
   oder in Prosa existiert, taucht nicht auf. Die Abschnitte „Briefs ohne Zuhause" und
   „Behauptungen, die nicht mehr gelten" sind genau dagegen gebaut: sie machen Prosa als
   *ungelöst* sichtbar, statt sie stumm fehlen zu lassen. Erfinden können sie nichts.
3. **`files` wird anfangs meist fehlen** ⇒ viele Kollisionen stehen auf `unbekannt`. Das ist der
   ehrliche Zustand, nicht ein Mangel des Registers — und es macht sichtbar, wo ein Handgriff
   (Feld ausfüllen) echten Nutzen bringt.
4. **Noch ein Skript.** Gegenmittel ist Größe: jeder Abschnitt eine Bildschirmseite, keine
   Konfiguration, keine Optionen außer `--export`.

## 9. Die kleinste erste Fassung

Nicht alles auf einmal. In dieser Reihenfolge, jede Stufe für sich nützlich:

1. **Abschnitt OFFEN + IN FLUG** — reine Ableitung aus Queue und git. Ersetzt sofort das
   Von-Hand-Zusammensuchen am Session-Anfang.
2. **Rot-Detektor Prüfung 1** (Zeiger lösen auf) — trivial, sofort grün zu halten.
3. **Abschnitt BRIEFS OHNE ZUHAUSE** — mit ehrlicher `ungeprüft`-Kennzeichnung, wo kein
   belastbarer Test existiert (der naheliegende „wird der Brief in einem Commit genannt"
   ist nachweislich untauglich: `briefs/phantom-park.md` = 0 Nennungen, gelandet als `035c1a9`).
4. **`Task.files` + Abschnitt KOLLISION** — erst hier wird das Register zum Orchestrierungs-
   werkzeug, und erst hier lohnt der Schema-Eingriff.
5. **Rot-Detektor Prüfung 2** mit Fluchttür (§6).

Stufe 1–3 sind ein Nachmittag und rühren `server.ts` nicht an. Stufe 4 ist der Punkt, an dem
der Owner entscheiden muss, ob das Feld ihm die Pflege wert ist.

## 10. Woran man merkt, dass es funktioniert

Nicht „das Register existiert", sondern: **die nächste Session muss die Reconciliation von heute
nicht wiederholen.** Konkret prüfbar — am Anfang der nächsten Session `register.sh` fahren und
die Ausgabe gegen `docs/work-register-2026-08-06.md` §3 halten. Fehlt dort ein Posten, ist die
Ableitung unvollständig; steht dort ein Posten, den §3 nicht kennt, hat das Register etwas
gefunden, das ein Mensch übersehen hat. Beides ist ein Ergebnis.
