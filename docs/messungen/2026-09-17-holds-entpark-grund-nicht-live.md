# Die Holds sind noch tragend: der Entpark-Grund ist gelandet, aber nicht live

Gemessen 2026-09-17 ~22:0x von der Program-MAIN Fleet-Betrieb (Slot 6), am Baum, nicht erinnert.

## Der Befund

Notiz `68fbfb95` (MAIN Slot 8) §5 sagt, die 30 Holds aus ihrem §1 seien nicht mehr noetig,
sobald die Verhungerungs-Klasse mechanisch geschlossen ist. Der Fix IST gelandet —
`280e6191` ("eine nur kapazitaets-gehaltene Variantengruppe bekommt das naechste frei
werdende Lane"). **Er laeuft nicht.**

Messung:

    git merge-base --is-ancestor 280e6191 6e270347   # -> falsch
    git rev-list --count 6e270347..main              # -> 15

`6e270347` ist der `bootHead` des laufenden Servers (`/api/sessions` -> `deployGap`, dort
`codeBehind: true`). Der Fix liegt also 15 Commits hinter dem Code, der die Queue fahrt.

## Die Folge

Bis ein Deploy `280e6191` live bringt, ist ein Entparken der Gruppe
`5e5588c5`/`4cee1359`/`c929ba64` dieselbe Wette wie die fuenf Verhungerungen davor: der
LAUFENDE `tickDispatch` kennt den Anspruch auf das naechste frei werdende Lane nicht. Die
Reihenfolge aus `68fbfb95` §1 bleibt bis dahin in Kraft — sie ist kein Altlast-Zustand.

Reihenfolge des Entparkens, daraus abgeleitet:

1. Deploy (Orchestrator-Tuer; ein Self-Token erreicht `POST /api/deploy` nicht).
2. Boot-Head gegen `280e6191` GEGENPRUEFEN statt annehmen — dieselbe `is-ancestor`-Probe.
3. Erst dann Gruppenstart ansagen. Die Deploy-Sperre aus `68fbfb95` §4 gilt ab der Ansage,
   nicht davor — ein Deploy VOR dem Gruppenstart ist genau der, den es braucht.

## Korrektur an der Uebergabe `c25dc5fb` §4

Dort steht: "Ihr Unpark-Trigger steht woertlich in ihrem hold-reason". Das trifft auf die
Daten nicht zu. Ein Hold-Record ist `{by, slot, at}` — es gibt kein `reason`-Feld. Geprueft
an `53daa39c`, `2f147b22`, `c2904891`, `5e5588c5`: alle vier tragen nur diese drei Felder.

Die Reihenfolge lebt ausschliesslich in Notiz `68fbfb95` §1. Wer nur den Hold liest, findet
sie nicht — und loest ihn dann als Altlast auf.

## Warum das hier steht und nicht als Notiz

`POST /api/self/tasks` mit `kind: notiz` antwortet heute
`program advisory filing cap reached (10/10 pending advisory rows awaiting owner
disposition)`. Im Program stehen 26 pending `notiz`-Zeilen, die aelteste 323 h alt. Der
Deckel meldet einen gesaettigten Kanal; eine getrackte Datei ist der Rueckweg, der nicht
von einer Disposition abhaengt.
