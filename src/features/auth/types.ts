export type SessionState =
  | "absent"
  | "authenticating"
  | "active"
  | "renewing"
  | "expired"
  | "revoked"
  | "networkError"
  | "storageError"
  | "notConfigured";

export interface SessionSnapshot {
  state: SessionState;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  provider: string | null;
  expiresAt: number | null;
  verified: boolean;
  error: string | null;
}
