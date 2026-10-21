import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { Badge, Card, Empty, Field, FilterBar, LinkButton, PageHeader, SearchInput, Table, Td, Th } from "@/components/ui";
import { ArrowRightIcon, ChevronDownIcon, HistoryIcon } from "@/components/icons";

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
      <Card flush>
        <FilterBar apply={t.common.apply} reset={q || before ? { href: "/audit", label: t.common.reset } : undefined}>
          <Field label={t.common.search} className="w-full sm:w-72"><SearchInput name="q" defaultValue={q} /></Field>
        </FilterBar>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t.common.date}</Th>
                <Th>{t.audit.user}</Th>
                <Th>{t.audit.action}</Th>
                <Th>{t.audit.entity}</Th>
                <Th>{t.audit.details}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <Td className="whitespace-nowrap text-text-2">{f.dateTime(r.at)}</Td>
                  <Td><span dir="ltr" className="text-text-2">{r.user_email ?? "system"}</span></Td>
                  <Td><Badge>{r.action}</Badge></Td>
                  <Td className="font-medium">{r.entity}</Td>
                  <Td>
                    <details className="group">
                      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-xs font-medium text-primary">
                        <span className="num">{r.entity_id?.slice(0, 8) ?? "…"}</span>
                        <ChevronDownIcon className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
                      </summary>
                      <pre dir="ltr" className="mt-2 max-w-xl overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-2 p-3 text-start font-mono text-xs leading-relaxed text-text-2">
                        {JSON.stringify(r.details, null, 2)}
                      </pre>
                    </details>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty icon={<HistoryIcon />}>{t.common.noData}</Empty>
        )}
        {rows.length === PAGE ? (
          <div className="flex justify-center border-t border-border p-4">
            <LinkButton variant="secondary" href={`/audit?q=${encodeURIComponent(q)}&before=${rows[rows.length - 1].id}`}>
              {t.common.olderEntries}
              <ArrowRightIcon className="rtl:rotate-180" />
            </LinkButton>
          </div>
        ) : null}
      </Card>
    </>
  );
}
