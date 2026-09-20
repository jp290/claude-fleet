// 16 Slots wie im echten Betrieb: zwei Harnesses, drei Projekte, alle vier Zustaende, MAIN und Lane.
// Die Farbtoene werden NICHT hier gesetzt — sie fallen aus projectHue(repo) heraus, dem vorhandenen
// Algorithmus. openedAt ist echt aussehende Zeit, weil sie in den Seed der Marke eingeht.
export const SLOTS = [
  { slot: 1,  repo: "/Users/o/claude-fleet",   label: "Land-Pipeline",     role: "main", harness: "claude", model: "opus-5",        state: "rest",  pct: 18, meta: "9 min",  openedAt: 1789741100000 },
  { slot: 2,  repo: "/Users/o/privatraum",     label: "Privat",            role: "main", harness: "claude", model: "opus-5",        state: "sleep", pct: 14, meta: "84 min", openedAt: 1789660200000 },
  { slot: 3,  repo: "/Users/o/claude-fleet",   label: "Orchestrator",      role: "main", harness: "claude", model: "opus-5",        state: "work",  pct: 11, meta: "jetzt",  openedAt: 1789767300000,
    lanes: [
      { slot: "3A", repo: "/Users/o/claude-fleet", label: "Queue-Ansicht", role: "lane", harness: "claude",  model: "opus-5",        state: "need",  pct: 32, meta: "↑7",   openedAt: 1789770100000 },
      { slot: "3B", repo: "/Users/o/claude-fleet", label: "Info-Leiste",   role: "lane", harness: "codex",   model: "gpt-5.6",       state: "work",  pct: 13, meta: "jetzt", openedAt: 1789771200000 },
      { slot: "3C", repo: "/Users/o/claude-fleet", label: "Linke Leiste",  role: "lane", harness: "claude",  model: "opus-5",        state: "work",  pct: 8,  meta: "jetzt", openedAt: 1789772300000 }] },
  { slot: 4,  repo: "/Users/o/claude-fleet",   label: "Fleet-Betrieb",     role: "main", harness: "claude", model: "opus-5",        state: "rest",  pct: 27, meta: "66 min", openedAt: 1789700400000,
    lanes: [{ slot: "4A", repo: "/Users/o/claude-fleet", label: "task 8ff7", role: "lane", harness: "pi-zai", model: "glm-5.3-flash", state: "work", pct: null, meta: "↑3", openedAt: 1789773400000 }] },
  { slot: 5,  repo: "/Users/o/private-repo-aa", label: "Private-repo-aa",        role: "main", harness: "codex",  model: "gpt-5.6",       state: "sleep", pct: 58, meta: "4 h",    openedAt: 1789600500000 },
  { slot: 6,  repo: "/Users/o/private-repo-r",         label: "Audit",             role: "main", harness: "claude", model: "opus-5",        state: "bad",   pct: 18, meta: "rot",    openedAt: 1789740600000 },
  { slot: 7,  repo: "/Users/o/claude-fleet",   label: "Studio",            role: "main", harness: "codex",  model: "gpt-5.6",       state: "rest",  pct: 18, meta: "9 min",  openedAt: 1789740700000 },
  { slot: 8,  repo: "/Users/o/claude-fleet",   label: "memory",            role: "main", harness: "claude", model: "opus-5",        state: "sleep", pct: 14, meta: "4 h",    openedAt: 1789600800000 },
  { slot: 9,  free: true },
  { slot: 10, repo: "/Users/o/claude-fleet",   label: "Leichtgewicht",     role: "main", harness: "pi-zai", model: "glm-5.3-flash", state: "rest",  pct: 73, meta: "12 h",   openedAt: 1789531000000,
    lanes: [{ slot: "10A", repo: "/Users/o/claude-fleet", label: "task c779", role: "lane", harness: "pi-zai", model: "glm-5.3-flash", state: "done", pct: null, meta: "↑2", openedAt: 1789774500000 }] },
  { slot: 11, repo: "/Users/o/claude-fleet",   label: "Worktrail-Analyse", role: "main", harness: "codex",  model: "gpt-5.6",       state: "sleep", pct: 55, meta: "12 h",   openedAt: 1789531100000 },
  { slot: 12, repo: "/Users/o/private-repo-r",         label: "Private-repo-r-Umbau",      role: "main", harness: "claude", model: "opus-5",        state: "work",  pct: 41, meta: "jetzt",  openedAt: 1789775200000 },
  { slot: 13, repo: "/Users/o/private-repo-aa", label: "Diorama-Render",    role: "main", harness: "pi-zai", model: "glm-5.3-flash", state: "work",  pct: 6,  meta: "jetzt",  openedAt: 1789775300000 },
  { slot: 14, free: true },
  { slot: 15, repo: "/Users/o/claude-fleet",   label: "Steward",           role: "main", harness: "claude", model: "opus-5",        state: "rest",  pct: 22, meta: "31 min", openedAt: 1789760500000 },
  { slot: 16, repo: "/Users/o/shell",          label: "Shell",             role: "main", harness: "claude", model: "",              state: "work",  pct: 6,  meta: "jetzt",  openedAt: 1789775600000 },
];
// jeder Eintrag, MAIN und Lane, als flache Liste — die Marke kennt keinen Unterschied
export const ALL = SLOTS.flatMap((s) => (s.free ? [] : [s, ...(s.lanes ?? [])]));
