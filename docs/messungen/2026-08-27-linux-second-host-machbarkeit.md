---
frage: Kann der alte Linux-PC über Tailscale als zweiter Fleet-Work-Horse eingebunden werden (Modi, Suite-Runtime, Testumgebung, iOS), und wie ist die Sicherheitslage?
urteil: Ja über die bestehende Helper-Portal-Naht; Modi sind im Pull-Modell strukturell gratis, der fehlende Baustein ist ein Helper-Daemon auf Linux-Seite (Owner-Revision der Stage-1-Non-Goals), und iOS bleibt macOS-exklusiv, dort entlastet Linux nur indirekt
bereich: [helper-portal, multi-host, sicherheit]
belege: [server.ts#helperAuthed, server.ts#handleHelperRoute, src/helper.ts#bootstrapText, docs/helper-lane-suiten-entwurf-2026-08-26.md, docs/private-repo-p-sol-research-2026-08-23.md, 3bb8c15, 6c935db]
nicht-gemessen: kein Lauf auf echter Linux-Hardware (tmux-/zsh-/git-Versionen des Zielrechners, Suite-Laufzeit dort, systemd-Port des watchdog ungeprüft)
stand: 2026-08-27
---

# Linux-PC als zweiter Fleet-Work-Horse — Umsetzbarkeit und Sicherheitslage

2026-08-27, Lane `fleet/260827164432-4c00`. Frage: **kann der alte Linux-PC über Tailscale als
Work-Horse hochwertig eingebunden werden — mit Modi (nachts aus, bei wenig Load aus), als weitere
Suite-Mutex-Runtime, als zweite Testumgebung, für iOS-Entwicklung — und was ist die Sicherheitslage?**

Was hier ohne Marke steht, ist am Code dieses Baums gemessen (Kommandos in §Methode). Was ich nicht
messen konnte, trägt **ABGELEITET**.

## Ergebnis

### 1. Die Naht existiert bereits: THE REMOTE HELPER PORTAL

`server.ts` trägt seit `3bb8c15`/`6c935db` (gelandet 2026-08-26/27) einen kompletten
Zwei-Maschinen-Pfad — Kommentarblock „THE REMOTE HELPER PORTAL (stage 1)" vor
`server.ts#helperAuthed`:

- **Zwei Job-Arten:** Tier-2-Post-Land-Audits (`auditQueue`) und Lane-Vorschau-Suiten
  (`LaneSuiteJob`, von der Lane selbst angeboten).
- **Pull, nie Push:** die zweite Maschine pollt `/api/helper/jobs`, claimt, lädt ein Git-Bundle
  über dieselbe authentifizierte HTTP-Fläche, läuft lokal, meldet Exit-Code + Log-Tail zurück.
  Der Server weist nichts zu.
- **Übernommen, nie dupliziert, nie verloren:** Claim blockt den lokalen Drain, Claim verfällt
  (`HELPER_CLAIM_TIMEOUT_MS`, Default 45 min), verfallene Audits fallen an den lokalen Drain
  zurück, verfallene Vorschauen werden gereapt. Die Fehlrichtung ist im Code benannt: „too much
  local work, never a tree nobody audited."
- **Betriebsstand:** `remote: 0` Zeilen im Audit-Ledger (docs/helper-lane-suiten-entwurf §1.1) —
  das Portal hat produktiv noch nie eine Zeile erzeugt. Aussagen über Betrieb sind ABGELEITET aus
  Code und `e2e/helper-portal.ts`/`e2e/lane-suite.ts`.

### 2. Linux-Tauglichkeit der Arbeitslast

Anforderungen an die Helfer-Maschine laut `src/helper.ts#bootstrapText`: **bun · tmux · git ·
zsh** — alle vier auf jeder Distribution verfügbar. Linux ist nicht Neuland, sondern bereits
eingearbeitet: `e2e-isolated.sh` setzt `git init -b main` explizit gegen Debians git 2.39
(gemessener Container-Befund 2026-08-02, 35 Checks; Kommentar in der Datei), und `Dockerfile` +
`container-firewall.sh` + `docker-verify.sh` existieren als Linux-Laufumgebung. Restrisiko:
die Flake-Familien im Regelbuch sind an tmux 3.6a (macOS/brew) vermessen — eine andere
tmux-Version kann neue Signaturen zeigen; das ist Adjudikations-, kein Blocker-Risiko.

### 3. Modi („nicht immer an") sind im Pull-Modell strukturell gratis

Der zentrale Wunsch — Rechner nachts aus, bei wenig Load aus — verlangt serverseitig **nichts**:
eine Maschine, die nicht pollt, claimt nichts; ein laufender Claim, der stirbt, verfällt und
fällt zurück. Die Verfügbarkeits-Policy gehört deshalb vollständig auf die Linux-Seite (Config
des Helper-Daemons, §4): Quiet Hours, Load-Schwelle, manueller Schalter, Wake-on-LAN wären dort
lokale Entscheidungen, und der Mac-Server muss keinen einzigen Zustand darüber führen. Das ist
dieselbe Entwurfsrichtung, die das Portal schon gewählt hat — kein Scheduler-Umbau nötig.

### 4. Was fehlt: der Helper-Daemon (und das ist eine Owner-Entscheidung)

Stage 1 hat drei **vom Owner gesetzte** Non-Goals (Kommentar im Portal-Block): kein
Auto-Dispatch · kein ssh-Runner · kein Push; „a human on the other machine clicks claim". Die
gewünschte High-Level-Einbindung ersetzt genau diesen Menschen durch einen Daemon auf dem
Linux-PC: poll → claim → Bundle klonen → `bun install` + `./e2e-isolated.sh` → Ergebnis POSTen.
Serverseitig bleibt „der Server weist nichts zu" wahr — aber der Satz „ein Mensch klickt" fällt,
also ist das eine **Revision der Stage-1-Non-Goals und braucht Owner-Promotion** (die Anfrage,
die diese Analyse ausgelöst hat, ist der Anlass, nicht schon der Akt). ABGELEITET: der Daemon
ist klein (ein Bun-Skript + systemd-Unit mit den Modi aus §3); die Serverseite braucht dafür
höchstens Kosmetik (der Ergebnis-Rückweg existiert als `/api/helper/result`).

### 5. Der gemessene Gewinn

- Suite-Mutex dieser Maschine: **p50 800 s / p90 1426 s** je Lauf über 271 vermessene
  Ledger-Zeilen (docs/helper-lane-suiten-entwurf-2026-08-26.md §1.1) — und genau ein Mutex.
- Zwei parallele `./e2e-isolated.sh` auf DIESER Maschine erzeugen zuverlässig Fehler auf beiden
  Bäumen (Regelbuch, Messungen in docs/attic/regelbuch-messgeschichten-2026-08.md §11). Ein
  zweiter Rechner ist die einzige saubere Parallelisierung — Lastisolation ist der eigentliche
  Grund für die Maschine, nicht rohe Rechenzeit.

### 6. iOS: der Linux-PC kann es nicht, er macht es möglich

docs/private-repo-p-sol-research-2026-08-23.md legt den kleinsten iOS-Stack fest: volles Xcode 26.6 +
Simulator-Runtime, `xcodebuild`/`simctl` — **macOS-exklusiv**, kein Linux-Äquivalent. Der
Beitrag des Linux-PCs zu iOS ist indirekt und real: er nimmt Suite-/Audit-/Testlast vom Mac,
damit dort Storage, CPU und der Suite-Mutex für Xcode + Simulator frei werden (der Research-Doc
nennt als aktuellen Blocker u. a. ungeklärten freien Speicher auf diesem Host).

### 7. Volle Session-Runtime auf Linux (Lanes dort laufen lassen): zwei Wege

Das Portal deckt Suiten, keine Sessions. Für „Linux-PC führt selbst Agent-Sessions":

- **(a) Zweiter eigenständiger Fleet-Server auf dem Linux-PC** — `server.ts` ist bun+tmux ohne
  macOS-API; nur `watchdog.sh` ist launchd-gebunden und bräuchte eine systemd-Unit. Föderation
  auf Owner-Ebene (zwei Dashboards, beide über Tailscale). Heute machbar, kein Fleet-Umbau.
- **(b) Cross-Host-Dispatch im bestehenden Server** — `server.ts#tmux` spawnt lokal
  `tmux -L SOCK`; jede der ~50 Aufrufstellen ist host-lokal gedacht, ebenso Worktrees,
  Pipe-Panes und Dateipfade. ABGELEITET: das ist ein Architektur-Umbau, kein Feature, und
  widerspräche der bewussten Zeile „tmux stays host-local" im Perimeter-Kommentar. Nicht der
  erste Schritt.

Empfehlungsreihenfolge, an der Owner-Vorgabe abgeschnitten („erstmal Umsetzbarkeit prüfen"):
Stufe 1 Helper-Daemon mit Modi-Config (§4) → Stufe 2 bei Bedarf eigener Fleet-Server (§7a).
Mehr ist aus dieser Analyse nicht ableitbar.

### 8. Sicherheitslage

- **Bind:** `FLEET_HOST` Default `127.0.0.1`; netzerreichbar erst durch explizites Setzen auf
  die Tailscale-IP, und jede Anfrage bleibt token-pflichtig (`server.ts`, Kommentar über `HOST`:
  „a reachable fleet is remote code execution as your user").
- **Helper-Prinzipal ist positional gescoped** (`server.ts#helperAuthed` +
  `server.ts#handleHelperRoute`): eigenes `x-fleet-helper-token`, dispatcht **nach** dem
  SHARE_HOSTS-Gate (vom öffentlichen Tunnel strukturell unerreichbar) und **vor** dem
  Owner-Gate (fällt nie auf Owner-Routen durch). Genau fünf Routen: jobs · device · claim ·
  result · `bundle/[0-9a-f]{12}`. Fehlversuche landen als `helper_auth_fail` im Audit-Ledger,
  nie mit dem versuchten Token.
- **Was ein kompromittierter Linux-PC könnte:** Bundles lesen (Quellcode-Abfluss der
  angebotenen Bäume), falsche Verdikte melden (Zeilen tragen `remote`-Provenienz + Gerätename;
  Tier-2 gated nichts, ein Lügen-Grün maskiert also höchstens, was der lokale Drain beim
  nächsten Land ohnehin wieder misst), Claims verfallen lassen (Lapse-Ledger macht das Muster
  sichtbar). **Was er nicht kann:** Panes, Slots, Land, Merge, Owner- oder Self-Routen.
- **Die Richtung ist das Feature:** der Mac führt nie Code aus, den der Linux-PC schickt — der
  Verzicht auf einen ssh-Runner ist im Portal-Block als Non-Goal notiert und sollte auch in
  Stage 2 stehen bleiben (der Daemon lebt auf der Linux-Seite und kehrt die Richtung nicht um).
- **Ein Hygiene-Punkt für den Daemon:** die Portal-Übergabe nutzt `?token=…` in der URL (für den
  Browser-Bootstrap in Ordnung); ein Daemon soll den Header `x-fleet-helper-token` verwenden,
  damit das Token nicht in Shell-History/Prozesslisten/Logs der Linux-Seite steht — dieselbe
  Token-Hygiene-Klasse, die das Regelbuch für `ps` kennt.

## Methode

Alle Kommandos im Worktree `fleet/260827164432-4c00` (HEAD `2d88521`):

```
grep -n "tmux" server.ts | head -60                # tmux-Aufrufstellen, alle SOCK-lokal
grep -n "ssh\|remote" server.ts | head -30         # → REMOTE HELPER PORTAL Block gefunden
sed -n 11690,11870p server.ts                      # Portal-Design, Non-Goals, beide Job-Arten
grep -n "helper" server.ts | grep -i "route\|auth\|token"   # helperAuthed, handleHelperRoute, Scope
sed -n 20340,20350p server.ts                      # Handler-Position: nach SHARE_HOSTS, vor Owner-Gate
sed -n 105,130p src/helper.ts                      # bootstrapText: bun·tmux·git·zsh, Klon-Ritual
sed -n 78,92p e2e-isolated.sh                      # git init -b main, Debian-2.39-Befund
grep -n "FLEET_HOST\|launchd" server.ts watchdog.sh          # Bind-Default, launchd-Bindung
git log --oneline -3 -- e2e/lane-suite.ts src/helper.ts      # 3bb8c15, 6c935db, fb22efc
head -50 docs/private-repo-p-sol-research-2026-08-23.md          # Xcode-macOS-Exklusivität
sed -n 1,80p docs/helper-lane-suiten-entwurf-2026-08-26.md   # p50/p90, remote:0
```

## Was nicht gemessen wurde

Kein Lauf auf echter Linux-Hardware: tmux-/zsh-/git-Versionen des Zielrechners, Suite-Laufzeit
und -Determinismus dort, der systemd-Port des watchdog und Wake-on-LAN sind ungeprüft. Der
Share-Perimeter (`src/share.ts`) wurde nur per grep auf die Helper-Position geprüft, nicht
gelesen. Der Daemon aus §4 ist Entwurf, nicht Code; sein Aufwand ist ABGELEITET. Ob der Owner
die Stage-1-Non-Goals revidiert, ist offen — diese Notiz ist die Entscheidungsgrundlage, nicht
die Entscheidung.
