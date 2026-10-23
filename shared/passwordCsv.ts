/** Chrome password CSV: name,url,username,password,note */

export type PasswordCsvRow = {
  name: string;
  url?: string;
  username?: string;
  password: string;
  notes?: string;
};

export type PasswordCsvExportEntry = {
  name: string;
  url?: string;
  username?: string;
  password: string;
  notes?: string;
  kind?: string;
};

export type ImportDuplicateMatch = {
  id: string;
  ownerId?: string;
};

/** Strip UTF-8 BOM if present. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Parse RFC 4180-style CSV into rows of string fields. */
export function parseCsvRecords(text: string): string[][] {
  const input = stripBom(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\r") {
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += ch;
  }

  row.push(field);
  if (row.length > 1 || row[0] !== "") {
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

const HEADER_ALIASES: Record<string, keyof PasswordCsvRow | "skip"> = {
  name: "name",
  title: "name",
  website: "name",
  url: "url",
  loginuri: "url",
  urllogin: "url",
  username: "username",
  loginusername: "username",
  user: "username",
  email: "username",
  login: "username",
  password: "password",
  loginpassword: "password",
  note: "notes",
  notes: "notes",
  extraproperties: "notes",
  extra: "notes",
  grouping: "skip",
  fav: "skip",
};

function mapHeaders(headers: string[]): Map<number, keyof PasswordCsvRow> {
  const map = new Map<number, keyof PasswordCsvRow>();
  headers.forEach((raw, index) => {
    const key = normalizeHeader(raw);
    const mapped = HEADER_ALIASES[key];
    if (mapped && mapped !== "skip") {
      map.set(index, mapped);
    }
  });
  return map;
}

function rowFromRecord(
  fields: string[],
  columnMap: Map<number, keyof PasswordCsvRow>,
): Partial<PasswordCsvRow> {
  const out: Partial<PasswordCsvRow> = {};
  for (const [index, key] of columnMap) {
    const value = (fields[index] ?? "").trim();
    if (!value) continue;
    if (key === "name") out.name = value;
    else if (key === "url") out.url = value;
    else if (key === "username") out.username = value;
    else if (key === "password") out.password = value;
    else if (key === "notes") out.notes = value;
  }
  return out;
}

/** Normalize URL hostname for duplicate detection (www. stripped, lowercased). */
export function normalizeUrlHost(url?: string): string {
  const trimmed = url?.trim();
  if (!trimmed) return "";
  try {
    const href = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    return new URL(href).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

/** Key for duplicate matching: hostname (or name fallback) + username. */
export function passwordDuplicateKey(
  url: string | undefined,
  username: string | undefined,
  nameFallback?: string,
): string {
  const host =
    normalizeUrlHost(url) || (nameFallback ?? "").trim().toLowerCase();
  const user = (username ?? "").trim().toLowerCase();
  return `${host}|${user}`;
}

export function deriveImportName(row: Partial<PasswordCsvRow>): string {
  const name = row.name?.trim();
  if (name) return name;
  const host = normalizeUrlHost(row.url);
  if (host) return host;
  return "Imported login";
}

/** Parse password-manager CSV exports into normalized rows (skips header). */
export function parsePasswordCsv(text: string): PasswordCsvRow[] {
  const records = parseCsvRecords(text);
  if (records.length === 0) return [];

  const [headerRow, ...dataRows] = records;
  const columnMap = mapHeaders(headerRow);
  if (columnMap.size === 0) return [];

  const rows: PasswordCsvRow[] = [];
  for (const fields of dataRows) {
    const partial = rowFromRecord(fields, columnMap);
    const password = partial.password?.trim();
    if (!password) continue;

    rows.push({
      name: deriveImportName(partial),
      url: partial.url?.trim() || undefined,
      username: partial.username?.trim() || undefined,
      password,
      notes: partial.notes?.trim() || undefined,
    });
  }
  return rows;
}

function csvEscapeField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Serialize entries to Chrome's password CSV format. */
export function serializePasswordCsv(entries: PasswordCsvExportEntry[]): string {
  const lines = ["name,url,username,password,note"];
  for (const entry of entries) {
    const fields = [
      entry.name,
      entry.url ?? "",
      entry.username ?? "",
      entry.password,
      entry.notes ?? "",
    ].map(csvEscapeField);
    lines.push(fields.join(","));
  }
  return lines.join("\n") + (lines.length > 1 ? "\n" : "");
}

export type ExistingPasswordForDedupe = {
  _id: string;
  ownerId?: string;
  url?: string;
  username?: string;
  name: string;
};

/** Pick the best existing row for a duplicate key (prefer caller-owned). */
export function findExistingDuplicate(
  existing: ExistingPasswordForDedupe[],
  row: Pick<PasswordCsvRow, "url" | "username" | "name">,
  callerOwnerId: string,
): ExistingPasswordForDedupe | null {
  const key = passwordDuplicateKey(row.url, row.username, row.name);
  let match: ExistingPasswordForDedupe | null = null;
  for (const entry of existing) {
    const entryKey = passwordDuplicateKey(
      entry.url,
      entry.username,
      entry.name,
    );
    if (entryKey !== key) continue;
    if (entry.ownerId === callerOwnerId) return entry;
    if (!match) match = entry;
  }
  return match;
}

export function entriesForChromeExport(
  entries: PasswordCsvExportEntry[],
  options?: { includeApiKeys?: boolean },
): PasswordCsvExportEntry[] {
  const includeApiKeys = options?.includeApiKeys ?? false;
  return entries.filter((entry) => {
    const kind = entry.kind ?? "password";
    return includeApiKeys || kind === "password";
  });
}
