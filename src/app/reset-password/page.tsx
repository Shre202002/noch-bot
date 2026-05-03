'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/logo';
import { ResetPasswordForm } from '@/components/ui/reset-password-form';
import { useToast } from '@/hooks/use-toast';

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  // Note: For OTP-based reset, we might not need a URL token, 
  // but if the user arrives from an email link, we can pre-fill.
  const email = searchParams.get('email') || "";

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
        <div className="flex justify-center mb-8">
          <Logo className="h-10 w-auto" />
        </div>
        <ResetPasswordForm 
          email={email}
          onVerifyCode={handleVerifyCode}
          onSubmit={handleResetPassword}
          onCancel={() => router.push('/')}
        />
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}