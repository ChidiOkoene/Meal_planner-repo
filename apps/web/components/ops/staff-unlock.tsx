'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toDataURL } from 'qrcode';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useApi } from '@/lib/api';

/**
 * The staff console's second step: set up an authenticator app (first time), or enter a code
 * from it. One check unlocks this sign-in for 12 hours.
 */
export function StaffUnlock({ enrolled }: { enrolled: boolean }) {
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  if (backupCodes) return <BackupCodes codes={backupCodes} />;
  return enrolled ? <EnterCode /> : <SetUp onDone={setBackupCodes} />;
}

function SetUp({ onDone }: { onDone: (codes: string[]) => void }) {
  const api = useApi();
  const [qr, setQr] = useState<string | null>(null);
  const setup = useMutation({
    mutationFn: () =>
      api<{ secret: string; otpauthUri: string }>('/v1/me/staff-two-factor/setup', {
        method: 'POST',
      }),
  });
  const confirm = useMutation({
    mutationFn: (code: string) =>
      api<{ backupCodes: string[] }>('/v1/me/staff-two-factor/confirm', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    onSuccess: (data) => onDone(data.backupCodes),
  });

  useEffect(() => {
    if (setup.data) void toDataURL(setup.data.otpauthUri, { margin: 1, width: 200 }).then(setQr);
  }, [setup.data]);

  return (
    <Panel title="Set up 2-step verification">
      <p>
        Staff can see health information, so the staff console asks for a code from an authenticator
        app each time you sign in. Any app works: Google Authenticator, Microsoft Authenticator,
        1Password, Authy and others.
      </p>
      {!setup.data ? (
        <>
          <button
            type="button"
            onClick={() => setup.mutate()}
            disabled={setup.isPending}
            className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast disabled:opacity-60"
          >
            {setup.isPending ? 'Starting…' : 'Set up an authenticator app'}
          </button>
          <ErrorText error={setup.error} />
        </>
      ) : (
        <ol className="mt-4 list-decimal space-y-4 pl-5">
          <li>
            In your authenticator app, add an account and scan this code.
            <div className="mt-2 inline-block rounded-md bg-white p-2">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element -- a generated data URL
                <img src={qr} width={200} height={200} alt="QR code for your authenticator app" />
              ) : (
                <div className="h-[200px] w-[200px]" />
              )}
            </div>
            <p className="mt-2 text-text-muted">
              Can&apos;t scan? Enter this key instead:{' '}
              <code className="font-mono text-text" data-testid="setup-key">
                {setup.data.secret.match(/.{1,4}/g)?.join(' ')}
              </code>
            </p>
          </li>
          <li>
            Enter the 6-digit code the app shows.
            <CodeForm
              label="Code from the app"
              submitLabel="Turn on"
              pending={confirm.isPending}
              error={confirm.error}
              onSubmit={(code) => confirm.mutate(code)}
            />
          </li>
        </ol>
      )}
    </Panel>
  );
}

function EnterCode() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [backup, setBackup] = useState(false);
  const verify = useMutation({
    mutationFn: (code: string) =>
      api('/v1/me/staff-two-factor/verify', { method: 'POST', body: JSON.stringify({ code }) }),
    onSuccess: () => queryClient.invalidateQueries(),
  });
  return (
    <Panel title="Enter your 2-step code">
      <p>
        {backup
          ? 'Enter one of the backup codes you saved when you set up the app. Each works once.'
          : 'Open your authenticator app and enter the 6-digit code for Dyjext Care.'}
      </p>
      <CodeForm
        key={String(backup)}
        label={backup ? 'Backup code' : 'Code from the app'}
        submitLabel="Continue"
        backup={backup}
        pending={verify.isPending}
        error={verify.error}
        onSubmit={(code) => verify.mutate(code)}
      />
      <p className="mt-4 text-text-muted">
        <button
          type="button"
          onClick={() => setBackup(!backup)}
          className="font-semibold text-text underline"
        >
          {backup ? 'Use the authenticator app instead' : 'Use a backup code instead'}
        </button>
        . Lost your phone and your backup codes? Ask an admin to reset your 2-step verification.
      </p>
    </Panel>
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  return (
    <Panel title="Save your backup codes" tone="ok">
      <p>
        2-step verification is on. If you lose your phone, each of these codes lets you in once.
        Keep them somewhere safe, such as a password manager. They won&apos;t be shown again.
      </p>
      <ul
        className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-base"
        data-testid="backup-codes"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard.writeText(codes.join('\n')).then(() => setCopied(true))
          }
          className="rounded-md border border-border px-4 py-2 text-sm font-semibold"
        >
          {copied ? 'Copied' : 'Copy codes'}
        </button>
        <button
          type="button"
          onClick={() => void queryClient.invalidateQueries()}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast"
        >
          I&apos;ve saved them, continue
        </button>
      </div>
    </Panel>
  );
}

function CodeForm(props: {
  label: string;
  submitLabel: string;
  backup?: boolean;
  pending: boolean;
  error: Error | null;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    props.onSubmit(code);
  }
  return (
    <form onSubmit={submit} className="mt-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm">
          {props.label}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoFocus
            autoComplete="one-time-code"
            inputMode={props.backup ? 'text' : 'numeric'}
            pattern={props.backup ? undefined : '[0-9 ]{6,7}'}
            maxLength={props.backup ? 20 : 7}
            placeholder={props.backup ? 'XXXXX-XXXXX' : '123456'}
            className="mt-1 w-44 rounded-md border border-border bg-bg px-2 py-2 font-mono text-lg tracking-widest"
          />
        </label>
        <button
          type="submit"
          disabled={props.pending}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast disabled:opacity-60"
        >
          {props.pending ? 'Checking…' : props.submitLabel}
        </button>
      </div>
      <ErrorText error={props.error} />
    </form>
  );
}

function ErrorText({ error }: { error: Error | null }) {
  return (
    <p aria-live="polite" className="mt-2 text-sm text-bad">
      {error?.message}
    </p>
  );
}

function Panel(props: { title: string; tone?: 'warn' | 'ok'; children: ReactNode }) {
  const tone = props.tone === 'ok' ? 'border-ok bg-ok-bg' : 'border-warn bg-warn-bg';
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className={`max-w-xl rounded-lg border p-5 text-sm ${tone}`}>
        <h1 className="text-lg font-semibold">{props.title}</h1>
        <div className="mt-2">{props.children}</div>
      </section>
    </main>
  );
}
