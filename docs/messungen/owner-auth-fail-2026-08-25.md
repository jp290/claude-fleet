# `owner_auth_fail` 2026-08-25 — 1 219 Zeilen, drei Client-Formen, kein identifizierbarer Client

Messung, keine Mutation: gelesen wurden `/Users/owner/claude-fleet/audit.jsonl` (Stand
25.08. ~15:45), `server.ts`, `src/client.ts`, `server.log`, die Host-Schlüssel aus `.env` und zwei
agenten-lesbare curl-Rezepte. Kein Server gestartet, keine Zeile geschrieben, kein `ps`-Aufruf.
Die Verbesserungs-Vorschläge in §6 sind Folge-Zeilen für den Owner — hier ist nichts davon gebaut.

---

## 1. Antwort zuerst

**Der Client ist aus den vorhandenen Daten NICHT identifizierbar.** Das Ereignis trägt genau zwei
Felder — `ts` und `event` — und es gibt keine zweite Quelle, gegen die man joinen könnte:
`server.log` führt kein Access-Log (§3.3).

Was sich trotzdem beweisen ließ, und das ist nicht wenig:

1. **Aus dem öffentlichen Tunnel kommt kein einziger dieser Fehlschläge** — strukturell
   unmöglich, nicht bloß unbeobachtet (§3.2). Der Anrufer sass im Tailnet oder auf dieser Maschine.
2. **Die Zwischenankunftszeiten trennen drei Client-Formen sauber** (§4). Zwei davon sind
   maschinell, eine ist der Dashboard-Poll-Pump — und dessen Anteil ist ein echter Bug, kein Rauschen
   (§5).
3. Die grosse Form (`SERIAL-400`) **beginnt am 2026-08-06** und gab es davor nie — das datiert die
   Ursache, auch ohne den Anrufer zu benennen (§4.2).

---

## 2. Was das Ereignis trägt — und was nicht

`audit.jsonl` hat **10 664 Zeilen**, davon **1 219 `owner_auth_fail`** (2026-07-21 bis 2026-08-25).
Keine Rotation vorhanden (`audit.jsonl.1` existiert nicht), das ist also der ganze Bestand.

Die Zeile lautet vollständig:

```json
{"ts":1787640719269,"event":"owner_auth_fail"}
```

Über alle 1 219 Zeilen gemessen ist die Schlüsselmenge exakt `{ts, event}` — kein `slot`, kein
`detail`.

**Das ist eine Weglassung an der Aufrufstelle, keine Grenze des Ledgers.** `audit()`
(`server.ts:3472-3478`) nimmt seit jeher `slot` und `detail` entgegen und schreibt beide, wenn sie da
sind; `tokenGate` (`server.ts:14228`) übergibt keins von beiden:

```ts
audit("owner_auth_fail"); // never the attempted token itself — the only owner credential
```

Der Kommentar begründet, warum das *Token* nicht mitfährt. Er begründet nicht, warum **Kanal, Pfad,
Credential-Träger und Host** nicht mitfahren — die tragen kein Geheimnis. Das ist die ganze Lücke.

## 3. Wo das Ereignis entstehen kann — vier Türen, eine Herkunft

### 3.1 Genau eine Sendestelle

`owner_auth_fail` wird an **einer** Stelle geschrieben: `tokenGate` (`server.ts:14225-14231`). Vier
Aufrufer:

| server.ts | Route | wer klopft da normalerweise |
|---|---|---|
| 19009 | `/api/programs`, `…/confirm\|activate\|complete\|discard\|bootstrap-main\|promotion` | Owner-UI, Owner-curl |
| 19018 | `/api/supervisor/bootstrap` | Owner-curl |
| 19037 | `/?token=…` (Login) | Browser-Login, `submitToken` |
| 19189 | **alles darunter** („everything below carries authority") inkl. `/ws/:slot` | Dashboard-Poll, WS-Connect, jedes Owner-API |

Die anderen 401-Pfade **auditieren nicht**: die Self-Familie zahlt dieselben 400 ms und antwortet
401 ohne Ledger-Zeile (`server.ts:18543`, insgesamt 26 Stellen dieser Form), Share-Auth mintet `share_auth_fail`
(`server.ts:19067`). `owner_auth_fail` ist also ausschliesslich das Owner-Gate — eine Lane, die ihren
Self-Token an einer Self-Route verhaut, taucht hier gar nicht auf.

### 3.2 Der öffentliche Tunnel ist strukturell ausgeschlossen — VERIFIZIERT

`.env` setzt beide öffentlichen Hostnamen sowohl in `FLEET_ALLOWED_HOSTS` als auch in
`FLEET_SHARE_HOSTS`:

```
FLEET_ALLOWED_HOSTS='cowork.example.com,console.example.com'
FLEET_SHARE_HOSTS='cowork.example.com,console.example.com'
```

Der Share-Host-Block (`server.ts:18498-18512`) läuft **vor** jedem `tokenGate` und antwortet auf
alles, was nicht in seiner `pub`-Liste steht, mit 404. Was in der `pub`-Liste steht (`/share.js`,
`/xterm.css`, `/icon*`, `/favicon.ico`, `/s/<id>/…`, `/ws-share/<id>`), wird davor bedient — der
statische Zweig bei `server.ts:19184`, `ws-share` darüber. **Kein Pfad vom öffentlichen Hostnamen
erreicht `tokenGate`.**

Bleibt `guard()` (`server.ts:14296-14308`): ein `Host`, der in keiner der beiden Listen steht, wird
mit 403 abgewiesen, bevor irgendetwas anderes passiert. Damit ist die Herkunft eingegrenzt auf
`Host ∈ {100.64.0.1:8790, localhost:8790, 127.0.0.1:8790}` — **Tailnet oder diese Maschine.**
Internet-Hintergrundrauschen (Scanner auf `/.env`, `/wp-login.php`) kann diese Zeilen nicht erzeugt
haben. Das ist der wertvollste Negativbefund dieser Messung: die 486 sind Eigenverkehr.

### 3.3 Es gibt keine zweite Quelle

`server.log` (4 891 Zeilen, 350 KB) protokolliert Slot-/Dispatch-/Audit-Ereignisse, **keine
Requests**. Die 8 `grep`-Treffer auf `401` sind Hex-Fragmente in Session-IDs
(`1d21fa7f-9f7e-401a-…`), kein Statuscode. Es existiert kein Access-Log, kein Reverse-Proxy-Log auf
der Owner-Naht, und `audit.jsonl` führt (bestätigt in `docs/worktrail-B/B1-sharpener-2026-08-23.md`,
§3.3) überhaupt keine Lese-Ereignisse. Ein Join ist mangels zweitem Datensatz nicht möglich.

## 4. Die Zeitverteilung — was die Abstände verraten

### 4.1 Pro Tag (lokal, Europe/Berlin)

```
07-21   3 | 07-23   3 | 07-24   4 | 07-25 318 | 07-26  95 | 07-27   5 | 07-28   7
07-29   1 | 07-30   6 | 07-31  23 | 08-01  23 | 08-03  14 | 08-04  26 | 08-05   3
08-06  31 | 08-07  34 | 08-08   9 | 08-09   9 | 08-10  17 | 08-11   3 | 08-13   3
08-14   5 | 08-15   3 | 08-16  13 | 08-17   2 | 08-19  10 | 08-20   9 | 08-21  14
08-22  13 | 08-23 416 | 08-24  94 | 08-25   3
```

**Zwei Mega-Bursts, nicht einer.** Der Auftrag nennt den vom 23.08.; der vom **2026-07-25** ist
gleich gross und war bisher nirgends beschrieben. Beide Stundenspitzen:
`2026-08-23 10h → 333` (deckungsgleich mit der Zahl im Auftrag) und `2026-07-25 22h → 311`.

Die Tageszahlen im Auftrag (386 am 23.08.) weichen von meiner Messung (416) ab; in UTC gerechnet
sind es 414. Die Stundenzahl 333 stimmt exakt. Ich vermute ein anderes Tagesfenster, habe die
Differenz aber nicht weiterverfolgt — sie ändert keinen Befund. Seit dem 23.08. sind es
**513 Zeilen** (416 + 94 + 3).

### 4.2 Segmentierung: 189 Segmente, drei Formen

Kette bei Lücke > 30 s geschnitten; 32 Segmente haben ≥ 5 Ereignisse und enthalten 935 der 1 219
Zeilen. Klassifikation über den Median-Abstand und den Anteil Abstände < 50 ms:

| Start (Berlin) | n | Dauer s | Median-Abstand | Form |
|---|---|---|---|---|
| 2026-07-25 22:43:37 | **307** | 266 | 636 ms | PARALLEL |
| 2026-07-31 08:25:37 | 18 | 9 | 6 ms | PARALLEL |
| 2026-08-06 19:24:21 | 10 | 4 | 422 ms | **SERIAL-400** ← erstes Auftreten |
| 2026-08-06 19:27:55 | 8 | 25 | 417 ms | SERIAL-400 |
| 2026-08-21 10:47:13 | 6 | 15 | 438 ms | SERIAL-400 |
| 2026-08-22 16:57:45 | 6 | 31 | 430 ms | SERIAL-400 |
| 2026-08-23 10:11:03 | 14 | 26 | 403 ms | SERIAL-400 |
| 2026-08-23 10:12:07 | **317** | 283 | 403 ms | SERIAL-400 |
| 2026-08-23 11:02:06 | 37 | 83 | 426 ms | SERIAL-400 |
| 2026-08-23 13:43:28 | 17 | 7 | 424 ms | SERIAL-400 |
| 2026-08-24 06:14:50 | 7 | 39 | 422 ms | SERIAL-400 |
| 2026-08-24 06:31:42 | 9 | 28 | 427 ms | SERIAL-400 |
| 2026-08-24 13:53:06 | 27 | 37 | 1 439 ms | mixed |
| 2026-08-24 14:05:06 | 29 | 41 | 1 565 ms | mixed |
| 2026-08-24 15:08:12 | 6 | 26 | 407 ms | SERIAL-400 |

(gekürzt auf die aussagekräftigen Zeilen; 17 weitere Segmente der Form „mixed" mit 5–14 Zeilen)

**SERIAL-400 — ein Programm ohne Backoff.** Im Segment `2026-08-23 10:12:07` liegen **291 von 316
Abständen im 400-ms-Eimer**, kein einziger unter 50 ms. Diese 400 ms sind nicht das Netz, sondern
`await Bun.sleep(400)` in `tokenGate` selbst (`server.ts:14227`): der Client hält **genau einen
Request in der Luft** und feuert den nächsten in dem Moment, in dem die Antwort eintrifft. Kein
Timer, kein Backoff, keine Denkzeit — die Taktrate wird ausschliesslich vom Server-Throttle
bestimmt. Das ist die Form einer Warte-/Retry-Schleife (`until curl …; do done`), nicht die eines
Browsers.

**PARALLEL — mehrere gleichzeitige Requests.** Im Segment `2026-07-25 22:43:37` liegen **113 von 306
Abständen unter 50 ms**, mit Bündeln von 3 (22×) und 4 (23×) fast gleichzeitigen Requests. Dazu
Perioden von **2 000 ms (67×)** und **1 000 ms (33×)**.

**mixed** — Median 1,4–2,0 s, ohne Gleichzeitigkeit: dieselbe Periodik wie PARALLEL, nur mit weniger
offenen Panes.

### 4.3 Das Grundrauschen

284 Zeilen liegen in Segmenten mit < 5 Ereignissen. Ihre Stunde-des-Tages-Verteilung hat einen
klaren Gipfel bei **07h (46)** und einen zweiten bei **19h (25)**, sonst 10–20 pro Stunde über den
Tag, nachts 1–12. Das ist Arbeitszeitverkehr, kein Automat mit fester Periode.

## 5. Der Browser-Anteil ist ein Bug — VERIFIZIERT am Code

Die 2-s/1-s-Periodik mit 3–4 simultanen Requests ist deckungsgleich mit dem Poll-Pump des
Dashboards. `src/client.ts:44`:

```ts
const NORMAL = { pollMs: 2_000, chatMs: 1_000, boardMs: 3_000, seed: 0 };
```

`pollMs` treibt `refresh()` → `GET /api/sessions`, `chatMs` treibt pro Pane die Chat-Kette. Drei bis
vier offene Panes auf demselben Tick ergeben genau die gemessenen 3er- und 4er-Bündel.

**Und ein 401 stoppt diesen Pump nicht.** Die Kette, jede Stelle gelesen:

- `api()` (`src/client.ts:189-193`) ruft bei Status 401 `showGate()`.
- `showGate()` (`src/client.ts:169-172`) besteht aus **drei Zeilen**: Overlay einblenden, Eingabefeld
  fokussieren. Sonst nichts.
- `armPolls()` (`src/client.ts:5222`) — die einzige Stelle, die die Timer entwaffnen kann — wird nur
  von `visibilitychange` (`5230`) und vom Data-Saver-Schalter (`5244`) gerufen. **Nie von
  `showGate()`.**
- `refresh()` kehrt bei `if (!res.ok) return;` (`src/client.ts:5085`) still zurück; der
  `setInterval` läuft weiter.

**Ein sichtbarer Tab mit totem Cookie klopft also für immer**: alle 2 s einmal `/api/sessions`, dazu
alle ~1 s je Chat-Pane, jeder Request eine `owner_auth_fail`-Zeile. 307 Zeilen in 266 s ≈ 1,15/s
passt exakt zu einem Tab mit drei bis vier Panes. Der Owner sieht dabei nur das Token-Overlay und
hat keinen Grund anzunehmen, dass im Hintergrund etwas läuft.

**Kosten:** kein Sicherheitsproblem — die Abwesenheit eines Lockouts ist ausdrücklich Design
(`server.ts:14220-14224`: ein zählbasierter Lockout würde einen Fremden den Owner aussperren lassen),
und 1 219 × 400 ms sind zusammen ~8 Minuten gehaltene Requests. Die Kosten sind
**Beobachtbarkeit**: das grösste einzelne Signal im Ledger ist ein vergessener Tab, und weil die Zeile
nichts trägt, war das einen Monat lang nicht sichtbar.

## 6. Drei Mechanismen, die die SERIAL-400-Form erzeugen — HYPOTHESE, nicht Identifikation

Alle drei sind am Code verifiziert; **welcher davon gefeuert hat, sagt der Trail nicht.**

**(a) Ein Self-Token an einer Owner-Route.** `tokenFrom()` (`server.ts:14205-14212`) liest genau drei
Träger: `authorization: Bearer`, das `fleet=`-Cookie, `?token=`. Der Header
`x-fleet-self-token` ist **kein** Träger — eine Session, die ihn an eine Owner-Route schickt, ist für
`tokenGate` credential-los und mintet die Zeile. Das passt zeitlich: die SERIAL-400-Form gibt es
erst ab **2026-08-06**, also aus der Zeit, in der die Self-API und selbstterminierende Sessions
breit wurden.

**(b) `rulebook/einstieg.md:103` — das ctx-Selbstmass.** Das Rezept liest den Owner-Token per
`python3` aus `fleet.json`. Eine **Lane hat keine `fleet.json`** — `json.load` wirft, die
Kommandosubstitution liefert den leeren String, und es geht `authorization: Bearer ` hinaus:
`tokenOk("")` ist false (`server.ts:14219`), Zeile geschrieben. Der Text warnt selbst, dass der
Schnipsel nur im Haupt-Checkout läuft (`einstieg.md:107-108`) — durchgesetzt wird das nicht, und
„miss deinen Füllstand" ist eine Anweisung, die eine Session **wiederholt** ausführt.

**(c) `docs/supervisor-succession.md:242,249`** verwenden `$TOK`. Diese Variable ist in **keiner**
Pane gesetzt (die Pane trägt nur `FLEET_SELF_TOKEN` und `FLEET_SELF_SLOT`) — dasselbe leere
`Bearer `.

Zeitliche Nachbarschaft, ausdrücklich als Korrelation und nicht als Beleg: der Burst
`2026-08-23 10:11–10:17` beginnt eine Minute nach dem Commit `0a4fe4a` (10:10 Berlin,
„Red-Team 1/3 GLM — Autonomie-Lücken … (read-only)"), einer Lane, die laut ihrer eigenen Notiz die
Live-Naht abgetastet hat. Im Burst-Fenster selbst steht **keine** andere Ledger-Zeile; die
nächstliegende Nachbarschaft ist `10:17:39 fleet_report_open slot=3`. Das reicht für einen Verdacht
und nicht für eine Zuordnung — jede der drei Türen oben hätte dieselbe Signatur hinterlassen.

## 7. Vorschlag: die minimale Anreicherung — Folge-Zeile, hier nicht gebaut

> **Zeile:** `owner_auth_fail` trägt `detail` — Kanal, Credential-Träger, Host-Klasse, halbe IP.
> Niemals das versuchte Token.

**Warum das die kleinste mögliche Änderung ist:** `audit()` schreibt `detail` bereits
(`server.ts:3474-3477`), und `GET /api/audit` liest `detail` bereits mit
(`server.ts:19469`). Kein neues Ereignis, kein Ledger-Schema, keine Migration, keine Leseseite —
es fehlt genau **ein Argument an einer Aufrufstelle**, plus `req` in der Signatur von `tokenGate`.

Vorgeschlagener Inhalt, vier Felder, alle geheimnisfrei:

| Feld | Werte | was es allein schon entscheidet |
|---|---|---|
| Kanal | `login` · `programs` · `supervisor` · `api:<pfadfamilie>` · `ws` | Browser-Login vs. API-Schleife vs. WS-Reconnect |
| Träger | `bearer` · `cookie` · `query` · `self-header` · `none` | **trennt (a) von (b)/(c) sofort**: `self-header` heisst „ein Agent nahm den falschen Header", `cookie` heisst „ein Browser-Cookie ist tot", `bearer-empty` heisst „ein Skript hatte eine leere Variable" |
| leer/falsch | `empty` · `wrong` (nie der Wert) | trennt „Variable nicht gesetzt" von „echtes Fehlraten" |
| Host-Hälfte | erste zwei Oktette aus `server.requestIP(req)` | trennt localhost von Tailnet-Gerät, ohne ein Gerät zu identifizieren |

Ein einziges Feld — **Träger** — hätte diese Untersuchung von vier Stunden auf ein `grep`
reduziert. Die Pfadfamilie sollte ohne IDs mitfahren (`api:slots`, nicht `api:slots:7`), damit die
Zeile keine Slot-Belegung leakt.

**Zweite, kleinere Folge-Zeile, unabhängig davon:** `showGate()` (`src/client.ts:169`) soll den
Poll-Pump entwaffnen — `armPolls()` liest `plan()`, also braucht es dort ein Gate-Flag oder ein
`clearInterval`-Paar. Solange das fehlt, produziert jeder vergessene Tab weiter ~1,15 Zeilen/s, und
zwar unabhängig davon, ob §7 gebaut wird.

## 8. Was ich NICHT geprüft habe

- **Ob der Burst vom 23.08. tatsächlich die Red-Team-Lane war.** Nicht entscheidbar; ich habe die
  Pane nicht gelesen und könnte es als Lane auch nicht.
- **Der Burst vom 2026-07-25 (307 Zeilen)** ist nach Form ein Browser-Tab, aber welcher Tab auf
  welchem Gerät — offen und mit diesen Daten offen bleibend.
- **Die 30-Zeilen-Differenz** zwischen der Auftragszahl (386 für den 23.08.) und meiner Messung
  (416 Berlin / 414 UTC). Die Stundenzahl 333 stimmt exakt; ich habe das Tagesfenster des Auftrags
  nicht rekonstruiert.
- **`self_heal_recreate`** (1 235 Zeilen, der zweitgrösste Topf) — nicht Gegenstand dieses Auftrags,
  weiterhin ununtersucht.
- **Kein `ps`-Aufruf.** Token-Hygiene: die Self-Tokens stehen per Konstruktion in jeder
  Prozess-Kommandozeile.

## 9. Methode — die Kommandos

```sh
# Bestand und Form des Ereignisses (audit.jsonl ist gitignored — nie `rg` ohne -uu)
wc -l audit.jsonl; grep -c 'owner_auth_fail' audit.jsonl
grep 'owner_auth_fail' audit.jsonl | head -3

# Sendestelle, Aufrufer, Nachbar-401-Pfade
grep -n 'owner_auth_fail' server.ts; grep -n 'tokenGate' server.ts
sed -n '14205,14232p;18490,18513p;19005,19045p;19180,19195p' server.ts

# Herkunft ausschliessen
grep -o '^FLEET_ALLOWED_HOSTS=.*' .env; grep -o '^FLEET_SHARE_HOSTS=.*' .env
grep -n 'ALLOWED_HOSTS' server.ts; grep -c 'unauthorized\|401' server.log

# Browser-Halbwahrheit prüfen
grep -n 'function showGate' -A 22 src/client.ts
grep -n 'armPolls()' src/client.ts; sed -n '43,44p;189,193p;5082,5085p' src/client.ts

# Zeitverteilung, Segmentierung, Abstands-Histogramme (bun, gegen audit.jsonl, read-only)
#   per Tag/Stunde in Europe/Berlin; Segmentschnitt bei Lücke > 30 s;
#   Klassifikation: Median-Abstand 380-470 ms und < 2 Abstände unter 50 ms => SERIAL-400,
#   >= 20 % Abstände unter 50 ms => PARALLEL, sonst mixed.

# Zeitliche Nachbarschaft im Trail
git log --since=2026-08-23T07:00:00Z --until=2026-08-23T13:00:00Z \
  --format='%h %ad %s' --date=format-local:'%H:%M'
```
