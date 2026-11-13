import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { VestaMark, ThemeToggle } from "./Navbar";
import { verifyAccessCode, hasActiveSession } from '../services/authService';
import { clearAllPortfolioCaches } from '../services/portfolioService';
import { clearRecommendationsCache } from '../services/recommendationService';
import { skipWelcome } from '../utils/installedApp';

// The public landing page is a React route (components/Landing.jsx), outside this gate.
export const LANDING_URL = '/welcome';
export const UNLOCK_PATH = '/unlock';


const AccessGate = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // The landing page sets its own long title; the app (and the code form) are plain "Vesta".
  useEffect(() => { document.title = 'Vesta'; }, []);
  const goToLanding = () => navigate(LANDING_URL, { replace: true });
  // The installed app goes to the code screen once its welcome page has been seen
  const goToCode = () => { navigate(UNLOCK_PATH, { replace: true }); setScreen('code'); };
  const signedOut = () => (skipWelcome() ? goToCode() : goToLanding());
  const onUnlock = location.pathname === UNLOCK_PATH;
  const [screen, setScreen] = useState('checking');
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputs = useRef([]);

  useEffect(() => {
    const lock = () => {
      clearAllPortfolioCaches();
      try { clearRecommendationsCache(); } catch {}
      setDigits(Array(6).fill(''));
      signedOut();
    };
    window.addEventListener('portfolio:locked', lock);
    return () => window.removeEventListener('portfolio:locked', lock);
  }, []);

  useEffect(() => {
    let cancelled = false;
    hasActiveSession().then(active => {
      if (cancelled) return;
      if (active) {
        if (onUnlock) navigate('/', { replace: true });
        setScreen('authenticated');
      } else if (onUnlock) {
        setScreen('code');
      } else {
        signedOut();
      }
    });
    return () => { cancelled = true; };
    // Only on first load: later route changes happen inside an authenticated session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (screen === 'code') inputs.current[0]?.focus();
    if (screen !== 'authenticated') return undefined;
    const timeout = setTimeout(() => window.dispatchEvent(new Event('portfolio:locked')), 60 * 60 * 1000);
    return () => clearTimeout(timeout);
  }, [screen]);

  const updateDigits = (value, index) => {
    const numbers = value.replace(/\D/g, '').slice(0, 6 - index);
    setDigits(previous => {
      const next = [...previous];
      if (!numbers) next[index] = '';
      numbers.split('').forEach((digit, offset) => { next[index + offset] = digit; });
      return next;
    });
    setError('');
    if (numbers) inputs.current[Math.min(index + numbers.length, 5)]?.focus();
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy || !digits.every(digit => /^\d$/.test(digit))) return;
    setBusy(true);
    setError('');
    try {
      await verifyAccessCode(digits.join(''));
      setDigits(Array(6).fill(''));
      navigate('/', { replace: true });
      setScreen('authenticated');
    } catch (failure) {
      setError(failure instanceof TypeError ? 'Cannot reach the server. Try again in a moment.' : failure.message);
      setDigits(Array(6).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  if (screen === 'authenticated') return children;
  if (screen !== 'code') return <div className="min-h-screen bg-canvas" />;

  const complete = digits.every(digit => /^\d$/.test(digit));

  return (
    <main className="min-h-screen bg-canvas text-ink flex flex-col">
      <header className="h-16 bg-canvas border-b border-line">
        <div className="h-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link to={LANDING_URL} className="inline-flex items-center gap-2 text-[20px] font-semibold tracking-[-0.02em] text-ink">
            <VestaMark /> Vesta
          </Link>
          <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to={LANDING_URL} className="pill pill-sm pill-secondary">
            <ArrowLeft size={16} aria-hidden="true" /> Back to Vesta
          </Link>
          </div>
        </div>
      </header>

      <section className="flex-1 grid place-items-center px-6 py-16">
        <form className="card w-full max-w-[440px] p-8 md:p-10" onSubmit={submit} noValidate>
          <span className="inline-flex items-center h-6 px-3 rounded-full bg-surface-strong text-[12px] font-semibold tracking-[0.04em] uppercase text-ink">Private</span>
          <h1 className="mt-4 text-[32px] leading-[1.13] text-ink">Enter access code</h1>
          <p className="mt-2 mb-8 text-[16px] leading-[1.5] text-body">Six digits, set in your server settings. Sessions last 60 minutes.</p>
          <fieldset className="grid grid-cols-6 gap-2" disabled={busy}>
            <legend className="sr-only">Six-digit access code</legend>
            {digits.map((digit, index) => (
              <input key={index} ref={element => { inputs.current[index] = element; }} aria-label={`Digit ${index + 1}`} aria-invalid={Boolean(error)} aria-describedby={error ? 'access-error' : undefined} type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={digit}
                className={`num w-full min-w-0 h-14 rounded-xl bg-canvas border text-ink text-center text-2xl outline-none transition-colors focus-visible:border-2 focus-visible:border-primary ${error ? 'border-loss' : 'border-line'}`}
                onChange={event => updateDigits(event.target.value, index)}
                onFocus={event => event.target.select()}
                onPaste={event => { event.preventDefault(); updateDigits(event.clipboardData.getData('text'), index); }}
                onKeyDown={event => {
                  if (event.key === 'Backspace' && !digit && index > 0) { event.preventDefault(); inputs.current[index - 1]?.focus(); updateDigits('', index - 1); }
                  if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); inputs.current[index - 1]?.focus(); }
                  if (event.key === 'ArrowRight' && index < 5) { event.preventDefault(); inputs.current[index + 1]?.focus(); }
                }} />
            ))}
          </fieldset>
          <p className="min-h-5 mt-3 text-sm text-loss" id="access-error" role="alert">{error}</p>
          <button className="pill pill-primary mt-4 w-full h-11" type="submit" disabled={busy || !complete}>
            {busy ? <><Loader2 className="animate-spin" size={18} aria-hidden="true" /> Checking code</> : <>Enter portfolio <ArrowRight size={18} aria-hidden="true" /></>}
          </button>
          <p className="mt-6 text-[13px] text-slate">10 tries per address every 15 minutes.</p>
        </form>
      </section>
    </main>
  );
};

export default AccessGate;
