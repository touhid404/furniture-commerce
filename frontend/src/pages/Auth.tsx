import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LayoutGrid } from 'lucide-react';
import { useStore } from '../app/Store.js';
import { send } from '../lib/api.js';
import { formValues, useAction } from '../lib/hooks.js';
import { ProductArt } from '../components/ProductArt.js';
import { Field, Notice } from '../components/UI.js';
export function SignIn() {
  const { config, refresh } = useStore(),
    [create, setCreate] = useState(false),
    [visible, setVisible] = useState(false),
    [mfa, setMfa] = useState(false),
    action = useAction(),
    navigate = useNavigate(),
    [search] = useSearchParams();
  const complete = async (demo = false, values?: Record<string, string>) => {
    await action.run(async () => {
      try {
        await send(demo ? '/auth/demo' : create ? '/auth/register' : '/auth/login', values ?? {});
      } catch (e) {
        if (e instanceof Error && e.message.includes('authenticator')) setMfa(true);
        throw e;
      }
      await refresh();
      const next = search.get('next');
      navigate(
        demo ? '/admin' : next?.startsWith('/') && !next.startsWith('//') ? next : '/account',
      );
    });
  };
  return (
    <section className="auth-page">
      <div className="auth-panel panel">
        <span className="eyebrow">{create ? 'Make yourself at home' : 'Welcome back'}</span>
        <h1>{create ? 'Create account' : 'Sign in'}</h1>
        <div className="auth-tabs">
          <button
            className={!create ? 'selected' : ''}
            onClick={() => {
              setCreate(false);
              action.setError('');
            }}
          >
            Sign in
          </button>
          <button
            className={create ? 'selected' : ''}
            onClick={() => {
              setCreate(true);
              action.setError('');
            }}
          >
            Create account
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void complete(false, formValues(e.currentTarget));
          }}
        >
          {create && (
            <Field label="Your name">
              <input
                name="name"
                autoComplete="name"
                placeholder="Full name"
                required
                minLength={2}
              />
            </Field>
          )}
          <Field label="Email">
            <input type="email" name="email" placeholder="Email" autoComplete="email" required />
          </Field>
          <Field label="Password">
            <div className="password-input">
              <input
                type={visible ? 'text' : 'password'}
                name="password"
                placeholder="Password"
                autoComplete={create ? 'new-password' : 'current-password'}
                minLength={10}
                maxLength={128}
                required
              />
              <button
                type="button"
                aria-label={visible ? 'Hide password' : 'Show password'}
                className="icon-button"
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
          {create && <small className="muted">Use at least 10 characters.</small>}
          {mfa && (
            <Field label="Authenticator code">
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                required
              />
            </Field>
          )}
          <Notice>{action.error}</Notice>
          <button className="button wide" disabled={action.busy}>
            {action.busy ? 'One moment…' : create ? 'Create account' : 'Sign in'}
            <ArrowRight size={16} />
          </button>
        </form>
        {!create && (
          <Link className="forgot-link" to="/forgot-password">
            Forgot your password?
          </Link>
        )}
        {config.demo && (
          <>
            <div className="divider">
              <span>or</span>
            </div>
            <button
              className="button outline wide"
              disabled={action.busy}
              onClick={() => complete(true)}
            >
              <LayoutGrid size={15} />
              Continue as demo admin
            </button>
            <p className="auth-note">
              Explore the demo with fictional orders and products.
              <br />
              Production requires a secure administrator account.
            </p>
          </>
        )}
      </div>
      <div className="auth-art">
        <div className="auth-art-card">
          <ProductArt art="lamp" color="#b9a786" name="Linne Table Lamp" />
        </div>
        <span className="eyebrow">A little light. A little calm.</span>
        <h2>
          Good to have
          <br />
          you here.
        </h2>
        <p>Thoughtful objects for the way you live.</p>
      </div>
    </section>
  );
}
export function AccessPage() {
  const location = useLocation(),
    { notify, refresh } = useStore(),
    action = useAction(),
    navigate = useNavigate(),
    [done, setDone] = useState('');
  const [token] = useState(() => {
    const t = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
    if (t) history.replaceState(null, '', window.location.pathname);
    return t;
  });
  const kind = location.pathname.slice(1),
    title =
      kind === 'forgot-password'
        ? 'A fresh start.'
        : kind === 'reset-password'
          ? 'Choose a new password.'
          : kind === 'verify-email'
            ? 'Make it official.'
            : 'Find your order.';
  return (
    <section className="narrow-page panel">
      <span className="eyebrow">Here to help</span>
      <h1>{title}</h1>
      <p className="muted">
        {kind === 'order-access'
          ? 'Enter the email and order number from your confirmation. We’ll send a private access link.'
          : 'Your personal details stay private and secure.'}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const values = formValues(e.currentTarget);
          action.run(async () => {
            const result = await send<{ message?: string; orderId?: string }>(
              kind === 'order-access'
                ? token
                  ? '/auth/order-access/consume'
                  : '/auth/order-access/request'
                : `/auth/${kind}`,
              token ? { ...values, token } : values,
            );
            if (result.orderId) {
              await refresh();
              navigate(`/orders/${result.orderId}`);
              return;
            }
            setDone(result.message ?? 'All done. You can sign in to your account.');
            notify('Request completed.');
          });
        }}
      >
        {(kind === 'forgot-password' || (kind === 'order-access' && !token)) && (
          <Field label="Email address">
            <input name="email" type="email" autoComplete="email" required />
          </Field>
        )}
        {kind === 'order-access' && !token && (
          <Field label="Order number">
            <input name="number" required />
          </Field>
        )}
        {kind === 'reset-password' && (
          <Field label="New password">
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </Field>
        )}
        {(kind === 'reset-password' || kind === 'verify-email') && !token ? (
          <Notice>This link is missing its token. Please request a new link.</Notice>
        ) : (
          <button className="button wide" disabled={action.busy || !!done}>
            {kind === 'verify-email'
              ? 'Verify email'
              : token && kind === 'order-access'
                ? 'Open my order'
                : 'Continue'}
            <ArrowRight size={16} />
          </button>
        )}
        <Notice>{action.error}</Notice>
        <Notice kind="success">{done}</Notice>
      </form>
      <Link to="/sign-in" className="text-link">
        Back to sign in
      </Link>
    </section>
  );
}
