import { after, NextResponse } from "next/server"

import { Memo } from "@/models/memo"
import { Recipe } from "@/models/recipe"
import { describeError, jsonError } from "@/lib/api"
import { connectToMongo } from "@/lib/mongo"
import { runPipeline } from "@/lib/pipeline"

export async function GET(
  _request: Request,
  context: RouteContext<"/api/memos/[id]">
) {
  const { id } = await context.params
  await connectToMongo()

  const memo = await Memo.findById(id).lean()
  if (!memo) {
    return jsonError("Memo not found", 404)
  }

  return NextResponse.json({
    id: memo._id,
    status: memo.status,
    originalName: memo.originalName,
    detectedLang: memo.detectedLang ?? null,
    transcript: memo.transcript ?? null,
    recipeId: memo.recipeId ?? null,
    error: memo.error ?? null,
    createdAt: memo.createdAt,
  })
}

/** Retry a failed (or interrupted) pipeline run for the same audio file. */
export async function POST(
  _request: Request,
  context: RouteContext<"/api/memos/[id]">
) {
  const { id } = await context.params
  await connectToMongo()

  const memo = await Memo.findById(id)
  if (!memo) {
    return jsonError("Memo not found", 404)
  }

  if (memo.status === "transcribing" || memo.status === "extracting") {
    return jsonError("This memo is already being processed", 409)
  }

  if (memo.status === "ready" && memo.recipeId) {
    return jsonError("This memo already produced a recipe", 409)
  }

  await Recipe.deleteMany({ memoId: id }).catch(() => undefined)
  memo.status = "uploaded"
  memo.error = undefined
  await memo.save()

  after(async () => {
    try {
      await runPipeline(memo._id)
    } catch (error) {
      console.error("Retry pipeline failed", describeError(error))
    }
  })

  return NextResponse.json({ id: memo._id, status: memo.status }, { status: 202 })
}