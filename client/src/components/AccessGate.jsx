import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, Lock, TrendingUp, Layers, ShieldCheck, Loader2 } from 'lucide-react';
import { verifyAccessCode, hasActiveSession } from '../services/authService';
import { clearAllPortfolioCaches } from '../services/portfolioService';
import { clearRecommendationsCache } from '../services/recommendationService';

const AccessGate = ({ children }) => {
  const [screen, setScreen] = useState('checking');
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputs = useRef([]);

  useEffect(() => {
    const lock = () => {
      clearAllPortfolioCaches();
      try { clearRecommendationsCache(); } catch {}
      setScreen('landing');
      setDigits(Array(6).fill(''));
      setError('');
    };
    window.addEventListener('portfolio:locked', lock);
    return () => window.removeEventListener('portfolio:locked', lock);
  }, []);

  useEffect(() => {
    let cancelled = false;
    hasActiveSession().then(active => {
      if (!cancelled) setScreen(active ? 'authenticated' : 'landing');
    });
    return () => { cancelled = true; };
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
      setScreen('authenticated');
    } catch (failure) {
      setError(failure instanceof TypeError ? 'Cannot reach the server. Please try again.' : failure.message);
      setDigits(Array(6).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  if (screen === 'authenticated') return children;
  if (screen === 'checking') return null;

  const inputBaseClass = 'w-full min-w-0 h-14 rounded-lg bg-gray-800/50 border border-gray-700/50 text-white text-center text-2xl focus:outline-none focus:border-primary transition-colors';

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <header className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 px-4 md:px-8 py-4 flex items-center justify-between">
        <a href="/" className="text-primary text-xl md:text-2xl font-bold tracking-wide" aria-label="Vesta home">Vesta<span className="text-white">.</span></a>
        <span className="text-gray-400 text-xs flex items-center gap-2"><Lock size={14} aria-hidden="true" /> Private portfolio</span>
      </header>

      {screen === 'landing' ? (
        <>
          <section className="relative min-h-[420px] h-[65vh] max-h-[740px] flex items-center overflow-hidden">
            <img className="absolute inset-0 w-full h-full object-cover object-[center_55%]" src="/vesta-city.jpg" alt="" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/20" />
            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 md:px-8 py-12">
              <p className="text-primary text-xs uppercase tracking-widest mb-4">Your investments, together</p>
              <h1 className="text-5xl md:text-7xl font-bold mb-5">Vesta</h1>
              <p className="text-gray-300 text-base md:text-lg leading-relaxed max-w-md mb-8">A clear view of your wealth. Follow your investments, understand your returns, and keep the bigger picture in sight.</p>
              <button className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2 font-semibold" onClick={() => setScreen('code')}>
                Continue <ArrowRight size={19} aria-hidden="true" />
              </button>
            </div>
            <p className="absolute z-10 bottom-6 right-4 md:right-8 text-gray-400 text-xs">One portfolio. A longer perspective.</p>
          </section>

          <section className="max-w-7xl mx-auto px-4 md:px-8 py-12 grid grid-cols-1 md:grid-cols-3 gap-6 w-full" aria-label="About Vesta">
            <article className="bg-gray-900/90 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 shadow-2xl">
              <Layers size={22} className="text-primary" aria-hidden="true" />
              <h2 className="text-white font-semibold mt-4 mb-2">Every asset, one view</h2>
              <p className="text-gray-400 text-sm leading-relaxed">Mutual funds, fixed deposits, gold, silver, and EPF, all in one place.</p>
            </article>
            <article className="bg-gray-900/90 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 shadow-2xl">
              <TrendingUp size={22} className="text-primary" aria-hidden="true" />
              <h2 className="text-white font-semibold mt-4 mb-2">Performance in focus</h2>
              <p className="text-gray-400 text-sm leading-relaxed">Track returns, allocation, and your investment journey over time.</p>
            </article>
            <article className="bg-gray-900/90 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 shadow-2xl">
              <ShieldCheck size={22} className="text-primary" aria-hidden="true" />
              <h2 className="text-white font-semibold mt-4 mb-2">A private workspace</h2>
              <p className="text-gray-400 text-sm leading-relaxed">Your portfolio stays behind your personal access code.</p>
            </article>
          </section>
        </>
      ) : (
        <section className="flex-1 flex items-center justify-center px-4 py-12">
          <form className="w-full max-w-md bg-gray-900/90 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 md:p-8 shadow-2xl" onSubmit={submit}>
            <button type="button" className="text-gray-400 hover:text-white transition-colors cursor-pointer flex items-center gap-2 text-sm mb-8 disabled:opacity-50" disabled={busy} onClick={() => { setScreen('landing'); setError(''); setDigits(Array(6).fill('')); }}>
              <ArrowLeft size={17} aria-hidden="true" /> Back
            </button>
            <Lock className="text-primary mb-4" size={30} aria-hidden="true" />
            <h1 className="text-2xl font-bold mb-2">Enter access code</h1>
            <p className="text-gray-400 text-sm mb-8">Your private portfolio awaits.</p>
            <fieldset className="grid grid-cols-6 gap-2" disabled={busy}>
              <legend className="sr-only">Six-digit access code</legend>
              {digits.map((digit, index) => (
                <input key={index} ref={element => { inputs.current[index] = element; }} aria-label={`Digit ${index + 1}`} aria-invalid={Boolean(error)} aria-describedby={error ? 'access-error' : undefined} type="text" inputMode="numeric" autoComplete="off" maxLength={6} value={digit}
                  className={`${inputBaseClass} ${error ? 'border-red-500' : ''}`}
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
            <div className="min-h-[20px] mt-3 mb-2 text-red-400 text-xs" id="access-error" role="alert">{error}</div>
            <button className="w-full mt-4 px-6 py-3 bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center gap-2 font-semibold" type="submit" disabled={busy || !digits.every(digit => /^\d$/.test(digit))}>
              {busy ? <><Loader2 className="animate-spin" size={18} aria-hidden="true" /> Verifying</> : <>Enter portfolio <ArrowRight size={18} aria-hidden="true" /></>}
            </button>
          </form>
        </section>
      )}

      <footer className="max-w-7xl mx-auto px-4 md:px-8 py-6 border-t border-gray-800 text-gray-500 text-xs flex items-center justify-between w-full">
        Vesta <span className="text-gray-600">Personal wealth, in perspective.</span>
      </footer>
    </main>
  );
};

export default AccessGate;
