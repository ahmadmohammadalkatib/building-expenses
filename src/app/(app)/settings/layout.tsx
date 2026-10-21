import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { PageHeader } from "@/components/ui";
import { Tabs } from "@/components/tabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!can(user, "admin")) redirect("/");
  const { t } = await getDict();
  return (
    <>
      <PageHeader title={t.settings.title} />
      <Tabs
        items={[
          { href: "/settings", label: t.settings.building },
          { href: "/settings/fees", label: t.settings.fees },
          { href: "/settings/opening", label: t.settings.goLive },
          { href: "/settings/categories", label: t.settings.categories },
          { href: "/settings/users", label: t.settings.users },
        ]}
      />
      <div className="mt-6">{children}</div>
    </>
  );
}
