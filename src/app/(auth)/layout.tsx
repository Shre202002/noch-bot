import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-6 flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2">
            <Logo />
            <span className="font-bold text-2xl">Nocta</span>
        </Link>
      </div>
      {children}
    </div>
  );
}
