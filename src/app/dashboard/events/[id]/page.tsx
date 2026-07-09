
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Loader2, Save, Rocket, Plus, Trash2, 
  Settings, FormInput, CreditCard, GripVertical, Pencil,
  CalendarIcon, CheckCircle2, AlertCircle, Layout, QrCode,
  ExternalLink, Upload, Mail, Scissors
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
  logo_file_id?: string | null;
  remove_background?: boolean;
  bg_removed_logo_url?: string | null;
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [addingField, setAddingField] = useState(false);
  const [isGatewayConfigured, setIsGatewayConfigured] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState(0);

  // Field editing state
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [editDialogOpen, setEditIdDialogOpen] = useState(false);

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
      { id: 'design', label: 'Ticket design selected', done: !!event.ticket_template_id },
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
    if (addingField) return;
    setAddingField(true);
    const key = `field_${Date.now()}`;
    try {
      const res = await fetch(`/api/events/${params.id}/form-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_key: key,
          label: "Attendee Name",
          field_type: "text",
          is_required: true,
          validation_rule: "none",
        }),
      });
      if (!res.ok) throw new Error("Failed to add field");
      await fetchEvent();
      toast({ title: "Field Added", description: "You can now customize the question." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setAddingField(false);
    }
  };

  const updateField = async (updatedField: FormField) => {
    try {
      const res = await fetch(`/api/events/${params.id}/form-fields/${updatedField._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedField),
      });
      if (!res.ok) throw new Error("Failed to update field");
      toast({ title: "Updated", description: "Field saved successfully" });
      setEditIdDialogOpen(false);
      fetchEvent();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const deleteField = async (fieldId: string) => {
    try {
      const res = await fetch(`/api/events/${params.id}/form-fields/${fieldId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete field");
      toast({ title: "Deleted", description: "Field removed" });
      fetchEvent();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
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
              <Button onClick={handleSaveDetails} disabled={saving} className="rounded-full px-8 h-10 font-bold cursor-pointer bg-white text-black hover:bg-zinc-200">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
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
            <Button 
              onClick={addField} 
              disabled={addingField}
              size="sm" 
              variant="outline" 
              className="rounded-full border-white/10 hover:bg-white/5 font-semibold cursor-pointer text-white"
            >
              {addingField ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Plus className="mr-2 h-3 w-3" />}
              Add Question
            </Button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="space-y-3">
              <SortableContext items={event.form_fields.map(f => f._id)} strategy={verticalListSortingStrategy}>
                {event.form_fields.map((field) => (
                  <SortableFieldItem 
                    key={field._id} 
                    field={field} 
                    onDelete={() => deleteField(field._id)} 
                    onEdit={() => {
                      setEditingField(field);
                      setEditIdDialogOpen(true);
                    }}
                  />
                ))}
              </SortableContext>
            </div>
          </DndContext>
        </TabsContent>

        <TabsContent value="ticket">
          <TicketDesignView event={event} onUpdate={fetchEvent} />
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
                      placeholder="sk_test_..." 
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

                <Button onClick={handleSaveGateway} disabled={saving} className="rounded-full bg-white text-black hover:bg-zinc-200 font-bold h-11 cursor-pointer">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify & Connect Gateway"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Field Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditIdDialogOpen}>
        <DialogContent className="bg-black border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Edit Form Question</DialogTitle>
            <DialogDescription>Modify how the bot asks this question to attendees.</DialogDescription>
          </DialogHeader>
          {editingField && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Question Label</Label>
                <Input 
                  value={editingField.label} 
                  onChange={e => setEditingField({...editingField, label: e.target.value})} 
                  className="bg-black/40 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label>Input Type</Label>
                <Select 
                  value={editingField.field_type} 
                  onValueChange={v => setEditingField({...editingField, field_type: v})}
                >
                  <SelectTrigger className="bg-black/40 border-white/10 text-white cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/10 text-white">
                    <SelectItem value="text">Short Text</SelectItem>
                    <SelectItem value="email">Email Address</SelectItem>
                    <SelectItem value="phone">Phone Number</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Validation Rule</Label>
                <Select 
                  value={editingField.validation_rule} 
                  onValueChange={v => setEditingField({...editingField, validation_rule: v})}
                >
                  <SelectTrigger className="bg-black/40 border-white/10 text-white cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/10 text-white">
                    <SelectItem value="none">No Validation</SelectItem>
                    <SelectItem value="email_format">Email Format</SelectItem>
                    <SelectItem value="phone_format">Phone Format</SelectItem>
                    <SelectItem value="name_format">Name Format (Min 2 chars)</SelectItem>
                    <SelectItem value="custom_regex">Custom Regex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingField.validation_rule === "custom_regex" && (
                <div className="space-y-2">
                  <Label>Regex Pattern</Label>
                  <Input 
                    value={editingField.custom_regex || ""} 
                    onChange={e => setEditingField({...editingField, custom_regex: e.target.value})} 
                    placeholder="^[0-9]+$"
                    className="bg-black/40 border-white/10 text-white"
                  />
                </div>
              )}
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                <Label className="cursor-pointer" htmlFor="req-toggle">Required field</Label>
                <Switch 
                  id="req-toggle"
                  checked={editingField.is_required} 
                  onCheckedChange={v => setEditingField({...editingField, is_required: v})}
                  className="cursor-pointer"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditIdDialogOpen(false)} className="text-white hover:bg-white/5 cursor-pointer">Cancel</Button>
            <Button 
              onClick={() => editingField && updateField(editingField)}
              className="bg-white text-black hover:bg-zinc-200 font-bold cursor-pointer"
            >
              Save Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableFieldItem({ field, onDelete, onEdit }: { field: FormField, onDelete: () => void, onEdit: () => void }) {
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
            <Badge variant="outline" className="text-[9px] h-4 border-white/10 text-primary/70">{field.validation_rule.toUpperCase()}</Badge>
            {field.is_required && <span className="text-[9px] font-black text-red-500/50 uppercase">Required</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" onClick={onEdit} className="text-white hover:bg-white/5 rounded-full cursor-pointer h-8 w-8">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} className="text-red-500 hover:bg-red-500/10 rounded-full cursor-pointer h-8 w-8">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TicketDesignView({ event, onUpdate }: { event: EventData, onUpdate: () => void }) {
  const { toast } = useToast();
  const [templateId, setTemplateId] = useState(event.ticket_template_id || "dark");
  const [uploading, setUploading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
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
      // 1. Get signed auth data
      const authRes = await fetch('/api/imagekit/upload-auth');
      if (!authRes.ok) throw new Error("Failed to authenticate upload");
      const authData = await authRes.json();
      
      // 2. Prepare Form Data
      const fileName = `event-logo-${event._id}-${Date.now()}`;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("publicKey", authData.publicKey);
      formData.append("signature", authData.signature);
      formData.append("expire", authData.expire.toString());
      formData.append("token", authData.token);
      formData.append("fileName", fileName);
      formData.append("folder", "/event-logos");

      // 3. Direct upload to ImageKit
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

      // 4. Save to DB
      const saveRes = await fetch(`/api/events/${event._id}/ticket-logo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logo_url: logoUrl,
          logo_file_id: uploadData.fileId,
          remove_background: event.remove_background ?? true, // default to true
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
          <Label className="text-white">Event Logo</Label>
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
            <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-accent/20">
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

        <div className="space-y-4">
          <Label className="text-white">Template Picker</Label>
          <div className="grid grid-cols-2 gap-3">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => handleTemplateChange(t.id)}
                className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${templateId === t.id ? 'border-[#36f4a4] bg-[#36f4a4]/5' : 'border-white/5 bg-white/2'}`}
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
            <Button asChild variant="link" size="sm" className="text-blue-400 text-xs p-0 h-auto font-bold cursor-pointer">
              <a href="mailto:support@nochbot.space">Contact Admin</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <div className="sticky top-24">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/50 mb-4 text-center">Live Ticket Preview</h3>
          <div className="mx-auto flex justify-center scale-90 sm:scale-100">
             <TicketPreview event={event} templateId={templateId} />
          </div>
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
