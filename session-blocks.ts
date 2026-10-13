// The one register of Fleet-added session material; GET /api/founding-plan resolves it, no spawn path reads it yet.
import { createHash } from "node:crypto";

export type SessionRole = "lane" | "main" | "orchestratorin" | "nur-ordner";
export type SessionFunction = "vertrag" | "auftrag" | "rueckweg" | "beweis" | "orientierung" | "gedaechtnis-zeiger";
export type SessionSource = `${string}.ts#${string}` | `${string}.md#${string}`;
export type SessionDefault = "an" | "aus" | { readonly zustand: "bedingt"; readonly grund: string };

export interface SessionBlock {
  readonly id: string;
  readonly wort: string;
  readonly satz: string;
  readonly funktion: readonly SessionFunction[];
  // `gesperrt`: owner decision — required AND not replaceable, not even by an equal function
  readonly grenze: { readonly art: "noetig"; readonly grund: string; readonly gesperrt?: true } | { readonly art: "frei" };
  readonly schicht: string;
  readonly autor: readonly ("Owner-Promotion" | "MAIN" | "Repo-Autor" | "Fleet" | "Session selbst")[];
  readonly harness: { readonly art: "alle" }
    | { readonly art: "eingeschraenkt"; readonly werte: readonly ("claude" | "codex" | "pi")[]; readonly grund: string };
  readonly lieferart: readonly ("plan" | "native Datei" | "Session-Datei" | "Prompt" | "Abruf" | "Zustellung")[];
  readonly rollenDefault: Readonly<Record<SessionRole, SessionDefault>>;
  readonly source: SessionSource | "nicht zugestellt";
  readonly belege: readonly SessionSource[];
  readonly breaksWithout: string;
  // The harness loads it itself; Fleet has no switch, a plan only shows it (with its reason).
  readonly nichtSchaltbar?: string;
  // These describe no concrete delivery; hashes and UTF-8 bytes need a measured plan/receipt.
  readonly fassung: "unknown";
  readonly bytes: "unknown";
}

// Defaults describe the agreed target, not today's switches. Conditional defaults name their
// prerequisite; "nur-ordner" receives only native loader material. Required functions can be
// replaced equivalently; the owner-heft and portable-contract remain locked by owner decision.
export const SESSION_BLOCKS: readonly SessionBlock[] = [
  {
    id: "spawn-profile",
    wort: "Agent · Modell · Effort",
    satz: "Die Laufzeit bestimmt, wie und wo die Session arbeitet.",
    funktion: ["orientierung"],
    grenze: {"art": "noetig", "grund": "Ohne ausfuehrbaren Harness und Arbeitsort startet keine Session."},
    schicht: "model-register.ts + Slot",
    autor: ["Fleet", "MAIN"],
    harness: {"art": "alle"},
    lieferart: ["plan"],
    rollenDefault: {"lane": "an", "main": "an", "orchestratorin": "an", "nur-ordner": "aus"},
    source: "server.ts#ensureSlot",
    belege: ["server.ts#ensureSlot"],
    breaksWithout: "Der gewaehlte Executor oder Arbeitsbaum fehlt; die Session startet nicht wie beauftragt.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "portable-contract",
    wort: "Vertrag",
    satz: "Der Vertrag legt Rolle, Grenzen und Beweise fest.",
    funktion: ["vertrag"],
    grenze: {"art": "noetig", "grund": "Owner-Entscheid: noetig und gesperrt; ohne Vertrag fehlen die eingebundenen Grenzen.", "gesperrt": true},
    schicht: "AGENTS.md §Portable operating contract",
    autor: ["Owner-Promotion"],
    harness: {"art": "alle"},
    lieferart: ["native Datei", "Session-Datei", "Prompt"],
    rollenDefault: {"lane": "an", "main": "an", "orchestratorin": "an", "nur-ordner": "aus"},
    source: "server.ts#openSlot",
    belege: ["server.ts#openSlot", "session-agents.ts#renderSessionAgents", "AGENTS.md#Portable operating contract"],
    breaksWithout: "Rollen, Grenzen und Verify-Vertrag fehlen dem Agenten; die Serverrechte bestehen weiter.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "owner-heft",
    wort: "Owner-Korrekturen",
    satz: "Das Owner-Heft haelt die geltenden Korrekturen fest.",
    funktion: ["vertrag"],
    grenze: {"art": "noetig", "grund": "Owner-Entscheid: noetig und gesperrt wie der Vertrag; ohne Heft fehlen geltende Korrekturen.", "gesperrt": true},
    schicht: "Konzept k-owner-korrekturen",
    autor: ["Owner-Promotion"],
    harness: {"art": "alle"},
    lieferart: ["native Datei", "Prompt", "Abruf"],
    rollenDefault: {"lane": "an", "main": "an", "orchestratorin": "an", "nur-ordner": "aus"},
    source: "server.ts#ownerKorrekturenPointer",
    belege: ["server.ts#ownerKorrekturenPointer", "server.ts#ownerKorrekturenText", "server.ts#laneContextDelivery", "server.ts#briefAndSend", "server.ts#buildLaneSuccessionBrief", "server.ts#railBlockFor", "server.ts#buildOrchestratorSpawnBrief", "server.ts#buildOrchestratorSuccessionBrief", "konzept-ledger.ts#konzeptLeseansicht", "konzept-ledger.ts#OWNER_KORREKTUREN"],
    breaksWithout: "Ohne den Reader-Zeiger in der nativen Startdatei oder im Start- und Nachfolgebrief fehlen der Session die fuer ihre Position geltenden Owner-Korrekturen.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "private-rulebook",
    wort: "Regelbuch (privat)",
    satz: "Claude laedt den privaten Rollenschnitt.",
    funktion: ["vertrag"],
    grenze: {"art": "frei"},
    schicht: "rulebook/ → Rollen-Render CLAUDE.md",
    autor: ["Owner-Promotion", "MAIN"],
    harness: {"art": "eingeschraenkt", "werte": ["claude"], "grund": "Nur Claude laedt CLAUDE.md und sein Auto-Memory; Codex und Pi haben diesen Loader nicht."},
    lieferart: ["native Datei"],
    rollenDefault: {"lane": {"zustand": "bedingt", "grund": "Claude mit privatem Rollen-Render"}, "main": {"zustand": "bedingt", "grund": "Claude mit privatem Rollen-Render"}, "orchestratorin": {"zustand": "bedingt", "grund": "Claude mit privatem Rollen-Render"}, "nur-ordner": "aus"},
    source: "rulebook.ts#FRAGMENTS_FOR",
    belege: ["rulebook.ts#FRAGMENTS_FOR"],
    breaksWithout: "Claude verliert private rollenbezogene Regeln; Codex laedt diesen Render laut `AGENTS.md#Loader boundary` nicht als Vertrag.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "role-card",
    wort: "Rolle",
    satz: "Die Rollenkarte nennt Position, Empfaenger und Tueren.",
    funktion: ["vertrag"],
    grenze: {"art": "noetig", "grund": "Ohne Rollenkarte fehlen der Session Empfaenger, Grenzen und Tueren ihrer Position."},
    schicht: "Rollenkarte in der Session-Datei",
    autor: ["Owner-Promotion", "Fleet"],
    harness: {"art": "alle"},
    lieferart: ["Session-Datei"],
    rollenDefault: {"lane": "an", "main": "an", "orchestratorin": "aus", "nur-ordner": "aus"},
    source: "server.ts#LANE_ROLE_CARD",
    belege: ["server.ts#LANE_ROLE_CARD", "server.ts#MAIN_ROLE_CARD", "server.ts#foundingSessionInput"],
    breaksWithout: "Lane und MAIN verlieren den Abschnitt Rolle ihrer Session-Datei; die Orchestratorin traegt ihre Karte als eigenen Baustein.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "task-brief",
    wort: "Auftrag",
    satz: "Die Karte gibt der Lane Auftrag und Scope.",
    funktion: ["auftrag"],
    grenze: {"art": "noetig", "grund": "Ohne Karte fehlen der Lane Scope und DONE."},
    schicht: "Karte + Queue-Zeile",
    autor: ["MAIN"],
    harness: {"art": "alle"},
    lieferart: ["Prompt"],
    rollenDefault: {"lane": "an", "main": "aus", "orchestratorin": "aus", "nur-ordner": "aus"},
    source: "server.ts#briefAndSend",
    belege: ["server.ts#briefAndSend"],
    breaksWithout: "Die Lane kennt Aufgabe, Scope und Done nicht.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "main-rail",
    wort: "Auftrag",
    satz: "Die MAIN erhaelt Program-Auftrag und Ausfuehrungsweg.",
    funktion: ["auftrag", "vertrag"],
    grenze: {"art": "noetig", "grund": "Ohne Program-Auftrag und Schiene fehlen Scope, Empfaenger und Arbeitsreihenfolge."},
    schicht: "Program-Record + Rollenkarte",
    autor: ["Owner-Promotion", "MAIN", "Fleet"],
    harness: {"art": "alle"},
    lieferart: ["Prompt"],
    rollenDefault: {"lane": "aus", "main": "an", "orchestratorin": "aus", "nur-ordner": "aus"},
    source: "server.ts#railBlockFor",
    belege: ["server.ts#railBlockFor", "server.ts#buildProgramMainBrief"],
    breaksWithout: "MAIN verliert Position, Self-Tueren und Arbeitsreihenfolge.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "orchestrator-card",
    wort: "Auftrag",
    satz: "Die Rollenkarte gibt der Orchestratorin ihre Position.",
    funktion: ["auftrag", "vertrag"],
    grenze: {"art": "noetig", "grund": "Ohne Rollenkarte fehlen Empfaenger, Auftrag und Grenzen."},
    schicht: "Rollenkarte der Orchestratorin",
    autor: ["Owner-Promotion", "Fleet"],
    harness: {"art": "alle"},
    lieferart: ["Prompt"],
    rollenDefault: {"lane": "aus", "main": "aus", "orchestratorin": "an", "nur-ordner": "aus"},
    source: "server.ts#ORCHESTRATOR_ROLE_CARD",
    belege: ["server.ts#ORCHESTRATOR_ROLE_CARD"],
    breaksWithout: "Orchestratorin verliert die Startposition und benannte Tueren; das Label allein gibt keine Rechte.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "self-credential",
    wort: "Rueckweg und Ende",
    satz: "Der Self-Zugang adressiert die eigenen Tueren.",
    funktion: ["rueckweg"],
    grenze: {"art": "noetig", "grund": "Self-Report und Self-Memory brauchen Credential und gueltigen Occupant-Scope."},
    schicht: "Slot-Occupant + Prozess-Env",
    autor: ["Fleet"],
    harness: {"art": "alle"},
    lieferart: ["plan"],
    rollenDefault: {"lane": "an", "main": "an", "orchestratorin": "an", "nur-ordner": "aus"},
    source: "server.ts#ensureSlot",
    belege: ["server.ts#ensureSlot"],
    breaksWithout: "`/api/self/*` kann den Occupant nicht autorisieren.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "lane-footer",
    wort: "Rueckweg und Ende",
    satz: "Der Footer nennt Empfaenger, Report und Ende.",
    funktion: ["rueckweg"],
    grenze: {"art": "noetig", "grund": "Ohne gleichwertigen Rueckweg kann die eingebundene Lane keinen Report abgeben."},
    schicht: "Lane-Footer",
    autor: ["Fleet"],
    harness: {"art": "alle"},
    lieferart: ["Session-Datei", "Prompt"],
    rollenDefault: {"lane": "an", "main": "aus", "orchestratorin": "aus", "nur-ordner": "aus"},
    source: "server.ts#laneExitFooter",
    belege: ["server.ts#laneExitFooter"],
    breaksWithout: "Der Rueckweg und die Endreihenfolge fehlen dem Agenten.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "commit-expectation",
    wort: "Rueckweg und Ende",
    satz: "Ein Land-Ziel braucht Commit und sauberen Baum.",
    funktion: ["beweis"],
    grenze: {"art": "noetig", "grund": "Bei Land-Ziel sind Commit und sauberer Baum noetig; ein Leseauftrag braucht diese Funktion nicht."},
    schicht: "Lane-Footer, erster Akt",
    autor: ["Fleet"],
    harness: {"art": "alle"},
    lieferart: ["Session-Datei", "Prompt"],
    rollenDefault: {"lane": {"zustand": "bedingt", "grund": "Ergebnis soll gelandet werden"}, "main": "aus", "orchestratorin": "aus", "nur-ordner": "aus"},
    source: "server.ts#laneExitFooter",
    belege: ["server.ts#laneExitFooter"],
    breaksWithout: "Ohne Commit ist Arbeit fuer den Land-Pfad unsichtbar; es existiert keine Auto-Commit-Funktion.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "context-anchors",
    wort: "Lesehinweise",
    satz: "Die Lesehinweise zeigen auf erforderliche Quellen.",
    funktion: ["orientierung"],
    grenze: {"art": "frei"},
    schicht: "ContextPlan v2 aus Packs",
    autor: ["Repo-Autor", "MAIN", "Fleet"],
    harness: {"art": "alle"},
    lieferart: ["Session-Datei", "Prompt", "Abruf"],
    rollenDefault: {"lane": "an", "main": "an", "orchestratorin": "an", "nur-ordner": "aus"},
    source: "server.ts#renderContextAnchorBlock",
    belege: ["server.ts#renderContextAnchorBlock"],
    breaksWithout: "Beratende Lesezeiger und Auslassungsgruende fehlen; Quellinhalt war nie enthalten.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "founding-packs",
    wort: "Pack · <Name>",
    satz: "Ein gewaehltes Pack macht seine Quellen auffindbar.",
    funktion: ["orientierung"],
    grenze: {"art": "frei"},
    schicht: "pack",
    autor: ["Repo-Autor", "MAIN", "Fleet"],
    harness: {"art": "alle"},
    lieferart: ["Zustellung", "Abruf"],
    rollenDefault: {"lane": "aus", "main": "aus", "orchestratorin": "aus", "nur-ordner": "aus"},
    source: "server.ts#deliverFoundingPacks",
    belege: ["server.ts#deliverFoundingPacks", "context-packs.ts#CONTEXT_PACKS"],
    breaksWithout: "Nur die explizit gewaehlten Gruendungsanker fehlen.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "konzept",
    wort: "Konzept · <Name>",
    satz: "Ein Konzept zeigt die freigegebene Fassung und Anmerkungen.",
    funktion: ["orientierung"],
    grenze: {"art": "frei"},
    schicht: "konzept",
    autor: ["Owner-Promotion", "Session selbst"],
    harness: {"art": "eingeschraenkt", "werte": ["claude", "codex"], "grund": "Der heutige Seed konzept-claude-fleet ist nur fuer Claude und Codex freigegeben; Pi und Container koennen die private Quelle nicht ueber diesen Seed erhalten."},
    lieferart: ["Session-Datei", "Prompt", "Abruf"],
    rollenDefault: {"lane": {"zustand": "bedingt", "grund": "Konzept gewaehlt und Quelle fuer diesen Harness freigegeben"}, "main": {"zustand": "bedingt", "grund": "Konzept gewaehlt und Quelle fuer diesen Harness freigegeben"}, "orchestratorin": {"zustand": "bedingt", "grund": "Konzept gewaehlt und Quelle fuer diesen Harness freigegeben"}, "nur-ordner": "aus"},
    source: "context-packs.ts#CONTEXT_PACKS",
    belege: ["context-packs.ts#CONTEXT_PACKS", "konzept-ledger.ts#currentKonzeptVersion"],
    breaksWithout: "Ohne Wahl fehlt nur der Konzeptzeiger; Owner-Fassungen und Session-Anmerkungen bleiben in ihrem Ledger.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "lane-notes",
    wort: "Notizen zur Zeile",
    satz: "Treffer zeigen der Lane die Notizen zu ihrer Karte.",
    funktion: ["orientierung"],
    grenze: {"art": "frei"},
    schicht: "task-notes",
    autor: ["MAIN", "Owner-Promotion"],
    harness: {"art": "alle"},
    lieferart: ["Prompt", "Abruf"],
    rollenDefault: {"lane": {"zustand": "bedingt", "grund": "Notiztreffer oder expliziter Pin"}, "main": "aus", "orchestratorin": "aus", "nur-ordner": "aus"},
    source: "task-notes.ts#renderNotesBlock",
    belege: ["task-notes.ts#renderNotesBlock"],
    breaksWithout: "Bei Treffer fehlen Notizvorschau und Pin-Hinweis; ohne Treffer bricht nichts.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "source-pointers",
    wort: "Quellpaket Zeiger",
    satz: "Die Zeiger nennen Symbole, Fassung und Auslassungen.",
    funktion: ["orientierung"],
    grenze: {"art": "frei"},
    schicht: "Quellen der Karten-FLAECHE",
    autor: ["Fleet"],
    harness: {"art": "alle"},
    lieferart: ["Prompt"],
    rollenDefault: {"lane": "an", "main": "aus", "orchestratorin": "aus", "nur-ordner": "aus"},
    source: "context-snippets.ts#renderSnippetBlock",
    belege: ["context-snippets.ts#renderSnippetBlock", "context-snippets.ts#labelFor"],
    breaksWithout: "Ohne Zeiger fehlen vorausgewaehlte Quellen und Auslassungsgruende; eigenes Suchen bleibt moeglich.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "source-code",
    wort: "Quellpaket Code",
    satz: "Die Lane liest die Dateien ohnehin selbst.",
    funktion: ["orientierung"],
    grenze: {"art": "frei"},
    schicht: "Quellen der Karten-FLAECHE",
    autor: ["Fleet"],
    harness: {"art": "alle"},
    lieferart: ["Prompt"],
    rollenDefault: {"lane": "aus", "main": "aus", "orchestratorin": "aus", "nur-ordner": "aus"},
    source: "context-snippets.ts#renderHit",
    belege: ["context-snippets.ts#renderHit", "context-snippets.ts#buildSnippetPackage"],
    breaksWithout: "Ohne Code fehlen die begrenzten Quellbytes; die Zeiger und eigenes Nachlesen koennen erhalten bleiben.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "memory-pointer",
    wort: "Gedaechtnis-Hinweis",
    satz: "Der Hinweis oeffnet den belegten Arbeitsstand.",
    funktion: ["gedaechtnis-zeiger"],
    grenze: {"art": "frei"},
    schicht: "/api/self/memory, Program-Record + Reports + Inbox",
    autor: ["Fleet", "MAIN"],
    harness: {"art": "alle"},
    lieferart: ["Session-Datei", "Prompt", "Abruf"],
    rollenDefault: {"lane": "an", "main": "an", "orchestratorin": "aus", "nur-ordner": "aus"},
    source: "server.ts#memoryPointer",
    belege: ["server.ts#memoryPointer"],
    breaksWithout: "Agent sieht Memory-Tuer und Coverage-Grenzen nicht; Zustand selbst bleibt.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "portfolio-memory-pointer",
    wort: "Gedaechtnis-Hinweis",
    satz: "Der Portfolio-Hinweis braucht einen Owner-Lesegrant.",
    funktion: ["gedaechtnis-zeiger"],
    grenze: {"art": "frei"},
    schicht: "/api/self/memory?view=portfolio",
    autor: ["Fleet"],
    harness: {"art": "alle"},
    lieferart: ["Prompt", "Abruf"],
    rollenDefault: {"lane": "aus", "main": "aus", "orchestratorin": {"zustand": "bedingt", "grund": "Owner-Lesegrant vorhanden"}, "nur-ordner": "aus"},
    source: "server.ts#memoryPortfolioPointer",
    belege: ["server.ts#memoryPortfolioPointer"],
    breaksWithout: "Orchestratorin sieht die Portfolio-Tuer und ihre Grant-Grenze nicht; die Grant-Regel bleibt.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "native-agents",
    wort: "Laedt nativ",
    satz: "Der Harness laedt die Regeln des gewaehlten Ordners.",
    funktion: ["vertrag"],
    grenze: {"art": "frei"},
    schicht: "Native Repo-Regeln, AGENTS.md/Override",
    autor: ["Repo-Autor"],
    harness: {"art": "alle"},
    lieferart: ["native Datei"],
    rollenDefault: {"lane": "an", "main": "an", "orchestratorin": "an", "nur-ordner": "an"},
    source: "docs/messungen/2026-10-07-session-start-wirklich.md#Die Loader-Probe",
    belege: ["docs/messungen/2026-10-07-session-start-wirklich.md#Die Loader-Probe", "session-agents.ts#renderSessionAgents", "server.ts#agentCmd"],
    breaksWithout: "Die nativen Regeln fehlen; Laden und Dateiauswahl folgen dem Harness, nur claudeMdExcludes im Start nimmt Dateien heraus.",
    nichtSchaltbar: "Der Harness laedt den Ordner selbst; Fleet nimmt nur im Start einer Claude-MAIN oder -Orchestratorin Dateien per claudeMdExcludes heraus, im Plan ist das kein Schalter.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "auto-memory",
    wort: "Laedt nativ",
    satz: "Claude laedt sein eigenes Auto-Memory.",
    funktion: ["orientierung"],
    grenze: {"art": "frei"},
    schicht: "~/.claude/projects/*/memory",
    autor: ["Session selbst"],
    harness: {"art": "eingeschraenkt", "werte": ["claude"], "grund": "Nur Claude laedt CLAUDE.md und sein Auto-Memory; Codex und Pi haben diesen Loader nicht."},
    lieferart: ["native Datei"],
    rollenDefault: {"lane": "aus", "main": {"zustand": "bedingt", "grund": "Claude-Auto-Memory vorhanden"}, "orchestratorin": {"zustand": "bedingt", "grund": "Claude-Auto-Memory vorhanden"}, "nur-ordner": {"zustand": "bedingt", "grund": "Claude-Auto-Memory vorhanden"}},
    source: "docs/messungen/2026-10-07-session-start-wirklich.md#Die Loader-Probe",
    belege: ["docs/messungen/2026-10-07-session-start-wirklich.md#Die Loader-Probe", "server.ts#agentCmd"],
    breaksWithout: "Claudes eigener Notizblock fehlt; Fleet-Arbeitsstand und Self-Memory sind davon getrennt.",
    nichtSchaltbar: "Claude laedt sein Auto-Memory selbst; Fleet schaltet es nur im Start einer Lane ab (autoMemoryEnabled:false), im Plan ist es kein Schalter.",
    fassung: "unknown", bytes: "unknown",
  },
  {
    id: "delivery-header",
    wort: "Zustell-Kopf",
    satz: "Der Kopf zeigt die Herkunft einer Zustellung.",
    funktion: ["beweis"],
    grenze: {"art": "frei"},
    schicht: "Transportprovenienz",
    autor: ["Fleet"],
    harness: {"art": "eingeschraenkt", "werte": ["claude"], "grund": "Nur der kopftragende Default-Adapter ergaenzt den Text; Codex, Pi und fremde Basisbefehle behalten den Payload."},
    lieferart: ["Zustellung"],
    rollenDefault: {"lane": {"zustand": "bedingt", "grund": "Zustellung ueber den kopftragenden Claude-Adapter"}, "main": {"zustand": "bedingt", "grund": "Zustellung ueber den kopftragenden Claude-Adapter"}, "orchestratorin": {"zustand": "bedingt", "grund": "Zustellung ueber den kopftragenden Claude-Adapter"}, "nur-ordner": "aus"},
    source: "server.ts#deliveryHeader",
    belege: ["server.ts#deliveryHeader"],
    breaksWithout: "Claude verliert die sichtbare Herkunft einer Zustellung; die Sendung selbst bleibt.",
    fassung: "unknown", bytes: "unknown",
  },
];

// --- WHAT CLAUDE CODE BRINGS ITSELF (Charge 5, MAIN-Entscheid 12.10.) --------------------------------
// Not Bausteine: Fleet does not deliver these and nobody chooses them in a plan, so they carry no
// zustand, no planHash share and no receipt row. The plan route shows them as one group beside the
// plan (server.ts#claudeCodeStart), each row with its way into the start and the code that sets it.
// docs/messungen/2026-10-10-kontext-bestandteile.md H/G1 measured them; F5 named the missing rows.
export type ClaudeCodeRolle = "lane" | "main" | "orchestrator" | "generic";
export interface ClaudeCodeZeile {
  readonly id: "systemprompt" | "werkzeuge" | "listen" | "listenschnitt" | "gepflogenheiten" | "globale-regeln" | "mcp";
  readonly wort: string;
  readonly satz: string;
  readonly quelle: SessionSource;
}
export const CLAUDE_CODE_ZEILEN: readonly ClaudeCodeZeile[] = [
  { id: "systemprompt", wort: "Systemprompt", satz: "Claude Code schreibt Regeln, Umgebung und Modus selbst hinein.",
    quelle: "docs/messungen/2026-10-10-kontext-bestandteile.md#H — Was Claude Code selbst hineinlegt (alle Rollen)" },
  { id: "werkzeuge", wort: "Werkzeuge", satz: "Jedes Werkzeug der Liste bringt sein Schema mit.", quelle: "server.ts#SESSION_TOOLS" },
  { id: "listen", wort: "Skills und Agenten", satz: "Claude Code listet Skills und Agenten, Fleet kuerzt die Liste je Rolle.", quelle: "server.ts#SESSION_LIST_CUT" },
  { id: "listenschnitt", wort: "Listenschnitt", satz: "Eine Zeile nennt, was fehlt und wie es zurueckkommt.", quelle: "server.ts#sessionListCut" },
  { id: "gepflogenheiten", wort: "Gepflogenheiten", satz: "Die Gepflogenheiten haengen am Systemprompt, wenn der Server sie einschaltet.", quelle: "server.ts#agentCmd" },
  { id: "globale-regeln", wort: "Globale Regeln", satz: "Claude laedt die Regeln des Owners aus seinem Konfig-Ordner.", quelle: "server.ts#nativeLoaderBytes" },
  { id: "mcp", wort: "MCP", satz: "Eine Text-Lane startet ohne MCP-Server, jede andere Session mit denen des Accounts.", quelle: "server.ts#agentCmd" },
];
// THE MEASURED START OF EACH SPAWN ROLE: input tokens of the first answer (input + cache_creation +
// cache_read) of an interactive claude pane in an EMPTY scratch folder, private tmux socket, started
// with the role's own line from server.ts#agentCmd at d266a070 (--dangerously-skip-permissions,
// --model 'claude-opus-5-5[1m]', --effort high, the role's list cut, --tools where the role has a list,
// --strict-mcp-config and autoMemoryEnabled:false for the lane), prompt "ok". Everything in it is
// Claude Code's or the owner's global file — no repo, no rulebook, no session file, no brief.
// `werkzeuge` is the list it ran with (null = no --tools): the route compares it with SESSION_TOOLS
// and calls the number stale when they differ, rather than carrying a number for a list it never saw.
export interface ClaudeCodeMessung {
  readonly tokens: number;
  readonly am: string;
  readonly claude: string;
  readonly modell: string;
  readonly werkzeuge: readonly string[] | null;
}
export const CLAUDE_CODE_MESSUNG: Readonly<Record<ClaudeCodeRolle, ClaudeCodeMessung>> = {
  lane: { tokens: 31_134, am: "2026-10-11T22:10Z", claude: "2.1.296", modell: "claude-opus-5-5[1m]",
    werkzeuge: ["Bash", "Read", "Edit", "Write", "ToolSearch", "Agent", "WebFetch", "Skill", "TaskStop", "WebSearch",
      "ScheduleWakeup", "Artifact", "Monitor", "SendFeedback"] },
  main: { tokens: 33_596, am: "2026-10-11T22:10Z", claude: "2.1.296", modell: "claude-opus-5-5[1m]",
    werkzeuge: ["Bash", "Read", "Write", "Edit", "Artifact", "ToolSearch", "TaskStop", "Agent", "WebFetch", "WebSearch",
      "SendMessage", "SendFeedback", "Skill", "Monitor", "PushNotification"] },
  orchestrator: { tokens: 36_985, am: "2026-10-11T22:10Z", claude: "2.1.296", modell: "claude-opus-5-5[1m]",
    werkzeuge: ["Bash", "Read", "Write", "ToolSearch", "PushNotification", "Agent", "Artifact", "WebSearch", "Edit",
      "WebFetch", "TaskStop", "Skill", "Workflow", "AskUserQuestion", "ScheduleWakeup"] },
  generic: { tokens: 40_251, am: "2026-10-11T22:12Z", claude: "2.1.296", modell: "claude-opus-5-5[1m]", werkzeuge: null },
};
// Fleet's own part is measured in bytes; the window converts it with the ratio a regression over 89
// Opus-5.5 starts measured (docs/messungen/2026-10-10-kontext-bestandteile.md, Lesart: 2,05-2,18 B/Tok,
// the note itself divides by 2,1) and says that it is an estimate.
export const FLEET_BYTES_JE_TOKEN = { wert: 2.1, quelle: "docs/messungen/2026-10-10-kontext-bestandteile.md#Lesart" } as const;

// --- THE PLAN (Objektmodell Fassung 2 §1; Owner-Ja F1 via the Orchestratorin, 07.10.) ---------------
// What THIS session gets: role, place, triple, and per Baustein one state an | aus | ersetzt:<id>. A
// pure function of its inputs — the caller measures (session file, native files, memory) and this
// resolver decides; the window, and later the receipt, read the result instead of deciding again.
// The two templates (founding-packs, konzept) describe one row PER pack: a plan carries instances
// `pack:<packId>` in their place, their parts only in `details` (owner 01.10.: no card list).
export type PlanZustand = "an" | "aus" | `ersetzt:${string}`;
export type PlanOrt = "worktree" | "repo" | "ordner";
export type HarnessFamilie = "claude" | "codex" | "pi" | "container";
export type PlanBytes = number | "unknown";

export const SESSION_BLOCK_VORLAGEN = ["founding-packs", "konzept"] as const;
export const ROLLE_WORT: Readonly<Record<SessionRole, string>> =
  { lane: "Lane", main: "MAIN", orchestratorin: "Orchestratorin", "nur-ordner": "Nur Ordner" };

// The register's harness words are families: every pi-* adapter is "pi"; `container` is named by no
// block and so is valid only where a block holds for all harnesses.
export function harnessFamilie(harness: string): HarnessFamilie {
  return harness === "codex" ? "codex" : harness === "container" ? "container" : harness.startsWith("pi") ? "pi" : "claude";
}

export interface PlanPackInstanz {
  readonly packId: string;
  readonly vorlage: (typeof SESSION_BLOCK_VORLAGEN)[number];
  /** null = the context plan selected it; otherwise its omission reason (context-plan.ts ladder) */
  readonly ausgelassen: string | null;
  /** the pack's declared harnesses, named when it is omitted as harness-unsupported */
  readonly harnesses: readonly string[] | null;
  /** the renderer carries it whatever the switch says (a Codex/Pi contract pack); the reason */
  readonly erzwungen?: string;
  readonly details?: unknown;
}

export interface SessionPlanInput {
  readonly rolle: SessionRole;
  readonly ort: { readonly art: PlanOrt; readonly pfad: string; readonly branch: string | null; readonly head: string };
  readonly harness: string;
  readonly modell: string | null;
  readonly effort: string | null;
  /** the sentence words the caller owns (harness, model and effort labels, the place) */
  readonly woerter: { readonly harness: string; readonly modell: string | null; readonly effort: string | null; readonly ort: string };
  readonly packs: readonly PlanPackInstanz[];
  /** conditions of `bedingt` defaults the caller could decide; absent = unknown */
  readonly bedingungen: Readonly<Partial<Record<string, boolean | "unknown">>>;
  /** the requested switches, id → "an" | "aus" | "ersetzt:<id>" */
  readonly schalter: Readonly<Record<string, string>>;
}

export interface SessionPlanMessung {
  readonly bytes: Readonly<Partial<Record<string, PlanBytes>>>;
  /** a row whose bytes another row already carries (commit-expectation in lane-footer, packs in context-anchors) */
  readonly enthaltenIn: Readonly<Partial<Record<string, string>>>;
  readonly details?: Readonly<Partial<Record<string, unknown>>>;
}

export interface SessionPlanBaustein {
  readonly id: string;
  readonly wort: string;
  readonly satz: string;
  readonly funktion: readonly SessionFunction[];
  readonly grenze: SessionBlock["grenze"];
  readonly schicht: string;
  readonly lieferart: SessionBlock["lieferart"];
  readonly zustand: PlanZustand;
  readonly quelle: "default" | "schalter";
  readonly rollenDefault: SessionDefault;
  readonly bedingung?: { readonly grund: string; readonly erfuellt: boolean | "unknown" };
  readonly harness: { readonly gueltig: boolean; readonly grund: string | null };
  readonly schaltbar: { readonly ja: true } | { readonly ja: false; readonly grund: string };
  readonly bytes: PlanBytes;
  readonly enthaltenIn?: string;
  readonly ersatzKandidaten: readonly string[];
  readonly vorlage?: string;
  readonly details?: unknown;
}

export interface SessionPlan {
  readonly planHash: string;
  readonly planSatz: string;
  readonly rolle: SessionRole;
  readonly ort: SessionPlanInput["ort"];
  readonly harness: string;
  readonly modell: string | null;
  readonly effort: string | null;
  /** an rows outside the Auftrag; a row carried by an an container counts there */
  readonly bytesVorAuftrag: { readonly bytes: number; readonly unknown: readonly string[]; readonly auftrag: readonly string[] };
  readonly bausteine: readonly SessionPlanBaustein[];
}

type Row = { readonly block: SessionBlock; readonly id: string; readonly wort: string; readonly pack?: PlanPackInstanz };

const stateOf = (value: SessionDefault): "an" | "aus" | "bedingt" => typeof value === "object" ? value.zustand : value;

export function resolveSessionPlan(input: SessionPlanInput, messe: (zustaende: ReadonlyMap<string, PlanZustand>) => SessionPlanMessung):
  { ok: true; plan: SessionPlan } | { ok: false; error: string } {
  const familie = harnessFamilie(input.harness);
  const vorlagen = new Set<string>(SESSION_BLOCK_VORLAGEN);
  const rows: Row[] = SESSION_BLOCKS.filter((block) => !vorlagen.has(block.id)).map((block) => ({ block, id: block.id, wort: block.wort }));
  for (const pack of input.packs) {
    const block = SESSION_BLOCKS.find((entry) => entry.id === pack.vorlage)!;
    rows.push({ block, id: `pack:${pack.packId}`, wort: block.wort.replace("<Name>", pack.packId), pack });
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  const harnessOf = (row: Row): { gueltig: boolean; grund: string | null } => {
    if (row.block.harness.art === "eingeschraenkt" && !(row.block.harness.werte as readonly string[]).includes(familie))
      return { gueltig: false, grund: row.block.harness.grund };
    if (row.pack?.ausgelassen === "harness-unsupported")
      return { gueltig: false, grund: `Das Pack erklaert nur ${(row.pack.harnesses ?? []).join(", ") || "keinen Harness"}.` };
    return { gueltig: true, grund: null };
  };
  const nativ = (row: Row): boolean => stateOf(row.block.rollenDefault["nur-ordner"]) !== "aus";
  const erzwungen = (row: Row): string | undefined => input.rolle === "nur-ordner" ? undefined : row.pack?.erzwungen;
  const defaultOf = (row: Row): SessionDefault => row.pack
    ? (input.rolle !== "nur-ordner" && (row.pack.erzwungen || row.pack.ausgelassen === null) ? "an" : "aus")
    : row.block.rollenDefault[input.rolle];
  const bedingungOf = (row: Row): { grund: string; erfuellt: boolean | "unknown" } | undefined => {
    const value = defaultOf(row);
    return typeof value === "object" ? { grund: value.grund, erfuellt: input.bedingungen[row.id] ?? "unknown" } : undefined;
  };
  // An unknown condition keeps the default on: the row may deliver, and its bytes stay unknown.
  const resolvedDefault = (row: Row): "an" | "aus" => {
    if (!harnessOf(row).gueltig) return "aus";
    const value = defaultOf(row);
    if (typeof value !== "object") return value;
    return bedingungOf(row)!.erfuellt === false ? "aus" : "an";
  };
  const kandidatenOf = (row: Row): string[] => row.pack || (row.block.grenze.art === "noetig" && row.block.grenze.gesperrt) ? []
    : rows.filter((other) => !other.pack && other.id !== row.id && harnessOf(other).gueltig
      && row.block.funktion.every((f) => other.block.funktion.includes(f))).map((other) => other.id);

  const zustand = new Map<string, PlanZustand>(rows.map((row) => [row.id, resolvedDefault(row)]));
  const gesetzt = new Set<string>();
  for (const [id, raw] of Object.entries(input.schalter)) {
    const row = byId.get(id);
    if (!row) return { ok: false, error: vorlagen.has(id) ? `${id} is a template: switch its rows pack:<id>` : `unknown Baustein ${id}` };
    const value = raw === "an" || raw === "aus" ? raw : /^ersetzt:[a-z0-9:._-]+$/i.test(raw) ? raw as PlanZustand : null;
    if (!value) return { ok: false, error: `${id}: state must be an, aus or ersetzt:<id>` };
    if (row.block.nichtSchaltbar && value !== resolvedDefault(row)) return { ok: false, error: `${id}: ${row.block.nichtSchaltbar}` };
    const forced = erzwungen(row);
    if (forced && value !== "an") return { ok: false, error: `${id}: ${forced}` };
    if (input.rolle === "nur-ordner" && !nativ(row) && value !== "aus")
      return { ok: false, error: `${id}: Nur Ordner liefert nur native-agents und auto-memory` };
    if (value === "an") {
      const harness = harnessOf(row);
      if (!harness.gueltig) return { ok: false, error: `${id} gilt nicht fuer ${input.harness}: ${harness.grund}` };
      if (row.pack && row.pack.ausgelassen !== null && !erzwungen(row)) return { ok: false, error: `${id} ist nicht im Plan (${row.pack.ausgelassen})` };
      const bedingung = bedingungOf(row);
      if (bedingung?.erfuellt === false) return { ok: false, error: `${id}: Bedingung nicht erfuellt — ${bedingung.grund}` };
    }
    if (value === "aus" && row.block.grenze.art === "noetig" && resolvedDefault(row) === "an" && bedingungOf(row)?.erfuellt !== "unknown")
      return { ok: false, error: `${id} ist noetig: ${row.block.grenze.grund}` };
    if (value.startsWith("ersetzt:")) {
      if (row.block.grenze.art === "noetig" && row.block.grenze.gesperrt) return { ok: false, error: `${id} ist gesperrt: ${row.block.grenze.grund}` };
      if (row.pack) return { ok: false, error: `${id}: ein Pack wird nur an- oder ausgeschaltet` };
      const ersatz = value.slice("ersetzt:".length);
      if (!kandidatenOf(row).includes(ersatz)) return { ok: false, error: `${ersatz} traegt nicht die Funktion von ${id} (${row.block.funktion.join(", ")})` };
    }
    zustand.set(id, value);
    gesetzt.add(id);
  }
  // Packs deliver only through the reading pointers: with context-anchors off, a defaulted pack is
  // off and an explicitly switched one is a contradiction.
  if (zustand.get("context-anchors") !== "an") for (const row of rows) if (row.pack && !erzwungen(row) && zustand.get(row.id) === "an") {
    if (gesetzt.has(row.id)) return { ok: false, error: `${row.id}: Packs liefern nur ueber context-anchors, und das ist aus` };
    zustand.set(row.id, "aus");
  }
  for (const [id, value] of zustand) if (value.startsWith("ersetzt:") && zustand.get(value.slice("ersetzt:".length)) !== "an")
    return { ok: false, error: `${id} ${value}, aber ${value.slice("ersetzt:".length)} ist nicht an` };

  const messung = messe(zustand);
  const bausteine: SessionPlanBaustein[] = rows.map((row) => {
    const bedingung = bedingungOf(row);
    const enthaltenIn = messung.enthaltenIn[row.id];
    return {
      id: row.id, wort: row.wort, satz: row.block.satz, funktion: row.block.funktion, grenze: row.block.grenze,
      schicht: row.block.schicht, lieferart: row.block.lieferart,
      zustand: zustand.get(row.id)!, quelle: gesetzt.has(row.id) ? "schalter" : "default",
      rollenDefault: defaultOf(row), ...(bedingung ? { bedingung } : {}),
      harness: harnessOf(row),
      schaltbar: row.block.nichtSchaltbar ? { ja: false, grund: row.block.nichtSchaltbar }
        : erzwungen(row) ? { ja: false, grund: erzwungen(row)! }
        : input.rolle === "nur-ordner" && !nativ(row) ? { ja: false, grund: "Nur Ordner liefert nur native-agents und auto-memory." }
        : { ja: true },
      bytes: messung.bytes[row.id] ?? "unknown", ...(enthaltenIn ? { enthaltenIn } : {}),
      ersatzKandidaten: kandidatenOf(row),
      ...(row.pack ? { vorlage: row.pack.vorlage } : {}),
      ...((row.pack?.details ?? messung.details?.[row.id]) !== undefined ? { details: row.pack?.details ?? messung.details?.[row.id] } : {}),
    };
  });
  const an = bausteine.filter((b) => b.zustand === "an");
  const auftrag = an.filter((b) => b.funktion.includes("auftrag")).map((b) => b.id);
  const counted = an.filter((b) => !b.funktion.includes("auftrag")
    && !(b.enthaltenIn !== undefined && zustand.get(b.enthaltenIn) === "an"));
  const bytesVorAuftrag = {
    bytes: counted.reduce((sum, b) => sum + (typeof b.bytes === "number" ? b.bytes : 0), 0),
    unknown: counted.filter((b) => b.bytes === "unknown").map((b) => b.id), auftrag,
  };
  const planSatz = [ROLLE_WORT[input.rolle], input.woerter.harness, input.woerter.modell, input.woerter.effort, input.woerter.ort]
    .filter((word): word is string => !!word).join(" · ");
  // The hash names the DECISION — who, where, at which commit, on what, and every row's state —
  // not the measured bytes: the receipt measures delivery against this hash.
  const planHash = createHash("sha256").update(JSON.stringify([input.rolle, input.ort.art, input.ort.pfad, input.ort.branch,
    input.ort.head, input.harness, input.modell, input.effort, bausteine.map((b) => [b.id, b.zustand])])).digest("hex");
  return { ok: true, plan: { planHash, planSatz, rolle: input.rolle, ort: input.ort, harness: input.harness,
    modell: input.modell, effort: input.effort, bytesVorAuftrag, bausteine } };
}
