import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg role="img" viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.62 1.62-4.55 1.62-3.87 0-7-3.13-7-7s3.13-7 7-7c1.73 0 3.23.63 4.34 1.68l2.5-2.5C17.96 1.68 15.47 0 12.48 0 5.88 0 0 5.88 0 12.48s5.88 12.48 12.48 12.48c2.92 0 5.17-1 6.9-2.65 1.81-1.73 2.65-4.34 2.65-6.9v-3.28h-9.56z"
      />
    </svg>
);

export default function LoginPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Login</CardTitle>
        <CardDescription>
          Enter your email below to login to your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="m@example.com" required />
        </div>
        <div className="grid gap-2">
           <div className="flex items-center">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" prefetch={false} className="ml-auto inline-block text-sm underline">
                Forgot your password?
            </Link>
           </div>
          <Input id="password" type="password" required />
        </div>
        <Button type="submit" className="w-full">
          Sign In
        </Button>
        <Button variant="outline" className="w-full">
          <GoogleIcon className="mr-2 h-4 w-4" />
          Sign in with Google
        </Button>
        <div className="mt-4 text-center text-sm">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="underline">
            Sign up
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
