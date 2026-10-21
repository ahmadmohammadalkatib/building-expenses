import { getDict } from "@/lib/i18n";
import { LinkButton } from "./ui";
import { ArrowLeftIcon } from "./icons";

export async function NotFoundView() {
  const { t } = await getDict();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <div className="num mb-3 text-5xl font-semibold tracking-tight text-border-strong">404</div>
      <h1 className="text-lg font-semibold">{t.pages.notFoundTitle}</h1>
      <p className="mt-1.5 text-sm text-muted">{t.pages.notFoundBody}</p>
      <LinkButton href="/" variant="secondary" className="mt-6">
        <ArrowLeftIcon className="rtl:rotate-180" />
        {t.pages.backHome}
      </LinkButton>
    </div>
  );
}
