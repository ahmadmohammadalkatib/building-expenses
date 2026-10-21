import type { Dict } from "@/lib/i18n";
import type { ChargeState } from "@/lib/core/accounting";
import { Badge } from "./ui";

/** "Partially paid · Overdue" — payment status plus a separate overdue flag. */
export function ChargeStatus({ t, state, voided }: { t: Dict; state: ChargeState | null; voided?: boolean }) {
  if (voided || !state) return <Badge tone="neutral">{t.dues.statuses.voided}</Badge>;
  const tone = state.status === "paid" ? "success" : state.status === "partial" ? "warning" : "neutral";
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge tone={tone}>{t.dues.statuses[state.status]}</Badge>
      {state.overdue ? <Badge tone="danger">{t.dues.statuses.overdue}</Badge> : null}
    </span>
  );
}
