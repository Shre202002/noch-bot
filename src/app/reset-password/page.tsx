
'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(!token ? 'Missing reset token' : null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to reset password');
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[400px] space-y-8">
      <div className="flex justify-center">
        <Logo className="h-10 w-auto" />
      </div>

      {!success ? (
        <div className="space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="font-headline text-3xl font-bold text-[#FAFAFA]">New password</h1>
            <p className="text-[#71717A]">Please enter your new password below.</p>
          </div>

          {error && (
            <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-500">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-[#FAFAFA]">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#0D0D0D] border-[#2A2A2A] text-[#FAFAFA] focus-visible:ring-violet-600 h-11"
                  required
                  disabled={!token}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-sm text-[#FAFAFA]">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Repeat new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="bg-[#0D0D0D] border-[#2A2A2A] text-[#FAFAFA] focus-visible:ring-violet-600 h-11"
                  required
                  disabled={!token}
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-violet-600 hover:bg-violet-700 text-[#FAFAFA] h-11 rounded-[6px] transition-all font-semibold"
              disabled={loading || !token}
            >
              {loading ? 'Updating...' : 'Update password'}
            </Button>
          </form>
        </div>
      ) : (
        <div className="space-y-8 text-center animate-in fade-in zoom-in duration-500">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <div className="space-y-2">
            <h2 className="font-headline text-3xl font-bold text-[#FAFAFA]">Password updated</h2>
            <p className="text-[#71717A]">Your password has been reset successfully. Redirecting you to login...</p>
          </div>
        </div>
      )}

      <div className="flex justify-center pt-4">
        <Link href="/login" className="flex items-center gap-2 text-sm text-[#71717A] hover:text-[#FAFAFA] transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6 font-body">
      <Suspense fallback={<div className="text-white">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
