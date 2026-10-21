"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Loader2, Save, Rocket, Trash2,
  Settings, FormInput, CreditCard,
  CalendarIcon, CheckCircle2, AlertCircle, Layout,
  Mail, Scissors, Check, ShieldCheck, RefreshCcw,
  Palette, RotateCcw, Upload, Ticket
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { TicketPreview, TICKET_TEMPLATE_DEFAULT_PALETTES } from "@/components/TicketPreview";
import { Switch } from "@/components/ui/switch";
import { FormBuilder, type FormField } from "./form-builder";
import { EventProgress } from "./event-progress";
import { TemplatePicker } from "./template-picker";
import { EmblemPicker } from "./emblem-picker";
import { TICKET_TEMPLATES } from "@/lib/ticketTemplates";
import { GoLivePanel, StepFooter, StepTabsBar, nextStepTab, type StepDef } from "./step-nav";
import { TestBookingPanel } from "./test-booking-panel";
import { eventReadiness, isTicketDesignConfirmed } from "@/lib/eventReadiness";
import { TicketColorPalette } from "@/models/Event";
import { TicketColorField } from "@/components/ui/color-picker";
import { createDebouncer } from "@/lib/colorInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface EventData {
  _id: string;
  name: string;
  status: string;
  description: string;
  start_at: string;
  end_at: string;
  venue: string | null;
  capacity: number;
  tickets_sold: number;
  is_paid: boolean;
  price: number | null;
  currency: string;
  ticket_template_id: string;
  ticket_color_palette?: TicketColorPalette;
  ticket_design_confirmed_at?: string | null;
  logo_url: string | null;
  logo_file_id?: string | null;
  remove_background?: boolean;
  bg_removed_logo_url?: string | null;
  logo_emblem?: string | null;
  form_fields: FormField[];
}

function buildBgRemovedImageKitUrl(url: string) {
  if (!url) return "";
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}tr=e-bgremove`;
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [event, setEvent] = useState<EventData | null>(null);
  const [tab, setTab] = useState("details");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [isGatewayConfigured, setIsGatewayConfigured] = useState(false);
  const [testCount, setTestCount] = useState(0);
  const [configuredProvider, setConfiguredProvider] = useState<string | null>(null);
  const [isEditingGateway, setIsEditingGateway] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState(0);

  // Field editing state

  // Gateway form state
  const [gatewayProvider, setGatewayProvider] = useState("stripe");
  const [gatewayKeys, setGatewayKeys] = useState({ key_id: "", key_secret: "", webhook_secret: "" });

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${params.id}`);
      const data = await res.json();
      if (data.data) {
        setEvent(data.data);
        setName(data.data.name);
        setDescription(data.data.description);
        setCapacity(data.data.capacity);
      }

      const statusRes = await fetch('/api/events/payment-gateway-status');
      const statusData = await statusRes.json();
      setIsGatewayConfigured(statusData.is_configured);
      setConfiguredProvider(statusData.provider);

      // How many test bookings exist (shown on the Test booking step).
      const testRes = await fetch(`/api/events/${params.id}/test-status`);
      if (testRes.ok) setTestCount((await testRes.json()).test_count ?? 0);
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to load event" });
    } finally {
      setLoading(false);
    }
  }, [params.id, toast]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // Same rules the publish API enforces (src/lib/eventReadiness.ts), applied to the saved event.
  const readiness = useMemo(
    () => (event ? eventReadiness(event, { fieldCount: event.form_fields.length, gatewayActive: isGatewayConfigured }) : null),
    [event, isGatewayConfigured]
  );
  const published = event?.status === "published";

  // The path through the page, in the order an organizer works. Free events have no Payments step.
  const steps = useMemo<StepDef[]>(() => {
    if (!event || !readiness) return [];
    const shortLabel: Record<string, string> = { details: "Details", fields: "Attendee form", design: "Ticket design", payments: "Payments" };
    return [
      ...readiness.steps.map((r) => ({ tab: r.tab, label: shortLabel[r.id] ?? r.label, done: r.done })),
      // Recommended before going live; counts as done once a test booking exists, and never blocks publishing.
      { tab: "test", label: "Test booking", done: testCount > 0, optional: true },
      { tab: "live", label: "Go live", done: published },
    ];
  }, [event, readiness, published, testCount]);

  const detailsDirty =
    !!event && (name !== event.name || description !== event.description || capacity !== event.capacity);

  // Moving away from Details with edits that were never saved would silently drop them.
  const goTo = (next: string) => {
    if (next === tab) return;
    if (tab === "details" && detailsDirty && !window.confirm("You have unsaved changes to the event details. Leave without saving?")) return;
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, capacity }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Success", description: "Event details updated" });
      fetchEvent();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGateway = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${params.id}/payment-gateway`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: gatewayProvider,
          credentials: {
            [gatewayProvider === 'stripe' ? 'secret_key' : 'key_id']: gatewayKeys.key_id,
            [gatewayProvider === 'razorpay' ? 'key_secret' : 'none']: gatewayKeys.key_secret
          },
          webhook_secret: gatewayKeys.webhook_secret
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save gateway");

      toast({ title: "Gateway Connected", description: `Your ${gatewayProvider} account has been connected.` });
      setIsEditingGateway(false);
      fetchEvent();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Config Failed", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/events/${params.id}/publish`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // The server lists what is still missing; take the organizer to the first of them.
        const first = Array.isArray(err.missing) ? err.missing[0]?.tab : undefined;
        if (first) setTab(first);
        throw new Error(err.error || "Failed to publish");
      }
      toast({ title: "Your event is live", description: "Attendees can now book." });
      await fetchEvent();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Publish Failed", description: err.message });
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteEvent = async () => {
    setDeletingEvent(true);
    try {
      const res = await fetch(`/api/events/${params.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete event");
      toast({ title: "Event Deleted", description: "The event has been removed." });
      router.push("/dashboard/events");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
      setDeletingEvent(false);
    }
  };

  if (loading || !event) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon" className="rounded-full cursor-pointer">
              <Link href="/dashboard/events"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight text-white">{event.name}</h1>
                <Badge variant={event.status === "published" ? "default" : "secondary"}>{event.status.toUpperCase()}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Manage your event experience and ticket issuance.</p>
            </div>
          </div>
          <EventProgress
            done={steps.filter((x) => x.done && x.tab !== "live" && !x.optional).length}
            total={steps.filter((x) => x.tab !== "live" && !x.optional).length}
            nextLabel={steps.find((x) => x.tab === nextStepTab(steps))?.label ?? null}
            published={published}
          />
        </div>

        <div className="flex flex-col gap-4 min-w-[280px]">
          <Card className="border-border bg-card/40 backdrop-blur-sm">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/50">Readiness</h3>
              <ul className="space-y-1">
                {readiness?.steps.map((step) => (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => goTo(step.tab)}
                      className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm hover:bg-white/5 cursor-pointer"
                    >
                      {step.done ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-[#36f4a4]" /> : <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-orange-400" />}
                      <span className={step.done ? "text-white" : "text-white/70"}>{step.label}</span>
                      <span className="sr-only">{step.done ? " (complete)" : " (needs attention)"}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {!published ? (
                <Button
                  onClick={() => goTo("live")}
                  className="w-full rounded-full bg-[#36f4a4] text-black hover:bg-[#36f4a4]/90 font-black h-11 cursor-pointer"
                >
                  <Rocket aria-hidden="true" className="mr-2 h-4 w-4" />
                  {readiness?.complete ? "Review & go live" : "See what is left"}
                </Button>
              ) : (
                <Button asChild variant="outline" className="w-full rounded-full border-white/15 text-white h-11 cursor-pointer">
                  <Link href={`/dashboard/bookings/${event._id}`}>
                    <Ticket aria-hidden="true" className="mr-2 h-4 w-4" /> View bookings
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs value={tab} onValueChange={goTo} className="space-y-6">
        <StepTabsBar steps={steps} activeTab={tab} />

        <TabsContent value="details" className="space-y-8">
          <Card className="border-border bg-card/30 backdrop-blur-sm">
            <CardContent className="p-6 space-y-6">
              <div className="grid gap-2">
                <Label className="text-white/70">Event Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-black/40 border-white/10 text-white" />
              </div>
              <div className="grid gap-2">
                <Label className="text-white/70">Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-black/40 border-white/10 min-h-[100px] text-white" />
              </div>
              <div className="grid gap-2">
                <Label className="text-white/70">Capacity</Label>
                <Input type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="bg-black/40 border-white/10 text-white" />
              </div>
              <Button onClick={handleSaveDetails} disabled={saving} className="rounded-full px-8 h-10 font-bold cursor-pointer bg-[#36f4a4] text-black hover:bg-[#36f4a4]/90 shadow-[0_0_0_3px_rgba(54,244,164,0.18)]">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>

          <Card className="border-red-500/20 bg-red-500/5 backdrop-blur-sm">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-red-400">Danger Zone</h3>
                <p className="text-sm text-zinc-400">Deleting an event is permanent. You can only delete events with no ticket sales.</p>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400 rounded-full font-bold cursor-pointer"
                    disabled={deletingEvent || event.tickets_sold > 0}
                  >
                    {deletingEvent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Delete Event
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400">
                      This action cannot be undone. This will permanently delete the event
                      <strong> "{event.name}"</strong> and all associated attendee form questions.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-transparent border-zinc-800 text-white hover:bg-zinc-900 cursor-pointer">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteEvent}
                      className="bg-red-600 text-white hover:bg-red-700 font-bold border-none cursor-pointer"
                    >
                      Delete Event
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {event.tickets_sold > 0 && (
                <p className="text-[10px] text-red-400 italic">Deletion is blocked because {event.tickets_sold} tickets have already been sold.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields">
          <FormBuilder
            eventId={String(params.id)}
            fields={event.form_fields}
            onFieldsChange={(form_fields) => setEvent((prev) => (prev ? { ...prev, form_fields } : prev))}
            onChanged={fetchEvent}
          />
        </TabsContent>

        <TabsContent value="ticket">
          <TicketDesignView event={event} onUpdate={fetchEvent} />
        </TabsContent>

        <TabsContent value="gateway">
          {isGatewayConfigured && !isEditingGateway ? (
            <Card className="border-[#36f4a4]/20 bg-[#36f4a4]/5 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-8 text-center space-y-6">
                <div className="flex justify-center">
                  <div className="h-20 w-20 rounded-full bg-[#36f4a4]/10 border-4 border-[#36f4a4]/20 flex items-center justify-center animate-in zoom-in duration-500">
                    <ShieldCheck className="h-10 w-10 text-[#36f4a4]" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white">Payment Gateway Verified</h3>
                  <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                    Your <span className="text-[#36f4a4] font-bold uppercase">{configuredProvider}</span> integration is connected and secured with AES-256 encryption.
                  </p>
                </div>

                <div className="flex justify-center items-center gap-4 pt-4">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs font-bold uppercase tracking-wider">
                    <Check className="h-3 w-3 text-[#36f4a4]" />
                    Ready for Checkout
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-white hover:bg-white/5 rounded-full cursor-pointer">
                        <RefreshCcw className="h-3 w-3 mr-2" />
                        Update Configuration
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-black border-white/10 text-white">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Update Payment Gateway?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                          Updating your credentials will overwrite the existing ones. This will affect all paid events in your organization. Are you sure you want to continue?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/5 cursor-pointer">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => setIsEditingGateway(true)} className="bg-white text-black hover:bg-zinc-200 cursor-pointer font-bold">
                          Yes, Update Gateway
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border bg-card/30 backdrop-blur-sm">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center"><CreditCard className="h-5 w-5 text-blue-400" /></div>
                  <div>
                    <h3 className="font-bold text-white">Payment Gateway</h3>
                    <p className="text-sm text-muted-foreground">Credentials are saved for your entire organization.</p>
                  </div>
                </div>

                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label className="text-white">Provider</Label>
                    <Select value={gatewayProvider} onValueChange={setGatewayProvider}>
                      <SelectTrigger className="bg-black/40 border-white/10 text-white cursor-pointer"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-black border-white/10 text-white">
                        <SelectItem value="stripe">Stripe</SelectItem>
                        <SelectItem value="razorpay">Razorpay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-white">{gatewayProvider === 'stripe' ? 'Secret Key' : 'Key ID'}</Label>
                      <Input
                        type="password"
                        placeholder={gatewayProvider === 'stripe' ? "sk_test_..." : "rzp_test_..."}
                        value={gatewayKeys.key_id}
                        onChange={e => setGatewayKeys(p => ({ ...p, key_id: e.target.value }))}
                        className="bg-black/40 border-white/10 text-white"
                      />
                    </div>
                    {gatewayProvider === 'razorpay' && (
                      <div className="space-y-2">
                        <Label className="text-white">Key Secret</Label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={gatewayKeys.key_secret}
                          onChange={e => setGatewayKeys(p => ({ ...p, key_secret: e.target.value }))}
                          className="bg-black/40 border-white/10 text-white"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Webhook Secret (Recommended)</Label>
                    <Input
                      type="password"
                      placeholder="whsec_..."
                      value={gatewayKeys.webhook_secret}
                      onChange={e => setGatewayKeys(p => ({ ...p, webhook_secret: e.target.value }))}
                      className="bg-black/40 border-white/10 text-white"
                    />
                    <p className="text-[10px] text-muted-foreground italic">Use this to verify payment events securely.</p>
                  </div>

                  <div className="flex gap-4">
                    {isEditingGateway && (
                      <Button variant="ghost" onClick={() => setIsEditingGateway(false)} className="text-white hover:bg-white/5 rounded-full cursor-pointer">
                        Cancel
                      </Button>
                    )}
                    <Button onClick={handleSaveGateway} disabled={saving} className="flex-1 rounded-full font-bold h-11 cursor-pointer bg-[#36f4a4] text-black hover:bg-[#36f4a4]/90 shadow-[0_0_0_3px_rgba(54,244,164,0.18)]">
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify & Connect Gateway"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="test">
          <TestBookingPanel
            eventId={String(event._id)}
            missing={readiness?.missing ?? []}
            testCount={testCount}
            paid={!!event.is_paid}
            onFix={goTo}
            onChanged={fetchEvent}
          />
        </TabsContent>

        <TabsContent value="live">
          <GoLivePanel
            eventId={String(event._id)}
            summary={[
              { label: "Event", value: event.name },
              { label: "When", value: `${new Date(event.start_at).toLocaleString()} to ${new Date(event.end_at).toLocaleString()}` },
              { label: "Venue", value: event.venue || "Not set" },
              { label: "Capacity", value: String(event.capacity) },
              { label: "Price", value: event.is_paid ? `${event.currency} ${event.price ?? 0}` : "Free" },
              { label: "Attendee questions", value: String(event.form_fields.length) },
            ]}
            checklist={readiness?.steps ?? []}
            complete={!!readiness?.complete}
            published={published}
            publishing={publishing}
            onFix={goTo}
            onPublish={handlePublish}
            testCount={testCount}
            onTest={() => goTo("test")}
          />
        </TabsContent>

        <StepFooter steps={steps} activeTab={tab} onGo={goTo} />
      </Tabs>

    </div>
  );
}

const COLOR_FIELDS = [
  ["background_color", "Background"],
  ["text_color", "Main text"],
  ["accent_color", "Accent"],
  ["border_color", "Border"],
  ["muted_text_color", "Muted text"],
  ["qr_background_color", "QR background"],
] as const;

function TicketDesignView({ event, onUpdate }: { event: EventData, onUpdate: () => void }) {
  const { toast } = useToast();

  const initialTemplateId = useMemo(() => {
    const tid = event.ticket_template_id;
    return (tid && TICKET_TEMPLATE_DEFAULT_PALETTES[tid]) ? tid : "dark";
  }, [event.ticket_template_id]);

  const [templateId, setTemplateId] = useState(initialTemplateId);
  const [palette, setPalette] = useState<TicketColorPalette>(() => {
    if (event.ticket_color_palette && Object.keys(event.ticket_color_palette).length > 0) {
      return event.ticket_color_palette;
    }
    return TICKET_TEMPLATE_DEFAULT_PALETTES[initialTemplateId] || TICKET_TEMPLATE_DEFAULT_PALETTES.dark;
  });

  const [uploading, setUploading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [isSavingPalette, setIsSavingPalette] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [logoMode, setLogoMode] = useState<"upload" | "emblem">(event.logo_emblem && !event.logo_url ? "emblem" : "upload");
  const [savingEmblem, setSavingEmblem] = useState(false);
  const designConfirmed = isTicketDesignConfirmed(event);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Live colour editing: the palette on screen is the truth while someone is editing. `pendingRef` is true from the
  // first change until it has been saved, and the saved palette is not allowed to overwrite the screen meanwhile.
  const pendingRef = useRef(false);
  const paletteRef = useRef(palette);
  const confirmedRef = useRef(false);
  confirmedRef.current = designConfirmed;

  useEffect(() => {
    if (pendingRef.current) return;
    if (event.ticket_color_palette && Object.keys(event.ticket_color_palette).length > 0) {
      paletteRef.current = event.ticket_color_palette;
      setPalette(event.ticket_color_palette);
    }
  }, [event.ticket_color_palette]);

  // The preview may already look right, so an explicit "use this design" is what lets the event go live.
  const confirmDesign = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/events/${event._id}/ticket-design`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: templateId, color_palette: palette }),
      });
      if (!res.ok) throw new Error("Could not save the design");
      toast({ title: "Ticket design saved" });
      onUpdate();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not save", description: err.message });
    } finally {
      setConfirming(false);
    }
  };

  const handleTemplateChange = async (id: string) => {
    setTemplateId(id);
    const defaultPalette = TICKET_TEMPLATE_DEFAULT_PALETTES[id] || TICKET_TEMPLATE_DEFAULT_PALETTES.dark;
    pendingRef.current = true;
    paletteRef.current = defaultPalette;
    setPalette(defaultPalette);

    try {
      await fetch(`/api/events/${event._id}/ticket-design`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: id,
          color_palette: defaultPalette
        }),
      });
    } finally {
      pendingRef.current = false;
    }
    onUpdate();
  };

  const savePalette = useCallback(async (newPalette: TicketColorPalette) => {
    setIsSavingPalette(true);
    try {
      const res = await fetch(`/api/events/${event._id}/ticket-design`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color_palette: newPalette }),
      });
      if (!res.ok) throw new Error("Failed to save palette");
      // Only the saved palette matches the screen from here on. Refetching would just hand back what is already shown,
      // except the first time, when it brings the "design saved" state.
      if (paletteRef.current === newPalette) pendingRef.current = false;
      if (!confirmedRef.current) onUpdate();
    } catch (err) {
      toast({ variant: "destructive", title: "Autosave failed" });
    } finally {
      setIsSavingPalette(false);
    }
  }, [event._id, onUpdate, toast]);

  // One save, 400 ms after the last finished colour change (and straight away if the tab is left first).
  const saveRef = useRef(savePalette);
  saveRef.current = savePalette;
  const saveSoon = useMemo(() => createDebouncer(() => { void saveRef.current(paletteRef.current); }, 400), []);
  useEffect(() => () => saveSoon.flush(), [saveSoon]);

  // Stable handlers per colour, so the memoised colour fields do not re-render for each other's changes.
  const colorHandlers = useMemo(
    () =>
      Object.fromEntries(
        COLOR_FIELDS.map(([key]) => [
          key,
          {
            change: (hex: string) => {
              pendingRef.current = true;
              const next = { ...paletteRef.current, [key]: hex };
              paletteRef.current = next;
              setPalette(next);
            },
            commit: (hex: string) => {
              pendingRef.current = true;
              const next = { ...paletteRef.current, [key]: hex };
              paletteRef.current = next;
              setPalette(next);
              saveSoon.call();
            },
          },
        ])
      ) as Record<(typeof COLOR_FIELDS)[number][0], { change: (hex: string) => void; commit: (hex: string) => void }>,
    [saveSoon]
  );
  const previewEvent = useMemo(() => ({ ...event, ticket_color_palette: palette }), [event, palette]);
  const colorSwatches = useMemo(() => Object.values(TICKET_TEMPLATE_DEFAULT_PALETTES[templateId] ?? TICKET_TEMPLATE_DEFAULT_PALETTES.dark), [templateId]);

  const handleResetPalette = async () => {
    const defaultPalette = TICKET_TEMPLATE_DEFAULT_PALETTES[templateId] || TICKET_TEMPLATE_DEFAULT_PALETTES.dark;
    pendingRef.current = true;
    paletteRef.current = defaultPalette;
    setPalette(defaultPalette);
    saveSoon.cancel();
    await savePalette(defaultPalette);
    toast({ title: "Palette Reset", description: "Reverted to template defaults." });
  };

  const handleLogoUpload = async (file: File) => {
    if (!event._id) {
      toast({ variant: "destructive", title: "Event ID missing", description: "Please save event first." });
      return;
    }

    const MAX_SIZE = 2 * 1024 * 1024;
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

    if (file.size > MAX_SIZE) {
      toast({ variant: "destructive", title: "File too large", description: "Logo must be smaller than 2MB" });
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ variant: "destructive", title: "Invalid format", description: "Only JPEG, PNG and WebP are allowed" });
      return;
    }

    setUploading(true);
    try {
      const authRes = await fetch('/api/imagekit/upload-auth');
      if (!authRes.ok) throw new Error("Failed to authenticate upload");
      const authData = await authRes.json();

      const fileName = `event-logo-${event._id}-${Date.now()}`;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("publicKey", authData.publicKey);
      formData.append("signature", authData.signature);
      formData.append("expire", authData.expire.toString());
      formData.append("token", authData.token);
      formData.append("fileName", fileName);
      formData.append("folder", "/event-logos");

      const uploadRes = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.message || "ImageKit upload failed");
      }

      const uploadData = await uploadRes.json();
      const logoUrl = uploadData.url;
      const bgRemovedUrl = buildBgRemovedImageKitUrl(logoUrl);

      const saveRes = await fetch(`/api/events/${event._id}/ticket-logo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logo_url: logoUrl,
          logo_file_id: uploadData.fileId,
          remove_background: event.remove_background ?? true,
          bg_removed_logo_url: bgRemovedUrl
        }),
      });

      if (!saveRes.ok) throw new Error("Failed to save logo data");

      toast({ title: "Logo Updated", description: "Logo uploaded successfully." });
      onUpdate();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload Failed", description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const toggleBackgroundRemoval = async (val: boolean) => {
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/events/${event._id}/ticket-logo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remove_background: val }),
      });
      if (!res.ok) throw new Error("Failed to update settings");
      onUpdate();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSavingSettings(false);
    }
  };

  // Saves only the emblem; an uploaded logo is left as it is (it still takes priority on the ticket).
  const chooseEmblem = async (id: string | null) => {
    setSavingEmblem(true);
    try {
      const res = await fetch(`/api/events/${event._id}/ticket-logo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_emblem: id }),
      });
      if (!res.ok) throw new Error("Could not save the emblem");
      onUpdate();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not save", description: err.message });
    } finally {
      setSavingEmblem(false);
    }
  };

  const removeLogo = async () => {
    try {
      await fetch(`/api/events/${event._id}/ticket-logo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_url: null, logo_file_id: null, bg_removed_logo_url: null }),
      });
      onUpdate();
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to remove logo" });
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-8">
        <section className="space-y-6">
          <div>
            <h3 className="font-bold text-white text-lg">Ticket design</h3>
            <p className="text-sm text-muted-foreground">Add your logo, pick a design, then tune the colours. The preview updates as you go.</p>
          </div>

          <div className="space-y-4">
            <Label className="flex items-center gap-2 text-white">
              <span aria-hidden="true" className="grid size-5 place-content-center rounded-full bg-white/10 text-[11px] font-bold">1</span>
              Event logo
            </Label>
            <div role="tablist" aria-label="Logo source" className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
              {([
                { value: "upload", label: "Upload image" },
                { value: "emblem", label: "Emblem" },
              ] as const).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="tab"
                  aria-selected={logoMode === o.value}
                  onClick={() => setLogoMode(o.value)}
                  className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    logoMode === o.value ? "bg-[#36f4a4]/15 text-white ring-1 ring-[#36f4a4]/60" : "text-white/55 hover:text-white"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {logoMode === "upload" ? (
              <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-xl border border-white/10 bg-black/40 flex items-center justify-center overflow-hidden">
                {event.logo_url ? (
                  <img
                    src={event.remove_background ? (event.bg_removed_logo_url || event.logo_url) : event.logo_url}
                    className="h-full w-full object-contain"
                    alt="Logo"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 opacity-20">
                    <Mail className="h-6 w-6" />
                    <span className="text-[8px] uppercase">No Logo</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-full border-white/10 hover:bg-white/5 font-semibold text-white cursor-pointer"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    {event.logo_url ? "Change Logo" : "Upload Logo"}
                  </Button>
                  {event.logo_url && (
                    <Button variant="ghost" size="icon" onClick={removeLogo} className="text-red-500 hover:bg-red-500/10 rounded-full cursor-pointer">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (file) await handleLogoUpload(file);
                  }}
                />
                <p className="text-[10px] text-muted-foreground">Max 2MB. Optimized for preview.</p>
              </div>
            </div>

            {event.logo_url && (
              <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-accent/10">
                <div className="flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-primary" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white">Remove background</p>
                    <p className="text-[10px] text-muted-foreground">Clean logo for templates</p>
                  </div>
                </div>
                <Switch
                  checked={!!event.remove_background}
                  onCheckedChange={toggleBackgroundRemoval}
                  disabled={savingSettings}
                  className="cursor-pointer"
                />
              </div>
            )}
              </div>
            ) : (
              <div className="space-y-3">
                {event.logo_url && (
                  <p role="note" className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                    Your uploaded logo is used on the ticket. Remove it to use an emblem.
                  </p>
                )}
                <EmblemPicker
                  value={event.logo_emblem ?? null}
                  tile={palette.background_color}
                  ink={palette.text_color}
                  busy={savingEmblem}
                  onChange={chooseEmblem}
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <Label className="flex items-center gap-2 text-white">
                <span aria-hidden="true" className="grid size-5 place-content-center rounded-full bg-white/10 text-[11px] font-bold">2</span>
                Choose a design
              </Label>
              <span className="text-[11px] text-white/40">{TICKET_TEMPLATES.length} designs</span>
            </div>
            <TemplatePicker value={templateId} onChange={handleTemplateChange} />
          </div>
        </section>

        <section className="space-y-6 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="grid size-5 place-content-center rounded-full bg-white/10 text-[11px] font-bold text-white">3</span>
              <h3 className="font-bold text-white text-base">Customize colours</h3>
            </div>
            <div className="flex items-center gap-4">
              {isSavingPalette && (
                <div className="flex items-center gap-1.5 text-[10px] text-[#36f4a4] animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetPalette}
                className="text-[11px] h-8 text-muted-foreground hover:text-white rounded-full cursor-pointer"
              >
                <RotateCcw className="h-3 w-3 mr-1.5" />
                Reset Defaults
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 bg-accent/5 p-6 rounded-2xl border border-white/5">
            {COLOR_FIELDS.map(([key, label]) => (
              <TicketColorField
                key={key}
                label={label}
                value={palette[key]}
                swatches={colorSwatches}
                onChange={colorHandlers[key].change}
                onCommit={colorHandlers[key].commit}
              />
            ))}
          </div>
        </section>

        <Card className={designConfirmed ? "border-[#36f4a4]/30 bg-[#36f4a4]/5" : "border-[#36f4a4]/60 bg-[#36f4a4]/5 shadow-[0_0_0_3px_rgba(54,244,164,0.12)]"}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">
                {designConfirmed ? "Design saved" : "Happy with this ticket?"}
              </p>
              <p className="text-xs text-white/60">
                {designConfirmed ? "You can keep adjusting it. Changes save automatically." : "Save it to finish this step before going live."}
              </p>
            </div>
            <Button
              onClick={confirmDesign}
              disabled={confirming}
              className="rounded-full font-bold cursor-pointer bg-[#36f4a4] text-black hover:bg-[#36f4a4]/90 shadow-[0_0_0_3px_rgba(54,244,164,0.18)]"
            >
              {confirming ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : <Check aria-hidden="true" className="mr-2 h-4 w-4" />}
              {designConfirmed ? "Save again" : "Use this design"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-medium text-white/70">Need a custom branded design?</span>
            </div>
            <Button asChild variant="link" size="sm" className="text-blue-400 text-xs p-0 h-auto font-bold cursor-pointer">
              <a href="mailto:support@nochbot.space">Contact Admin</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* The preview is the sticky grid item itself, so it stays in view for the whole height of the form. */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/50">Live ticket preview</h3>
            <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-white/60">
              {TICKET_TEMPLATES.find((t) => t.id === templateId)?.name}
            </span>
          </div>
          <div className="rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_70%)] bg-black/30 p-4 lg:p-5 [&_*]:transition-[background-color,border-color,color] [&_*]:duration-150">
            <div className="mx-auto flex justify-center">
              <TicketPreview
                event={previewEvent}
                templateId={templateId}
              />
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-white/40 [@media(max-height:760px)]:hidden">Shown with a sample attendee. Real tickets use each person's own details.</p>
          {savingSettings && (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-primary animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" />
              Processing background removal...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
