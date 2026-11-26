"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ConvergenceError: () => ConvergenceError,
  DEFAULT_SEED: () => DEFAULT_SEED,
  Graph: () => Graph,
  GraphValidationError: () => GraphValidationError,
  LeidenConvergenceError: () => LeidenConvergenceError,
  Partition: () => Partition,
  Xoshiro128: () => Xoshiro128,
  aggregate: () => aggregate,
  leiden: () => leiden,
  localMove: () => localMove,
  modularity: () => modularity,
  refine: () => refine
});
module.exports = __toCommonJS(index_exports);

// src/types.ts
var GraphValidationError = class extends Error {
  code;
  edge;
  constructor(code, message, edge) {
    super(message);
    this.name = "GraphValidationError";
    this.code = code;
    if (edge !== void 0) this.edge = edge;
  }
};

// src/graph.ts
var Graph = class _Graph {
  n;
  m;
  offsets;
  targets;
  weights;
  nodeWeights;
  totalWeight;
  hasSelfLoops;
  /**
   * Internal — use {@link Graph.fromEdgeList} or {@link Graph.fromCSR}.
   *
   * The constructor takes ownership of the typed arrays and does no
   * validation. Factories are responsible for producing consistent inputs.
   */
  constructor(args) {
    this.n = args.n;
    this.m = args.m;
    this.offsets = args.offsets;
    this.targets = args.targets;
    this.weights = args.weights;
    this.nodeWeights = args.nodeWeights;
    this.totalWeight = args.totalWeight;
    this.hasSelfLoops = args.hasSelfLoops;
  }
  /**
   * Construct a graph from an edge list.
   *
   * @param nodeCount  number of nodes; node ids are in [0, nodeCount)
   * @param edges      array of [u, v] or [u, v, weight] tuples
   * @param options    {@link GraphOptions}; selfLoops defaults to 'reject'
   *
   * @throws GraphValidationError on invalid input (when validate is true)
   */
  static fromEdgeList(nodeCount, edges, options = {}) {
    const validate = options.validate ?? true;
    const selfLoopMode = options.selfLoops ?? "reject";
    if (options.directed === true) {
      throw new GraphValidationError(
        "DIRECTED_NOT_SUPPORTED",
        "Directed graphs are not supported in this version."
      );
    }
    if (!Number.isInteger(nodeCount) || nodeCount < 0) {
      throw new GraphValidationError(
        "INVALID_NODE_COUNT",
        `nodeCount must be a non-negative integer; got ${String(nodeCount)}`
      );
    }
    const degree = new Uint32Array(nodeCount);
    let mUnique = 0;
    let hasSelfLoops = false;
    const seen = validate ? new Array(nodeCount) : null;
    const kept = [];
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const u = edge[0];
      const v = edge[1];
      const w = edge[2] ?? 1;
      if (validate) {
        if (!Number.isInteger(u) || u < 0 || u >= nodeCount) {
          throw new GraphValidationError(
            "NODE_OUT_OF_RANGE",
            `Edge endpoint u=${String(u)} out of range [0, ${nodeCount})`,
            edge
          );
        }
        if (!Number.isInteger(v) || v < 0 || v >= nodeCount) {
          throw new GraphValidationError(
            "NODE_OUT_OF_RANGE",
            `Edge endpoint v=${String(v)} out of range [0, ${nodeCount})`,
            edge
          );
        }
        if (!Number.isFinite(w)) {
          throw new GraphValidationError(
            "NOT_FINITE",
            `Edge weight ${String(w)} is not finite`,
            edge
          );
        }
        if (w < 0) {
          throw new GraphValidationError(
            "NEGATIVE_WEIGHT",
            `Edge weight ${w} is negative`,
            edge
          );
        }
      }
      const isSelfLoop = u === v;
      if (isSelfLoop) {
        if (selfLoopMode === "reject") {
          if (validate) {
            throw new GraphValidationError(
              "SELF_LOOP",
              `Self-loop at node ${u}; pass selfLoops:'allow' or 'collapse' to permit`,
              edge
            );
          }
          continue;
        }
        if (selfLoopMode === "collapse") {
          continue;
        }
        hasSelfLoops = true;
      }
      if (validate && seen !== null) {
        const lo = u < v ? u : v;
        const hi = u < v ? v : u;
        let bucket = seen[lo];
        if (bucket === void 0 || bucket === null) {
          bucket = /* @__PURE__ */ new Set();
          seen[lo] = bucket;
        }
        if (bucket.has(hi)) {
          throw new GraphValidationError(
            "DUPLICATE_EDGE",
            `Duplicate undirected edge (${u}, ${v})`,
            edge
          );
        }
        bucket.add(hi);
      }
      kept.push([u, v, w]);
      degree[u] = degree[u] + 1;
      if (!isSelfLoop) degree[v] = degree[v] + 1;
      mUnique++;
    }
    const offsets = new Uint32Array(nodeCount + 1);
    let running = 0;
    for (let u = 0; u < nodeCount; u++) {
      offsets[u] = running;
      running += degree[u];
    }
    offsets[nodeCount] = running;
    const halfEdgeCount = running;
    const targets = new Uint32Array(halfEdgeCount);
    const weights = new Float64Array(halfEdgeCount);
    const cursor = new Uint32Array(nodeCount);
    for (let i = 0; i < kept.length; i++) {
      const edge = kept[i];
      const u = edge[0];
      const v = edge[1];
      const w = edge[2];
      const uPos = offsets[u] + cursor[u];
      targets[uPos] = v;
      weights[uPos] = w;
      cursor[u] = cursor[u] + 1;
      if (u !== v) {
        const vPos = offsets[v] + cursor[v];
        targets[vPos] = u;
        weights[vPos] = w;
        cursor[v] = cursor[v] + 1;
      }
    }
    sortRunsByTarget(offsets, targets, weights, nodeCount);
    const nodeWeights = new Float64Array(nodeCount);
    for (let u = 0; u < nodeCount; u++) {
      const start = offsets[u];
      const end = offsets[u + 1];
      let sum = 0;
      for (let i = start; i < end; i++) {
        const w = weights[i];
        sum += w;
        if (targets[i] === u) sum += w;
      }
      nodeWeights[u] = sum;
    }
    let totalWeight = 0;
    for (let u = 0; u < nodeCount; u++) totalWeight += nodeWeights[u];
    return new _Graph({
      n: nodeCount,
      m: mUnique,
      offsets,
      targets,
      weights,
      nodeWeights,
      totalWeight,
      hasSelfLoops
    });
  }
  /**
   * Construct directly from prepared CSR arrays.
   *
   * Skips all validation. Caller asserts:
   *   - offsets is monotonically non-decreasing
   *   - offsets.length === n + 1
   *   - targets and weights have length === offsets[n]
   *   - undirected symmetry: every (u → v, w) has a matching (v → u, w)
   *     except when u === v (self-loops appear once)
   *   - all weights finite and non-negative
   *
   * The Graph takes ownership of the supplied typed arrays and does
   * not copy them. Mutating the inputs after this call is undefined
   * behaviour.
   */
  static fromCSR(args) {
    const { n, offsets, targets, weights } = args;
    const nodeWeights = new Float64Array(n);
    let m = 0;
    let hasSelfLoops = false;
    let totalWeight = 0;
    for (let u = 0; u < n; u++) {
      const start = offsets[u];
      const end = offsets[u + 1];
      let sum = 0;
      for (let i = start; i < end; i++) {
        const w = weights[i];
        const t = targets[i];
        sum += w;
        if (t === u) {
          sum += w;
          hasSelfLoops = true;
          m++;
        } else if (t > u) {
          m++;
        }
      }
      nodeWeights[u] = sum;
      totalWeight += sum;
    }
    return new _Graph({
      n,
      m,
      offsets,
      targets,
      weights,
      nodeWeights,
      totalWeight,
      hasSelfLoops
    });
  }
  /** Number of neighbors of u (unweighted; self-loops counted once). */
  degree(u) {
    return this.offsets[u + 1] - this.offsets[u];
  }
  /** Sum of edge weights incident to u; alias for nodeWeights[u]. */
  weightedDegree(u) {
    return this.nodeWeights[u];
  }
};
function sortRunsByTarget(offsets, targets, weights, n) {
  for (let u = 0; u < n; u++) {
    const start = offsets[u];
    const end = offsets[u + 1];
    for (let i = start + 1; i < end; i++) {
      const tKey = targets[i];
      const wKey = weights[i];
      let j = i - 1;
      while (j >= start && targets[j] > tKey) {
        targets[j + 1] = targets[j];
        weights[j + 1] = weights[j];
        j--;
      }
      targets[j + 1] = tKey;
      weights[j + 1] = wKey;
    }
  }
}

// src/internal/kahan.ts
var KahanAccumulator = class {
  _sum = 0;
  _c = 0;
  /** Add a single value to the running total. */
  add(value) {
    const y = value - this._c;
    const t = this._sum + y;
    this._c = t - this._sum - y;
    this._sum = t;
  }
  /** The current compensated sum. */
  get value() {
    return this._sum;
  }
  /** Reset to zero so the accumulator can be reused. */
  reset() {
    this._sum = 0;
    this._c = 0;
  }
};

// src/modularity.ts
function modularity(graph, partition, options) {
  if (partition.length !== graph.n) {
    throw new RangeError(
      `partition length ${partition.length} does not match graph.n ${graph.n}`
    );
  }
  const resolution = options?.resolution ?? 1;
  if (!Number.isFinite(resolution)) {
    throw new RangeError(
      `resolution must be a finite number; got ${String(resolution)}`
    );
  }
  const m2 = graph.totalWeight;
  if (m2 === 0) {
    return 0;
  }
  const internalByCommunity = /* @__PURE__ */ new Map();
  const totalByCommunity = /* @__PURE__ */ new Map();
  const offsets = graph.offsets;
  const targets = graph.targets;
  const weights = graph.weights;
  const nodeWeights = graph.nodeWeights;
  const n = graph.n;
  for (let u = 0; u < n; u++) {
    const cu = partition[u];
    const start = offsets[u];
    const end = offsets[u + 1];
    for (let i = start; i < end; i++) {
      const v = targets[i];
      const w = weights[i];
      const cv = partition[v];
      if (cu === cv) {
        let acc = internalByCommunity.get(cu);
        if (acc === void 0) {
          acc = new KahanAccumulator();
          internalByCommunity.set(cu, acc);
        }
        acc.add(w);
        if (v === u) acc.add(w);
      }
    }
    let tot = totalByCommunity.get(cu);
    if (tot === void 0) {
      tot = new KahanAccumulator();
      totalByCommunity.set(cu, tot);
    }
    tot.add(nodeWeights[u]);
  }
  const q = new KahanAccumulator();
  const inv2m = 1 / m2;
  for (const [community, totAcc] of totalByCommunity) {
    const tot = totAcc.value;
    const intern = internalByCommunity.get(community)?.value ?? 0;
    const term = intern * inv2m - resolution * (tot * inv2m) * (tot * inv2m);
    q.add(term);
  }
  return q.value;
}

// src/partition.ts
var Partition = class _Partition {
  graph;
  /** assignments[u] = community id of node u; ids are contiguous in [0, numCommunities). */
  assignments;
  /** Σᵢₙ(c): total weight of edges with both endpoints in community c (Newman). */
  communityInternal;
  /** Σₜₒₜ(c): total weight of edges incident to community c. */
  communityIncident;
  /** Number of non-empty communities — also the upper bound of valid community ids. */
  numCommunities;
  /** communitySize[c] = count of nodes with assignments[u] === c. */
  communitySize;
  /**
   * Internal — use `Partition.singletons()` or `Partition.fromAssignments()`.
   * The constructor takes ownership of the typed arrays without copy.
   */
  constructor(args) {
    this.graph = args.graph;
    this.assignments = args.assignments;
    this.communityInternal = args.communityInternal;
    this.communityIncident = args.communityIncident;
    this.communitySize = args.communitySize;
    this.numCommunities = args.numCommunities;
  }
  /**
   * Each node in its own singleton community.
   *
   *   assignments[u] = u
   *   numCommunities = graph.n
   *   communityInternal[c] = Σ A(u, u) for u in {c} (the self-loop contribution; 0 otherwise)
   *   communityIncident[c]  = nodeWeights[c]
   */
  static singletons(graph) {
    const n = graph.n;
    const assignments = new Int32Array(n);
    for (let u = 0; u < n; u++) assignments[u] = u;
    const communityInternal = new Float64Array(n);
    const communityIncident = new Float64Array(n);
    const communitySize = new Uint32Array(n);
    for (let u = 0; u < n; u++) {
      communityIncident[u] = graph.nodeWeights[u];
      communitySize[u] = 1;
    }
    if (graph.hasSelfLoops) {
      const offsets = graph.offsets;
      const targets = graph.targets;
      const weights = graph.weights;
      for (let u = 0; u < n; u++) {
        const start = offsets[u];
        const end = offsets[u + 1];
        for (let i = start; i < end; i++) {
          if (targets[i] === u) {
            communityInternal[u] = communityInternal[u] + 2 * weights[i];
          }
        }
      }
    }
    return new _Partition({
      graph,
      assignments,
      communityInternal,
      communityIncident,
      communitySize,
      numCommunities: n
    });
  }
  /**
   * Construct from a user-supplied assignments array. Renumbers community
   * ids to be contiguous in [0, k) so the indexed accumulators have no
   * gaps. The renumbering is stable: ids encountered earlier in the
   * assignments array map to lower contiguous ids.
   *
   * @param graph        the graph being partitioned
   * @param assignments  Int32Array of length graph.n; values are arbitrary
   *                     int32 community ids (need not be contiguous or non-negative)
   *
   * @throws RangeError if assignments.length !== graph.n
   */
  static fromAssignments(graph, assignments) {
    if (assignments.length !== graph.n) {
      throw new RangeError(
        `assignments length ${assignments.length} does not match graph.n ${graph.n}`
      );
    }
    const n = graph.n;
    const renumbered = new Int32Array(n);
    const idMap = /* @__PURE__ */ new Map();
    let next = 0;
    for (let u = 0; u < n; u++) {
      const c = assignments[u];
      let nc = idMap.get(c);
      if (nc === void 0) {
        nc = next++;
        idMap.set(c, nc);
      }
      renumbered[u] = nc;
    }
    const k = next;
    const communityInternal = new Float64Array(k);
    const communityIncident = new Float64Array(k);
    const communitySize = new Uint32Array(k);
    for (let u = 0; u < n; u++) {
      const c = renumbered[u];
      communityIncident[c] = communityIncident[c] + graph.nodeWeights[u];
      communitySize[c] = communitySize[c] + 1;
    }
    const offsets = graph.offsets;
    const targets = graph.targets;
    const weights = graph.weights;
    for (let u = 0; u < n; u++) {
      const cu = renumbered[u];
      const start = offsets[u];
      const end = offsets[u + 1];
      for (let i = start; i < end; i++) {
        const v = targets[i];
        const cv = renumbered[v];
        if (cu === cv) {
          const w = weights[i];
          communityInternal[cu] = communityInternal[cu] + w;
          if (v === u) {
            communityInternal[cu] = communityInternal[cu] + w;
          }
        }
      }
    }
    return new _Partition({
      graph,
      assignments: renumbered,
      communityInternal,
      communityIncident,
      communitySize,
      numCommunities: k
    });
  }
  /**
   * Move node u from its current community to `toCommunity`, updating
   * the cached accumulators in O(degree(u)) time.
   *
   *   - If toCommunity ≥ numCommunities, expands the accumulator arrays
   *     to accommodate (rare; only happens when introducing a brand-new
   *     community id, e.g. during refinement).
   *   - If the source community becomes empty, its slot remains allocated
   *     (size 0). Renumbering happens at aggregation time, not here.
   *   - No-op if u is already in toCommunity.
   *
   * @throws RangeError if u or toCommunity are out of range
   */
  move(u, toCommunity) {
    if (!Number.isInteger(u) || u < 0 || u >= this.graph.n) {
      throw new RangeError(`u ${u} out of range [0, ${this.graph.n})`);
    }
    if (!Number.isInteger(toCommunity) || toCommunity < 0) {
      throw new RangeError(
        `toCommunity ${toCommunity} must be a non-negative integer`
      );
    }
    const fromCommunity = this.assignments[u];
    if (fromCommunity === toCommunity) return;
    if (toCommunity >= this.numCommunities) {
      throw new RangeError(
        `toCommunity ${toCommunity} \u2265 numCommunities ${this.numCommunities}; use Partition.fromAssignments to restructure communities`
      );
    }
    const offsets = this.graph.offsets;
    const targets = this.graph.targets;
    const weights = this.graph.weights;
    const start = offsets[u];
    const end = offsets[u + 1];
    let kFromInternal = 0;
    let kToInternal = 0;
    let selfLoopWeight = 0;
    for (let i = start; i < end; i++) {
      const v = targets[i];
      const w = weights[i];
      if (v === u) {
        selfLoopWeight += w;
        continue;
      }
      const cv = this.assignments[v];
      if (cv === fromCommunity) kFromInternal += w;
      else if (cv === toCommunity) kToInternal += w;
    }
    const fromInternalDelta = -2 * kFromInternal - 2 * selfLoopWeight;
    const toInternalDelta = 2 * kToInternal + 2 * selfLoopWeight;
    this.communityInternal[fromCommunity] = this.communityInternal[fromCommunity] + fromInternalDelta;
    this.communityInternal[toCommunity] = this.communityInternal[toCommunity] + toInternalDelta;
    const ku = this.graph.nodeWeights[u];
    this.communityIncident[fromCommunity] = this.communityIncident[fromCommunity] - ku;
    this.communityIncident[toCommunity] = this.communityIncident[toCommunity] + ku;
    this.communitySize[fromCommunity] = this.communitySize[fromCommunity] - 1;
    this.communitySize[toCommunity] = this.communitySize[toCommunity] + 1;
    this.assignments[u] = toCommunity;
  }
  /**
   * Modularity from cached accumulators — O(numCommunities) instead of
   * the O(m) walk that the standalone `modularity()` function does.
   *
   * Result agrees with `modularity(graph, partition.assignments)` to
   * within Kahan precision.
   *
   * @param resolution γ; default 1.0
   */
  modularity(resolution = 1) {
    const inv2m = 1 / this.graph.totalWeight;
    if (this.graph.totalWeight === 0) return 0;
    let q = 0;
    let c = 0;
    for (let comm = 0; comm < this.numCommunities; comm++) {
      const intern = this.communityInternal[comm];
      const tot = this.communityIncident[comm];
      const term = intern * inv2m - resolution * (tot * inv2m) * (tot * inv2m);
      const y = term - c;
      const t = q + y;
      c = t - q - y;
      q = t;
    }
    return q;
  }
  /** Deep copy — independent typed-array buffers, same graph reference. */
  copy() {
    return new _Partition({
      graph: this.graph,
      assignments: new Int32Array(this.assignments),
      communityInternal: new Float64Array(this.communityInternal),
      communityIncident: new Float64Array(this.communityIncident),
      communitySize: new Uint32Array(this.communitySize),
      numCommunities: this.numCommunities
    });
  }
};

// src/internal/quality.ts
var Modularity = class {
  kind = "modularity";
  resolution;
  constructor(resolution = 1) {
    if (!Number.isFinite(resolution)) {
      throw new RangeError(`resolution must be finite; got ${String(resolution)}`);
    }
    this.resolution = resolution;
  }
  compute(_graph, partition) {
    return partition.modularity(this.resolution);
  }
  delta(args) {
    const { graph, partition, u, fromCommunity, toCommunity, kuToFrom, kuToTo, selfLoopWeight } = args;
    if (fromCommunity === toCommunity) return 0;
    const m2 = graph.totalWeight;
    if (m2 === 0) return 0;
    const ku = graph.nodeWeights[u];
    const totFrom = partition.communityIncident[fromCommunity];
    const totTo = partition.communityIncident[toCommunity];
    const internalDelta = 2 * (kuToTo - kuToFrom) / m2;
    void selfLoopWeight;
    const penaltyDelta = -this.resolution * 2 * ku * (totTo - totFrom + ku) / (m2 * m2);
    return internalDelta + penaltyDelta;
  }
};

// src/prng.ts
var STATE_LEN = 4;
function expandSeed(seed) {
  let z = (seed | 0) >>> 0;
  if (z === 0) z = 2654435769;
  const state = new Uint32Array(STATE_LEN);
  for (let i = 0; i < STATE_LEN; i++) {
    z = z + 2654435769 | 0;
    let v = z;
    v = Math.imul(v ^ v >>> 16, 2246822507);
    v = Math.imul(v ^ v >>> 13, 3266489909);
    v = (v ^ v >>> 16) >>> 0;
    state[i] = v;
  }
  return state;
}
var Xoshiro128 = class {
  s;
  constructor(seed) {
    if (!Number.isFinite(seed)) {
      throw new RangeError(
        `seed must be a finite number; got ${String(seed)}`
      );
    }
    this.s = expandSeed(Math.trunc(seed));
  }
  /**
   * Advance the state and return a Uint32 in [0, 2³²).
   *
   * Implementation is the canonical xoshiro128** algorithm with the
   * `**` (star-star) scrambler:
   *   result = rotl(s[1] * 5, 7) * 9
   * State update mixes via xor + left rotations.
   */
  nextUint32() {
    const s = this.s;
    const s0 = s[0];
    const s1 = s[1];
    const s2 = s[2];
    const s3 = s[3];
    const r = Math.imul(s1, 5);
    const result = Math.imul((r << 7 | r >>> 25) >>> 0, 9) >>> 0;
    const t = s1 << 9 >>> 0;
    s[2] = (s2 ^ s0) >>> 0;
    s[3] = (s3 ^ s1) >>> 0;
    s[1] = (s1 ^ s[2]) >>> 0 >>> 0;
    s[0] = (s0 ^ s[3]) >>> 0 >>> 0;
    s[2] = (s[2] ^ t) >>> 0;
    s[3] = (s[3] << 11 | s[3] >>> 21) >>> 0;
    return result;
  }
  /**
   * Float64 in [0, 1). Uses the high 24 bits of one Uint32 draw — IEEE 754
   * has 53 bits of mantissa, but standard practice for [0,1) PRNGs uses
   * 24 or 53 bits. 24 is sufficient for shuffling and tie-breaking.
   *
   * For graph algorithms where bias matters, `nextIntExclusive(n)` is
   * the right primitive — do not derive integers from `nextFloat()` by
   * `Math.floor(nextFloat() * n)`, which biases for non-power-of-2 n.
   */
  nextFloat() {
    return (this.nextUint32() >>> 8) / 16777216;
  }
  /**
   * Uniform integer in [0, n). Unbiased — uses rejection sampling on
   * the underlying Uint32 to eliminate modulo bias for non-power-of-2 n.
   *
   * @throws RangeError if n is not a positive integer ≤ 2³²
   */
  nextIntExclusive(n) {
    if (!Number.isInteger(n) || n <= 0 || n > 4294967296) {
      throw new RangeError(
        `n must be a positive integer in [1, 2^32]; got ${String(n)}`
      );
    }
    if (n === 1) return 0;
    if (n <= 2147483648) {
      const mask = n - 1;
      if ((n & mask) === 0) {
        return this.nextUint32() & mask;
      }
      const threshold = (4294967296 - n) % n >>> 0;
      let x = this.nextUint32();
      while (x < threshold) x = this.nextUint32();
      return x % n;
    }
    while (true) {
      const x = this.nextUint32();
      if (x < n) return x;
    }
  }
  /**
   * Fisher–Yates shuffle in place over a Uint32Array. Single allocation:
   * none. Deterministic given seed.
   */
  shuffleUint32(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextIntExclusive(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }
  /**
   * Snapshot the internal state. Useful for tests that need to verify
   * deterministic stream identity.
   */
  snapshot() {
    return new Uint32Array(this.s);
  }
};
var DEFAULT_SEED = 42;

// src/localMove.ts
var ConvergenceError = class extends Error {
  iterations;
  lastModularity;
  constructor(iterations, lastModularity) {
    super(
      `localMove did not converge after ${iterations} iterations (last Q=${lastModularity.toFixed(6)}); increase maxIterations or investigate the input graph`
    );
    this.name = "ConvergenceError";
    this.iterations = iterations;
    this.lastModularity = lastModularity;
  }
};
function localMove(graph, initial, options) {
  const resolution = options?.resolution ?? 1;
  const seed = options?.seed ?? DEFAULT_SEED;
  const tolerance = options?.tolerance ?? Number.EPSILON * 16;
  const maxIterations = options?.maxIterations ?? 100;
  const quality = options?.quality ?? new Modularity(resolution);
  if (!Number.isFinite(resolution)) {
    throw new RangeError(`resolution must be finite; got ${String(resolution)}`);
  }
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new RangeError(
      `tolerance must be a non-negative finite number; got ${String(tolerance)}`
    );
  }
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new RangeError(
      `maxIterations must be a positive integer; got ${String(maxIterations)}`
    );
  }
  const partition = initial ?? Partition.singletons(graph);
  const order = new Uint32Array(graph.n);
  for (let u = 0; u < graph.n; u++) order[u] = u;
  const prng = new Xoshiro128(seed);
  prng.shuffleUint32(order);
  const cap = Math.max(graph.n, 8);
  const neighborCommBuf = new Uint32Array(cap);
  const neighborCommWeight = new Float64Array(cap);
  const communityTouched = new Uint8Array(cap);
  const tiedBuf = new Uint32Array(cap);
  let totalMoves = 0;
  let iterations = 0;
  for (iterations = 1; iterations <= maxIterations; iterations++) {
    let movesThisPass = 0;
    for (let visitIdx = 0; visitIdx < order.length; visitIdx++) {
      const u = order[visitIdx];
      const fromCommunity = partition.assignments[u];
      const offsets = graph.offsets;
      const targets = graph.targets;
      const weights = graph.weights;
      const start = offsets[u];
      const end = offsets[u + 1];
      let touchedCount = 0;
      let selfLoopWeight = 0;
      neighborCommBuf[touchedCount] = fromCommunity;
      neighborCommWeight[fromCommunity] = 0;
      communityTouched[fromCommunity] = 1;
      touchedCount++;
      for (let i = start; i < end; i++) {
        const v = targets[i];
        const w = weights[i];
        if (v === u) {
          selfLoopWeight += w;
          continue;
        }
        const cv = partition.assignments[v];
        if (communityTouched[cv] === 0) {
          neighborCommBuf[touchedCount] = cv;
          neighborCommWeight[cv] = w;
          communityTouched[cv] = 1;
          touchedCount++;
        } else {
          neighborCommWeight[cv] = neighborCommWeight[cv] + w;
        }
      }
      const kuToFrom = neighborCommWeight[fromCommunity];
      let bestDelta = 0;
      let tiedCount = 1;
      tiedBuf[0] = fromCommunity;
      for (let i = 0; i < touchedCount; i++) {
        const cand = neighborCommBuf[i];
        if (cand === fromCommunity) continue;
        const kuToCand = neighborCommWeight[cand];
        const dq = quality.delta({
          graph,
          partition,
          u,
          fromCommunity,
          toCommunity: cand,
          kuToFrom,
          kuToTo: kuToCand,
          selfLoopWeight
        });
        if (dq > bestDelta + tolerance * Math.max(Math.abs(bestDelta), 1)) {
          bestDelta = dq;
          tiedCount = 1;
          tiedBuf[0] = cand;
        } else if (Math.abs(dq - bestDelta) <= tolerance * Math.max(Math.abs(bestDelta), 1)) {
          tiedBuf[tiedCount] = cand;
          tiedCount++;
        }
      }
      for (let i = 0; i < touchedCount; i++) {
        const c = neighborCommBuf[i];
        communityTouched[c] = 0;
        neighborCommWeight[c] = 0;
      }
      if (bestDelta <= tolerance * Math.max(Math.abs(bestDelta), 1)) {
        continue;
      }
      const pick = tiedCount === 1 ? tiedBuf[0] : tiedBuf[prng.nextIntExclusive(tiedCount)];
      partition.move(u, pick);
      movesThisPass++;
      totalMoves++;
    }
    if (movesThisPass === 0) break;
  }
  if (iterations > maxIterations) {
    throw new ConvergenceError(maxIterations, partition.modularity(resolution));
  }
  return {
    partition,
    iterations,
    modularity: partition.modularity(resolution),
    moves: totalMoves
  };
}

// src/refine.ts
function refine(graph, parent, options) {
  if (parent.graph !== graph) {
    throw new RangeError("parent partition does not belong to graph");
  }
  const resolution = options?.resolution ?? 1;
  const seed = options?.seed ?? DEFAULT_SEED;
  const randomness = options?.randomness ?? 1e-3;
  const tolerance = options?.tolerance ?? Number.EPSILON * 16;
  if (!Number.isFinite(resolution)) {
    throw new RangeError(`resolution must be finite; got ${String(resolution)}`);
  }
  if (!Number.isFinite(randomness) || randomness <= 0) {
    throw new RangeError(
      `randomness must be a positive finite number; got ${String(randomness)}`
    );
  }
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new RangeError(
      `tolerance must be a non-negative finite number; got ${String(tolerance)}`
    );
  }
  const refined = Partition.singletons(graph);
  const quality = new Modularity(resolution);
  const prng = new Xoshiro128(seed);
  const m2 = graph.totalWeight;
  const beta = 1 / randomness;
  const n = graph.n;
  const nodesByParent = bucketize(parent);
  const touchedBuf = new Uint32Array(n);
  const touchedWeight = new Float64Array(n);
  const touchedFlag = new Uint8Array(n);
  const candidateBuf = new Uint32Array(n);
  const candidateValue = new Float64Array(n);
  let totalMerges = 0;
  for (let S = 0; S < parent.numCommunities; S++) {
    if (parent.communitySize[S] <= 1) continue;
    const nodes = nodesByParent[S];
    if (nodes === void 0 || nodes.length === 0) continue;
    prng.shuffleUint32(nodes);
    const sumS = parent.communityIncident[S];
    for (let visitIdx = 0; visitIdx < nodes.length; visitIdx++) {
      const v = nodes[visitIdx];
      const vRefined = refined.assignments[v];
      if (refined.communitySize[vRefined] !== 1) continue;
      const start = graph.offsets[v];
      const end = graph.offsets[v + 1];
      let touchedCount = 0;
      let edgesToS = 0;
      let selfLoopWeight = 0;
      for (let i = start; i < end; i++) {
        const u = graph.targets[i];
        const w = graph.weights[i];
        if (u === v) {
          selfLoopWeight += w;
          continue;
        }
        if (parent.assignments[u] !== S) continue;
        edgesToS += w;
        const c = refined.assignments[u];
        if (touchedFlag[c] === 0) {
          touchedBuf[touchedCount] = c;
          touchedWeight[c] = w;
          touchedFlag[c] = 1;
          touchedCount++;
        } else {
          touchedWeight[c] = touchedWeight[c] + w;
        }
      }
      const kv = graph.nodeWeights[v];
      const wellConnectedThreshold = resolution * kv * (sumS - kv) / m2;
      if (edgesToS < wellConnectedThreshold) {
        for (let i = 0; i < touchedCount; i++) {
          const c = touchedBuf[i];
          touchedFlag[c] = 0;
          touchedWeight[c] = 0;
        }
        continue;
      }
      let candidateCount = 0;
      let bestDelta = 0;
      for (let i = 0; i < touchedCount; i++) {
        const cand = touchedBuf[i];
        if (cand === vRefined) continue;
        const kuToTo = touchedWeight[cand];
        const dq = quality.delta({
          graph,
          partition: refined,
          u: v,
          fromCommunity: vRefined,
          toCommunity: cand,
          kuToFrom: 0,
          kuToTo,
          selfLoopWeight
        });
        if (dq > tolerance * Math.max(Math.abs(bestDelta), 1)) {
          candidateBuf[candidateCount] = cand;
          candidateValue[candidateCount] = dq;
          candidateCount++;
          if (dq > bestDelta) bestDelta = dq;
        }
      }
      for (let i = 0; i < touchedCount; i++) {
        const c = touchedBuf[i];
        touchedFlag[c] = 0;
        touchedWeight[c] = 0;
      }
      if (candidateCount === 0) continue;
      let weightSum = 0;
      for (let i = 0; i < candidateCount; i++) {
        const dq = candidateValue[i];
        const w = Math.exp((dq - bestDelta) * beta);
        candidateValue[i] = w;
        weightSum += w;
      }
      let pick = candidateBuf[0];
      if (candidateCount > 1) {
        const u = prng.nextFloat() * weightSum;
        let acc = 0;
        for (let i = 0; i < candidateCount; i++) {
          acc += candidateValue[i];
          if (acc >= u) {
            pick = candidateBuf[i];
            break;
          }
        }
      }
      refined.move(v, pick);
      totalMerges++;
    }
  }
  const parentOfRefined = new Int32Array(refined.numCommunities).fill(-1);
  for (let u = 0; u < n; u++) {
    const r = refined.assignments[u];
    const cur = parentOfRefined[r];
    if (cur === -1) {
      parentOfRefined[r] = parent.assignments[u];
    }
  }
  return {
    refined,
    parentOfRefined,
    merges: totalMerges
  };
}
function bucketize(parent) {
  const k = parent.numCommunities;
  const counts = new Uint32Array(k);
  for (let u = 0; u < parent.assignments.length; u++) {
    const c = parent.assignments[u];
    counts[c] = counts[c] + 1;
  }
  const buckets = new Array(k);
  for (let c = 0; c < k; c++) {
    const ct = counts[c];
    if (ct > 0) buckets[c] = new Uint32Array(ct);
  }
  const cursor = new Uint32Array(k);
  for (let u = 0; u < parent.assignments.length; u++) {
    const c = parent.assignments[u];
    const bucket = buckets[c];
    if (bucket !== void 0) {
      bucket[cursor[c]] = u;
      cursor[c] = cursor[c] + 1;
    }
  }
  return buckets;
}

// src/aggregate.ts
var MAX_SUPER_NODE_COUNT = 65535;
function aggregate(graph, refined, parentOfRefined) {
  if (refined.graph !== graph) {
    throw new RangeError("refined partition does not belong to graph");
  }
  if (parentOfRefined.length !== refined.numCommunities) {
    throw new RangeError(
      `parentOfRefined length ${parentOfRefined.length} does not match refined.numCommunities ${refined.numCommunities}`
    );
  }
  const n = graph.n;
  const oldToNew = new Int32Array(refined.numCommunities).fill(-1);
  let k = 0;
  for (let c = 0; c < refined.numCommunities; c++) {
    if (refined.communitySize[c] > 0) {
      oldToNew[c] = k;
      k++;
    }
  }
  if (k > MAX_SUPER_NODE_COUNT) {
    throw new RangeError(
      `super-graph node count ${k} exceeds ${MAX_SUPER_NODE_COUNT}; the numeric edge-key scheme would overflow Uint32. Reduce graph size or implement a BigInt-keyed fallback.`
    );
  }
  const superNodeOf = new Int32Array(n);
  for (let u = 0; u < n; u++) {
    superNodeOf[u] = oldToNew[refined.assignments[u]];
  }
  const selfLoopWeights = new Float64Array(k);
  const edgeMap = /* @__PURE__ */ new Map();
  for (let u = 0; u < n; u++) {
    const sup_u = superNodeOf[u];
    const start = graph.offsets[u];
    const end = graph.offsets[u + 1];
    for (let i = start; i < end; i++) {
      const v = graph.targets[i];
      if (v < u) continue;
      const w = graph.weights[i];
      const sup_v = superNodeOf[v];
      if (sup_u === sup_v) {
        selfLoopWeights[sup_u] = selfLoopWeights[sup_u] + w;
      } else {
        const lo = sup_u < sup_v ? sup_u : sup_v;
        const hi = sup_u < sup_v ? sup_v : sup_u;
        const key = lo * k + hi;
        edgeMap.set(key, (edgeMap.get(key) ?? 0) + w);
      }
    }
  }
  const edges = [];
  for (let s = 0; s < k; s++) {
    const w = selfLoopWeights[s];
    if (w > 0) edges.push([s, s, w]);
  }
  for (const [key, w] of edgeMap) {
    const lo = Math.floor(key / k);
    const hi = key % k;
    edges.push([lo, hi, w]);
  }
  const superGraph = Graph.fromEdgeList(k, edges, {
    selfLoops: "allow",
    validate: false
  });
  const refinedOfSuper = new Int32Array(k);
  for (let c = 0; c < refined.numCommunities; c++) {
    const newId = oldToNew[c];
    if (newId !== -1) refinedOfSuper[newId] = c;
  }
  const newAssignments = new Int32Array(k);
  for (let s = 0; s < k; s++) {
    const refinedId = refinedOfSuper[s];
    newAssignments[s] = parentOfRefined[refinedId];
  }
  const newPartition = Partition.fromAssignments(superGraph, newAssignments);
  return {
    graph: superGraph,
    partition: newPartition,
    superNodeOf
  };
}

// src/leiden.ts
var LeidenConvergenceError = class extends Error {
  levels;
  lastModularity;
  constructor(levels, lastModularity) {
    super(
      `leiden did not converge after ${levels} levels (last Q=${lastModularity.toFixed(6)}); increase maxLevels or investigate the input graph`
    );
    this.name = "LeidenConvergenceError";
    this.levels = levels;
    this.lastModularity = lastModularity;
  }
};
function leiden(graph, options) {
  const resolution = options?.resolution ?? 1;
  const seed = options?.seed ?? DEFAULT_SEED;
  const randomness = options?.randomness ?? 1e-3;
  const tolerance = options?.tolerance ?? Number.EPSILON * 16;
  const maxLevels = options?.maxLevels ?? 100;
  const maxLocalMoveIterations = options?.maxLocalMoveIterations ?? 1e3;
  if (!Number.isFinite(resolution)) {
    throw new RangeError(`resolution must be finite; got ${String(resolution)}`);
  }
  if (!Number.isFinite(randomness) || randomness <= 0) {
    throw new RangeError(
      `randomness must be a positive finite number; got ${String(randomness)}`
    );
  }
  if (!Number.isInteger(maxLevels) || maxLevels < 1) {
    throw new RangeError(
      `maxLevels must be a positive integer; got ${String(maxLevels)}`
    );
  }
  if (options?.initialPartition !== void 0 && options.initialPartition.graph !== graph) {
    throw new RangeError("initialPartition does not belong to graph");
  }
  let currentGraph = graph;
  let currentPartition = options?.initialPartition !== void 0 ? options.initialPartition.copy() : Partition.singletons(graph);
  const originalToCurrent = new Int32Array(graph.n);
  for (let u = 0; u < graph.n; u++) originalToCurrent[u] = u;
  let levelSeed = seed | 0;
  let totalMoves = 0;
  let totalMerges = 0;
  let levels = 0;
  for (levels = 0; levels < maxLevels; levels++) {
    const lmResult = localMove(currentGraph, currentPartition, {
      resolution,
      seed: levelSeed,
      tolerance,
      maxIterations: maxLocalMoveIterations
    });
    totalMoves += lmResult.moves;
    currentPartition = lmResult.partition;
    if (lmResult.moves === 0 || isAllSingletons(currentPartition)) {
      levels++;
      break;
    }
    const rfResult = refine(currentGraph, currentPartition, {
      resolution,
      seed: levelSeed ^ 1431655765,
      // distinct stream from localMove
      randomness,
      tolerance
    });
    totalMerges += rfResult.merges;
    const agg = aggregate(currentGraph, rfResult.refined, rfResult.parentOfRefined);
    for (let u = 0; u < graph.n; u++) {
      const cur = originalToCurrent[u];
      originalToCurrent[u] = agg.superNodeOf[cur];
    }
    currentGraph = agg.graph;
    currentPartition = agg.partition;
    levelSeed = Math.imul(levelSeed, 2654435769) ^ levels | 0;
  }
  if (levels >= maxLevels) {
    const finalQ = projectAndScore(graph, currentPartition, originalToCurrent, resolution);
    throw new LeidenConvergenceError(levels, finalQ);
  }
  const finalAssignments = new Int32Array(graph.n);
  for (let u = 0; u < graph.n; u++) {
    finalAssignments[u] = currentPartition.assignments[originalToCurrent[u]];
  }
  const finalPartition = Partition.fromAssignments(graph, finalAssignments);
  return {
    partition: finalPartition,
    modularity: finalPartition.modularity(resolution),
    levels,
    totalMoves,
    totalMerges
  };
}
function isAllSingletons(partition) {
  for (let c = 0; c < partition.numCommunities; c++) {
    if (partition.communitySize[c] >= 2) return false;
  }
  return true;
}
function projectAndScore(graph, currentPartition, originalToCurrent, resolution) {
  const finalAssignments = new Int32Array(graph.n);
  for (let u = 0; u < graph.n; u++) {
    finalAssignments[u] = currentPartition.assignments[originalToCurrent[u]];
  }
  const finalPartition = Partition.fromAssignments(graph, finalAssignments);
  return finalPartition.modularity(resolution);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ConvergenceError,
  DEFAULT_SEED,
  Graph,
  GraphValidationError,
  LeidenConvergenceError,
  Partition,
  Xoshiro128,
  aggregate,
  leiden,
  localMove,
  modularity,
  refine
});
