---
frage: Traegt die in S3 (Wake-on-LAN) entworfene Sende-Mechanik — `Bun.udpSocket` mit `broadcast:true` an `255.255.255.255:9` — auf dieser Maschine wirklich, oder haette die Lane sie erst im Betrieb widerlegt bekommen?
urteil: "Sie traegt NICHT. Drei Messungen mit Kontrollgruppe: (1) `broadcast:true` im Konstruktor beweist nichts, weil Bun 1.3.9 JEDE unbekannte Option klaglos akzeptiert (Gegenprobe `thisOptionDoesNotExist:true`); die echte Tuer ist die Methode `socket.setBroadcast(true)`. (2) Ohne sie faellt jeder Broadcast auf EACCES — deckungsgleich mit der Python-Kontrolle ohne SO_BROADCAST, die mit gesetztem SO_BROADCAST sofort 102 Bytes durchbekommt. (3) `255.255.255.255` scheitert AUCH MIT `setBroadcast(true)` an EHOSTUNREACH; nur die subnetz-gerichtete Broadcast-Adresse geht raus. Der Brief haette eine gruene Suite ueber einer Route ergeben, die in Produktion immer wirft — die e2e-Fixture bog die Adresse auf 127.0.0.1 um."
bereich: [multi-host, verify, bun, brief-qualitaet]
belege: [60d07416, "Bun 1.3.9", "e2e/helper-portal.ts", "server.ts#helperClaimCandidateExists"]
nicht-gemessen: ob der Frame beim Second-host ANKOMMT (L2-Segment-Frage, Owner); ob Linux dieselbe 255.255.255.255-Route verweigert (nur macOS gemessen); ob Bun das Konstruktor-Feld in einer spaeteren Version einfuehrt
stand: 2026-09-03
---

# Ein Konstruktor-Flag, das nichts tut, und eine Broadcast-Adresse, die nicht geht

3. September 2026, Program-MAIN „Dual-Host Fleet — Second-host Session Runtime" (`cd110019`,
Slot 5), waehrend der Brief-Schaerfung fuer S3 (Wake-on-LAN) gegen main `24f9cfc`. Der Slice war
noch nicht dispatcht; die Messung ist der Grund, warum sein Brief neu geschrieben wurde.

## 1. Was der Entwurf behauptete

> „schickt ein Magic Packet per `Bun.udpSocket` (Bun 1.3.9, verifiziert vorhanden) an
> 255.255.255.255:9"

`Bun.udpSocket` ist tatsaechlich vorhanden (`typeof === "function"`). Genau das war die Falle: die
Existenz der Funktion wurde als Beleg fuer die Tauglichkeit der Mechanik gelesen.

## 2. Drei Messungen, jede mit Gegenprobe

**(a) Das Konstruktor-Flag beweist nichts.** `Bun.udpSocket({broadcast:true})` wird angenommen —
aber `Bun.udpSocket({thisOptionDoesNotExist:true})` ebenso. Bun 1.3.9 ignoriert unbekannte
Konstruktor-Optionen stillschweigend. Eine angenommene Option ist in dieser API **kein Sensor**.
Die echte Tuer steht auf dem Prototyp: `setBroadcast`, neben `setTTL`, `setMulticastTTL`,
`addMembership`.

**(b) `setBroadcast(true)` ist Pflicht, und die Fremdsprachen-Kontrolle sagt warum.**

| dst | `setBroadcast(0)` | `setBroadcast(1)` |
|---|---|---|
| `255.255.255.255` | Error | **Error (EHOSTUNREACH)** |
| Interface-Broadcast A | Error (EACCES) | **OK, 102 Bytes** |
| Interface-Broadcast B | Error (EACCES) | **OK, 102 Bytes** |

Die Python-Kontrolle am selben Ziel, zur selben Zeit, auf derselben Maschine: ohne
`SO_BROADCAST` → `PermissionError 13`; mit `SO_BROADCAST` → `OK, 102 bytes`. Dieselbe Errno wie
Buns Fehlschlag. Damit ist EACCES als „SO_BROADCAST fehlt" identifiziert und nicht als
Maschinen-Policy.

**(c) Die limitierte Broadcast-Adresse geht nicht.** `255.255.255.255` scheitert auch mit
gesetztem Flag: ein auf `0.0.0.0` gebundener Socket hat unter macOS keine Route dorthin. Was
funktioniert, ist die subnetz-gerichtete Adresse des Interfaces.

**Nebenbefund, positiv:** die Frame-Form des Briefs stimmt. Ein 102-Byte-Paket aus 6×`FF` plus
16× MAC kommt auf einem lokalen `Bun.udpSocket`-Listener vollstaendig an, Praefix und
MAC-Wiederholung korrekt geprueft. Die geplante e2e-Fixture funktioniert also — sie beweist nur
nicht, was sie zu beweisen scheint.

## 3. Warum das der teuerste Punkt des Briefs war

Der Entwurf sah `FLEET_HELPER_WAKE_ADDR` als **Test-Override** vor: die Suite haette auf
`127.0.0.1` gesendet, dort das Paket empfangen und `ALL PASS` gemeldet, waehrend der
Produktionspfad an `255.255.255.255` bei jedem Klick geworfen haette. Ein gruener Test ueber einer
Route, die es nicht gibt — dieselbe Form wie eine Sonde, die ihre Vorbedingung nicht kontrolliert
(vgl. `docs/messungen/2026-09-03-flake-basisrate-settle-for-merge.md`), nur andersherum: dort
faellt ein gesunder Baum rot, hier waere ein kranker Baum gruen.

Die Neufassung des Briefs zieht daraus drei Konsequenzen: `FLEET_HELPER_WAKE_ADDR` ist echte
Pflicht-Konfiguration ohne `255.255.255.255`-Default, fehlt sie gibt es eine 409 statt eines
geworfenen Sends; `setBroadcast(true)` wird gesetzt **und in `e2e/pins.ts` festgehalten**, damit
der gruene 127.0.0.1-Lauf ueberhaupt etwas ueber den echten Pfad aussagt.

## 4. Die portable Lehre

**Eine API-Option, die angenommen wird, ist kein Beweis, dass sie etwas tut.** Die Gegenprobe
kostet eine Zeile — eine erfundene Option danebenstellen — und entscheidet, ob die Annahme ein
Sensor oder ein Echo ist. Kandidat fuer `~/.claude/knowledge/stacks/` (ausserhalb dieses Repos,
darum hier nur benannt und nicht geschrieben).
