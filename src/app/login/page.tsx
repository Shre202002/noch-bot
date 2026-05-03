
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redundant standalone login page.
 * Users are now authenticated via the navbar SigninModal.
 */
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home where the modal trigger exists
    router.replace('/');
  }, [router]);

  return null;
}
