# Eine Queue-Zeile bekommt ihr Program nur bei der Geburt — Erfolgskriterium (a) von „Fleet-Betrieb 2026-09" ist so nicht schliessbar

**Gemessen 2026-09-08 von der Program-MAIN Fleet-Betrieb (`f170dc46e4b026ee34d9392e`).**
Anlass: das Program traegt als Kriterium (a) „Keine Fleet-Lane ohne Program-Zuordnung mehr in der
Queue". Diese Notiz sagt, warum das mit den heutigen Tueren nicht erreichbar ist, und ueberlaesst
die Wahl dem Owner. **Kein Auftrag, nichts gebaut.**

## Die Zahl

Von 238 offenen Queue-Zeilen tragen **75 keine `programId`**, davon **10 vom kind `auftrag`**
(die uebrigen sind `notiz`/`richtung`/`betrieb`, also ohnehin beratend). In der Nacht auf den
08.09. sind zwei weitere dazugekommen (`8f14a22b`, `e53716b9`).

## Der Mechanismus, am Code geprueft

Eine Zeile bekommt ihre `programId` **ausschliesslich bei der Entstehung durch die
program-gebundene Self-Tuer**: `POST /api/self/tasks` setzt `programId: program.id` beim Anlegen.

- Der Task-Default ist `programId: null`.
- Die Owner-Tuer `POST /api/tasks` setzt das Feld nicht.
- **Es gibt keine Route, die einer BESTEHENDEN Zeile ein Program gibt.**
  `POST /api/tasks/:id/adopt` klingt danach, ist aber der Kategorie-Verb (`notiz` → `auftrag`)
  und fasst `programId` nicht an.

Gegenprobe: `grep -n 'programId' server.ts` zeigt Zuweisungen an eine Task nur an der Anlege-Stelle
der Self-Tuer und den Default; alle uebrigen Treffer sind Lesestellen (Filter, Views, Ledger).

## Was daraus folgt

Kriterium (a) ist **durch Arbeit nicht erfuellbar**: eine ohne Program entstandene Zeile bleibt
ohne Program, bis sie erledigt oder archiviert ist. Erfuellbar ist nur die Vorwaerts-Fassung —
„jede NEU gefilte Fleet-Zeile entsteht durch die Tuer eines Programs". Die faehrt das Program
heute bereits: alle in dieser Schicht gefilten Zeilen (`cac29de6`, `bb563b63`, `3ea89f71`) tragen
`f170dc46`.

## Drei Wege — die Wahl ist die des Owners

1. **Kriterium (a) auf die Vorwaerts-Fassung umschreiben** und die zehn Altzeilen ausdruecklich
   ausnehmen. Kostet nichts und macht die Messung ehrlich.
2. **Eine Tuer bauen**, die eine bestehende Zeile einem Program zuordnet. Eigene Zeile, mit einer
   Scope-Frage daran (wer darf zuordnen: der Owner, jede Program-MAIN, nur fuer das eigene
   Program?). Beruehrt dieselbe Provenienz-Naht wie `3ea89f71`.
3. **Nichts tun** und (a) als dauerhaft offen fuehren. Ehrlich — aber dann sollte das Program es
   sagen, statt ein Kriterium zu tragen, das niemand schliessen kann.

## Was NICHT gemessen wurde

Ob die zehn programlosen `auftrag`-Zeilen inhaltlich in dieses Program gehoeren (nur die Queue-
Zuordnung wurde gezaehlt, nicht ihr Gegenstand). Ob andere Programs dieselbe Luecke in ihren
Kriterien tragen. Und warum diese Notiz nicht als Queue-Zeile steht: die beratende Filing-Grenze
des Programs war mit 10/10 erschoepft — genau der Deckel, den `POST /api/self/tasks` mit
„program advisory filing cap reached" nennt.
