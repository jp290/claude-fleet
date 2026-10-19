// THE RIGHT TAB'S WORDS (rechts-7 F01, owner 18.10. 23:4x): the column speaks English and keeps Fleet's
// own terms (Land, Lane, Succession …). A word it says in more than one place stands here once, so the
// same thing never carries two names, and a later language setting (English / Denglisch) has this one
// place to switch. A sentence said at one place only stays at that place. No DOM: src/suitemeter.ts
// reads it, and e2e runs that module bare.

// the kinds of run, in the order a lane meets them (src/board.ts#WAY, src/suitemeter.ts#meterKind)
export const CHECK_KIND = {
  proof: "Proof", preview: "Preview", landCheck: "Land check", afterLand: "Check after land",
  gateScript: "Gate script", run: "Check run", queued: "Queued check run",
} as const;

// how a run stands
export const RUN_STATE = {
  waiting: "waiting", running: "running", passed: "passed", failed: "failed", noResult: "no result",
} as const;

// the column's section heads and the tabs of "More about this session"
export const SECTION = {
  checks: "Checks", devices: "Devices", changes: "Changes", history: "History", notepad: "Notepad",
  more: "More about this session", setup: "Setup", rights: "Rights", messages: "Messages", files: "Files",
  prompts: "Your prompts",
} as const;
