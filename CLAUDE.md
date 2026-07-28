# Algorithm Playground

An interactive playground for watching algorithms run, and for scaling the input until the
cost curve makes the complexity class obvious. React 19 + TypeScript + Vite.

Two views:

- **Visualizer** — step/scrub through one algorithm at small n, with live operation counters.
- **Complexity Lab** — runs the same algorithms headlessly at doubling sizes and plots measured
  work against theoretical curves.

## Commands

```bash
npm run dev
```

```bash
npm test
```

`npm run build` (tsc + vite), `npm run typecheck`, `npm run test:watch`. Dev server is on
port 5173; `.claude/launch.json` has a `dev` entry for the preview browser.

## Taxonomy

**Data Structure → Category → Algorithm.**

```
Arrays   → Sorting          → Bubble Sort, Merge Sort, Quick Sort
         → Searching        → Binary Search
Strings  → Pattern Matching → Naive Search, Rabin-Karp, KMP
Trees    → …                (not built)
```

```
src/
  core/            structure-agnostic engine — generic over state & event types
    types.ts       Counters, BaseEvent, AlgorithmSpec, DataStructure, tallyEvent
    player.ts      buildTimeline / seek / applyEvent
    usePlayer.ts   playback (rAF, scrub, speed)
    complexity.ts  headless profiling, curve fitting, growth classification
  structures/
    registry.ts    STRUCTURES — the one list the whole app reads
    README.md      how to add a structure (read this before adding one)
    arrays/        model.ts, data.ts, ArrayView.tsx, algorithms/, index.ts
    strings/       model.ts, data.ts, StringView.tsx, algorithms/, index.ts
  components/      Visualizer, ComplexityLab, GrowthChart — all structure-agnostic
```

Adding `strings/` touched zero lines in `core/` or `components/` — it only needed the folder plus
one line in `registry.ts`, plus three CSS series slots. That is the abstraction actually holding
up under a second, structurally different data structure (no magnitude to draw as a bar, no
sorted/reversed shapes), not just holding up in theory.

Adding a data structure touches **two** things: a new folder under `src/structures/`, and one
line in `registry.ts`. Nothing in `core/` or `components/` should need to change — if it does,
the abstraction is wrong and that's worth fixing rather than working around.
**[src/structures/README.md](src/structures/README.md) is the checklist.**

## The one architectural rule

**Each algorithm is implemented exactly once**, as a generator that mutates its input and yields
a stream of events. Two consumers replay that same stream:

| Consumer | File | What it does |
| --- | --- | --- |
| Player | [src/core/player.ts](src/core/player.ts) | Rebuilds visual state for the view |
| Profiler | [src/core/complexity.ts](src/core/complexity.ts) | Ignores visuals, just tallies |

The animation and the growth chart therefore *cannot* disagree — they come from one execution
path.

**Do not write a separate "fast counting" version of an algorithm for the Complexity Lab.** That
is the one change that would break the guarantee the whole design exists to provide. If profiling
is too slow, cap `maxN` or make the generator cheaper — don't fork it. There is a test enforcing
this (`player replay › replayed state matches real execution`).

Operation costs are defined in exactly one place: `tallyEvent` in `core/types.ts`. Emit the shared
vocabulary (`compare`, `compareTarget`, `swap`, `write`, `read`) and a new algorithm is counted,
charted, profiled, and classified for free.

## Colour is not decorative here

`--series-1..4` come from a CVD-validated palette. **The slot order is the colourblind-safety
mechanism**, not a style choice — adjacent slots are the pairs that were checked for separation.

- `colorSlot` is unique across *all* structures, assigned in order, never recycled. A test enforces it.
- Colour follows the algorithm, never its rank. Deselecting merge sort must not repaint quick sort —
  `ComplexityLab` filters `structure.algorithms` rather than tracking click order specifically for this.
- Every chart has a legend and a table view. Colour never carries meaning alone.

Bar-role colours (`--bar-*`) are semantic state, not series identity, and always ship with a legend.

## Things that will bite you

- **`seek()` mutates and returns the same state object** on the forward path. Re-renders are driven
  by the `cursor` state change, not by reference identity. Don't wrap a structure's `View` in
  `React.memo` without also passing `cursor` — it will go stale mid-animation. This is why
  `ArrayView` takes a `cursor` prop it never reads.
- **Quick sort uses an explicit stack, not recursion.** `yield*` delegation costs a stack frame per
  nesting level *per event*, so a recursive version degrades to O(depth) per event and blows the
  stack on sorted input at large n. Merge sort recurses safely because its depth is O(log n).
  Anything tree-shaped that can degenerate needs the same treatment.
- **Quick sort's last-element pivot is deliberate.** Median-of-three would be better code and worse
  teaching — the sorted-input worst case is the most instructive thing in the Lab. Don't "fix" it.
- **Bubble sort's early exit is load-bearing.** Without it, best and worst case are both O(n²) and
  the "Sorted" shape stops demonstrating anything.
- **Merge sort renders a second "aux" row on purpose.** During a merge the main array is being
  overwritten while comparisons happen against the copy; highlighting comparison indices on the main
  row would highlight values that were already overwritten. `region: 'aux'` keeps it honest.
- **`makeInput` receives a `trial` index and must use it** when `profileTrials > 1`. Binary search
  averages over 240 runs; if every trial got the same target, the "average case" would be one lookup
  measured 240 times.
- **Shape hints are written for sorts.** They describe what a shape does to a sorting algorithm, so
  they're misleading next to a search — `Visualizer` swaps in different copy when
  `requiresSortedInput` locks the shape.
- **Don't classify growth with fixed ratio bands.** At playground sizes, n log n doubles by ~2.22
  and linear by exactly 2.00. `classifyRatio` compares against each model's *actual* predicted ratio
  between the two specific sizes and picks the nearest. A hardcoded cutoff mislabels merge sort.
- **A linear axis's top tick must be ≥ the data max.** Stopping at the last round number below the
  max clips the tallest series off the chart (this was a real bug in `linearTicks`).
- **String pattern length scales with text length, uniformly across shapes** (`patternLength` in
  `strings/data.ts`, currently 20% of n). With `m` held fixed instead, Naive Search's textbook
  O(n·m) worst case would render as O(n) with a bigger constant — the quadratic curve you can
  actually watch bend on the 'Repetitive' shape depends on `m` growing with `n`.
- **A hash check is a `read`, not a `compare`.** Rabin-Karp's whole advantage is that most windows
  are rejected in O(1) via the rolling hash, without ever touching a real character. Tallying that
  check as a comparison would make Rabin-Karp look exactly as expensive as Naive Search, which is
  the one thing it categorically isn't.
- **KMP's LPS-table build is real work and is counted.** It's emitted as genuine `compare` events
  (`scope: 'lps'`, pattern against itself), the same way merge sort's aux-buffer copy is real reads
  and writes — a generator is not allowed to do free setup that the profiler doesn't see.

## Verifying a change

`npm test` covers the algorithms, the replay invariant, the measured growth classes, and the
structure-registry contract — run it first, it's fast. The registry tests are parameterised over
`STRUCTURES`, so a new structure is held to the same contract the moment it's registered.

Tests can't see layout, so for any UI change also load the app and look:

1. Play bubble sort; sorted bars accumulate from the right and counters tick.
2. Switch to merge sort; the buffer row appears and swaps stay at 0.
3. Binary search; shape select locks to Sorted, the target caption shows, probe highlights.
4. Switch to Strings; play Naive Search, then KMP — the pattern row and (KMP-only) LPS row track
   the text row's current alignment.
5. Complexity Lab, sorted input: bubble reads `≈ n`, merge `≈ n log n`, quick `≈ n²`.
6. Complexity Lab, Strings, 'Repetitive' shape: Naive Search bends to `≈ n²` while KMP and
   Rabin-Karp stay flat — this is the whole reason the trio was chosen.
7. Select algorithms from two categories; the mixed-scale warning appears.
8. Toggle log scale and the theme; check both modes.

## Scope

Deliberately a teaching tool. Arrays and Strings are built; Trees is the planned next structure and
the architecture is built for it. The graph algorithms (BFS/DFS/Kruskal) from this repo's previous
life are in git history at `3a82dd4` if you want the old Cytoscape implementations for reference
when porting them into the event-stream architecture — they'd most naturally land as a Trees or
Graphs structure's traversal category.
