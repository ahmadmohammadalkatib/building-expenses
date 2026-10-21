import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { Button, Card, Field, Input, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";

const PAGE = 100;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; before?: string }> }) {
  const user = await requireUser();
  if (!can(user, "admin")) redirect("/");
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const before = Number(sp.before) || null;
  const rows = await db()<
    { id: number; at: string; user_email: string | null; action: string; entity: string; entity_id: string | null; details: unknown }[]
  >`
    select id, at, user_email, action, entity, entity_id, details from audit_log
    where (${before}::bigint is null or id < ${before}::bigint)
      and (${q} = '' or entity ilike ${"%" + q + "%"} or action ilike ${"%" + q + "%"} or coalesce(user_email,'') ilike ${"%" + q + "%"} or details::text ilike ${"%" + q + "%"})
    order by id desc limit ${PAGE}`;
  return (
    <>
      <PageHeader title={t.audit.title} />
      <Card>
        <form className="mb-4 flex items-end gap-2">
          <Field label={t.common.search}><Input name="q" defaultValue={q} /></Field>
          <Button type="submit" variant="secondary">{t.common.apply}</Button>
        </form>
        <Table>
          <thead><tr><Th>{t.common.date}</Th><Th>{t.audit.user}</Th><Th>{t.audit.action}</Th><Th>{t.audit.entity}</Th><Th>{t.audit.details}</Th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap text-muted">{f.dateTime(r.at)}</Td>
                <Td><span dir="ltr">{r.user_email}</span></Td>
                <Td>{r.action}</Td>
                <Td>{r.entity}</Td>
                <Td>
                  <details>
                    <summary className="cursor-pointer text-xs text-primary">{r.entity_id?.slice(0, 8) ?? "…"}</summary>
                    <pre dir="ltr" className="mt-1 max-w-xl overflow-x-auto whitespace-pre-wrap rounded bg-surface-2 p-2 text-start text-xs">{JSON.stringify(r.details, null, 2)}</pre>
                  </details>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {rows.length === PAGE ? (
          <div className="mt-4">
            <LinkButton variant="secondary" href={`/audit?q=${encodeURIComponent(q)}&before=${rows[rows.length - 1].id}`}>›</LinkButton>
          </div>
        ) : null}
      </Card>
    </>
  );
}
