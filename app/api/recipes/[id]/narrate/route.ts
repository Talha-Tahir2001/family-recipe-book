import { NextResponse } from "next/server"
import { ZodError } from "zod"

import { Recipe } from "@/models/recipe"
import { describeError, jsonError, jsonFromZodError } from "@/lib/api"
import { synthesizeSpeech } from "@/lib/elevenlabs"
import { connectToMongo } from "@/lib/mongo"
import { narrateBodySchema } from "@/lib/schema"
import {
  readCachedNarration,
  ttsCachePath,
  writeCachedNarration,
} from "@/lib/storage"

export const maxDuration = 60

/**
 * Cook Mode narration (PRD FR-8): one step -> one mp3 from ElevenLabs TTS,
 * cached on disk so replays are instant and free.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/recipes/[id]/narrate">
) {
  const { id } = await context.params
  await connectToMongo()

  const recipe = await Recipe.findById(id).select("steps title").lean()
  if (!recipe) {
    return jsonError("Recipe not found", 404)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("Expected a JSON body")
  }

  let parsed: ReturnType<typeof narrateBodySchema.parse>
  try {
    parsed = narrateBodySchema.parse(body)
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonFromZodError(error)
    }
    return jsonError(describeError(error))
  }

  const step = recipe.steps[parsed.step]
  if (!step && !parsed.text) {
    return jsonError(`Step ${parsed.step} does not exist on this recipe`, 404)
  }

  const spokenText = buildNarrationText(
    recipe.title,
    step?.instruction ?? "",
    parsed.text
  )

  const cachePath = ttsCachePath(id, parsed.step, spokenText)
  const cached = await readCachedNarration(cachePath)

  if (cached) {
    return audioResponse(new Uint8Array(cached), { cached: true })
  }

  try {
    const audio = await synthesizeSpeech({ text: spokenText })
    await writeCachedNarration(cachePath, audio)
    return audioResponse(audio, { cached: false })
  } catch (error) {
    console.error("Narration failed", describeError(error))
    return jsonError(`Narration failed: ${describeError(error)}`, 502)
  }
}

function buildNarrationText(
  title: string,
  instruction: string,
  override?: string
) {
  if (override) return override
  return `${title}. Step: ${instruction}`
}

function audioResponse(bytes: Uint8Array, meta: { cached: boolean }) {
  const body = new Uint8Array(bytes.byteLength)
  body.set(bytes)
  return new NextResponse(body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(bytes.byteLength),
      "X-Tts-Cache": meta.cached ? "hit" : "miss",
      "Cache-Control": "private, max-age=86400",
    },
  })
}