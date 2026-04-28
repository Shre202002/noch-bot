import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bot, Code, Globe, MessageSquare } from "lucide-react";
import Link from "next/link";

const stats = [
    {
        title: "Total Messages",
        value: "1,254",
        description: "All-time messages sent",
        icon: <MessageSquare className="h-6 w-6 text-muted-foreground" />,
    },
    {
        title: "Messages This Month",
        value: "312",
        description: "Usage in the current cycle",
        icon: <BarChart className="h-6 w-6 text-muted-foreground" />,
    },
    {
        title: "Bot Status",
        value: "Active",
        description: "Knowledge base is crawled",
        icon: <Bot className="h-6 w-6 text-muted-foreground" />,
    },
    {
        title: "Crawled Website",
        value: "nocta.ai",
        description: "Primary data source",
        icon: <Globe className="h-6 w-6 text-muted-foreground" />,
    },
]

export default function DashboardOverviewPage() {
    return (
        <div className="space-y-8">
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat, index) => (
                    <Card key={index}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                            {stat.icon}
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <p className="text-xs text-muted-foreground">{stat.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Quick Links</CardTitle>
                    <CardDescription>Jump to the most common actions.</CardDescription>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-4">
                    <div className="flex flex-col justify-between p-4 border rounded-lg bg-card">
                        <div className="mb-4">
                            <Bot className="h-8 w-8 text-primary mb-2" />
                            <h3 className="font-semibold">Configure Bot</h3>
                            <p className="text-sm text-muted-foreground">Adjust your chatbot's persona, appearance, and theme.</p>
                        </div>
                        <Button asChild variant="secondary">
                            <Link href="/dashboard/configure">Go to Configuration</Link>
                        </Button>
                    </div>
                    <div className="flex flex-col justify-between p-4 border rounded-lg bg-card">
                        <div className="mb-4">
                            <Code className="h-8 w-8 text-primary mb-2" />
                            <h3 className="font-semibold">Embed on Your Site</h3>
                            <p className="text-sm text-muted-foreground">Get the code to install your chatbot on any website.</p>
                        </div>
                        <Button asChild variant="secondary">
                            <Link href="/dashboard/embed">Get Embed Code</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
