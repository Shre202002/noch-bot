
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redundant standalone register page.
 * Users are now authenticated via the navbar SignupModal.
 */
export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home where the modal trigger exists
    router.replace('/');
  }, [router]);

  return null;
}
