# Programm-Plan: Linux-PC als Fleet-Work-Horse (2026-08-28)

Status: **Plan für ein Programm, nicht promoted.** Konsolidiert die beiden Entwürfe dieser Lane
und den neuen Stand „Linux-PC ist grundinstalliert" zu einem umsetzbaren Schnittplan für eine
Program-MAIN mit Workern. Grundlagen (dort stehen Messungen und Begründungen, hier nur der Plan):

- `docs/messungen/2026-08-27-linux-second-host-machbarkeit.md` — Machbarkeit + Sicherheitslage;
  die Naht ist das Remote-Helper-Portal, iOS bleibt macOS-exklusiv.
- `docs/geraeteverwaltung-federation-entwurf-2026-08-27.md` — Stufe A Geräte-Register/Modi,
  Stufe B Instanz-Link (B1 empfohlen, B2 abgeraten).

## 0. Zielbild in drei Sätzen

Der Linux-PC nimmt dem Mac Suite-/Audit-/Testlast ab (ein Mutex-Lauf p50 13,3 min / p90
23,8 min), ohne je Code ZUM Mac zu schicken — er pollt, claimt, rechnet, meldet. Der Owner sieht
und steuert beide Rechner in EINER UI: ein Geräte-Panel im bestehenden Board mit
online/offline, Ist- und Wunsch-Modus (`active`/`quiet`/`off`). „Nicht immer an" ist der
Normalfall: ein Gerät, das nicht pollt, claimt nichts; verfallene Claims fallen designgemäß an
den Mac zurück.

## 1. Vorbedingungen und Owner-Gates

- **G0 — Promotion der Non-Goal-Revision (VOR jeder Implementierung):** Stage 1 des Portals
  trägt als Owner-Non-Goal „a human on the other machine clicks claim". Der Daemon ersetzt
  diesen Menschen. Ohne ausdrückliche Owner-Promotion dieses einen Satzes baut niemand den
  Daemon-Claim-Pfad. (Die anderen Non-Goals — kein Auto-Dispatch serverseitig, kein ssh-Runner,
  kein Push — bleiben in Kraft und sind Stop-Linien, keine Verhandlungsmasse.)
- **G1 — Taste-Gate Board-Panel:** das Geräte-Panel ist eine sichtbare UI-Fläche; vor dem Land
  der Client-Änderung ein Owner-Blick (Screenshot in den Report).
- **G2 — Deploy auf den Linux-PC:** der Linux-PC liegt AUSSERHALB dieses Repos und damit
  außerhalb jeder Worktree-Isolation. Kein Worker fasst ihn an. Deploy des Daemons (Kopieren,
  systemd-Unit, Start) ist ein Owner-Akt oder ein von MAIN mit ausdrücklicher Owner-Freigabe
  ausgeführter Schritt — je Deploy einzeln.
- **Input, den nur der Owner hat:** der Abschlussbericht des Linux-Setups (Hostname,
  Tailscale-IP, User, Versionen von bun/tmux/git/zsh, WoL-Fähigkeit). Ohne ihn startet S3 nicht;
  S1 braucht ihn nicht.

## 2. Schnitte (je einer = eine Lane / ein Worker-Brief)

### S1 — Serverseite Stufe A: Geräte-Register mit Modi

`HelperDevice` um Heartbeat-Felder erweitern (`mode`, gemeldete Felder wie `load`,
`capabilities`), Wunsch-Modus je Gerät als Owner-setzbares Feld (Route im Owner-Scope, Wert wird
nur GESPEICHERT), Auslieferung des Wunsch-Modus in der Antwort von `POST /api/helper/device` —
der Daemon holt ihn per Pull, der Server schickt nichts. Persistenz-Migration: Felder optional,
alte fleet.json-Zeilen bleiben gültig.

- **Anfassen:** `server.ts` (HelperDevice, Device-Route, Persistenz), `e2e/helper-portal.ts`
  (neue Checks in der bestehenden Familie).
- **Nicht anfassen:** die fünf Helper-Routen-Formen und der Perimeter-Regex, wenn irgend
  möglich (Erweiterung des bestehenden Device-Vertrags statt Schwester-Route — Entwurf §5).
- **Done:** ein Device-POST mit `mode` wird gespeichert und in der Antwort steht der
  Owner-Wunsch-Modus; ein alter POST ohne die Felder verhält sich unverändert; e2e-Checks
  beweisen beides plus einen „should reject"-Fall (ungültiger Modus).
- **Verify:** volle lokale Kette (server.ts berührt) + `./e2e-isolated.sh` als Vorschau
  (e2e/ berührt).

### S2 — Board-Panel Geräte

Geräte-Panel in `src/client.ts` aus dem bestehenden Poll-Pfad: je Gerät Name, online/offline
(abgeleitet aus `lastSeen`, Schwelle dokumentieren), Ist-/Wunsch-Modus mit Toggle, gehaltene
Claims, Lapse-Zähler. Fremddaten (Name, gemeldete Felder) escaped rendern.

- **Done:** Panel zeigt ein registriertes Gerät mit allen Feldern; Toggle setzt den
  Wunsch-Modus über die S1-Route; Screenshot im Report (G1).
- **Verify:** volle Kette + `bun run build`; Demo-Repo-Hinweis beachten (client.ts-Änderung
  kann die Demo brechen — deren `bun run typecheck`/`build` mitfahren).

### S3 — Helper-Daemon (im Repo entwickelt, auf Linux deployt)

Ein Bun-Skript `helper-daemon/` in DIESEM Repo (damit es durch Gates und Review läuft) plus
systemd-Unit-Vorlage. Verhalten: poll `/api/helper/jobs` → claim → Bundle laden → klonen →
`bun install --frozen-lockfile` → Suite → `POST /api/helper/result` mit Exit, Tail, Trail-Id.
Modi: Wunsch-Modus vom Server (Pull, S1) hat Vorrang; lokal Quiet Hours und Load-Schwelle aus
einer Config-Datei; `off` heißt nicht pollen. Token ausschließlich per Header
`x-fleet-helper-token`, nie in URL/Prozessliste/Logs.

- **Done:** gegen eine Scratch-Fleet-Instanz (Muster e2e-isolated, NIE der Live-Server) claimt
  der Daemon einen Job, fährt die Suite, meldet das Ergebnis, und die Ledger-Zeile trägt
  `remote` mit Gerätename; `off`-Modus nachweislich ohne einen einzigen Request.
- **Verify:** eigener e2e-Check gegen die Scratch-Instanz + tsc über die neuen Dateien.

### S4 — Erstbetrieb auf dem Zielrechner (nach G0 + G2)

Deploy per Owner-Akt (G2), dann Messlauf: `./e2e-isolated.sh` N-mal (N ≥ 3) auf dem Linux-PC,
tmux-Version und Fail-Signaturen protokollieren — die Flake-Familien des Regelbuchs sind an
tmux 3.6a/macOS vermessen, der Linux-Baseline-Lauf ist die Adjudikationsgrundlage für jedes
spätere Remote-Rot. Ergebnis als Mess-Notiz unter `docs/messungen/`.

- **Done:** Baseline-Notiz mit Versionsstand, Laufzeiten und beobachteten Signaturen liegt
  committet vor; mindestens ein echter Portal-Job wurde vom Daemon remote gemessen und steht im
  Ledger.

### S5 — bewusst NICHT in diesem Programm

Instanz-Link B1 (erst wenn eine zweite Fleet-Instanz real existiert) · B2 Server-Proxy
(abgeraten, Entwurf §3) · serverseitiger Auto-Dispatch · ssh-Runner · jede iOS-Erwartung an den
Linux-PC · WoL-Automatik (Fähigkeit wird in S4 nur notiert).

## 3. Reihenfolge und Abhängigkeiten

G0 → S1 → {S2, S3 parallel} → G1 (mit S2) → G2 → S4. S1 ist die einzige Voraussetzung beider
Folge-Slices; S2 und S3 teilen keine Dateien.

## 4. Risiken, benannt

- **tmux-Versionsdrift** auf Linux ⇒ neue Flake-Signaturen; Gegenmittel ist die S4-Baseline,
  nicht Hoffnung.
- **Ein lügender/kompromittierter Helper** kann Grün melden — Tier-2 gated nichts, Provenienz
  (`remote` + Name) bleibt sichtbar, der lokale Drain misst beim nächsten Land ohnehin selbst.
  Akzeptiertes Restrisiko laut Machbarkeits-Notiz §8.
- **Token-Hygiene** auf der Linux-Seite: Header statt URL; Config-Datei 0600; nie in
  Unit-Files, die in `ps`/journalctl landen.
- **Scope-Inflation:** dieses Programm endet mit S4. Alles Weitere (B1, WoL-Automatik, weitere
  Job-Arten) ist ein neues Programm mit eigener Owner-Vorgabe.
