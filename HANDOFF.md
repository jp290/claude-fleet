# HANDOFF — Program-MAIN „Linux-Work-Horse" (Slot 16, second-hostImplementierung), 2026-08-29

Zustand wird ABGELEITET: `./state.sh` · `./register.sh` · Live-Queue. Vorgänger-Handoff: `3c209d7`
(Themen-Session hugFaceInci; deren §2-Blocker ist inzwischen anders gelöst, siehe unten „Stash").

## Rolle und Programm — DU BIST DIE NACHFOLGERIN DIESER PROGRAM-MAIN

Programm **fcf3fec9c9e88bd33749e7d5** „Linux-Work-Horse-Anbindung", Status active, Plan:
`docs/linux-second-host-programm-2026-08-28.md`. G0-Promotion (Daemon darf claimen) ist im
Programm-Datensatz `decisions` verankert; Stop-Linien unverändert: kein Auto-Dispatch, kein
ssh-Runner (Richtung Mac←Linux), kein Push, kein B2-Proxy. Owner-Gates: G1 erledigt (Owner sah
Panel, forderte 💻-Knopf nach, geliefert). **G2 ist vom Owner freigegeben** („gogo", 2026-08-29,
nach Wecken des Rechners) — der Daemon-Deploy auf den second-host ist dein nächster Schritt.

## Stand: S1–S3 KOMPLETT (gelandet, auditiert grün, deployt)

- S1 Geräte-Register `d56cb20` · S3 Helper-Daemon `7b96534` · S2 Panel+💻 `fdae94e` — alle drei
  Audits grün 3133/0. Live-Server läuft auf `fdae94e` (Verb-2-Deploy verifiziert: bootHead=HEAD,
  bundleStale:false). Tasks e69a2bec/ff9fbf06/d923ad4c done im Programm.
- Zwei Land-Rots unterwegs waren BEIDE die claude-gate-Phase-3-Flake („server did not come up",
  KEINE server.log = nie gemessen), beide von den Lanes regelkonform am selben Baum widerlegt.
  Dritte Sichtung wäre ein Fall für docs/verify-tiering.md.

## Was JETZT ansteht (S4, in dieser Reihenfolge)

1. **ssh auf den second-host**: `ssh second-hostowner@100.64.0.2`. Der Rechner LÄUFT (per WoL
   geweckt 2026-08-29 früh). Blocker beim Übergabezeitpunkt: unser Key
   (`~/.ssh/id_ed25519.pub`, owner@owner-mac.local) war NICHT in dessen
   authorized_keys — der Owner wollte ihn eintragen. Erst testen, bei Ablehnung Owner erinnern.
2. **Konnektivität second-host→Fleet**: von dort `curl http://100.64.0.1:8790/` — HTTP-Code egal,
   Erreichbarkeit zählt (Tailnet-ACL-Frage aus dem Setup-Report offen).
3. **Daemon-Deploy (G2, freigegeben)**: `helper-daemon/README.md` folgen — Verzeichnis kopieren,
   Config 0600 mit Helper-Token (`fleet.json` → `helperToken`), Unit-Vorlage
   `fleet-helper.service`. Token NIE in argv/URL/Unit-Env. Owner schläft ggf. im selben Raum —
   Modus-Empfehlung beim Start: quiet/off respektieren; Daemon-Semantik ist „leiser gewinnt"
   (bewusste Abweichung, Kopfkommentar in helper-daemon/daemon.ts).
4. **S4-Baseline**: ≥3× `./e2e-isolated.sh` auf dem second-host (tmux 3.5a! Regelbuch-Flakes sind
   an 3.6a vermessen), Laufzeiten+Signaturen als Mess-Notiz unter docs/messungen/ — OHNE echte
   IPs/User/MAC (Repo public; Gerätename „second-host" ok). Mindestens ein echter Portal-Job remote
   im Ledger = Programm-DONE, dann Programm auf complete.

## Fakten, die nur hier stehen

- **Setup-Report des second-host liegt PRIVAT**: `~/claude-fleet-private/docs/second-host-setup-report-2026-08-28.md`
  (IPs, User, MAC, WoL-Kommando — nie ins public Repo). WoL geht nur als LAN-Broadcast; dieser
  Mac hängt selbst im 178er-LAN und kann direkt wecken (Kommando in der Notiz).
- **Stash@{0} im Haupt-Checkout**: verwaiste Slot-16-Sol-Arbeit vom 27.08. (server.ts u. a.).
  Autor-Session tot, Slot-12-Sol verneinte Besitz; ich habe gestasht statt committet, um Lands zu
  entsperren. Owner hat nie über Verbleib entschieden — NICHT droppen, bei Gelegenheit Owner
  fragen. Das D1-Land aus Handoff 3c209d7 §2 (Slot 10) wurde dadurch ebenfalls entsperrt, gehört
  aber nicht diesem Programm.
- **Watch-Naht-Lektion (2× bezahlt)**: `{kind:"merge"}`-Subscribe nach einem Terminal-Ergebnis
  oder während ein Merge LÄUFT gibt den VERBRAUCHTEN Watch zurück (`armed:false`) und feuert nie
  für den nächsten Merge — immer `armed:true` im Response prüfen, sonst Poll als Fallback.
- Für Program-Zeilen-Nachschub: Owner-Route `POST /api/tasks` mit `programId` + `/brief` +
  `/dispatch` (diese Session war nie mechanisch als program.main gebunden — bootstrap-main spawnt
  nur neue Sessions; operativ ging alles über Owner-Routen, `owner_token_ambient_use`-Flag ist
  dabei bekanntes Rauschen).
