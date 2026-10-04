import { listVoices, synthesizeSpeech, transcribeAudio } from "@/lib/elevenlabs"
import { extractRecipe } from "@/lib/gemma"
import { embedText } from "@/lib/embeddings"
import { env, ELEVENLABS_BASE_URL, GEMINI_BASE_URL } from "@/lib/env"

type Check = { name: string; ok: boolean; detail: string }

const SAMPLE_TRANSCRIPT = `Okay so, um, this is my grandmother's paneer bhurji, right? She used to make it
whenever there was leftover paneer. You take, um, a fistful of paneer — honestly
maybe 200 grams — and crumble it. Two medium onions, finely chopped. A couple of
tomatoes. Now the masala: whole cumin seeds, a spoon of coriander powder, and
grievously, a little garam masala at the end. You fry the onions until they are
golden, add the tomato, and then the paneer. Keep it on low until it smells right —
she never measured the salt, she just said "adjust". My grandmother learned this from
her mother in Amritsar before Partition, and she only ever made it on Sundays.`

const results: Check[] = []

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail })
  const mark = ok ? "PASS" : "FAIL"
  console.log(`[${mark}] ${name}\n       ${detail}\n`)
}

async function checkElevenLabsVoices() {
  try {
    const voices = await listVoices()
    const preferred = voices.find(
      (voice) =>
        voice.voiceId === env.elevenLabsVoiceId() ||
        /rachel|domi|bella/i.test(voice.name)
    )
    record(
      "ElevenLabs API key + voice library",
      voices.length > 0,
      `${voices.length} voices available. ${
        preferred
          ? `Pin ELEVENLABS_VOICE_ID=${preferred.voiceId} (${preferred.name})`
          : `Set ELEVENLABS_VOICE_ID — e.g. ${voices[0]?.voiceId ?? "<none>"}`
      }`
    )
  } catch (error) {
    record("ElevenLabs API key + voice library", false, message(error))
  }
}

async function checkTts() {
  try {
    const audio = await synthesizeSpeech({
      text: "Fry the onions until they turn golden.",
    })
    record(
      `ElevenLabs TTS (${env.elevenLabsTtsModelId()})`,
      audio.byteLength > 1000,
      `${audio.byteLength} bytes of mp3 for one step`
    )
  } catch (error) {
    record(
      `ElevenLabs TTS (${env.elevenLabsTtsModelId()})`,
      false,
      message(error)
    )
  }
}

async function checkStt() {
  const filePath = process.argv[2]
  if (!filePath) {
    record(
      `ElevenLabs STT (${env.elevenLabsSttModelId()})`,
      true,
      "SKIPPED — pass an audio file path: npx tsx scripts/smoke-apis.ts ./uploads/memo.m4a"
    )
    return
  }
  try {
    const result = await transcribeAudio({
      filePath,
      mimeType: filePath.endsWith(".m4a") ? "audio/mp4" : "audio/mpeg",
      keyterms: ["paneer", "bhurji"],
    })
    record(
      `ElevenLabs STT (${env.elevenLabsSttModelId()})`,
      result.text.length > 0,
      `language=${result.languageCode ?? "unknown"} · ${result.text.length} chars · "${result.text.slice(0, 80)}…"`
    )
  } catch (error) {
    record(
      `ElevenLabs STT (${env.elevenLabsSttModelId()})`,
      false,
      message(error)
    )
  }
}

async function checkGemma() {
  const primary = env.gemmaModelId()
  try {
    const { recipe, modelId } = await extractRecipe(SAMPLE_TRANSCRIPT, {
      keyterms: ["paneer bhurji"],
    })
    record(
      `Gemma extraction (${modelId})`,
      recipe.steps.length > 0 && recipe.ingredients.length > 0,
      `"${recipe.title}" · ${recipe.ingredients.length} ingredients · ${recipe.steps.length} steps · tags=${recipe.tags.join("/")}`
    )
    console.log("       story:", (recipe.story ?? "").slice(0, 160) || "(none)")
    console.log(
      "       sample ingredient:",
      JSON.stringify(recipe.ingredients[0] ?? null)
    )
    console.log("       first step:", recipe.steps[0]?.instruction ?? "(none)")
  } catch (error) {
    record(`Gemma extraction (${primary})`, false, message(error))
  }
}

async function checkEmbeddings() {
  try {
    const values = await embedText("paneer bhurji — Indian, vegetarian")
    record(
      `Gemini embeddings (${env.embeddingModelId()})`,
      values.length === env.embeddingDimensions(),
      `${values.length} dimensions (index expects ${env.embeddingDimensions()})`
    )
  } catch (error) {
    record(
      `Gemini embeddings (${env.embeddingModelId()})`,
      false,
      message(error)
    )
  }
}

async function checkMongo() {
  try {
    const { connectToMongo, disconnectMongo } = await import("@/lib/mongo")
    const { Recipe } = await import("@/models/recipe")
    await connectToMongo()
    const count = await Recipe.estimatedDocumentCount()
    record("MongoDB Atlas connection", true, `${count} recipes in the book`)
    await disconnectMongo()
  } catch (error) {
    record("MongoDB Atlas connection", false, message(error))
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function main() {
  console.log(`ElevenLabs ${ELEVENLABS_BASE_URL}`)
  console.log(`Gemini    ${GEMINI_BASE_URL}\n`)

  await checkElevenLabsVoices()
  await checkTts()
  await checkStt()
  await checkGemma()
  await checkEmbeddings()
  await checkMongo()

  const failed = results.filter((result) => !result.ok)
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed`
  )
  if (failed.length > 0) {
    console.log("Failed: " + failed.map((result) => result.name).join(", "))
    process.exitCode = 1
  }
}

void main()
