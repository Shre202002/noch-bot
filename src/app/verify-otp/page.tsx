'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LogoIcon } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [shaking, setShaking] = useState(false);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!email) {
      router.replace('/forgot-password');
    }
    // Auto-focus first box
    inputRefs.current[0]?.focus();
  }, [email, router]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Auto-advance
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const data = e.clipboardData.getData('text').trim();
    if (data.length === 6 && !isNaN(Number(data))) {
      setOtp(data.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (otp.some(v => !v)) return;

    setLoading(true);
    setError(null);
    setShaking(false);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otp.join('') }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid OTP');
        setShaking(true);
        setOtp(new Array(6).fill(''));
        inputRefs.current[0]?.focus();
      } else {
        sessionStorage.setItem('nocta_reset_token', data.resetToken);
        router.push('/reset-password');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setCountdown(30);
    } catch (err) {
      setError('Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-white font-body selection:bg-[#36f4a4]/30">
      <div className="w-full max-w-[400px] space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center text-center space-y-4">
          <LogoIcon className="h-10 w-auto" />
          <h1 className="text-[32px] font-normal tracking-tight text-white leading-none pt-2">
            Enter OTP
          </h1>
          <p className="text-[#7d8187] text-sm">
            We sent a 6-digit code to <br /><span className="text-white font-medium">{email}</span>
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-500 rounded-2xl">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className={cn("flex justify-between gap-2", shaking && "animate-shake")}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => inputRefs.current[i] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={handlePaste}
                disabled={loading}
                className="w-12 h-14 text-center text-2xl font-bold bg-[#1f2228] border-[#2a2d35] border rounded-[8px] focus:border-[#36f4a4] focus:outline-none transition-all"
              />
            ))}
          </div>

          <Button 
            type="submit" 
            disabled={loading || otp.some(v => !v)}
            className="w-full bg-[#36f4a4] hover:bg-[#36f4a4]/90 text-black font-bold h-12 rounded-full transition-all"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verify OTP'}
          </Button>

          <div className="text-center space-y-4">
            <button
              type="button"
              onClick={handleResend}
              disabled={countdown > 0 || loading}
              className="text-sm font-medium transition-colors text-[#7d8187] hover:text-white disabled:opacity-50 inline-flex items-center gap-2"
            >
              {countdown > 0 ? (
                `Resend in ${countdown}s`
              ) : (
                <><RefreshCw className="h-3 w-3" /> Resend OTP</>
              )}
            </button>
            <br />
            <Link 
              href="/forgot-password" 
              className="text-xs text-[#7d8187] hover:text-white transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft className="h-3 w-3" />
              Change email
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">Loading...</div>}>
      <VerifyOtpContent />
    </Suspense>
  );
}
