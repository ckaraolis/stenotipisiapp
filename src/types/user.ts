import type { UserRole } from '../config/roles';

export type UserStatus = 'active' | 'inactive';

export interface UserRecord {
  id: string;
  email: string;
  username: string;
  fullName: string;
  roles: UserRole[];
  role: UserRole;
  contactPhone: string;
  mobilePhone: string;
  language: 'en' | 'el';
  autoRefresh: boolean;
  status: UserStatus;
  customerId: string | null;
  customerName: string | null;
}
