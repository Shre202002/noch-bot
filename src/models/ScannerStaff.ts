import { ObjectId } from 'mongodb';

export interface ScannerStaff {
  _id?: ObjectId;
  org_id: string; // Match UUID
  event_id: ObjectId | null; // null = access to all org events
  name: string;
  email: string;
  access_token: string; // Hashed token
}
