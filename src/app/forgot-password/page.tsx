'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { ResetPasswordForm } from '@/components/ui/reset-password-form';
import { useToast } from '@/hooks/use-toast';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendCode = async (e: React.FormEvent) => {
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
        setError(data.error || 'Failed to send reset code');
      } else {
        setCodeSent(true);
        toast({
          title: "Verification code sent",
          description: `We've sent a 6-digit code to ${email}.`,
        });
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (code: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  };

  const handleResetPassword = async (password: string): Promise<void> => {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        toast({
          title: "Password reset successful",
          description: "Your password has been updated. Redirecting to login...",
        });
        setTimeout(() => router.push('/'), 3000);
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reset password');
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message,
      });
      throw err;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6 font-body">
      <div className="w-full max-w-[440px] space-y-8">
        {!codeSent ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-center">
              <Logo className="h-10 w-auto" />
            </div>
            <div className="space-y-2 text-center">
              <h1 className="font-headline text-3xl font-bold text-white tracking-tight">Forgot password?</h1>
              <p className="text-zinc-400 text-sm">Enter your email and we'll send you a verification code.</p>
            </div>

            {error && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-500">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSendCode} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-zinc-400">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/5 border-white/10 text-white focus-visible:ring-white h-11"
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-white text-black hover:bg-zinc-200 h-11 rounded-[6px] transition-all font-bold"
                disabled={loading}
              >
                {loading ? 'Sending code...' : 'Send verification code'}
              </Button>
            </form>

            <div className="flex justify-center">
              <Link href="/" className="flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <ResetPasswordForm 
              email={email}
              onVerifyCode={handleVerifyCode}
              onSubmit={handleResetPassword}
              onCancel={() => setCodeSent(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}