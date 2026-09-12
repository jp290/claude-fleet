import { resolve } from "node:path";
import { appendEvent } from "./persist";

// this module sits one level below the repo root, so the ledger path is anchored explicitly
// rather than on import.meta.dir — it is the same absolute string as before, when the constant
// lived in server.ts's anchor nest next to STATE_FILE and the other ledgers.
const PUB = resolve(import.meta.dir, "..");
export const AUDIT_FILE = `${PUB}/audit.jsonl`;

// --- audit log: append-only, own write chain + mode 600 (same discipline as saveHistory/
// saveState in server.ts), deliberately NOT routed through console.log — watchdog.sh redirects
// stdout to server.log at the shell's default umask, so anything security-sensitive needs
// its own explicit chmod. One compact line per event, never free prose: guest passwords
// (including failed attempts), share secrets, the owner token, and prompt text must NEVER
// appear here — only lengths/references, same rule PROMPT_LOG follows for prompt content.
// Fire-and-forget like its neighbors: a wedged disk must never block the request path.
type AuditEvent =
  | "slot_open" | "slot_kill"
  | "share_create" | "share_revoke"
  | "share_auth_ok" | "share_auth_fail" | "share_auth_lock"
  | "guest_ws_connect" | "guest_ws_disconnect"
  | "auto_fire" | "auto_skip"
  | "task_dispatch" // the manual start button — an owner act, distinct from the tick's spawns
  // pending → queued through the Program-MAIN door (releaseTaskForMain). Recorded SEPARATELY from
  // the row's own `releasedBy`, because that field is overwritable: server.ts stamps it to "owner"
  // the moment someone later presses ▸ start, since it answers the LANE question ("was the run
  // attended") and not the RELEASE question ("who released it"). This row is the only carrier of
  // the second answer that a later attended click cannot erase.
  | "task_release"
  | "task_kind" // owner changed a task's category; detail records id and both values
  // the owner released a task the queue analyst had flagged. Recorded because the analyst is
  // advisory: without a trace, an override is indistinguishable from an ordinary promote, and
  // nothing could ever be calibrated against how often its objections were right
  | "task_override"
  // the clarify lane's propose/promote pair, both sides recorded: who drafted the anchor and
  // when the owner made it theirs (the boundary this whole path is built around)
  | "criterion_proposed" | "criterion_confirmed"
  // ↻ refine, the same propose/promote pair one level up: the compiler was asked (task_refine),
  // and the owner either promoted the proposal into new rows or discarded it. The confirm's detail
  // carries the children's ids — the archived original is otherwise the only place they are named
  | "task_refine" | "task_refine_confirm" | "task_refine_dismiss"
  // W2 · the FILE SURFACE of an existing row, the same propose/promote pair once more: a lane or
  // MAIN parks a proposal (task_files_propose, with the proposing slot), and the owner either
  // confirms a surface onto the row (task_files_confirm) or drops the proposal
  // (task_files_dismiss). The confirm's detail names how many paths, whether they came from the
  // owner's own body or from a named proposal, and — decisively — which of them the target repo
  // does not track: that finding never gates, so the ledger is where "he could see it" is recorded.
  | "task_files_propose" | "task_files_confirm" | "task_files_dismiss"
  // THE NOTE LIFECYCLE (N2). A lane reports a verdict on a note its own founding brief delivered
  // (note_verdict, detail: note id, verdict, branch) and a land makes an `erledigt` one wirksam by
  // closing the row (note_closed_by_land, detail: note id and the branch that claimed it). Booked
  // separately on purpose: the claim and the act that makes it true are days apart, and a lane that
  // died between them leaves only the first line — which is exactly the state to be able to read.
  | "note_verdict" | "note_closed_by_land"
  // …and N3's ASSIGNMENT, which is the act that decides what a lane is even shown as a source:
  // task_note_attach / task_note_detach, detail `<taskId> ← <noteId> (owner|main)`. Two events, not
  // one with a flag, because a detach is the act that can silently un-assign work and it must be
  // greppable on its own. A DETACH IS NOT A DELETE: the note row survives it untouched, and the
  // ledger line is the only record that the assignment ever existed.
  | "task_note_attach" | "task_note_detach"
  // …and what a land does to an ASSIGNED source: it settles the USAGE, never the source row.
  // note_usage_settled, detail `<noteId> <branch> task=<taskId>`. Its own event and deliberately
  // NOT note_closed_by_land, because it is not a close: the note keeps its row and every other
  // assignment of it. A reader who conflated the two would read "A is finished with this source"
  // as "this source is finished", which is the global closure N3 exists to end.
  | "note_usage_settled"
  // W3 · ▸ start wave — n queue rows founded into ONE lane that will land ONCE. Its own event and
  // not a task_dispatch per row, because the fact being recorded is the BUNDLE: the detail names
  // every id in the sensor's fixed order, the class the gate will run, and the seconds the avoided
  // lands were priced at, so a later reader of a red post-land audit can see which rows shared it.
  | "task_wave_dispatch"
  // ...and the lane's own answer to it: k of n kept, n-k handed back to `queued` with the lane's
  // reason. Recorded separately from every abort, because a split is a JUDGEMENT about the surface
  // the wave was bundled on — the one piece of evidence that says the bundling criterion did not
  // reach, and the only place the returned rows' reason survives the note being overwritten.
  | "task_wave_split"
  | "owner_auth_fail"
  | "intake_auth_fail" | "intake_auth_lock"
  | "self_heal_recreate"
  | "codex_bind" | "codex_bind_ambiguous" | "codex_owner_bind" | "codex_resume_lost"
  // ② the conflict went to the lane's OWN session instead of the throwaway resolver — the durable
  // half of `resolvedBy`, recorded at the moment of the decision rather than reconstructed at land
  | "merge_wake_author"
  // the terminal verdict of a merge run going back to whoever asked for it — the lane on an owner
  // ⏫, the Program-MAIN that drove a self-land — and the refusal when the delivery gate was closed.
  // Both on the trail because this is the server typing prose into a session's pane: what it sent,
  // and what it decided not to send, are the same class of fact as merge_wake_author one line up.
  // The THIRD is its own word on purpose: a gate refusal is temporary and capped, while an
  // undeliverable verdict says the occupant that asked is GONE — and that one is never re-aimed at
  // the lane, so the trail is the only place the disappearance is written down.
  | "merge_verdict_sent" | "merge_verdict_skip" | "merge_verdict_undeliverable"
  | "steward_send" | "steward_send_capped"
  | "steward_journal" | "steward_journal_capped" | "steward_task" | "steward_propose_outcome"
  // ACP-23 · a bound Program-MAIN filed a row of its own Program through POST /api/self/tasks.
  // Named after its PRODUCER like steward_task, and separate from task_release for the same reason
  // that pair is separate: filing and releasing are two acts, and a trail that could not tell them
  // apart would make "the machine wrote itself work" and "the machine started work" one line.
  | "main_task"
  // …and the same MAIN sharpening the brief of a row of its own Program (POST
  // /api/self/tasks/:id/brief). Its own event beside main_task for that pair's reason: filing a row
  // and rewriting the bytes a lane will be founded on are two acts, and the one thing a reader
  // needs from this trail is WHICH of them moved. It is also the only trail record of an authorship
  // that used to be unrecordable — before 2026-09-11 this act went through the owner door and left
  // a row that said the owner wrote it.
  | "main_brief"
  // the owner granted or revoked a Program's self-land permission (POST /api/programs/:id/promotion).
  // On the trail because it is the one act that widens WHO may move an integration branch, and the
  // record it writes is otherwise only visible by reading the Program row.
  | "program_promotion"
  // the owner granted or cleared a Program's execution profile (POST /api/programs/:id/profile).
  // Beside program_promotion for the same reason: it is an owner act that changes what a future
  // MAIN is founded into, and the record it writes is otherwise only visible by reading the row.
  | "program_profile"
  // the owner bound or released a Program's STUDIO (POST /api/programs/:id/studio) — the workflow
  // it runs, as opposed to the machine it is founded into. Its own event beside program_profile
  // because the two answer different questions and a ledger that merged them could not say which
  // of the owner's two decisions moved.
  | "program_studio"
  // the owner granted or revoked a Program's PROGRAM-SCOPED DISPATCH permission
  // (POST /api/programs/:id/dispatch) — whether the tick may start THIS program's released rows
  // while the global dispatcher is stopped, and how many at once. Its own event beside the three
  // above because it is the only one of the four that widens what the machine may start
  // UNATTENDED; a ledger that merged it into program_promotion could not say whether the owner
  // opened landing or opened starting.
  | "program_dispatch"
  // the studio inventory itself: created, or changed with a rev bump. A studio is a SHARED source
  // several Programs may bind, so a change is dateable in its own right — the binding keeps the rev
  // it was made against, and this row is where the other side of that comparison comes from.
  | "studio_create"
  | "studio_change"
  // one or more persisted studio rows could not be parsed at boot and were skipped whole. Reported
  // like an unreadable lineage and for the same reason: silently losing an owner record is exactly
  // the failure the explicit loader exists to prevent.
  | "studio_unreadable"
  | "program_founding_recover"
  // a bound Program-MAIN started a land through POST /api/self/tasks/:id/land. Recorded at the
  // START rather than only at the outcome: the outcome has its own rails (merge verdict, land note,
  // outcome row), and what none of them can state is that a MAIN ASKED — including the attempts
  // that ended in a red gate and landed nothing.
  | "self_land_start"
  // WHO landed. Written at recordLand — the one choke point every main-MOVING land funnels through
  // — beside the provenance note that carries the same fact. Two carriers on purpose: the note
  // lives in the repo and travels with the commit, this row lives in the fleet's own trail and
  // survives a repo that was never cloned anywhere.
  | "land_actor"
  // an owner-token merge arriving over bearer/query on a lane whose task belongs to a Program with
  // a LIVE bound MAIN — i.e. the shape a session reaching for fleet.json's token produces. The land
  // PROCEEDS (the owner's own scripts use Bearer); this row is what makes the actor class countable
  // at all. Prevention is UNSUPPORTED and documented as such — see docs/self-api.md.
  | "owner_token_ambient_use"
  // the owner landed a lane whose work a receiving MAIN had REJECTED, by passing the explicit
  // `overrideRejectedReport` flag (server.ts#rejectedReportForLand). The land PROCEEDS — a rejection
  // can never be re-decided, so without an override a wrongly-refused branch would be unlandable by
  // anyone — and this row is the only place that says the refusal was seen and overruled rather than
  // never asked about. The ordinary land carries no flag and is refused, so an absent row here means
  // no override happened, not that one was unrecorded.
  | "land_rejected_report_override"
  // a steward filing whose `ref` matched a live proposal — answered with the existing row, so the
  // trail shows the pulse KEPT seeing the condition without the queue growing a duplicate
  | "steward_task_dedup"
  | "slot_shelve"
  // the board editor wrote a file into a session's working directory. This server's only
  // owner-driven write to a path outside its own state files, so it is on the trail by the same
  // rule as slot_open: what changed the machine is recorded, and the detail names the FILE, never
  // its contents (the trail is read by people who are not entitled to the file's text).
  | "file_write"
  // the owner dropped/pasted a file INTO a session's working directory. Same rule as file_write:
  // the detail names the file and its size, never a byte of its contents.
  | "file_drop"
  // the owner restarted a pane on purpose (↻ bring session back). Deliberately NOT
  // self_heal_recreate: slotstats reads that event as "the pane died and the loop rebuilt it"
  // and divides resumed/heals to measure the durability promise. An owner-triggered rebuild
  // resumes by construction whenever a transcript exists, so booking it as a heal would inflate
  // exactly the rate it is not evidence for. Same detail vocabulary, different question.
  | "slot_restart"
  // the owner rewrote a LIVE slot's model/effort in the record (POST /api/slots/:id/model). No
  // pane is touched; the row is what the next heal, ↻ restart or succession spawns from. Detail
  // carries the resulting pair so the trail says what the next spawn line will say.
  | "slot_model"
  // the owner chose which executable a repo's throwaway worker runs as. On the trail because the
  // value decides where that repo's DIFF is sent — the one setting here whose blast radius is
  // another party's servers rather than this machine. Detail names the repo, worker and path.
  | "repo_worker"
  // the owner raised or lowered how many lanes the DISPATCHER may hold open in one repo
  // (POST /api/repo-lane-cap). On the trail because it is the only owner setting that widens
  // unattended EXECUTION — every other per-repo entry changes what a lane does, this one changes
  // how many claude sessions the machine starts by itself. Detail names the repo and the number.
  | "repo_lane_cap"
  | "repo_undo_land"
  | "land_note_fail"
  // a land that was interrupted between "main moved" and "the land is recorded", settled at boot:
  // recovered (note + undo record + tier-2 audit written late) or unaccountable (audited, dropped)
  | "land_recovered" | "land_recover_fail"
  | "postland_audit"
  // THE REMOTE HELPER PORTAL (stage 1). Three events, and each names a boundary the local machine
  // cannot otherwise account for: a job LEFT this machine, a job CAME BACK with a verdict, and a
  // claim DIED without one. The third is the load-bearing one — a helper that vanishes must be a
  // recorded lapse and a job that falls back to the local drain, never a silent green and never a
  // job nobody ever runs again.
  | "helper_claim" | "helper_result" | "helper_claim_expired"
  | "helper_auth_fail"
  // stage A of the device register: the owner set a device's WISH-mode. It is a config write with
  // no dispatch behind it, so this row is the only place the change is ever visible from outside.
  | "helper_device_mode"
  | "helper_update_queued" | "helper_update"
  // …and the ONE row in this ledger for something this box SENT towards a helper rather than
  // answered: a Wake-on-LAN frame (helper-daemon/README.md §The rules, the single named exception
  // to "no push"). The detail says whether the frame left the box — never that the machine woke —
  // and carries neither the MAC nor the broadcast address.
  | "helper_wake"
  // the deploy verb (Verb 2): one row when a build fails, one when a restart is launched, one when
  // the NEXT BOOT judges it. The trio is what makes "was the deploy verified?" answerable at all —
  // the verb kills the process that would otherwise report its own result.
  | "deploy"
  | "autos_switch"
  // the doneLooking outbound channel (Watch): Watch rows record signal capture/skip; the typed
  // FleetEvent rows below record transport, acknowledgement and terminal receiver loss separately.
  | "watch_fire" | "watch_skip" | "watch_superseded"
  | "fleet_event_delivered" | "fleet_event_send_uncertain" | "fleet_event_held" | "fleet_event_ack" | "fleet_event_owner_ack"
  | "fleet_event_receiver_gone" | "fleet_event_subject_gone" | "fleet_event_prune"
  | "clarification_open" | "clarification_answered" | "clarification_refused" | "clarification_prune"
  | "clarification_reply_send_uncertain"
  | "fleet_report_open" | "fleet_report_prune"
  // the OWNER half of the report rail. Its self twin writes no trail line on purpose (the row it
  // wrote is the record, readable back by the deciding MAIN); an owner verdict has no session to
  // read it from, so this line and the row are the only places it surfaces.
  | "fleet_report_owner_decision"
  // the owner-facing twin: a bound Program-MAIN raised something, and what the owner did about it.
  // `attention_refused` is a RECEIPT that the owner saw it and declined — the silent closure this
  // channel exists to make impossible.
  | "attention_open" | "attention_answered" | "attention_refused" | "attention_prune"
  | "attention_answer_send_uncertain"
  // a full-window main session spent its bounded three-attempt handoff budget. The detail says
  // "gave up" so exhaustion is visible rather than indistinguishable from a disabled tick.
  | "migrate_gave_up"
  | "dispatch_switch"
  | "guest_action"
  // a lane's own account of a verify-suite run: one line per phase change, so a run that dies
  // without a verdict leaves a timeline behind instead of nothing (see the verify GATE region)
  | "verify_intent"
  // a lane asked GET /api/self/drift and got a FRESH answer (cache miss). The one record that
  // makes "do lanes check how far main moved past them, and how early?" answerable at all —
  // detail carries the branch, because slot ids are recycled and the join is to lane-outcomes
  | "self_drift"
  | "autos_quiet"
  // an owner-capable send exhausted the bounded fresh-pane readiness wait and was delivered
  // anyway. The row makes the possible loss visible without turning it into a refusal.
  | "send_boot_timeout"
  // the cross-program Supervisor spoke to one Program-MAIN. Detail carries the nudge id and the
  // program, never the text — the same hygiene rule slot_shelve's note follows.
  | "supervisor_nudge"
  // STN-1: the Supervisor completed a Controller's transition watch and one FleetEvent was
  // minted. Detail carries watch id, event id and the Supervisor's slot — never the text.
  | "supervisor_transition"
  // STN-1: a transition watch passed its deadline unanswered and was disarmed by the tick (or at
  // a late completion attempt). No pane text accompanies this row by design.
  | "watch_expire"
  // a bootstrap call overwrote a STALE Program-MAIN binding. The one row that separates "this
  // Program was rebound" from "it was bootstrapped for the first time" after the fact — the
  // response says it once, to one caller. Detail names the program and the REPLACED occupation
  // (slot + openedAt), never a line of the Program's content or of the founding brief.
  | "program_main_rebound"
  // the same act on the Supervisor rail: a bootstrap overwrote a STALE Supervisor binding whose
  // slot no longer carries the (id, openedAt) it was bound to. Before this row the route REFUSED
  // such a binding, which left the fleet unable to appoint a Supervisor at all. Detail names the
  // REPLACED occupation (slot + openedAt) and nothing else — never a line of the founding brief.
  | "supervisor_rebound"
  // the owner bound an ALREADY LIVING session as Supervisor (POST /api/supervisor/bind). Its own
  // word beside the two rebind rows because it is a different act: a bootstrap OPENS the session it
  // appoints, this one appoints a session that was already working and keeps its context. Detail
  // names the bound occupation (slot + openedAt) and nothing else — never a line of the brief.
  | "supervisor_bound"
  // BOOT read a persisted Supervisor binding whose slot no longer carries the (id, openedAt) it was
  // bound to. The record is kept, never repaired here: "no Supervisor was ever appointed" and "the
  // one appointed is gone" are two different facts, and deleting the record would erase the second.
  // Until this row existed a dead binding was rehydrated SILENTLY and stayed authoritative — every
  // route it gates answered the same 409 a non-Supervisor gets, so the role was unfilled and
  // nothing anywhere said so (measured 2026-09-07: slot 5 openedAt 1787497726285, bound 21.08.,
  // against a slot recycled into a lane). Detail names the dead occupation only.
  | "supervisor_binding_stale"
  // the recorded MAIN binding learned the session id its pane discovered AFTER the bind
  // (backfillProgramMainSessionId). Detail names the program and the id that filled the `null`;
  // there is no row for the no-op case, because "nothing to fill" is not an event.
  | "program_main_session_backfill"
  // a persisted Program-MAIN lineage record could not be read and was loaded as ABSENT — the
  // default-deny reading of a history, reported rather than repaired. Detail names the program
  // and the parse error, never an entry.
  | "program_lineage_unreadable"
  // a persisted Program INBOX could not be read and was loaded as ABSENT — the same default-deny
  // reading of a record the lineage row above states, and reported for the same reason: silently
  // losing pointers to rows a MAIN still owes an answer to is the failure the inbox exists to end.
  // Detail names the program and the parse error, never an entry.
  | "program_inbox_unreadable"
  | "program_inbox_loss_unreadable"
  | "program_handover_unreadable"
  | "program_handover_loss_unreadable"
  // one pointer was appended to a Program's inbox (appendProgramInbox, the one writer). Detail
  // names the program, the kind and the `ref` it points at — never a line of the referenced row's
  // text, because the entry itself copies none.
  | "program_inbox_append"
  // ACP-17 · an `ambient-land` pointer was OWED and not written: the Program the land-door named as
  // bypassed was gone or no longer active by the time recordLand ran. Detail names the landed sha
  // and the program's state, because the alternative to this row is a MAIN that is never told and
  // a trail on which nothing says it should have been.
  | "program_inbox_skip"
  // the bound MAIN stamped its receipt on one inbox entry. Detail names the program and the entry
  // id; there is no row for a REPEATED read, because a receipt that already exists is not an event.
  | "program_inbox_read"
  // ACP-18 · the addressed message rail. `message_append` is the ONE writer's row and names the two
  // ADDRESSES plus the message id — never the body, which is the caller's text and not the trail's.
  // `message_read` is the receipt, and like the inbox there is no row for a repeated read.
  // `messages_unreadable` is the record-level degradation: the rail loaded EMPTY, which reads
  // exactly like "nobody ever sent anything", so the trail is one of the two places that can still
  // say otherwise (the other is the persisted scar on the rail's own reader).
  | "message_append"
  | "message_read"
  | "messages_unreadable"
  // a terminal land armed the merge subscription its bound Program-MAIN never made
  // (armProgramMainLandWatch), or declined to because that MAIN's return path is full. The second
  // row is the one that matters: a MAIN told nothing must not be told nothing SILENTLY.
  | "program_main_land_watch" | "program_main_land_event_skipped"
  // M1 · ONE row per terminal merge verdict, written where mergeJob records it (its `record`).
  // Not prose and not a delivery record: `merge_verdict_sent` above says a verdict REACHED a pane,
  // and said nothing about what the verdict was. The measured hole this fills: `MergeLast` lives
  // only as the LAST verdict per slot in fleet.json, `lane-outcomes.jsonl` carries no merge field,
  // and a land note exists only for a land — so the 14 `error` and 6 `waited` deaths of 2026-09-02
  // …-06 could be counted but never explained (docs/messungen/2026-09-06-merge-prozess-robust.md
  // §1.3). Machine-readable fields, no free prose, nothing about the tree's content.
  | "merge_verdict";
// `fields` — machine-readable columns for the rows that need them, beside (not instead of) the
// prose `detail` every other event uses. The four identity keys are RESERVED: a caller cannot
// overwrite what row this is, which is why they are filtered rather than merely documented.
const AUDIT_RESERVED = new Set(["ts", "event", "slot", "detail"]);
export function audit(event: AuditEvent, slot?: number, detail?: string,
  fields?: Record<string, string | number | boolean>): void {
  appendEvent(AUDIT_FILE, {
    ts: Date.now(), event,
    ...(slot !== undefined ? { slot } : {}),
    ...(detail !== undefined ? { detail } : {}),
    ...(fields ? Object.fromEntries(Object.entries(fields).filter(([k]) => !AUDIT_RESERVED.has(k))) : {}),
  });
}
