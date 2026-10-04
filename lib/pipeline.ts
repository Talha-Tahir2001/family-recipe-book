import { randomUUID } from "node:crypto"

import { Memo } from "@/models/memo"
import { Recipe, type RecipeInput } from "@/models/recipe"
import { embedText, recipeEmbeddingText } from "@/lib/embeddings"
import { transcribeAudio } from "@/lib/elevenlabs"
import { extractRecipe } from "@/lib/gemma"
import { connectToMongo } from "@/lib/mongo"

/**
 * Memo -> Recipe pipeline (PLAN.MD §6 F1).
 *
 * uploaded -> transcribing -> extracting -> ready | error
 *
 * Runs detached from the request that created the memo; the /upload screen polls
 * GET /api/memos/:id for `status`, `error` and the eventual `recipeId`.
 */
export async function runPipeline(memoId: string) {
  await connectToMongo()
  const memo = await Memo.findById(memoId)
  if (!memo) {
    throw new Error(`Memo ${memoId} no longer exists`)
  }

  try {
    memo.status = "transcribing"
    memo.error = undefined
    await memo.save()

    const transcription = await transcribeAudio({
      filePath: memo.storedPath,
      mimeType: memo.mimeType,
      keyterms: [...(memo.keyterms ?? [])],
    })

    memo.transcript = transcription.text
    memo.detectedLang = transcription.languageCode ?? undefined
    memo.status = "extracting"
    await memo.save()

    const { recipe: extracted, modelId } = await extractRecipe(
      transcription.text,
      { keyterms: [...(memo.keyterms ?? [])] }
    )

    const recipe = await Recipe.create({
      _id: randomUUID(),
      memoId: memo._id,
      extractedBy: modelId,
      ...extracted,
    } satisfies RecipeInput)

    await refreshRecipeEmbedding(recipe._id)

    memo.status = "ready"
    memo.recipeId = recipe._id
    memo.error = undefined
    await memo.save()

    return recipe
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pipeline failed unexpectedly"
    await Memo.updateOne(
      { _id: memoId },
      { $set: { status: "error", error: message.slice(0, 600) } }
    )
    throw error
  }
}

/** Re-embeds a recipe after an edit so Atlas Vector Search stays in sync. */
export async function refreshRecipeEmbedding(recipeId: string) {
  const recipe = await Recipe.findById(recipeId).lean()
  if (!recipe) {
    throw new Error(`Recipe ${recipeId} not found`)
  }

  try {
    const embedding = await embedText(recipeEmbeddingText(recipe))
    await Recipe.updateOne(
      { _id: recipeId },
      { $set: { embedding, embeddingModel: process.env.EMBEDDING_MODEL_ID } }
    )
    return true
  } catch (error) {
    console.error(
      "Embedding failed; vector search will skip this recipe",
      error
    )
    return false
  }
}
