'use strict';

/**
 * 200-record demo seed
 * ====================
 * Generates realistic bulk data covering every module:
 *   - 5 internal users (already in seed-demo, upserted)
 *   - 20 customers across 3 tiers
 *   - 8 product categories  + 30 products with variants
 *   - 40 price-list rules
 *   - 10 upsell rules
 *   - 3 warehouses + stock levels
 *   - 4 subscription plans
 *   - 60 quotations across all pipeline stages
 *   - 40 orders with fulfillment splits + backorders
 *   - 20 active subscriptions
 *   - 30 invoices (mix of ONE_TIME / RECURRING, PAID / UNPAID)
 *   - 10 payments (VERIFIED)
 *   - 15 deal health flags
 *   - 20 approval steps
 *   - 30 activity log entries
 *   - 15 notifications
 *
 * Run with:  node prisma/seed-200.js
 * Safe to re-run — clears generated data then re-inserts.
 */

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const bcrypt           = require('bcrypt');

const prisma = new PrismaClient();
const SALT   = 10;
const hash   = (p) => bcrypt.hash(p, SALT);

// ── helpers ────────────────────────────────────────────────────────────────────

const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick  = (arr) => arr[rand(0, arr.length - 1)];
const pickN = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

function daysAgo(n)   { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function daysAhead(n) { const d = new Date(); d.setDate(d.getDate() + n); return d; }

const COMPANY_NAMES = [
  'Vertex Dynamics', 'Ironclad Systems', 'NovaSpark Inc', 'BluePeak Solutions',
  'Quantum Edge', 'TerraForm Tech', 'Cascade Analytics', 'Meridian Group',
  'Stellar Works', 'Apex Innovations', 'GridCore Ltd', 'Pinnacle Partners',
  'Horizon Digital', 'CloudPath Inc', 'Nexus Ventures', 'Delta Force Tech',
  'Orion Platforms', 'Zephyr Labs', 'Catalyst Corp', 'Mosaic Enterprises',
];

const STATUSES = [
  'DRAFT', 'DRAFT', 'DRAFT',
  'PENDING_APPROVAL', 'PENDING_APPROVAL',
  'APPROVED',
  'UNDER_NEGOTIATION',
  'CONFIRMED', 'CONFIRMED', 'CONFIRMED',
  'REJECTED',
  'FULFILLMENT',
  'CLOSED',
];

const FLAG_TYPES   = ['STALLED', 'DISCOUNT_ANOMALY', 'DELIVERY_SLIPPAGE'];
const ORDER_STATUSES = ['PENDING_FULFILLMENT', 'SPLIT_ACCEPTED', 'BACKORDERED', 'DELIVERED'];
const TIERS = ['BRONZE', 'SILVER', 'GOLD'];

async function main() {
  console.log('\n[seed-200] Starting — this may take ~30 seconds…\n');

  // ── 1. Ensure baseline config ─────────────────────────────────────────────
  console.log('[seed-200] Upserting baseline config…');

  const [admin, manager, finance, rep1, rep2] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@dealflow360.com' },
      update: {},
      create: { name: 'Super Admin', email: 'admin@dealflow360.com', passwordHash: await hash('Admin@1234'), role: 'ADMIN', mustChangePassword: false },
    }),
    prisma.user.upsert({
      where: { email: 'manager@dealflow360.com' },
      update: {},
      create: { name: 'Sarah Manager', email: 'manager@dealflow360.com', passwordHash: await hash('Manager@1234'), role: 'SALES_MANAGER' },
    }),
    prisma.user.upsert({
      where: { email: 'finance@dealflow360.com' },
      update: {},
      create: { name: 'Frank Finance', email: 'finance@dealflow360.com', passwordHash: await hash('Finance@1234'), role: 'FINANCE' },
    }),
    prisma.user.upsert({
      where: { email: 'rep1@dealflow360.com' },
      update: {},
      create: { name: 'Alice Sales', email: 'rep1@dealflow360.com', passwordHash: await hash('Rep@1234'), role: 'SALES_REP' },
    }),
    prisma.user.upsert({
      where: { email: 'rep2@dealflow360.com' },
      update: {},
      create: { name: 'Bob Sales', email: 'rep2@dealflow360.com', passwordHash: await hash('Rep@1234'), role: 'SALES_REP' },
    }),
  ]);

  const reps = [rep1, rep2];

  // Tier ceilings
  for (const { tier, max } of [{ tier: 'BRONZE', max: 5 }, { tier: 'SILVER', max: 10 }, { tier: 'GOLD', max: 20 }]) {
    await prisma.tierDiscountCeiling.upsert({
      where: { tier },
      update: { maxDiscountPercent: max },
      create: { tier, maxDiscountPercent: max },
    });
  }

  // Approval chain rules
  await prisma.approvalChainRule.deleteMany();
  await prisma.approvalChainRule.createMany({ data: [
    { minScore: 0,  maxScore: 9,    requiredLevel: 'NONE' },
    { minScore: 10, maxScore: 29,   requiredLevel: 'SALES_MANAGER' },
    { minScore: 30, maxScore: null, requiredLevel: 'SALES_MANAGER_THEN_FINANCE' },
  ]});
  console.log('  ✓ users, ceilings, approval rules');

  // ── 2. Product categories ─────────────────────────────────────────────────
  console.log('[seed-200] Creating 8 categories…');

  const catData = [
    { name: 'Hardware',              maxDiscountPercent: 15 },
    { name: 'Software Licenses',     maxDiscountPercent: 25 },
    { name: 'Professional Services', maxDiscountPercent: 10 },
    { name: 'Cloud & SaaS',          maxDiscountPercent: 20 },
    { name: 'Networking',            maxDiscountPercent: 12 },
    { name: 'Security',              maxDiscountPercent: 18 },
    { name: 'Storage & Backup',      maxDiscountPercent: 22 },
    { name: 'Training',              maxDiscountPercent: 30 },
  ];
  const cats = [];
  for (const c of catData) {
    cats.push(await prisma.productCategory.upsert({
      where: { name: c.name },
      update: { maxDiscountPercent: c.maxDiscountPercent },
      create: c,
    }));
  }
  console.log('  ✓ 8 categories');

  // ── 3. Products ───────────────────────────────────────────────────────────
  console.log('[seed-200] Creating 30 products…');

  const productDefs = [
    // Hardware (cat 0)
    { name: 'ProBook Laptop 15"',    cat: 0, price: 1299, unit: 'each',         sub: false, taxPercent: 8 },
    { name: 'DeskPro Workstation',   cat: 0, price: 2199, unit: 'each',         sub: false, taxPercent: 8 },
    { name: '2U Rack Server',        cat: 0, price: 4799, unit: 'each',         sub: false, taxPercent: 8 },
    { name: 'Thin Client Terminal',  cat: 0, price:  349, unit: 'each',         sub: false, taxPercent: 8 },
    { name: 'KVM Switch 16-port',    cat: 0, price:  699, unit: 'each',         sub: false, taxPercent: 8 },
    // Software (cat 1)
    { name: 'DFX ERP Suite',         cat: 1, price: 4999, unit: 'license',      sub: false, taxPercent: 0 },
    { name: 'DealFlow360 CRM',       cat: 1, price:  299, unit: 'seat/month',   sub: true,  taxPercent: 0 },
    { name: 'Analytics Pro',         cat: 1, price:  149, unit: 'user/month',   sub: true,  taxPercent: 0 },
    { name: 'HR Manager Suite',      cat: 1, price: 3499, unit: 'license',      sub: false, taxPercent: 0 },
    { name: 'Finance Module',        cat: 1, price: 2999, unit: 'license',      sub: false, taxPercent: 0 },
    // Services (cat 2)
    { name: 'Implementation Setup',  cat: 2, price:  150, unit: 'hour',         sub: false, taxPercent: 0 },
    { name: 'IT Consulting',         cat: 2, price:  200, unit: 'hour',         sub: false, taxPercent: 0 },
    { name: 'Data Migration',        cat: 2, price: 2500, unit: 'project',      sub: false, taxPercent: 0 },
    { name: 'Custom Development',    cat: 2, price:  175, unit: 'hour',         sub: false, taxPercent: 0 },
    // Cloud (cat 3)
    { name: 'Cloud Backup',          cat: 3, price:   49, unit: 'TB/month',     sub: true,  taxPercent: 0 },
    { name: 'Managed Hosting',       cat: 3, price:  199, unit: 'server/month', sub: true,  taxPercent: 0 },
    { name: 'CDN Service',           cat: 3, price:   29, unit: 'TB/month',     sub: true,  taxPercent: 0 },
    { name: 'Virtual Desktop',       cat: 3, price:   89, unit: 'user/month',   sub: true,  taxPercent: 0 },
    // Networking (cat 4)
    { name: 'Enterprise Switch 48p', cat: 4, price: 1499, unit: 'each',         sub: false, taxPercent: 8 },
    { name: 'WiFi 6 Access Point',   cat: 4, price:  299, unit: 'each',         sub: false, taxPercent: 8 },
    { name: 'SD-WAN Appliance',      cat: 4, price: 2999, unit: 'each',         sub: false, taxPercent: 8 },
    // Security (cat 5)
    { name: 'Firewall UTM',          cat: 5, price: 3499, unit: 'each',         sub: false, taxPercent: 8 },
    { name: 'Endpoint Security',     cat: 5, price:   45, unit: 'seat/month',   sub: true,  taxPercent: 0 },
    { name: 'SIEM Platform',         cat: 5, price:  799, unit: 'month',        sub: true,  taxPercent: 0 },
    // Storage (cat 6)
    { name: 'NAS Storage 20TB',      cat: 6, price: 3299, unit: 'each',         sub: false, taxPercent: 8 },
    { name: 'SAN Array 100TB',       cat: 6, price:12999, unit: 'each',         sub: false, taxPercent: 8 },
    { name: 'Tape Library',          cat: 6, price: 4999, unit: 'each',         sub: false, taxPercent: 8 },
    // Training (cat 7)
    { name: 'Admin Training 3-day',  cat: 7, price: 1800, unit: 'per person',   sub: false, taxPercent: 0 },
    { name: 'User Onboarding',       cat: 7, price:  600, unit: 'per person',   sub: false, taxPercent: 0 },
    { name: 'Certification Prep',    cat: 7, price:  950, unit: 'per person',   sub: false, taxPercent: 0 },
  ];

  const products = [];
  for (const def of productDefs) {
    const existing = await prisma.product.findFirst({ where: { name: def.name } });
    if (existing) {
      products.push(existing);
      continue;
    }
    const p = await prisma.product.create({
      data: {
        name:          def.name,
        categoryId:    cats[def.cat].id,
        price:         def.price,
        unit:          def.unit,
        taxPercent:    def.taxPercent,
        isSubscription: def.sub,
        variants: {
          create: def.sub ? [] : [
            { attributeName: 'Config', value: 'Standard',  extraPrice: 0 },
            { attributeName: 'Config', value: 'Pro',       extraPrice: Math.round(def.price * 0.2) },
            { attributeName: 'Config', value: 'Enterprise',extraPrice: Math.round(def.price * 0.5) },
          ],
        },
      },
    });
    products.push(p);
  }
  console.log('  ✓ 30 products');

  // ── 4. Price list rules ───────────────────────────────────────────────────
  console.log('[seed-200] Creating price list rules…');
  await prisma.priceListRule.deleteMany({ where: { productId: null } });
  await prisma.priceListRule.createMany({ data: [
    { tier: 'SILVER', currency: 'USD', ruleType: 'PERCENT_OFF_BASE', value: 5,  productId: null },
    { tier: 'GOLD',   currency: 'USD', ruleType: 'PERCENT_OFF_BASE', value: 10, productId: null },
  ]});

  // Product-specific overrides for top 5 hardware products
  for (const p of products.slice(0, 5)) {
    await prisma.priceListRule.deleteMany({ where: { productId: p.id } });
    await prisma.priceListRule.createMany({ data: [
      { tier: 'SILVER', currency: 'USD', ruleType: 'FIXED', value: Math.round(p.price * 0.93), productId: p.id },
      { tier: 'GOLD',   currency: 'USD', ruleType: 'FIXED', value: Math.round(p.price * 0.87), productId: p.id },
    ]});
  }
  console.log('  ✓ price list rules');

  // ── 5. Upsell rules ───────────────────────────────────────────────────────
  console.log('[seed-200] Creating 10 upsell rules…');
  await prisma.upsellRule.deleteMany();
  const upsellPairs = [
    [0, 14], [1, 15], [2, 15], [5, 10], [6, 10],
    [3, 28], [18, 21], [11, 28], [7, 10], [22, 23],
  ];
  await prisma.upsellRule.createMany({
    data: upsellPairs.map(([pi, si], idx) => ({
      primaryProductId:   products[pi].id,
      suggestedProductId: products[si].id,
      minMarginPercent:   rand(10, 25),
      isPromoted:         idx < 4,
    })),
  });
  console.log('  ✓ 10 upsell rules');

  // ── 6. Warehouses + stock ─────────────────────────────────────────────────
  console.log('[seed-200] Creating warehouses & stock…');
  // Delete in FK-safe order to avoid constraint violations
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.creditNote.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.fulfillmentSplit.deleteMany();
  await prisma.backorderItem.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.warehouse.deleteMany();

  const whs = await prisma.$transaction([
    prisma.warehouse.create({ data: { name: 'New York (East)',    location: 'New York, USA',      shippingCostWeight: 1.0 } }),
    prisma.warehouse.create({ data: { name: 'Los Angeles (West)', location: 'Los Angeles, USA',   shippingCostWeight: 1.2 } }),
    prisma.warehouse.create({ data: { name: 'London (EMEA)',      location: 'London, UK',         shippingCostWeight: 1.5 } }),
    prisma.warehouse.create({ data: { name: 'Singapore (APAC)',   location: 'Singapore',          shippingCostWeight: 1.8 } }),
  ]);

  // Stock for all non-subscription physical products
  const physicalProducts = products.filter(p => !p.isSubscription);
  const stockRows = [];
  for (const wh of whs) {
    for (const p of physicalProducts) {
      stockRows.push({
        warehouseId: wh.id, productId: p.id,
        onHand: rand(5, 100), reserved: rand(0, 5),
        reorderPoint: 5, reorderQty: 20,
      });
    }
  }
  await prisma.stockLevel.createMany({ data: stockRows });
  console.log('  ✓ 4 warehouses, ' + stockRows.length + ' stock records');

  // ── 7. Subscription plans ─────────────────────────────────────────────────
  console.log('[seed-200] Creating subscription plans…');
  await prisma.subscription.deleteMany();
  await prisma.subscriptionPlan.deleteMany();

  const subProducts = products.filter(p => p.isSubscription);
  const plans = [];
  for (const sp of subProducts) {
    plans.push(await prisma.subscriptionPlan.create({
      data: {
        name:             sp.name + ' — Monthly',
        productId:        sp.id,
        interval:         'MONTHLY',
        prorationRule:    'DAILY_PRORATE',
        cancellationRule: pick(['REFUND_UNUSED_DAYS', 'CREDIT_NOTE', 'NO_REFUND']),
      },
    }));
  }
  console.log('  ✓ ' + plans.length + ' subscription plans');

  // ── 8. Customers + portal users ───────────────────────────────────────────
  console.log('[seed-200] Creating 20 customers…');

  // Clear old demo customers (except seed-demo ones already there)
  const existingCustomers = await prisma.customer.findMany({
    where: { companyName: { in: COMPANY_NAMES } },
    select: { id: true },
  });
  if (existingCustomers.length) {
    await prisma.user.deleteMany({ where: { customerId: { in: existingCustomers.map(c => c.id) } } });
    await prisma.customer.deleteMany({ where: { id: { in: existingCustomers.map(c => c.id) } } });
  }

  const customers = [];
  for (let i = 0; i < COMPANY_NAMES.length; i++) {
    const tier = TIERS[i % 3];
    const c = await prisma.customer.create({
      data: {
        companyName: COMPANY_NAMES[i],
        tier,
        realEmail: `procurement@${COMPANY_NAMES[i].toLowerCase().replace(/\s+/g, '')}.example.com`,
      },
    });
    // Create portal user
    const slug  = COMPANY_NAMES[i].toLowerCase().replace(/[^a-z0-9]/g, '');
    const plain = COMPANY_NAMES[i].split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join('') + '@deal123';
    await prisma.user.create({
      data: {
        name:               c.companyName + ' Portal',
        email:              slug + '@dealflow360.com',
        passwordHash:       await hash(plain),
        role:               'CUSTOMER',
        mustChangePassword: true,
        customerId:         c.id,
      },
    });
    customers.push(c);
  }
  console.log('  ✓ 20 customers + portal users');

  // ── 9. Quotations (60) ────────────────────────────────────────────────────
  console.log('[seed-200] Creating 60 quotations…');

  // Clear existing generated quotations
  const existingQuotes = await prisma.quotation.findMany({
    where: { customerId: { in: customers.map(c => c.id) } },
    select: { id: true },
  });
  if (existingQuotes.length) {
    const qids = existingQuotes.map(q => q.id);
    await prisma.negotiationMessage.deleteMany({ where: { quotationId: { in: qids } } });
    await prisma.approvalStep.deleteMany({ where: { quotationId: { in: qids } } });
    await prisma.quotationLine.deleteMany({ where: { quotationId: { in: qids } } });
    await prisma.quotation.deleteMany({ where: { id: { in: qids } } });
  }

  const quotations = [];
  for (let i = 0; i < 60; i++) {
    const customer = customers[i % customers.length];
    const rep      = reps[i % reps.length];
    const status   = STATUSES[i % STATUSES.length];
    const daysBack = rand(1, 90);

    // Pick 1-4 products for this quotation
    const selectedProducts = pickN(products, rand(1, 4));
    const tierCeilingMap   = { BRONZE: 5, SILVER: 10, GOLD: 20 };
    const tierCeiling      = tierCeilingMap[customer.tier];

    let blendedScore = 0;
    const lineData = selectedProducts.map(p => {
      const catCeiling  = Number(p.category?.maxDiscountPercent ?? cats.find(c => c.id === p.categoryId)?.maxDiscountPercent ?? 100);
      const effCeiling  = Math.min(tierCeiling, catCeiling);
      // ~30% chance of a discount breach
      const discount    = Math.random() < 0.3
        ? rand(effCeiling + 1, effCeiling + 15)
        : rand(0, Math.max(0, effCeiling - 1));
      const ptsOver     = Math.max(0, discount - effCeiling);
      blendedScore     += ptsOver;
      return {
        productId:               p.id,
        quantity:                rand(1, 20),
        unitPrice:               Number(p.price),
        discountPercent:         discount,
        lineType:                p.isSubscription ? 'RECURRING' : 'ONE_TIME',
        subscriptionPlanId:      p.isSubscription && plans.length
          ? (plans.find(pl => pl.productId === p.id)?.id ?? null)
          : null,
        effectiveCeilingSnapshot: Math.min(tierCeiling, Number(cats.find(c => c.id === p.categoryId)?.maxDiscountPercent ?? 100)),
        pointsOverSnapshot:      ptsOver,
      };
    });

    const q = await prisma.quotation.create({
      data: {
        customerId:       customer.id,
        repId:            rep.id,
        status,
        blendedRiskScore: blendedScore,
        lastActivityAt:   daysAgo(rand(0, daysBack)),
        createdAt:        daysAgo(daysBack),
        lines:            { create: lineData },
      },
    });

    // Add approval steps for quotations that need them
    if (['PENDING_APPROVAL', 'APPROVED', 'CONFIRMED', 'FULFILLMENT'].includes(status) && blendedScore > 0) {
      await prisma.approvalStep.create({
        data: {
          quotationId: q.id,
          level:       'SALES_MANAGER',
          status:      status === 'PENDING_APPROVAL' ? 'PENDING' : 'APPROVED',
          order:       1,
          actedById:   status !== 'PENDING_APPROVAL' ? manager.id : null,
          actedAt:     status !== 'PENDING_APPROVAL' ? daysAgo(rand(1, daysBack)) : null,
          reason:      status !== 'PENDING_APPROVAL' ? pick(['Within business policy', 'Strategic customer — approved', 'One-time exception granted', 'Volume justifies discount']) : null,
        },
      });
    }

    // Add negotiation messages for relevant statuses
    if (['UNDER_NEGOTIATION', 'APPROVED'].includes(status)) {
      await prisma.negotiationMessage.createMany({
        data: [
          { quotationId: q.id, senderType: 'REP',      message: 'Please review the attached proposal and let us know your thoughts.',  createdAt: daysAgo(daysBack - 1) },
          { quotationId: q.id, senderType: 'CUSTOMER', message: 'We appreciate the offer. Can you improve the discount slightly?',       createdAt: daysAgo(daysBack - 2) },
          { quotationId: q.id, senderType: 'REP',      message: 'I will check with the team and come back to you shortly.',              createdAt: daysAgo(daysBack - 3) },
        ],
      });
    }

    quotations.push({ ...q, lines: lineData });
  }
  console.log('  ✓ 60 quotations');

  // ── 10. Orders (40) ───────────────────────────────────────────────────────
  console.log('[seed-200] Creating 40 orders, splits, backorders…');

  // Use CONFIRMED/FULFILLMENT quotations
  const confirmedQuotes = quotations.filter(q =>
    ['CONFIRMED', 'FULFILLMENT', 'CLOSED'].includes(q.status)
  ).slice(0, 40);

  // Clear old orders for these customers
  const existingOrders = await prisma.order.findMany({
    where: { quotationId: { in: confirmedQuotes.map(q => q.id) } },
    select: { id: true },
  });
  if (existingOrders.length) {
    const oids = existingOrders.map(o => o.id);
    await prisma.fulfillmentSplit.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.backorderItem.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.subscription.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.invoice.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.order.deleteMany({ where: { id: { in: oids } } });
  }

  const orders = [];
  for (const q of confirmedQuotes) {
    const orderStatus = pick(ORDER_STATUSES);
    const order = await prisma.order.create({
      data: {
        quotationId: q.id,
        status:      orderStatus,
        confirmedAt: daysAgo(rand(1, 60)),
      },
    });

    // Fulfillment split — allocate from first available warehouse
    const physLines = q.lines.filter(l => l.lineType === 'ONE_TIME');
    if (physLines.length > 0) {
      const wh = whs[rand(0, whs.length - 1)];
      await prisma.fulfillmentSplit.createMany({
        data: physLines.map(l => ({
          orderId:       order.id,
          warehouseId:   wh.id,
          productId:     l.productId,
          qtyFulfilled:  Math.max(1, l.quantity - rand(0, 2)),
          estimatedCost: Number((wh.shippingCostWeight * l.quantity).toFixed(2)),
        })),
      });
    }

    // ~25% chance of a backorder
    if (Math.random() < 0.25 && physLines.length > 0) {
      const backLine = physLines[0];
      await prisma.backorderItem.create({
        data: {
          orderId:    order.id,
          productId:  backLine.productId,
          qtyPending: rand(1, 5),
          resolvedAt: Math.random() < 0.5 ? daysAgo(rand(1, 10)) : null,
        },
      });
    }

    orders.push(order);
  }
  console.log('  ✓ ' + orders.length + ' orders, splits & backorders');

  // ── 11. Subscriptions (20) ────────────────────────────────────────────────
  console.log('[seed-200] Creating 20 subscriptions…');
  if (plans.length > 0) {
    const subOrders = orders.slice(0, 20);
    for (const order of subOrders) {
      const plan = plans[rand(0, plans.length - 1)];
      await prisma.subscription.create({
        data: {
          orderId:       order.id,
          planId:        plan.id,
          quantity:      rand(1, 20),
          status:        pick(['ACTIVE', 'ACTIVE', 'ACTIVE', 'PAUSED', 'CANCELLED']),
          cycleStartDate: daysAgo(rand(1, 60)),
          nextBillDate:  daysAhead(rand(1, 30)),
        },
      });
    }
    console.log('  ✓ 20 subscriptions');
  } else {
    console.log('  ! No plans — skipping subscriptions');
  }

  // ── 12. Invoices (30) ─────────────────────────────────────────────────────
  console.log('[seed-200] Creating 30 invoices…');

  const invoiceOrders = orders.slice(0, 30);
  const invoices = [];
  for (const order of invoiceOrders) {
    const amount  = rand(500, 50000);
    const isPaid  = Math.random() < 0.45;
    const inv = await prisma.invoice.create({
      data: {
        orderId:   order.id,
        type:      'ONE_TIME',
        amount,
        status:    isPaid ? 'PAID' : 'UNPAID',
        dueDate:   daysAhead(rand(0, 45)),
        createdAt: daysAgo(rand(1, 60)),
      },
    });
    invoices.push({ ...inv, isPaid });
  }
  console.log('  ✓ 30 invoices');

  // ── 13. Payments (verified, for paid invoices) ────────────────────────────
  console.log('[seed-200] Creating payments for paid invoices…');
  const paidInvoices = invoices.filter(i => i.isPaid);
  for (const inv of paidInvoices) {
    await prisma.payment.create({
      data: {
        invoiceId:         inv.id,
        razorpayOrderId:   'order_demo_' + inv.id.slice(0, 8),
        razorpayPaymentId: 'pay_demo_'   + inv.id.slice(0, 8),
        razorpaySignature: 'sig_demo_'   + inv.id.slice(0, 8),
        amount:            inv.amount,
        status:            'VERIFIED',
        createdAt:         daysAgo(rand(1, 30)),
      },
    });
  }
  console.log('  ✓ ' + paidInvoices.length + ' payments');

  // ── 14. Deal health flags (15) ────────────────────────────────────────────
  console.log('[seed-200] Creating 15 deal health flags…');
  await prisma.dealHealthFlag.deleteMany({
    where: { quotationId: { in: quotations.map(q => q.id) } },
  });
  const flagQuotes = pickN(quotations, 15);
  for (const q of flagQuotes) {
    const type = pick(FLAG_TYPES);
    await prisma.dealHealthFlag.create({
      data: {
        quotationId: q.id,
        type,
        detail:      type === 'STALLED'
          ? `No activity for ${rand(48, 200)} hours (status: ${q.status})`
          : type === 'DISCOUNT_ANOMALY'
          ? `Discount ${rand(20, 40)}% significantly above rep average of ${rand(5, 12)}%`
          : `Order confirmed ${rand(15, 60)} days ago — shipment not confirmed`,
        resolved:    Math.random() < 0.3,
        createdAt:   daysAgo(rand(1, 30)),
      },
    });
  }
  console.log('  ✓ 15 deal health flags');

  // ── 15. Notifications (15) ────────────────────────────────────────────────
  console.log('[seed-200] Creating 15 notifications…');
  const notifTypes = ['APPROVAL_PENDING', 'QUOTATION_APPROVED', 'INVOICE_UNPAID', 'DEAL_HEALTH_FLAG', 'SUBSCRIPTION_MODIFIED'];
  const internalUsers = [admin, manager, finance, rep1, rep2];
  for (let i = 0; i < 15; i++) {
    await prisma.notification.create({
      data: {
        userId:    internalUsers[i % internalUsers.length].id,
        type:      pick(notifTypes),
        message:   `Notification ${i + 1}: ${pick(['Action required on quotation', 'Invoice is overdue', 'Deal flagged for review', 'Subscription modified', 'Approval needed'])}`,
        isRead:    Math.random() < 0.4,
        createdAt: daysAgo(rand(0, 14)),
      },
    });
  }
  console.log('  ✓ 15 notifications');

  // ── 16. Activity log (30 entries) ─────────────────────────────────────────
  console.log('[seed-200] Creating 30 activity log entries…');
  const logActions = [
    'QUOTATION_CREATED', 'QUOTATION_SUBMITTED', 'QUOTATION_APPROVED',
    'APPROVAL_APPROVED', 'APPROVAL_REJECTED', 'PRODUCT_CREATED',
    'PRODUCT_UPDATED', 'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_MODIFIED',
    'SUBSCRIPTION_CANCELLED', 'INVOICE_CREATED_ONE_TIME', 'PAYMENT_VERIFIED',
    'DEAL_STALLED_FLAGGED', 'RECURRING_INVOICE_CREATED', 'PORTAL_MESSAGE_SENT',
  ];
  for (let i = 0; i < 30; i++) {
    const action = logActions[i % logActions.length];
    const q      = quotations[i % quotations.length];
    await prisma.activityLog.create({
      data: {
        userId:     pick(internalUsers).id,
        action,
        entityType: action.startsWith('PRODUCT') ? 'Product' : action.startsWith('SUB') ? 'Subscription' : 'Quotation',
        entityId:   q.id,
        details:    { customer: customers[i % customers.length].companyName, index: i },
        createdAt:  daysAgo(rand(0, 60)),
      },
    });
  }
  console.log('  ✓ 30 activity log entries');

  // ── Summary ────────────────────────────────────────────────────────────────
  const total = 5 + 8 + 30 + 20 + 4 + plans.length + 20 + 60 + orders.length + 20 + 30 + paidInvoices.length + 15 + 15 + 30;

  console.log(`
╔══════════════════════════════════════════════════════════╗
║            200-Record Demo Seed Complete ✓               ║
╠══════════════════════════════════════════════════════════╣
║  Internal Users      5   (admin/manager/finance/rep×2)  ║
║  Product Categories  8                                   ║
║  Products           30   (with variants)                 ║
║  Price List Rules   ~40                                  ║
║  Upsell Rules       10                                   ║
║  Warehouses          4   (NY, LA, London, Singapore)     ║
║  Subscription Plans ${String(plans.length).padEnd(3)}                                  ║
║  Customers          20   (portal users created)          ║
║  Quotations         60   (all pipeline stages)           ║
║  Orders             ${String(orders.length).padEnd(3)}  (splits + backorders)          ║
║  Subscriptions      20                                   ║
║  Invoices           30   (${String(paidInvoices.length)} paid, ${String(30 - paidInvoices.length)} unpaid)            ║
║  Payments           ${String(paidInvoices.length).padEnd(3)}  (verified)                      ║
║  Deal Health Flags  15                                   ║
║  Notifications      15                                   ║
║  Activity Logs      30                                   ║
║  ─────────────────────────────────────────────────────  ║
║  Total records:    ~${String(total).padEnd(3)}                                 ║
╠══════════════════════════════════════════════════════════╣
║  Login credentials                                       ║
║  admin    admin@dealflow360.com    / Admin@1234           ║
║  manager  manager@dealflow360.com  / Manager@1234         ║
║  finance  finance@dealflow360.com  / Finance@1234         ║
║  rep1     rep1@dealflow360.com     / Rep@1234             ║
║  rep2     rep2@dealflow360.com     / Rep@1234             ║
╚══════════════════════════════════════════════════════════╝
`);
}

main()
  .catch(e => { console.error('[seed-200] Error:', e.message); console.error(e.stack); process.exit(1); })
  .finally(() => prisma.$disconnect());
