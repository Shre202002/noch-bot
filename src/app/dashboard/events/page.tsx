"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Calendar, Users, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EventItem {
  _id: string;
  name: string;
  status: "draft" | "published" | "closed" | "cancelled";
  start_at: string;
  tickets_sold: number;
  capacity: number;
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events")
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Events</h1>
          <p className="mt-1 text-muted-foreground">Manage your ticketed experiences</p>
        </div>
        <Button asChild className="rounded-full bg-white text-black hover:bg-zinc-200 cursor-pointer">
          <Link href="/dashboard/events/new">
            <Plus className="mr-2 h-4 w-4" /> Create Event
          </Link>
        </Button>
      </div>

      {events.length === 0 ? (
        <Card className="border-dashed bg-transparent py-20 text-center">
          <CardContent className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/30">
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-bold">No events yet</p>
              <p className="text-sm text-muted-foreground">Create your first event to start selling tickets</p>
            </div>
            <Button asChild variant="outline" className="rounded-full cursor-pointer">
              <Link href="/dashboard/events/new">Get Started</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event, i) => (
            <motion.div
              key={event._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={`/dashboard/events/${event._id}`} className="cursor-pointer block">
                <Card className="group border-border bg-card/50 transition-all hover:border-primary/50 hover:bg-card">
                  <CardContent className="p-6">
                    <div className="mb-4 flex items-start justify-between">
                      <Badge variant={event.status === "published" ? "default" : "secondary"} className="capitalize">
                        {event.status}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <h3 className="mb-1 text-xl font-bold line-clamp-1">{event.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(event.start_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>

                    <div className="mt-6 space-y-2">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <span>Capacity</span>
                        <span className="text-foreground">
                          {event.tickets_sold} / {event.capacity}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, (event.tickets_sold / event.capacity) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
