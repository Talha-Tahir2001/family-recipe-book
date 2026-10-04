import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"

import { synthesizeSpeech } from "@/lib/elevenlabs"
import { env } from "@/lib/env"
import { connectToMongo } from "@/lib/mongo"
import { runPipeline } from "@/lib/pipeline"
import { Memo } from "@/models/memo"

type SeedMemo = {
  fileName: string
  label: string
  keyterms: string[]
  script: string
}

/**
 * Placeholder seed content for development (PRD FR-9).
 *
 * Each script is deliberately rambling and colloquial so the Gemma extraction has
 * something realistic to chew on. Audio is generated with ElevenLabs TTS; swap the
 * files in ./uploads/seed for the real recordings from the family member whenever
 * they are available.
 */
const SEED_MEMOS: SeedMemo[] = [
  {
    fileName: "seed-paneer-bhurji.mp3",
    label: "paneer bhurji voice memo from Amritsar",
    keyterms: ["paneer bhurji", "Amritsar"],
    script: `Okay so, um, this is my grandmother's paneer bhurji, right? She used to
make it whenever there was leftover paneer in the fridge, so you know, it's not
fancy at all. You take, um, a fistful of paneer — honestly maybe 200 grams — and
crumble it with your hands like this, no rolling pin, she was very particular
about that. Two medium onions, finely chopped. Two tomatoes. Now the masala: whole
cumin seeds, a spoon of coriander powder, a spoon of garam masala but only at the
very end, and if you have it, dried fenugreek leaves. You fry the onions until
they are golden, add the tomato and let it go a bit thick, then the paneer. Keep it
on low until it smells right, that's how she judged it — not with a timer. The
salt, she never measured, she just said adjust, ha. My grandmother learned this
from her mother in Amritsar before Partition, and she only ever made it on
Sundays when the whole family came over.`,
  },
  {
    fileName: "seed-upma.mp3",
    label: "everyday breakfast upma, in two minutes",
    keyterms: ["upma", "rava", "semolina"],
    script: `This one is not so much a recipe, it is more like a habit, you know? Rava
upma. Two spoons of rava — I use a generous one, three if the pan is big. Mustard
seeds, they should pop first, then curry leaves, a few, not too many or it bitter.
One onion chopped fine. A spoon of coconut chutney powder, or peanut, whatever is
there. A little lemon at the end, my husband insists, I say optional, but put it,
he is right. Add the water slowly, it should look like wet sand, then cover and do
not touch it for two minutes. Two minutes, and that is the whole thing. Good for
colds, quick breakfast, whatever.`,
  },
  {
    fileName: "seed-mango-pickle.mp3",
    label: "mango pickle from mango season",
    keyterms: ["mango pickle", "achar", "turmeric"],
    script: `Raw mango, one kilo, chopped into pieces like this big. Do not peel it,
the peel is the whole point, it gives the sourness. Salt, two spoons, and mix
well. Leave it in the sun, or in the corner of the veranda, for one whole day,
turning it once in the morning. Then the masala: half spoon turmeric, red chilli
according to how brave you are, mustard seeds and fenugreek roasted and crushed,
and a spoon of sugar to take the edge off. Put the oil in the pan, add the
spices, let them crackle properly, then pour it all over the mango. My father did
this every June in Poona, and the whole flat smelled of pickle for weeks. It is
ready after about a week but honestly better after a month.`,
  },
]

async function main() {
  await connectToMongo()

  const uploadDir = path.resolve(process.cwd(), env.uploadDir())
  await mkdir(uploadDir, { recursive: true })

  for (const seed of SEED_MEMOS) {
    const existing = await Memo.findOne({ originalName: seed.fileName })
    if (existing) {
      console.log(
        `• ${seed.fileName} already in the book (${existing.status}) — skipping`
      )
      continue
    }

    console.log(`• synthesising ${seed.fileName}…`)
    const audio = await synthesizeSpeech({ text: seed.script })
    const target = path.join(uploadDir, seed.fileName)
    await writeFile(target, audio)

    const memo = await Memo.create({
      _id: randomUUID(),
      storedPath: target,
      originalName: seed.fileName,
      mimeType: "audio/mpeg",
      byteSize: audio.byteLength,
      keyterms: seed.keyterms,
      status: "uploaded",
    })

    console.log(`  running the pipeline (${seed.label})…`)
    await runPipeline(memo._id)

    const finished = await Memo.findById(memo._id).lean()
    if (finished?.status === "ready") {
      const { Recipe } = await import("@/models/recipe")
      const recipe = await Recipe.findById(finished.recipeId).lean()
      console.log(`  ✓ ${recipe?.title} — ${recipe?.steps.length} steps`)
    } else {
      console.error(
        `  ✗ pipeline ended as ${finished?.status}: ${finished?.error}`
      )
      process.exitCode = 1
    }
  }

  console.log("\nDone. Run `npm run dev` and open the book.")
  const { disconnectMongo } = await import("@/lib/mongo")
  await disconnectMongo()
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
