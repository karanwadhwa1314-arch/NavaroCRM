'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: '#FFFAF3', color: '#054742', fontFamily: 'sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 16, textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 500 }}>Something went wrong</h1>
          <p style={{ color: '#4B7974' }}>Please try again.</p>
          <button
            onClick={reset}
            style={{ background: '#054742', color: '#FFFAF3', borderRadius: 10, padding: '10px 16px', fontWeight: 500, border: 'none', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
