// Pure queue warning classification for a disabled analyst.
//
// Browser-safe by design: callers supply only the runtime mode and the full-row facts they have
// actually loaded. In particular, a digest is not enough to claim that a brief is absent.

export interface AnalystOffWarningInput {
  analysisOn?: boolean;
  /** The brief compiler's own mode (FLEET_BRIEF_MS), which is NOT implied by the analyst's. */
  briefCompilerOn?: boolean;
  fullDataLoaded: boolean;
  hasStoredAnalysis: boolean;
  hasStoredBrief: boolean;
}

export interface AnalystOffWarning {
  evidence: "loading" | "unread-raw" | "stored";
  delivery: "unknown" | "raw-request" | "stored-brief";
  stored: readonly ("analysis" | "brief")[];
  text: string;
}

/** Return the release-adjacent warning only for an explicitly disabled analyst. */
export function classifyAnalystOffWarning(input: AnalystOffWarningInput): AnalystOffWarning | null {
  if (input.analysisOn !== false) return null;
  // The two switches are separate, so the warning names both modes rather than one. `delivery`
  // stays keyed to what is STORED: a compiler that is running has not written this row's brief yet,
  // and a promise is not a delivery. What the compiler changes is the PREDICTION — "the raw request
  // will be sent" is only true until it compiles — so a pending compile is said out loud instead.
  const head = input.briefCompilerOn === true ? "Analyst off, brief compiler on" : "Analyst off";
  const compilePending = input.briefCompilerOn === true && !input.hasStoredBrief;
  const rawDelivery = compilePending
    ? "the raw request will be sent unless the compiler writes a brief first"
    : "the raw request will be sent";
  if (!input.fullDataLoaded) {
    return {
      evidence: "loading",
      delivery: "unknown",
      stored: [],
      text: `${head} — release may enter the unattended queue. Stored analysis, brief, and delivery details are still loading.`,
    };
  }

  const stored: ("analysis" | "brief")[] = [];
  if (input.hasStoredAnalysis) stored.push("analysis");
  if (input.hasStoredBrief) stored.push("brief");
  if (!stored.length) {
    return {
      evidence: "unread-raw",
      delivery: "raw-request",
      stored,
      text: `${head} — this row has no stored analysis or brief. Release may enter the unattended queue unread; ${rawDelivery}.`,
    };
  }

  const named = stored.length === 2 ? "Stored analysis and brief remain"
    : stored[0] === "analysis" ? "Stored analysis remains" : "A stored brief remains";
  return {
    evidence: "stored",
    delivery: input.hasStoredBrief ? "stored-brief" : "raw-request",
    stored,
    text: `${head} — ${named}, but no analyst refresh or enforcement runs. Release may enter the unattended queue; ${input.hasStoredBrief ? "the stored brief will be sent" : rawDelivery}.`,
  };
}
