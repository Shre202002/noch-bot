import { ObjectId } from 'mongodb';

export type FieldType = 'text' | 'email' | 'phone' | 'number' | 'select' | 'date' | 'boolean';
export type ValidationRule = 'none' | 'email_format' | 'phone_format' | 'name_format' | 'custom_regex';

export interface EventFormField {
  _id?: ObjectId;
  event_id: ObjectId;
  field_key: string;
  label: string;
  field_type: FieldType;
  options: string[] | null;
  is_required: boolean;
  validation_rule: ValidationRule;
  custom_regex: string | null;
  order_index: number;
  ai_correction_enabled: boolean;
}
