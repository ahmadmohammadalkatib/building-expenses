import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { listCategories } from "@/lib/services/setup";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Input } from "@/components/ui";
import { saveCategoryAction } from "../actions";

export default async function CategoriesPage() {
  const { t } = await getDict();
  const cats = await listCategories(db(), true);
  return (
    <div className="max-w-3xl space-y-4">
      <Card title={t.settings.categories}>
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_1fr_5rem_6rem_auto] gap-2 px-1 text-xs font-semibold text-muted sm:grid">
            <span>{t.settings.nameAr}</span><span>{t.settings.nameEn}</span><span>#</span><span>{t.common.archived}</span><span />
          </div>
          {cats.map((c) => (
            <ActionForm key={c.id} action={saveCategoryAction} className="space-y-1">
              <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_1fr_5rem_6rem_auto]">
                <input type="hidden" name="id" value={c.id} />
                <Input name="name_ar" defaultValue={c.name_ar} required aria-label={t.settings.nameAr} />
                <Input name="name_en" defaultValue={c.name_en} dir="ltr" aria-label={t.settings.nameEn} />
                <Input name="sort" type="number" defaultValue={c.sort} aria-label="#" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="archived" defaultChecked={c.archived} /> {t.common.archived}
                </label>
                <SubmitButton variant="secondary">{t.common.save}</SubmitButton>
              </div>
            </ActionForm>
          ))}
        </div>
      </Card>
      <Card title={t.common.add}>
        <ActionForm action={saveCategoryAction} resetOnSuccess>
          <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input name="name_ar" placeholder={t.settings.nameAr} required />
            <Input name="name_en" placeholder={t.settings.nameEn} dir="ltr" />
            <SubmitButton>{t.common.add}</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
