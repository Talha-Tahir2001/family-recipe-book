import dns from "node:dns"

/**
 * Some networks and ISPs refuse SRV lookups for `_mongodb._tcp.*.mongodb.net`,
 * which makes an Atlas `mongodb+srv://` connection fail with
 * `querySrv ECONNREFUSED` even though the cluster is healthy.
 *
 * Setting `DNS_SERVERS=1.1.1.1,8.8.8.8` points Node's resolver at public DNS,
 * which fixes it. `node:dns.setServers` (callback API) is the variant that
 * actually affects SRV lookups — the `node:dns/promises` one does not.
 *
 * Deliberately not guarded by a "already ran" flag: bundlers can evaluate this
 * module before `.env.local` is loaded, and a latch would then permanently skip
 * the configuration. Setting the servers is cheap and idempotent.
 */
export function configureDns() {
  const servers = (process.env.DNS_SERVERS ?? "")
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean)

if (servers.length === 0) {
    return
  }

  dns.setServers(servers)
  dns.setDefaultResultOrder("ipv4first")
}

