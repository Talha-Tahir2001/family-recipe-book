import { NextResponse } from "next/server"

import { describeError, jsonError, jsonFromZodError } from "@/lib/api"
import { connectToMongo } from "@/lib/mongo"
import { listAllTags, searchRecipes } from "@/lib/search"
import { searchQuerySchema } from "@/lib/schema"
import { ZodError } from "zod"

export async function GET(request: Request) {
  await connectToMongo()

  const url = new URL(request.url)
  try {
    const parsed = searchQuerySchema.parse({
      q: url.searchParams.get("q") ?? "",
      tags: url.searchParams.getAll("tag"),
      limit: url.searchParams.get("limit") ?? undefined,
    })

    const [outcome, tags] = await Promise.all([
      searchRecipes(parsed),
      listAllTags(),
    ])

    return NextResponse.json({
      recipes: outcome.hits,
      tags,
      mode: outcome.mode,
      degradedReason: outcome.degradedReason,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonFromZodError(error)
    }
    console.error("Recipe search failed", describeError(error))
    return jsonError(`Search failed: ${describeError(error)}`, 500)
  }
}