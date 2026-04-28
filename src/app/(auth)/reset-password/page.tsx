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

export default function ResetPasswordPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Reset Password</CardTitle>
        <CardDescription>
          Enter a new password for your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="password">New Password</Label>
          <Input id="password" type="password" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <Input id="confirm-password" type="password" required />
        </div>
        <Button type="submit" className="w-full">
          Set New Password
        </Button>
        <div className="mt-4 text-center text-sm">
          Remembered your password?{' '}
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
