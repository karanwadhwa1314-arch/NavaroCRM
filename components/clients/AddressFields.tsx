import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';

export interface AddressValue {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

interface AddressFieldsProps {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  disabled?: boolean;
}

export function AddressFields({ value, onChange, disabled }: AddressFieldsProps) {
  function set(key: keyof AddressValue, v: string) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Street" className="sm:col-span-2">
        {(p) => <Input {...p} disabled={disabled} value={value.street ?? ''} onChange={(e) => set('street', e.target.value)} />}
      </Field>
      <Field label="City">
        {(p) => <Input {...p} disabled={disabled} value={value.city ?? ''} onChange={(e) => set('city', e.target.value)} />}
      </Field>
      <Field label="State">
        {(p) => <Input {...p} disabled={disabled} value={value.state ?? ''} onChange={(e) => set('state', e.target.value)} />}
      </Field>
      <Field label="Country">
        {(p) => <Input {...p} disabled={disabled} value={value.country ?? ''} onChange={(e) => set('country', e.target.value)} />}
      </Field>
      <Field label="Zip code">
        {(p) => <Input {...p} disabled={disabled} value={value.zipCode ?? ''} onChange={(e) => set('zipCode', e.target.value)} />}
      </Field>
    </div>
  );
}
