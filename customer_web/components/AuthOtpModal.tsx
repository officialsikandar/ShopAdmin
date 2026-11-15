import React, { useEffect, useRef, useState } from 'react';
import { Mail, ShieldCheck, X, ArrowRight, RotateCw } from 'lucide-react';
import { readLocalJson, STORAGE_KEYS, storeApi } from '../lib/api';
import { useStore } from '../context/StoreContext';
import type { CartItem, CustomerUser } from '../types';

export function AuthOtpModal() {
  const { authModalOpen, closeAuthModal, completeAuthSuccess, showToast } = useStore();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [devOtpNotice, setDevOtpNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!authModalOpen) {
      setStep('email');
      setDigits(['', '', '', '', '', '']);
      setDevOtpNotice(null);
      setErrorMsg('');
      setCountdown(0);
    }
  }, [authModalOpen]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  if (!authModalOpen) return null;

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    const cleaned = email.trim().toLowerCase();
    if (!cleaned || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setSending(true);
    try {
      const res = await storeApi<{
        ok: boolean;
        email: string;
        emailed: boolean;
        resendAfterSeconds?: number;
        devOtp?: string;
        message: string;
      }>('/api/store/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email: cleaned }),
      });
      setStep('otp');
      setDigits(['', '', '', '', '', '']);
      setCountdown(res.resendAfterSeconds || 30);
      setDevOtpNotice(res.devOtp ? res.devOtp : null);
      showToast(res.emailed ? `OTP sent to ${res.email}` : 'Verification OTP generated');
      window.setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 60);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send verification OTP.');
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const otp = digits.join('');
    if (otp.length !== 6) {
      setErrorMsg('Please enter a valid 6-digit OTP.');
      return;
    }

    setErrorMsg('');
    setVerifying(true);
    try {
      const guestCart = readLocalJson<CartItem[]>(STORAGE_KEYS.GUEST_CART_KEY, []);
      const guestWishlist = readLocalJson<string[]>(STORAGE_KEYS.GUEST_WISHLIST_KEY, []);

      const res = await storeApi<{
        token: string;
        user: CustomerUser;
        cart: CartItem[];
        wishlist: string[];
      }>('/api/store/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp,
          guestCart,
          guestWishlist,
        }),
      });
      completeAuthSuccess(res);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Please enter a valid OTP.');
    } finally {
      setVerifying(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }
    if (clean.length > 1) {
      const pasted = clean.slice(0, 6).split('');
      const next = ['', '', '', '', '', ''];
      for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
      setDigits(next);
      const focusIdx = Math.min(5, pasted.length - 1);
      inputRefs.current[focusIdx]?.focus();
      return;
    }
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={closeAuthModal}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 sm:p-7 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeAuthModal}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
          aria-label="Close login modal"
        >
          <X className="w-4.5 h-4.5" />
        </button>

        {step === 'email' ? (
          <form onSubmit={handleSendOtp} className="space-y-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 text-[#6D28D9] flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">Login to Continue</h2>
              <p className="text-sm text-slate-500 mt-1">
                Enter your email address to receive a 6-digit verification OTP.
              </p>
            </div>

            {errorMsg && (
              <div className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-left">
                {errorMsg}
              </div>
            )}

            <div className="text-left">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9]"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold shadow-sm disabled:opacity-50 transition-colors"
            >
              <span>{sending ? 'Sending OTP…' : 'Continue'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 text-[#6D28D9] flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">Verify Your Email</h2>
              <p className="text-sm text-slate-500 mt-1">
                Enter the 6-digit OTP sent to{' '}
                <span className="font-semibold text-slate-900">{email}</span>
              </p>
            </div>

            {devOtpNotice && (
              <div className="text-xs text-[#5B21B6] bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5">
                SMTP email is not configured in Store Settings. Your verification code is{' '}
                <strong className="font-mono text-sm tracking-wider">{devOtpNotice}</strong>
              </div>
            )}

            {errorMsg && (
              <div className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center justify-center gap-2 sm:gap-2.5">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className="w-10 h-12 sm:w-11 sm:h-12 text-center text-lg font-bold font-mono border border-slate-200 rounded-xl bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/25 focus:border-[#6D28D9]"
                />
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <button
                type="button"
                onClick={() => setStep('email')}
                className="font-medium text-slate-600 hover:text-slate-900"
              >
                Change email
              </button>
              {countdown > 0 ? (
                <span className="tabular-nums">
                  Resend OTP in <strong className="text-[#6D28D9]">00:{String(countdown).padStart(2, '0')}</strong>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => handleSendOtp()}
                  className="inline-flex items-center gap-1 font-semibold text-[#6D28D9] hover:underline"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Resend OTP</span>
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={verifying}
              className="w-full py-2.5 px-5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold shadow-sm disabled:opacity-50 transition-colors"
            >
              {verifying ? 'Verifying…' : 'Verify OTP'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
