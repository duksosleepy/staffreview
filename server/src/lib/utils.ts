import { LocalDate } from "gel";

// Convert date strings (YYYY-MM-DD) to LocalDate objects for EdgeDB
export function convertVariables(
  variables?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!variables) return undefined;

  const converted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(variables)) {
    if (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      key.toLowerCase().includes("date")
    ) {
      converted[key] = new LocalDate(
        Number.parseInt(value.slice(0, 4), 10),
        Number.parseInt(value.slice(5, 7), 10),
        Number.parseInt(value.slice(8, 10), 10),
      );
    } else {
      converted[key] = value;
    }
  }
  return converted;
}
