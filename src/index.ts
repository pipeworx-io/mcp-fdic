interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * FDIC MCP — FDIC BankFind Suite API (free, no auth)
 *
 * Tools:
 * - fdic_search_institutions: search for banks/institutions by name
 * - fdic_get_institution: get details for a specific bank by CERT number
 * - fdic_financials: get financial data (call reports) for a bank
 * - fdic_failures: list bank failures
 * - fdic_summary: get industry aggregate data
 */


const BASE = 'https://banks.data.fdic.gov/api';

// ── Tool definitions ──────────────────────────────────────────────────

const tools: McpToolExport['tools'] = [
  {
    name: 'fdic_search_institutions',
    description:
      'Search for FDIC-insured banks and institutions by name. Returns institution name, CERT number, city, state, total assets, deposits, net income, ROA, ROE, and report date.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        search: {
          type: 'string',
          description: 'Bank or institution name to search for (e.g., "Chase", "Wells Fargo")',
        },
        limit: {
          type: 'number',
          description: 'Number of results to return (default 10)',
        },
      },
      required: ['search'],
    },
  },
  {
    name: 'fdic_get_institution',
    description:
      'Get detailed information for a specific FDIC-insured bank by its CERT (certificate) number. Returns full institution profile including name, location, assets, and regulatory details.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        cert: {
          type: 'string',
          description: 'FDIC certificate number (e.g., "628" for Chase)',
        },
      },
      required: ['cert'],
    },
  },
  {
    name: 'fdic_financials',
    description:
      'Get financial call report data for a bank by CERT number. Returns quarterly financial metrics including total assets, deposits, net income, interest income, loan losses, ROA, ROE, and efficiency ratio.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        cert: {
          type: 'string',
          description: 'FDIC certificate number',
        },
        limit: {
          type: 'number',
          description: 'Number of quarterly reports to return (default 8, which is 2 years)',
        },
      },
      required: ['cert'],
    },
  },
  {
    name: 'fdic_failures',
    description:
      'List FDIC bank failures, sorted by most recent. Optionally filter by date range. Returns bank name, city, state, CERT, failure date, acquiring institution, and fund used.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Number of failure records to return (default 20)',
        },
        start_date: {
          type: 'string',
          description: 'Start date filter in MM/DD/YYYY format (e.g., "01/01/2023")',
        },
        end_date: {
          type: 'string',
          description: 'End date filter in MM/DD/YYYY format (e.g., "12/31/2023")',
        },
      },
    },
  },
  {
    name: 'fdic_summary',
    description:
      'Get aggregate industry summary data for all FDIC-insured institutions for a given reporting date. Returns total assets, deposits, net income, interest income, number of loans, and institution count.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'Report date in YYYYMMDD format (e.g., "20240331" for Q1 2024)',
        },
      },
      required: ['date'],
    },
  },
];

// ── callTool dispatcher ───────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'fdic_search_institutions':
      return searchInstitutions(args.search as string, (args.limit as number) ?? 10);
    case 'fdic_get_institution':
      return getInstitution(args.cert as string);
    case 'fdic_financials':
      return getFinancials(args.cert as string, (args.limit as number) ?? 8);
    case 'fdic_failures':
      return getFailures(
        (args.limit as number) ?? 20,
        args.start_date as string | undefined,
        args.end_date as string | undefined,
      );
    case 'fdic_summary':
      return getSummary(args.date as string);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

async function fdicGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FDIC API error (${res.status}): ${text}`);
  }
  return res.json();
}

// ── Tool implementations ─────────────────────────────────────────────

async function searchInstitutions(search: string, limit: number) {
  const fields = 'INSTNAME,CERT,CITY,STNAME,ASSET,DEP,NETINC,ROA,ROE,RISDATE';
  const url = `/institutions?search=${encodeURIComponent(search)}&limit=${limit}&fields=${fields}`;
  const data = (await fdicGet(url)) as {
    data: { data: Record<string, unknown> }[];
    totals: { count: number };
  };

  return {
    query: search,
    total_results: data.totals?.count ?? data.data?.length ?? 0,
    institutions: (data.data ?? []).map((row) => ({
      name: row.data.INSTNAME ?? null,
      cert: row.data.CERT ?? null,
      city: row.data.CITY ?? null,
      state: row.data.STNAME ?? null,
      total_assets: row.data.ASSET ?? null,
      total_deposits: row.data.DEP ?? null,
      net_income: row.data.NETINC ?? null,
      roa: row.data.ROA ?? null,
      roe: row.data.ROE ?? null,
      report_date: row.data.RISDATE ?? null,
    })),
  };
}

async function getInstitution(cert: string) {
  const data = (await fdicGet(`/institutions/${encodeURIComponent(cert)}`)) as {
    data: { data: Record<string, unknown> }[];
  };

  const row = data.data?.[0]?.data;
  if (!row) throw new Error(`No institution found for CERT: ${cert}`);

  return row;
}

async function getFinancials(cert: string, limit: number) {
  const fields = 'REPDTE,ASSET,DEP,NETINC,INTINC,ELNATR,NITEFULL,ROA,ROE,EEFFR';
  const url = `/financials?filters=CERT%3A${encodeURIComponent(cert)}&sort_by=REPDTE&sort_order=DESC&limit=${limit}&fields=${fields}`;
  const data = (await fdicGet(url)) as {
    data: { data: Record<string, unknown> }[];
    totals: { count: number };
  };

  return {
    cert,
    total_reports: data.totals?.count ?? data.data?.length ?? 0,
    financials: (data.data ?? []).map((row) => ({
      report_date: row.data.REPDTE ?? null,
      total_assets: row.data.ASSET ?? null,
      total_deposits: row.data.DEP ?? null,
      net_income: row.data.NETINC ?? null,
      interest_income: row.data.INTINC ?? null,
      loan_losses: row.data.ELNATR ?? null,
      net_interest_margin: row.data.NITEFULL ?? null,
      roa: row.data.ROA ?? null,
      roe: row.data.ROE ?? null,
      efficiency_ratio: row.data.EEFFR ?? null,
    })),
  };
}

async function getFailures(limit: number, startDate?: string, endDate?: string) {
  let url = `/failures?sort_by=FAILDATE&sort_order=DESC&limit=${limit}`;
  const filters: string[] = [];
  if (startDate) filters.push(`FAILDATE_MIN:${encodeURIComponent(startDate)}`);
  if (endDate) filters.push(`FAILDATE_MAX:${encodeURIComponent(endDate)}`);
  if (filters.length > 0) url += `&filters=${filters.join(',')}`;

  const data = (await fdicGet(url)) as {
    data: { data: Record<string, unknown> }[];
    totals: { count: number };
  };

  return {
    total_failures: data.totals?.count ?? data.data?.length ?? 0,
    filters: {
      start_date: startDate ?? null,
      end_date: endDate ?? null,
    },
    failures: (data.data ?? []).map((row) => ({
      name: row.data.NAME ?? null,
      cert: row.data.CERT ?? null,
      city: row.data.CITYST ?? row.data.CITY ?? null,
      state: row.data.STALP ?? null,
      failure_date: row.data.FAILDATE ?? null,
      acquiring_institution: row.data.ACQUIRER ?? null,
      fund: row.data.FUND ?? null,
      total_deposits: row.data.TOTALDEPOSITS ?? null,
      total_assets: row.data.COST ?? null,
    })),
  };
}

async function getSummary(date: string) {
  const fields = 'ASSET,DEP,NETINC,INTINC,NUML,INSTCNT';
  const url = `/summary?filters=REPDTE%3A${encodeURIComponent(date)}&fields=${fields}`;
  const data = (await fdicGet(url)) as {
    data: { data: Record<string, unknown> }[];
    totals: { count: number };
  };

  if (!data.data?.length) throw new Error(`No summary data found for date: ${date}`);

  return {
    report_date: date,
    total_records: data.totals?.count ?? data.data.length,
    summary: (data.data ?? []).map((row) => ({
      total_assets: row.data.ASSET ?? null,
      total_deposits: row.data.DEP ?? null,
      net_income: row.data.NETINC ?? null,
      interest_income: row.data.INTINC ?? null,
      number_of_loans: row.data.NUML ?? null,
      institution_count: row.data.INSTCNT ?? null,
    })),
  };
}

export default { tools, callTool, meter: { credits: 5 } } satisfies McpToolExport;
