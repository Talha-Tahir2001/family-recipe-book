import { z } from "zod"

import { GEMINI_BASE_URL, env } from "@/lib/env"
import { dedupe, extractedRecipeSchema, type RecipeShape } from "@/lib/schema"

/**
 * Recipe extraction runs on open-weight Gemma, served by the Gemini API free tier.
 *
 * Documented model IDs (see PLAN.MD §1):
 *   primary  GEMMA_MODEL_ID          default `gemma-4-31b-it`
 *   fallback GEMMA_FALLBACK_MODEL_ID default `gemma-4-26b-a4b-it`
 *
 * Both are open weights: swap the env var (or point this adapter at Ollama via
 * GEMINI_BASE_URL) and the pipeline is unchanged.
 */
const GEMMA_FALLBACK_MODEL_ID = "gemma-4-26b-a4b-it"

const SYSTEM_INSTRUCTION = `You convert a rambling spoken cooking memory into a structured recipe.

The transcript is a voice memo from a family member. It may be repetitive, off-topic,
in a mix of languages, or full of filler. Your job is to recover the recipe without
inventing anything that is not supported by the transcript.

Rules:
1. Output strict JSON only. No markdown fences, no commentary.
2. Keep the speaker's own words wherever they carry meaning. The "story" field is
   anecdotal context: why this dish matters, who taught it, when it is made. Preserve
   the original phrasing as closely as possible. If the transcript is entirely
   instruction with no anecdote, use null.
3. Ingredients: infer a cookable quantity even when the speaker is vague. Put the
   speaker's original wording in "note" so the personality survives, e.g.
   {"qty": "80", "unit": "g", "name": "paneer", "note": "a fistful, roughly"}.
   "qty" is a short string so "1.5", "2-3" and "a pinch" all fit. Use null for unknown.
4. Steps: imperative, one action per step, in the order spoken. Keep the speaker's
   sensory cues ("until it smells right", "until it stops sticking") in the
   instruction. Put approximate times in "durationHint" (e.g. "about 10 min").
5. tags: 2-6 short lowercase tags for search, including cuisine and meal type
   (e.g. "indian", "vegetarian", "weeknight", "dessert").
6. summary: one sentence, max 140 characters, describing the dish.
7. Never invent ingredients that are never mentioned. Omit a field (null) rather
   than guessing if the transcript is silent about it.

Return exactly this JSON shape:
{
  "title": string,
  "summary": string,
  "story": string | null,
  "servings": number | null,
  "prepMin": number | null,
  "cookMin": number | null,
  "tags": string[],
  "ingredients": [{ "qty": string | null, "unit": string | null, "name": string, "note": string | null }],
  "steps": [{ "instruction": string, "durationHint": string | null }],
  "tips": string[]
}`

type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] }
    finishReason?: string
  }[]
  promptFeedback?: { blockReason?: string }
  error?: { message?: string; status?: string }
}

export async function extractRecipe(
  transcript: string,
  context: { keyterms?: string[]; dishHint?: string } = {}
): Promise<{ recipe: RecipeShape; modelId: string }> {
  const userPrompt = buildUserPrompt(transcript, context)
  const failures: string[] = []

  for (const modelId of modelChain()) {
    let repairNote: string | null = null

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const raw = await callGemini(modelId, userPrompt, repairNote)
        const parsed = extractedRecipeSchema.safeParse(JSON.parse(raw))
        if (parsed.success) {
          return { recipe: parsed.data, modelId }
        }
        repairNote = `That JSON was rejected: ${prettifyIssues(parsed.error)}`
        failures.push(`${modelId} attempt ${attempt + 1}: ${repairNote}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        failures.push(`${modelId} attempt ${attempt + 1}: ${message}`)
        if (isFatal(message)) break
        repairNote = message
      }
    }
  }

  throw new Error(
    `Gemma extraction failed after ${failures.length} attempt(s). ${failures
      .slice(-3)
      .join(" | ")}`
  )
}

/**
 * Turns a plain-English question ("something paneer-y for a fast dinner") into
 * search terms. Used by POST /api/search to feed both the keyword and the
 * Atlas Vector Search path (PRD FR-6).
 */
export async function expandSearchQuery(question: string): Promise<{
  keywords: string[]
  tags: string[]
}> {
  const schema = z.object({
    keywords: z.array(z.string()),
    tags: z.array(z.string()),
  })

  const prompt = [
    "A family recipe book is being searched. Convert the user's question into search terms.",
    'Return JSON only: {"keywords": string[], "tags": string[]}.',
    "keywords: dish names and ingredient nouns a recipe title, summary or ingredient list would contain.",
    "tags: lowercase tags that may already exist in the book (cuisine, meal type, dietary).",
    `Question: ${question}`,
  ].join("\n")

  const raw = await callGemini(modelChain()[0], prompt, null)
  const parsed = schema.safeParse(JSON.parse(stripCodeFence(raw)))
  if (!parsed.success) {
    throw new Error("Gemma returned an unusable search expansion")
  }

  return {
    keywords: dedupe(
      parsed.data.keywords.map((k) => k.trim()).filter(Boolean)
    ).slice(0, 8),
    tags: dedupe(
      parsed.data.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)
    ).slice(0, 4),
  }
}

function buildUserPrompt(transcript: string, context: { keyterms?: string[] }) {
  const keyterms = context.keyterms?.filter(Boolean) ?? []
  const lines = ["Voice-memo transcript follows.", ""]
  if (keyterms.length > 0) {
    lines.push(
      `Likely dish name(s) mentioned by the uploader: ${keyterms.join(", ")}.`,
      ""
    )
  }
  lines.push('"""', transcript.trim(), '"""')
  return lines.join("\n")
}

function modelChain() {
  const chain = [env.gemmaModelId()]
  const configuredFallback = env.gemmaFallbackModelId()
  if (configuredFallback) {
    chain.push(configuredFallback)
  }
  if (!chain.includes(GEMMA_FALLBACK_MODEL_ID)) {
    chain.push(GEMMA_FALLBACK_MODEL_ID)
  }
  return chain
}

async function callGemini(
  modelId: string,
  userPrompt: string,
  repairNote: string | null
): Promise<string> {
  const parts: { text: string }[] = [{ text: userPrompt }]
  if (repairNote) {
    parts.push({
      text: `Your previous answer could not be used: ${repairNote}\nReturn corrected JSON only.`,
    })
  }

  const response = await fetch(
    `${GEMINI_BASE_URL}/models/${modelId}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": env.geminiApiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens: 4096,
        },
      }),
      signal: AbortSignal.timeout(120_000),
    }
  )

  const payload = (await response.json().catch(() => ({}))) as GeminiResponse

  if (!response.ok) {
    throw new Error(
      `Gemini API error ${response.status} for model ${modelId}: ${
        payload.error?.message ?? response.statusText
      }`
    )
  }

  const blockReason = payload.promptFeedback?.blockReason
  if (blockReason) {
    throw new Error(
      `Gemini refused the request for ${modelId} (blockReason: ${blockReason})`
    )
  }

  const text = (payload.candidates?.[0]?.content?.parts ?? [])
    // Gemma 4 emits reasoning parts flagged with `thought: true`; only the
    // final answer part is valid JSON.
    .filter((part) => part.thought !== true)
    .map((part) => part.text ?? "")
    .join("")
    .trim()

  if (!text) {
    throw new Error(
      `Gemini returned no text for ${modelId} (finishReason: ${
        payload.candidates?.[0]?.finishReason ?? "unknown"
      })`
    )
  }

  return stripCodeFence(text)
}

function isFatal(message: string) {
  return /API key not valid|API_KEY_INVALID|PERMISSION_DENIED|\b403\b/.test(
    message
  )
}

function stripCodeFence(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return (fenced ? fenced[1] : text).trim()
}

function prettifyIssues(error: {
  issues: { path: PropertyKey[]; message: string }[]
}) {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ")
}
