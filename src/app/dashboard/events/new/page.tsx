"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, Save, CalendarIcon, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const eventSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(10, "Description should be at least 10 chars"),
  start_at: z.date({ required_error: "Start date is required" }),
  end_at: z.date({ required_error: "End date is required" }),
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
  if (data.end_at <= data.start_at) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "End date must be after start date",
      path: ["end_at"],
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
        body: JSON.stringify({
          ...values,
          start_at: values.start_at.toISOString(),
          end_at: values.end_at.toISOString(),
        }),
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
        <h1 className="text-3xl font-black tracking-tight text-white">New Event</h1>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-8">
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6 space-y-6">
            <div className="grid gap-2">
              <Label className="text-white/70">Event Name</Label>
              <Input {...form.register("name")} placeholder="NochBot Developers Meetup" className="bg-black/40 border-white/10" />
              {form.formState.errors.name && (
                <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label className="text-white/70">Description</Label>
              <Textarea {...form.register("description")} placeholder="Describe your event..." className="min-h-[120px] bg-black/40 border-white/10" />
              {form.formState.errors.description && (
                <p className="text-xs text-red-500">{form.formState.errors.description.message}</p>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label className="text-white/70">Start Date & Time</Label>
                <Controller
                  control={form.control}
                  name="start_at"
                  render={({ field }) => (
                    <DateTimePicker
                      date={field.value}
                      setDate={field.onChange}
                      error={form.formState.errors.start_at?.message}
                    />
                  )}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-white/70">End Date & Time</Label>
                <Controller
                  control={form.control}
                  name="end_at"
                  render={({ field }) => (
                    <DateTimePicker
                      date={field.value}
                      setDate={field.onChange}
                      error={form.formState.errors.end_at?.message}
                    />
                  )}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-white/70">Venue / Location</Label>
              <Input {...form.register("venue")} placeholder="Tech Hub, Main Hall" className="bg-black/40 border-white/10" />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label className="text-white/70">Total Capacity</Label>
                <Input type="number" {...form.register("capacity")} className="bg-black/40 border-white/10" />
                {form.formState.errors.capacity && (
                  <p className="text-xs text-red-500">{form.formState.errors.capacity.message}</p>
                )}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/5 p-4 bg-accent/20 h-10 self-end">
                <div className="space-y-0.5">
                  <Label className="text-white/70">Allow Group Booking</Label>
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
                  <Label className="text-white/70">Max Tickets per Booking</Label>
                  <Input type="number" {...form.register("max_tickets_per_booking")} className="bg-black/40 border-white/10" />
                  {form.formState.errors.max_tickets_per_booking && (
                    <p className="text-xs text-red-500">{form.formState.errors.max_tickets_per_booking.message}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between rounded-xl border border-white/5 p-4 bg-accent/20">
              <div className="space-y-0.5">
                <Label className="text-white/70 font-bold">Paid Event</Label>
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
                    <Label className="text-white/70">Price</Label>
                    <Input type="number" step="0.01" {...form.register("price")} className="bg-black/40 border-white/10" />
                    {form.formState.errors.price && (
                      <p className="text-xs text-red-500">{form.formState.errors.price.message}</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-white/70">Currency</Label>
                    <Input {...form.register("currency")} className="bg-black/40 border-white/10" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button asChild variant="outline" className="rounded-full border-white/10 text-white/70 hover:bg-white/5">
            <Link href="/dashboard/events">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading} className="rounded-full bg-white text-black hover:bg-zinc-200 min-w-[140px] font-bold">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Create Draft
          </Button>
        </div>
      </form>
    </div>
  );
}

function DateTimePicker({ date, setDate, error }: { date?: Date, setDate: (d: Date) => void, error?: string }) {
  const [time, setTime] = useState(date ? format(date, "HH:mm:ss") : "12:00:00");

  const updateDateTime = (newDate?: Date, newTime?: string) => {
    const d = newDate || date || new Date();
    const t = newTime || time;
    const [hours, minutes, seconds] = t.split(":").map(Number);
    
    const updated = new Date(d);
    updated.setHours(hours || 0, minutes || 0, seconds || 0);
    setDate(updated);
  };

  return (
    <div className="space-y-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal bg-black/40 border-white/10 rounded-lg h-9 px-3",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-white/50" />
            {date ? format(date, "PPP p") : <span>Pick date and time</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-black border-white/10" align="start">
          <div className="rounded-lg border border-white/10">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && updateDateTime(d)}
              className="p-2 bg-black"
            />
            <div className="border-t border-white/10 p-3">
              <div className="flex items-center gap-3">
                <Label className="text-xs text-white/70">
                  Enter time
                </Label>
                <div className="relative grow">
                  <Input
                    type="time"
                    step="1"
                    value={time}
                    onChange={(e) => {
                      setTime(e.target.value);
                      updateDateTime(undefined, e.target.value);
                    }}
                    className="peer ps-9 bg-black/40 border-white/10 h-8 text-xs [&::-webkit-calendar-picker-indicator]:hidden"
                  />
                  <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 text-muted-foreground/80 peer-disabled:opacity-50">
                    <Clock size={14} strokeWidth={2} aria-hidden="true" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {error && <p className="text-[10px] text-red-500 ml-1">{error}</p>}
    </div>
  );
}
