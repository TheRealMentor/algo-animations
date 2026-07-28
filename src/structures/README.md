# Adding a data structure

The taxonomy is **Data Structure → Category → Algorithm**:

```
Arrays   → Sorting          → Bubble Sort, Merge Sort, Quick Sort
         → Searching        → Binary Search
Strings  → Pattern Matching → Naive Search, Rabin-Karp, KMP
Trees    → Traversal        → …          (not built)
         → Searching        → …
```

`src/core/` is generic over all of it. Adding a structure means writing one folder and
appending one line to [registry.ts](registry.ts) — the nav, picker, player, profiler, growth
chart, and doubling table all read from that list and need no changes.

Use [`arrays/`](arrays/) and [`strings/`](strings/) as worked examples — deliberately two, and
deliberately different shapes of problem. Arrays are value-based (a bar's height is the value)
with a natural sorted/reversed axis. Strings are identity-based (a character has no magnitude —
`StringView` is a role-coloured grid, not bars) with no such axis; its "shapes" instead control
how often the pattern recurs. Adding strings touched zero lines in `core/` or `components/`,
which is the actual proof the abstraction holds, not just the design intent.

## The folder

```
src/structures/<name>/
  model.ts        events, visual state, initial state, applyEvent, role resolution
  data.ts         input generators + the shapes this structure offers
  <Name>View.tsx  the renderer + its legend
  algorithms/     one file per algorithm, each exporting an AlgorithmSpec
  index.ts        the DataStructure object tying it together
```

## What the `DataStructure` must provide

Full type in [`core/types.ts`](../core/types.ts). The parts that need thought:

| Field | Notes |
| --- | --- |
| `categories` | Your groupings, e.g. `traversal`, `searching`. Empty ones are hidden automatically. |
| `shapes` | Input shapes. Arrays offer sorted/reversed/…; strings offer repetitive/no-match/many-matches instead (there's no "sorted" for text — the axis that matters is how the pattern recurs). This is where best vs worst case becomes visible, so make the pathological shape reachable. |
| `makeInput` | Builds the input. Gets `trial`, which **must** vary the input when `profileTrials > 1` — otherwise profiling measures the same run N times. |
| `cloneInput` | Algorithms mutate their input; the engine needs a private copy. Deep enough to actually isolate — trivial for strings (JS strings are immutable, so `cloneInput` is just a passthrough), not for anything holding arrays or object graphs. |
| `initialState` / `applyEvent` | Your visual model. `applyEvent` mutates in place. Do **not** tally counters here — the engine does that. |
| `View` / `Legend` | `View` gets `{ state, cursor }`. It must read `state` fresh on every render (see below). |
| `minN` / `maxN` | A legibility limit for the animated view, not a performance one. Strings caps lower than arrays (160 vs 220) because a character needs real width to stay legible; a bar can get arbitrarily thin without losing its meaning. |
| `secondaryStat` (on `AlgorithmSpec`, optional) | The second stat tile in the Visualizer. Defaults to swaps — right for sorts, meaningless for anything that never swaps. Override per algorithm (`{ label, value: (c: Counters) => number }`) rather than adding another structure-shaped conditional to `Visualizer.tsx`. |

## Rules that will bite you

1. **One implementation per algorithm.** Write the algorithm once as a generator yielding
   events. The player and the profiler both replay that stream. Never write a separate
   "fast counting" version — that is the one change that breaks the guarantee the whole
   design exists for, and there is a test pinning it.

2. **Reuse the shared cost vocabulary, but only for things that actually cost the same.**
   Emit `compare`, `compareTarget`, `swap`, `write`, and `read` and your algorithm is counted,
   charted, profiled, and classified for free — but pick the literal that matches the real
   cost, not the one that's visually convenient. Rabin-Karp's O(1) rolling-hash check is
   emitted as a `read`, not a `compare`, precisely because it is cheaper than a character
   comparison — tallying it as a `compare` would erase the one thing that makes hashing worth
   doing. A genuinely new cost unit goes in `tallyEvent` in `core/types.ts` — that one function
   is the only place operation costs are defined.

3. **Preprocessing is not free.** KMP's failure-table build is real character comparisons
   (pattern against itself) and is emitted as real `compare` events before the main scan even
   starts, the same way merge sort's aux-buffer copy is real reads and writes. If your
   algorithm does setup work, the profiler needs to see it — don't let it happen outside the
   event stream just because it's "just setup."

4. **`colorSlot` is globally unique and never recycled.** Slots come from a CVD-validated
   palette where the *order* is the colourblind-safety mechanism. Take the next free number
   across all structures and add the matching `--series-N` light/dark pair in `index.css`.
   A test enforces uniqueness. (Arrays used 1–4; strings took 5–7; the next structure starts
   at 8, the last slot in the documented palette — a ninth series folds into "Other" rather
   than generating a new hue.)

5. **Never memoise your `View`.** `seek` mutates and returns the same state object on the
   forward path, so re-renders ride on the `cursor` prop changing. `React.memo` without
   `cursor` freezes the animation.

6. **Watch generator recursion depth.** `yield*` delegation costs a stack frame per nesting
   level *per event*, so a structure that recurses O(n) deep degrades to O(depth) per event
   and eventually overflows. Merge sort recurses safely at O(log n) depth; quick sort uses an
   explicit stack precisely because its depth can reach n. Anything tree-shaped that can
   degenerate needs the same treatment.

7. **If your structure has two size parameters, decide how they scale together, and say so.**
   Strings has both text length (n) and pattern length (m); `patternLength(n)` derives m as a
   fixed fraction of n, applied identically across every shape, specifically so the single
   "Items" slider still means one thing and Naive Search's O(n·m) worst case actually renders
   as a visible quadratic curve rather than a linear one with a bigger constant. A tree
   structure with both node count and depth will face the same decision — make it deliberately
   and document it, don't let it fall out of whatever the input generator happens to do.

## Wiring it up

```ts
// src/structures/registry.ts
import { trees } from './trees'

export const STRUCTURES: AnyDataStructure[] = [arrays, strings, trees]
```

Then add tests. The `structure registry` block in
[`arrays/arrays.test.ts`](arrays/arrays.test.ts) is parameterised over `STRUCTURES`, so your
new structure is immediately checked for category/id/colour-slot consistency and for
`makeInput`/`cloneInput` isolation the moment it is registered. Algorithm correctness (does it
actually sort / actually find the pattern / actually find the node) is yours to write — for
strings that meant an independent brute-force oracle in
[`strings/strings.test.ts`](strings/strings.test.ts) that KMP and Rabin-Karp's results are
checked against, rather than trusting either implementation to grade itself.
