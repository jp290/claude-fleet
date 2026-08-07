# Die Byte-Messung — was die drei Hypothesen zu den 430 MB wirklich tragen (2026-08-07)

*Herkunft: Queue-Zeile `32fc334a`, gefahren als Lane `fleet/260806231635-0040` (Slot 1) am
2026-08-07 gegen Baum `dc2940e`, read-only. Geerntet aus der Pane von Session 34 (main), weil die
Zeile `FILES: keine (Messung)` trägt: das Ergebnis ist ein BERICHT, kein Commit, und lebte bis zu
diesem Commit ausschließlich im Scrollback.*

**Warum diese Datei existiert:** am 06.08. sind vier Ideen-Scout-Vollreports so verschwunden, und
am Morgen des 07.08. musste ein Wert-Review aus einer `.jsonl` gerettet werden. Ein Bericht, der nur
in einer Pane steht, ist eine Datei mit einem Tötungsschalter daran.

---

## 0 · Was die Zeile verlangt hat

> DONE: eine Zahl pro Hypothese — oder die ehrliche Aussage, dass die Zähler sie nicht trennen
> können. […] VERIFIKATION: read-only Ablesen der Zähler; keine Suite, kein Code.

Beides ist geliefert: drei Zahlen, **und** die ehrliche Aussage, wo sie nicht trennen.

---

## 1 · Die Einschränkung, die alles andere rahmt

**Der Zähler kann die 430 MB nicht erklären — und wird es nie können.** Zwei Gründe, beide am Code
belegt:

1. **Er ist reiner Prozessspeicher.** `server.ts:6138` `const transportSince = Date.now()`, die Maps
   daneben; ein Schreiber auf Platte existiert nicht (`grep 'appendEvent(.*transport\|transport.*jsonl'`
   → 0 Treffer). Jeder `srv`-Neustart nullt ihn. Deshalb war das längste verfügbare Fenster 53,8 min
   — der Server bootete am 07.08. um 00:52.
2. **Der Verbrauch vom 26.07. lief auf Code, den es nicht mehr gibt.** Die Data-Saver-Lanes A–D sind
   alle gelandet (u. a. `f323fb4`, `7722de4`).

Was der Zähler kann und getan hat: **eine Zahl pro Hypothese für eine reale Nutzungsphase auf
heutigem Code.** Fenster: 55 Snapshots à 30 s = **27,1 min** gesampelt, ein entferntes Gerät
(Desktop), echte Owner-Nutzung (Lane-Dispatch, refine, Kommentare, Panewechsel).

---

## 2 · Eine Zahl pro Hypothese

### H1 — mehrere gleichzeitig offene Clients: **1**

`peerCount` 1 entferntes Gerät (Deckel 64, keine Eviction). Tabs sind ableitbar, weil `pollMs` eine
feste Konstante ist: `/api/sessions` lief mit 0,504 req/s ÷ 2 s = **1,01 sichtbare Dashboard-Tabs**.

- Kosten des marginalen sichtbaren Tabs: **260 KB/min** allein für `/api/sessions`, 327–335 KB/min
  für den ganzen Tab.
- Hidden-Tab: **0** (`pollPlan(hidden)` → `{pollMs:0, chatMs:0, boardMs:0}`).

**Grenze:** der Zähler schlüsselt nach *Adresse*, nicht nach Tab — zwei Dashboard-Tabs auf einem
Gerät sind eine Zeile, und die Kadenz-Division ist unterbestimmt, sobald ein Tab im Sparmodus (10 s)
läuft und einer nicht. Tabs *verschiedener Art* trennen sich dagegen sauber über die Pfade (die
Share-Seite: 27 Requests, 972 B in 27 min).

### H2 — Reconnect-Churn: **17 Opens, davon höchstens 8 echter Churn**

17 Opens in 27,1 min (0,63/min), `openNow` verließ nie 1. Live-Grundlast 38,2 KB/min (aus den 44
Buckets mit 0 Opens) ⇒ 892 KB von 1,98 MB WS-Bytes = **46 % sind Reseed**, 52,5 KB pro Reseed (vor
Deflate). Unabhängig gegengeprüft per read-only `capture-pane -S -3000` über alle 10 lebenden Panes:
5 239–326 071 B roh (Mittel 75 667), 500–71 473 B gzip (Mittel 17 246).

Der Zähler allein trennt die Ursache **nicht** — `transportWs` läuft in `websocket.open` ohne Grund;
Drop-Retry, Panewechsel und Seitenladen inkrementieren `wsConnections` identisch. Über die Pfade
gelesen trennt er teilweise: `assign()` ruft `resetChat()` (`chatTotal = 0`, `src/client.ts:334-337`)
→ `pollChat()` mit `?after=0` = Voll-Transcript → erst dann `connect()`; der `onclose`-Retry fasst
weder Chat noch Board an.

```
of 17 ws opens: 2 page load, 7 pane reassignment (chat view), 8 unattributed
provably a user action:            9/17 = 53 %
ceiling for genuine reconnect churn: 8/17 = 47 %
```

Die 8 bleiben eine **Obergrenze, kein Messwert**: ein Panewechsel auf einem Pane in Terminal-Ansicht
hinterlässt exakt dieselbe Spur wie ein Abbruch.

### H3 — Tab-Reloads: **2**. Exakt, nicht geschlossen.

`index.html` ist `no-store`, jeder Load erreicht den Server: `/` = 2 Requests. Kaltladen heute
211 342 B (alles gzip: `/` 22 977 + `app.js` 185 418 + `xterm.css` 2 079 + manifest/icon 868),
Warmladen ~23 KB, weil `app.js` immutable ausgeliefert wird. Juli: 650 474 B ohne gzip → **3,1× /
28×** besser.

---

## 3 · Und die 430 MB selbst

Gegen die Stückkosten, die §1 des Docs selbst gemessen hat, braucht **jede** der drei Hypothesen eine
unplausible Ereigniszahl:

```
H1 extra simultaneous clients : 6.4 additional clients  (each costs 67.4 MB / 20 min)
H2 reconnects, phone path     : 2705 reseeds  = one every 0.4 s
H3 tab reloads                :  661 loads    = one every 1.8 s
=> today's measured rates, priced at July's unit costs, reach at most 85 MB of the 430 MB.
```

**Was die Lücke ohne vierte Hypothese deckt:** 128 Minuten des einen Mechanismus, der gemessen wurde
(112 410 B × 30/min = 3,37 MB/min); 500 MB = 2,5 h. Und **vor Lane D pausierte nichts**, wenn der Tab
in den Hintergrund ging — `f323fb4^:src/client.ts` nennt `document.hidden` an genau 3 Stellen, alle
drei in `armReload()` mit `location.reload()`, keine im Poll-Pfad. Ein Handy mit offenem, aber
unbeachtetem Tab zahlte den vollen Takt weiter.

Das ist **Arithmetik auf Juli-Stückkosten plus heutigen Raten, keine Messung des Juli** — und mobile
Browser drosseln Hintergrund-Timer auf eine Weise, die die Lane nicht rekonstruieren konnte.

**Verdikt: der Satz aus §2 fällt nicht, er verengt sich.** Die drei genannten Hypothesen sind als
Erklärung der 430 MB quantitativ unplausibel; die naheliegende Erklärung ist **Wanduhrzeit auf dem
bereits gemessenen Poll**.

---

## 4 · Verifikation

Keine Suite, kein Code, keine Datei im Baum angefasst — `git status --porcelain` leer. Alles über
`GET /api/transport` (owner-only) plus `capture-pane -p`. Eigener Fußabdruck sauber getrennt: Peer
`/api/transport`, 54 Requests / 259 873 B.

---

## 5 · Was offen bleibt

**Drei Blindstellen des Zählers, die der nächste kennen muss** — sie sind gemessen *unbeantwortbar*,
nicht unbeantwortet:

1. **`wsBytes` ist VOR-Deflate** = eine Decke, nie der Draht.
2. **`countHttp` bekommt nur Body-Bytes** — Request- und Response-Header zählt niemand; bei ~90
   req/min sind das grob 45 KB/min ≈ **13 % oben drauf, unsichtbar**.
3. **Nicht-Persistenz** (§1.1) ist die eigentliche Lücke: für die nächste 500-MB-Frage bräuchte es
   einen Zähler, der einen Deploy überlebt.

**Unkostiert, nicht verfolgt:**

- `/api/sessions` ist auch nach Lane A noch **78 % des HTTP-Budgets** (7,24 von 9,31 MB), 8 830 B
  gzip / 29 383 B identity pro Antwort.
- Beide Reloads im Fenster waren **kalt** (`app.js` zweimal geholt), obwohl die Bundle-mtime
  unverändert blieb — **der immutable-Cache hielt nicht.**

**Der Audit-Trail-Nebenbefund der Lane** („3 `owner_auth_fail` seit Boot, eine um 23:04:32 UTC ist
nicht meine") ist in Session 34 nachverfolgt und aufgelöst — siehe den Owner-Bericht dort: die
fragliche Zeile fällt 46 s nach `slot_open slot=3`, dem Start von Session 33.

---

## 6 · Owner-Auftrag, wörtlich, noch nicht ausgeführt

Die Lane hat am Ende ihres Berichts angeboten:

> „Doc: `FILES: keine` hat mich von `docs/data-saver.md` ferngehalten. §2 ist jetzt beantwortbar und
> §5 (A–D) noch leer; auf ein Wort schreibe ich beides in einer Doc-only-Lane nach."

Der Owner hat darauf am **2026-08-07** in den Composer von Slot 1 geschrieben — abgeschickt wurde es
nie, die Lane hat es nie gesehen:

> **`schreib §2 und §5 nach`**

Als Queue-Zeile abgelegt. Diese Datei ist ihre Quelle.
