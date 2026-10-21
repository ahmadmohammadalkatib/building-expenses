import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { listCategories } from "@/lib/services/setup";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Checkbox, Input } from "@/components/ui";
import { saveCategoryAction } from "../actions";

const ROW = "grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_1fr_5rem_7rem_auto] sm:gap-3";

export default async function CategoriesPage() {
  const { t } = await getDict();
  const cats = await listCategories(db(), true);
  return (
    <div className="max-w-4xl space-y-6">
      <Card title={t.settings.categories} flush>
        <div className={`hidden border-b border-border bg-surface-2/60 px-5 py-2.5 text-xs font-medium text-muted sm:grid ${ROW}`}>
          <span>{t.settings.nameAr}</span>
          <span>{t.settings.nameEn}</span>
          <span>#</span>
          <span>{t.common.status}</span>
          <span className="w-16" />
        </div>
        <div className="divide-y divide-border">
          {cats.map((c) => (
            <ActionForm key={c.id} action={saveCategoryAction} className={`px-4 py-3 sm:px-5${c.archived ? "bg-surface-2/40" : ""}`}>
              <div className={ROW}>
                <input type="hidden" name="id" value={c.id} />
                <Input name="name_ar" defaultValue={c.name_ar} required aria-label={t.settings.nameAr} />
                <Input name="name_en" defaultValue={c.name_en} dir="ltr" aria-label={t.settings.nameEn} />
                <Input name="sort" type="number" defaultValue={c.sort} aria-label="#" />
                <Checkbox name="archived" defaultChecked={c.archived} label={t.common.archived} />
                <SubmitButton variant="secondary">{t.common.save}</SubmitButton>
              </div>
            </ActionForm>
          ))}
        </div>
      </Card>
      <Card title={t.common.add}>
        <ActionForm action={saveCategoryAction} resetOnSuccess>
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input name="name_ar" placeholder={t.settings.nameAr} aria-label={t.settings.nameAr} required />
            <Input name="name_en" placeholder={t.settings.nameEn} aria-label={t.settings.nameEn} dir="ltr" />
            <SubmitButton>{t.common.add}</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
