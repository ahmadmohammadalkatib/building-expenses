import Link from "next/link";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { apartmentList } from "@/lib/services/reports";
import { Badge, Card, Empty, Input, LinkButton, Num, PageHeader, Table, Td, Th, Button } from "@/components/ui";
import { PlusIcon } from "@/components/icons";
import { whatsappLink } from "@/lib/core/phone";

export default async function ApartmentsPage({ searchParams }: { searchParams: Promise<{ q?: string; archived?: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const { q = "", archived } = await searchParams;
  const rows = await apartmentList(db(), { q, archived: archived === "1" });
  return (
    <>
      <PageHeader
        title={t.apartments.title}
        subtitle={`${rows.length}`}
        actions={can(user, "treasurer") ? <LinkButton href="/apartments/new"><PlusIcon className="size-4" />{t.apartments.new}</LinkButton> : null}
      />
      <Card>
        <form className="no-print mb-4 flex flex-wrap items-center gap-2">
          <Input name="q" defaultValue={q} placeholder={`${t.common.search}…`} className="max-w-xs" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="archived" value="1" defaultChecked={archived === "1"} /> {t.apartments.showArchived}
          </label>
          <Button type="submit" variant="secondary">{t.common.apply}</Button>
        </form>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t.apartments.number}</Th>
                <Th>{t.apartments.floor}</Th>
                <Th>{t.common.owner}</Th>
                <Th>{t.common.phone}</Th>
                <Th className="text-end">{t.apartments.outstanding}</Th>
                <Th className="text-end">{t.apartments.credit}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-2">
                  <Td>
                    <Link href={`/apartments/${r.id}`} className="font-semibold text-primary">{r.number}</Link>
                    {r.archived_at ? <span className="ms-2"><Badge>{t.common.archived}</Badge></span> : null}
                  </Td>
                  <Td>{r.floor ?? t.common.none}</Td>
                  <Td>{r.owner_name ?? <span className="text-muted">{t.apartments.noOwner}</span>}</Td>
                  <Td>
                    {r.phone ? (
                      <a className="text-primary" href={whatsappLink(r.phone)} target="_blank" rel="noreferrer"><Num>{r.phone}</Num></a>
                    ) : t.common.none}
                  </Td>
                  <Td className={`text-end font-medium ${r.outstanding > 0 ? "text-danger" : "text-muted"}`}><Num>{f.money(r.outstanding)}</Num></Td>
                  <Td className={`text-end ${r.credit > 0 ? "text-success" : "text-muted"}`}><Num>{f.money(r.credit)}</Num></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty>{t.common.noData}</Empty>
        )}
      </Card>
    </>
  );
}
