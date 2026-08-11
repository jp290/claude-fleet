// Pure queue warning classification for a disabled analyst.
//
// Browser-safe by design: callers supply only the runtime mode and the full-row facts they have
// actually loaded. In particular, a digest is not enough to claim that a brief is absent.

export interface AnalystOffWarningInput {
  analysisOn?: boolean;
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
  if (!input.fullDataLoaded) {
    return {
      evidence: "loading",
      delivery: "unknown",
      stored: [],
      text: "Analyst off — release may enter the unattended queue. Stored analysis, brief, and delivery details are still loading.",
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
      text: "Analyst off — this row has no stored analysis or brief. Release may enter the unattended queue unread; the raw request will be sent.",
    };
  }

  const named = stored.length === 2 ? "Stored analysis and brief remain"
    : stored[0] === "analysis" ? "Stored analysis remains" : "A stored brief remains";
  return {
    evidence: "stored",
    delivery: input.hasStoredBrief ? "stored-brief" : "raw-request",
    stored,
    text: `Analyst off — ${named}, but no analyst refresh or enforcement runs. Release may enter the unattended queue; ${input.hasStoredBrief ? "the stored brief" : "the raw request"} will be sent.`,
  };
}
