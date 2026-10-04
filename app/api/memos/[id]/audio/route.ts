import { NextResponse } from "next/server"

import { Memo } from "@/models/memo"
import { jsonError } from "@/lib/api"
import { connectToMongo } from "@/lib/mongo"
import { readMemoAudio } from "@/lib/storage"

export async function GET(
  _request: Request,
  context: RouteContext<"/api/memos/[id]/audio">
) {
  const { id } = await context.params
  await connectToMongo()

  const memo = await Memo.findById(id).select("storedPath mimeType").lean()
  if (!memo) {
    return jsonError("Memo not found", 404)
  }

  try {
    const audio = await readMemoAudio(memo.storedPath)
    return new NextResponse(new Uint8Array(audio), {
      headers: {
        "Content-Type": memo.mimeType,
        "Content-Length": String(audio.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch {
    return jsonError("The original audio is no longer on disk", 410)
  }
}