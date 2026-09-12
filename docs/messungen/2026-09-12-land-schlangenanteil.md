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

## Nachtrag 16:5x — der Speicherdruck ist gemessen, und er hat meinen eigenen Rückweg getötet

Zwei Lanes hatten an diesem Tag berichtet, die Maschine werfe unter Speicherdruck
Hintergrundtasks ab (drei Suite-Waiter, ein `clean-review`-Lauf, je in der Warteschleife vor
`acquired`, ohne verwaisten Runner). Das stand hier und in `docs/verify-tiering.md` §11.2v als
**Vermutung**. Es ist jetzt eine Messung, weil es ein drittes Mal zugeschlagen hat — auf den
Hintergrund-Watcher, mit dem die Program-MAIN auf ein Preview-Verdikt wartete. Die Harness meldete
wörtlich `stopped because the system is running low on memory`.

**Gemessen, mit Methode:** `memory_pressure` sagt `System-wide memory free percentage: 33%`;
`sysctl vm.swapusage` sagt **`used = 2697.44M` von `total = 4096.00M`** (1 398 M frei);
die größten Prozesse sind ~ein Dutzend `claude`-Sessions mit je 0,15–0,30 GB RSS. Die Zahl
„0,3 GB frei" aus `vm_stat` (Pages free + inactive) ist ein **falscher Proxy** und wird hier
ausdrücklich nicht verwendet — auf macOS ist der Swap-Verbrauch das Signal, nicht die freie Seite.

**Die operative Folge, und sie ist eine Regel, keine Beobachtung: ein lokaler
Hintergrund-Watcher (`run_in_background` + `until`-Schleife) ist auf diesem Host KEIN
verlässlicher Rückweg.** Er stirbt lautlos unter Speicherdruck, und wer sich abgewendet hat,
wartet dann auf ein Ereignis, dessen Melder weg ist. Verlässlich ist, was **im Server** lebt:
`POST /api/self/watch` für Lane/Merge/Audit, und für alles ohne Watch-Art ein One-Shot
`POST /api/self/autos` (`everySec: null`). Der Auto trägt die bekannte `sendText`-Gefahr
(paste-buffer ohne Clearing) — das ist der Preis und er ist kleiner als ein verlorener Rückweg.

**Nicht gemessen:** ob der Speicherdruck auch die drei `e2e/slots.ts`-Fails aus §11.2v erklärt.
Die Korrelation ist da (derselbe Tag, dieselbe Maschine), die Kausalität nicht geprüft.
