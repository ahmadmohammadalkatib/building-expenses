import Link from "next/link";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { fmt, getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { apartmentList } from "@/lib/services/reports";
import { Badge, Card, Checkbox, Empty, FilterBar, LINK, LinkButton, Num, PageHeader, SearchInput, Table, Td, Th } from "@/components/ui";
import { DoorIcon, PlusIcon } from "@/components/icons";
import { whatsappLink } from "@/lib/core/phone";

export default async function ApartmentsPage({ searchParams }: { searchParams: Promise<{ q?: string; archived?: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const { q = "", archived } = await searchParams;
  const rows = await apartmentList(db(), { q, archived: archived === "1" });
  const filtered = !!q || archived === "1";
  return (
    <>
      <PageHeader
        title={t.apartments.title}
        subtitle={fmt(t.common.results, { n: rows.length })}
        actions={can(user, "treasurer") ? <LinkButton href="/apartments/new"><PlusIcon />{t.apartments.new}</LinkButton> : null}
      />
      <Card flush>
        <FilterBar apply={t.common.apply} reset={filtered ? { href: "/apartments", label: t.common.reset } : undefined}>
          <SearchInput name="q" defaultValue={q} placeholder={`${t.common.search}…`} aria-label={t.common.search} className="w-full sm:w-72" />
          <Checkbox name="archived" value="1" defaultChecked={archived === "1"} label={t.apartments.showArchived} className="h-9 items-center" />
        </FilterBar>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t.apartments.number}</Th>
                <Th className="hidden sm:table-cell">{t.apartments.floor}</Th>
                <Th>{t.common.owner}</Th>
                <Th className="hidden md:table-cell">{t.common.phone}</Th>
                <Th className="text-end">{t.apartments.outstanding}</Th>
                <Th className="hidden text-end sm:table-cell">{t.apartments.credit}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <span className="inline-flex items-center gap-2">
                      <Link href={`/apartments/${r.id}`} className={LINK}>{r.number}</Link>
                      {r.archived_at ? <Badge>{t.common.archived}</Badge> : null}
                    </span>
                  </Td>
                  <Td className="hidden text-text-2 sm:table-cell">{r.floor ?? <span className="text-muted">{t.common.none}</span>}</Td>
                  <Td className="max-w-48 truncate">{r.owner_name ?? <span className="text-muted">{t.apartments.noOwner}</span>}</Td>
                  <Td className="hidden md:table-cell">
                    {r.phone ? (
                      <a className="text-text-2 transition-colors hover:text-primary" href={whatsappLink(r.phone)} target="_blank" rel="noreferrer">
                        <Num>{r.phone}</Num>
                      </a>
                    ) : (
                      <span className="text-muted">{t.common.none}</span>
                    )}
                  </Td>
                  <Td className={`text-end font-medium ${r.outstanding > 0 ? "text-danger" : "text-muted"}`}><Num>{f.money(r.outstanding)}</Num></Td>
                  <Td className={`hidden text-end sm:table-cell ${r.credit > 0 ? "text-success" : "text-muted"}`}><Num>{f.money(r.credit)}</Num></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty
            icon={<DoorIcon />}
            action={!filtered && can(user, "treasurer") ? <LinkButton href="/apartments/new" variant="secondary"><PlusIcon />{t.apartments.new}</LinkButton> : null}
          >
            {t.common.noData}
          </Empty>
        )}
      </Card>
    </>
  );
}
