import { Check } from 'lucide-react';
import { LEAD_STAGE_PIPELINE_ORDER, LEAD_STAGE_LABELS, type LeadStage } from '@/lib/constants';

export function StageStepper({ stage, lostReason }: { stage: LeadStage; lostReason?: string }) {
  if (stage === 'lost') {
    return (
      <div className="rounded-control bg-danger-tint px-4 py-3 text-sm text-danger">
        Lead lost{lostReason ? ` · ${lostReason}` : ''}
      </div>
    );
  }

  const currentIndex = LEAD_STAGE_PIPELINE_ORDER.indexOf(stage);

  return (
    <div className="flex items-center">
      {LEAD_STAGE_PIPELINE_ORDER.map((step, i) => {
        const completed = i < currentIndex;
        const current = i === currentIndex;
        const isLast = i === LEAD_STAGE_PIPELINE_ORDER.length - 1;

        return (
          <div key={step} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={
                  completed || current
                    ? 'flex h-7 w-7 items-center justify-center rounded-full bg-navaro-green text-navaro-heath'
                    : 'flex h-7 w-7 items-center justify-center rounded-full border-2 border-navaro-line text-navaro-muted'
                }
              >
                {completed ? <Check className="h-4 w-4" /> : <span className="text-label">{i + 1}</span>}
              </div>
              <span className={`text-label whitespace-nowrap ${current ? 'font-medium text-navaro-green' : 'text-navaro-muted'}`}>
                {LEAD_STAGE_LABELS[step]}
              </span>
            </div>
            {!isLast && (
              <div className={`mx-2 h-0.5 flex-1 ${completed ? 'bg-navaro-green' : 'bg-navaro-line'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
