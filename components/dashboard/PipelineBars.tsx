import { LEAD_STAGE_PIPELINE_ORDER, LEAD_STAGE_LABELS } from '@/lib/constants';

interface PipelineBarsProps {
  byStage: Record<string, number>;
}

export function PipelineBars({ byStage }: PipelineBarsProps) {
  const values = LEAD_STAGE_PIPELINE_ORDER.map((stage) => ({ stage, count: byStage[stage] ?? 0 }));
  const max = Math.max(1, ...values.map((v) => v.count));
  const biggest = values.reduce((a, b) => (b.count > a.count ? b : a), values[0]);

  return (
    <div className="flex flex-col gap-3">
      {values.map(({ stage, count }) => (
        <div key={stage} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-label text-navaro-muted">{LEAD_STAGE_LABELS[stage]}</span>
          <div className="h-6 flex-1 overflow-hidden rounded-full bg-navaro-heath">
            <div
              className={`flex h-full items-center justify-end rounded-r-full px-2 transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none text-label font-medium text-navaro-heath ${
                stage === biggest.stage && biggest.count > 0 ? 'bg-navaro-yellow text-navaro-green' : 'bg-navaro-green'
              }`}
              style={{ width: `${Math.max(6, (count / max) * 100)}%` }}
            >
              {count > 0 && count}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
