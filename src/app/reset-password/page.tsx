'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogoIcon } from '@/components/logo';
import { ResetPasswordForm } from '@/components/ui/reset-password-form';
import { useToast } from '@/hooks/use-toast';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const email = searchParams.get('email') || '';

  const handleVerifyCode = async (code: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code }),
      });

      const data = await res.json();
      if (res.ok) {
        sessionStorage.setItem('nocta_reset_token', data.resetToken);
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  };

  const handleSubmitPassword = async (password: string): Promise<void> => {
    const resetToken = sessionStorage.getItem('nocta_reset_token');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword: password }),
      });

      if (res.ok) {
        sessionStorage.removeItem('nocta_reset_token');
        router.push('/?reset=success');
      } else {
        const data = await res.json();
        toast({
          variant: 'destructive',
          title: 'Error',
          description: data.error || 'Failed to reset password',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong. Please try again.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-white font-body">
      <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col items-center text-center space-y-4 mb-4">
          <LogoIcon className="h-10 w-auto" />
        </div>
        
        <ResetPasswordForm
          email={email}
          onVerifyCode={handleVerifyCode}
          onSubmit={handleSubmitPassword}
          onCancel={() => router.push('/')}
        />
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}