import mongoose from "mongoose"

import { configureDns } from "@/lib/dns"
import { env } from "@/lib/env"
import { resolveSrvUri } from "@/lib/mongo-uri"

type MongooseCache = {
  connection: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

const globalForMongoose = globalThis as typeof globalThis & {
  __familyRecipeBookMongo?: MongooseCache
}

const cache: MongooseCache = globalForMongoose.__familyRecipeBookMongo ?? {
  connection: null,
  promise: null,
}

globalForMongoose.__familyRecipeBookMongo = cache

export async function connectToMongo(): Promise<typeof mongoose> {
  // Applied on every call, not at module scope: Atlas resolves through an SRV
  // lookup, and a resolver that has not been pointed at public DNS yet fails it.
  configureDns()

  if (cache.connection) {
    return cache.connection
  }

  cache.promise ??= openConnection().catch((error) => {
    cache.promise = null
    throw error
  })

  cache.connection = await cache.promise
  return cache.connection
}

/**
 * The driver's own SRV lookup is refused on some networks even when the record
 * resolves fine, so the first connection can fail every time. Resolving the
 * record ourselves and connecting straight to the shard sidesteps that; if even
 * that fails we fall back to the original URI.
 */
async function openConnection() {
  const configuredUri = env.mongoUri()
  const attempts: string[] = [configuredUri]

  const directUri = await resolveSrvUri(configuredUri).catch(() => null)
  if (directUri && directUri !== configuredUri) {
    attempts.push(directUri)
  }

  let lastError: unknown

  for (const uri of attempts) {
    try {
      return await mongoose.connect(uri, {
        dbName: env.mongoDb(),
        serverSelectionTimeoutMS: 10_000,
      })
    } catch (error) {
      lastError = error
      if (!isDnsError(error)) {
        throw error
      }
      console.warn(
        `MongoDB could not resolve ${uri.startsWith("mongodb+srv") ? "the SRV record" : "the shard host"}; trying the next address form…`
      )
    }
  }

  throw lastError
}

function isDnsError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /querySrv|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/i.test(message)
}

export async function disconnectMongo() {
  cache.connection = null
  cache.promise = null
  await mongoose.disconnect()
}

export function isMongoConnected() {
  return mongoose.connection.readyState === 1
}
