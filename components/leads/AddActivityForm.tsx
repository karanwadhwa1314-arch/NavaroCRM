'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { USER_ADDABLE_ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS, type ActivityType } from '@/lib/constants';

interface AddActivityFormProps {
  onSubmit: (type: ActivityType, description: string) => Promise<void>;
}

export function AddActivityForm({ onSubmit }: AddActivityFormProps) {
  const [type, setType] = useState<ActivityType>('note');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!description.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(type, description.trim());
      setDescription('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-navaro-line pb-6">
      <div className="inline-flex w-fit rounded-control border border-navaro-line p-0.5">
        {USER_ADDABLE_ACTIVITY_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={clsx(
              'rounded-control px-3 py-1.5 text-label font-medium',
              type === t ? 'bg-navaro-green text-navaro-heath' : 'text-navaro-green hover:bg-navaro-hover'
            )}
          >
            {ACTIVITY_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      <Textarea
        rows={2}
        placeholder="Add a note…"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div>
        <Button size="sm" onClick={handleSubmit} loading={submitting} disabled={!description.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
