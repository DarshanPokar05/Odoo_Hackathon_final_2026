// ---------------------------------------------------------------------------
// User domain types
// These are pure data shapes — no ORM or framework dependencies.
// ---------------------------------------------------------------------------

export type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

export interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  passwordHash: string;
  isVerified: boolean;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

/** Safe user shape — never includes passwordHash */
export interface PublicUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isVerified: boolean;
  status: UserStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface CreateUserInput {
  name: string;
  email?: string;
  phone?: string;
  passwordHash: string;
}

export interface UpdateUserInput {
  name?: string;
  passwordHash?: string;
  isVerified?: boolean;
  status?: UserStatus;
  lastLoginAt?: Date;
}
