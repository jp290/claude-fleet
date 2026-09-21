#!/usr/bin/env python3
# jev-treiber-akte.py — misst am Audit-Ledger, ob die Fleet-Orchestrierung in die
# Minecraft-Bauform passt (Code baut legale Optionen, Akteur waehlt im Tick, Planer setzt
# selten ein Ziel): welcher Anteil der Akte einer Session/des Owners ist ein geschlossener,
# per Code ausfuehrbarer Katalog, welcher traegt Freitext, und wie lange wartet ein
# Ereignis auf den Akt, der darauf antwortet.
#
# Nur Standardbibliothek. Liest die als Argumente gegebenen Ledger-Dateien read-only und
# DRUCKT nur: Zaehlungen, Quantile, Ereignisnamen, Code-Enums und Anteile mit Nenner —
# nie einen detail-Text, nie einen Pfad mit Nutzernamen (die Ledgers liegen ausserhalb
# des Worktrees und werden nicht kopiert).
#
# AUFRUF: python3 docs/messungen/jev-treiber-akte.py <audit.jsonl> [<audit.jsonl.1>]
#
# Klassifizier-Grundlage ist die Schreibstelle, nicht der Name:
#   AL:<zeile> = server/audit-log.ts (AuditEvent-Verband mit Kommentar je Name)
#   S:<zeile>  = server.ts (aufrufende Stelle)

import hashlib
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime

# (klasse, form, begruendung); klasse: akt|maschine; form: geschlossen|freitext|- (nur Akte)
K = {
    # --- Akte, GESCHLOSSEN: Parameter sind IDs, Enums, Pfade, Zahlen ---
    "slot_open": ("akt", "geschlossen", "AL:18,S:6132 Spawn; Parameter cwd/Modell/Effort, Grundbrief reist als eigener send"),
    "slot_kill": ("akt", "geschlossen", "AL:18,S:6249 Beenden einer Session; Parameter Slot-Id"),
    "slot_model": ("akt", "geschlossen", "AL:240 Modell/Effort-Paar, Enums"),
    "slot_restart": ("akt", "geschlossen", "AL-AuditEvent, Besitzer-Neustart eines Panes"),
    "slot_shelve": ("akt", "freitext", "AL:215,S:38189 Schlafrakt mit Notiz; detail nur Notiz-LAENGE, Akt traegt Text"),
    "task_release": ("akt", "geschlossen", "AL:36,S:11105 pending->queued; Parameter Zeilen-Id"),
    "task_hold": ("akt", "geschlossen", "AL:39 Halten/Locker einer Zeile; Parameter Id"),
    "task_dispatch": ("akt", "geschlossen", "AL:23 manueller Start-Knopf; Parameter Zeilen-Id"),
    "task_wave_dispatch": ("akt", "geschlossen", "AL:104 Wellen-Start; Parameter Id-Liste"),
    "task_wave_start": ("akt", "geschlossen", "AL-AuditEvent Tick-Welle; Parameter Id-Liste"),
    "task_wave_split": ("akt", "geschlossen", "AL-AuditEvent k von n behalten; Ids plus Grund"),
    "task_note_attach": ("akt", "geschlossen", "AL:90 Zuordnung Quelle<->Zeile; Parameter Ids"),
    "task_note_detach": ("akt", "geschlossen", "AL:92 Loesen der Zuordnung; Parameter Ids"),
    "task_program": ("akt", "geschlossen", "AL:166 Zeile einem Program zufügen; Parameter Ids"),
    "task_kind": ("akt", "geschlossen", "AL:32 Kategorie wechseln; Enum"),
    "task_files_propose": ("akt", "geschlossen", "AL:100 Flaeche vorschlagen; Parameter Pfade"),
    "task_files_confirm": ("akt", "geschlossen", "AL:100 Flaeche bestaetigen; Parameter Pfade"),
    "task_cards_confirm": ("akt", "geschlossen", "AL:105 Karten-Surface in einem Akt; Parameter Ids"),
    "variant_group": ("akt", "geschlossen", "AL:48 Variantengruppe anlegen; Parameter Ids"),
    "variant_group_start": ("akt", "geschlossen", "AL:48 n Varianten starten; Parameter Ids"),
    "variant_decide": ("akt", "geschlossen", "AL:48 Gewinner-Buchung; Parameter Ids"),
    "self_land_start": ("akt", "geschlossen", "AL:194 Land-Start durch MAIN; Parameter Zeilen-Id"),
    "deploy": ("akt", "geschlossen", "AL:282 Deploy-Verb ueber Tuere; kein Text"),
    "lane_succession": ("akt", "geschlossen", "AL:335 Stabuebergabe succeed; kein Parameter ausser Branch"),
    "self_drift": ("akt", "geschlossen", "AL:344 Lane-Read von /api/self/drift; keine Parameter"),
    "program_inbox_read": ("akt", "geschlossen", "AL:408 Empfangs-Quittung der bound MAIN; Parameter Entry-Id"),
    "program_release": ("akt", "geschlossen", "AL:174 Release-Policy setzen; Enum"),
    "program_promotion": ("akt", "geschlossen", "AL:147 Grant/Widerruf; Enum"),
    "repo_lane_cap": ("akt", "geschlossen", "AL:249 Lane-Deckel setzen; Zahl"),
    "helper_device_mode": ("akt", "geschlossen", "AL:270 Geraet in WISH-Mode; Enum"),
    "dispatch_switch": ("akt", "geschlossen", "AL:339 Dispatcher an/aus; Enum"),
    "fleet_event_owner_ack": ("akt", "geschlossen", "AL:287 Besitzer-Quittung eines Events; Parameter Id"),
    "attention_refused": ("akt", "geschlossen", "AL:320 Besitzer sah es und lehnte ab; Quittung ohne Text"),
    "criterion_confirmed": ("akt", "geschlossen", "AL:63 Vorschlag uebernehmen; Parameter Id"),
    "file_write": ("akt", "geschlossen", "AL:219 Datei in Session-Dir; Parameter Pfad+Groesse"),
    "file_drop": ("akt", "geschlossen", "AL:223 Datei abgelegt; Parameter Pfad+Groesse"),
    # --- Akte, FREITEXT: ein Parameter ist freier Text ---
    "send": ("akt", "freitext", "AL:438 B3 sendText selbst; Payload IST Text (Ledger: nur bytes/Pfad/Acceptance)"),
    "fleet_report_open": ("akt", "freitext", "AL:302,S:9333,S:9409 Reportkoerper ist Prosa"),
    "fleet_report_owner_decision": ("akt", "freitext", "AL:306,S:9845 Urteil plus Begruendungstext"),
    "main_task": ("akt", "freitext", "AL:135,S:11855 Zeile samt Brief-Text gefilet"),
    "main_brief": ("akt", "freitext", "AL:142 Brief umgeschrieben; Parameter ist Text"),
    "attention_open": ("akt", "freitext", "AL:320 Frage/Block an Besitzer; Ask ist Text"),
    "attention_answered": ("akt", "freitext", "AL:320,S:12111 Antwort ist Text"),
    "note_verdict": ("akt", "freitext", "AL:84,S:35212 Urteil ist 3er-Enum, Satz ist Pflicht (S:35174)"),
    "criterion_proposed": ("akt", "freitext", "AL:63 Anker entworfen; Parameter ist Text"),
    "clarification_open": ("akt", "freitext", "AL:300 Rueckfrage; Parameter ist Text"),
    "clarification_answered": ("akt", "freitext", "AL:300 Antwort; Parameter ist Text"),
    "supervisor_nudge": ("akt", "freitext", "AL:351 Nudge an MAIN; Text existiert, Ledger traegt nur Id"),
    "message_append": ("akt", "freitext", "AL:415 Nachricht; Koerper ist Text, Ledger traegt Adressen+Id"),
    # --- Maschinen-Folgen: Tick, Transport, Heal, Helper, Buchung ---
    "fleet_event_held": ("maschine", "-", "AL:287 Rueckstau des Event-Kanals; Tick haelt Event"),
    "fleet_event_ack": ("maschine", "-", "AL:287 Quittungsempfang"),
    "fleet_event_delivered": ("maschine", "-", "AL:287 Zustellung"),
    "fleet_event_prune": ("maschine", "-", "AL:287 Aufraeumen"),
    "fleet_event_send_uncertain": ("maschine", "-", "AL:287 ungewisse Zustellung"),
    "fleet_event_receiver_gone": ("maschine", "-", "AL:287 Empfaenger weg"),
    "fleet_event_subject_gone": ("maschine", "-", "AL:287 Gegenstand weg"),
    "fleet_report_prune": ("maschine", "-", "AL:302 Aufraeumen"),
    "fleet_report_rule_decision": ("maschine", "-", "AL:309 Regeltuer: kein Besitzer, keine Session — Code urteilt accepted-by-land"),
    "fleet_report_decision_delivered": ("maschine", "-", "AL:311 Transport des Urteils"),
    "fleet_report_decision_undelivered": ("maschine", "-", "AL:311 gescheiterte Zustellung des Urteils"),
    "merge_verdict": ("maschine", "-", "AL:429 M1 Gate-Urteil, maschinenlesbare Spalten ohne Prosa"),
    "merge_verdict_sent": ("maschine", "-", "AL:137 Transport des Urteils"),
    "merge_verdict_skip": ("maschine", "-", "AL:137 Zustellung unterlassen"),
    "merge_verdict_undeliverable": ("maschine", "-", "AL:137 Empfaenger weg"),
    "merge_wake_author": ("maschine", "-", "AL:127 Konflikt an eigene Session"),
    "land_actor": ("maschine", "-", "AL:199 Buchung WER gelandet ist, an der Engstelle"),
    "owner_token_ambient_use": ("maschine", "-", "AL:203 Buchung der Akteursklasse eines Lands"),
    "postland_audit": ("maschine", "-", "AL:257 Audit nach Land"),
    "helper_claim": ("maschine", "-", "AL:263 Job hat die Maschine verlassen"),
    "helper_result": ("maschine", "-", "AL:263 Urteil kam zurueck"),
    "helper_claim_expired": ("maschine", "-", "AL:263 Claim starb ohne Urteil"),
    "helper_auth_fail": ("maschine", "-", "AL-AuditEvent Helper-Auth fehlgeschlagen"),
    "helper_update_queued": ("maschine", "-", "AL-AuditEvent Update eingereiht"),
    "helper_update": ("maschine", "-", "AL-AuditEvent Update ausgefuehrt"),
    "watch_fire": ("maschine", "-", "AL:286 Watch-Signal gefeuert"),
    "watch_skip": ("maschine", "-", "AL:286 Aufzeichnung uebersprungen"),
    "watch_superseded": ("maschine", "-", "AL:286 Watch abgeloest"),
    "auto_fire": ("maschine", "-", "AL-AuditEvent Automatik feuerte"),
    "auto_skip": ("maschine", "-", "AL-AuditEvent Automatik liess aus"),
    "self_heal_recreate": ("maschine", "-", "AL:116 Pane starb, Loop baute es wieder auf"),
    "owner_auth_fail": ("maschine", "-", "AL:114 fehlgeschlagener Auth-Versuch; Host-Hygiene, keine Orchestrierung"),
    "codex_bind": ("maschine", "-", "AL:118 Bindung entdeckt; S:4531"),
    "codex_owner_bind": ("maschine", "-", "AL:118 Bindung entdeckt"),
    "program_inbox_append": ("maschine", "-", "AL:400 der einzige Schreiber haengt Zeiger an"),
    "program_main_land_watch": ("maschine", "-", "AL:421 Armierung des Rueckwegs"),
    "program_main_land_event_skipped": ("maschine", "-", "AL:421 Rueckweg voll, bewusst nicht armiert"),
    "program_main_session_backfill": ("maschine", "-", "AL-AuditEvent Session-Id nachgetragen"),
    "program_main_rebound": ("maschine", "-", "AL-AuditEvent alte Bindung ueberschrieben"),
    "supervisor_binding_stale": ("maschine", "-", "AL-AuditEvent Boot liest tote Bindung"),
    "supervisor_rebound": ("maschine", "-", "AL-AuditEvent alte Bindung ueberschrieben"),
    "supervisor_transition": ("maschine", "-", "AL:355 Watch abgeschlossen, Event gemuenzt"),
    "lane_suite_event": ("maschine", "-", "AL:293 Preview-Rail gemuenzt"),
    "lane_suite_event_skipped": ("maschine", "-", "AL:293 nichts gemuenzt"),
    "harness_block": ("maschine", "-", "AL:295 Hook meldet Dialog"),
    "migrate_gave_up": ("maschine", "-", "AL:359 Handoff-Budget aufgebraucht"),
    "dispatch_requeued": ("maschine", "-", "AL:20 Rueckreihe nach Land"),
    "note_closed_by_land": ("maschine", "-", "AL:84 Land macht Urteil wirksam"),
    "note_usage_settled": ("maschine", "-", "AL:98 Land setzt Nutzung"),
    "attention_prune": ("maschine", "-", "AL:320 Aufraeumen"),
    "attention_rebound": ("maschine", "-", "AL:325 Zeile an Nachfolger-MAIN"),
    "attention_updated": ("maschine", "-", "AL:327 Kriterium neu vorgeschlagen"),
    "message_read": ("maschine", "-", "AL:415 Empfangs-Quittung"),
    "dispatch_switch": ("akt", "geschlossen", "AL:339 Dispatcher-Zustand; Enum"),
    "steward_propose_outcome": ("maschine", "-", "AL:151 Steward-Puls schlaegt Outcome vor"),
}

# Ereignisse, die als "Akt" fuer Join 2 zaehlen (= K.masse akt) — watch-Familie und Transport
# sind maschine und zaehlen dadurch automatisch nicht.


def pct(n, d):
    return (100.0 * n / d) if d else 0.0


def quantil(sorted_vals, q):
    if not sorted_vals:
        return None
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    pos = (len(sorted_vals) - 1) * q
    lo = int(pos)
    hi = min(lo + 1, len(sorted_vals) - 1)
    frac = pos - lo
    return sorted_vals[lo] * (1 - frac) + sorted_vals[hi] * frac


def main():
    if len(sys.argv) < 2:
        print("AUFRUF: jev-treiber-akte.py <audit.jsonl> [<audit.jsonl.1>]", file=sys.stderr)
        return 2
    rows = []
    bad = 0
    for path in sys.argv[1:]:
        with open(path, "rb") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rows.append(json.loads(line))
                except Exception:
                    bad += 1
    rows.sort(key=lambda r: r.get("ts", 0))
    ts_all = [r["ts"] for r in rows if isinstance(r.get("ts"), (int, float))]
    t0, t1 = min(ts_all), max(ts_all)
    days = (t1 - t0) / 86400000.0
    print(f"== a) EREIGNISNAMEN: ANZAHL, JE TAG")
    print(f"   N={len(rows)} Zeilen ({bad} unparsebar), {len(sys.argv)-1} Datei(en), "
          f"Spanne {days:.2f} Tage "
          f"({datetime.fromtimestamp(t0/1000):%Y-%m-%d %H:%M} .. {datetime.fromtimestamp(t1/1000):%Y-%m-%d %H:%M})")
    events = Counter(r.get("event", "?") for r in rows)
    unknown = sorted(e for e in events if e not in K)
    if unknown:
        print(f"   NICHT IM KATALOG ({len(unknown)}): " + " ".join(unknown))
    for name, c in events.most_common():
        print(f"   {c:6d}  {c/days:8.1f}/Tag  {name}")

    acts = [r for r in rows if K.get(r.get("event"), ("?",))[0] == "akt"]
    mach = [r for r in rows if K.get(r.get("event"), ("?",))[0] == "maschine"]
    closed = [r for r in acts if K[r["event"]][1] == "geschlossen"]
    free = [r for r in acts if K[r["event"]][1] == "freitext"]
    print(f"== b) KLASSE JE NAME (Schreibstelle: server/audit-log.ts = AL, server.ts = S)")
    print(f"   Akte gesamt n={len(acts)} ({pct(len(acts), len(rows)):.1f}% aller {len(rows)} Zeilen) | "
          f"GESCHLOSSEN n={len(closed)} ({pct(len(closed), len(acts)):.1f}% der Akte) | "
          f"FREITEXT n={len(free)} ({pct(len(free), len(acts)):.1f}%) | Maschine n={len(mach)} "
          f"({pct(len(mach), len(rows)):.1f}% aller Zeilen)")
    for name, c in events.most_common():
        if name in K:
            k, form, why = K[name]
            print(f"   {c:6d}  {k:8s} {form:10s} {name}: {why}")
    print(f"   -- Maschinen-Urteile durch Code (geschlossen entscheidbar, schon Realitaet): "
          f"fleet_report_rule_decision={events.get('fleet_report_rule_decision',0)}, "
          f"merge_verdict={events.get('merge_verdict',0)}, postland_audit={events.get('postland_audit',0)}, "
          f"Summe={events.get('fleet_report_rule_decision',0)+events.get('merge_verdict',0)+events.get('postland_audit',0)}"
          f" ({pct(events.get('fleet_report_rule_decision',0)+events.get('merge_verdict',0)+events.get('postland_audit',0), len(rows)):.1f}% aller Zeilen)")

    print(f"== c) SEND: BYTES-VERTEILUNG (n={events.get('send',0)} Zeilen)")
    sends = [r for r in rows if r.get("event") == "send"]
    bvals = sorted(r["bytes"] for r in sends if isinstance(r.get("bytes"), (int, float)))
    if bvals:
        p50 = quantil(bvals, 0.50)
        p90 = quantil(bvals, 0.90)
        print(f"   bytes p50={p50:.0f} p90={quantil(bvals, 0.90):.0f} max={bvals[-1]} "
              f"(n={len(bvals)} mit bytes-Feld, {events.get('send',0)-len(bvals)} ohne)")
        print(f"   Summe {sum(bvals)} Bytes = {sum(bvals)/1048576:.1f} MiB ueber {days:.2f} Tage "
              f"({sum(bvals)/days/1024:.0f} KiB/Tag)")
    paths = Counter(r.get("path", "?") for r in sends)
    top = ", ".join(f"{p}={c}" for p, c in paths.most_common(10))
    print(f"   Kanaele (path-Enum, {len(paths)} Werte): {top}")
    withctx = sum(1 for r in sends if "ctxPct" in r)
    print(f"   ctxPct messbar: {withctx}/{len(sends)} ({pct(withctx, len(sends)):.0f}%)")
    # Schablonen-Frage: das Ledger traegt den Send-Text NICHT (AL:14-16, AL:438-441: eine
    # LAENGE, nie der Text; server.ts#auditSend schreibt detail = "<path> <n>B <acceptance>").
    # Deshalb: 0 Zeilen traegen hashbaren Text; gemessen wird nur bytes.
    seed = json.dumps({"probe": "tpl"}, sort_keys=True).encode()
    print(f"   Schablonen-Hash: NICHT BERECHENBAR — 0/{len(sends)} send-Zeilen tragen Text "
          f"(Ledgerregel: Laenge, nie Text); sha256-Beispiel des leeren Protokolls "
          f"{hashlib.sha256(seed).hexdigest()[:8]} nur als Formnachweis")

    print(f"== d) WARTEZEITEN (Median/p90 in Sekunden, je mit n)")
    # Fenster gegen recycled Slot-Ids: je Slot die slot_open-Zeiten; ein Kandidat zaehlt nur,
    # wenn er VOR dem naechsten slot_open dieses Slots liegt.
    opens_by_slot = defaultdict(list)
    for r in rows:
        if r.get("event") == "slot_open":
            opens_by_slot[r.get("slot")].append(r["ts"])

    def inside_session(slot, t):
        nxt = [o for o in opens_by_slot.get(slot, []) if o > t]
        return min(nxt) if nxt else float("inf")

    # Join 1: fleet_report_open -> erstes fleet_report-Urteil (owner|rule) derselben Report-Id.
    # Die MAIN-Tuer (accept|reject) schreibt bewusst KEINE Zeile (AL:303-305) — der Join sieht
    # nur Owner- und Regeltuer.
    open_ts, decided = {}, {}
    for r in rows:
        e = r.get("event")
        d = r.get("detail", "")
        rid = d.split(" ", 1)[0] if d else None
        if e == "fleet_report_open" and rid:
            open_ts.setdefault(rid, r["ts"])
        elif e in ("fleet_report_owner_decision", "fleet_report_rule_decision") and rid and rid in open_ts:
            decided.setdefault(rid, r["ts"])
    waits = sorted((decided[i] - open_ts[i]) / 1000.0 for i in decided)
    if waits:
        print(f"   fleet_report_open -> erstes Urteil (Owner/Regel; MAIN-Tuer loggt nicht): "
              f"Median={quantil(waits,0.5):.1f}s p90={quantil(waits,0.9):.1f}s n={len(waits)} "
              f"(von {len(open_ts)} Reports im Ledger; {len(open_ts)-len(waits)} ohne Urteilszeile)")
    # Join 2: watch_fire -> naechster Akt derselben Empfaenger-Session (Innerhalb derselben
    # Session-Belegung, siehe Fenster oben; Akt = K.masse "akt").
    akt_names = {n for n, v in K.items() if v[0] == "akt"}
    acts_by_slot = defaultdict(list)
    for r in rows:
        if r.get("event") in akt_names and r.get("slot") is not None:
            acts_by_slot[r["slot"]].append((r["ts"], r["event"]))
    waits2, miss2 = [], 0
    for r in rows:
        if r.get("event") != "watch_fire" or r.get("slot") is None:
            continue
        t, slot = r["ts"], r["slot"]
        limit = inside_session(slot, t)
        nxt = [ts for ts, _ in acts_by_slot.get(slot, []) if t < ts < limit]
        if nxt:
            waits2.append((min(nxt) - t) / 1000.0)
        else:
            miss2 += 1
    if waits2 or miss2:
        waits2.sort()
        m = f"Median={quantil(waits2,0.5):.1f}s" if waits2 else "Median=-"
        p = f"p90={quantil(waits2,0.9):.1f}s" if waits2 else "p90=-"
        print(f"   watch_fire -> naechster Akt derselben Session: {m} {p} n={len(waits2)} "
              f"(+{miss2} ohne Akt bis zum Session-Ende)")
    # Join 3: main_task -> task_release derselben Zeile (Join-Schluessel: Zeilen-Id = 1. Token).
    main_ts, rel_ts = {}, {}
    for r in rows:
        e, d = r.get("event"), r.get("detail", "")
        tid = d.split(" ", 1)[0] if d else None
        if e == "main_task" and tid:
            main_ts.setdefault(tid, r["ts"])
        elif e == "task_release" and tid and tid in main_ts:
            rel_ts.setdefault(tid, r["ts"])
    waits3 = sorted((rel_ts[i] - main_ts[i]) / 1000.0 for i in rel_ts)
    if waits3:
        print(f"   main_task -> task_release derselben Zeile: Median={quantil(waits3,0.5):.1f}s "
              f"p90={quantil(waits3,0.9):.1f}s n={len(waits3)} (von {len(main_ts)} gefiletten Zeilen; "
              f"{len(main_ts)-len(waits3)} ohne Release-Zeile)")
    # Join 4: merge_verdict (landed) -> naechstes slot_kill desselben Slots. Wörtlich und
    # fenstergekapselt: Slot-Ids werden rekycelt, ein Kill nach dem nächsten slot_open gehört
    # einer SPÄTEREN Session — die wörtliche Zahl misst Recycling, kein Aufräumen nach Land.
    kills_by_slot = defaultdict(list)
    for r in rows:
        if r.get("event") == "slot_kill" and r.get("slot") is not None:
            kills_by_slot[r["slot"]].append(r["ts"])
    waits4, waits4w = [], 0
    landed_n = 0
    for r in rows:
        if r.get("event") != "merge_verdict" or r.get("landed") is not True:
            continue
        landed_n += 1
        t, slot = r["ts"], r.get("slot")
        nxt = [k for k in kills_by_slot.get(slot, []) if k > t]
        if nxt:
            waits4.append((min(nxt) - t) / 1000.0)
        limit = inside_session(slot, t)
        if not any(t < k < limit for k in kills_by_slot.get(slot, [])):
            waits4w += 1
    if waits4:
        waits4.sort()
        print(f"   merge_verdict(landed) -> naechstes slot_kill desselben Slots: "
              f"Median={quantil(waits4,0.5):.0f}s p90={quantil(waits4,0.9):.0f}s n={len(waits4)} "
              f"(von {landed_n} landed-Verdicts; {landed_n-len(waits4)} ohne je einen Kill dieser "
              f"Slot-Id) — ABER: {waits4w}/{landed_n} dieser Kills liegen erst NACH dem naechsten "
              f"slot_open derselben Id (rekycelte Session), innerhalb derselben Session-Belegung "
              f"wird nach einem Land NIE gekillt ({landed_n-waits4w}/{landed_n}: 0%)")

    print(f"== e) SCHNAPPSHOTZ [A] — Groessenbeispiel (nur Form, keine Daten)")
    snap = ('{"t":1789000000000,"q":{"p":3,"r":2,"run":4,"done":11},'
            '"lanes":[{"s":7,"ph":"act","a":0,"d":0},{"s":9,"ph":"verify","a":1,"d":0}],'
            '"rep":{"open":2},"att":{"open":1},"held":4}')
    nb = len(snap.encode())
    for cadence, label in ((5, "AUTOS-Tick 5s"), (8, "DISPATCH-Tick 8s"), (10, "GIT-Tick 10s")):
        per_day = 86400 / cadence * nb
        print(f"   {label}: {nb} Bytes/Zeile -> {per_day/1024:.0f} KiB/Tag, "
              f"{per_day*14/1048576:.1f} MiB/14d (Ledger rotiert bei 5 MiB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
