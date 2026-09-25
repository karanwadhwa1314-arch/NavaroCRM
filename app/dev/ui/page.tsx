import { notFound } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Field } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { LeadStageBadge, PriorityBadge, ClientStatusBadge, ClientTierBadge } from '@/components/ui/StatusBadge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton, TableSkeleton, CardSkeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { RadioCard } from '@/components/ui/RadioCard';
import { LEAD_STAGES, PRIORITIES, CLIENT_STATUSES, CLIENT_TIERS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-h2 text-navaro-green">{title}</h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

export default function DevUiPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div className="min-h-screen bg-navaro-heath p-8">
      <h1 className="mb-8 text-h1 text-navaro-green">UI kit — visual QA (dev only)</h1>

      <div className="flex flex-col gap-10">
        <Section title="Buttons">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" loading>
            Loading
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="primary" size="sm">
            Small
          </Button>
          <IconButton aria-label="Example icon button">
            <Inbox className="h-4 w-4" />
          </IconButton>
        </Section>

        <Section title="Inputs">
          <div className="w-64">
            <Field label="Text input" required>
              {(p) => <Input {...p} placeholder="Placeholder" />}
            </Field>
          </div>
          <div className="w-64">
            <Field label="With error" error="This field is required">
              {(p) => <Input {...p} error />}
            </Field>
          </div>
          <div className="w-64">
            <Field label="Disabled">{(p) => <Input {...p} disabled value="Can't edit" />}</Field>
          </div>
          <div className="w-64">
            <Field label="Select">
              {(p) => (
                <Select {...p}>
                  <option>Option one</option>
                  <option>Option two</option>
                </Select>
              )}
            </Field>
          </div>
          <div className="w-64">
            <Field label="Textarea">{(p) => <Textarea {...p} rows={3} />}</Field>
          </div>
          <label className="flex items-center gap-2 pt-6">
            <Checkbox defaultChecked /> Checkbox
          </label>
        </Section>

        <Section title="Radio cards">
          <div className="w-72">
            <RadioCard name="demo" value="a" checked title="Option A" description="One-line description" onChange={() => {}} />
          </div>
          <div className="w-72">
            <RadioCard name="demo" value="b" checked={false} title="Option B" description="One-line description" onChange={() => {}} />
          </div>
        </Section>

        <Section title="Badges — lead stage">
          {LEAD_STAGES.map((s) => (
            <LeadStageBadge key={s} stage={s} />
          ))}
        </Section>
        <Section title="Badges — priority">
          {PRIORITIES.map((p) => (
            <PriorityBadge key={p} priority={p} />
          ))}
        </Section>
        <Section title="Badges — client status / tier">
          {CLIENT_STATUSES.map((s) => (
            <ClientStatusBadge key={s} status={s} />
          ))}
          {CLIENT_TIERS.map((t) => (
            <ClientTierBadge key={t} tier={t} />
          ))}
          <Badge tone="neutral">Neutral</Badge>
        </Section>

        <Section title="Avatar / spinner">
          <Avatar firstName="Ada" lastName="Lovelace" />
          <Spinner size={20} />
        </Section>

        <Section title="Cards">
          <Card className="w-80">
            <p className="text-body text-navaro-green">A plain card.</p>
          </Card>
          <div className="w-80">
            <Card padding={false}>
              <CardHeader title="Card with header" />
              <div className="p-6 text-body text-navaro-green">Body content</div>
            </Card>
          </div>
        </Section>

        <Section title="Empty state">
          <div className="w-full max-w-md">
            <EmptyState icon={Inbox} title="No items yet" body="A one-line description of the empty state." />
          </div>
        </Section>

        <Section title="Skeletons">
          <Skeleton className="h-6 w-40" />
          <div className="w-64">
            <CardSkeleton />
          </div>
          <div className="w-full">
            <TableSkeleton rows={3} cols={4} />
          </div>
        </Section>
      </div>
    </div>
  );
}
