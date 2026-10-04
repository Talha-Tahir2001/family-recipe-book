import { MongoClient } from "mongodb"

import { configureDns } from "@/lib/dns"
import { env } from "@/lib/env"
import { VECTOR_INDEX_NAME } from "@/lib/search"

const INDEX_NAME = VECTOR_INDEX_NAME

/**
 * Creates the Atlas Vector Search index on `recipes.embedding` through the Node
 * driver, which is supported on the free M0 tier. PLAN.MD §4.3.
 */
async function main() {
  configureDns()

  const dimensions = env.embeddingDimensions()
  const client = new MongoClient(env.mongoUri(), {
    serverSelectionTimeoutMS: 15_000,
  })

  try {
    await client.connect()
    const db = client.db(env.mongoDb())

    const recipes = db.collection("recipes")

    const collections = await db.listCollections().toArray()
    if (!collections.some((entry) => entry.name === "recipes")) {
      await db.createCollection("recipes")
      console.log('Created empty collection "recipes" (indexes need it to exist).')
    }

    const existing = await recipes
      .listSearchIndexes()
      .toArray()
      .catch(() => [] as { name: string }[])

    const alreadyThere = existing.find((index) => index.name === INDEX_NAME)
    if (alreadyThere) {
      console.log(`Index "${INDEX_NAME}" already exists — leaving it alone.`)
      console.log(JSON.stringify(alreadyThere, null, 2))
      return
    }

    await recipes.createSearchIndexes([
      {
        name: INDEX_NAME,
        type: "vectorSearch",
        definition: {
          fields: [
            {
              type: "vector",
              path: "embedding",
              numDimensions: dimensions,
              similarity: "cosine",
            },
            { type: "filter", path: "tags" },
          ],
        },
      },
    ])

    console.log(
      `Created "${INDEX_NAME}" (${dimensions}-dim cosine, tag filter).`
    )
    console.log("It builds in the background; watch progress in the Atlas UI.")
  } finally {
    await client.close()
  }
}

void main().catch((error) => {
  console.error("Could not create the vector index:", error)
  process.exitCode = 1
})
