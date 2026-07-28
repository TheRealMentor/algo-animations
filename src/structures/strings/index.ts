import type { Category, DataStructure } from '../../core/types'
import type { StringEvent, StringInput, StringState } from './model'
import { applyStringEvent, initialStringState } from './model'
import { StringLegend, StringView } from './StringView'
import { SHAPES, generateStrings, patternLength } from './data'
import { naiveSearch } from './algorithms/naiveSearch'
import { rabinKarp } from './algorithms/rabinKarp'
import { kmp } from './algorithms/kmp'

const categories: Category[] = [
  {
    id: 'pattern-matching',
    name: 'Pattern Matching',
    blurb: 'Find every occurrence of a short pattern inside a longer text.',
  },
]

export const strings: DataStructure<StringState, StringEvent, StringInput> = {
  id: 'strings',
  name: 'Strings',
  blurb:
    'Text of length n and a pattern of length m — m scales with n here, so the doubling table below stays meaningful.',

  categories,

  // Naive first (the baseline), then the two smarter approaches — mirrors
  // bubble-sort-first in the arrays structure.
  algorithms: [naiveSearch, rabinKarp, kmp],

  shapes: SHAPES,

  // Character cells need real width to stay legible, unlike thin bars, so this
  // legibility ceiling is lower than arrays' — past it, the view scrolls
  // horizontally rather than becoming unreadable.
  minN: 12,
  maxN: 160,
  defaultN: 40,

  makeInput({ n, shapeId, seed, trial }): StringInput {
    // A different draw per trial so profiling a randomized shape averages
    // over many texts rather than measuring one text repeatedly.
    return generateStrings(n, shapeId, seed + trial * 104_729)
  },

  cloneInput: (input) => ({ text: input.text, pattern: input.pattern }),

  initialState: initialStringState,
  applyEvent: applyStringEvent,

  View: StringView,
  Legend: StringLegend,

  describeInput: (input) => {
    const p = input.pattern.length > 24 ? `${input.pattern.slice(0, 24)}…` : input.pattern
    return `Pattern: "${p}" (length ${input.pattern.length})`
  },
}

export { patternLength }
