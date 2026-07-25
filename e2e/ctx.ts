// The suite is ONE sequential run against one server, so a handful of fixtures genuinely
// outlive the section that creates them (a share checked again after a restart, the lane whose
// selfToken must survive a redeploy, the throwaway repo the deploy-gap facts are measured
// against). This is that carry-over, made explicit: every module states what it needs and what
// it hands on, instead of the implicit top-level scope the single-file suite relied on.
export interface Ctx {
  // --- session sharing (share.ts → review.ts, intake.ts, restart.ts) ---
  shViewId: string;
  shCookie: string;
  shIntId: string;
  shICookie: string;
  // re-created after the revoke in intake.ts, re-authed after the restart
  shPersistId: string;

  // --- scheduled prompts whose survival across the restart is the point (autos.ts → restart.ts) ---
  aPersistId: string;
  aPerpPersistId: string;

  // --- the lane kept alive across the restart to prove its selfToken persists
  // (self-token.ts → tasks.ts, restart.ts) ---
  restartSelfTok: string | null;
  restartSelfSlot: number;

  // --- restart.ts → steward-core.ts ---
  // the env line both srv respawns are built from, and the deploy-gap repo they are pointed at
  cmdEnv: string;
  gapEnv: string;
  gapRepo: string;
  auditPath: string;
  // the uuid planted through the state file + the transcript written for it, read back as the
  // context-size proxy in the steward section
  plantedTranscript: string | null;
  plantedTranscriptBytes: number;
}

export const newCtx = (): Ctx => ({
  shViewId: "", shCookie: "", shIntId: "", shICookie: "", shPersistId: "",
  aPersistId: "", aPerpPersistId: "",
  restartSelfTok: null, restartSelfSlot: 0,
  cmdEnv: "", gapEnv: "", gapRepo: "", auditPath: "",
  plantedTranscript: null, plantedTranscriptBytes: 0,
});

// Fixtures that only cross module boundaries INSIDE the worktree-lane run (lanes/*.ts).
export interface LaneCtx {
  // the one-click lane opened in lanes-basic.ts and driven through the merge paths
  lnSlot: number;
  lnPath: string;
}

// Fixtures that cross the two halves of the steward section.
export interface StewardCtx {
  token: string;
  stewGet: (path: string) => Promise<Response>;
  stewPost: (path: string, body: unknown) => Promise<Response>;
  slot: number;
  cwd: string;
  settleForSteward: (slot: number) => Promise<void>;
}
