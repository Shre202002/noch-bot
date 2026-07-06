
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const eventSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(10, "Description should be at least 10 chars"),
  start_at: z.string().min(1, "Start date is required"),
  end_at: z.string().min(1, "End date is required"),
  venue: z.string().optional(),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1"),
  is_paid: z.boolean().default(false),
  price: z.coerce.number().optional().nullable(),
  currency: z.string().default("USD"),
  allow_group_booking: z.boolean().default(true),
  max_tickets_per_booking: z.coerce.number().min(1).default(5),
}).superRefine((data, ctx) => {
  if (data.is_paid && (!data.price || data.price <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Price is required for paid events",
      path: ["price"],
    });
  }
  if (data.allow_group_booking && (!data.max_tickets_per_booking || data.max_tickets_per_booking < 1)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Max tickets per booking is required for group bookings",
      path: ["max_tickets_per_booking"],
    });
  }
});

type EventFormValues = z.infer<typeof eventSchema>;

export default function NewEventPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      is_paid: false,
      currency: "USD",
      allow_group_booking: true,
      max_tickets_per_booking: 5,
    },
  });

  const onSubmit = async (values: EventFormValues) => {
    setLoading(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create event");

      toast({ title: "Success", description: "Event draft created" });
      router.push(`/dashboard/events/${data.id}`);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link href="/dashboard/events">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-black tracking-tight">New Event</h1>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-8">
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6 space-y-6">
            <div className="grid gap-2">
              <Label>Event Name</Label>
              <Input {...form.register("name")} placeholder="NochBot Developers Meetup" />
              {form.formState.errors.name && (
                <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea {...form.register("description")} placeholder="Describe your event..." className="min-h-[120px]" />
              {form.formState.errors.description && (
                <p className="text-xs text-red-500">{form.formState.errors.description.message}</p>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Start Date & Time</Label>
                <Input type="datetime-local" {...form.register("start_at")} />
                {form.formState.errors.start_at && (
                  <p className="text-xs text-red-500">{form.formState.errors.start_at.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>End Date & Time</Label>
                <Input type="datetime-local" {...form.register("end_at")} />
                {form.formState.errors.end_at && (
                  <p className="text-xs text-red-500">{form.formState.errors.end_at.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Venue / Location</Label>
              <Input {...form.register("venue")} placeholder="Tech Hub, Main Hall" />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Total Capacity</Label>
                <Input type="number" {...form.register("capacity")} />
                {form.formState.errors.capacity && (
                  <p className="text-xs text-red-500">{form.formState.errors.capacity.message}</p>
                )}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-accent/20 h-10 self-end">
                <div className="space-y-0.5">
                  <Label>Allow Group Booking</Label>
                </div>
                <Switch 
                  checked={form.watch("allow_group_booking")} 
                  onCheckedChange={(val) => form.setValue("allow_group_booking", val)} 
                />
              </div>
            </div>

            <AnimatePresence>
              {form.watch("allow_group_booking") && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="grid gap-2 overflow-hidden">
                  <Label>Max Tickets per Booking</Label>
                  <Input type="number" {...form.register("max_tickets_per_booking")} />
                  {form.formState.errors.max_tickets_per_booking && (
                    <p className="text-xs text-red-500">{form.formState.errors.max_tickets_per_booking.message}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-accent/20">
              <div className="space-y-0.5">
                <Label>Paid Event</Label>
                <p className="text-xs text-muted-foreground">Charge for tickets via integrated gateways</p>
              </div>
              <Switch 
                checked={form.watch("is_paid")} 
                onCheckedChange={(val) => form.setValue("is_paid", val)} 
              />
            </div>

            <AnimatePresence>
              {form.watch("is_paid") && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-2 gap-4 pt-2 overflow-hidden">
                  <div className="grid gap-2">
                    <Label>Price</Label>
                    <Input type="number" step="0.01" {...form.register("price")} />
                    {form.formState.errors.price && (
                      <p className="text-xs text-red-500">{form.formState.errors.price.message}</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label>Currency</Label>
                    <Input {...form.register("currency")} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/dashboard/events">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading} className="rounded-full bg-white text-black hover:bg-zinc-200 min-w-[140px]">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Create Draft
          </Button>
        </div>
      </form>
    </div>
  );
}
