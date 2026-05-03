
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to send reset email');
      } else {
        setSent(true);
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6 font-body">
      <div className="w-full max-w-[400px] space-y-8">
        <div className="flex justify-center">
          <Logo className="h-10 w-auto" />
        </div>

        {!sent ? (
          <div className="space-y-8">
            <div className="space-y-2 text-center">
              <h1 className="font-headline text-3xl font-bold text-[#FAFAFA]">Reset password</h1>
              <p className="text-[#71717A]">Enter your email and we'll send you a link to reset your password.</p>
            </div>

            {error && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-500">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-[#FAFAFA]">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-[#0D0D0D] border-[#2A2A2A] text-[#FAFAFA] focus-visible:ring-violet-600 h-11"
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-violet-600 hover:bg-violet-700 text-[#FAFAFA] h-11 rounded-[6px] transition-all font-semibold"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </Button>
            </form>
          </div>
        ) : (
          <div className="space-y-8 text-center animate-in fade-in zoom-in duration-500">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <div className="space-y-2">
              <h2 className="font-headline text-3xl font-bold text-[#FAFAFA]">Check your email</h2>
              <p className="text-[#71717A]">
                If an account exists for <span className="text-[#FAFAFA]">{email}</span>, you will receive a reset link shortly.
              </p>
            </div>
            <Button variant="outline" className="w-full border-[#2A2A2A] bg-transparent text-[#FAFAFA] hover:bg-[#0D0D0D] h-11 h-11 rounded-[6px]" asChild>
              <Link href="/login">Return to login</Link>
            </Button>
          </div>
        )}

        <div className="flex justify-center pt-4">
          <Link href="/login" className="flex items-center gap-2 text-sm text-[#71717A] hover:text-[#FAFAFA] transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
