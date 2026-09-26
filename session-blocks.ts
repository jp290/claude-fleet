// Declarative inventory of Fleet-added session material; spawn paths do not consume this list.
export type SessionRole = "main" | "lane" | "orchestrator";

export interface SessionBlock {
  readonly id: string;
  readonly source: `${string}.ts#${string}`;
  readonly roles: readonly SessionRole[];
  readonly defaultOn: boolean;
}

export const SESSION_BLOCKS: readonly SessionBlock[] = [
  { id: "portable-contract", source: "server.ts#openSlot", roles: ["main", "lane", "orchestrator"], defaultOn: true },
  { id: "private-rulebook", source: "rulebook.ts#FRAGMENTS_FOR", roles: ["main", "lane", "orchestrator"], defaultOn: true },
  { id: "spawn-profile", source: "server.ts#ensureSlot", roles: ["main", "lane", "orchestrator"], defaultOn: true },
  { id: "self-credential", source: "server.ts#ensureSlot", roles: ["main", "lane", "orchestrator"], defaultOn: true },
  { id: "task-brief", source: "server.ts#briefAndSend", roles: ["lane"], defaultOn: true },
  { id: "lane-notes", source: "task-notes.ts#renderNotesBlock", roles: ["lane"], defaultOn: false },
  { id: "source-excerpts", source: "context-snippets.ts#renderSnippetBlock", roles: ["lane"], defaultOn: false },
  { id: "context-anchors", source: "server.ts#renderContextAnchorBlock", roles: ["main", "lane", "orchestrator"], defaultOn: true },
  { id: "founding-packs", source: "server.ts#deliverFoundingPacks", roles: ["main", "lane", "orchestrator"], defaultOn: false },
  { id: "lane-footer", source: "server.ts#laneExitFooter", roles: ["lane"], defaultOn: true },
  { id: "commit-expectation", source: "server.ts#laneExitFooter", roles: ["lane"], defaultOn: true },
  { id: "memory-pointer", source: "server.ts#memoryPointer", roles: ["main", "lane"], defaultOn: true },
  { id: "portfolio-memory-pointer", source: "server.ts#memoryPortfolioPointer", roles: ["orchestrator"], defaultOn: true },
  { id: "main-rail", source: "server.ts#railBlockFor", roles: ["main"], defaultOn: true },
  { id: "studio-block", source: "server.ts#studioBlockFor", roles: ["main", "lane"], defaultOn: false },
  { id: "orchestrator-card", source: "server.ts#ORCHESTRATOR_ROLE_CARD", roles: ["orchestrator"], defaultOn: true },
  { id: "delivery-header", source: "server.ts#deliveryHeader", roles: ["main", "lane", "orchestrator"], defaultOn: false },
];
