// the explorer tree and its search, kept out of client.ts so they can be unit-tested without
// a DOM (e2e/explorer.ts calls treeOf/matchTree directly; paintTree stays in client.ts).

// the tree as a nested map, derived from the flat path list on every paint. Cheap (a few thousand
// strings at most, capped server-side) and it keeps ONE source of truth — the flat list the server
// sent — instead of a parallel structure that could disagree with it.
export interface TreeNode { dirs: Map<string, TreeNode>; files: string[] }
export function treeOf(paths: string[]): TreeNode {
  const root: TreeNode = { dirs: new Map(), files: [] };
  for (const p of paths) {
    const parts = p.split("/");
    let node = root;
    for (const seg of parts.slice(0, -1)) {
      let next = node.dirs.get(seg);
      if (!next) { next = { dirs: new Map(), files: [] }; node.dirs.set(seg, next); }
      node = next;
    }
    node.files.push(parts[parts.length - 1]);
  }
  return root;
}

// The search. It matches the WHOLE relative path, not the basename, because the question the
// explorer could not answer was "where is the file whose path contains …" — `e2e/pins`, `docs/ver`
// and `client.ts` all have to find something. Space-separated terms are ANDed in any order, so
// `pins e2e` and `e2e pins` are the same query; case is ignored.
//
// A hit list is FLAT and deliberately so: a filtered tree still has to be walked open folder by
// open folder, which is the work the search exists to remove. Sorted shortest-path-first so the
// closest match to a short query is the first row rather than the alphabetically luckiest one.
export function matchTree(paths: string[], query: string): string[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return paths
    .filter((p) => { const lc = p.toLowerCase(); return terms.every((t) => lc.includes(t)); })
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
}
