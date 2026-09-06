# Mac-SSD und Speicherdruck — gemessen 2026-09-06 10:4x (Fleet Controller Slot 5)

Anlass: Owner 2026-09-06, woertlich: „wenn du das schon so sagst sollten wir mal einen blick auf die
ssd gesundheit werfen … damit wir die ssd mal ein bisschen schonen". Werkzeug: `smartctl -a /dev/disk0`
(smartmontools per brew installiert), `sysctl vm.swapusage`, `vm_stat`, `df`, `iostat`.

## SSD (APPLE SSD AP0256Q, 251 GB, MacBookAir10,1 / M1, 8 GB unified)

| Zaehler | Wert |
| --- | ---: |
| SMART overall | PASSED, Critical Warning 0x00, Media Errors 0 |
| Percentage Used | 8 % |
| Data Units Written | 111 TB |
| Data Units Read | 193 TB |
| Power On Hours | 3 518 |
| Available Spare | 100 % (Schwelle 99 %) |
| Unsafe Shutdowns | 16 |
| Temperatur | 38 °C |

Abgeleitet: 111 TB / 3 518 h = ~32 GB je Betriebsstunde, ~0,75 TB je Tag. 8 % je 111 TB heisst
~14 TB je Prozentpunkt; bei gleichem Tempo ~18 Tage je Prozent, die restlichen 92 % reichen ~4,5 Jahre
Betriebszeit. Kein Alarm — aber die Schreibrate ist hoch, und ihr Treiber ist gemessen:

## Speicherdruck ist der Treiber

- `vm.swapusage`: total 6 144 MB, **used 5 325 MB**, free 819 MB.
- `vm_stat`: Kompressor 2 909 MB, frei 68 MB, wired 1 905 MB.
- `iostat` seit Boot (2026-08-25): disk0 10,2 MB/s Durchschnitt, 506 tps.

Ein 8-GB-Geraet mit 5,3 GB belegtem Swap schreibt seine Arbeitsmenge fortlaufend auf die SSD. Das ist
dieselbe Ursache wie die 31–42-min-Audits lokal (gegen glatte 27 min auf dem Second-host) und die zwei
vom System gekillten Hintergrund-Watcher (Handoff Slot 6 §2).

## Platte

`/System/Volumes/Data` 162 Gi von 228 Gi belegt (87 %), 26 Gi frei. Davon Fleet-Scratch unter
`$TMPDIR`: 4,4 G, 174 verwaiste `fleet-e2e-instance-*`-Verzeichnisse (je ~46 M, zusammen 3,9 G) —
nichts reapt sie (`state.sh` zaehlt sie unter Maschinen-Hygiene).

## Was daraus folgt (nicht entschieden, Owner-Richtung „macbook langfristig head-relevant/lightweight")

1. Der Hebel gegen SSD-Schreiblast ist RAM-Druck, nicht Suiten-Zahl: was den mac entlastet, ist
   jede Suite und jedes Land-Gate, das auf den Second-host geht (Merker `10540266`).
2. Die 174 Scratch-Instanzen sind 3,9 G Platz, aber keine Schreiblast mehr — ein Reap ist Hygiene.
3. Zweite Messung von `Data Units Written` in ~7 Tagen sagt, ob 0,75 TB/Tag der Fleet-Betrieb ist
   oder die Lebenszeit-Mischung.

Nicht gemessen: welche Prozesse den Swap halten (kein `vmmap` je Prozess), TBW-Rating der Apple-SSD
(nicht veroeffentlicht; die 8 % sind die Controller-eigene Rechnung).
