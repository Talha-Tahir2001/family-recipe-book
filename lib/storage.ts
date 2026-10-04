import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { extensionForMime } from "@/lib/audio"
import { env } from "@/lib/env"

const uploadRoot = path.resolve(
  /* turbopackIgnore: true */ process.cwd(),
  env.uploadDir()
)
const ttsCacheRoot = path.resolve(
  /* turbopackIgnore: true */ process.cwd(),
  env.ttsCacheDir()
)

export async function saveUpload(options: {
  memoId: string
  mimeType: string
  bytes: Uint8Array
}) {
  await mkdir(/* turbopackIgnore: true */ uploadRoot, { recursive: true })
  const extension = extensionForMime(options.mimeType) || ".bin"
  const storedPath = path.join(uploadRoot, `${options.memoId}${extension}`)
  await writeFile(/* turbopackIgnore: true */ storedPath, options.bytes)
  return storedPath
}

export async function readMemoAudio(storedPath: string) {
  return readFile(/* turbopackIgnore: true */ storedPath)
}

export function ttsCachePath(
  recipeId: string,
  stepIndex: number,
  text: string
) {
  const hash = createHash("sha256").update(text).digest("hex").slice(0, 16)
  return path.join(ttsCacheRoot, `${recipeId}-${stepIndex}-${hash}.mp3`)
}

export async function readCachedNarration(filePath: string) {
  try {
    return await readFile(/* turbopackIgnore: true */ filePath)
  } catch {
    return null
  }
}

export async function writeCachedNarration(
  filePath: string,
  bytes: Uint8Array
) {
  await mkdir(/* turbopackIgnore: true */ path.dirname(filePath), {
    recursive: true,
  })
  await writeFile(/* turbopackIgnore: true */ filePath, bytes)
}
