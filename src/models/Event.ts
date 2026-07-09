import { ObjectId } from 'mongodb';

export type EventStatus = 'draft' | 'published' | 'closed' | 'cancelled';

export interface TicketColorPalette {
  background_color: string;
  text_color: string;
  accent_color: string;
  border_color: string;
  muted_text_color: string;
  qr_background_color: string;
}

export interface TicketDesign {
  template_id: string;
  logo_url: string | null;
  logo_file_id?: string | null;
  remove_background: boolean;
  bg_removed_logo_url: string | null;
  color_palette?: TicketColorPalette;
  updated_at: Date;
}

export interface Event {
  _id?: ObjectId;
  org_id: string; // UUID string from auth session
  name: string;
  description: string;
  start_at: Date;
  end_at: Date;
  venue: string | null;
  capacity: number;
  tickets_sold: number;
  tickets_held: number; // BMS-style temporary holds
  status: EventStatus;
  is_paid: boolean;
  price: number | null;
  currency: string;
  allow_group_booking: boolean;
  max_tickets_per_booking: number | null;
  ticket_template_id: string;
  logo_url: string | null;
  logo_file_id?: string | null;
  remove_background?: boolean;
  bg_removed_logo_url?: string | null;
  ticket_design?: TicketDesign; // New structured object
  banner_url: string | null;
  chatbot_widget_id: ObjectId;
  created_at: Date;
  updated_at: Date;
}
