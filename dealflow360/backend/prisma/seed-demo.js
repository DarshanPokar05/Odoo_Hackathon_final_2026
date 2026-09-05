'use strict';

/**
 * Demo Data Seed
 * ──────────────
 * Populates realistic demo data for all modules.
 * Safe to run multiple times — clears demo data then re-inserts.
 *
 * Run with:  node prisma/seed-demo.js
 *
 * Demo accounts created:
 *   admin@dealflow360.com    / Admin@1234        (ADMIN)
 *   manager@dealflow360.com  / Manager@1234      (SALES_MANAGER)
 *   finance@dealflow360.com  / Finance@1234      (FINANCE)
 *   rep1@dealflow360.com     / Rep@1234          (SALES_REP)
 *   rep2@dealflow360.com     / Rep@1234          (SALES_REP)
 *   acmecorp@dealflow360.com / AcmeCorp@deal123  (CUSTOMER — mustChangePassword)
 *   globex@dealflow360.com   / Globex@deal123    (CUSTOMER — mustChangePassword)
 */

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const bcrypt           = require('bcrypt');

const prisma     = new PrismaClient();
const SALT       = 10;
const hash       = (p) => bcrypt.hash(p, SALT);

// ─── helpers ─────────────────────────────────────────────────────────────────
function d(offsetDays) {
  const dt = new Date();
  dt.setDate(dt.getDate() + offsetDays);
  return dt;
}

async function main() {
  console.log('[demo-seed] Starting…\n');

  // ── 0. Baseline config (ceilings + approval rules) ───────────────────────
  console.log('[demo-seed] Ensuring baseline config…');

  // Admin user
  await prisma.user.upsert({
    where:  { email: 'admin@dealflow360.com' },
    update: {},
    create: {
      name: 'Super Admin', email: 'admin@dealflow360.com',
      passwordHash: await hash('Admin@1234'), role: 'ADMIN', mustChangePassword: false,
    },
  });
  const ceilings = [
    { tier: 'BRONZE', maxDiscountPercent: 5  },
    { tier: 'SILVER', maxDiscountPercent: 10 },
    { tier: 'GOLD',   maxDiscountPercent: 20 },
  ];
  for (const c of ceilings) {
    await prisma.tierDiscountCeiling.upsert({ where: { tier: c.tier }, update: {}, create: c });
  }
  await prisma.approvalChainRule.deleteMany();
  await prisma.approvalChainRule.createMany({ data: [
    { minScore:  0, maxScore: 29,   requiredLevel: 'NONE' },
    { minScore: 30, maxScore: 59,   requiredLevel: 'SALES_MANAGER' },
    { minScore: 60, maxScore: null, requiredLevel: 'SALES_MANAGER_THEN_FINANCE' },
  ]});
  console.log('  ✓ Tier ceilings + approval rules');

  // ── 1. Users ───────────────────────────────────────────────────────────────
  console.log('[demo-seed] Creating internal users…');

  const [manager, finance, rep1, rep2] = await Promise.all([
    prisma.user.upsert({
      where:  { email: 'manager@dealflow360.com' },
      update: {},
      create: { name: 'Sarah Manager', email: 'manager@dealflow360.com',
                passwordHash: await hash('Manager@1234'), role: 'SALES_MANAGER' },
    }),
    prisma.user.upsert({
      where:  { email: 'finance@dealflow360.com' },
      update: {},
      create: { name: 'Frank Finance', email: 'finance@dealflow360.com',
                passwordHash: await hash('Finance@1234'), role: 'FINANCE' },
    }),
    prisma.user.upsert({
      where:  { email: 'rep1@dealflow360.com' },
      update: {},
      create: { name: 'Alice Sales', email: 'rep1@dealflow360.com',
                passwordHash: await hash('Rep@1234'), role: 'SALES_REP' },
    }),
    prisma.user.upsert({
      where:  { email: 'rep2@dealflow360.com' },
      update: {},
      create: { name: 'Bob Sales', email: 'rep2@dealflow360.com',
                passwordHash: await hash('Rep@1234'), role: 'SALES_REP' },
    }),
  ]);
  console.log('  ✓ manager, finance, rep1, rep2');

  // ── 2. Product Categories ──────────────────────────────────────────────────
  console.log('[demo-seed] Creating product categories…');

  const [catHardware, catSoftware, catService, catCloud] = await Promise.all([
    prisma.productCategory.upsert({
      where:  { name: 'Hardware' },
      update: { maxDiscountPercent: 15 },
      create: { name: 'Hardware', maxDiscountPercent: 15 },
    }),
    prisma.productCategory.upsert({
      where:  { name: 'Software' },
      update: { maxDiscountPercent: 25 },
      create: { name: 'Software', maxDiscountPercent: 25 },
    }),
    prisma.productCategory.upsert({
      where:  { name: 'Professional Services' },
      update: { maxDiscountPercent: 10 },
      create: { name: 'Professional Services', maxDiscountPercent: 10 },
    }),
    prisma.productCategory.upsert({
      where:  { name: 'Cloud & SaaS' },
      update: { maxDiscountPercent: 20 },
      create: { name: 'Cloud & SaaS', maxDiscountPercent: 20 },
    }),
  ]);
  console.log('  ✓ Hardware (15%), Software (25%), Professional Services (10%), Cloud & SaaS (20%)');

  // ── 3. Products ────────────────────────────────────────────────────────────
  console.log('[demo-seed] Creating products…');

  // Helper: upsert product by name (no unique constraint so we delete+create)
  async function upsertProduct(data) {
    const { variants, ...rest } = data;
    const existing = await prisma.product.findFirst({ where: { name: rest.name } });
    if (existing) {
      await prisma.productVariant.deleteMany({ where: { productId: existing.id } });
      await prisma.product.delete({ where: { id: existing.id } });
    }
    return prisma.product.create({
      data: { ...rest, variants: { create: variants ?? [] } },
    });
  }

  const [laptop, workstation, serverRack, dfxErp, dealflow360Crm, supportSetup,
         cloudBackup, managedHosting] = await Promise.all([

    upsertProduct({
      name: 'ProBook Laptop 15"', categoryId: catHardware.id,
      price: 1299.00, unit: 'each', taxPercent: 8, isSubscription: false,
      description: 'Business-grade 15" laptop with Intel Core i7, 16 GB RAM, 512 GB SSD.',
      variants: [
        { attributeName: 'RAM',     value: '16 GB',  extraPrice: 0    },
        { attributeName: 'RAM',     value: '32 GB',  extraPrice: 250  },
        { attributeName: 'Storage', value: '512 GB', extraPrice: 0    },
        { attributeName: 'Storage', value: '1 TB',   extraPrice: 150  },
      ],
    }),

    upsertProduct({
      name: 'DeskPro Workstation', categoryId: catHardware.id,
      price: 2199.00, unit: 'each', taxPercent: 8, isSubscription: false,
      description: 'High-performance desktop workstation with AMD Ryzen 9, 32 GB RAM, NVIDIA RTX 4070.',
      variants: [
        { attributeName: 'GPU',     value: 'RTX 4070', extraPrice: 0   },
        { attributeName: 'GPU',     value: 'RTX 4090', extraPrice: 800 },
        { attributeName: 'Storage', value: '1 TB SSD', extraPrice: 0   },
        { attributeName: 'Storage', value: '2 TB SSD', extraPrice: 200 },
      ],
    }),

    upsertProduct({
      name: '2U Rack Server', categoryId: catHardware.id,
      price: 4799.00, unit: 'each', taxPercent: 8, isSubscription: false,
      description: 'Enterprise 2U rack server, dual Xeon, 128 GB ECC RAM, 10GbE NIC.',
      variants: [
        { attributeName: 'Storage Config', value: '4 × 2 TB HDD',  extraPrice: 0    },
        { attributeName: 'Storage Config', value: '8 × 2 TB SSD',  extraPrice: 1200 },
      ],
    }),

    upsertProduct({
      name: 'DFX ERP Suite', categoryId: catSoftware.id,
      price: 4999.00, unit: 'license', taxPercent: 0, isSubscription: false,
      description: 'Perpetual ERP license covering Finance, HR, and Inventory modules.',
      variants: [
        { attributeName: 'Tier',  value: 'Standard',   extraPrice: 0     },
        { attributeName: 'Tier',  value: 'Professional', extraPrice: 2000 },
        { attributeName: 'Tier',  value: 'Enterprise',  extraPrice: 5000 },
      ],
    }),

    upsertProduct({
      name: 'DealFlow360 CRM', categoryId: catSoftware.id,
      price: 299.00, unit: 'seat/month', taxPercent: 0, isSubscription: true,
      description: 'Full-featured CRM with deal pipeline, quotation management, and customer portal.',
      variants: [
        { attributeName: 'Plan', value: 'Starter',  extraPrice: 0   },
        { attributeName: 'Plan', value: 'Growth',   extraPrice: 100 },
        { attributeName: 'Plan', value: 'Enterprise', extraPrice: 300 },
      ],
    }),

    upsertProduct({
      name: 'Implementation & Setup', categoryId: catService.id,
      price: 150.00, unit: 'hour', taxPercent: 0, isSubscription: false,
      description: 'Professional implementation, configuration, and training services.',
      variants: [],
    }),

    upsertProduct({
      name: 'Cloud Backup Storage', categoryId: catCloud.id,
      price: 49.00, unit: 'TB/month', taxPercent: 0, isSubscription: true,
      description: 'Encrypted cloud backup with 99.99% durability. Billed monthly per TB.',
      variants: [
        { attributeName: 'Region', value: 'US East',   extraPrice: 0  },
        { attributeName: 'Region', value: 'EU West',   extraPrice: 5  },
        { attributeName: 'Region', value: 'APAC',      extraPrice: 10 },
      ],
    }),

    upsertProduct({
      name: 'Managed Hosting (Monthly)', categoryId: catCloud.id,
      price: 199.00, unit: 'server/month', taxPercent: 0, isSubscription: true,
      description: 'Fully managed server hosting with 24/7 monitoring, patching, and SLA.',
      variants: [
        { attributeName: 'SLA',  value: '99.9%',  extraPrice: 0   },
        { attributeName: 'SLA',  value: '99.99%', extraPrice: 100 },
      ],
    }),
  ]);

  console.log('  ✓ 8 products created (3 hardware, 2 software, 1 service, 2 cloud)');

  // ── 4. Price List Rules ────────────────────────────────────────────────────
  console.log('[demo-seed] Creating price list rules…');

  // Clear existing rules for these products so upsert is clean
  await prisma.priceListRule.deleteMany({
    where: { productId: { in: [laptop.id, workstation.id, dfxErp.id, dealflow360Crm.id, cloudBackup.id] } },
  });
  // Clear blanket tier rules too
  await prisma.priceListRule.deleteMany({ where: { productId: null } });

  await prisma.priceListRule.createMany({ data: [
    // Blanket tier discounts off base price
    { tier: 'SILVER', currency: 'USD', ruleType: 'PERCENT_OFF_BASE', value: 5,  productId: null },
    { tier: 'GOLD',   currency: 'USD', ruleType: 'PERCENT_OFF_BASE', value: 10, productId: null },

    // Product-specific fixed prices for GOLD on key hardware
    { tier: 'GOLD', currency: 'USD', ruleType: 'FIXED', value: 1099.00, productId: laptop.id },
    { tier: 'GOLD', currency: 'USD', ruleType: 'FIXED', value: 1849.00, productId: workstation.id },

    // DealFlow360 CRM — SILVER/GOLD volume pricing
    { tier: 'SILVER', currency: 'USD', ruleType: 'FIXED', value: 269.00, productId: dealflow360Crm.id },
    { tier: 'GOLD',   currency: 'USD', ruleType: 'FIXED', value: 239.00, productId: dealflow360Crm.id },

    // Cloud Backup — GOLD negotiated rate
    { tier: 'GOLD', currency: 'USD', ruleType: 'FIXED', value: 39.00, productId: cloudBackup.id },
  ]});
  console.log('  ✓ 7 price list rules');

  // ── 5. Upsell Rules ────────────────────────────────────────────────────────
  console.log('[demo-seed] Creating upsell rules…');
  await prisma.upsellRule.deleteMany();
  await prisma.upsellRule.createMany({ data: [
    { primaryProductId: laptop.id,      suggestedProductId: cloudBackup.id,       minMarginPercent: 30, isPromoted: true  },
    { primaryProductId: workstation.id, suggestedProductId: managedHosting.id,    minMarginPercent: 25, isPromoted: true  },
    { primaryProductId: dfxErp.id,      suggestedProductId: supportSetup.id,      minMarginPercent: 20, isPromoted: false },
    { primaryProductId: serverRack.id,  suggestedProductId: managedHosting.id,    minMarginPercent: 20, isPromoted: true  },
    { primaryProductId: dealflow360Crm.id, suggestedProductId: supportSetup.id,   minMarginPercent: 15, isPromoted: false },
  ]});
  console.log('  ✓ 5 upsell rules');

  // ── 6. Warehouses + Stock ──────────────────────────────────────────────────
  console.log('[demo-seed] Creating warehouses…');
  await prisma.stockLevel.deleteMany();
  await prisma.warehouse.deleteMany();

  const [whNY, whLA, whLondon] = await prisma.$transaction([
    prisma.warehouse.create({ data: { name: 'New York (East)',  location: 'New York, USA',   shippingCostWeight: 1.0 } }),
    prisma.warehouse.create({ data: { name: 'Los Angeles (West)', location: 'Los Angeles, USA', shippingCostWeight: 1.2 } }),
    prisma.warehouse.create({ data: { name: 'London (EMEA)',    location: 'London, UK',       shippingCostWeight: 1.5 } }),
  ]);

  // Stock levels for physical products only
  const physicalProducts = [laptop, workstation, serverRack];
  const stockData = [];
  for (const wh of [whNY, whLA, whLondon]) {
    for (const prod of physicalProducts) {
      stockData.push({
        warehouseId:  wh.id,
        productId:    prod.id,
        onHand:       Math.floor(Math.random() * 40) + 10,  // 10–50
        reserved:     Math.floor(Math.random() * 5),
        reorderPoint: 5,
        reorderQty:   20,
      });
    }
  }
  await prisma.stockLevel.createMany({ data: stockData });
  console.log('  ✓ 3 warehouses (NY, LA, London), stock for 3 hardware products');

  // ── 7. Customers ──────────────────────────────────────────────────────────
  console.log('[demo-seed] Creating customers…');

  // Clear portal users first (they reference customers)
  await prisma.user.deleteMany({
    where: { role: 'CUSTOMER', email: { in: ['acmecorp@dealflow360.com', 'globex@dealflow360.com', 'initechsolutions@dealflow360.com'] } },
  });
  await prisma.customer.deleteMany({
    where: { companyName: { in: ['Acme Corp', 'Globex Industries', 'Initech Solutions'] } },
  });

  const [acme, globex, initech] = await prisma.$transaction([
    prisma.customer.create({ data: {
      companyName: 'Acme Corp',
      tier:        'GOLD',
      realEmail:   'procurement@acmecorp.example.com',
    }}),
    prisma.customer.create({ data: {
      companyName: 'Globex Industries',
      tier:        'SILVER',
      realEmail:   'purchasing@globex.example.com',
    }}),
    prisma.customer.create({ data: {
      companyName: 'Initech Solutions',
      tier:        'BRONZE',
      realEmail:   'it@initech.example.com',
    }}),
  ]);

  // Create portal users for each customer
  await Promise.all([
    prisma.user.create({ data: {
      name:               'Acme Corp Portal',
      email:              'acmecorp@dealflow360.com',
      passwordHash:       await hash('AcmeCorp@deal123'),
      role:               'CUSTOMER',
      mustChangePassword: true,
      customerId:         acme.id,
    }}),
    prisma.user.create({ data: {
      name:               'Globex Portal',
      email:              'globex@dealflow360.com',
      passwordHash:       await hash('GlobexIndustries@deal123'),
      role:               'CUSTOMER',
      mustChangePassword: true,
      customerId:         globex.id,
    }}),
    prisma.user.create({ data: {
      name:               'Initech Portal',
      email:              'initechsolutions@dealflow360.com',
      passwordHash:       await hash('InitechSolutions@deal123'),
      role:               'CUSTOMER',
      mustChangePassword: true,
      customerId:         initech.id,
    }}),
  ]);
  console.log('  ✓ 3 customers (Acme Corp/GOLD, Globex Industries/SILVER, Initech Solutions/BRONZE) + portal users');

  // ── 8. Subscription Plans ──────────────────────────────────────────────────
  console.log('[demo-seed] Creating subscription plans…');
  await prisma.subscriptionPlan.deleteMany();
  const [planCrmMonthly, planCrmYearly, planBackupMonthly, planHostingMonthly] =
    await prisma.$transaction([
      prisma.subscriptionPlan.create({ data: {
        name: 'DealFlow360 CRM — Monthly', productId: dealflow360Crm.id,
        interval: 'MONTHLY', prorationRule: 'DAILY_PRORATE', cancellationRule: 'REFUND_UNUSED_DAYS',
      }}),
      prisma.subscriptionPlan.create({ data: {
        name: 'DealFlow360 CRM — Yearly', productId: dealflow360Crm.id,
        interval: 'YEARLY', prorationRule: 'DAILY_PRORATE', cancellationRule: 'CREDIT_NOTE',
      }}),
      prisma.subscriptionPlan.create({ data: {
        name: 'Cloud Backup — Monthly', productId: cloudBackup.id,
        interval: 'MONTHLY', prorationRule: 'DAILY_PRORATE', cancellationRule: 'REFUND_UNUSED_DAYS',
      }}),
      prisma.subscriptionPlan.create({ data: {
        name: 'Managed Hosting — Monthly', productId: managedHosting.id,
        interval: 'MONTHLY', prorationRule: 'DAILY_PRORATE', cancellationRule: 'NO_REFUND',
      }}),
    ]);
  console.log('  ✓ 4 subscription plans');

  // ── 9. Quotations ──────────────────────────────────────────────────────────
  console.log('[demo-seed] Creating quotations…');
  await prisma.negotiationMessage.deleteMany();
  await prisma.approvalStep.deleteMany();
  await prisma.quotationLine.deleteMany();
  await prisma.quotation.deleteMany();

  // Q1 — DRAFT: Acme Corp buying laptops + CRM (no discount breach, score 0)
  const q1 = await prisma.quotation.create({ data: {
    customerId:      acme.id,
    repId:           rep1.id,
    status:          'DRAFT',
    blendedRiskScore: 0,
    lastActivityAt:  d(-2),
    lines: { create: [
      {
        productId: laptop.id, quantity: 10,
        unitPrice: 1299.00, discountPercent: 8,   // Gold tier ceiling 20%, Hardware cat 15% → effective 15% → 0 pts over
        lineType: 'ONE_TIME',
        effectiveCeilingSnapshot: 15, pointsOverSnapshot: 0,
      },
      {
        productId: dealflow360Crm.id, quantity: 15,
        unitPrice: 299.00, discountPercent: 12,   // Gold tier 20%, Cloud&SaaS cat 20% → effective 20% → 0 pts over
        lineType: 'RECURRING', subscriptionPlanId: planCrmMonthly.id,
        effectiveCeilingSnapshot: 20, pointsOverSnapshot: 0,
      },
    ]},
  }});

  // Q2 — PENDING_APPROVAL: Globex buying servers + setup with discount breach (score > 0)
  const q2 = await prisma.quotation.create({ data: {
    customerId:       globex.id,
    repId:            rep1.id,
    status:           'PENDING_APPROVAL',
    blendedRiskScore: 8,   // Service line: 18% discount, 10% ceiling → 8 pts over
    lastActivityAt:   d(-1),
    lines: { create: [
      {
        productId: serverRack.id, quantity: 2,
        unitPrice: 4799.00, discountPercent: 10,  // Silver 10%, Hardware 15% → effective 10% → 0 pts over
        lineType: 'ONE_TIME',
        effectiveCeilingSnapshot: 10, pointsOverSnapshot: 0,
      },
      {
        productId: supportSetup.id, quantity: 40,
        unitPrice: 150.00, discountPercent: 18,   // Silver 10%, Services 10% → effective 10% → 8 pts over
        lineType: 'ONE_TIME',
        effectiveCeilingSnapshot: 10, pointsOverSnapshot: 8,
      },
    ]},
    approvalSteps: { create: [
      { level: 'SALES_MANAGER', status: 'PENDING', order: 1 },
    ]},
  }});

  // Q3 — APPROVED: Initech buying workstations (no breach)
  const q3 = await prisma.quotation.create({ data: {
    customerId:       initech.id,
    repId:            rep2.id,
    status:           'APPROVED',
    blendedRiskScore: 0,
    lastActivityAt:   d(-3),
    lines: { create: [
      {
        productId: workstation.id, quantity: 5,
        unitPrice: 2199.00, discountPercent: 3,   // Bronze 5%, Hardware 15% → effective 5% → 0 pts over
        lineType: 'ONE_TIME',
        effectiveCeilingSnapshot: 5, pointsOverSnapshot: 0,
      },
    ]},
    approvalSteps: { create: [
      {
        level: 'SALES_MANAGER', status: 'APPROVED', order: 1,
        actedById: manager.id, actedAt: d(-2), reason: 'Within policy. Standard workstation order.',
      },
    ]},
  }});

  // Q4 — UNDER_NEGOTIATION: Acme wants bigger discount on ERP (counter-offer in progress)
  const q4 = await prisma.quotation.create({ data: {
    customerId:       acme.id,
    repId:            rep2.id,
    status:           'UNDER_NEGOTIATION',
    blendedRiskScore: 12,  // Gold 20%, Software 25% → effective 20%, giving 25% → 5 pts over (ERP line)
    lastActivityAt:   d(0),
    lines: { create: [
      {
        productId: dfxErp.id, quantity: 1,
        unitPrice: 4999.00, discountPercent: 25,  // Gold 20%, Software 25% → effective 20% → 5 pts over
        lineType: 'ONE_TIME',
        effectiveCeilingSnapshot: 20, pointsOverSnapshot: 5,
      },
      {
        productId: supportSetup.id, quantity: 20,
        unitPrice: 150.00, discountPercent: 17,   // Gold 20%, Services 10% → effective 10% → 7 pts over
        lineType: 'ONE_TIME',
        effectiveCeilingSnapshot: 10, pointsOverSnapshot: 7,
      },
    ]},
    negotiationMessages: { create: [
      { senderType: 'REP',      message: 'We can offer 20% on the ERP and 15% on services for this bundle.',   createdAt: d(-2) },
      { senderType: 'CUSTOMER', message: 'We need at least 25% on ERP to make the business case. Can you do 25% + 17% services?', createdAt: d(-1) },
      { senderType: 'REP',      message: 'Checking internally — will get back to you today.',                 createdAt: d(0) },
    ]},
  }});

  // Q5 — CONFIRMED → FULFILLMENT: Initech adding cloud backup
  const q5 = await prisma.quotation.create({ data: {
    customerId:       initech.id,
    repId:            rep1.id,
    status:           'FULFILLMENT',
    blendedRiskScore: 0,
    lastActivityAt:   d(-5),
    lines: { create: [
      {
        productId: cloudBackup.id, quantity: 5,
        unitPrice: 49.00, discountPercent: 0,
        lineType: 'RECURRING', subscriptionPlanId: planBackupMonthly.id,
        effectiveCeilingSnapshot: 5, pointsOverSnapshot: 0,
      },
      {
        productId: managedHosting.id, quantity: 2,
        unitPrice: 199.00, discountPercent: 0,
        lineType: 'RECURRING', subscriptionPlanId: planHostingMonthly.id,
        effectiveCeilingSnapshot: 5, pointsOverSnapshot: 0,
      },
    ]},
  }});

  // Q6 — CLOSED: Globex previous order (historical)
  const q6 = await prisma.quotation.create({ data: {
    customerId:       globex.id,
    repId:            rep2.id,
    status:           'CLOSED',
    blendedRiskScore: 0,
    lastActivityAt:   d(-30),
    lines: { create: [
      {
        productId: laptop.id, quantity: 5,
        unitPrice: 1299.00, discountPercent: 5,
        lineType: 'ONE_TIME',
        effectiveCeilingSnapshot: 10, pointsOverSnapshot: 0,
      },
    ]},
  }});

  console.log('  ✓ 6 quotations (DRAFT, PENDING_APPROVAL, APPROVED, UNDER_NEGOTIATION, FULFILLMENT, CLOSED)');

  // ── 10. Orders ─────────────────────────────────────────────────────────────
  console.log('[demo-seed] Creating orders…');
  await prisma.fulfillmentSplit.deleteMany();
  await prisma.backorderItem.deleteMany();
  await prisma.order.deleteMany();

  const order3 = await prisma.order.create({ data: {
    quotationId: q3.id, status: 'PENDING_FULFILLMENT', confirmedAt: d(-2),
  }});
  const order5 = await prisma.order.create({ data: {
    quotationId: q5.id, status: 'FULFILLMENT_IN_PROGRESS', confirmedAt: d(-5),
  }});
  const order6 = await prisma.order.create({ data: {
    quotationId: q6.id, status: 'DELIVERED', confirmedAt: d(-28),
  }});

  // Fulfillment split for order3 (workstations)
  await prisma.fulfillmentSplit.createMany({ data: [
    { orderId: order3.id, warehouseId: whNY.id, productId: workstation.id, qtyFulfilled: 3, estimatedCost: 45.00 },
    { orderId: order3.id, warehouseId: whLA.id, productId: workstation.id, qtyFulfilled: 2, estimatedCost: 55.00 },
  ]});
  console.log('  ✓ 3 orders, 2 fulfillment splits');

  // ── 11. Subscriptions ─────────────────────────────────────────────────────
  console.log('[demo-seed] Creating subscriptions…');
  await prisma.subscription.deleteMany();
  await prisma.subscription.createMany({ data: [
    {
      orderId: order5.id, planId: planBackupMonthly.id,
      quantity: 5, status: 'ACTIVE',
      cycleStartDate: d(-5), nextBillDate: d(25),
    },
    {
      orderId: order5.id, planId: planHostingMonthly.id,
      quantity: 2, status: 'ACTIVE',
      cycleStartDate: d(-5), nextBillDate: d(25),
    },
  ]});
  console.log('  ✓ 2 active subscriptions (cloud backup + managed hosting for Initech)');

  // ── 12. Invoices ──────────────────────────────────────────────────────────
  console.log('[demo-seed] Creating invoices…');
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();

  const inv1 = await prisma.invoice.create({ data: {
    orderId: order3.id, type: 'ONE_TIME',
    amount: 10995.00,  // 5 × 2199 × 0.97 (3% discount)
    status: 'UNPAID', dueDate: d(30), createdAt: d(-2),
  }});
  const inv2 = await prisma.invoice.create({ data: {
    orderId: order6.id, type: 'ONE_TIME',
    amount: 6162.25,   // 5 × 1299 × 0.95 (5% discount)
    status: 'PAID', dueDate: d(-10), createdAt: d(-28),
  }});
  const inv3 = await prisma.invoice.create({ data: {
    orderId: order5.id, type: 'RECURRING',
    amount: 643.00,   // 5×49 + 2×199
    status: 'UNPAID', dueDate: d(25), createdAt: d(-5),
  }});
  console.log('  ✓ 3 invoices (1 paid, 2 unpaid)');

  // ── 13. Payments ──────────────────────────────────────────────────────────
  console.log('[demo-seed] Creating payment records…');
  await prisma.payment.create({ data: {
    invoiceId:         inv2.id,
    razorpayOrderId:   'order_demo_globex_29d',
    razorpayPaymentId: 'pay_demo_verified_001',
    razorpaySignature: 'sig_demo_ok',
    amount:            6162.25,
    status:            'VERIFIED',
    createdAt:         d(-25),
  }});
  console.log('  ✓ 1 verified payment (Globex historical)');

  // ── 14. Deal Health Flags ─────────────────────────────────────────────────
  console.log('[demo-seed] Creating deal health flags…');
  await prisma.dealHealthFlag.deleteMany();
  await prisma.dealHealthFlag.createMany({ data: [
    {
      quotationId: q4.id, type: 'DISCOUNT_ANOMALY',
      detail: 'Services line discount (17%) exceeds Professional Services category ceiling (10%) by 7 points.',
      resolved: false, createdAt: d(-1),
    },
    {
      quotationId: q2.id, type: 'STALLED',
      detail: 'Quotation in PENDING_APPROVAL for 48+ hours with no approval action taken.',
      resolved: false, createdAt: d(0),
    },
    {
      quotationId: q6.id, type: 'DELIVERY_SLIPPAGE',
      detail: 'Order confirmed 30 days ago — delivery confirmation not recorded.',
      resolved: true, createdAt: d(-15),
    },
  ]});
  console.log('  ✓ 3 deal health flags (1 discount anomaly, 1 stalled, 1 resolved slippage)');

  // ── 15. Notifications ─────────────────────────────────────────────────────
  console.log('[demo-seed] Creating notifications…');
  await prisma.notification.deleteMany();
  await prisma.notification.createMany({ data: [
    { userId: manager.id, type: 'APPROVAL_PENDING',  message: 'Quotation for Globex Industries requires your approval.',  relatedId: q2.id, isRead: false },
    { userId: rep1.id,    type: 'DEAL_HEALTH_FLAG',  message: 'Deal health flag raised on Acme Corp negotiation.',         relatedId: q4.id, isRead: false },
    { userId: rep2.id,    type: 'QUOTATION_APPROVED', message: 'Initech Solutions quotation has been approved by manager.', relatedId: q3.id, isRead: true  },
    { userId: finance.id, type: 'INVOICE_UNPAID',    message: 'Invoice #INV-001 for Initech Solutions is due in 30 days.', relatedId: inv1.id, isRead: false },
  ]});
  console.log('  ✓ 4 notifications');

  // ── 16. Activity Logs ─────────────────────────────────────────────────────
  console.log('[demo-seed] Creating activity log entries…');
  await prisma.activityLog.deleteMany();
  await prisma.activityLog.createMany({ data: [
    { userId: rep1.id,    action: 'QUOTATION_CREATED',  entityType: 'Quotation', entityId: q1.id, details: { customer: 'Acme Corp' },         createdAt: d(-2) },
    { userId: rep1.id,    action: 'QUOTATION_SUBMITTED', entityType: 'Quotation', entityId: q2.id, details: { blendedRiskScore: 8 },           createdAt: d(-1) },
    { userId: manager.id, action: 'QUOTATION_APPROVED',  entityType: 'Quotation', entityId: q3.id, details: { reason: 'Within policy.' },       createdAt: d(-2) },
    { userId: rep2.id,    action: 'NEGOTIATION_MESSAGE', entityType: 'Quotation', entityId: q4.id, details: { senderType: 'REP' },             createdAt: d(0)  },
    { userId: null,       action: 'DEAL_STALLED_FLAGGED', entityType: 'Quotation', entityId: q2.id, details: { hoursStalled: 48 },             createdAt: d(0)  },
    { userId: null,       action: 'RECURRING_INVOICE_CREATED', entityType: 'Subscription', entityId: 'demo', details: { interval: 'MONTHLY' }, createdAt: d(-5) },
  ]});
  console.log('  ✓ 6 activity log entries');

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════╗
║             Demo Seed Complete ✓                     ║
╠══════════════════════════════════════════════════════╣
║  Users         5 internal + 3 portal                 ║
║  Categories    4  (Hardware, Software, Services, Cloud)
║  Products      8  (3 hardware, 2 software, 1 svc, 2 cloud)
║  Price Rules   7                                     ║
║  Upsell Rules  5                                     ║
║  Warehouses    3  (NY, LA, London)                   ║
║  Customers     3  (Gold, Silver, Bronze)             ║
║  Sub Plans     4                                     ║
║  Quotations    6  (all pipeline stages covered)      ║
║  Orders        3                                     ║
║  Subscriptions 2  (active)                           ║
║  Invoices      3  (1 paid, 2 unpaid)                 ║
║  Payments      1  (verified)                         ║
║  Health Flags  3                                     ║
║  Notifications 4                                     ║
╠══════════════════════════════════════════════════════╣
║  Login credentials                                   ║
║  admin    admin@dealflow360.com   / Admin@1234        ║
║  manager  manager@dealflow360.com / Manager@1234      ║
║  finance  finance@dealflow360.com / Finance@1234      ║
║  rep1     rep1@dealflow360.com    / Rep@1234          ║
║  rep2     rep2@dealflow360.com    / Rep@1234          ║
║  portal   acmecorp@dealflow360.com / AcmeCorp@deal123 ║
╚══════════════════════════════════════════════════════╝
`);
}

// Allow both direct execution and require() from other scripts
if (require.main === module) {
  main()
    .catch((err) => { console.error('[demo-seed] Error:', err); process.exit(1); })
    .finally(() => prisma.$disconnect());
}

module.exports = { main };
