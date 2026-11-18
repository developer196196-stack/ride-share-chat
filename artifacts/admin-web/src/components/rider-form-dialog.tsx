'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Save, UserPlus } from 'lucide-react';
import { adminApi, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RiderAvatar } from '@/components/page-header';

/** Same choices as the app's Profile Setup (OpenAPI `RideStyle`). */
const RIDE_STYLES = [
  { value: 'party_tech', label: 'Party & Tech' },
  { value: 'networking', label: 'Networking' },
  { value: 'deep_talks', label: 'Deep Talks' },
  { value: 'just_chilling', label: 'Just Chilling' },
] as const;
type RideStyle = (typeof RIDE_STYLES)[number]['value'];

type Form = {
  phoneNumber: string;
  displayName: string;
  homeCity: string;
  rideStyle: RideStyle;
  incognitoDropoff: boolean;
};
type Errors = Partial<Record<keyof Form, string>>;

const BLANK: Form = { phoneNumber: '', displayName: '', homeCity: '', rideStyle: 'party_tech', incognitoDropoff: true };

/** "+1 (555) 123-4567" -> "+15551234567". */
const normalizePhone = (value: string) => value.replace(/[\s().-]/g, '');

/** Mirrors the API checks (admin.controller.ts CreateRiderBody) so mistakes show next to the field. */
function validate(f: Form): Errors {
  const e: Errors = {};
  if (!/^\+[1-9]\d{6,14}$/.test(normalizePhone(f.phoneNumber))) {
    e.phoneNumber = 'Use international format with the country code, e.g. +1 555 123 4567';
  }
  const name = f.displayName.trim();
  if (name.length < 3 || name.length > 24) e.displayName = 'Between 3 and 24 characters';
  else if (!/^[A-Za-z0-9._]+$/.test(name)) e.displayName = 'Letters, numbers, dots and underscores only';
  const city = f.homeCity.trim();
  if (city.length < 2 || city.length > 60) e.homeCity = 'Between 2 and 60 characters';
  return e;
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[11.5px] font-semibold text-foreground/80">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-[11px] text-primary">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** The rider being edited (fields from the admin rider endpoints). */
export type EditableRider = {
  uid: string;
  phoneNumber: string | null;
  displayName: string | null;
  homeCity: string | null;
  rideStyle: string | null;
  incognitoDropoff?: boolean;
};

function formOf(rider: EditableRider | null | undefined): Form {
  if (!rider) return BLANK;
  return {
    phoneNumber: rider.phoneNumber ?? '',
    displayName: rider.displayName ?? '',
    homeCity: rider.homeCity ?? '',
    rideStyle: RIDE_STYLES.some((s) => s.value === rider.rideStyle) ? (rider.rideStyle as RideStyle) : 'party_tech',
    incognitoDropoff: rider.incognitoDropoff ?? true,
  };
}

/**
 * Add a rider by phone number, or edit one (`rider`). Adding creates their account and a finished
 * profile; when they sign in on the app with that number they go straight in, without Profile Setup.
 */
export function RiderFormDialog({
  open,
  onOpenChange,
  rider,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rider?: EditableRider | null;
  onSaved: (uid: string) => void;
}) {
  const editing = rider != null;
  const [form, setForm] = useState<Form>(() => formOf(rider));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  // Fresh values each time the dialog opens (not on every background refresh of `rider`).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(formOf(rider));
      setErrors({});
    }
  }
  const phoneChanged = editing && normalizePhone(form.phoneNumber) !== (rider?.phoneNumber ?? '');

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const close = (next: boolean) => {
    if (busy) return;
    onOpenChange(next);
  };

  const save = async () => {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      const phoneNumber = normalizePhone(form.phoneNumber);
      const name = form.displayName.trim();
      const body = {
        phoneNumber,
        displayName: name,
        homeCity: form.homeCity.trim(),
        rideStyle: form.rideStyle,
        incognitoDropoff: form.incognitoDropoff,
      };
      let uid: string;
      if (editing) {
        uid = rider.uid;
        await adminApi(`/users/${uid}`, { method: 'PUT', body });
        toast.success(phoneChanged ? `${name} saved. They now sign in with ${phoneNumber}.` : `${name} saved.`);
      } else {
        uid = (await adminApi<{ uid: string }>('/users', { method: 'POST', body })).uid;
        toast.success(`${name} added. They can sign in on the app with ${phoneNumber}.`);
      }
      setBusy(false);
      close(false);
      onSaved(uid);
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.code === 'RIDER_EXISTS') {
        setErrors({ phoneNumber: 'A rider with this phone number already exists.' });
      } else {
        toast.error(
          err instanceof Error ? err.message : editing ? 'Could not save the rider.' : 'Could not add the rider.',
        );
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-6 py-4 text-left">
          <div className="eyebrow">Rider Management</div>
          <DialogTitle className="font-display text-2xl">{editing ? 'Edit rider' : 'Add rider'}</DialogTitle>
          <DialogDescription className="text-xs">
            {editing
              ? 'Changes show in the app straight away.'
              : 'Creates the account for this phone number. When they sign in on the app with it, their profile is ready.'}
          </DialogDescription>
        </DialogHeader>

        <form
          id="rider-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="flex-1 space-y-4 overflow-y-auto px-6 py-5"
        >
          <div className="flex items-center gap-3">
            <RiderAvatar
              name={form.displayName.trim() || 'New Rider'}
              seed={rider?.uid ?? (form.phoneNumber || 'new')}
              size={48}
            />
            <p className="text-xs text-muted-foreground">
              {editing
                ? 'The photo is changed by the rider in the app.'
                : 'The rider can add a photo from the app after signing in.'}
            </p>
          </div>

          <Field
            id="rider-phone"
            label="Phone number"
            hint={
              phoneChanged
                ? 'They will sign in with this new number. The old number stops working.'
                : 'With country code, e.g. +1 555 123 4567'
            }
            error={errors.phoneNumber}
          >
            <Input
              id="rider-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="+1 555 123 4567"
              value={form.phoneNumber}
              onChange={(e) => set('phoneNumber', e.target.value)}
              aria-invalid={errors.phoneNumber ? true : undefined}
              className="font-mono"
              autoFocus={!editing}
            />
          </Field>

          <Field
            id="rider-name"
            label="Display name"
            hint="3–24 letters, numbers, dots or underscores"
            error={errors.displayName}
          >
            <Input
              id="rider-name"
              autoComplete="off"
              placeholder="alex.rides"
              maxLength={24}
              value={form.displayName}
              onChange={(e) => set('displayName', e.target.value)}
              aria-invalid={errors.displayName ? true : undefined}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="rider-city" label="Home city" error={errors.homeCity}>
              <Input
                id="rider-city"
                autoComplete="off"
                placeholder="Austin"
                maxLength={60}
                value={form.homeCity}
                onChange={(e) => set('homeCity', e.target.value)}
                aria-invalid={errors.homeCity ? true : undefined}
              />
            </Field>
            <Field id="rider-style" label="Ride style">
              <Select value={form.rideStyle} onValueChange={(v) => set('rideStyle', v as RideStyle)}>
                <SelectTrigger id="rider-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RIDE_STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <label
            htmlFor="rider-incognito"
            className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border p-3"
          >
            <span>
              <span className="block text-[13px] font-medium">Incognito drop-off</span>
              <span className="text-xs text-muted-foreground">
                Hide where they get off from other riders. On by default in the app.
              </span>
            </span>
            <Switch
              id="rider-incognito"
              checked={form.incognitoDropoff}
              onCheckedChange={(v) => set('incognitoDropoff', v)}
            />
          </label>
        </form>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-3">
          <Button type="button" variant="ghost" onClick={() => close(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="rider-form" disabled={busy}>
            {editing ? <Save /> : <UserPlus />}
            {editing ? (busy ? 'Saving…' : 'Save changes') : busy ? 'Adding…' : 'Add rider'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
