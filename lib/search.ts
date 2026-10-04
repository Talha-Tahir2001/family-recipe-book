import { Recipe, type RecipeModel } from "@/models/recipe"
import { embedText } from "@/lib/embeddings"

export const VECTOR_INDEX_NAME = "recipes_vector_index"

export type SearchMode = "hybrid" | "keyword" | "all"

export type SearchOptions = {
  q: string
  tags: string[]
  limit: number
}

export type SearchHit = {
  _id: string
  title: string
  summary: string
  story: string | null
  servings: number | null
  prepMin: number | null
  cookMin: number | null
  tags: string[]
  ingredientNames: string[]
  memoId: string
  extractedBy: string | null
  createdAt: Date
  matchReason: "keyword" | "semantic" | "both"
  score: number
}

export type SearchOutcome = {
  hits: SearchHit[]
  mode: SearchMode
  degradedReason: string | null
}

const projection = {
  title: 1,
  summary: 1,
  story: 1,
  servings: 1,
  prepMin: 1,
  cookMin: 1,
  tags: 1,
  ingredients: 1,
  memoId: 1,
  extractedBy: 1,
  createdAt: 1,
} as const

/**
 * Hybrid retrieval (PRD FR-6): MongoDB keyword regex for dish/ingredient lookups
 * merged with Atlas Vector Search (`$vectorSearch`) for plain-English questions.
 * If the vector index is missing or the query cannot be embedded, the keyword
 * path still returns results.
 */
export async function searchRecipes(
  options: SearchOptions,
  recipes: RecipeModel = Recipe
): Promise<SearchOutcome> {
  const q = options.q.trim()
  const hasQuery = q.length > 0

  if (!hasQuery && options.tags.length === 0) {
    const all = await recipes
      .find({}, projection)
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .lean()
    return {
      hits: all
        .map(toHit)
        .map((hit) => ({ ...hit, score: 0, matchReason: "both" as const })),
      mode: "all",
      degradedReason: null,
    }
  }

  const keywordDocs = await keywordSearch(recipes, options)

  if (!hasQuery) {
    return {
      hits: keywordDocs.slice(0, options.limit).map((hit, index) => ({
        ...hit,
        score: 1 - index / (options.limit + 1),
      })),
      mode: "keyword",
      degradedReason: null,
    }
  }

  try {
    const semanticHits = await vectorSearch(recipes, q, options)
    return {
      hits: merge(keywordDocs, semanticHits, options.limit),
      mode: "hybrid",
      degradedReason: null,
    }
  } catch (error) {
    return {
      hits: keywordDocs.slice(0, options.limit).map((hit, index) => ({
        ...hit,
        score: 1 - index / (options.limit + 1),
      })),
      mode: "keyword",
      degradedReason:
        error instanceof Error ? error.message : "Vector search unavailable",
    }
  }
}

async function keywordSearch(recipes: RecipeModel, options: SearchOptions) {
  const filter: Record<string, unknown> = {}

  if (options.tags.length > 0) {
    filter.tags = {
      $in: options.tags.map((tag) => new RegExp(`^${escapeRegex(tag)}$`, "i")),
    }
  }

  const q = options.q.trim()
  if (q) {
    const terms = keywordTerms(q)
    if (terms.length > 0) {
      const clauses = terms.map((term) => {
        const rx = new RegExp(escapeRegex(term), "i")
        return {
          $or: [
            { title: rx },
            { summary: rx },
            { tags: rx },
            { "ingredients.name": rx },
          ],
        }
      })
      filter.$and = clauses
    }
  }

  const docs = await recipes
    .find(filter, projection)
    .sort({ createdAt: -1 })
    .limit(options.limit * 2)
    .lean()

  return docs.map(toHit)
}

async function vectorSearch(
  recipes: RecipeModel,
  query: string,
  options: SearchOptions
) {
  const queryVector = await embedText(query)
  const filter =
    options.tags.length > 0 ? { tags: { $in: options.tags } } : undefined

  const results = await recipes
    .aggregate<{
      _id: string
      title: string
      summary: string
      story: string | null
      servings: number | null
      prepMin: number | null
      cookMin: number | null
      tags: string[]
      ingredients: { name: string }[]
      memoId: string
      extractedBy: string | null
      createdAt: Date
      score: number
    }>([
      {
        $vectorSearch: {
          index: VECTOR_INDEX_NAME,
          path: "embedding",
          queryVector,
          numCandidates: Math.max(options.limit * 10, 50),
          limit: options.limit,
          ...(filter ? { filter } : {}),
        },
      },
      {
        $project: {
          ...projection,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ])
    .limit(options.limit)

  return results.map((result) => ({
    _id: result._id,
    title: result.title,
    summary: result.summary,
    story: result.story,
    servings: result.servings,
    prepMin: result.prepMin,
    cookMin: result.cookMin,
    tags: result.tags ?? [],
    ingredientNames: (result.ingredients ?? []).map(
      (ingredient) => ingredient.name
    ),
    memoId: result.memoId,
    extractedBy: result.extractedBy ?? null,
    createdAt: result.createdAt,
    score: result.score ?? 0,
  }))
}

function merge(
  keywordHits: SearchHit[],
  semanticHits: Omit<SearchHit, "matchReason">[],
  limit: number
) {
  const byId = new Map<string, SearchHit & { score: number }>()

  for (const [index, hit] of keywordHits.entries()) {
    byId.set(hit._id, {
      ...hit,
      score: 1 - index / (keywordHits.length + 1),
      matchReason: "keyword",
    })
  }

  for (const hit of semanticHits) {
    const existing = byId.get(hit._id)
    if (existing) {
      existing.matchReason = "both"
      existing.score = Math.max(existing.score, hit.score)
    } else {
      byId.set(hit._id, { ...hit, matchReason: "semantic" })
    }
  }

  return [...byId.values()].sort((a, b) => b.score - a.score).slice(0, limit)
}

function toHit(doc: {
  _id: string
  title: string
  summary?: string
  story?: string | null
  servings?: number | null
  prepMin?: number | null
  cookMin?: number | null
  tags?: string[]
  ingredients?: { name: string }[]
  memoId: string
  extractedBy?: string | null
  createdAt: Date
}): SearchHit {
  return {
    _id: doc._id,
    title: doc.title,
    summary: doc.summary ?? "",
    story: doc.story ?? null,
    servings: doc.servings ?? null,
    prepMin: doc.prepMin ?? null,
    cookMin: doc.cookMin ?? null,
    tags: doc.tags ?? [],
    ingredientNames: (doc.ingredients ?? []).map(
      (ingredient) => ingredient.name
    ),
    memoId: doc.memoId,
    extractedBy: doc.extractedBy ?? null,
    createdAt: doc.createdAt,
    matchReason: "keyword",
    score: 0,
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const STOP_WORDS = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "but", "by", "can",
  "could", "do", "does", "for", "from", "get", "have", "how", "i", "if",
  "in", "is", "it", "make", "me", "of", "on", "or", "please", "show",
  "something", "that", "the", "to", "want", "what", "whats", "which", "with",
  "would", "you",
])

/** Drops question words so "what can I make with paneer" searches "paneer". */
function keywordTerms(query: string) {
  return query
    .split(/[^\p{L}\p{N}]+/u)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term))
    .slice(0, 8)
}

export async function listAllTags() {
  const tags = await Recipe.distinct("tags")
  return tags.filter((tag): tag is string => typeof tag === "string").sort()
}
