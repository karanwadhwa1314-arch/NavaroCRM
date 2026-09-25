'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { Input } from '@/components/ui/Input';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { loginSchema } from '@/lib/validation/auth';
import { ApiError, api } from '@/lib/api-client';
import type { SessionUser } from '@/lib/auth/session';

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  return next;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) errors[String(issue.path[0])] = issue.message;
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setLoading(true);

    try {
      await api.post<SessionUser>('/api/auth/login', parsed.data);
      router.push(safeNextPath(searchParams.get('next')));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navaro-heath px-4">
      <div
        className="pointer-events-none absolute -right-16 -top-16 hidden h-64 w-64 rounded-[40px] bg-navaro-yellow/40 sm:block"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-16 hidden h-72 w-72 rounded-full bg-navaro-lavender/30 sm:block"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-24 right-24 hidden h-16 w-16 rounded-full bg-navaro-turquoise/40 sm:block"
        aria-hidden="true"
      />

      <div className="relative w-full max-w-[420px] rounded-card border border-navaro-line bg-white p-8">
        <div className="mb-6 flex flex-col items-start gap-4">
          <Logo variant="horizontal" height={40} />
          <div>
            <h1 className="text-h1 text-navaro-green">Sign in</h1>
            <p className="mt-1 text-body text-navaro-muted">Welcome back to Navaro CRM.</p>
          </div>
        </div>

        {formError && (
          <div className="mb-4 flex items-start gap-2 rounded-control bg-danger-tint px-3 py-2 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Field label="Email" required error={fieldErrors.email}>
            {(props) => (
              <Input
                {...props}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={Boolean(fieldErrors.email)}
              />
            )}
          </Field>

          <Field label="Password" required error={fieldErrors.password}>
            {(props) => (
              <div className="relative">
                <Input
                  {...props}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={Boolean(fieldErrors.password)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navaro-muted hover:text-navaro-green"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            )}
          </Field>

          <Button type="submit" variant="accent" size="md" loading={loading} className="w-full">
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-label text-navaro-muted">© {new Date().getFullYear()} Navaro</p>
      </div>
    </div>
  );
}
