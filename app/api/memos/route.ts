import { randomUUID } from "node:crypto"

import { after, NextResponse } from "next/server"

import { Memo } from "@/models/memo"
import { ACCEPTED_AUDIO_MIME_TYPES } from "@/lib/audio"
import { jsonError } from "@/lib/api"
import { env } from "@/lib/env"
import { connectToMongo } from "@/lib/mongo"
import { runPipeline } from "@/lib/pipeline"
import { uploadFieldsSchema } from "@/lib/schema"
import { saveUpload } from "@/lib/storage"

export const maxDuration = 300

export async function GET() {
  await connectToMongo()
  const memos = await Memo.find(
    {},
    { originalName: 1, status: 1, recipeId: 1, error: 1, createdAt: 1, keyterms: 1 }
  )
    .sort({ createdAt: -1 })
    .limit(25)
    .lean()

  return NextResponse.json({ memos })
}

export async function POST(request: Request) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return jsonError("Expected multipart/form-data with an audio file")
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return jsonError("No audio file was attached")
  }

  const mimeType = (file.type || "").toLowerCase()
  if (!ACCEPTED_AUDIO_MIME_TYPES.includes(mimeType as never)) {
    return jsonError(
      `Unsupported audio type "${file.type || "unknown"}". Accepted: m4a, mp3, wav, ogg, webm, aac`
    )
  }

  const maxBytes = env.maxUploadBytes()
  if (file.size > maxBytes) {
    return jsonError(
      `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`
    )
  }

  const { keyterms } = uploadFieldsSchema.parse({
    keyterms: form.get("keyterms") ?? undefined,
  })

  await connectToMongo()

  const memoId = randomUUID()
  const storedPath = await saveUpload({
    memoId,
    mimeType,
    bytes: new Uint8Array(await file.arrayBuffer()),
  })

  const memo = await Memo.create({
    _id: memoId,
    storedPath,
    originalName: file.name || `${memoId}${mimeType}`,
    mimeType,
    byteSize: file.size,
    keyterms,
    status: "uploaded",
  })

  after(async () => {
    try {
      await runPipeline(memo._id)
    } catch (error) {
      console.error("Pipeline failed", error)
    }
  })

  return NextResponse.json(
    { memoId: memo._id, status: memo.status },
    { status: 202 }
  )
}