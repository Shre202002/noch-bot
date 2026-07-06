"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Loader2, Save, Rocket, Plus, Trash2, 
  Settings, FormInput, CreditCard, GripVertical, Pencil,
  CalendarIcon
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

  // Basic Details State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState(0);

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
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to load event" });
    } finally {
      setLoading(false);
    }
  }, [params.id, toast]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, capacity }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      toast({ title: "Success", description: "Event details updated" });
      fetchEvent();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
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
          label: "New Question",
          field_type: "text",
          is_required: true,
          validation_rule: "none",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add field");
      }
      fetchEvent();
      toast({ title: "Field Added" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to add field", description: err.message });
    }
  };

  const deleteField = async (fieldId: string) => {
    try {
      const res = await fetch(`/api/events/${params.id}/form-fields/${fieldId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete field");
      }
      setEvent(prev => prev ? { ...prev, form_fields: prev.form_fields.filter(f => f._id !== fieldId) } : null);
      toast({ title: "Field Deleted" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to delete field", description: err.message });
    }
  };

  const updateField = async (fieldId: string, updates: Partial<FormField>) => {
    try {
      const res = await fetch(`/api/events/${params.id}/form-fields/${fieldId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update field");
      }
      fetchEvent();
      toast({ title: "Field Updated" });
      return true;
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to update field", description: err.message });
      return false;
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setEvent((prev) => {
        if (!prev) return null;
        const oldIndex = prev.form_fields.findIndex((f) => f._id === active.id);
        const newIndex = prev.form_fields.findIndex((f) => f._id === over.id);
        const newFields = arrayMove(prev.form_fields, oldIndex, newIndex);
        
        // Async update reorder API
        const payload = newFields.map((f, i) => ({
          field_id: f._id,
          order_index: i
        }));
        
        fetch(`/api/events/${params.id}/form-fields/reorder`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).catch(() => {
          toast({ variant: "destructive", title: "Failed to sync reorder" });
        });

        return { ...prev, form_fields: newFields };
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
              <h1 className="text-3xl font-black tracking-tight text-white">{event.name}</h1>
              <Badge variant={event.status === "published" ? "default" : "secondary"}>
                {event.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 font-mono">ID: {event._id}</p>
          </div>
        </div>

        {event.status === "draft" && (
          <Button 
            onClick={handlePublish} 
            disabled={publishing}
            className="rounded-full bg-[#36f4a4] text-black hover:bg-[#36f4a4]/90 font-bold px-8 h-10"
          >
            {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
            Publish Event
          </Button>
        )}
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList className="bg-accent/20 border border-white/5 p-1 h-auto rounded-full">
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
              <Button onClick={handleSaveDetails} disabled={saving} className="rounded-full px-8 h-10 font-bold">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white">Attendee Questions</h3>
              <p className="text-xs text-muted-foreground">What details should the chatbot ask each guest?</p>
            </div>
            <Button onClick={addField} size="sm" variant="outline" className="rounded-full border-white/10 hover:bg-white/5 font-semibold">
              <Plus className="mr-2 h-3 w-3" /> Add Field
            </Button>
          </div>

          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-3">
              <SortableContext 
                items={event.form_fields.map(f => f._id)}
                strategy={verticalListSortingStrategy}
              >
                {event.form_fields.map((field) => (
                  <SortableFieldItem 
                    key={field._id} 
                    field={field} 
                    onDelete={deleteField} 
                    onUpdate={updateField}
                  />
                ))}
              </SortableContext>

              {event.form_fields.length === 0 && (
                <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-2xl text-muted-foreground text-sm">
                  No custom questions added yet. The bot will only ask for the number of tickets.
                </div>
              )}
            </div>
          </DndContext>
        </TabsContent>

        <TabsContent value="gateway">
          <Card className="border-border bg-card/30 backdrop-blur-sm">
            <CardContent className="p-12 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">Payment Gateway</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  {!event.is_paid 
                    ? "This is a free event. No payment configuration is required." 
                    : "Connect your Stripe, Razorpay or PayPal account to accept payments."}
                </p>
              </div>
              {event.is_paid && (
                <Button variant="outline" className="rounded-full border-white/10 font-bold hover:bg-white/5">
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

function SortableFieldItem({ field, onDelete, onUpdate }: { 
  field: FormField, 
  onDelete: (id: string) => void,
  onUpdate: (id: string, updates: Partial<FormField>) => Promise<boolean>
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className={`border-white/5 bg-card/30 group ${isDragging ? 'opacity-50' : ''}`}>
      <CardContent className="p-4 flex items-center gap-4">
        <div {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="grid flex-1 gap-1">
          <p className="text-sm font-bold text-white">{field.label}</p>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px] h-4 border-white/10 bg-white/5 text-white/50 uppercase tracking-tighter">
              {field.field_type}
            </Badge>
            <Badge variant="outline" className="text-[9px] h-4 border-[#36f4a4]/20 bg-[#36f4a4]/5 text-[#36f4a4]/70 uppercase tracking-tighter">
              {field.validation_rule.replace('_', ' ')}
            </Badge>
            {field.is_required && (
              <span className="text-[9px] font-black text-red-500/50 uppercase tracking-widest">Required</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <EditFieldDialog field={field} onSave={(updates) => onUpdate(field._id, updates)} />
          <Button 
            onClick={() => onDelete(field._id)}
            size="icon" 
            variant="ghost" 
            className="h-8 w-8 text-muted-foreground hover:text-red-500 rounded-full"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EditFieldDialog({ field, onSave }: { field: FormField, onSave: (updates: Partial<FormField>) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(field.label);
  const [type, setType] = useState(field.field_type);
  const [required, setRequired] = useState(field.is_required);
  const [validationRule, setValidationRule] = useState(field.validation_rule);
  const [customRegex, setCustomRegex] = useState(field.custom_regex || "");

  const handleSave = async () => {
    const success = await onSave({ 
      label, 
      field_type: type, 
      is_required: required,
      validation_rule: validationRule,
      custom_regex: validationRule === 'custom_regex' ? customRegex : null
    });
    if (success) setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-black border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">Edit Question</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="text-white/70">Question Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} className="bg-black/40 border-white/10" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-white/70 text-xs">Input Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="bg-black/40 border-white/10 text-xs h-9">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-black border-white/10 text-white">
                  <SelectItem value="text">Short Text</SelectItem>
                  <SelectItem value="email">Email Address</SelectItem>
                  <SelectItem value="phone">Phone Number</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="boolean">Yes/No Toggle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70 text-xs">Validation Rule</Label>
              <Select value={validationRule} onValueChange={setValidationRule}>
                <SelectTrigger className="bg-black/40 border-white/10 text-xs h-9">
                  <SelectValue placeholder="No Validation" />
                </SelectTrigger>
                <SelectContent className="bg-black border-white/10 text-white">
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="email_format">Email Format</SelectItem>
                  <SelectItem value="phone_format">Phone Format</SelectItem>
                  <SelectItem value="name_format">Name Format</SelectItem>
                  <SelectItem value="custom_regex">Custom Regex</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {validationRule === 'custom_regex' && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
              <Label className="text-white/70">Regex Pattern</Label>
              <Input 
                value={customRegex} 
                onChange={(e) => setCustomRegex(e.target.value)} 
                placeholder="^[0-9A-Z]{5}$"
                className="bg-black/40 border-white/10 font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground leading-snug">The bot will validate user input against this pattern.</p>
            </motion.div>
          )}

          <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5">
            <div className="grid gap-0.5">
              <Label className="text-white font-bold">Required Field</Label>
              <p className="text-[10px] text-muted-foreground">The bot won't skip this question.</p>
            </div>
            <Switch checked={required} onCheckedChange={setRequired} />
          </div>
        </div>
        <DialogFooter>
          <Button 
            className="w-full bg-[#36f4a4] text-black font-black h-11"
            onClick={handleSave}
          >
            Save Field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
