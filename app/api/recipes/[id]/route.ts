import { NextResponse } from "next/server"
import { ZodError } from "zod"

import { Memo } from "@/models/memo"
import { Recipe } from "@/models/recipe"
import { describeError, jsonError, jsonFromZodError } from "@/lib/api"
import { connectToMongo } from "@/lib/mongo"
import { refreshRecipeEmbedding } from "@/lib/pipeline"
import { recipePatchSchema } from "@/lib/schema"

export async function GET(
  _request: Request,
  context: RouteContext<"/api/recipes/[id]">
) {
  const { id } = await context.params
  await connectToMongo()

  const recipe = await Recipe.findById(id).lean()
  if (!recipe) {
    return jsonError("Recipe not found", 404)
  }

  const memo = await Memo.findById(recipe.memoId)
    .select("originalName transcript detectedLang")
    .lean()

  return NextResponse.json({
    recipe: { ...recipe, embedding: undefined },
    memo: memo ?? null,
  })
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/recipes/[id]">
) {
  const { id } = await context.params
  await connectToMongo()

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return jsonError("Expected a JSON body")
  }

  let parsed: ReturnType<typeof recipePatchSchema.parse>
  try {
    parsed = recipePatchSchema.parse(payload)
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonFromZodError(error)
    }
    return jsonError(describeError(error))
  }

  const patch = Object.fromEntries(
    Object.entries(parsed).filter(([, value]) => value !== undefined)
  ) as typeof parsed

  const existing = await Recipe.findById(id)
  if (!existing) {
    return jsonError("Recipe not found", 404)
  }

  existing.set(patch)
  await existing.save()

  await refreshRecipeEmbedding(existing._id)

  const updated = await Recipe.findById(id).lean()
  return NextResponse.json({ recipe: { ...updated, embedding: undefined } })
}