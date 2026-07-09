
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Loader2, Save, Rocket, Plus, Trash2, 
  Settings, FormInput, CreditCard, GripVertical, Pencil,
  CalendarIcon, CheckCircle2, AlertCircle, Layout, QrCode,
  ExternalLink, Upload, Mail
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
import { TicketPreview } from "@/components/TicketPreview";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface FormField {
  _id: string;
  field_key: string;
  label: string;
  field_type: string;
  is_required: boolean;
  validation_rule: string;
  custom_regex: string | null;
}

interface EventData {
  _id: string;
  name: string;
  status: string;
  description: string;
  start_at: string;
  end_at: string;
  venue: string | null;
  capacity: number;
  is_paid: boolean;
  price: number | null;
  currency: string;
  ticket_template_id: string;
  logo_url: string | null;
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
  const [isGatewayConfigured, setIsGatewayConfigured] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState(0);

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
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to load event" });
    } finally {
      setLoading(false);
    }
  }, [params.id, toast]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const readiness = useMemo(() => {
    if (!event) return { complete: false, steps: [] };
    const steps = [
      { id: 'details', label: 'Basic details complete', done: !!name && !!description && capacity > 0 },
      { id: 'fields', label: 'At least one form field added', done: event.form_fields.length > 0 },
    ];
    if (event.is_paid) {
      steps.push({ id: 'gateway', label: 'Payment gateway connected', done: isGatewayConfigured });
    }
    return {
      complete: steps.every(s => s.done),
      steps
    };
  }, [event, name, description, capacity, isGatewayConfigured]);

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
      if (!res.ok) throw new Error("Failed to save gateway");
      toast({ title: "Gateway Connected", description: "Your credentials have been encrypted and saved." });
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
        const err = await res.json();
        throw new Error(err.error || "Failed to publish");
      }
      toast({ title: "Success", description: "Event is now live!" });
      fetchEvent();
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
          label: "Full Name",
          field_type: "text",
          is_required: true,
          validation_rule: "none",
        }),
      });
      if (!res.ok) throw new Error("Failed to add field");
      fetchEvent();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleLogoUpload = async (file: File) => {
    // PROTECTION: Validate size (2MB) and type
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

    try {
      const authRes = await fetch('/api/images/auth');
      const authData = await authRes.json();
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("publicKey", process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY!);
      formData.append("signature", authData.signature);
      formData.append("expire", authData.expire);
      formData.append("token", authData.token);
      formData.append("fileName", `event-logo-${params.id}`);
      formData.append("folder", "/event-logos");

      const uploadRes = await fetch(process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT + "/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      
      if (!uploadRes.ok) throw new Error(uploadData.message || "ImageKit upload failed");

      await fetch(`/api/events/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_url: uploadData.url }),
      });
      
      toast({ title: "Logo Uploaded" });
      fetchEvent();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload Failed", description: err.message });
    }
  };

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setEvent((prev) => {
        if (!prev) return null;
        const oldIndex = prev.form_fields.findIndex((f) => f._id === active.id);
        const newIndex = prev.form_fields.findIndex((f) => f._id === over.id);
        const newFields = arrayMove(prev.form_fields, oldIndex, newIndex);
        
        fetch(`/api/events/${params.id}/form-fields/reorder`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newFields.map((f, i) => ({ field_id: f._id, order_index: i })))
        }).catch(() => toast({ variant: "destructive", title: "Sync failed" }));

        return { ...prev, form_fields: newFields };
      });
    }
  };

  if (loading || !event) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
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

        <div className="flex flex-col gap-4 min-w-[280px]">
          <Card className="border-border bg-card/40 backdrop-blur-sm">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/50">Readiness</h3>
              <div className="space-y-3">
                {readiness.steps.map(step => (
                  <div key={step.id} className="flex items-center gap-2 text-sm">
                    {step.done ? <CheckCircle2 className="h-4 w-4 text-[#36f4a4]" /> : <AlertCircle className="h-4 w-4 text-orange-400" />}
                    <span className={step.done ? "text-white" : "text-white/60"}>{step.label}</span>
                  </div>
                ))}
              </div>
              {event.status === "draft" && (
                <Button 
                  onClick={handlePublish} 
                  disabled={!readiness.complete || publishing}
                  className="w-full rounded-full bg-[#36f4a4] text-black hover:bg-[#36f4a4]/90 font-black h-11 cursor-pointer"
                >
                  {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                  Publish Live
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList className="bg-accent/20 border border-white/5 p-1 h-auto rounded-full">
          <TabsTrigger value="details" className="rounded-full px-6 py-2 cursor-pointer"><Settings className="mr-2 h-4 w-4" /> Details</TabsTrigger>
          <TabsTrigger value="fields" className="rounded-full px-6 py-2 cursor-pointer"><FormInput className="mr-2 h-4 w-4" /> Attendee Form</TabsTrigger>
          <TabsTrigger value="ticket" className="rounded-full px-6 py-2 cursor-pointer"><Layout className="mr-2 h-4 w-4" /> Ticket Design</TabsTrigger>
          <TabsTrigger value="gateway" className="rounded-full px-6 py-2 cursor-pointer"><CreditCard className="mr-2 h-4 w-4" /> Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card className="border-border bg-card/30 backdrop-blur-sm">
            <CardContent className="p-6 space-y-6">
              <div className="grid gap-2">
                <Label className="text-white/70">Event Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-black/40 border-white/10" />
              </div>
              <div className="grid gap-2">
                <Label className="text-white/70">Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-black/40 border-white/10 min-h-[100px]" />
              </div>
              <div className="grid gap-2">
                <Label className="text-white/70">Capacity</Label>
                <Input type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="bg-black/40 border-white/10" />
              </div>
              <Button onClick={handleSaveDetails} disabled={saving} className="rounded-full px-8 h-10 font-bold cursor-pointer">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Details
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-lg">Form Builder</h3>
              <p className="text-sm text-muted-foreground">Define what information the bot collects from attendees.</p>
            </div>
            <Button onClick={addField} size="sm" variant="outline" className="rounded-full border-white/10 hover:bg-white/5 font-semibold cursor-pointer">
              <Plus className="mr-2 h-3 w-3" /> Add Question
            </Button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="space-y-3">
              <SortableContext items={event.form_fields.map(f => f._id)} strategy={verticalListSortingStrategy}>
                {event.form_fields.map((field) => (
                  <SortableFieldItem key={field._id} field={field} onDelete={() => fetchEvent()} onUpdate={() => fetchEvent()} />
                ))}
              </SortableContext>
            </div>
          </DndContext>
        </TabsContent>

        <TabsContent value="ticket">
          <TicketDesignView event={event} onUpdate={fetchEvent} onUploadLogo={handleLogoUpload} />
        </TabsContent>

        <TabsContent value="gateway">
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
                  <Label>Provider</Label>
                  <Select value={gatewayProvider} onValueChange={setGatewayProvider}>
                    <SelectTrigger className="bg-black/40 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-black border-white/10 text-white">
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="razorpay">Razorpay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{gatewayProvider === 'stripe' ? 'Secret Key' : 'Key ID'}</Label>
                    <Input 
                      type="password"
                      placeholder="sk_test_..." 
                      value={gatewayKeys.key_id} 
                      onChange={e => setGatewayKeys(p => ({ ...p, key_id: e.target.value }))}
                      className="bg-black/40 border-white/10" 
                    />
                  </div>
                  {gatewayProvider === 'razorpay' && (
                    <div className="space-y-2">
                      <Label>Key Secret</Label>
                      <Input 
                        type="password"
                        placeholder="••••••••" 
                        value={gatewayKeys.key_secret} 
                        onChange={e => setGatewayKeys(p => ({ ...p, key_secret: e.target.value }))}
                        className="bg-black/40 border-white/10" 
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Webhook Secret (Recommended)</Label>
                  <Input 
                    type="password"
                    placeholder="whsec_..." 
                    value={gatewayKeys.webhook_secret} 
                    onChange={e => setGatewayKeys(p => ({ ...p, webhook_secret: e.target.value }))}
                    className="bg-black/40 border-white/10" 
                  />
                  <p className="text-[10px] text-muted-foreground italic">Use this to verify payment events securely.</p>
                </div>

                <Button onClick={handleSaveGateway} disabled={saving} className="rounded-full bg-white text-black hover:bg-zinc-200 font-bold h-11">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify & Connect Gateway"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SortableFieldItem({ field, onDelete, onUpdate }: { field: FormField, onDelete: () => void, onUpdate: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field._id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 1 };

  return (
    <Card ref={setNodeRef} style={style} className={`border-white/5 bg-card/30 group ${isDragging ? 'opacity-50' : ''}`}>
      <CardContent className="p-4 flex items-center gap-4">
        <div {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground"><GripVertical className="h-4 w-4" /></div>
        <div className="grid flex-1 gap-1">
          <p className="text-sm font-bold text-white">{field.label}</p>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px] h-4 border-white/10 text-white/50">{field.field_type.toUpperCase()}</Badge>
            {field.is_required && <span className="text-[9px] font-black text-red-500/50 uppercase">Required</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TicketDesignView({ event, onUpdate, onUploadLogo }: { event: EventData, onUpdate: () => void, onUploadLogo: (f: File) => Promise<void> }) {
  const [templateId, setTemplateId] = useState(event.ticket_template_id || "dark");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTemplateChange = async (id: string) => {
    setTemplateId(id);
    await fetch(`/api/events/${event._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket_template_id: id }),
    });
    onUpdate();
  };

  const templates = [
    { id: "modern", name: "Bold Graphic", color: "bg-blue-600" },
    { id: "minimal", name: "Boarding Pass", color: "bg-emerald-500" },
    { id: "dark", name: "Premium Dark", color: "bg-zinc-900 border border-[#d4af37]" },
    { id: "classic", name: "Vintage Raffle", color: "bg-[#fcf9f2] text-black" }
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <div>
          <h3 className="font-bold text-white text-lg">Ticket Visuals</h3>
          <p className="text-sm text-muted-foreground">Pick a template and brand it with your logo.</p>
        </div>

        <div className="space-y-4">
          <Label>Event Logo</Label>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl border border-white/10 bg-black/40 flex items-center justify-center overflow-hidden">
              {event.logo_url ? <img src={event.logo_url} className="h-full w-full object-cover" alt="Logo" /> : <Plus className="h-6 w-6 text-white/20" />}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border-white/10 hover:bg-white/5 font-semibold"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {event.logo_url ? "Change Logo" : "Upload Logo"}
            </Button>
            <input 
              ref={fileInputRef} 
              type="file" 
              className="hidden" 
              accept="image/png,image/jpeg,image/webp"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (file) {
                  setUploading(true);
                  await onUploadLogo(file);
                  setUploading(false);
                }
              }} 
            />
          </div>
          <p className="text-[10px] text-muted-foreground">PNG, JPEG or WebP. Max 2MB.</p>
        </div>

        <div className="space-y-4">
          <Label>Template Picker</Label>
          <div className="grid grid-cols-2 gap-3">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => handleTemplateChange(t.id)}
                className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${templateId === t.id ? 'border-[#36f4a4] bg-[#36f4a4]/5' : 'border-white/5 bg-white/2'}`}
              >
                <div className={`h-12 w-full rounded-lg ${t.color}`} />
                <span className="text-sm font-bold text-white">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        <Card className="border-border bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-medium text-white/70">Need a custom branded design?</span>
            </div>
            <Button asChild variant="link" size="sm" className="text-blue-400 text-xs p-0 h-auto font-bold">
              <a href="mailto:support@nochbot.space">Contact Admin</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <div className="sticky top-24">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/50 mb-4 text-center">Live Ticket Preview</h3>
          <div className="mx-auto flex justify-center">
             <TicketPreview event={event} templateId={templateId} />
          </div>
        </div>
      </div>
    </div>
  );
}
