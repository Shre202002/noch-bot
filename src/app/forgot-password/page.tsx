'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogoIcon } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Something went wrong.');
        setLoading(false);
        return;
      }

      router.push(`/reset-password?email=${encodeURIComponent(email)}`);

    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-white font-body selection:bg-[#36f4a4]/30">
      <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <LogoIcon className="h-10 w-auto" />
            <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#36f4a4] border-2 border-[#0a0a0a]" />
          </div>
          
          <h1 className="text-[36px] font-normal tracking-tight text-white leading-none pt-4" style={{ letterSpacing: '-0.9px' }}>
            Reset your password
          </h1>
          <p className="text-[#7d8187] text-sm">
            Enter your email and we'll send you a 6-digit OTP
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-500 rounded-2xl">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-widest text-[#7d8187] ml-1">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#1f2228] border-[#2a2d35] text-white focus-visible:ring-0 focus-visible:border-white h-12 rounded-2xl transition-all"
              required
            />
          </div>

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full bg-white hover:bg-zinc-200 text-black font-bold h-12 rounded-full transition-all group"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <span className="flex items-center gap-2">
                Send OTP <ArrowLeft className="h-4 w-4 rotate-180 transition-transform group-hover:translate-x-1" />
              </span>
            )}
          </Button>

          <div className="text-center">
            <Link 
              href="/" 
              className="text-sm text-[#7d8187] hover:text-white transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}