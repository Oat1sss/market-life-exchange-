/**
 * Default recurring expenses, snapshotted per game at creation so a costing
 * change never rewrites history. Single source of truth for seeding and the
 * game-creation service.
 */
export interface ExpenseDefault {
  label: string;
  category: "RENT" | "FOOD" | "TRANSPORT" | "SUBSCRIPTION";
  amountMinor: bigint;
  cadence: "MONTHLY";
}

export const DEFAULT_EXPENSES: ExpenseDefault[] = [
  { label: "Rent", category: "RENT", amountMinor: 5_000n, cadence: "MONTHLY" },
  { label: "Food", category: "FOOD", amountMinor: 1_500n, cadence: "MONTHLY" },
  { label: "Transport", category: "TRANSPORT", amountMinor: 600n, cadence: "MONTHLY" },
  { label: "Phone subscription", category: "SUBSCRIPTION", amountMinor: 250n, cadence: "MONTHLY" },
];
