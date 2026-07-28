import type { AnyAlgorithmSpec, AnyDataStructure, Category } from '../core/types'
import { arrays } from './arrays'
import { strings } from './strings'

/**
 * The single place the app learns what data structures exist.
 *
 * Taxonomy: Data Structure → Category → Algorithm.
 *
 * To add a structure (trees, graphs, …), build a folder under
 * `src/structures/<name>/` exporting a `DataStructure` and append it here.
 * Nothing else needs to change — the nav, picker, player, profiler, chart and
 * growth table all read from this list. See `src/structures/README.md`.
 *
 * Order is display order.
 */
export const STRUCTURES: AnyDataStructure[] = [arrays, strings]

export const structureById = (id: string): AnyDataStructure => {
  const found = STRUCTURES.find((s) => s.id === id)
  if (!found) throw new Error(`Unknown data structure: ${id}`)
  return found
}

export const algorithmById = (
  structure: AnyDataStructure,
  id: string,
): AnyAlgorithmSpec => {
  const found = structure.algorithms.find((a: AnyAlgorithmSpec) => a.id === id)
  if (!found) throw new Error(`Unknown algorithm: ${id} on ${structure.id}`)
  return found
}

/** Algorithms of one structure, grouped into its declared categories. */
export function byCategory(
  structure: AnyDataStructure,
): Array<{ category: Category; algorithms: AnyAlgorithmSpec[] }> {
  return structure.categories
    .map((category: Category) => ({
      category,
      algorithms: structure.algorithms.filter(
        (a: AnyAlgorithmSpec) => a.categoryId === category.id,
      ),
    }))
    .filter((g) => g.algorithms.length > 0)
}

export const ALL_ALGORITHMS: AnyAlgorithmSpec[] = STRUCTURES.flatMap(
  (s) => s.algorithms as AnyAlgorithmSpec[],
)
