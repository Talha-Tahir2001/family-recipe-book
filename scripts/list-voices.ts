import { listVoices } from "@/lib/elevenlabs"
import { env } from "@/lib/env"

async function main() {
  const voices = await listVoices()

  let pinned: string | null = null
  try {
    pinned = env.elevenLabsVoiceId()
  } catch {
    pinned = null
  }

  console.log(`${voices.length} voices\n`)
  for (const voice of voices) {
    const marker = voice.voiceId === pinned ? " <- currently pinned" : ""
    console.log(
      `${voice.voiceId}  ${voice.name}${voice.category ? `  (${voice.category})` : ""}${marker}`
    )
  }

  console.log("\nWarm, unhurried voices worth trying for recipe narration:")
  const preferred = voices.filter((voice) =>
    /rachel|domi|bella|antoni|adam|josh|sam|callum|charlie|george|carla|dominic/i.test(
      voice.name
    )
  )
  for (const voice of preferred) {
    console.log(`  ${voice.name} — ${voice.voiceId}`)
  }
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
