/**
 * Ready-made attendee questions an organizer can add with one click, and helpers for the form builder.
 * Only field types and validation rules that every booking surface (website widget and chat bot) handles are used.
 */

export type SuggestedFieldType = 'text' | 'email' | 'phone' | 'number' | 'date';
export type SuggestedRule = 'none' | 'email_format' | 'phone_format' | 'name_format';
export type SuggestionGroup = 'Essentials' | 'About the attendee' | 'Event logistics';

export type FieldSuggestion = {
  /** Stable `field_key`; also how an already-added suggestion is recognised. */
  key: string;
  label: string;
  field_type: SuggestedFieldType;
  validation_rule: SuggestedRule;
  is_required: boolean;
  group: SuggestionGroup;
  /** Shown under the chip to say why it is worth adding. */
  hint?: string;
};

export const SUGGESTION_GROUPS: SuggestionGroup[] = ['Essentials', 'About the attendee', 'Event logistics'];

export const SUGGESTIONS: FieldSuggestion[] = [
  { key: 'full_name', label: 'Full name', field_type: 'text', validation_rule: 'name_format', is_required: true, group: 'Essentials', hint: 'Printed on the ticket' },
  { key: 'email', label: 'Email address', field_type: 'email', validation_rule: 'email_format', is_required: true, group: 'Essentials', hint: 'Tickets are emailed here' },
  { key: 'phone', label: 'Phone number', field_type: 'phone', validation_rule: 'phone_format', is_required: true, group: 'Essentials', hint: 'For event updates' },

  { key: 'age', label: 'Age', field_type: 'number', validation_rule: 'none', is_required: false, group: 'About the attendee' },
  { key: 'date_of_birth', label: 'Date of birth', field_type: 'date', validation_rule: 'none', is_required: false, group: 'About the attendee' },
  { key: 'organization', label: 'Company / organization', field_type: 'text', validation_rule: 'none', is_required: false, group: 'About the attendee' },
  { key: 'job_title', label: 'Job title', field_type: 'text', validation_rule: 'none', is_required: false, group: 'About the attendee' },
  { key: 'city', label: 'City', field_type: 'text', validation_rule: 'none', is_required: false, group: 'About the attendee' },
  { key: 'college', label: 'College / university', field_type: 'text', validation_rule: 'none', is_required: false, group: 'About the attendee' },

  { key: 'emergency_contact', label: 'Emergency contact number', field_type: 'phone', validation_rule: 'phone_format', is_required: false, group: 'Event logistics' },
  { key: 'dietary_requirements', label: 'Dietary requirements', field_type: 'text', validation_rule: 'none', is_required: false, group: 'Event logistics' },
  { key: 'tshirt_size', label: 'T-shirt size', field_type: 'text', validation_rule: 'none', is_required: false, group: 'Event logistics' },
  { key: 'heard_about', label: 'How did you hear about us?', field_type: 'text', validation_rule: 'none', is_required: false, group: 'Event logistics' },
];

/** The three questions nearly every event needs. */
export const ESSENTIAL_KEYS = ['full_name', 'email', 'phone'] as const;

type ExistingField = { field_key: string; label: string };

/** A suggestion counts as added when a field has its key or the same label (ignoring case and spacing). */
export function isAdded(suggestion: FieldSuggestion, fields: ExistingField[]): boolean {
  const label = suggestion.label.trim().toLowerCase();
  return fields.some((f) => f.field_key === suggestion.key || f.label.trim().toLowerCase() === label);
}

/** A `field_key` for a custom question, made from its label and made unique among the event's keys. */
export function fieldKeyFor(label: string, existingKeys: string[] = []): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'question';
  if (!existingKeys.includes(base)) return base;
  let n = 2;
  while (existingKeys.includes(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

export const TYPE_LABELS: Record<string, string> = {
  text: 'Short text',
  email: 'Email',
  phone: 'Phone',
  number: 'Number',
  date: 'Date',
};

export const RULE_LABELS: Record<string, string> = {
  none: 'No validation',
  email_format: 'Must be a valid email',
  phone_format: 'Phone number format',
  name_format: 'At least 2 characters',
  custom_regex: 'Custom pattern',
};

/** Why a custom question cannot be saved yet, or null when it can. */
export function questionProblem(q: { label: string; validation_rule: string; custom_regex?: string | null }): string | null {
  if (!q.label.trim()) return 'Write the question first.';
  if (q.validation_rule === 'custom_regex') {
    if (!q.custom_regex?.trim()) return 'Enter a pattern for the custom rule.';
    try {
      new RegExp(q.custom_regex);
    } catch {
      return 'That pattern is not a valid regular expression.';
    }
  }
  return null;
}
