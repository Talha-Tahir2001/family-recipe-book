const required = (name: string) => {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill it in.`
    )
  }
  return value
}

const optional = (name: string, fallback: string) =>
  process.env[name] || fallback

const numeric = (name: string, fallback: number) => {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number, received "${raw}"`)
  }
  return parsed
}

export const env = {
  elevenLabsApiKey: () => required("ELEVENLABS_API_KEY"),
  elevenLabsVoiceId: () => required("ELEVENLABS_VOICE_ID"),
  elevenLabsTtsModelId: () =>
    optional("ELEVENLABS_TTS_MODEL_ID", "eleven_flash_v2"),
  elevenLabsSttModelId: () => optional("ELEVENLABS_STT_MODEL_ID", "scribe_v2"),
  geminiApiKey: () => required("GEMINI_API_KEY"),
  gemmaModelId: () => optional("GEMMA_MODEL_ID", "gemma-4-31b-it"),
  gemmaFallbackModelId: () => optional("GEMMA_FALLBACK_MODEL_ID", ""),
  embeddingModelId: () =>
    optional("EMBEDDING_MODEL_ID", "gemini-embedding-001"),
  embeddingDimensions: () => numeric("EMBEDDING_DIMENSIONS", 768),
  mongoUri: () => required("MONGODB_URI"),
  mongoDb: () => optional("MONGODB_DB", "family-recipe-book"),
  uploadDir: () => optional("UPLOAD_DIR", "./uploads"),
  ttsCacheDir: () => optional("TTS_CACHE_DIR", "./cache/tts"),
  maxUploadBytes: () => numeric("MAX_UPLOAD_BYTES", 50 * 1024 * 1024),
}

export const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta"

export const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"
