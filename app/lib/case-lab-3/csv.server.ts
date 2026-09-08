import "server-only";

export type CsvColumn<T extends Record<string, unknown>> = {
  key: keyof T;
  label: string;
};

export function neutralizeSpreadsheetFormula(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /^[=+\-@]/u.test(text) ? `'${text}` : text;
}

function escapeCsvCell(value: unknown): string {
  const text = neutralizeSpreadsheetFormula(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildCsv<T extends Record<string, unknown>>(
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
): string {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(",");
  const body = rows.map((row) => columns.map((column) => escapeCsvCell(row[column.key])).join(","));
  return `${[header, ...body].join("\r\n")}\r\n`;
}
