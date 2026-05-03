
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-black font-body">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 bg-[#0D0D0D] border-r border-[#2A2A2A]">
        <div>
          <Logo className="h-10 w-auto" />
          <div className="mt-20 space-y-8">
            <h2 className="font-headline text-5xl font-bold tracking-tight text-[#FAFAFA] leading-tight">
              Start for free. <br />
              <span className="text-violet-500">Scale as you grow.</span>
            </h2>
            <ul className="space-y-4">
              {[
                'Free tier for testing and small projects.',
                'Pay as you scale usage-based plans.',
                'Dedicated support for growing teams.'
              ].map((text, i) => (
                <li key={i} className="flex items-center gap-3 text-[#71717A]">
                  <CheckCircle2 className="h-5 w-5 text-violet-500" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="text-sm text-[#71717A]">
          © 2026 NOCTA. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="lg:hidden flex justify-center mb-8">
            <Logo className="h-10 w-auto" />
          </div>
          
          <div className="space-y-2 text-center lg:text-left">
            <h1 className="font-headline text-3xl font-bold text-[#FAFAFA]">Create account</h1>
            <p className="text-[#71717A]">Join Nocta today and start building.</p>
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
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-violet-600 hover:bg-violet-700 text-[#FAFAFA] h-11 rounded-[6px] transition-all font-semibold"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Start now'} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[#2A2A2A]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-black px-2 text-[#71717A]">Or continue with</span>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full border-[#2A2A2A] bg-transparent text-[#FAFAFA] hover:bg-[#0D0D0D] h-11 h-11 rounded-[6px]"
            asChild
          >
            <Link href="/api/auth/google">
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google
            </Link>
          </Button>

          <p className="text-center text-sm text-[#71717A]">
            Already have an account?{' '}
            <Link href="/login" className="text-violet-500 hover:text-violet-400 transition-colors font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
