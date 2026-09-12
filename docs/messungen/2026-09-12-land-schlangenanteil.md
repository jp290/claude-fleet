# Ein Land dieser Maschine kostet 27–40 min Wanduhr für 2,5 min Arbeit — vier Land-Notes eines Tages

Gemessen 2026-09-12 von der Program-MAIN Fleet-Betrieb (Slot 6), Program `f170dc46`. Quelle jeder
Zahl: `git notes --ref=fleet/land show <sha>`, kein Sensor, keine Schätzung. Anlass: die Zeile
`f8d9ecf2` (der Land-Pfad nimmt den Suite-Mutex erst beim Verify, der Rebase davor läuft
ungeschützt) trug zwei Messpunkte; hier stehen vier.

| Land | Task | `ms` | `waitMs` | Schlangenanteil | `ffRounds` |
|---|---|---:|---:|---:|---:|
| `af494028` | `2cca4a44` | 149 807 | 0 | 0 % | **1** |
| `c42c5a65` | fremd (Slot 4) | 425 000 | 275 000 | 65 % | — |
| `326eaba8` | `0f83a2b1` | 1 622 025 | 1 482 000 | **91 %** | — |
| `d7a46af3` | `dc4ec8b5` | 2 387 961 | 2 237 000 | **94 %** | — |

## Zwei Tatsachen, die nicht verwechselt werden dürfen

**(1) Die Schlange.** Die reine Gate-ARBEIT liegt stabil bei ~110–150 s. Was wächst, ist
ausschließlich das Warten davor — 91 % und 94 % an zwei aufeinanderfolgenden Lands derselben
Session. Das ist keine Eigenschaft des Land-Pfades, sondern der einen Suite dieses Hosts.

**(2) Der ungeschützte Rebase.** `af494028` trägt `ffRounds: 1` bei `waitMs: 0` — es hat **nicht**
gewartet und trotzdem die ganze Gate-Kette ein zweites Mal gefahren, weil `main` sich unter dem
Rebase bewegte. Das ist der Fall, den `f8d9ecf2` adressiert, und er ist von (1) **unabhängig**: er
trifft auch eine leere Maschine. Wer nur die Schlange sieht, repariert die falsche Hälfte.

## Was diese Zahlen NICHT sagen

Warum die Schlange an diesem Tag so lang war. Mitbewerber waren u. a. ein 39-Minuten-Vorschaulauf
einer fremden Lane und zwei Post-Land-Audits. Ob das der Normalfall oder ein Ausreißer ist, ist
**nicht gemessen** — dafür braucht es die Verteilung über mehrere Tage, und `./state.sh` rechnet
sie bereits (`gate WAIT p50/p90`, Stand dieses Tages: p50 0 s, p90 1 167 s über n=374, davon
264 mit waitMs 0). Die vier Zeilen oben sind ein Tagesausschnitt und dürfen nicht zur Rate
verallgemeinert werden.

## Nebenbefund, zweimal gesehen, deshalb notiert statt behauptet

Zwei Suite-Offers an den Second-host blieben je 180 s **frei und unbeansprucht**, obwohl der Helfer
`online: true, mode: "active"` meldete — Job `a2243996ae75` (Lane `fleet/260912102911-ec22`) und
`0a7c6f226e35` (Lane `fleet/260912093942-9caf`), zwei verschiedene Lanes, beide nach Ablauf des
FREE-Budgets lokal zurückgefallen. Ein dritter Lauf ging am selben Tag auf Bitte des Orchestrators
sehr wohl auf den Second-host (Job `4bdd96`), also ist der Pfad nicht tot. Gehört zu `7e601e57`.
