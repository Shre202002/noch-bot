"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  Calendar,
  Check,
  GripVertical,
  Hash,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ESSENTIAL_KEYS,
  fieldKeyFor,
  isAdded,
  questionProblem,
  RULE_LABELS,
  SUGGESTION_GROUPS,
  SUGGESTIONS,
  TYPE_LABELS,
  type FieldSuggestion,
} from "@/lib/formFieldSuggestions";

export interface FormField {
  _id: string;
  field_key: string;
  label: string;
  field_type: string;
  is_required: boolean;
  validation_rule: string;
  custom_regex: string | null;
}

type Draft = {
  label: string;
  field_type: string;
  validation_rule: string;
  custom_regex: string;
  is_required: boolean;
};

const EMPTY_DRAFT: Draft = { label: "", field_type: "text", validation_rule: "none", custom_regex: "", is_required: true };

const GREEN = "bg-[#36f4a4] text-black hover:bg-[#36f4a4]/90 shadow-[0_0_0_3px_rgba(54,244,164,0.18)]";

const TYPE_ICONS: Record<string, typeof Type> = { text: Type, email: Mail, phone: Phone, number: Hash, date: Calendar };

export function FormBuilder({
  eventId,
  fields,
  onFieldsChange,
  onChanged,
}: {
  eventId: string;
  fields: FormField[];
  /** Optimistic local update, used while dragging to reorder. */
  onFieldsChange: (fields: FormField[]) => void;
  /** Re-read the event after the server changed a field. */
  onChanged: () => Promise<unknown> | void;
}) {
  const { toast } = useToast();
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const [dialogOpen, setDialogOpen] = useState(false);
  /** The question being edited; null while writing a new one (nothing exists on the server yet). */
  const [editing, setEditing] = useState<FormField | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [addingKeys, setAddingKeys] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const keys = fields.map((f) => f.field_key);
  const hasEmail = fields.some((f) => f.field_type === "email" || f.validation_rule === "email_format");
  const problem = questionProblem(draft);

  const openNew = () => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setDialogError("");
    setDialogOpen(true);
  };

  const openEdit = (field: FormField) => {
    setEditing(field);
    setDraft({
      label: field.label,
      field_type: field.field_type,
      validation_rule: field.validation_rule,
      custom_regex: field.custom_regex ?? "",
      is_required: field.is_required,
    });
    setDialogError("");
    setDialogOpen(true);
  };

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/events/${eventId}/form-fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not add the question.");
  };

  // Nothing is created until this runs: opening and cancelling the dialog never touches the server.
  const save = async () => {
    if (saving || problem) return;
    setSaving(true);
    setDialogError("");
    const body = {
      label: draft.label.trim(),
      field_type: draft.field_type,
      validation_rule: draft.validation_rule,
      custom_regex: draft.validation_rule === "custom_regex" ? draft.custom_regex.trim() : null,
      is_required: draft.is_required,
    };
    try {
      if (editing) {
        const res = await fetch(`/api/events/${eventId}/form-fields/${editing._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not save the question.");
        toast({ title: "Question saved" });
      } else {
        await post({ ...body, field_key: fieldKeyFor(body.label, keys) });
        toast({ title: "Question added" });
      }
      setDialogOpen(false);
      await onChanged();
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const addSuggestion = async (s: FieldSuggestion) => {
    if (addingKeys.includes(s.key) || isAdded(s, fields)) return;
    setAddingKeys((prev) => [...prev, s.key]);
    setDialogError("");
    try {
      await post({
        field_key: s.key,
        label: s.label,
        field_type: s.field_type,
        validation_rule: s.validation_rule,
        is_required: s.is_required,
      });
      await onChanged();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not add the question.";
      setDialogError(message);
      toast({ variant: "destructive", title: "Could not add that question", description: message });
    } finally {
      setAddingKeys((prev) => prev.filter((k) => k !== s.key));
    }
  };

  // One after another, so the questions keep their order.
  const addEssentials = async () => {
    for (const key of ESSENTIAL_KEYS) {
      const s = SUGGESTIONS.find((x) => x.key === key);
      if (s && !isAdded(s, fields)) await addSuggestion(s);
    }
  };

  const remove = async (field: FormField) => {
    if (deletingId) return;
    setDeletingId(field._id);
    try {
      const res = await fetch(`/api/events/${eventId}/form-fields/${field._id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete the question.");
      toast({ title: "Question removed" });
      await onChanged();
    } catch (err) {
      toast({ variant: "destructive", title: "Could not delete", description: err instanceof Error ? err.message : undefined });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = fields.findIndex((f) => f._id === active.id);
    const to = fields.findIndex((f) => f._id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(fields, from, to);
    onFieldsChange(next);
    fetch(`/api/events/${eventId}/form-fields/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next.map((f, i) => ({ field_id: f._id, order_index: i }))),
    })
      .then((res) => {
        if (!res.ok) throw new Error("reorder failed");
      })
      .catch(() => {
        toast({ variant: "destructive", title: "Could not save the new order" });
        onChanged();
      });
  };

  const renderChips = () => (
    <div className="space-y-4">
      {SUGGESTION_GROUPS.map((group) => (
        <div key={group} className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{group}</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.filter((s) => s.group === group).map((s) => {
              const added = isAdded(s, fields);
              const pending = addingKeys.includes(s.key);
              const Icon = TYPE_ICONS[s.field_type] ?? Type;
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={added || pending}
                  onClick={() => addSuggestion(s)}
                  aria-label={added ? `${s.label}, already added` : `Add question: ${s.label}`}
                  title={s.hint}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    added
                      ? "cursor-default border-[#36f4a4]/30 bg-[#36f4a4]/10 text-[#36f4a4]"
                      : "cursor-pointer border-white/15 text-white/80 hover:border-[#36f4a4]/60 hover:bg-[#36f4a4]/5 hover:text-white"
                  }`}
                >
                  {pending ? (
                    <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                  ) : added ? (
                    <Check aria-hidden="true" className="h-3.5 w-3.5" />
                  ) : (
                    <Icon aria-hidden="true" className="h-3.5 w-3.5 text-white/40" />
                  )}
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-white">Attendee form</h2>
          <p className="text-sm text-muted-foreground">
            What the chat bot and website widget ask each attendee.{" "}
            <span className="text-white/60">
              {fields.length} {fields.length === 1 ? "question" : "questions"}
            </span>
          </p>
        </div>
        <Button onClick={openNew} size="sm" className={`rounded-full font-bold cursor-pointer ${GREEN}`}>
          <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
          Add Question
        </Button>
      </div>

      {fields.length > 0 && !hasEmail && (
        <p role="note" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          Add an Email question so tickets can be emailed to attendees.
        </p>
      )}

      {fields.length === 0 ? (
        <Card className="border-dashed border-white/15 bg-card/20">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-content-center rounded-xl bg-[#36f4a4]/10 text-[#36f4a4]">
                  <Sparkles aria-hidden="true" className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-bold text-white">No questions yet</h3>
                  <p className="text-sm text-muted-foreground">Start with the essentials, or pick from the suggestions. One click adds each.</p>
                </div>
              </div>
              <Button onClick={addEssentials} disabled={addingKeys.length > 0} className={`rounded-full font-bold cursor-pointer ${GREEN}`}>
                {addingKeys.length > 0 ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles aria-hidden="true" className="mr-2 h-4 w-4" />}
                Add the essentials
              </Button>
            </div>
            {renderChips()}
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={fields.map((f) => f._id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-3">
              {fields.map((field, index) => (
                <QuestionRow
                  key={field._id}
                  index={index}
                  field={field}
                  deleting={deletingId === field._id}
                  onEdit={() => openEdit(field)}
                  onDelete={() => remove(field)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-black border-white/10 text-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit question" : "Add a question"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Change how the bot asks this question."
                : "Pick a ready-made question, or write your own. Nothing is added until you press Add question."}
            </DialogDescription>
          </DialogHeader>

          {!editing && (
            <section aria-label="Suggested questions" className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles aria-hidden="true" className="h-4 w-4 text-[#36f4a4]" /> Suggested questions
                <span className="text-xs font-normal text-white/40">Click to add instantly</span>
              </div>
              {renderChips()}
              <div className="flex items-center gap-3 pt-1 text-xs uppercase tracking-widest text-white/30">
                <span className="h-px flex-1 bg-white/10" /> or write your own <span className="h-px flex-1 bg-white/10" />
              </div>
            </section>
          )}

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="question-label">Question</Label>
              <Input
                id="question-label"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="e.g. What is your favourite session topic?"
                className="bg-black/40 border-white/10 text-white"
                autoFocus={!!editing}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Answer type</Label>
                <Select
                  value={draft.field_type}
                  onValueChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      field_type: v,
                      // Keep the check that matches the type; clear one that no longer fits.
                      validation_rule:
                        v === "email" ? "email_format"
                        : v === "phone" ? "phone_format"
                        : (d.validation_rule === "email_format" || d.validation_rule === "phone_format") ? "none"
                        : d.validation_rule,
                    }))
                  }
                >
                  <SelectTrigger className="bg-black/40 border-white/10 text-white cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/10 text-white">
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Check the answer</Label>
                <Select value={draft.validation_rule} onValueChange={(v) => setDraft({ ...draft, validation_rule: v })}>
                  <SelectTrigger className="bg-black/40 border-white/10 text-white cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/10 text-white">
                    {Object.entries(RULE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {draft.validation_rule === "custom_regex" && (
              <div className="space-y-2">
                <Label htmlFor="question-regex">Pattern</Label>
                <Input
                  id="question-regex"
                  value={draft.custom_regex}
                  onChange={(e) => setDraft({ ...draft, custom_regex: e.target.value })}
                  placeholder="^[0-9]+$"
                  className="bg-black/40 border-white/10 font-mono text-white"
                />
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3">
              <Label htmlFor="question-required" className="cursor-pointer">Required</Label>
              <Switch
                id="question-required"
                checked={draft.is_required}
                onCheckedChange={(v: boolean) => setDraft({ ...draft, is_required: v })}
                className="cursor-pointer"
              />
            </div>

            {(dialogError || (draft.label !== "" && problem)) && (
              <p role="alert" className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
                {dialogError || problem}
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving} className="text-white hover:bg-white/5 cursor-pointer">
                {editing ? "Cancel" : "Close"}
              </Button>
              <Button type="submit" disabled={saving || !!problem} className={`font-bold cursor-pointer ${GREEN}`}>
                {saving && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Save field" : "Add question"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuestionRow({
  index,
  field,
  deleting,
  onEdit,
  onDelete,
}: {
  index: number;
  field: FormField;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field._id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 1 };
  const Icon = TYPE_ICONS[field.field_type] ?? Type;
  const rule = field.validation_rule !== "none" ? RULE_LABELS[field.validation_rule] ?? field.validation_rule : null;

  return (
    <li ref={setNodeRef} style={style} className={isDragging ? "opacity-60" : undefined}>
      <Card className="border-white/10 bg-card/40 transition-colors hover:border-white/20">
        <CardContent className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Reorder question ${index + 1}: ${field.label}`}
            className="grid size-9 shrink-0 cursor-grab touch-none place-content-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white"
          >
            <GripVertical aria-hidden="true" className="h-4 w-4" />
          </button>
          <span aria-hidden="true" className="grid size-7 shrink-0 place-content-center rounded-full bg-white/5 text-xs font-bold text-white/60">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="truncate text-sm font-bold text-white sm:text-base">{field.label}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1 border-white/10 text-[11px] font-medium text-white/60">
                <Icon aria-hidden="true" className="h-3 w-3" /> {TYPE_LABELS[field.field_type] ?? field.field_type}
              </Badge>
              {rule && <span className="text-xs text-white/50">{rule}</span>}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  field.is_required ? "bg-[#36f4a4]/10 text-[#36f4a4]" : "bg-white/5 text-white/40"
                }`}
              >
                {field.is_required ? "Required" : "Optional"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit question: ${field.label}`} className="size-9 cursor-pointer rounded-full text-white hover:bg-white/10">
              <Pencil aria-hidden="true" className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={deleting}
              aria-label={`Delete question: ${field.label}`}
              className="size-9 cursor-pointer rounded-full text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              {deleting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Trash2 aria-hidden="true" className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
