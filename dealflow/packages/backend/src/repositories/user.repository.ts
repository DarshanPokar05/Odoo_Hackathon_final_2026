import { PrismaClient } from "@prisma/client";
import { User, CreateUserInput, UpdateUserInput, PublicUser } from "@auth-module/core";

// ---------------------------------------------------------------------------
// UserRepository — all database interactions for the User model.
// Returns domain types from @auth-module/core, not raw Prisma objects.
// ---------------------------------------------------------------------------

export class UserRepository {
  constructor(private readonly db: PrismaClient) {}

  // ── Mappers ──────────────────────────────────────────────────────────────

  private toUser(row: {
    id: string; name: string; email: string | null; phone: string | null;
    passwordHash: string; isVerified: boolean; status: string;
    createdAt: Date; updatedAt: Date; lastLoginAt: Date | null;
  }): User {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      passwordHash: row.passwordHash,
      isVerified: row.isVerified,
      status: row.status as User["status"],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastLoginAt: row.lastLoginAt,
    };
  }

  toPublicUser(user: User): PublicUser {
    const { passwordHash: _ph, updatedAt: _ua, ...pub } = user;
    void _ph; void _ua;
    return pub;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async findById(id: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { id } });
    return row ? this.toUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { email: email.toLowerCase() } });
    return row ? this.toUser(row) : null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { phone } });
    return row ? this.toUser(row) : null;
  }

  async findByEmailOrPhone(identifier: string): Promise<User | null> {
    const isPhone = identifier.startsWith("+");
    if (isPhone) return this.findByPhone(identifier);
    return this.findByEmail(identifier);
  }

  async emailExists(email: string): Promise<boolean> {
    const count = await this.db.user.count({ where: { email: email.toLowerCase() } });
    return count > 0;
  }

  async phoneExists(phone: string): Promise<boolean> {
    const count = await this.db.user.count({ where: { phone } });
    return count > 0;
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  async create(input: CreateUserInput): Promise<User> {
    const row = await this.db.user.create({
      data: {
        name: input.name,
        email: input.email?.toLowerCase() ?? null,
        phone: input.phone ?? null,
        passwordHash: input.passwordHash,
        isVerified: false,
        status: "ACTIVE",
      },
    });
    return this.toUser(row);
  }

  async update(id: string, input: UpdateUserInput): Promise<User> {
    const row = await this.db.user.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.passwordHash !== undefined && { passwordHash: input.passwordHash }),
        ...(input.isVerified !== undefined && { isVerified: input.isVerified }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.lastLoginAt !== undefined && { lastLoginAt: input.lastLoginAt }),
      },
    });
    return this.toUser(row);
  }

  async markVerified(id: string): Promise<User> {
    return this.update(id, { isVerified: true });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.update(id, { lastLoginAt: new Date() });
  }
}
