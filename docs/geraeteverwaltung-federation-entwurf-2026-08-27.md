# Geräteverwaltung + Instanz-Link — Entwurf (2026-08-27)

Anlass, sinngemäß vom Owner: „beide Computer über eine UI kontrollieren können, oder zumindest die
beiden Claude-Fleet-Instanzen linken." Ergänzt
`docs/messungen/2026-08-27-linux-second-host-machbarkeit.md` (dort die Umsetzbarkeits- und
Sicherheitsbasis). Status: **Vorschlag, nicht promoted.** Was ohne Marke steht, ist am Baum
`f5ff8e5` gemessen; Entwurfsteile tragen **VORSCHLAG**.

## 0. Die Antwort in zwei Sätzen

Für den Work-Horse-Scope (Suiten, Audits, Tests) braucht der Linux-PC **keinen eigenen
Fleet-Server und keine zweite UI** — Geräteverwaltung heißt hier: das bestehende
`helperDevices`-Register um Heartbeat, Modus und eine Board-Fläche erweitern (Stufe A), und „eine
UI" ist damit erfüllt. Erst wenn auf dem Linux-PC eigene Sessions/Lanes laufen sollen, stellt sich
die Link-Frage zweier Instanzen (Stufe B), und dort ist der Client-seitige Link die sichere Form.

## 1. Was schon existiert (gemessen)

- `server.ts#helperDevices` — Map `{id, name, lastSeen}`, **persistiert in fleet.json**
  (Boot-Rehydrierung vorhanden), Cap `HELPER_DEVICE_KEEP = 20`, oldest-first-Eviction mit Schutz
  für Geräte mit laufendem Claim. Das Gerät benennt sich selbst; der Name liegt server-seitig auf
  Owner-Anweisung („a name that lived only in the helper's browser would vanish with a cleared
  cache").
- `POST /api/helper/device` — registriert/benennt ein Gerät; `lastSeen` wird bei Claim und
  Device-POST berührt. Das ist strukturell schon ein Heartbeat-Endpunkt ohne Takt.
- `helperLapses` — die Zuverlässigkeits-Historie je Gerätename ist bereits ein Ledger.
- **Kein** Outbound-Fetch/Proxy in `server.ts` (grep `proxy|fetch(`: nur der Bun-Serve-Handler
  und Kommentar-Treffer) — jeder Instanz-Link ist neuer Code.

## 2. Stufe A — Geräte-Register mit Modi (VORSCHLAG, empfohlen zuerst)

Hub-and-Spoke: der Mac bleibt die einzige Fleet-Instanz und die einzige UI; der Linux-PC ist ein
Gerät darin.

- **Heartbeat:** der Helper-Daemon (Stufe 1 der Machbarkeits-Notiz) POSTet zyklisch
  `/api/helper/device` mit erweitertem Body: `{deviceId, name, mode, load?, capabilities?}`.
  `HelperDevice` wächst um `mode` und die gemeldeten Felder; offline = abgeleitet aus `lastSeen`
  (kein eigener Zustand — dieselbe Lesart, mit der Claims verfallen).
- **Gewünschter Modus als Pull:** der Owner setzt am Board je Gerät einen **Wunsch-Modus**
  (`active` · `quiet` · `off`), der Server speichert ihn nur; der Daemon liest ihn mit jedem
  Heartbeat ab und setzt ihn lokal um (nicht mehr pollen, Claims auslaufen lassen). Der Mac
  schickt weiterhin nichts aktiv zum Linux-PC — die Pull-Richtung aus dem Portal-Design bleibt
  unverletzt, und ein toter Daemon degradiert exakt wie heute (Claim-Verfall, Lapse-Ledger).
  Lokale Automatik (Quiet Hours nach Uhrzeit, Load-Schwelle) bleibt Daemon-Config; der
  Wunsch-Modus vom Board ist der Override, nicht der Ersatz.
- **Board-Fläche:** ein Geräte-Panel in `src/client.ts` — je Gerät Name, online/offline (aus
  `lastSeen`), Modus (ist/gewünscht), gehaltene Claims, Lapse-Zähler. Datenquelle ist der
  bestehende Poll-Pfad des Boards; die Helper-Routen selbst bleiben unverändert gescoped.
- **Sicherheit:** der Wunsch-Modus ist Konfigurationsdatum, kein Code — er reist über denselben
  authentifizierten Kanal wie die Jobs. Heartbeat-Felder sind Fremddaten vom Gerät und werden wie
  die Gerätenamen behandelt (server-seitig gehalten, beim Rendern escaped, nie interpoliert).

Damit ist „beide Computer über eine UI kontrollieren" für alles erfüllt, was der Linux-PC laut
Machbarkeits-Notiz tun soll — inklusive An/Aus-Semantik, ohne dass der Linux-PC eine
netzerreichbare Fläche bekommt.

## 3. Stufe B — zwei Instanzen linken (VORSCHLAG, nur wenn Sessions auf Linux laufen sollen)

Erst relevant, wenn der Linux-PC einen eigenen `server.ts` fährt (Stufe 2 der
Machbarkeits-Notiz). Zwei Formen, bewusst getrennt:

- **B1 — Client-Link (empfohlen):** die Mac-Instanz kennt eine Liste registrierter Instanzen
  (`{name, url}`, z. B. in fleet.json neben den Geräten); das Board bekommt einen
  Geräte-Umschalter im Kopf, ein Klick wechselt die Origin. Jede Instanz behält Login, Token und
  Perimeter für sich (Cookie je Origin, beide nur über Tailscale erreichbar). Kostet fast nichts,
  schafft **keine neue Angriffsfläche und keine neue Vertrauenskante** — es ist eine geteilte
  Lesezeichenleiste mit Statuspunkt (der Punkt kann aus dem Stufe-A-Heartbeat kommen, dafür
  braucht es B nicht).
- **B2 — Server-Proxy (`/remote/<device>/api/…`):** eine UI, ein Login, die Mac-Instanz hält das
  Token der Linux-Instanz und proxied. Das ist die einzige Variante, die eine **Owner-Credential
  der einen Maschine dauerhaft auf der anderen** ablegt — und „a reachable fleet is remote code
  execution as your user" (server.ts, Kommentar über `HOST`) gilt dann transitiv: wer den Mac
  kompromittiert, hat beide. Dazu käme neuer Outbound-Fetch-Code in einem Server, der heute
  keinen hat. **Empfehlung: nicht bauen**, solange B1 den Bedarf deckt; falls je, dann nur mit
  einem eigens gescopten Read-only-Token der Gegenseite, nie mit dem Owner-Token.

## 4. Schnittfolge

1. **A** in einer Lane: `HelperDevice` erweitern + Wunsch-Modus-Feld + Board-Panel
   (server.ts, src/client.ts, e2e in `e2e/helper-portal.ts`-Nachbarschaft).
2. Helper-Daemon (außerhalb dieses Repos, Linux-Seite) liest Modus + Heartbeat — braucht die
   Owner-Promotion der Stage-1-Non-Goal-Revision aus der Machbarkeits-Notiz §4.
3. **B1** erst, wenn eine zweite Instanz real existiert; als eigene kleine Lane.
4. **B2** nur auf ausdrücklichen Owner-Entscheid gegen die Empfehlung in §3.

## 5. Offen / nicht geprüft

Wo genau das Geräte-Panel im Board sitzt (src/client.ts ist 9 974 Zeilen; Panel-Struktur nicht
vermessen) · ob der Heartbeat den bestehenden `/api/helper/device`-Vertrag erweitert oder eine
Schwester-Route wird (Perimeter-Regex `server.ts#handleHelperRoute` müsste bei einer neuen Route
wachsen — bei Erweiterung nicht) · Persistenz-Migration alter `HelperDevice`-Zeilen (Felder sind
optional ergänzbar, ABGELEITET aus der bestehenden Boot-Validierung, nicht getestet).
