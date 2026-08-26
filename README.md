# FDIC — Bank Health and Financials

The Federal Deposit Insurance Corporation's BankFind and Call Reports data. Quarterly Call Report financials for every FDIC-insured bank in the US (~4,500 institutions), plus failed bank lists, branch maps, and supervisory designations. Free, no auth.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1476+ live data sources.

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

Both URLs reach the same gateway and the same 1476+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

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
