import nodeDns from "node:dns"
import { resolveSrv } from "node:dns/promises"

import { configureDns } from "@/lib/dns"

/**
 * Some environments refuse `_mongodb._tcp.*.mongodb.net` lookups from the MongoDB
 * driver's own resolver even though the record is fine, so every cold-start
 * `mongoose.connect()` fails with `querySrv ECONNREFUSED`.
 *
 * `configureDns()` is called here as well as in the connection path on purpose:
 * in this bundler, `dns.setServers()` only affects lookups issued from the same
 * module, so the resolver has to be configured in the module doing the lookup.
 */
export async function resolveSrvUri(uri: string): Promise<string | null> {
  if (!uri.startsWith("mongodb+srv://")) {
    return null
  }

  configureDns()
  nodeDns.setDefaultResultOrder("ipv4first")

  const withoutScheme = uri.slice("mongodb+srv://".length)
  const atIndex = withoutScheme.lastIndexOf("@")
  if (atIndex === -1) {
    return null
  }

  const credentials = withoutScheme.slice(0, atIndex + 1)
  const hostAndPath = withoutScheme.slice(atIndex + 1)

  const slashIndex = hostAndPath.indexOf("/")
  const hostname =
    slashIndex === -1 ? hostAndPath : hostAndPath.slice(0, slashIndex)
  const pathAndQuery =
    slashIndex === -1 ? "/" : hostAndPath.slice(slashIndex)

  if (!hostname || hostname.includes(":")) {
    return null
  }

  try {
    const records = await resolveSrv(`_mongodb._tcp.${hostname}`)
    if (records.length === 0) return null
    const record = records[0]

    const [query] = pathAndQuery.split("#")
    const params = new URLSearchParams(query.replace(/^\//, ""))
    params.set("tls", "true")
    params.set("directConnection", "true")
    params.set("authSource", "admin")
    if (!params.has("appName")) {
      params.set("appName", "family-recipe-book")
    }

    return `mongodb://${credentials}${record.name}:${record.port}/?${params.toString()}`
  } catch (error) {
    console.warn(
      `Manual SRV lookup for ${hostname} failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    return null
  }
}