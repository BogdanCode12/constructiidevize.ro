import "server-only";
import { queryOne } from "./db";
import { hashToken } from "./auth/tokens";

export type Invitation = { id: number; company_id: number; company_name: string; email: string; role: "admin" | "member" };

export async function findInvitation(token: string): Promise<Invitation | null> {
  if (!token) return null;
  return queryOne<Invitation>(
    `SELECT i.id, i.company_id, c.name AS company_name, i.email, i.role
       FROM invitations i JOIN companies c ON c.id = i.company_id
      WHERE i.token_hash = ? AND i.accepted_at IS NULL AND i.expires_at > NOW()`,
    [hashToken(token)],
  );
}

