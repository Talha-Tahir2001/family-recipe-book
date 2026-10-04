export const ACCEPTED_AUDIO_MIME_TYPES = [
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/webm",
  "audio/aac",
] as const

export const ACCEPTED_AUDIO_EXTENSIONS = [
  ".m4a",
  ".mp3",
  ".wav",
  ".ogg",
  ".webm",
  ".aac",
] as const

export const ACCEPTED_AUDIO_ATTRIBUTE =
  "audio/mp4,audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/aac,.m4a,.mp3,.wav,.ogg,.webm,.aac"

export const EXTENSION_BY_MIME: Record<string, string> = {
  "audio/mp4": ".m4a",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/wave": ".wav",
  "audio/ogg": ".ogg",
  "audio/webm": ".webm",
  "audio/aac": ".aac",
}

export function extensionForMime(mimeType: string) {
  return EXTENSION_BY_MIME[mimeType.toLowerCase()] ?? ""
}

export function looksLikeAudioFile(file: { name: string; type: string }) {
  return (
    file.type.startsWith("audio/") ||
    ACCEPTED_AUDIO_EXTENSIONS.some((extension) =>
      file.name.toLowerCase().endsWith(extension)
    )
  )
}
