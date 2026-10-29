# FDIC — Bank Health and Financials

The Federal Deposit Insurance Corporation's BankFind and Call Reports data. Quarterly Call Report financials for every FDIC-insured bank in the US (~4,500 institutions), plus failed bank lists, branch maps, and supervisory designations. Free, no auth.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1856+ live data sources. This is an independent, unofficial integration — not affiliated with, endorsed by, or published by the upstream provider.

## Why this matters for AI agents

For bank-level due diligence, deposit-flight risk monitoring, or "is this regional bank in trouble?" questions, FDIC Call Report data is the source. It's how the FDIC and Fed themselves measure bank health: capital ratios, loan delinquencies, deposit composition, asset quality.

Common flows:

- **Bank lookup.** Find a specific institution by name or RSSD ID, get its key financials.
- **Health snapshot.** Capital adequacy ratios (Tier 1, leverage), nonperforming loan rates, allowance coverage, asset/deposit growth.
- **Regional / sector aggregation.** Aggregate by state, asset size class, or business model (community, regional, money-center).
- **Failure / merger history.** Search the FDIC's failed bank list (since 2000) for context on regional patterns.

Used by the `fintech_bank_health_check` compound.

## Auth

None. FDIC's BankFind and Call Report APIs are fully public, free, no key.

## Branch locations and Summary of Deposits

- **`fdic_branches`** lists the current offices of FDIC-insured banks (address, county, latitude/longitude, main-office flag, service type, established date). Filter by `cert`, a bank `name` fragment, or `state` + `city`. Source: FDIC, BankFind institution locations. Reflects the FDIC's current locations file; `data_as_of` is its build time.
- **`fdic_branch_deposits`** returns the FDIC Summary of Deposits: deposits at each branch as of June 30 of a survey year, in **thousands of US dollars**, ranked by branch deposits. `year` defaults to the latest published survey. Source: FDIC, Summary of Deposits.

Identifiers: `cert` is the institution; `office_id` is the FDIC's unique office number and joins the two tools; `branch_number` is the bank's own branch number (0 is the main office). Current locations and Summary of Deposits are different vintages: a branch opened or closed since June 30 appears in one and not the other. US federal data, public domain.

## Update cadence


Banks file Call Reports quarterly with a regulatory deadline of ~30 days after quarter-end. Public release follows within a few additional weeks. So Q1 data publicly visible by mid-May, Q2 by mid-August, etc. Pipeworx caches with TTLs aligned to release windows.

## Bank identifiers

| ID | What it is |
|---|---|
| **RSSD ID** | Federal Reserve's primary bank identifier (Replication Server System for Data); stable across name changes |
| **CERT** | FDIC's certificate number; insurance identifier |
| **FFIEC ID** | Used in Call Reports |

For cross-source linking (Fed + FDIC + OCC), RSSD ID is the canonical key. Use it whenever you have a choice.

## Common pitfalls

- **Call Report consolidation level.** Reports come at the bank-holding-company (BHC) level OR the individual-bank level. They don't aggregate cleanly — totals at one level can differ from sums at the other due to inter-affiliate transactions.
- **Non-FDIC institutions.** Credit unions are NCUA-regulated, not FDIC. They don't appear here. Investment banks (without an insured depository subsidiary) also don't.
- **Failed banks vs. unwound banks.** FDIC failure list = formal receivership. Other institutions exit the industry via voluntary liquidation, merger, or charter conversion — those don't appear as "failed."
- **BankFind's own failures search index can lag.** It names its own last-build time, and that build has gone stale for weeks at a time (found 2026-10-16, fleet #3162: frozen since 2026-08-25, silently undercounting 2026 failures 4 vs the true 6). `fdic_failures` reconciles every call against FDIC's own published Failed Bank List and returns `data_as_of` plus a `warning` whenever the index is missing something newer or is more than two weeks stale.
- **Capital ratio interpretation.** A bank's Tier 1 ratio of 11% is fine in normal times but stretched if loan losses spike. Look at trend, not just snapshot.
- **Deposit concentration.** "Uninsured deposits" (>$250k) is a critical risk metric. Find it in the call report; raw "total deposits" alone misses the deposit-flight-risk story (cf. SVB).

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "fdic": {
      "url": "https://gateway.pipeworx.io/fdic/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/fdic/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1856+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/fdic_search_institutions \
  -H 'Content-Type: application/json' \
  -d '{"search":"Chase"}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/fdic_search_institutions`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Run it from npm

`@pipeworx/mcp-fdic` is a local stdio bridge to the Pipeworx gateway: your MCP client
starts it with `npx`, and it forwards every call to the same
`https://gateway.pipeworx.io/fdic/mcp` endpoint shown above. It needs network access;
there is no offline mode.

```json
{
  "mcpServers": {
    "fdic": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-fdic"]
    }
  }
}
```

Without a key it calls anonymously, capped at 50 calls a day. A free account
raises that to 200 a day: get a key at https://pipeworx.io/signup and add
`"env": { "PIPEWORX_API_KEY": "<your key>" }` to the server entry.
The key is sent as a Bearer token, the same way a hosted connection sends it,
so calls are metered and billed exactly as they are there.

It lists **only** this pack's tools by default. Set `PIPEWORX_META_TOOLS=1` to
also list `ask_pipeworx` and the other gateway-wide tools.

Behind an HTTPS proxy: Node's built-in `fetch` does not read `HTTPS_PROXY` by
default. Newer Node releases honour it when `NODE_USE_ENV_PROXY=1` is set; check
your Node version's documentation.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Fdic data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
