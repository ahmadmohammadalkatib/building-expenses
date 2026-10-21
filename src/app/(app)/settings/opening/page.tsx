import Link from "next/link";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { getSettings } from "@/lib/services/common";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Badge, Card, Empty, Field, Input, LINK, LinkButton, Num, Select, Table, Td, Th } from "@/components/ui";
import { ArrowRightIcon, ScaleIcon } from "@/components/icons";
import { openingBalanceAction } from "../actions";

export default async function OpeningBalancesPage() {
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const sql = db();
  const s = await getSettings(sql);
  const apts = await sql<{ id: string; number: string }[]>`select id, number from apartments where archived_at is null order by length(number), number`;
  const rows = await sql<{ id: string; number: string; apartment_id: string; type: string; amount: number; status: string }[]>`
    select c.id, a.number, a.id as apartment_id, 'arrears' as type, c.amount, c.status from charges c join apartments a on a.id = c.apartment_id where c.kind = 'opening'
    union all
    select p.id, a.number, a.id, 'credit', p.amount, p.status from payments p join apartments a on a.id = p.apartment_id where p.kind = 'opening_credit'
    order by number`;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-5">
      <Card title={t.settings.goLive} description={t.settings.goLiveHelp} flush className="lg:col-span-3">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t.common.apartment}</Th>
                <Th>{t.dues.kind}</Th>
                <Th className="text-end">{t.common.amount}</Th>
                <Th><span className="sr-only">{t.common.view}</span></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.status === "voided" ? "text-muted line-through" : ""}>
                  <Td><Link className={LINK} href={`/apartments/${r.apartment_id}`}>{r.number}</Link></Td>
                  <Td>
                    <Badge tone={r.type === "credit" ? "success" : "warning"} dot>
                      {r.type === "credit" ? t.settings.openingCredit : t.settings.openingArrears}
                    </Badge>
                  </Td>
                  <Td className="text-end font-medium"><Num>{f.money(r.amount)}</Num></Td>
                  <Td className="text-end">
                    <LinkButton href={r.type === "credit" ? `/payments/${r.id}` : `/dues/${r.id}`} variant="ghost" size="sm">
                      {t.common.view}
                      <ArrowRightIcon className="rtl:rotate-180" />
                    </LinkButton>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty icon={<ScaleIcon />}>{t.common.noData}</Empty>
        )}
      </Card>
      <Card title={t.common.add} className="lg:col-span-2">
        {!s.opening_date ? (
          <Alert tone="warning">{t.errors.opening_not_set}</Alert>
        ) : (
          <ActionForm action={openingBalanceAction} resetOnSuccess>
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">{t.settings.openingDate}: <span className="font-medium text-text">{f.date(s.opening_date)}</span></p>
            <Field label={t.common.apartment}>
              <Select name="apartment_id" required>
                {apts.map((a) => <option key={a.id} value={a.id}>{a.number}</option>)}
              </Select>
            </Field>
            <Field label={t.dues.kind}>
              <Select name="type">
                <option value="arrears">{t.settings.openingArrears}</option>
                <option value="credit">{t.settings.openingCredit}</option>
              </Select>
            </Field>
            <Field label={`${t.common.amount} (₪)`}>
              <Input name="amount" inputMode="decimal" required dir="ltr" placeholder="0.00" />
            </Field>
            <SubmitButton className="w-full">{t.common.add}</SubmitButton>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
