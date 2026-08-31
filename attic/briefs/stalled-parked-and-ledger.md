# `stalled` bekommt sein fehlendes Gegenstück — und dann ein Gedächtnis

*Zwei Teile, in dieser Reihenfolge, in einer Lane. Teil 1 ist klein und muss zuerst fertig und
verifiziert sein, denn Teil 2 sammelt sonst ab der ersten Zeile das Falsche. Owner-Auftrag
2026-08-06.*

---

## Warum die Reihenfolge nicht verhandelbar ist

`briefs/lane-stalled-fact.md` setzt als Feuerprobe: **mindestens 10 gezählte `stalled`-Instanzen,
vom Owner adjudiziert, davon höchstens 2 Fehlalarme.** Am Tag, an dem der Fakt live ging, feuerte er
binnen Stunden — auf einer Lane, die der Owner als **Notiz-Worktree** absichtlich geparkt hält. Das
Prädikat erfüllte jede seiner Klauseln korrekt; das Ergebnis war trotzdem falsch, weil es gegen die
*Absicht* lief. Zwei solche Worktrees existieren in der Flotte.

Ein Ledger, das vor der Markierung gebaut wird, füllt seine ersten Zeilen also mit genau den Fällen,
die die Feuerprobe scheitern lassen — und vergiftet die Evidenz, für die es überhaupt existiert.

---

## Teil 1 — ein Slot ist „absichtlich geparkt"

`awaiting: "owner"` deckt heute genau einen Fall ab: eine Clarify-Lane, die auf eine Bestätigung
wartet. Für „dieser Worktree ist ein Ablage-/Notizplatz, seine Stille bedeutet nichts" gibt es
nichts.

**Zu bauen:** ein persistiertes Slot-Feld, das genau das aussagt, plus eine Klausel in
`STALLED_RULES`, die es abzieht — nach dem Muster, das `awaiting` dort schon hat.

**Randbedingungen, die begründet sind — halte dich daran oder widersprich vor dem Bauen:**

- **Persistiert.** Ein Neustart darf einen geparkten Slot nicht entparken. `awaiting` macht es
  genauso, und der Kommentar dort nennt den Grund: „ein Neustart darf das Loch nicht wieder
  aufreißen".
- **Vom Owner gesetzt, nicht von der Lane.** Ein Produzent darf sich nicht selbst von der Messung
  ausnehmen — dasselbe Prinzip, aus dem die Lane ihr Done-Kriterium nur *vorschlägt* und der Owner
  es bestätigt. Ein Vorschlagsweg wäre vertretbar, ein Selbstsetzen nicht.
- **Mit Grund.** Eine Parkung ohne Begründungstext ist von Vergessen nicht unterscheidbar. Das ist
  der Unterschied zwischen einer Markierung und einem stummgeschalteten Alarm.
- **Zieht NUR `stalled` ab.** Ein geparkter Slot ist weiterhin ein Slot: `doneLooking`, Merge-Status,
  Drift, Deploy-Fakten bleiben unverändert ehrlich. Wer hier breiter abzieht, baut einen
  Blindheits-Schalter statt einer Markierung.
- **Sichtbar neben dem Fakt**, nicht versteckt: wer `stalled: false` liest, muss erkennen können,
  dass es an der Parkung liegt und nicht an der Schwelle.

**Lebensdauer:** prüf, was `awaiting` bei `openSlot`/`killSlot` tut, und begründe deine Wahl — ein
recycelter Slot, der die Parkung des Vorgängers erbt, wäre derselbe Bug in Grün.

**Verifiziere Teil 1 vollständig, bevor du Teil 2 anfängst.** Danach müssen die beiden realen
Notiz-Worktrees dieser Flotte aufhören, `stalled` zu melden — das ist die Abnahme, nicht ein
grüner Testlauf.

---

## Teil 2 — das Instanz-Ledger

**Der Entwurf liegt vor und ist nicht von mir:** `briefs/lane-stalled-ledger.md`, geschrieben von
der Lane, die den Fakt gebaut hat, nachdem sie alle sechs Server-Senken geprüft hat. Er ist deine
Vorlage. Wo du widersprichst, sag es **bevor** du baust, nicht danach.

Seine tragenden Entscheidungen, damit du sie nicht neu erfinden musst:

- **Schreib-Kante `tickGit`** (10 s) — sie rechnet die Prädikat-Inputs ohnehin und ist zum Zeitpunkt
  der Messung frisch. Ausdrücklich *nicht* der Steward-Read: der misst Aufmerksamkeit statt
  Realität, der Nenner wäre unbekannt.
- **Episoden, keine Proben.** Das Prädikat ist level-getriggert; ein Append pro Tick schriebe 360
  Zeilen pro Stunde und Lane.
- **Dwell auf der FALLENDEN Flanke**, mit Verlängerung statt Neuöffnung. Ein einzelnes Byte —
  Repaint, Shell-Rauschen — darf keine Episode schließen und eine neue öffnen. Derselbe Regler deckt
  auch `ahead` 1→0, `awaiting`-Wechsel und `alive`-Flackern ab, weil er auf die *Ausgabe* des
  Prädikats wirkt, nicht auf einen Eingang.
- **Identität über `branch`+repo, nie Slot-ID**, mit explizitem Schließen in `killSlot`. Ein Slot
  wird recycelt; eine Episode darf nie zwei Lanes umspannen.
- **Die offene Episode ist ZUSTAND** und gehört nach `fleet.json`, nicht in die Log-Zeile.
- **Die Schwelle gehört in die Zeile.** Sie ist ein Env-Knopf; Zeilen unter verschiedenen Schwellen
  sind nicht vergleichbar, und zehn davon bedeuteten dann nichts.

### Der Neustart-Fall — hier ist der Owner-Wunsch, und hier ist die Falle

Der Anlass für Teil 2 war wörtlich: *„leg ein Log an, damit `stalledSince`-Daten einen Neustart
überleben."* Die ehrliche Erfüllung ist die des Entwurfs: eine Episode, die einen Neustart kreuzt,
schließt als `endedBy: "unknown"` **mit markierter Lücke** — nie als sauberes Ende, nie
stillschweigend fallengelassen.

**NICHT die Lösung: `lastOutput` persistieren.** Zwei Gründe, beide belegt:

1. `523f5dc` hat genau das bewusst nicht getan. Sein Body: *„Dieser Prozess hat noch nichts
   beobachtet, also wird idle ab dem Moment gezählt, ab dem er hinsieht… die Schwelle muss nach
   einem Neustart erst wieder verdient werden."* Der Server weiß nach einem Neustart tatsächlich
   nicht, ob die Pane still war — er hat nicht hingesehen. Kontinuität zu behaupten wäre eine
   Erfindung, und dieser Fakt ist anklagend: Erfindungen kosten hier Vertrauen.
2. **`lastOutput` hat drei Verbraucher**: `canDeliver`s busy-Gate (der einzige Riegel gegen ein
   Paste in eine arbeitende Pane), die auto-③-Idle-Klausel, und `stalled`. Die Restart-Semantik für
   einen zu ändern, ändert sie für alle drei — genau die Kopplung, die den ursprünglichen Bug teuer
   machte.

Live beobachtet am 2026-08-06: ein srv-Neustart setzte `stalledSince` beider Notiz-Worktrees auf die
Boot-Zeit. Eine Instanz, die gezählt worden wäre, war weg. **Die Zahl ist eine Untergrenze**, und der
Kommentar an der Schwelle sagt das bereits — dein Ledger muss es in den Zeilen wiederholen, sonst
liest sie später jemand als Messung.

### Adjudikation

Für n=10 braucht es keine Route: der Owner liest zehn Zeilen und urteilt. Falls doch eine nötig wird,
hat `audit-adjudications.jsonl` die Form bereits (Verdikt `real|flake|stale-test|unknowable`,
neuestes gewinnt, Owner-only) — nachnutzen statt erfinden.

---

## Nicht bauen, bewusst

- **Keine Aktion auf dem Fakt.** Weiterhin kein Auto-Kill, kein Nudge, keine Eskalation. Das Ledger
  ist die Sprosse `record`, die `stalled` übersprungen hat — nicht die nächste.
- **Kein generisches Instanz-Ledger** für künftige Fakt-Typen. Es gibt genau einen Konsumenten;
  drei ähnliche Zeilen schlagen eine vorgezogene Abstraktion.
- **Keine Änderung an `lastOutput`s Restart-Semantik** (siehe oben).

## DONE

Die volle Verify-Kette aus `CLAUDE.md` grün. Teil 1 abgenommen daran, dass die realen
Notiz-Worktrees aufhören, `stalled` zu melden. Teil 2 mit Pins für: eine Episode öffnet und schließt;
ein einzelnes Byte innerhalb des Dwell schließt sie **nicht**; ein recycelter Slot erbt keine offene
Episode; eine Episode über einen Neustart trägt `endedBy: "unknown"` und die markierte Lücke; und die
Schwelle steht in der Zeile. Ein Check, der seine Klasse nie fangen muss, dokumentiert nur Hoffnung.

Maschine: nie zwei Suiten gleichzeitig, nie eine neben einem Land oder Post-Land-Audit. Vor dem
Done-Report Drift prüfen. Landen tut der Owner.
