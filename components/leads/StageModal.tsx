'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { LEAD_STAGES, LEAD_STAGE_LABELS, type LeadStage } from '@/lib/constants';

interface StageModalProps {
  open: boolean;
  onClose: () => void;
  currentStage: LeadStage;
  company: string;
  contactName: string;
  canCreateClient: boolean;
  onSubmit: (stage: LeadStage, lostReason?: string) => Promise<void>;
  submitting: boolean;
  duplicateError?: { message: string; existingClientId?: string };
}

export function StageModal({
  open,
  onClose,
  currentStage,
  company,
  contactName,
  canCreateClient,
  onSubmit,
  submitting,
  duplicateError,
}: StageModalProps) {
  const [stage, setStage] = useState<LeadStage>(currentStage);
  const [lostReason, setLostReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (stage === 'lost' && !lostReason.trim()) {
      setError('A reason is required when marking a lead as lost');
      return;
    }
    setError(null);
    await onSubmit(stage, stage === 'lost' ? lostReason.trim() : undefined);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change stage"
      size="sm"
      preventClose={submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={stage === 'won' && !canCreateClient}>
            {stage === 'won' ? 'Mark as won & create client' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {LEAD_STAGES.map((s) => (
          <label key={s} className="flex items-center gap-2">
            <input type="radio" name="stage" checked={stage === s} onChange={() => setStage(s)} className="accent-navaro-green" />
            <span className="text-sm text-navaro-green">{LEAD_STAGE_LABELS[s]}</span>
          </label>
        ))}

        {stage === 'lost' && (
          <Textarea
            placeholder="Reason for losing this lead"
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            error={Boolean(error)}
          />
        )}
        {error && <p className="text-label text-danger">{error}</p>}

        {stage === 'won' && (
          <div className="rounded-control bg-navaro-turquoise px-3 py-2 text-sm text-navaro-green">
            Marking this lead as won will create the client &ldquo;{company}&rdquo; with {contactName} as primary contact.
            {!canCreateClient && (
              <p className="mt-1 text-label text-navaro-muted">You need permission to create clients to do this.</p>
            )}
          </div>
        )}

        {duplicateError && (
          <div className="rounded-control bg-danger-tint px-3 py-2 text-sm text-danger">
            {duplicateError.message}
            {duplicateError.existingClientId && (
              <a href={`/clients/${duplicateError.existingClientId}`} className="ml-1 underline">
                View existing client
              </a>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
