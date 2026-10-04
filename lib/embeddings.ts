import { GEMINI_BASE_URL, env } from "@/lib/env"

/**
 * Embeddings for Atlas Vector Search. `gemini-embedding-001` at 768 dimensions
 * matches the `recipes_vector_index` definition created by
 * scripts/create-search-index.ts.
 */
const requestTimeoutMs = 30_000

type EmbedResponse = {
  embedding?: { values?: number[] }
  error?: { message?: string }
}

export async function embedText(text: string): Promise<number[]> {
  const dimensions = env.embeddingDimensions()
  const modelId = env.embeddingModelId()

  const response = await fetch(
    `${GEMINI_BASE_URL}/models/${modelId}:embedContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": env.geminiApiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: `models/${modelId}`,
        content: { parts: [{ text }] },
        outputDimensionality: dimensions,
      }),
      signal: AbortSignal.timeout(requestTimeoutMs),
    }
  )

  const payload = (await response.json().catch(() => ({}))) as EmbedResponse

  if (!response.ok) {
    throw new Error(
      `Gemini embedding error ${response.status}: ${
        payload.error?.message ?? response.statusText
      }`
    )
  }

  const values = payload.embedding?.values
  if (!values || values.length === 0) {
    throw new Error(`Gemini returned no embedding values for ${modelId}`)
  }
  if (values.length !== dimensions) {
    throw new Error(
      `Embedding dimension mismatch: index expects ${dimensions}, model returned ${values.length}`
    )
  }

  return values
}

export function recipeEmbeddingText(recipe: {
  title: string
  summary?: string | null
  ingredients?: { name: string }[]
  tags?: string[]
}) {
  const ingredients = (recipe.ingredients ?? [])
    .map((ingredient) => ingredient.name)
    .join(", ")
  const tags = (recipe.tags ?? []).join(", ")
  return [
    recipe.title,
    recipe.summary ?? "",
    `Ingredients: ${ingredients}`,
    `Tags: ${tags}`,
  ]
    .filter((part) => part.trim().length > 0)
    .join(" — ")
}
