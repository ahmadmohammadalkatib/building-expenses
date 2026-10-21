import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { listFees, } from "@/lib/services/setup";
import { generatedMonths } from "@/lib/services/ledger";
import { nextUngeneratedMonth } from "@/lib/core/accounting";
import { today } from "@/lib/services/common";
import { apartmentList } from "@/lib/services/reports";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Empty, Field, Input, Num, Select, Table, Td, Th } from "@/components/ui";
import { addFeeAction } from "../actions";

export default async function FeesPage() {
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const sql = db();
  const [fees, gen, d, apts] = await Promise.all([listFees(sql), generatedMonths(sql), today(sql), apartmentList(sql, {})]);
  const nextMonth = nextUngeneratedMonth(d, gen).slice(0, 7);
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card title={t.settings.fees} className="lg:col-span-3">
        <p className="mb-3 text-sm text-muted">{t.settings.feesHelp}</p>
        {fees.length ? (
          <Table>
            <thead>
              <tr><Th>{t.settings.scope}</Th><Th>{t.settings.effectiveFrom}</Th><Th className="text-end">{t.settings.feeAmount}</Th><Th>{t.common.notes}</Th></tr>
            </thead>
            <tbody>
              {fees.map((r) => (
                <tr key={r.id}>
                  <Td>{r.apartment_number ? `${t.common.apartment} ${r.apartment_number}` : t.settings.allApartments}</Td>
                  <Td>{f.month(r.effective_from)}</Td>
                  <Td className="text-end font-medium"><Num>{f.money(r.amount)}</Num></Td>
                  <Td className="text-muted">{r.note}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty>{t.common.noData}</Empty>
        )}
      </Card>
      <Card title={t.common.add} className="lg:col-span-2">
        <ActionForm action={addFeeAction} resetOnSuccess>
          <Field label={t.settings.scope}>
            <Select name="apartment_id" defaultValue="">
              <option value="">{t.settings.allApartments}</option>
              {apts.map((a) => (
                <option key={a.id} value={a.id}>{`${t.common.apartment} ${a.number}`}</option>
              ))}
            </Select>
          </Field>
          <Field label={`${t.settings.feeAmount} (₪)`}>
            <Input name="amount" inputMode="decimal" required dir="ltr" />
          </Field>
          <Field label={t.settings.effectiveFrom}>
            <Input name="month" type="month" required min={nextMonth} defaultValue={nextMonth} />
          </Field>
          <Field label={t.common.notes}>
            <Input name="note" />
          </Field>
          <SubmitButton>{t.common.add}</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
