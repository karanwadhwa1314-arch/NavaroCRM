import { Check } from 'lucide-react';
import { LEAD_STAGE_PIPELINE_ORDER, LEAD_STAGE_LABELS, type LeadStage } from '@/lib/constants';

/**
 * The stepper stays mounted when a lead's stage changes (router.refresh), so these
 * transitions play: the track fills toward the new stage, the new circle fills in and
 * gains a turquoise ring. ~300ms, ease-out, and disabled under prefers-reduced-motion.
 */
export function StageStepper({ stage, lostReason }: { stage: LeadStage; lostReason?: string }) {
  if (stage === 'lost') {
    return (
      <div className="rounded-control bg-danger px-4 py-3 text-sm text-white">
        Lead lost{lostReason ? ` · ${lostReason}` : ''}
      </div>
    );
  }

  const currentIndex = LEAD_STAGE_PIPELINE_ORDER.indexOf(stage);

  return (
    <ol className="flex items-center" aria-label="Lead stage">
      {LEAD_STAGE_PIPELINE_ORDER.map((step, i) => {
        const completed = i < currentIndex;
        const current = i === currentIndex;
        const reached = completed || current;
        const isLast = i === LEAD_STAGE_PIPELINE_ORDER.length - 1;

        return (
          <li key={step} className="flex flex-1 items-center last:flex-none" aria-current={current ? 'step' : undefined}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-300 ease-out motion-reduce:transition-none ${
                  reached ? 'border-navaro-green bg-navaro-green text-navaro-heath' : 'border-navaro-line bg-white text-navaro-muted'
                } ${current ? 'ring-2 ring-navaro-turquoise ring-offset-2' : 'ring-0 ring-transparent ring-offset-0'}`}
              >
                {completed ? <Check className="h-4 w-4" aria-hidden="true" /> : <span className="text-label">{i + 1}</span>}
              </div>
              <span
                className={`text-label whitespace-nowrap transition-colors duration-300 motion-reduce:transition-none ${
                  current ? 'font-medium text-navaro-green' : 'text-navaro-muted'
                }`}
              >
                {LEAD_STAGE_LABELS[step]}
              </span>
            </div>
            {!isLast && (
              <div className="mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-navaro-line">
                <div
                  className="h-full bg-navaro-green transition-[width] duration-300 ease-out motion-reduce:transition-none"
                  style={{ width: completed ? '100%' : '0%' }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
