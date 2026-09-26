// Declarative inventory of Fleet-added session material; spawn paths do not consume this list.
export type SessionRole = "main" | "lane" | "orchestrator";
export type SessionVisibility = "ja" | "nein" | "teilweise";

export interface SessionBlock {
  readonly id: string;
  readonly source: `${string}.ts#${string}`;
  readonly roles: readonly SessionRole[];
  readonly defaultOn: boolean;
  readonly breaksWithout: string;
  readonly visibility: { readonly setup: SessionVisibility; readonly running: SessionVisibility; readonly after: SessionVisibility };
}

export const SESSION_BLOCKS: readonly SessionBlock[] = [
  { id: "portable-contract", source: "server.ts#openSlot", roles: ["main", "lane", "orchestrator"], defaultOn: true,
    breaksWithout: "Rollen, Grenzen und Verify-Vertrag fehlen dem Agenten; die Serverrechte bestehen weiter.",
    visibility: { setup: "ja", running: "teilweise", after: "teilweise" } },
  { id: "private-rulebook", source: "rulebook.ts#FRAGMENTS_FOR", roles: ["main", "lane", "orchestrator"], defaultOn: true,
    breaksWithout: "Claude verliert private rollenbezogene Regeln; Codex laedt diesen Render laut `AGENTS.md#Loader boundary` nicht als Vertrag.",
    visibility: { setup: "teilweise", running: "teilweise", after: "teilweise" } },
  { id: "spawn-profile", source: "server.ts#ensureSlot", roles: ["main", "lane", "orchestrator"], defaultOn: true,
    breaksWithout: "Der gewaehlte Executor oder Arbeitsbaum fehlt; die Session startet nicht wie beauftragt.",
    visibility: { setup: "teilweise", running: "teilweise", after: "teilweise" } },
  { id: "self-credential", source: "server.ts#ensureSlot", roles: ["main", "lane", "orchestrator"], defaultOn: true,
    breaksWithout: "`/api/self/*` kann den Occupant nicht autorisieren.",
    visibility: { setup: "nein", running: "teilweise", after: "nein" } },
  { id: "task-brief", source: "server.ts#briefAndSend", roles: ["lane"], defaultOn: true,
    breaksWithout: "Die Lane kennt Aufgabe, Scope und Done nicht.",
    visibility: { setup: "ja", running: "teilweise", after: "teilweise" } },
  { id: "lane-notes", source: "task-notes.ts#renderNotesBlock", roles: ["lane"], defaultOn: false,
    breaksWithout: "Bei Treffer fehlen Notizvorschau und Pin-Hinweis; ohne Treffer bricht nichts.",
    visibility: { setup: "teilweise", running: "teilweise", after: "teilweise" } },
  { id: "source-excerpts", source: "context-snippets.ts#renderSnippetBlock", roles: ["lane"], defaultOn: false,
    breaksWithout: "Die deterministisch gewaehlten Quellbytes fehlen; eigenes Nachlesen bleibt moeglich.",
    visibility: { setup: "teilweise", running: "teilweise", after: "teilweise" } },
  { id: "context-anchors", source: "server.ts#renderContextAnchorBlock", roles: ["main", "lane", "orchestrator"], defaultOn: true,
    breaksWithout: "Beratende Lesezeiger und Auslassungsgruende fehlen; Quellinhalt war nie enthalten.",
    visibility: { setup: "teilweise", running: "teilweise", after: "teilweise" } },
  { id: "founding-packs", source: "server.ts#deliverFoundingPacks", roles: ["main", "lane", "orchestrator"], defaultOn: false,
    breaksWithout: "Nur die explizit gewaehlten Gruendungsanker fehlen.",
    visibility: { setup: "ja", running: "teilweise", after: "teilweise" } },
  { id: "lane-footer", source: "server.ts#laneExitFooter", roles: ["lane"], defaultOn: true,
    breaksWithout: "Der Rueckweg und die Endreihenfolge fehlen dem Agenten.",
    visibility: { setup: "nein", running: "teilweise", after: "teilweise" } },
  { id: "commit-expectation", source: "server.ts#laneExitFooter", roles: ["lane"], defaultOn: true,
    breaksWithout: "Ohne Commit ist Arbeit fuer den Land-Pfad unsichtbar; es existiert keine Auto-Commit-Funktion.",
    visibility: { setup: "nein", running: "teilweise", after: "teilweise" } },
  { id: "memory-pointer", source: "server.ts#memoryPointer", roles: ["main", "lane"], defaultOn: true,
    breaksWithout: "Agent sieht Memory-Tuer und Coverage-Grenzen nicht; Zustand selbst bleibt.",
    visibility: { setup: "nein", running: "teilweise", after: "teilweise" } },
  { id: "portfolio-memory-pointer", source: "server.ts#memoryPortfolioPointer", roles: ["orchestrator"], defaultOn: true,
    breaksWithout: "Orchestratorin sieht die Portfolio-Tuer und ihre Grant-Grenze nicht; die Grant-Regel bleibt.",
    visibility: { setup: "nein", running: "teilweise", after: "teilweise" } },
  { id: "main-rail", source: "server.ts#railBlockFor", roles: ["main"], defaultOn: true,
    breaksWithout: "MAIN verliert Position, Self-Tueren und Arbeitsreihenfolge.",
    visibility: { setup: "teilweise", running: "teilweise", after: "teilweise" } },
  { id: "studio-block", source: "server.ts#studioBlockFor", roles: ["main", "lane"], defaultOn: false,
    breaksWithout: "Ohne Bindung bricht nichts; mit Bindung fehlt adressierter Zusatz.",
    visibility: { setup: "nein", running: "teilweise", after: "nein" } },
  { id: "orchestrator-card", source: "server.ts#ORCHESTRATOR_ROLE_CARD", roles: ["orchestrator"], defaultOn: true,
    breaksWithout: "Orchestratorin verliert die Startposition und benannte Tueren; das Label allein gibt keine Rechte.",
    visibility: { setup: "teilweise", running: "teilweise", after: "teilweise" } },
  { id: "delivery-header", source: "server.ts#deliveryHeader", roles: ["main", "lane", "orchestrator"], defaultOn: false,
    breaksWithout: "Claude verliert die sichtbare Herkunft einer Zustellung; die Sendung selbst bleibt.",
    visibility: { setup: "nein", running: "teilweise", after: "teilweise" } },
];
