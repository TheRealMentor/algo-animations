# Algorithm Playground

Watch an algorithm run, then scale the input until you can *see* its complexity class.

Most algorithm visualisers stop at the animation, which shows you the mechanism but not the cost.
This one has two halves: a step-by-step visualizer at small n, and a **Complexity Lab** that runs
the same code at doubling input sizes and plots what it actually did.

## What's in it

Algorithms are organised by the data structure they operate on, then by what they do —
**Arrays → Sorting → Bubble Sort**, and so on. Trees are the planned next structure.

### Arrays

| Category | Algorithm | Best | Average | Worst | Space |
| --- | --- | --- | --- | --- | --- |
| Sorting | Bubble Sort | O(n) | O(n²) | O(n²) | O(1) |
| Sorting | Merge Sort | O(n log n) | O(n log n) | O(n log n) | O(n) |
| Sorting | Quick Sort | O(n log n) | O(n log n) | O(n²) | O(log n) |
| Searching | Binary Search | O(1) | O(log n) | O(log n) | O(1) |

### Strings

n is text length, m is pattern length (m scales with n in this playground, so the doubling table
stays meaningful — see "How it works" below).

| Category | Algorithm | Best | Average | Worst | Space |
| --- | --- | --- | --- | --- | --- |
| Pattern Matching | Naive Search | O(n) | O(n) | O(n·m) | O(1) |
| Pattern Matching | Rabin-Karp | O(n+m) | O(n+m) | O(n·m) | O(1) |
| Pattern Matching | KMP | O(n+m) | O(n+m) | O(n+m) | O(m) |

## Running it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

## Visualizer

Bars for the array, one colour per operation — comparing, swapping, pivot, settled. Play, pause,
step one operation at a time, or scrub anywhere in the run. Space plays/pauses; ← and → step.

Live counters show comparisons, swaps, and array accesses as they happen, so the cost is a number
you watch accumulate rather than a footnote. Merge sort gets a second row showing its auxiliary
buffer, because that's where its comparisons actually happen.

You control the input size, the playback speed, and the **shape** of the input — random, sorted,
reversed, nearly sorted, or few-unique. Input shape is where best and worst cases stop being
abstract.

## Complexity Lab

The same algorithms, run with no animation, at sizes that double each step. You get:

- **A growth chart** of comparisons (or array accesses) against n, with each algorithm's
  theoretical curve overlaid as a dashed line, scaled to fit. Big-O drops constant factors, so the
  question isn't whether the numbers match — it's whether the *shape* does.
- **A doubling table.** When n doubles, work multiplies by… ~2 for linear, ~2.2 for n log n, ~4 for
  quadratic. That ratio *is* the complexity class, and it's a more durable thing to know than a
  formula.

Three things worth trying, on Arrays:

1. **Set input shape to Sorted.** Bubble sort collapses to linear — its early exit fires on the
   first pass. Quick sort blows up to quadratic, because a last-element pivot is the worst possible
   choice on ordered data. Best case and worst case swap places in front of you.
2. **Set it to Reversed.** Bubble sort is now at its worst, and merge sort hasn't moved at all. Its
   cost genuinely does not depend on the input.
3. **Add Binary Search and turn on log scale.** On a linear axis it's a flat line on the floor —
   16× the data costs it about 4 more comparisons. You need a log axis to see that it grows at all.

And on Strings — switch the data structure at the top, then set input shape to **Repetitive**:
Naive Search bends visibly into a quadratic curve (it backtracks nearly the whole pattern at every
position), while KMP and Rabin-Karp stay flat on the floor. That contrast is the reason this trio
was picked over any other pattern-matching algorithms.

## How it works

Every algorithm is written once, as a generator that yields a stream of events describing what it
did. The animation and the measurements replay that same stream, so the bars and the numbers can't
disagree.

The engine in `src/core/` knows nothing about arrays or strings specifically — a data structure
supplies its own inputs, visual state, and renderer, so adding one (trees, next) means writing one
folder under `src/structures/` and appending one line to the registry. Strings needed no changes to
`core/` or the shared components to slot in, even though it has no "magnitude" to draw as a bar and
no sorted/reversed shapes — that's what confirms the abstraction is doing its job. See
[src/structures/README.md](src/structures/README.md) for the checklist and [CLAUDE.md](CLAUDE.md)
for the architecture.

```bash
npm test
```

## History

This repo previously held BFS/DFS and Kruskal's MST animations built on Cytoscape.js. Those are
preserved in git history (commit `3a82dd4`) and are worth porting into the current architecture.
