import { fmt, type Dict } from "@/lib/i18n";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Dialog } from "@/components/dialog";
import { Field, Input, Textarea } from "@/components/ui";
import { EditIcon, TrashIcon } from "@/components/icons";
import { deleteApartmentAction, updateApartmentAction } from "./actions";

type Apt = { id: string; number: string; floor: number | null; billing_start_month: string; notes: string };

/** Edit number, floor, billing start and notes. */
export function EditApartmentDialog({ t, apt, defaultOpen }: { t: Dict; apt: Apt; defaultOpen?: boolean }) {
  return (
    <Dialog label={t.common.edit} icon={<EditIcon />} title={t.apartments.editDetails} closeLabel={t.common.close} defaultOpen={defaultOpen}>
      <ActionForm action={updateApartmentAction}>
        <input type="hidden" name="id" value={apt.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.apartments.number}><Input name="number" defaultValue={apt.number} required /></Field>
          <Field label={t.apartments.floor}><Input name="floor" type="number" defaultValue={apt.floor ?? ""} /></Field>
          <Field label={t.apartments.billingStart} help={t.apartments.billingStartHelp} className="sm:col-span-2">
            <Input name="billing_start" type="month" defaultValue={apt.billing_start_month.slice(0, 7)} required />
          </Field>
          <Field label={t.common.notes} className="sm:col-span-2"><Textarea name="notes" defaultValue={apt.notes} /></Field>
        </div>
        <div className="flex justify-end"><SubmitButton>{t.common.save}</SubmitButton></div>
      </ActionForm>
    </Dialog>
  );
}

/** Permanent delete, confirmed by typing the apartment number. Only offered when nothing was paid or adjusted. */
export function DeleteApartmentDialog({ t, id, number, compact }: { t: Dict; id: string; number: string; compact?: boolean }) {
  return (
    <Dialog
      label={compact ? <span className="sr-only">{`${t.apartments.delete} ${number}`}</span> : t.apartments.delete}
      icon={<TrashIcon />}
      variant={compact ? "dangerSoft" : "danger"}
      size={compact ? "sm" : "md"}
      tone="danger"
      title={`${t.apartments.delete} ${number}`}
      description={t.apartments.deleteHelp}
      closeLabel={t.common.close}
    >
      <ActionForm action={deleteApartmentAction}>
        <input type="hidden" name="id" value={id} />
        <Field label={fmt(t.apartments.deleteConfirmLabel, { apt: number })}>
          <Input name="confirm" required autoComplete="off" />
        </Field>
        <div className="flex justify-end"><SubmitButton variant="danger">{t.apartments.deleteConfirm}</SubmitButton></div>
      </ActionForm>
    </Dialog>
  );
}
