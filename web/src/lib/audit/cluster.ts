// Group cannibalization pairs into clusters of competing pages via union-find.
// Slice 2 emits *pairs* above the similarity threshold; when 3+ pages compete
// (A↔B and B↔C) they belong to one audit unit, not two. We only see URLs that
// appear in at least one pair, so every cluster has size >= 2.

export interface PairLike {
  a: string;
  b: string;
}

export function clusterPairs(pairs: PairLike[]): string[][] {
  const parent = new Map<string, string>();

  const add = (x: string) => {
    if (!parent.has(x)) parent.set(x, x);
  };

  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    // Path compression.
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };

  const union = (x: string, y: string) => {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  };

  for (const { a, b } of pairs) {
    add(a);
    add(b);
    union(a, b);
  }

  const groups = new Map<string, string[]>();
  for (const node of parent.keys()) {
    const root = find(node);
    const arr = groups.get(root);
    if (arr) arr.push(node);
    else groups.set(root, [node]);
  }

  // Deterministic output: urls sorted within a cluster, clusters sorted by their
  // first url. Keeps the prompt and tests stable.
  const clusters = [...groups.values()].map((urls) => [...urls].sort());
  clusters.sort((c1, c2) => c1[0].localeCompare(c2[0]));
  return clusters;
}
