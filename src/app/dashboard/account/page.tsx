import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function AccountPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Management</CardTitle>
        <CardDescription>
          This is where you will manage your account details, password, and subscription plan.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
