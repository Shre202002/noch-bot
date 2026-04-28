import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ConfigurePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure Your Chatbot</CardTitle>
        <CardDescription>
          This is where you will configure your bot's crawling, persona, appearance, and theme.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
