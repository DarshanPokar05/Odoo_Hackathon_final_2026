'use strict';

/**
 * Seed script — creates the initial Admin user and baseline config rows.
 *
 * Run with:   node prisma/seed.js
 *   or:       npm run db:seed
 *
 * Safe to run multiple times — uses upsert so it won't duplicate records.
 */

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const bcrypt           = require('bcrypt');

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function main() {
  console.log('[seed] Starting…');

  // ── 1. Admin user ───────────────────────────────────────────────────────────
  const adminEmail    = process.env.SEED_ADMIN_EMAIL    || 'admin@dealflow360.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@1234';
  const adminName     = process.env.SEED_ADMIN_NAME     || 'Super Admin';

  const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);

  const admin = await prisma.user.upsert({
    where:  { email: adminEmail },
    update: {},   // don't overwrite if already exists
    create: {
      name:         adminName,
      email:        adminEmail,
      passwordHash,
      role:         'ADMIN',
      mustChangePassword: false,
    },
  });

  console.log(`[seed] Admin user ready — id: ${admin.id}, email: ${admin.email}`);

  // ── 2. Tier discount ceilings (baseline config) ─────────────────────────────
  const ceilings = [
    { tier: 'BRONZE', maxDiscountPercent: 5  },
    { tier: 'SILVER', maxDiscountPercent: 10 },
    { tier: 'GOLD',   maxDiscountPercent: 20 },
  ];

  for (const c of ceilings) {
    await prisma.tierDiscountCeiling.upsert({
      where:  { tier: c.tier },
      update: { maxDiscountPercent: c.maxDiscountPercent },
      create: c,
    });
  }
  console.log('[seed] TierDiscountCeilings seeded (BRONZE 5%, SILVER 10%, GOLD 20%)');

  // ── 3. Approval chain rules (baseline) ─────────────────────────────────────
  //  Score  0–29  → no approval needed
  //  Score 30–59  → Sales Manager
  //  Score 60+    → Sales Manager then Finance
  const rules = [
    { minScore:  0, maxScore: 29, requiredLevel: 'NONE' },
    { minScore: 30, maxScore: 59, requiredLevel: 'SALES_MANAGER' },
    { minScore: 60, maxScore: null, requiredLevel: 'SALES_MANAGER_THEN_FINANCE' },
  ];

  // Delete existing rules and re-seed (no unique key to upsert on)
  await prisma.approvalChainRule.deleteMany();
  await prisma.approvalChainRule.createMany({ data: rules });
  console.log('[seed] ApprovalChainRules seeded (3 tiers)');

  console.log('[seed] Done ✓');
}

if (require.main === module) {
  main()
    .catch((err) => { console.error('[seed] Error:', err); process.exit(1); })
    .finally(() => prisma.$disconnect());
}

module.exports = { main };
