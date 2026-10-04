import { NextResponse } from "next/server"
import { z, ZodError } from "zod"

import { describeError, jsonError, jsonFromZodError } from "@/lib/api"
import { expandSearchQuery } from "@/lib/gemma"
import { connectToMongo } from "@/lib/mongo"
import { listAllTags, searchRecipes } from "@/lib/search"

const bodySchema = z.object({
  q: z.string().trim().min(1),
  tags: z.array(z.string()).default([]),
  limit: z.coerce.number().int().positive().max(50).default(24),
})

/**
 * Natural-language search. Gemma rewrites the question into keywords/tags, then
 * the hybrid retrieval in lib/search.ts runs. If Gemma is unavailable the raw
 * question is used as the query so search never hard-fails.
 */
export async function POST(request: Request) {
  await connectToMongo()

  let parsed: ReturnType<typeof bodySchema.parse>
  try {
    parsed = bodySchema.parse(await request.json())
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonFromZodError(error)
    }
    return jsonError("Expected a JSON body with a `q` field")
  }

  let keywords = parsed.q
  let tags = parsed.tags
  let expanded = false
  let expansionNote: string | null = null
  let expansion: { keywords: string[]; tags: string[] } | null = null

  const allTags = await listAllTags()

  try {
    expansion = await expandSearchQuery(parsed.q)
    keywords = [...expansion.keywords, parsed.q].join(" ")
    // Only apply tags that actually exist in the book — inventing new ones as
    // filters would silently return nothing.
    tags = [
      ...new Set([
        ...parsed.tags,
        ...expansion.tags.filter((tag) =>
          allTags.some(
            (existing) => existing.toLowerCase() === tag.toLowerCase()
          )
        ),
      ]),
    ]
    expanded = true
  } catch (error) {
    expansionNote = describeError(error)
  }

  const outcome = await searchRecipes({ q: keywords, tags, limit: parsed.limit })

  return NextResponse.json({
    recipes: outcome.hits,
    tags: allTags,
    mode: outcome.mode,
    expanded,
    expansion,
    appliedTags: tags,
    expansionNote,
    degradedReason: outcome.degradedReason,
  })
}