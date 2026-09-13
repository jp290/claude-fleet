---
frage: Was braeche es, damit mehr Last vom Mac aufs second-host wandert — wie viel ist heute ueberhaupt auslagerbar?
urteil: Die grosse Auslagerung ist schon passiert (Audits seit 09-09 quasi vollstaendig remote, Vorschauen mehrheitlich); was den Mac heute haelt, sind drei Naechte — lokale Fallback-Suiten bei gesaettigtem Helfer (~11/Tag, ~7 h Suite-Zeit), der immer-lokale Land-Gate (~190 Ketten in 7 Tagen, Kosten v.a. Mutex-Warteschlange) und iOS — lohnen jetzt Hebel 1 (Offer-Naht 7e601e57) und Hebel 2 (helperClaim-Filter 02131402); der Remote-Land-Gate (10540266) erst als W5b/W5d-Vorstufe, f3ca2e05 bleibt Gegenposition unter dem Entscheid 39857582
bereich: [multi-host, helper-portal, verify, suite-kontention, queue]
belege: [server.ts#runVerify, server.ts#SUITE_OFFER_WAIT_FREE_MS, server.ts#helperClaim, post-land-audits.jsonl, lane-outcomes.jsonl, e2e-trail/, /etc/fleet-helper/config.json, journalctl-fleet-helper]
nicht-gemessen: ob 3 parallele Suiten auf dem second-host als Dauerzustand stabil sind (3 lief erst seit ~1 Tag), die tatsaechliche Gate-Kettendauer je Land (nur Trail-Haeufigkeit), Swap-Druck-Entstehung auf dem second-host (nur Bestand gezaehlt)
stand: 2026-09-13
---

# Was braeche es, damit mehr Last vom Mac auf den second-host wandert?

2026-09-13 ~15:1x, Lane `fleet/260913131229-394d` (pi-zai / glm-5.3 / high). Owner-Frage wortlich:
„herausfinden was es braeuchte damit wir mehr load aufs second-host auslagern". Rahmen ist der
Entscheid `39857582` (zwei Listen, „max usability auf beiden"): der second-host hat eine eigene
Instanz mit eigener Arbeit, der Mac behaelt iOS und Leichtes. Gefragt ist hier die SUITEN- und
Gate-Last, nicht die Session-Last. Alles read-only: Ledger im Haupt-Checkout, ssh-Sensoren auf dem
Geraet, `server.ts` am Zeilenbereich gelesen.

## 1 · IST-BEIDER-HOSTS (gemessen 2026-09-13, 15:13–15:15)

**Mac** (`oldmac`, M1, 8 Kerne, 8 GB, up 15 d): Load 2,92/2,37/2,49. `vm_stat`: 138 MB Pages free,
1,66 GB aktiv, 1,62 GB inaktiv; `memory_pressure` meldet 44 % frei (inkl. zurueckholbar).
Prozesszaehlung (nur Counts): **29 bun, 7 e2e-stage-Wrapper, 3 `e2e-isolated`-Laeufe LOKAL** —
zur selben Minute, in der der Helfer mit 3 von 3 Slots belegt war. Das ist der Befund in einem
Bild: die zweite Maschine voll, und der Mac faehrt trotzdem noch Suiten.

**Second-host** (Debian 13, 16 Threads, 7 858 MB, up 7 d): Load 0,91/1,16/0,97 — **6 % der Maschine
bei 3 laufenden Suiten**. RAM 3 286 MB verfuegbar; Swap 1 913 von 2 276 MB belegt (nur Bestand,
keine Druckmessung gemacht). Config: `maxParallelSuites: 3` (am 09-12 noch 2), `maxLoad1: 8`,
`pollSec: 15`, `suiteTimeoutSec: 3600`. Heute (00:16–15:15): **30 Claims = 13 Audits + 17
Lane-Vorschauen**, Suiten 2 283–2 375 s, Slots durchgehend belegt. Board vom Mac: HTTP 200 in
0,11 s. Der Daemon meldet durchgehend `mode active (local active — owner wishes active)`.

Die 16 Kerne sind also NICHT der Engpass — die Suiten sind nicht CPU-gebunden (bekannt aus
`2026-09-06-second-host-parallel-suiten.md`: Mittel-Load 0,21 bei einer Suite). Der second-host koennte
rechnerisch ~114 Suiten/Tag fahren (3 Slots × 24 h / 0,63 h); heute fanden 30 statt.

## 2 · Q1 — WIE VIEL MAC-LAST IST HEUTE AUSLAGERBAR?

**(a) Post-Land-Audits** (`post-land-audits.jsonl`, 7 Tage, 09-06 bis 09-13): 72 Voll-Suiten =
**58 remote (2 210 min) + 14 lokal (701 min) → 24 % der Audit-Minuten lokal**. Der Trend zaehlt
mehr als der Schnitt: Die 14 lokalen sitzen auf 09-06 bis 09-08 (Helfer damals 2 Slots, gesaettigt);
**seit 09-09 genau EINE lokale Voll-Suite** (09-12, 43 min, nach GRACE-Ablauf bei vollem Helfer).
Die 17 Docs-Kurzketten liefen lokal, kosten je ~2,2 s — vernachlaessigbar. Audits sind damit
**im Wesentlichen schon ausgelagert**; das Restrisiko ist der Drain-Fallback, nicht die Architektur.

**(b) Lane-Vorschauen** (suite-offer): Register `fleet.json#laneSuiteJobs` (gehalten auf
`LANE_SUITE_KEEP=20` gesetzte Offers, Fenster seit 09-12 abends): 22 Offers — 15 reported
(11 gruen, 4 rot), 2 jetzt claimed, 3 withdrawn, **2 abandoned** (die `7e601e57`-Luecke: der Offer
ueberlebte seine Lane, der Helfer rechnete 37 min fuer ein Ergebnis, das niemand mehr lesen
konnte). Lokale `isolated-*`-Trails auf dem Mac: **77 in 7 Tagen ≈ 11/Tag** (09-12: 13, heute bis
15:15: 7), je ~38 min → **~7 h/Tag Mac-Suitenzeit**. Das ist der groesste verbleibende
Suite-Block, und er entsteht an zwei Tueren: Offer unclaimed nach `SUITE_OFFER_WAIT_FREE_MS`
= 180 s → Lane faehrt lokal (`server.ts:16142`); Audit-Drain nach `FLEET_AUDIT_HELPER_GRACE_MS`
= 60 s bei gesaettigtem Helfer → Audit laeuft lokal. Beide traf es heute live (3 lokale isolierte
Laufe bei 3/3 belegtem Helfer).

**(c) Land-Gates laufen IMMER lokal, und das ist Architektur**: `server.ts#runVerify` (server.ts:14351)
spawnt die Kette als `sh -c`-Kindprozess DIESES Servers (14357), gerufen aus dem mergeJob
(server.ts:20659, 21537, 21571, 21747); die drei Wrapper nehmen den LOKALEN Suite-Mutex. Die
Offer-Tuer (`/api/self/suite-offer`, server.ts:28168) reicht ausdruecklich nur „a lane's OWN
preview suite" weiter — fuer den Gate existiert kein Fern-Pfad. Gemessen: **570 `claude-gate-*`,
396 `clean-review-*`, 189 `security-*` Trails in 7 Tagen ≈ 190 lokale Ketten** (je 3 gestaffelte
Server je claude-gate-Lauf; abgeleitet, nicht je Kette gestoppt). Die reine Gate-ARBEIT ist klein
(die merge-prozess-Messung vom 09-06 nannte 2,3 h Arbeit seit 01.09.), die echte Kosten sind die
**Warteschlange vor dem lokalen Mutex (8,5 h seit 01.09.)** — Gates blockieren Lands und Lanes,
nicht die CPU.

**(d) RAM/Load jetzt**: siehe §1 — Mac 2,92 Load / 138 MB frei / 3 lokale Suiten; second-host
0,91 Load auf 16 Threads / 3,2 GB frei / 3 Slots belegt.

**Antwort auf Q1 in einem Satz**: Audits sind zu ~100 %, Vorschauen zu ~2/3 ausgelagert; heute
bleiben ~11 lokale Suiten/Tag (Fallback-Naechte), ~27 Gate-Ketten/Tag (immer lokal) und iOS
(hart) am Mac — der groesste VERSCHIEBBARE Block sind die Fallback-Suiten, der groesste
strukturelle Block ist der Gate.

## 3 · Q2 — WAS HAELT JEDE LAST-ART AM MAC? (Mechanismus, gelesen)

1. **Audit-Fallback**: die Grace-Uhr (`FLEET_AUDIT_HELPER_GRACE_MS`, .env = 60 000) laeuft ab,
   solange der Helfer gesaettigt ist; dann drain der Audit lokal. Kein Fehler — eine Kapazitaets-
   und Reihenfolgenfrage: 3 Slots × 0,63 h against die Land-Welle.
2. **Vorschau-Fallback + Offer-Leichen**: `SUITE_OFFER_WAIT_FREE_MS`=180 s / `HELD_MS`=800 s
   (server.ts:16142/16143) gegen eine reale Fern-Laufzeit von 2 283–2 375 s; ein Offer, dessen Lane
   landet oder schliesst, wird nicht zurueckgezogen (`killSlot`/teardown kennen die withdraw-Tuer
   nicht) → Slotverlust (37 min, 2× gestern gemessen).
3. **Land-Gate**: `runVerify` ist synchron-lokal im Land-Pfad verdrahtet (s.o.); eine Fern-Variante
   braeuchte die Offer-Roundtrip-Maschinerie INNERHALB des mergeJob — der Vertrauenskern der
   Landung (vgl. Bundle-Provenienz-Debatte, `2026-08-29-bundle-provenienz-second-host.md`).
4. **iOS**: kein `xcodebuild` auf Linux (`39857582`, gegengeprueft) — harte Grenze, Plus: der
   Helfer CLAIMT private-repo-p trotzdem und verbrennt Bundle+Klon (`02131402`; das suiteCmd auf dem
   Geraet exitet inzwischen sauber 42, der fleet-seitige Skip fehlt noch).

## 4 · Q3 — HEBEL (je Kosten, Entlastung, Risiko, Zeile)

**H1 · Offer-Naht schliessen** — Zeile `7e601e57` (pending, genau das). Kosten: `server.ts`
withdraw-Aufruf aus `killSlot`/teardown/Land-Erfolg + die beiden `SUITE_OFFER_WAIT_*`-Konstanten
an reale Laufzeit (~2 400 s). Entlastung Mac: **unbekannt** als Zahl, aber direkt an der Naht, die
heute Suiten lokal fallen laesst (bis zu ~11 Suiten/Tag ≈ 7 h, soweit sie auf gesaettigten Helfer
treffen; 2 Offers verbrannten gestern je 37 min Helfer-Slot). Risiko: gering — dieselbe Tuer
(`/api/self/suite-offer/withdraw`) existiert schon.

**H2 · helperClaim-Eignungsfilter** — Zeile `02131402` (pending). Kosten: `server.ts#helperClaim`
(17657) ueberspringt Queue-Repos, deren Suite das Geraet nicht fahren kann, VOR dem Bundle-Bau.
Entlastung Mac: **0 direkt** (ios bleibt laut Entscheid lokal) — aber keine verbrannten Slots und
Bundles mehr, indirekt mehr freie Slots fuer echtes Offloading. Risiko: gering; der lokale Pfad
hat den Guard schon (`suiteCmd`-Präfix, exit 42).

**H3 · Remote-Land-Gate** — Zeile `10540266` (pending) nennt es selbst: „WAS FEHLT fuer dynamisch:
das LAND-GATE selbst als Offer an den Helfer; W5b/W5d (1e7765c9) sind die Vorstufe". Kosten:
`server.ts` mergeJob/gateRun-Pfad + Bundle-Maschinerie (buildHelperBundle existiert fuer Audits
und Vorschauen). Entlastung Mac: ~190 Ketten/7 Tage lokal; reine Arbeit nur **~30–60 min/Tag
(unbekannt im Detail)**, der grosse Gewinn waere Mutex-Entlastung (8,5 h Warteschlange/5 Tage) —
also Land-Latenz, nicht CPU. Risiko: **hoch** — Land-Pfad-Vertrauenskern, Async im mergeJob.
Deshalb zuerst die Vorstufe: das remote VORSCHAU-Verdikt desselben commitSha als Gate-Evidenz
wiederverwenden, bevor der Gate selbst fern faehrt.

**H4 · maxParallelSuites 3 → 4** — getragen von `10540266` (Owner-Richtung „second-host effektiver
laufen lassen", plus seine Bedingung „der Deckel muss ZAEHLEN"). Kosten: `/etc/fleet-helper/
config.json` + ein Messakt (Owner). Entlastung Mac: **unbekannt**, gebunden an die Angebotsrate —
ein Slot mehr ≈ +38 Suiten/Tag theoretisch, aber die heutigen 3 lokalen Suiten entstanden bei 3/3
Belegung, also wuerde Slot 4 sie vermutlich aufgefangen haben. Risiko: **mittel** — die Messbasis
„2 parallel ist belegt, 3 nur als 8-Minuten-Randfenster" (2026-09-06-Notiz) ist durch die
Erhoehung auf 3 selbst noch nicht nachgeholt; RAM-Decke 7 GB und 1,9 GB Swap-Belegstand nennen.

**H5 · Mehr echte Arbeit in die zweite Liste** — Zeile `39857582` (Schritt 1, erfuellt aber
ausbaufaehig): Programs/Tasks aufs second-host-Board filegen (dort laeuft `dispatch:true`, eigene
Slots, 16 Kerne bei Load ~1). Kosten: **0 Code** — Owner-/MAIN-Routingakt. Entlastung Mac:
**unbekannt** (haengt an existierender Arbeit); Mac behaelt iOS. Risiko: gering — genau der Pfad,
den der Entscheid gewaehlt hat; der Schmerz beim Board-Umschalten ist der vereinbarte Trigger fuer
„eine Liste", kein Defekt.

**Gegenposition f3ca2e05** (Cross-Host-Dispatch, NICHT empfohlen, solange `39857582` gilt): sie
waere der Weg, auch LANE-SESSIONS zu verschieben; Preis gemessen am Baum: erster ausgehender
HTTP-Client dieses Servers (null `fetch(` ausserhalb des Handlers) und tmux an 144 Stellen. Unter
dem Zwei-Listen-Entscheid wird dieser Preis nicht gezahlt. Kein Hebel oben widerspricht ihr —
H1–H5 alle arbeiten MIT zwei Listen.

## 5 · Q4 · SCHNITTLINIE

**Jetzt lohnen H1 und H2**: klein, gepinnt (beide Zeilen existieren genau dafuer), und sie
schliessen die Naechte, die gestern Offers verbrannten und heute 3 Suiten lokal fallen liessen,
waehrend die zweite Maschine bei 6 % Last steht. **H4 nicht jetzt erst erhoehen, sondern erst die
3-Slot-Stabilitaet messen** — die Erhoehung von 2 auf 3 ist selbst noch unbelegt; wenn sie sich
haelt, ist Slot 4 der naechste Kandidat mit dem zaehlenden Deckel aus `10540266`. **H3 nur als
Vorstufe (W5b/W5d: Vorschau-Verdikt als Gate-Evidenz)** — der volle Remote-Gate ist der einzige
Hebel, der den strukturell lokalen Block bewegt, aber er beruehrt den Land-Kern und sollte die
stabile Offer-Strecke aus H1 voraussetzen. **H5 ist Routing, kein Code, und darf jederzeit
passieren.** Nicht empfehlen: `f3ca2e05` in seiner heutigen Fassung (B-foermig, unter dem Entscheid
zurueckgestellt) und jede maxParallelSuites-Erhoehung ohne Messakt.

## 6 · METHODE

Ledger mit python3 im Haupt-Checkout gezogen (`post-land-audits.jsonl` 592 Zeilen, 91 im 7-Tage-
Fenster, cmd-Feld „remote helper" als Remote-Merkmal, ms>1e6 als Voll-Suite); `fleet.json`
(laneSuiteJobs/helperClaims/helperDevices) direkt gelesen; lokale Suite-Last als `find e2e-trail
-mtime -7` je Familie; Gate-Symbolik aus `server.ts` an den Zeilen 14351–14357, 16142–16143,
17657, 20659–21747, 28168 gelesen. Geraet per read-only ssh: `uptime`, `nproc`, `free -m`,
`journalctl -u fleet-helper --since today`, `cat /etc/fleet-helper/config.json`, `curl` aufs Board.
Kein Token, kein Restart, keine Datei auf dem Geraet geschrieben.

**Nicht gemessen**: 4+ parallele Suiten; die Einzeldauer einer Gate-Kette (nur Haeufigkeit aus
Trails, /3 gestaffelte Server — abgeleitet); ob die Swap-Belegung des second-host Druck oder Bestand
ist; ob die zweite Instanz dort heute Slots belegt hat (nicht geprueft, nur ihre Existenz aus
`39857582` bekannt).
