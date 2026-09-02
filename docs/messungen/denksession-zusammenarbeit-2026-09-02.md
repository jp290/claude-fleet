# Denksession 2026-09-02 — Second-host als Kapazitaet (A), Zusammenarbeit der Sessions (B)

Fleet Controller Slot 14 (Fable 5.1), 12:40–14:00. Owner-Auftrag 12:25 woertlich: „Zu allererst will ich
wissen, wie es mit dem aktuellen Second-host-Fix aussieht, damit koennten wir das Arbeitspensum direkt in
vernuenftiger Art erhoehen. Daneben nochmal nach architekturellen Verbesserungen von Claude Fleet gucken,
insbesondere Informationserfassung zur Sessions-Uebersicht, Kommunikation — wie die Sessions innerhalb
Claude Fleets zusammenarbeiten. Erst Gedanken machen, worauf es ankommt und wie man beides im
komplementaeren Kontext zueinander angeht." Nachtrag 12:40: Perspektivwechsel je Rolle, Private-repo-o
gesondert, Selbstbefunde der MAINs als Quelle, GLM-Zweitmeinung am Ende.

Quellen: sechs Selbstbefunde (Slots 3, 4, 7, 9, 12, Steward 11; Register-Notizen `9f65abf1` `1a37966b`
`8b0114e1` `712274ff` `18a14e37` `fe9593f1`), `audit.jsonl` von heute (922 Zeilen), drei Read-only-
Extraktionen aus dem Baum bei `f62b1f5` (Rollenmatrix der Prinzipal-Checks, ACP-Stand + Schnitt-Dedupe,
Private-repo-o-Profil + Pane), eigene Messungen. Zeilenverweise unten zeigen auf `f62b1f5`.

---

## 0. Ergebnis in fuenf Saetzen

1. **A ist bootstrapped (13:00) und das Remote-Rot ist erklaert:** neuer Daemon auf f62b1f5, `daemonSha`
   auf dem Board; die Remote-Audits sind deterministisch rot, weil der Leser `processBirthFingerprint`
   unter `LANG=de_DE.UTF-8` den deutschen Wochentag nicht parst (Auftrag `3bb5a5c9`, eine Zeile). Grace
   bleibt 0 bis zum Land, dann zurueck aufs Geraet.
2. **B hat einen Mechanismus, nicht viele:** der Fleet benutzt EINE Primitive — den Pane-Send — fuer drei
   verschiedene Beduerfnisse (Fakt abfragen, geweckt werden, Entscheidung einholen). Nur das dritte gehoert
   in eine Pane. Fakten gehoeren gezogen, Weckrufe gehoeren auf eine Zeile eingedampft.
3. **Der Pane-Send ist der teuerste, unzuverlaessigste und einzige UNGEMESSENE Kanal** (Owner-`POST /send`
   schreibt keine Ledger-Zeile; 169 von 185 zurueckgehaltenen Events heute gingen an EINEN Slot wegen 53
   Zeichen Composer-Rest, den der Code weiterhin „owner draft" nennt).
4. **Der Controller ist heute ein Router aus Konvention, nicht aus Notwendigkeit:** Dispatcher master-
   stopped + MAIN darf nicht starten ⇒ jeder Program-Schritt laeuft ueber Attention → Controller → Hand-
   Dispatch. Slot 3 beweist die Alternative (Self-Land per Promotion, zwei Briefs ohne Controller).
5. **Reihenfolge:** A-Bootstrap (Owner) → die vier billigen B-Schnitte am Kanal → die typisierten Fakten →
   Dispatcher an mit Last-Waechter → dann erst mehr Kapazitaet (Dual-Host S2–S4). Kapazitaet vor
   Koordination wuerde nur mehr Lanes durch denselben Controller schicken.

---

## 1. Thema A — Second-host: Stand, gemessen 12:45

| Fakt | Messung |
|---|---|
| Geraet | `secondhostlinux1` mode active, lastSeen live, load 0, capabilities bun/tmux/git/zsh; **kein `daemonSha`-Feld** im Payload → alter Daemon |
| ssh | Port 22 offen (`nc`); Key `~/.ssh/id_ed25519` wird angeboten; 7 naheliegende Nutzernamen (owner, jp, fleet, fleet-helper, second-host, ubuntu, owner) → alle `Permission denied (publickey,password)` |
| Wo der Name stehen koennte | nirgends: keine Pane (alle 13 durchsucht), kein Doc, kein `~/.ssh/config` |
| Kosten der Abklemmung | 5 lokale Audits heute ≈ 2,5 h Suite-Mutex; Gate von `79acd2e` wartete 2313 s fuer 141 s Arbeit |
| Host jetzt | load 3,2 / 4,0 / 9,6; Swap 2,2 / 3,0 GB (frueher 6,5 / 7); 13 claude-Prozesse |

**Nachtrag 13:00 — erledigt und entschieden.** Der Owner lieferte den Namen (`second-hostowner`) und
die Nachricht eines anderen Agenten mit den FAIL-Namen aus `work/run-*/suite.log`: der deterministische
Kern der Remote-Rots ist die **Lock-Identitaets-Familie** (5 Checks: held / overdue / PID+birth /
recycled PID / steward gate fact), alles darueber ist Flake-Rauschen. **Mechanismus auf dem Geraet
reproduziert:** `server.ts#processBirthFingerprint` spawnt `ps -o lstart= -p` ohne `LC_ALL=C`; im Daemon-
Environ steht `LANG=de_DE.UTF-8`, procps 4.0.4 druckt `Di Sep  1 07:00:05 2026`, der zweibuchstabige
Wochentag faellt durch `PROCESS_BIRTH_RE` → `null` → `birth.state: unmeasurable`. Mit `env -i` englisch.
Der Schreiber (`e2e-stage.sh`) setzt `LC_ALL=C`, der Leser nicht. Fix = eine Zeile, Auftrag `3bb5a5c9`.
**Bootstrap durchgefuehrt:** Bundle von `main` per scp, `work/tree-bootstrap` (f62b1f5), Symlink
`work/current`, Unit aus Template (neu: `RestartForceExitStatus=75`), Daemon `running f62b1f58`, Deploy
`d79bde9c` ok:true, Board zeigt `daemonSha` f62b1f5. Jeder weitere Update laeuft ueber die Board-Route.
**Grace bleibt 0**, bis `3bb5a5c9` gelandet ist — sonst ist jeder Remote-Audit deterministisch 5/3443 rot,
jetzt immerhin mit Namen. Danach `.env` `'60000'` + Verb 2 (Zeile `226a2174`).

**Der Durchsatz-Hebel dahinter ist der Mutex, nicht die CPU:** mit Audits auf dem Geraet ist der lokale
Mutex wieder fuer Gates und Vorschauen frei; erst S2–S4 (Job `command`, Wake-on-LAN, Presence) machen aus
dem Geraet Kapazitaet fuer Lanes.

---

## 2. Thema B — worauf es ankommt

### 2.1 Die Messung, die das Bild traegt

**Sechs Selbstbefunde, ein Muster.** Anteil der Turns, die NICHT entscheiden (warten, pollen, wiederlesen),
in den letzten 20 Turns je Session: Slot 3 ≈ 3 · Slot 7 6 (+4 Acks) · Slot 9 6/18 · Slot 4 10/20 ·
Slot 12 4 · Steward 5–7. Was sie stattdessen taten, fiel in fuenf Klassen:

| Klasse | Beispiele (Slot) | Was der Server davon SCHON weiss |
|---|---|---|
| (i) Fakt per git/ps/Pane rekonstruiert | main-Bewegung: 3 Watcher + 4 Autos + 6 Turns (7) · Audit-Zustand je sha: 3 Routen + Watch als Sonde (12) · Mutex-Warteschlange 3× ps+lock (9) · Autos/Watches fremder Slots aus 7 Panes ≈ 1100 Zeilen (11) · eigener ctx geschaetzt (4) | alles: `merge-base`, `auditQueue`/`runningPostLandAudit`, `gate.lock`, `autos[]`/`watches[]`, `contextFill(s)` |
| (ii) Echo | OWNER ANSWER zitiert den eigenen Attention-Text voll: 3× ~2,5 k (4), 2× 1,9 k (9), 3× ~700 (3) · Ack echot Report-Volltext 3× ~3 k (3) | den Text hat die Empfaengerin selbst geschrieben |
| (iii) Session→Session fehlt | Attention zweckentfremdet 6× (4) · Owner-Token `POST /send` 5× (7) · 3 Handover-Broadcasts (9) · eine Nachricht exakt doppelt (12) | — es gibt den Kanal nicht |
| (iv) Rot ohne Namen | lokale Audits tragen nur `checks{ran,failed}` (9) · Trail-Ort Doc≠Code, 5 Turns (12) | Trail-Datei liegt auf Platte |
| (v) Selbstverwaltung ohne Tuer | eigene pending Zeile zurueckziehen (4) · Spawn-Tripel einer queued Zeile aendern (7, 9) · Self-Auto loeschen (7) · Brief-Text eigener Zeilen (3) | Datensatz vorhanden, Route fehlt |

**Der Kanal, am Ledger (`audit.jsonl`, heute):** `fleet_event_held` 185 · `delivered` 91 · `ack` 92 ·
`watch_fire` 70. **169 der 185 holds gingen an Slot 14** (Vorgaenger-Controller) mit dem Detail
`composer occupied (53 chars) — nothing typed`: ein Composer-Rest hat den Event-Kanal zu dieser Session
stundenlang blockiert, und `server.ts#tickWatches` hat es jeden Tick neu versucht. `fleet_event_send_uncertain`
zaehlt ueber die Ledger-Geschichte 4709 Zeilen. **Der Owner-`POST /send` schreibt KEINE Audit-Zeile** (Route
`server.ts:23824 ff.`, kein `audit(`-Aufruf; ueber die gesamte Geschichte nur 2× `steward_send`) — der
teuerste Kanal ist der einzige ohne Ledger. Unter Hostlast misst `readComposer` Render-Latenz, nicht
Zustellung (Notizen `6c7d98ff` Brief 6 min 36 s ungesendet bei „observed"; `ca085489` 9/11 „uncertain"
bei ausgefuehrtem Befehl).

**Was es SCHON gibt und niemand nutzt:** `POST /api/self/watch {…, delivery:"inbox"}` (`server.ts:5610`)
legt das Event ohne Pane-Send ab; es erscheint in `GET /api/self` `events[]`. Es hat aber keinen Weckruf
und kein Ack (`server.ts:6687` → 409) — also pollt niemand darauf, und alle bleiben bei `pane`.
Ebenso: `slotDeliveryBudget` (`server.ts:5560`) rechnet einen Topf fuer Watches UND Reports (V-K1 vom
25.08. offen), `program-execution` traegt die Lane-Zeilen (Slot 3s Wunsch S3 zu zwei Dritteln), und die
vier Audit-Zustaende (queued/claimed/running/done) sind im Watch-Identitaetspfad `server.ts:5649-5655`
schon einmal zusammengerechnet — nur nicht als GET.

### 2.2 Die These: drei Beduerfnisse, eine Primitive

Eine Session braucht von den anderen genau drei Dinge, und sie haben verschiedene Physik:

| Beduerfnis | richtige Form | Kosten beim Empfaenger | heute |
|---|---|---|---|
| **Fakt** („ist sha X auf main", „laeuft ein Audit", „wer haelt den Mutex", „mein ctx") | PULL, typisiert, level-getriggert | 0 Turns, ein GET | git/ps/Pane/Owner-Token, 25–50 % der Turns |
| **Weckruf** („Fakt F hat sich geaendert, id") | PUSH, EINE Zeile, id-only, gebuendelt je Idle-Punkt | 1 Turn je Idle-Punkt, ~100 Bytes | 1 Pane-Send je Event mit Volltext, Echos, 169× held |
| **Entscheidung** (Attention, Clarification, Owner-Richtung) | Pane, Volltext, Ack | 1 Turn, gewollt | funktioniert (Event+Ack-Kette, Fleet-Report typisiert) |

Der Fleet hat das dritte gut gebaut und benutzt seine Form fuer die ersten beiden mit. Die Einheit der
Zusammenarbeit ist also nicht „die Nachricht": **Program** ist die Einheit der Autoritaet (einmal Owner-
bestaetigt), **Task-Zeile** die der Arbeit, **Land** die der Wahrheit, **typisierter Fakt** die der
Koordination. Die Nachricht ist der Fallback fuer echte Fragen.

### 2.3 Perspektivwechsel je Rolle — sieht / entscheidet / fehlt

Grundlage: die Prinzipal-Checks im Code (`server.ts#fetch`: Self-Block → Steward-Block → Helper-Block →
`tokenGate`), nicht die Doku. Jede Zeile „fehlt" ist eine verifizierte Abwesenheit mit dem Check, der sie
erzwingt, plus dem Selbstbefund, der sie bezahlt hat.

**Owner.** Sieht `/api/sessions` (Slots mit `ctx`, `agent`, `events`, `watches`, `gate`, `helperDevices`),
sein Board, und `/usage` bei Anthropic. Entscheidet Promotion, Program-Bestaetigung, unklare Dispatches,
Adjudikation. **Fehlt:** die Kosten der Kommunikation (kein Send-Ledger, kein Byte je Slot — er sah das
Fable-Limit auf `/usage`, nicht auf dem Board) · Hostlast und Swap (er merkte den Lag selbst) · die
Mutex-Warteschlange (nur `gate.lock`, kein „wer wartet") · Erreichbarkeit eines Slots (169 holds waren
nirgends sichtbar) · ein Wartegraph („wer wartet auf wen/was").

**Fleet Controller.** Kein eigener Prinzipal — eine Non-Lane-Session, die das Owner-Token aus `fleet.json`
liest (`tokenGate` unterscheidet nicht). Sieht Register, Ledger, Panes. Entscheidet Routing, Land,
Adjudikation, Nachfolge. **Fehlt:** ein Weckruf auf den EIGENEN Fuellstand (`76862eb3`: Band um 11 Punkte
verpasst) · ein eingehender Kanal von MAINs (sie zweckentfremden Attention) · FAIL-Namen lokaler Audits ·
und er LIEST Panes, weil vier Idle-Zustaende gleich aussehen. Der Controller ist die Rolle mit dem
meisten Wissen und dem wenigsten Mechanismus — alles, was er tut, tut er von Hand.

**Program-MAIN.** Sieht `GET /api/self` (Autos, Watches, Events — nur eigene), `program-execution` (Zeilen,
Lanes, Lineage, `unknown[]`), Attention-Antworten. Entscheidet Reihenfolge, Zerlegung, Modellwahl, Land
innerhalb Promotion. **Fehlt** (alle 409/absent im Code): dispatchen (`/api/tasks/:id/dispatch` unter
`tokenGate`; `release` schreibt nur `pending → queued`) · eigenen `ctx` (`contextFill` nur in der
Owner-Projektion) · main-Ahnenschaft als Watch (nur lane/merge/audit/deploy/transition) · Audit-Zustand
je sha als GET · Brief-Volltext eigener Zeilen (`text.slice(0,200)`) · eigene Zeile zurueckziehen · Spawn-
Tripel aendern · irgendeine Nachricht an den Controller. Slot 3 zeigt die andere Haelfte: mit Self-Land-
Promotion lief das Program zwei Briefs lang ohne Controller.

**Lane.** Sieht Brief, `gate` (Verify-Budget, `suiteLock`, `localProof`), `drift`. Entscheidet Loesungsweg,
ob ein Rot ihres ist, wann sie stoppt. **Fehlt:** ob gerade ein Audit laeuft (Regel `aecd5f89`: keine
Beweiskette neben einem Audit — sie kann es nicht wissen) · ob eine andere Lane ihre Datei uncommittet
haelt (das Register weiss es) · ein Watch (409 by design, richtig so — aber dann muss ihre MAIN es fuer sie
wissen).

**Steward.** Sieht `stewardSlotsView` (git, alive, merge, idle, doneLooking, `transcriptFact` als KB-Proxy)
und den Digest. Entscheidet, was er beobachtet und wen er anstupst. **Fehlt:** `autos[]`/`watches[]` je
Slot (S11: 7 Panes gelesen fuer einen serverseitigen Fakt) · `ctx` (nur Bytes, „never a percentage") ·
Effort (kein Sensor, nirgends) · ob ein Merge LEBT (`fa1112eb`) · Helfer-Geraete (403) · Freitext
(nur vier gerenderte `kind`s — richtig als Zaun, aber dann ist Steward→Controller heute unmoeglich).

**Helfer-Geraet.** Sieht `helperJobsView` (Jobs mit basename, eigenes `device`), Heartbeat-Antwort mit
`desiredMode`. Entscheidet Claim. **Fehlt:** nichts Strukturelles; die Rolle ist sauber pull-only. Was
fehlt, liegt auf der SERVER-Seite: die Remote-Zeile traegt trotz `fails[]`-Kanal `checks: null`
(`df22cf14`), die lokale Zeile traegt gar keine Namen (S9).

**Game-Maker-MAIN (Private-repo-o) — gesondert, §4.**

### 2.4 Die kleinen komplementaeren Strukturen (Owner: „vielleicht fehlt es irgendwo an kleineren
komplementaeren Strukturen dahinter")

Vier Felder, kein Subsystem. Jedes ist heute ein Pane-Lesen oder ein Ratespiel:

1. **Erreichbarkeit je Slot** — `reach: {composerChars, heldSince, heldCount}` auf `/api/sessions` und im
   Steward-View. Plus die Konsequenz aus dem Owner-Entscheid 2026-08-19: ein Composer-Rest in einer IDLE
   Pane ist Claudes eigener und wird vor der Zustellung geleert (audit-Zeile mit Laenge), statt 169× zu
   warten. Der Code sagt an acht Stellen noch „owner draft" (V4 vom 25.08., offen). Rueckfalltuer: env.
2. **Kostenzaehler je Slot** — eine `audit("send", slot, bytes, ctxPct)`-Zeile in `sendText` fuer JEDEN
   Pfad (Owner, Event, Steward, Attention-Antwort) und daraus `inbound{sends, bytes}` je Slot je Tag auf
   `/api/sessions`; dazu `ctx` in `GET /api/self`, damit eine MAIN ihr Band selbst haelt.
3. **Wartegraph** — je Slot `waiting: [{kind, target, since}]` aus armed Watches, Autos, laufendem Merge,
   Audit-Zustand. Das ist S11 (Steward) verallgemeinert auf Board und Controller: „steht der Fleet?" wird
   eine Abfrage, nicht ein Rundgang durch 13 Panes.
4. **Hostlast als Fleet-Fakt** — `host: {load1, swapUsedMb, suite:{holder, queue[]}}` auf `/api/sessions`
   und `/api/self/gate`. Ohne diesen Fakt darf der Dispatcher nicht angeschaltet werden; mit ihm wird er
   ein Waechter statt eines Master-Stops.

### 2.5 Die Schnitte, dedupliziert und geordnet

Owner-Vorgabe: „komplementaer zum Prozess selbst und zu unserem Ziel" — Ziel ist Durchsatz mit weniger
Owner-/Controller-Handgriffen; Prozess ist Vorschlag → Promotion → Lane. Die Zeilen sind so geschnitten,
dass jede ein Done-Kriterium und einen Verify-Weg traegt (Queue-Zeilen `[idee B …]`, kind notiz).

**Welle 1 — den Kanal billiger machen (kein neues Wissen, nur weniger Bytes und weniger Blockade):**
- B1 Echo-Diaet: `lane-signals.ts#attentionAnswerMessage` (`:297`) und `clarificationAnswerMessage`
  (`:285`) rendern `raised` auf ≤120 Zeichen; `server.ts` Ack-Antworten `{ok, id}` statt Volltext
  (`:6589`, `:7616`). Spart je Antwort ~2,3 k Zeichen an der Session mit dem knappsten Kontext.
- B2 Rest leeren statt halten: idle Pane + Composer-Rest ⇒ `C-u`, audit `composer_cleared` mit Laenge,
  dann zustellen. Falsifier: Fixture mit vorbefuelltem Composer, held-Zaehler bleibt 0.
- B3 Send-Ledger: JEDER `sendText`-Pfad schreibt eine Audit-Zeile mit Slot, Bytes, Pfad, Acceptance.
  Falsifier: `POST /send` erzeugt genau eine Zeile.
- B4 Weckruf buendeln: `tickWatches` liefert je Empfaenger und Tick EINE Zeile („[fleet] 3 events: ids …,
  detail GET /api/self"), Volltext bleibt im Event; `delivery:"inbox"`-Events bekommen dieselbe Zeile und
  ein Ack. Damit wird der existierende Inbox-Pfad benutzbar.

**Welle 2 — Fakten ziehbar machen (jede Zeile ersetzt einen gemessenen Umweg):**
- B5 `POST /api/self/watch {kind:"main", sha}` level-getriggert ueber `merge-base --is-ancestor`, oder
  schlichter `GET /api/self/main?sha=` (S7: 3 Watcher + 4 Autos + 6 Turns).
- B6 `GET /api/post-land-audits?mainSha=` → `{state, claim, localRunning, row}` — Extraktion des Praedikats
  aus `server.ts:5649-5655` (S12).
- B7 FAIL-Namen lokal aus der Trail-Datei auf Ledger und Event (S9), zusammen mit `df22cf14` (Remote-Zeile
  ohne `checks`) als EINE Lane: „jede rote Audit-Zeile traegt Namen".
- B8 `GET /api/self` traegt `ctx`; `stewardSlotsView` traegt `autos[]`, `watches[]`, `ctx` (S11 +
  `e1ce58fd` + `fa1112eb` als eine Lane).
- B9 Selbstverwaltung: `GET /api/self/tasks/:id` (Volltext + Lane-Zeile, kein git), `POST …/withdraw` fuer
  eigene pending Zeilen, `spawn` einer eigenen queued Zeile aenderbar (S3, S4, S7, S9).

**Welle 3 — Autoritaet an den Ort der Entscheidung (die Zeile, die den Controller aus der Schleife nimmt):**
- B10 Dispatcher AN fuer Zeilen, die eine gebundene MAIN released hat, hinter dem Last-Waechter (§2.4 Nr.
  4) und den zwei bestehenden Deckeln (`FLEET_DISPATCH_MAX_LANES`, Program-Deckel ACP-15). Der Owner hat
  das Program bestaetigt; der Hand-Dispatch je Zeile ist eine zweite Unterschrift auf denselben Entscheid.
  Slot 3: 5 Owner-Round-Trips fuer 3 Dispatches. Rueckfalltuer: Master-Stop.
- B11 Self-Land-Promotion als benannte Policy je Program (ACP-29 „ReviewReadyAutonomy", geparkt) — das ist
  exakt der Unterschied zwischen Slot 3 und Slot 9.
- B12 Session→Session: KEIN Freitext-Kanal. Stattdessen `POST /api/self/notify {to: "controller", ref}` mit
  gerendertem Text wie beim Steward-Send, gedeckelt, geledgert, ueber den gebuendelten Weckruf zugestellt.
  Freitext bleibt Attention (Owner) und Clarification (Lane→MAIN).

**Nicht schneiden:** Event+Ack-Kette, Fleet-Report, `program-execution`, Land-Notes als Wahrheit, der
Lane-Watch-Verbot, der Steward-Freitext-Zaun. Alles davon hat heute funktioniert.

### 2.6 Komplementaritaet A↔B und die Reihenfolge

A liefert Kapazitaet (Mutex frei, spaeter Lanes remote). B senkt die Koordinationskosten (weniger Bytes je
Nachricht, weniger Turns je Fakt, kein Controller je Dispatch). Die Hypothese der Vorgaengerin bestaetigt
sich an den Zahlen: heute wartete ein Gate 2313 s (A) UND ein Controller verbrauchte 169 holds an einem
Slot (B). Mehr Lanes ohne B heisst mehr Attention-Round-Trips durch denselben Controller; B ohne A heisst
gut koordinierte Sessions am Mutex.

Reihenfolge, mit Grund:
1. **A-Bootstrap** (Owner-Handgriff, dann Slot 9, ~10 min): billigster Hebel, gibt sofort ~2,5 h Mutex/Tag.
2. **B1–B4** (Welle 1): kleine Lanes, keine neue Semantik, wirken auf jede MAIN sofort — und sie machen
   die Kosten SICHTBAR (B3), bevor Welle 3 mehr Verkehr erzeugt.
3. **B8 + §2.4 Nr. 4** (ctx an der MAIN, Hostlast als Fakt): Vorbedingung fuer B10.
4. **B10 + B11** (Dispatcher an, Promotion benannt): nimmt den Controller aus der Schleife.
5. **Dual-Host S2–S4** (`8228ae65`, `60d07416`, `c3f91ce1`): jetzt erst lohnt Kapazitaet, weil sie nicht mehr
   durch einen Router muss.
B5–B7, B9, B12 laufen parallel, wo eine Lane frei ist; sie sind unabhaengig.

---

## 3. Selbstbefund-Schnitte: Stand gegen den Baum (Dedupe)

| Schnitt | Urteil | Beleg |
|---|---|---|
| S3 `GET /api/self/tasks/:id` | zu 2/3 vorhanden in `program-execution` (Lane-Zeilen, `text` 200 Zeichen); Einzel-GET, Volltext, `dirtyFiles` fehlen; `verifyPid` existiert nirgends | `server.ts:1680-1710`; Ack-Echo `:6589`, `:7616` bestaetigt |
| S7 main-Watch | NEU; fuenf Watch-Arten heute, `merge-base --is-ancestor` an zehn Stellen vorhanden | `server.ts:5588-5657` |
| S9 lokale FAIL-Namen | GEPLANT (Remote-Rand `df22cf14`); Typ sagt woertlich `remote-only` | `server.ts:12234`, `:12933` ohne `fails` |
| S4 Echo-Kuerzung | NEU, exakt: `oneLine` kollabiert nur Whitespace | `lane-signals.ts:268`, `:297` |
| S12 Audit-GET je sha | Praedikat existiert im Watch-Pfad, Route liest nur `limit` | `server.ts:5649-5655`, `:22258` |
| S11 Steward autos/watches | NEU fuer den Steward-View; fuer die eigene Session vorhanden | `server.ts:21316`, `:20052-20103` |

Vom 25.08. offen und hier wieder aufgetaucht: V-K1 Budget-Split (ein Topf fuer Watches und Reports), V4
„owner draft"-Kommentare (acht Stellen), Zustell-Eskalation als Policy. Gelandet seitdem: V1a, V2-Ersatz,
V1b als Sicht. ACP-Programm seit `135ea83` (ACP-26) nicht fortgeschrieben; ACP-27/28 VOID, 29/30 geparkt.

---

## 4. Private-repo-o — gesondert

Program `f99e9354`, Profil `game-maker`, das einzige Program mit Profil. Dieselben Routen wie eine Fleet-
MAIN; anders sind Rolle (Lead Game Developer, Schleife launch → Controls → Wahrnehmung → reparieren →
replay bleibt in der MAIN-Pane), cwd-Zaun (Lease), Checkpoint mit sieben Feldern, `carry` 409.

**Pane-Befund** (letzte 40 Tool-Aufrufe): 18 handeln, 18 wiederlesen/erden, 4 warten — das Warten laeuft
ueber Watches/Events, nicht ueber Polling. Sie ist heute im Owner-Hold (keine offene Zeile).

**Zwei Befunde, die NICHT in §2 gehoeren:**
- **Fremd-Repo-Events:** sie bekam zwei Post-Land-Audit-Events aus dem FLEET-Repo zugestellt (`05f37f11`,
  `22165be8`), musste per `git cat-file` erkennen, dass der Baum nicht ihrer ist, und konnte nicht
  adjudizieren (Self-Token; drei geratene Routen 401). Audit-Events muessen am Repo der Bindung gefiltert
  werden — ein Routing-Fehler, kein Kommunikationsproblem.
- **Harness-Faehigkeit als Fakt:** zwei Critic-Anlaeufe scheiterten „am Harness, nicht am Spiel" (pi-zai
  nicht automatisierbar, codex ohne Browser). Ihre Frage ist „welcher Harness kann einen Browser fahren"
  — ein `capabilities`-Feld am Adapter, das keine Fleet-MAIN je braucht.

**Ihr Engpass ist nicht Rechenzeit:** Playtest durch fremde Haende (Second-host-Canary oder Owner) und der
Build-Stempel des wirklich gespielten Commits. Beides hat keinen Fleet-Sensor; das Profil sagt es selbst
(„Fleet cannot mechanically prove which commit was played"). Diese Rolle profitiert von B1–B4 (weniger
Bytes) und leidet nicht unter B10 (sie released selbst). Was sie braucht, ist ein eigenes kleines
Programm: Event-Filter am Repo, Harness-Capabilities, Canary-Playtest als Helfer-Job-Art.

---

## 5. Zweitmeinung GLM-5.3 (pi-zai-Lane Slot 1, 13:05; Datei + fuenf Fragen als Pointer zugestellt)

Was sie trifft, und was ich daraus aendere:
- **These zu grob:** „Pull ohne Push ist Polling" — Fakten brauchen einen Trigger, sonst wandert die
  Wartezeit vom Pane-Send in GET-Schleifen. Richtig; darum sind B5/B6 als level-getriggerte WATCHES mit
  Inbox-Zustellung geschnitten, nicht nur als GET. Und die Klasse (iii) ist ein VIERTES Beduerfnis (Peer-
  Koordination), das die Dreiteilung unterschlaegt — B12 traegt es, die These in §2.2 muss es nennen.
- **„Entscheidung funktioniert" ist zu grosszuegig:** das Ack beweist, dass in den Composer getippt
  wurde, nicht, dass die Session gehandelt hat; 169 holds sind der Gegenbeweis. Einverstanden.
- **Reihenfolge in Welle 1 falsch:** B1 (Diaet) zuerst aendert das Signal, bevor der Sensor (B3) es misst,
  und repariert keine Blockade; **B2 + B3 zuerst, dann B1/B4.** Uebernommen (§2.6 unten korrigiert).
- **§2.4 fehlt:** (a) Eskalation an `reach` — der Fakt misst, entscheidet aber nichts; ab N Ticks held
  gehoert er als Attention-Zeile aufs Board; (b) ein **expliziter Controller-Bindungsfakt** — B12 routet
  heute „per Konvention", weil `tokenGate` Controller und Owner nicht unterscheidet (die Rollenmatrix
  sagt dasselbe); (c) Alter released Zeilen in der Queue als Fleet-Fakt. Superfluous: die Tages-
  Aggregation der Bytes auf der Owner-Flaeche — die Ledger-Zeile plus `ctx` reicht.
- **B10-Risiko uebersehen:** Auto-Dispatch verschiebt die Warteschlange vom sichtbaren „pending" in den
  unsichtbaren Mutex-Wait; eine gestartete, verhungernde Lane verbrennt Slot UND Kontext (2313 s am Gate
  = Fensterverlust); Programm-uebergreifende Reihenfolge wird FCFS-Maschinenentscheid; und der Releaser
  kann die Vorbedingung „kein Audit laeuft" (aecd5f89) nicht pruefen → **B6 vor B10**, und der Waechter
  muss den Suite-Mutex kennen, nicht nur load/swap. Uebernommen.
- **Lange Pastes (Owner-Prioritaet, B0):** Store-and-Pointer — Inhalt serverseitig ablegen, EINE Zeile
  konstanter Groesse zustellen, „delivered" erst mit explizitem Ack, Ledger je Versuch, genau ein Paste in
  Flug je Pane; Chunking mit Pruefsumme nur als Fallback, wenn die Session die API nicht erreicht. Das ist
  dieselbe Struktur wie B4 und die Zeile `86830851`.

**Korrigierte Reihenfolge (ersetzt §2.6 Punkte 2–4):** A-Bootstrap ✔ → A1-Fix landen + Grace zurueck →
B2, B3 (Blockade + Sensor) → B0/B4 (Pointer-Zustellung, gebuendelter Weckruf) → B1 → B8 + Controller-
Bindungsfakt + Host/Mutex-Fakt → B6 → B10/B11 → Dual-Host S2–S4.

## 6. Ehrlichkeiten

- Die Turn-Zaehlungen stammen aus Selbstauskuenften der Sessions; ich habe sie nicht am Transkript
  nachgezaehlt. Die Ledger-Zahlen sind gemessen.
- „Jede Pane-Nachricht kostet den vollen Kontext" ist eine Aussage ueber Claude Codes Turn-Modell, nicht
  am Send gemessen — B3 ist genau der Sensor, der sie messbar macht.
- Nichts hier ist gebaut. Jede B-Zeile liegt als `[idee B …]`-Notiz im Register mit Done-Kriterium und
  Verify-Weg; Promotion ist Owner-Akt.
- Nicht gelesen: `docs/self-api.md` im Fliesstext (nur Ueberschriften und gezielte Stellen), die Acts 6–9
  des ACP-Programms gegen den heutigen Code, die e2e-Sonden zu den sechs Schnitten.

---

## 7. Umsetzungsplan (Owner-Frage 13:20: „Fable entwirft, GLM kontrolliert, Sol legt Hand an")

**Der Dreiklang traegt — unter drei Bedingungen, die aus dem heutigen Baum folgen.**

1. **Der Entwurf ist der TEST, nicht ein Prosa-Brief.** Fable schreibt je Zeile zuerst den Falsifier
   (den `e2e/`-Check bzw. Pin, der VOR dem Fix rot und danach gruen ist) und den Ort (`datei#symbol`
   + Zeilenbereich). Ein fremdes Modell kann von einem Test nicht abdriften, von einem Absatz schon; und
   der Land-Gate fuehrt den Test danach fuer immer aus. Das ist die einzige Form von „Kontrolle", die nicht
   an ein Modell gebunden ist. Der dichte Brief (Regelbuch: Dateien mit Zeilenbereich, Verify-Kommando
   ausgeschrieben, Verbote benannt) wird als GETRACKTE Datei `docs/briefs/<zeile>.md` abgelegt; die Queue-
   Zeile traegt nur den Pointer — Paste-Zustellung langer Briefe ist genau die Fragilitaet von §2.2, und
   Codex bekommt den Brief heute per Paste.
2. **GLM kontrolliert an ZWEI Punkten, beide advisory:** (a) Entwurf + Test VOR der Implementierung
   (dort war sie heute stark: falsche Reihenfolge, fehlender Bindungsfakt, B10-Risiko); (b) den Diff
   danach mit fester Checkliste (Test wirklich falsifizierend? Rueckfalltuer? Doc-Naht? Pin?). Mechanik:
   EINE stehende pi-zai-Lane als Critic-Slot; die MAIN schickt einen Pointer („review branch X, Brief Y"),
   GLM antwortet ueber `POST /api/self/fleet-report` (Lane-Route, typisiert, erreicht die MAIN ohne
   Pane-Roman). Grund fuer den stehenden Slot: `pi-zai` ist nicht automatisierbar — der Dispatch-Tick
   startet es nie, jede GLM-Lane braeuchte einen Hand-Dispatch (Owner-Pfad). Ein Slot, viele Reviews.
3. **Sol implementiert in Codex-Lanes** mit Spawn-Tripel `{codex, <sol-modell-id>, high}` an der Zeile
   (ACP-24), Codex committet selbst, der Gate faehrt die volle Kette, der Audit laeuft auf dem Geraet.
   Codex laedt `AGENTS.md`, nicht `CLAUDE.md` — der Brief nennt die privaten Abschnitte namentlich. **Die
   Modell-Id ist ungeprueft:** sie muss `HARNESS_MODEL_RE` bestehen; erster Schritt ist ein Pilot.

**Orchestrierung ohne neue Maschine:** ein Program „B — Kommunikationskanal" mit einer Fable-MAIN, die
entwirft (Test + Brief-Datei), Zeilen mit Spawn-Tripel anlegt, GLM-Verdikte als Fleet-Reports liest und
gruen landet (Self-Land-Promotion wie Slot 3). Dispatch bleibt Controller-/Owner-Handgriff, bis B10 steht
— das ist der eine Handgriff je Zeile, den der Plan noch braucht.

**Pilot vor Serie:** `3bb5a5c9` (A1, eine Zeile, Falsifier klar: Suite unter `LANG=de_DE.UTF-8` faellt
in 5 Checks) einmal durch alle drei Rollen. Beweist Modell-Id, Codex-Dispatch, GLM-Review-Schleife und
Land in ~1 h — bevor zwoelf Zeilen dieselbe Unsicherheit tragen.

**Serie danach in Zweierwellen** (`FLEET_DISPATCH_MAX_LANES` 2, Lands seriell), nach Kollisionsflaeche
in `server.ts` gebuendelt: W1 B2+B3 (`sendText`-Region) · W2 B0+B4 (`tickWatches`/Zustellung) · W3 B1+B8
(Renderer, Views) · W4 B6+B9 (Routen) · W5 B10+B11 (Dispatcher/Policy, erst nach B6 und Host-Fakt).
Realistisch 2–3 Lands/Tag mit Audits auf dem Geraet.

**Zwei Dinge muss der Owner entscheiden, der Plan kann sie nicht:** (1) `server.ts` steht unter dem
Sanierungs-Freeze bis P7 — B laeuft als Freeze-Ausnahme, als Teil des Sanierungsplans, oder wartet;
(2) der Codex-Controller („Sol redet, leitet an Fable weiter") sitzt an genau der Naht, die B0/B3/B4
reparieren — erst danach, wie vom Owner selbst vermutet. Dann traegt er: Sol filet Zeilen und
Programme, Fable entwirft auf Anforderung, und die Modellwahl je Zeile ist ein Feld, kein Handgriff.
