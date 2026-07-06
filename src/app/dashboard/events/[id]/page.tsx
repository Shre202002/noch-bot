"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Loader2, Save, Rocket, Plus, Trash2, 
  Settings, FormInput, CreditCard, Users, GripVertical
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface FormField {
  _id: string;
  field_key: string;
  label: string;
  field_type: string;
  is_required: boolean;
}

interface EventData {
  _id: string;
  name: string;
  status: string;
  description: string;
  start_at: string;
  end_at: string;
  capacity: number;
  is_paid: boolean;
  price: number | null;
  form_fields: FormField[];
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    fetch(`/api/events/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setEvent(data.data);
        setLoading(false);
      });
  }, [params.id]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/events/${params.id}/publish`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to publish");
      }
      toast({ title: "Success", description: "Event is now live!" });
      router.refresh();
      // Re-fetch local state
      const updated = await fetch(`/api/events/${params.id}`).then(r => r.json());
      setEvent(updated.data);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Publish Failed", description: err.message });
    } finally {
      setPublishing(false);
    }
  };

  const addField = async () => {
    const key = `field_${Date.now()}`;
    try {
      const res = await fetch(`/api/events/${params.id}/form-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_key: key,
          label: "New Question",
          field_type: "text",
          is_required: true,
        }),
      });
      if (res.ok) {
        const refresh = await fetch(`/api/events/${params.id}`).then(r => r.json());
        setEvent(refresh.data);
      }
    } catch (err) {}
  };

  const deleteField = async (fieldId: string) => {
    try {
      await fetch(`/api/events/${params.id}/form-fields/${fieldId}`, { method: "DELETE" });
      setEvent(prev => prev ? { ...prev, form_fields: prev.form_fields.filter(f => f._id !== fieldId) } : null);
    } catch (err) {}
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-20">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <Link href="/dashboard/events">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight">{event.name}</h1>
              <Badge variant={event.status === "published" ? "default" : "secondary"}>
                {event.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">ID: {event._id}</p>
          </div>
        </div>

        {event.status === "draft" && (
          <Button 
            onClick={handlePublish} 
            disabled={publishing}
            className="rounded-full bg-[#36f4a4] text-black hover:bg-[#36f4a4]/90 font-bold"
          >
            {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
            Publish Event
          </Button>
        )}
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList className="bg-accent/20 border border-border p-1 h-auto rounded-full">
          <TabsTrigger value="details" className="rounded-full px-6 py-2 data-[state=active]:bg-background">
            <Settings className="mr-2 h-4 w-4" /> Details
          </TabsTrigger>
          <TabsTrigger value="fields" className="rounded-full px-6 py-2 data-[state=active]:bg-background">
            <FormInput className="mr-2 h-4 w-4" /> Attendee Form
          </TabsTrigger>
          <TabsTrigger value="gateway" className="rounded-full px-6 py-2 data-[state=active]:bg-background">
            <CreditCard className="mr-2 h-4 w-4" /> Payments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card className="border-border bg-card/30">
            <CardContent className="p-6 space-y-6">
              <div className="grid gap-2">
                <Label>Event Name</Label>
                <Input defaultValue={event.name} className="bg-background/50" />
              </div>
              <div className="grid gap-2">
                <Label>Capacity</Label>
                <Input type="number" defaultValue={event.capacity} className="bg-background/50" />
              </div>
              <Button disabled={saving} className="rounded-full px-8">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold">Attendee Questions</h3>
              <p className="text-xs text-muted-foreground">What details should the chatbot ask each guest?</p>
            </div>
            <Button onClick={addField} size="sm" variant="outline" className="rounded-full">
              <Plus className="mr-2 h-3 w-3" /> Add Field
            </Button>
          </div>

          <div className="space-y-3">
            {event.form_fields.map((field, idx) => (
              <Card key={field._id} className="border-border bg-card/30 group">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="cursor-grab text-muted-foreground hover:text-foreground">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div className="grid flex-1 gap-1">
                    <p className="text-sm font-bold">{field.label}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {field.field_type} • {field.field_key} • {field.is_required ? "Required" : "Optional"}
                    </p>
                  </div>
                  <Button 
                    onClick={() => deleteField(field._id)}
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8 text-muted-foreground hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}

            {event.form_fields.length === 0 && (
              <div className="py-12 text-center border-2 border-dashed border-border rounded-2xl text-muted-foreground text-sm">
                No custom questions added yet. The bot will only ask for the number of tickets.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="gateway">
          <Card className="border-border bg-card/30">
            <CardContent className="p-12 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold">Payment Gateway</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  {!event.is_paid 
                    ? "This is a free event. No payment configuration is required." 
                    : "Connect your Stripe, Razorpay or PayPal account to accept payments."}
                </p>
              </div>
              {event.is_paid && (
                <Button variant="outline" className="rounded-full">
                  Configure Gateway
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
