import { readFile } from "node:fs/promises"

import { ELEVENLABS_BASE_URL, env } from "@/lib/env"

export type TranscriptionResult = {
  text: string
  languageCode: string | null
  durationSec: number | null
}

type ScribeResponse = {
  text?: string
  language_code?: string
  language_probability?: number
}

const requestTimeoutMs = 120_000

export async function transcribeAudio(options: {
  filePath: string
  mimeType: string
  keyterms?: string[]
}): Promise<TranscriptionResult> {
  const keyterms = (options.keyterms ?? []).filter(Boolean)
  const audio = await readFile(options.filePath)

  const form = new FormData()
  form.append(
    "file",
    new Blob([new Uint8Array(audio)], { type: options.mimeType }),
    options.filePath.split(/[\\/]/).pop() ?? "memo"
  )
  form.append("model_id", env.elevenLabsSttModelId())
  for (const term of keyterms) {
    form.append("keyterms", term)
  }

  const response = await fetch(`${ELEVENLABS_BASE_URL}/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": env.elevenLabsApiKey() },
    body: form,
    signal: AbortSignal.timeout(requestTimeoutMs),
  })

  if (!response.ok) {
    throw new Error(
      `ElevenLabs transcription failed (${response.status}): ${await readErrorBody(response)}`
    )
  }

  const payload = (await response.json()) as ScribeResponse
  const text = payload.text?.trim()
  if (!text) {
    throw new Error("ElevenLabs returned an empty transcript")
  }

  return {
    text,
    languageCode: payload.language_code ?? null,
    durationSec: null,
  }
}

export async function synthesizeSpeech(options: {
  text: string
  voiceId?: string
  modelId?: string
}): Promise<Uint8Array> {
  const response = await fetch(
    `${ELEVENLABS_BASE_URL}/text-to-speech/${options.voiceId ?? env.elevenLabsVoiceId()}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": env.elevenLabsApiKey(),
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: options.text,
        model_id: options.modelId ?? env.elevenLabsTtsModelId(),
      }),
      signal: AbortSignal.timeout(requestTimeoutMs),
    }
  )

  if (!response.ok) {
    if (response.status === 402) {
      throw new Error(
        'This ElevenLabs voice needs a paid plan. Free accounts must use a premade voice — run `npm run voices` and set ELEVENLABS_VOICE_ID to one marked "premade".'
      )
    }
    throw new Error(
      `ElevenLabs narration failed (${response.status}): ${await readErrorBody(response)}`
    )
  }

  return new Uint8Array(await response.arrayBuffer())
}

export type VoiceSummary = {
  voiceId: string
  name: string
  category: string | null
}

export async function listVoices(): Promise<VoiceSummary[]> {
  const response = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
    headers: { "xi-api-key": env.elevenLabsApiKey() },
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    throw new Error(
      `ElevenLabs voices failed (${response.status}): ${await readErrorBody(response)}`
    )
  }

  const payload = (await response.json()) as {
    voices?: {
      voice_id: string
      name: string
      category?: string
      labels?: Record<string, string>
    }[]
  }

  return (payload.voices ?? []).map((voice) => ({
    voiceId: voice.voice_id,
    name: voice.name,
    category: voice.category ?? voice.labels?.description ?? null,
  }))
}

async function readErrorBody(response: Response) {
  const text = await response.text().catch(() => "")
  return text.slice(0, 400) || response.statusText
}
