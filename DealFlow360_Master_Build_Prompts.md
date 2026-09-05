# DealFlow360 — Master Build Prompt Set (for Antigravity / Kiro)

**Stack:** React (Vite) + Node.js/Express + Prisma ORM + PostgreSQL + JWT auth + Socket.io (real-time) + Nodemailer/Gmail SMTP (email) + Razorpay (payment)
**Repo:** Monorepo — `/frontend`, `/backend`
**Team:** 2 developers, working in parallel tracks after a shared foundation phase
**Approved dependency list (keep to this — don't add packages beyond it without a real reason):**
`prisma`, `@prisma/client`, `bcrypt`, `jsonwebtoken`, `zod`, `socket.io` + `socket.io-client`,
`nodemailer`, `razorpay`, `pdfkit` (invoice PDFs, no external PDF service), `node-cron` (monthly
billing job), `helmet`, `express-rate-limit`, `cors`, on frontend: `react-router-dom`, `axios`,
`@tanstack/react-query`, `socket.io-client`, `tailwindcss`. No separate state manager, no UI
component library, no external cron/queue service, no third-party PDF/email API — everything
above runs on infrastructure you already control.

---

## HOW TO USE THIS DOCUMENT (2-developer workflow)

1. **Phase 0 is done together, in the same session, before splitting.** It creates the single
   Prisma schema both of you build against — this is the contract between the two tracks. Do not
   let either dev modify the schema unilaterally after Phase 0 without the other reviewing it
   (a schema change on one track can silently break the other's queries).
2. After Phase 0, **Dev 1 runs Track A** (the deal-building/approval engine) and **Dev 2 runs
   Track B** (fulfillment/billing/portal/payments) as separate Antigravity/Kiro sessions, each in
   its own git branch, merging into a shared branch after each phase pair completes.
3. Maintain a `/docs/api-contracts.md` file (create it in Phase 0) where each track lists the
   endpoint signatures and Socket.io event names it exposes, so the other track can integrate
   against it without reading all the code. Update it at the end of every phase.
4. Include the **Global Constraints** block with every phase prompt on both tracks — it's the
   shared business-rule contract. Include the relevant **Appendix C** wireframe entries with the
   phase that builds that screen.
5. Run the **Completion Checklist** after each phase before moving on. Run the full **Appendix D
   — Quick Test Flow** (from the problem statement) once both tracks merge at the Integration
   Phase — this is the real acceptance test, not any single phase's checklist.
6. **Comment requirement (applies to both devs, every phase):** every function that implements a
   business rule (discount ceiling check, blended risk score, warehouse split, proration,
   approval routing, portal credential generation) needs a short comment block above it stating
   the rule in plain English, plus inline comments at each branch explaining *why*, not just what.
   Code implementing these rules without that commentary should be treated as incomplete — this
   is for the other dev and for judges reading the code, not decoration.

---

## GLOBAL CONSTRAINTS (include with every phase prompt, both tracks)

```
GLOBAL CONSTRAINTS — DO NOT VIOLATE:

1. BLENDED DISCOUNT RISK SCORE — the core governance rule, must be enforced server-side on every
   quotation submit, never trusted from the frontend:

   a. Each product belongs to a category with its own max discount ceiling (set in Discount Tier &
      Approval Chain Setup). Each customer has a tier (Bronze/Silver/Gold) with its own overall
      ceiling.
   b. EFFECTIVE CEILING for a line = MIN(customer's tier ceiling, that line's category ceiling).
      This is the binding constraint — a Gold customer's 15% tier ceiling does NOT override a
      stricter 10% category ceiling on a Service line.
   c. POINTS OVER for a line = MAX(0, discountGiven - effectiveCeiling). Zero if within limit.
   d. BLENDED RISK SCORE for the whole quotation = SUM(points-over across all lines). A single
      badly-over line and many mildly-over lines both surface via this sum — neither can hide.
   e. Map the blended score to a required approval level using the configured approval chain
      ranges (e.g. score 0 = no approval; 0 < score <= threshold1 = Sales Manager only; score >
      threshold1 = Sales Manager then Finance). Thresholds are Admin-configurable, not hardcoded.
   f. Worked example to validate your implementation against (from the spec): Gold customer,
      Hardware ceiling 15%, Service ceiling 10%. Laptop line: 12% given, 15% allowed -> 0 points
      over. Setup Service line: 18% given, 10% allowed -> 8 points over. Blended score = 8 ->
      quotation is flagged for approval even though the customer's own tier ceiling (15%) was
      never breached — the category ceiling was. Your implementation must reproduce this exact
      result before you consider this rule done.
   g. Recompute the blended score any time lines, quantities, or discounts change — including when
      a customer counter-proposes a discount in the portal (see constraint 6).

2. APPROVAL CHAIN INTEGRITY:
   - A quotation with blended score > 0 (per the required level determined above) CANNOT move to
     Approved/Confirmed status via any endpoint except the approval action taken by a user with
     the correct role for the current pending step. The "Confirm and move to approval, or straight
     to fulfillment if no approval required" logic in the Quotation Builder must call the same
     server-side check — never let the frontend decide which path to take.
   - Approval steps run in order: Sales Manager first; Finance only runs if the configured chain
     requires it for that score range. Finance cannot approve before Sales Manager has.
   - "Return for Revision" sends the quotation back to Draft/rep-editable state, preserving the
     approval history — it is not the same as Reject (which is terminal for that quotation).
   - EVERY approval action (approve/reject/return) writes an audit_log row with user, timestamp,
     and a required reason field — never allow an approval action to submit without a reason.

3. WAREHOUSE AUTO-SPLIT LOGIC:
   - Given an order's line items, compute a fulfillment split across warehouses that (a) never
     assigns more quantity from a warehouse than its available (on-hand minus already-reserved)
     stock, and (b) minimizes the number of distinct warehouses/shipments used, using each
     warehouse's configured shipping-cost-weight to break ties when multiple splits are equally
     valid stock-wise (prefer the lower total weighted shipping cost).
   - If total available stock across all warehouses is less than the ordered quantity for a line,
     the shortfall becomes a BackorderItem — do not silently under-fulfill without recording it.
   - "Accept Suggested Split" commits the computed split (decrementing available stock,
     incrementing reserved). "Manual Override" lets Finance/Ops replace it with a different
     valid split before committing — validate the override against real stock the same way.
   - When stock for a backordered item arrives (stock level increases and would now cover the
     backorder), surface the "Consolidate Remaining Backorder" prompt on that order automatically
     — implement as a check run on stock-update events (Socket.io, see constraint 8), not a manual
     button the user has to remember to click.

4. HYBRID BILLING & PRORATION:
   - A single order can contain ONE_TIME lines and RECURRING lines together. One-time lines
     generate a single invoice at order confirmation. Recurring lines generate a billing schedule
     (per the plan's interval — monthly/quarterly/yearly) and are invoiced separately, on schedule,
     from a monthly job — never mixed into the one-time invoice.
   - Mid-cycle quantity or plan change on a recurring line triggers proration: charge/credit =
     (new value - old value) * (days remaining in current cycle / total days in cycle). Implement
     this as a pure, testable function — this is graded core logic, not a stub.
   - Cancelling a subscription mid-cycle triggers a partial refund or credit note per the
     configured cancellation rule (full refund of unused days, no refund, or credit note instead
     of cash refund — Admin-configurable per plan).

5. CUSTOMER PORTAL — SEPARATE RESTRICTED ROLE, NOT A RELABELED INTERNAL VIEW:
   - Portal users have role = CUSTOMER and can ONLY ever see quotations/orders/invoices tied to
     their own customer_id. Enforce this as a WHERE clause in every portal query, never as a
     frontend filter on data the API already returned in full.
   - AUTO-GENERATED PORTAL CREDENTIALS (created when a quotation is first sent to a customer, or
     when the customer record is created, whichever comes first):
       portalEmail = slugify(customerCompanyName) + '@dealflow360.com'
         (slugify: lowercase, strip everything except a-z0-9, e.g. "Acme Corp" -> "acmecorp")
         On collision (slug already used by another customer), append an incrementing number:
         "acmecorp2@dealflow360.com", etc. — never silently overwrite an existing account.
       portalPassword = Capitalize(customerCompanyName, no spaces) + '@deal123'
         (e.g. "Acme Corp" -> "AcmeCorp@deal123")
       Store only the bcrypt hash of this password — never store or log the plaintext outside the
       single email send in constraint 5b. Set a `mustChangePassword: true` flag on the account;
       this pattern is predictable by design for onboarding convenience, so the portal must force
       a password change on first login before showing any quotation data. Do not skip this —
       it's the mitigation for using a predictable initial password.
   - Send these generated credentials to the customer's REAL email (a separate `realEmail` field
     on the Customer record, distinct from the fake portal login address) via Nodemailer, once,
     at account creation. This email is the ONLY place the plaintext password is ever transmitted.
   - Customer portal negotiation actions (comment, counter-discount, confirm) write to the same
     Quotation/QuotationLine records the internal rep sees — this is a shared living document, not
     a separate customer-side copy that has to be reconciled later.

6. NEGOTIATION RE-APPROVAL:
   - When a customer submits a counter-discount request or a line-level change request that would
     alter the quotation's terms, recompute the blended risk score (constraint 1) against the
     proposed new terms. If the recomputed score now requires a level of approval the quotation
     hasn't already cleared, the quotation automatically re-enters the approval flow from the
     current approval step (constraint 2) — this must happen server-side on request submission,
     not as a manual "send back to approval" button the rep has to remember to press.
   - If the proposed terms don't cross a new approval threshold, the rep can accept/reject the
     customer's request directly without re-triggering approval.

7. INVOICING & PAYMENT (RAZORPAY):
   - One-time invoices are generated at order confirmation. Recurring invoices are generated by a
     node-cron job (run daily, check for subscriptions where nextBillDate <= today) — generate the
     invoice, a PDF via pdfkit, advance nextBillDate by the plan's interval, and EMAIL THE PDF TO
     THE CUSTOMER'S REAL EMAIL ADDRESS (realEmail field, NOT the generated portal credentials —
     these are two different addresses and must never be confused in the mailer call).
   - Payment via Razorpay: backend creates a Razorpay order server-side (never trust a
     client-supplied amount), frontend opens Razorpay checkout, and on completion the backend
     MUST verify the payment signature server-side (HMAC-SHA256 using the Razorpay secret) before
     marking any invoice as Paid — a client-side "success" callback alone is never sufficient.
     Also implement the Razorpay webhook endpoint as the source of truth for payment status, so a
     dropped client connection after payment doesn't leave an invoice incorrectly Unpaid.

8. REAL-TIME UPDATES (SOCKET.IO):
   - Maintain Socket.io rooms per quotation id, per user id, and per role (e.g. a
     `role:SALES_MANAGER` room every Sales Manager socket joins on connect) so events can be
     targeted without broadcasting everything to everyone.
   - Emit on: quotation status change, approval action taken, stock level change (feeds the
     backorder-consolidation check in constraint 3), new negotiation message/counter-offer,
     invoice paid, deal-health flag raised. Every screen showing live data (Dashboard, Approvals
     List, Fulfillment, Deal Health, Customer Portal negotiation) must update from these events,
     not from polling.

9. AUDIT TRAIL: every approval, rejection, edit, discount override, and negotiation action is
   logged with user, timestamp, and reason/detail — this is required across both tracks, not just
   the approval screens. Build one shared `logAudit()` helper in Phase 0 and reuse it everywhere.

10. NO PLACEHOLDER BUSINESS LOGIC: the blended risk score, warehouse split, proration, and
    portal credential generation are the graded core of this build. Implement them fully now —
    do not stub with TODOs and a hardcoded return value.
```

---

# PHASE 0 — Shared Foundation (both developers, together)

### Prompt for Antigravity/Kiro

```
Set up the DealFlow360 monorepo and the full data model both tracks will build against.

STRUCTURE:
/dealflow360
  /frontend    (React 18 + Vite + React Router v6 + TailwindCSS + Axios + React Query + socket.io-client)
  /backend     (Node.js + Express + Prisma + PostgreSQL + jsonwebtoken + bcrypt + zod + socket.io +
                nodemailer + razorpay + pdfkit + node-cron)
  /docs        (this build prompt set, api-contracts.md, architecture diagram source)

BACKEND FOLDER STRUCTURE:
  /backend/prisma/schema.prisma   (see SCHEMA below)
  /backend/src/config             (env loader, prisma client singleton, socket.io init, mailer init)
  /backend/src/middleware         (auth.js, rbac.js, errorHandler.js)
  /backend/src/modules            (one folder per domain, controller/service/routes.js each —
     auth, customers, products, categories, priceLists, discountConfig, quotations, approvals,
     upsell, warehouses, fulfillment, subscriptions, billing, invoices, payments, portal,
     dealHealth, reports, notifications, activityLogs)
  /backend/src/realtime            (socket.io room management, event emitter helpers)
  /backend/src/jobs                (node-cron: monthly billing job, stalled-deal detection job)
  /backend/src/utils               (logAudit helper, slugify helper, blendedRiskScore calculator
                                     — implement this as its own pure module so it's independently
                                     testable, proration calculator, response wrapper)

PRISMA SCHEMA (full schema up front — both tracks depend on this, get it right now):

```prisma
model User {
  id            String   @id @default(uuid())
  name          String
  email         String   @unique
  passwordHash  String
  role          Role     @default(SALES_REP)
  mustChangePassword Boolean @default(false)
  customerId    String?  // set only when role = CUSTOMER, links portal user to their Customer
  customer      Customer? @relation(fields: [customerId], references: [id])
  createdAt     DateTime @default(now())
}
enum Role { ADMIN SALES_REP SALES_MANAGER FINANCE CUSTOMER }

model Customer {
  id            String   @id @default(uuid())
  companyName   String
  tier          Tier     @default(BRONZE)
  realEmail     String   // real inbox — invoices and initial credentials go here, NEVER the portal login
  portalUser    User?
  quotations    Quotation[]
  createdAt     DateTime @default(now())
}
enum Tier { BRONZE SILVER GOLD }

model ProductCategory {
  id                 String   @id @default(uuid())
  name               String   @unique
  maxDiscountPercent Decimal
  products           Product[]
}

model Product {
  id             String   @id @default(uuid())
  name           String
  categoryId     String
  category       ProductCategory @relation(fields: [categoryId], references: [id])
  price          Decimal
  unit           String
  taxPercent     Decimal
  description    String?
  isSubscription Boolean  @default(false)
  variants       ProductVariant[]
  createdAt      DateTime @default(now())
}

model ProductVariant {
  id            String  @id @default(uuid())
  productId     String
  product       Product @relation(fields: [productId], references: [id])
  attributeName String  // e.g. "RAM", "Color"
  value         String  // e.g. "16GB", "Black"
  extraPrice    Decimal @default(0)
}

model PriceListRule {
  id         String   @id @default(uuid())
  tier       Tier
  currency   String   @default("USD")
  ruleType   String   // "FIXED" | "PERCENT_OFF_BASE"
  value      Decimal
  productId  String?  // null = applies to all products for that tier
}

model TierDiscountCeiling {
  id                 String  @id @default(uuid())
  tier               Tier    @unique
  maxDiscountPercent Decimal
}

model ApprovalChainRule {
  id              String  @id @default(uuid())
  minScore        Decimal
  maxScore        Decimal? // null = no upper bound
  requiredLevel   String   // "NONE" | "SALES_MANAGER" | "SALES_MANAGER_THEN_FINANCE"
}

model Warehouse {
  id                 String  @id @default(uuid())
  name               String
  location           String?
  shippingCostWeight Decimal @default(1)
  stockLevels        StockLevel[]
}

model StockLevel {
  id          String    @id @default(uuid())
  warehouseId String
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id])
  productId   String
  product     Product   @relation(fields: [productId], references: [id])
  onHand      Int
  reserved    Int       @default(0)
  reorderPoint Int      @default(0)
  reorderQty   Int      @default(0)
  @@unique([warehouseId, productId])
}

model SubscriptionPlan {
  id              String   @id @default(uuid())
  name            String
  productId       String
  interval        String   // "MONTHLY" | "QUARTERLY" | "YEARLY"
  prorationRule   String   @default("DAILY_PRORATE")
  cancellationRule String  @default("REFUND_UNUSED_DAYS") // or "NO_REFUND" | "CREDIT_NOTE"
}

model UpsellRule {
  id                 String  @id @default(uuid())
  primaryProductId   String
  suggestedProductId String
  minMarginPercent   Decimal
  isPromoted         Boolean @default(false)
}

model Quotation {
  id               String   @id @default(uuid())
  customerId       String
  customer         Customer @relation(fields: [customerId], references: [id])
  repId            String
  status           String   @default("DRAFT")
  // DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | UNDER_NEGOTIATION | CONFIRMED |
  // FULFILLMENT | INVOICED | CLOSED
  blendedRiskScore Decimal  @default(0)
  lines            QuotationLine[]
  approvalSteps    ApprovalStep[]
  negotiationMessages NegotiationMessage[]
  lastActivityAt   DateTime @default(now())
  createdAt        DateTime @default(now())
}

model QuotationLine {
  id                String    @id @default(uuid())
  quotationId       String
  quotation         Quotation @relation(fields: [quotationId], references: [id])
  productId         String
  quantity          Int
  unitPrice         Decimal
  discountPercent   Decimal   @default(0)
  lineType          String    // "ONE_TIME" | "RECURRING"
  subscriptionPlanId String?
  effectiveCeilingSnapshot Decimal // computed MIN(tier,category) at time of entry, for audit
  pointsOverSnapshot       Decimal @default(0)
}

model ApprovalStep {
  id          String    @id @default(uuid())
  quotationId String
  quotation   Quotation @relation(fields: [quotationId], references: [id])
  level       String    // "SALES_MANAGER" | "FINANCE"
  status      String    @default("PENDING") // PENDING | APPROVED | REJECTED | RETURNED
  actedById   String?
  actedAt     DateTime?
  reason      String?
  order       Int       // sequence within the chain
}

model NegotiationMessage {
  id          String    @id @default(uuid())
  quotationId String
  quotation   Quotation @relation(fields: [quotationId], references: [id])
  senderType  String    // "CUSTOMER" | "REP"
  message     String
  lineId      String?   // optional line-level comment reference
  createdAt   DateTime  @default(now())
}

model Order {
  id           String   @id @default(uuid())
  quotationId  String   @unique
  status       String   @default("PENDING_FULFILLMENT")
  confirmedAt  DateTime @default(now())
}

model FulfillmentSplit {
  id             String  @id @default(uuid())
  orderId        String
  warehouseId    String
  productId      String
  qtyFulfilled   Int
  estimatedCost  Decimal
}

model BackorderItem {
  id          String   @id @default(uuid())
  orderId     String
  productId   String
  qtyPending  Int
  resolvedAt  DateTime?
}

model Subscription {
  id              String   @id @default(uuid())
  orderId         String
  planId          String
  quantity        Int
  status          String   @default("ACTIVE") // ACTIVE | PAUSED | CANCELLED
  nextBillDate    DateTime
  cycleStartDate  DateTime
}

model Invoice {
  id             String   @id @default(uuid())
  orderId        String?
  subscriptionId String?
  type           String   // "ONE_TIME" | "RECURRING"
  amount         Decimal
  status         String   @default("UNPAID") // UNPAID | PAID | PARTIAL
  dueDate        DateTime
  pdfPath        String?
  createdAt      DateTime @default(now())
}

model Payment {
  id                String   @id @default(uuid())
  invoiceId         String
  razorpayOrderId   String
  razorpayPaymentId String?
  razorpaySignature String?
  amount            Decimal
  status            String   @default("CREATED") // CREATED | VERIFIED | FAILED
  createdAt         DateTime @default(now())
}

model CreditNote {
  id             String   @id @default(uuid())
  subscriptionId String
  amount         Decimal
  reason         String
  createdAt      DateTime @default(now())
}

model DealHealthFlag {
  id          String   @id @default(uuid())
  quotationId String
  type        String   // "STALLED" | "DISCOUNT_ANOMALY" | "DELIVERY_SLIPPAGE"
  detail      String
  resolved    Boolean  @default(false)
  createdAt   DateTime @default(now())
}

model Notification {
  id         String   @id @default(uuid())
  userId     String
  type       String
  message    String
  relatedId  String?
  isRead     Boolean  @default(false)
  createdAt  DateTime @default(now())
}

model ActivityLog {
  id         String   @id @default(uuid())
  userId     String?
  action     String
  entityType String
  entityId   String
  details    Json?
  createdAt  DateTime @default(now())
}
```

AUTH + RBAC:
- POST /api/auth/signup (internal roles only — Admin/Sales Rep/Sales Manager/Finance; CUSTOMER
  role is NEVER created via this endpoint, only via the auto-generation flow in a later phase)
- POST /api/auth/login — checks mustChangePassword flag, forces a change-password step for
  first-time portal customers before issuing a normal session token
- requireAuth + requireRole(...roles) middleware, same pattern as any standard JWT RBAC setup
- CUSTOMER-role JWTs must additionally carry the customer_id, and every portal route must filter
  by it

SOCKET.IO SETUP:
- On connection, authenticate the socket via the JWT (same token as REST), join the user to
  rooms: `user:{userId}`, `role:{role}`, and (for CUSTOMER) `customer:{customerId}`
- Export a small `emitToRoom(room, event, payload)` helper other modules will import — don't let
  each module talk to the raw io instance directly

MAILER SETUP:
- Nodemailer transport configured from env vars (GMAIL_USER, GMAIL_APP_PASSWORD)
- Export sendMail({ to, subject, html, attachments }) — a single reusable function; module-specific
  templates live in each module, not duplicated transport logic

DELIVERABLE: `npx prisma migrate dev` runs clean, seed script creates one Admin user, both dev
servers boot, Socket.io connection authenticates successfully from a test client, a test email
sends via the mailer helper. Create /docs/api-contracts.md with a header explaining its purpose
for both devs to append to.
```

### Completion Checklist
- [ ] Prisma migration applies cleanly, schema matches above exactly (both devs reviewed it)
- [ ] JWT auth works for all 4 internal roles; CUSTOMER role cannot be created via signup
- [ ] Socket.io authenticates a connection and joins the expected rooms (test manually)
- [ ] A test email sends successfully via the Gmail SMTP transport
- [ ] `/docs/api-contracts.md` exists and both devs know to update it

---

# TRACK A (Dev 1) — The Deal Engine

## A-PHASE 1 — Backend Configuration: Products, Pricing, Discount Tiers, Approval Chains

### Prompt for Antigravity/Kiro

```
[Include GLOBAL CONSTRAINTS block]
[Include APPENDIX C — Wireframe Reference, Screens 16, 17, 18]

Build the Admin configuration modules: products, categories, price lists, discount tiers, and
approval chain rules.

BACKEND — modules: products, categories, priceLists, discountConfig
- CRUD for ProductCategory (name, maxDiscountPercent) — Admin only
- CRUD for Product (general info + variants sub-array) — Admin only; variant extra prices add to
  base price when selected on a quotation line
- CRUD for PriceListRule (tier + currency + rule type/value, optional product-specific override)
- CRUD for TierDiscountCeiling (one row per tier, Admin sets Bronze/Silver/Gold ceilings)
- CRUD for ApprovalChainRule (score ranges -> required level) — validate ranges don't overlap and
  don't leave gaps; the blended score in A-Phase 2 depends on this table being well-formed
- Build and unit-test the blendedRiskScoreCalculator utility here (per GLOBAL CONSTRAINT 1) even
  though quotations don't exist as a screen yet — write it against the worked example in the
  constraints block and confirm it returns exactly 8 for that scenario before moving to A-Phase 2

FRONTEND (per APPENDIX C wireframe):
- Screen 16 Product Dashboard: product catalog table + KPI-style summary cards (Total Products,
  Pricelists, Variants), "+ New Product" and "Manage Price fields" actions
- Screen 17 Product Detail: general info form, subscription yes/no toggle (reveals recurring
  interval picker when yes), variant table (attribute/values/extra price, repeatable rows),
  price-list table per tier/currency
- Screen 18 Discount Tiers & Approval Chains: tier ceiling table (Bronze/Silver/Gold + max %),
  category ceiling table, and a separate discount-range -> approval-level table (matches the
  "Within tier/category limit -> No approval needed / Over limit,blended risk medium -> Sales
  manager / Over limit,blended risk high -> Sales manager then finance" structure from the
  wireframe) with a "Save configuration" action and the footnote text: "When a quote mixes
  categories with different ceilings, the system must compute a blended risk score and route to
  the highest required level. All approvals, rejections, and edits must be logged with user,
  timestamp, and reason."
```

### Completion Checklist
- [ ] `blendedRiskScoreCalculator` returns exactly 8 for the worked example in Global Constraints
- [ ] Overlapping/gapped approval chain ranges are rejected at save time with a clear error
- [ ] Variant extra prices correctly add to a product's displayed price

## A-PHASE 2 — Quotation Builder + Live Margin + Auto-Routing

### Prompt for Antigravity/Kiro

```
[Include GLOBAL CONSTRAINTS block]
[Include APPENDIX C — Wireframe Reference, Screens 3, 4]

Build quotation creation/editing and the auto-routing decision.

BACKEND — module: quotations
- POST /api/quotations (draft creation, customer + rep)
- POST /api/quotations/:id/lines — add/edit a line (product, qty, discount%, lineType). On every
  line change, recompute effectiveCeilingSnapshot and pointsOverSnapshot per GLOBAL CONSTRAINT 1
  and persist them on the line (for audit/history, not just live display)
- GET /api/quotations/:id — return lines + live-computed blendedRiskScore + margin per line
  (margin = unitPrice*(1-discount%) - cost; if you don't have a cost field, treat margin as
  price-after-discount minus a configurable default cost ratio, documented clearly in a comment)
- POST /api/quotations/:id/submit — THIS is where GLOBAL CONSTRAINT 2 is enforced: compute the
  blended score, look up the required approval level from ApprovalChainRule, and either:
    (a) required level = NONE -> status jumps straight to CONFIRMED, handoff to Track B's
        fulfillment split logic (emit an event/webhook Track B's module will listen for — document
        this handoff in api-contracts.md)
    (b) required level = SALES_MANAGER or SALES_MANAGER_THEN_FINANCE -> create the ApprovalStep
        row(s) in order, status -> PENDING_APPROVAL
  Never let the frontend pick which path — this endpoint decides based on the server-computed
  score alone.
- PATCH /api/quotations/:id/save-draft

FRONTEND (per APPENDIX C wireframe):
- Screen 3 Quotations List: card-per-quotation view grouped by stage (Draft / Pending Approval /
  Approved / Negotiation / Confirmed), "+ New Quotation" and a table-view toggle
- Screen 4 Quotation Detail/Builder: customer + price-list selector at top, product line table
  (Product / Qty / Price / Discount / Limit / Status — Status shows OK or OVER per line using the
  pointsOverSnapshot), a banner exactly like the wireframe's when any line is over: "Discount is
  checked against line's own limit here, as soon as it is entered, not only at submit time" (i.e.
  compute and show OVER/OK live as the rep types, don't wait for submit), "Save Draft" and
  "Submit for Approval" buttons
```

### Completion Checklist
- [ ] Submitting the exact worked example quotation (Laptop 12%/Setup Service 18%) routes to approval, not straight to Confirmed
- [ ] A quotation with all lines within their effective ceilings routes straight to Confirmed with no approval steps created
- [ ] OVER/OK status on each line updates live as discount % is typed, before submit

## A-PHASE 3 — Approval Workflow

### Prompt for Antigravity/Kiro

```
[Include GLOBAL CONSTRAINTS block]
[Include APPENDIX C — Wireframe Reference, Screens 5, 6]

BACKEND — module: approvals
- GET /api/approvals?status=pending — scoped to the requesting user's role (Sales Manager sees
  SALES_MANAGER-level pending steps, Finance sees FINANCE-level pending steps)
- PATCH /api/approvals/:stepId/approve — requires `reason` in body (optional but stored), advances
  to the next step if the chain requires Finance next, otherwise marks quotation CONFIRMED and
  fires the same fulfillment handoff event as A-Phase 2's auto-approved path
- PATCH /api/approvals/:stepId/reject — requires `reason`, quotation status -> REJECTED (terminal)
- PATCH /api/approvals/:stepId/return — requires `reason`, quotation status -> DRAFT, rep can edit
  and resubmit (creates a fresh submit -> re-scored -> possibly different approval path)
- Every action here calls logAudit() with user/timestamp/reason — no exceptions

FRONTEND (per APPENDIX C wireframe):
- Screen 5 Approvals List: filterable by Pending/Returned/Approved counts shown as badges, table
  columns Quotation / Customer / Blended Risk / Stage / Assigned To, "Filter: Pending Only" toggle
- Screen 6 Approval Detail: blended risk badge + customer tier badge at top, a "Why This Quote Was
  Flagged" table (Line / Discount Given / Limit Allowed / Over By — this is literally the
  per-line breakdown from GLOBAL CONSTRAINT 1, rendered for the approver to see exactly why),
  a horizontal step tracker (Submitted -> Sales Manager -> Finance -> Confirmed) with the current
  step highlighted, an audit trail table below it (User / Action / Date / Note), and
  Approve / Return for Revision / Reject buttons that require the reason field before submitting
```

### Completion Checklist
- [ ] Finance step cannot be actioned while the Sales Manager step is still Pending
- [ ] "Why This Quote Was Flagged" table matches the same per-line numbers computed in A-Phase 2, exactly
- [ ] Every approve/reject/return produces one audit_log row with a non-empty reason

## A-PHASE 4 — Upsell / Cross-Sell Panel

### Prompt for Antigravity/Kiro

```
[Include GLOBAL CONSTRAINTS block]
[Include APPENDIX C — Wireframe Reference, Screen 4 (upsell panel section)]

BACKEND — module: upsell
- CRUD for UpsellRule (Admin) — primary product, suggested product, min margin threshold,
  isPromoted flag
- GET /api/quotations/:id/upsell-suggestions — given the current lines on the quotation, return
  ranked suggestions: matching UpsellRule rows where the suggested product's margin clears
  minMarginPercent, promoted items ranked above non-promoted, each with a computed marginDelta
  if added (use the same margin logic from A-Phase 2)

FRONTEND:
- Upsell panel alongside the Quotation Builder cart (per wireframe Screen 4): ranked suggestion
  cards (Product name, margin delta, promotion tag if applicable), "Add to Quote" (adds a line,
  triggers ceiling/score recompute from A-Phase 2 immediately) and "Dismiss" buttons. Confirm the
  margin indicator on the main quote view updates the instant a suggestion is added — this must
  go through the same recompute path as any manually added line, not a separate shortcut.
```

### Completion Checklist
- [ ] Adding an upsell suggestion triggers the same blended-score recompute as a manual line add
- [ ] Suggestions below the configured margin threshold never appear in the ranked list

---

# TRACK B (Dev 2) — Fulfillment, Billing, Portal & Payments

## B-PHASE 1 — Warehouse Setup + Auto-Split + Backorders

### Prompt for Antigravity/Kiro

```
[Include GLOBAL CONSTRAINTS block]
[Include APPENDIX C — Wireframe Reference, Screens 7, 8]

BACKEND — module: warehouses, fulfillment
- CRUD for Warehouse (name, location, shippingCostWeight) — Admin
- CRUD for StockLevel (per warehouse+product: onHand, reserved, reorderPoint, reorderQty)
- Listen for the fulfillment-handoff event from Track A (order confirmed, no approval needed OR
  approval cleared) — document the event/webhook shape in api-contracts.md and coordinate the
  exact payload with Dev 1
- Implement the auto-split algorithm per GLOBAL CONSTRAINT 3 as its own pure, testable function:
  input = order lines (productId, qty), warehouse stock snapshot; output = a list of
  {warehouseId, productId, qty} splits plus any backorder remainder. Write it to prefer fewer
  distinct warehouses first, then lowest weighted shipping cost among equally-good options.
- POST /api/fulfillment/:orderId/accept-split — commits the computed split, decrements onHand/
  increments reserved per warehouse
- POST /api/fulfillment/:orderId/override — Finance/Ops submits a manual split, validated against
  real stock the same way as the auto path
- On any StockLevel update, check open BackorderItems for that product; if now coverable, emit a
  Socket.io event so the frontend can show "Consolidate Remaining Backorder" (GLOBAL CONSTRAINT 3)

FRONTEND (per APPENDIX C wireframe):
- Screen 7 Fulfillment List: per-warehouse live stock table (Warehouse/Product/In Stock/Reserved/
  Available), "Orders Awaiting Fulfillment" table (Order/Customer/Status/Warehouse — Status shows
  "Split Pending" or "Backorder")
- Screen 8 Fulfillment Detail: per-order split table (Warehouse/Qty Fulfilled/Est. Shipments/Cost),
  the auto-surfaced "Consolidate Remaining Backorder" banner (real-time, per Global Constraint 3 —
  not a manual refresh), "Accept Suggested Split" and "Manual Override" buttons
```

### Completion Checklist
- [ ] Auto-split never allocates more than a warehouse's available (onHand - reserved) stock
- [ ] An order needing more stock than exists anywhere creates a BackorderItem instead of silently under-fulfilling
- [ ] Restocking a backordered product's warehouse triggers the consolidation banner live, without a page refresh

## B-PHASE 2 — Subscription Plans + Hybrid Billing + Proration

### Prompt for Antigravity/Kiro

```
[Include GLOBAL CONSTRAINTS block]
[Include APPENDIX C — Wireframe Reference, Screens 9, 10]

BACKEND — module: subscriptions, billing
- CRUD for SubscriptionPlan (Admin) — interval, prorationRule, cancellationRule
- On order confirmation with RECURRING lines, create Subscription rows (one per recurring line),
  nextBillDate computed from interval
- Implement the proration calculator per GLOBAL CONSTRAINT 4 as its own pure, testable function:
  (newValue - oldValue) * (daysRemainingInCycle / totalDaysInCycle) — write test cases for a
  mid-month quantity increase and a mid-month decrease before wiring it to an endpoint
- PATCH /api/subscriptions/:id/modify — quantity or plan change, triggers proration, creates an
  adjustment line on the next invoice (or an immediate one, your call — document which in
  api-contracts.md)
- PATCH /api/subscriptions/:id/cancel — applies the plan's cancellationRule: full refund of unused
  days (creates a Payment refund record), no refund, or a CreditNote row — never guess, always
  read the plan's configured rule

FRONTEND (per APPENDIX C wireframe):
- Screen 9 Subscriptions List: table (Customer/Plan/Cycle/Next Bill/Status) with Active/Paused/
  Cancelled count badges, "+ New Plan (Admin)" action
- Screen 10 Billing Detail: one-time lines table and recurring lines table shown SEPARATELY within
  the same order view (per the wireframe's explicit separation), "Modify Subscription" and
  "Cancel Subscription" actions
```

### Completion Checklist
- [ ] Proration function produces correct amounts for both a mid-cycle increase and decrease, tested with concrete numbers
- [ ] Cancelling a subscription correctly branches to refund vs credit-note vs no-refund based on the plan's configured rule
- [ ] One-time and recurring lines never merge onto the same invoice

## B-PHASE 3 — Customer Portal: Credentials, Negotiation, Re-Approval Trigger

### Prompt for Antigravity/Kiro

```
[Include GLOBAL CONSTRAINTS block]
[Include APPENDIX C — Wireframe Reference, Screen 11]

BACKEND — module: portal
- Implement portal account auto-creation per GLOBAL CONSTRAINT 5 exactly as specified: slugify
  helper, collision handling, bcrypt-hashed password, mustChangePassword flag, and the one-time
  email to the customer's realEmail containing the generated portalEmail + plaintext password —
  write this as its own function (`provisionPortalAccount(customer)`) with a comment block quoting
  the exact format rule, since this is a security-sensitive piece of business logic
- POST /api/portal/auth/change-password — forced first-login flow, clears mustChangePassword
- GET /api/portal/quotations/:id — CUSTOMER-role only, filtered by req.user.customerId, never by
  a client-supplied customer id
- POST /api/portal/quotations/:id/messages — line-level comment or general comment
  (NegotiationMessage, senderType CUSTOMER)
- POST /api/portal/quotations/:id/counter-discount — proposed new discount%, recompute blended
  score per GLOBAL CONSTRAINT 6; if it crosses a new approval threshold, re-enter the approval
  flow (reuse Track A's ApprovalStep creation logic — check api-contracts.md for the exact
  function signature Dev 1 exposes, don't reimplement the routing decision here)
- POST /api/portal/quotations/:id/confirm — customer one-click confirm; if terms are within
  already-cleared limits, hand off to Track B's fulfillment split (same event as internal
  confirm); otherwise blocked pending the re-triggered approval

FRONTEND (per APPENDIX C wireframe):
- Screen 11 Customer Portal Negotiation: status pill (Sent/Under Negotiation/Confirmed) at top,
  line-level comment thread, "Override Discount %" and "Requested Delivery Date" fields, "Submit
  Request" and "Confirm Quotation" buttons, and the footnote made real via Socket.io: "If final
  terms exceed thresholds, the quote automatically re-enters approval" — this screen should
  reflect that transition live if the rep/approver is also watching, not just on customer's next
  refresh
- This screen must be a genuinely separate, role-restricted route (e.g. /portal/*) with its own
  layout — not the internal workspace with a few buttons hidden per GLOBAL CONSTRAINT 5
```

### Completion Checklist
- [ ] Provisioning a new customer sends exactly one email, to realEmail, containing a portalEmail that matches the slugify+collision spec and a password matching the CompanyName@deal123 pattern
- [ ] A customer cannot fetch another customer's quotation by guessing/changing an ID in the URL
- [ ] A counter-discount that crosses a new approval threshold correctly re-creates ApprovalStep rows and is visible live on the internal Approvals List without a refresh

## B-PHASE 4 — Invoicing, Razorpay Payments, Deal Health, Reporting, Real-Time Wiring

### Prompt for Antigravity/Kiro

```
[Include GLOBAL CONSTRAINTS block]
[Include APPENDIX C — Wireframe Reference, Screens 2, 12, 13, 14, 15]

BACKEND — modules: invoices, payments, dealHealth, reports, notifications (+ jobs/)
- One-time invoice generated at order confirmation; PDF via pdfkit
- node-cron job (daily) per GLOBAL CONSTRAINT 7: find subscriptions with nextBillDate <= today,
  generate invoice + PDF, advance nextBillDate, EMAIL THE PDF TO customer.realEmail (never the
  portal address) — write the query and the mailer call with a comment reiterating this distinction,
  it's the single easiest thing to get backwards in this codebase
- POST /api/payments/create-order — creates a Razorpay order server-side for a given invoice
  amount (never accept amount from the client)
- POST /api/payments/verify — verifies the Razorpay signature server-side (HMAC-SHA256), marks
  Payment VERIFIED and Invoice PAID only after verification passes
- POST /api/payments/webhook — Razorpay webhook endpoint as the source-of-truth fallback per
  GLOBAL CONSTRAINT 7, idempotent (a webhook firing twice must not double-process)
- node-cron job (daily) for stalled-deal detection: quotations with lastActivityAt older than a
  configurable threshold -> create a DealHealthFlag (STALLED); also implement discount-anomaly
  detection (a rep's discount on a deal significantly above their own historical average discount)
  and delivery-slippage flags (fulfillment past its estimated date) — all write to DealHealthFlag
  and emit a Socket.io event to the relevant role room
- GET /api/reports/... — quotations/orders filtered by period, sales rep/team, approval status,
  product/category; PDF/XLS export endpoints (build XLS export with a lightweight in-house CSV/XLS
  writer, not a paid service)

FRONTEND (per APPENDIX C wireframe):
- Screen 2 Sales Dashboard: Pending Approvals / Open Quotations / At Risk Deals summary cards,
  "+ New Quotation" and "View Approvals" actions, Recent Activity feed (live via Socket.io)
- Screen 12 Invoices List + Screen 13 Invoice Detail: invoice table with Unpaid/Paid count badges,
  detail view with a status stepper (Order Confirmed -> Shipped -> Invoiced -> Paid), "Record
  Payment" (opens Razorpay checkout) and "Download Summary" actions
- Screen 14 Deal Health Dashboard: Stalled Deals / Discount Anomalies / Delivery Slippage cards,
  a flagged-deals table (Deal/Issue/Flagged/Action) with "Escalate" and "Nudge Rep" buttons that
  fire a Notification + Socket.io event to the rep
- Screen 15 Admin/Reporting: filter row (Period/Sales Team/Approval Status/Product), summary cards
  (Quotes Created/Avg Approval Time/Top Upsold Product), "Export PDF"/"Export XLS" buttons
```

### Completion Checklist
- [ ] A recurring invoice email goes to the customer's real email address, verified by checking the mailer call arguments in a test, not just eyeballing the UI
- [ ] A Razorpay payment cannot mark an invoice Paid without server-side signature verification succeeding
- [ ] Webhook double-fire does not double-mark or double-refund a payment
- [ ] Deal Health flags appear on the dashboard in real time when the underlying condition is met, without a manual refresh

---

# INTEGRATION PHASE (both developers, together)

### Prompt for Antigravity/Kiro

```
Merge Track A and Track B into a single working application and run the full end-to-end flow.

1. Merge branches; resolve any schema drift against the Phase 0 baseline first — do not let either
   track's local schema changes silently overwrite the other's.
2. Wire the fulfillment-handoff event/webhook from Track A's quotation-confirm/approval-approve
   paths into Track B's fulfillment module exactly as documented in api-contracts.md — this is the
   single most likely integration gap, test it explicitly.
3. Wire Track B's re-approval trigger (portal counter-discount) into Track A's ApprovalStep
   creation logic — same caution as above.
4. Run every check in APPENDIX D — QUICK TEST FLOW below, in order, and confirm each step produces
   the described visible result before moving to the next.
5. Cross-role data-leak pass: confirm a Sales Rep cannot see another rep's quotations if that's
   intended scoping, a Customer cannot see any other customer's data, and Finance-only endpoints
   reject Sales Manager tokens.
6. Prepare the architecture diagram and "what we'd build next" note required by the Deliverables
   section of the problem statement.
```

### Completion Checklist
- [ ] All 8 steps of Appendix D pass in a single continuous run using seed data
- [ ] No cross-customer or cross-role data leak found in manual testing
- [ ] Architecture diagram and next-steps note are ready for the demo

---

## APPENDIX A — Permission Matrix

| Action | Admin | Sales Rep | Sales Manager | Finance | Customer |
|---|---|---|---|---|---|
| Configure products/pricing/discount tiers/approval chains | ✅ | ❌ | ❌ | ❌ | ❌ |
| Build/edit quotation | ✅ | ✅ | ✅ (own team) | ❌ | ❌ |
| Submit quotation for approval | ✅ | ✅ | ✅ | ❌ | ❌ |
| Approve/reject at Sales Manager level | ✅ | ❌ | ✅ | ❌ | ❌ |
| Approve/reject at Finance level | ✅ | ❌ | ❌ | ✅ | ❌ |
| Accept/override warehouse split | ✅ | ❌ | ❌ | ✅ | ❌ |
| Modify/cancel subscription | ✅ | ✅ | ✅ | ✅ | ❌ (request only, via portal) |
| View/negotiate own quotation | ❌ | — | — | — | ✅ (own only) |
| Record payment | ✅ | ✅ | ✅ | ✅ | ✅ (own invoice, via Razorpay) |
| View Deal Health dashboard | ✅ | ❌ | ✅ | ✅ | ❌ |
| View org-wide reports | ✅ | ❌ (own only) | ✅ (team) | ✅ | ❌ |

## APPENDIX B — Blended Risk Score, Quick Reference

```
effectiveCeiling(line) = MIN(customerTierCeiling, line.categoryCeiling)
pointsOver(line)       = MAX(0, line.discountGiven - effectiveCeiling(line))
blendedScore(quote)    = SUM(pointsOver(line) for line in quote.lines)

blendedScore -> requiredApprovalLevel via Admin-configured ApprovalChainRule ranges.

Reference case: Gold customer, Hardware ceiling 15%, Service ceiling 10%.
  Laptop (Hardware): 12% given -> effectiveCeiling 15% -> pointsOver 0
  Setup Service:     18% given -> effectiveCeiling 10% -> pointsOver 8
  blendedScore = 8 -> quotation flagged for approval
```

## APPENDIX C — Wireframe Reference (from the team's Excalidraw mockup)

Apply these exact screens, field labels, and table columns — this is the approved layout, don't
improvise different structure where the wireframe already specifies one.

**Top nav (internal workspace, all screens):** Dashboard / Quotations / Approvals / Fulfillment /
Subscriptions / Invoices / Deal Health / Reports / Product — plus a "My Quotation / Messages /
Profile" tab that opens the separate Customer Portal.

**Screen 1 — Login/Signup:** Log In / Sign Up tabs, email + password fields, "Forgot Password?"
link, footnote: "After login, internal users land on the Sales Dashboard. Customers land on their
Quotation Portal." Sub-notes: company/team selector for multi-team setups, basic email/password
validation, "Sign-Up link creates a new internal or customer account" (internal signup only —
customer accounts are always auto-provisioned, never self-signed-up, per Global Constraint 5).

**Screen 2 — Sales Dashboard/Home:** Three summary cards (Pending Approvals / Open Quotations /
At Risk Deals), "+ New Quotation" and "View Approvals" actions, a "Recent Activity" feed below
(e.g. "Acme Corp quotation approved by Finance", "Beta Industries requested a discount change",
"East Depot stock updated for Order #2291").

**Screen 3 — Quotations List:** Quotations as cards grouped by stage column (Draft / Pending
Approval / Approved / Negotiation / Confirmed), each card showing customer + amount, "+ New
Quotation" and "Switch to Table View".

**Screen 4 — Quotation Detail (Builder):** Customer + price-list selector at top, line table
(Product / Qty / Price / Discount / Limit / Status), footnote text: "Discount is checked against
line's own limit here, as soon as it is entered, not only at submit time", an Upsell and
Cross-Sell Suggestions panel below/beside the cart (product, margin delta, promo tag, Add/Dismiss),
"Save Draft" and "Submit for Approval" buttons.

**Screen 5 — Approvals List:** Count badges (Pending / Returned / Approved), table (Quotation /
Customer / Blended Risk / Stage / Assigned To), "Filter: Pending Only" toggle.

**Screen 6 — Approval Detail:** Blended Risk badge + Customer Tier badge at top, "Why This Quote
Was Flagged" table (Line / Discount Given / Limit Allowed / Over By), horizontal step tracker
(Submitted -> Sales Manager -> Finance -> Confirmed), audit trail table (User / Action / Date /
Note), Approve / Return for Revision / Reject buttons.

**Screen 7 — Fulfillment List:** Live per-warehouse stock table (Warehouse / Product / In Stock /
Reserved / Available), "Orders Awaiting Fulfillment" table (Order / Customer / Status / Warehouse).

**Screen 8 — Fulfillment Detail:** Split table (Warehouse / Qty Fulfilled / Est. Shipments / Cost),
auto-surfaced "Consolidate Remaining Backorder" banner, "Accept Suggested Split" / "Manual
Override" buttons.

**Screen 9 — Subscriptions List:** Active/Paused/Cancelled count badges, table (Customer / Plan /
Cycle / Next Bill / Status), "+ New Plan (Admin)".

**Screen 10 — Billing Detail:** One-Time Lines table and Recurring Lines table shown as two
separate sections on the same order, "Modify Subscription" / "Cancel Subscription" buttons.

**Screen 11 — Customer Portal Negotiation (separate restricted route):** Status pill (Sent/Under
Negotiation/Confirmed), line-level comment thread, "Override Discount %" and "Requested Delivery
Date" fields, "Submit Request" / "Confirm Quotation" buttons, footnote: "If final terms exceed
thresholds, the quote automatically re-enters approval."

**Screen 12 — Invoices List:** Unpaid/Paid count badges, table (Invoice # / Customer / Amount /
Status / Due Date).

**Screen 13 — Invoice Detail:** Status stepper (Order Confirmed -> Shipped -> Invoiced -> Paid),
line items table, "Record Payment" (Razorpay) and "Download Summary" buttons, footnote: "Partial
invoicing stays recorded with partial delivery, nothing is billed before it ships."

**Screen 14 — Deal Health Dashboard:** Stalled Deals / Discount Anomalies / Delivery Slippage
summary cards, flagged-deals table (Deal / Issue / Flagged / Action), "Escalate" / "Nudge Rep"
buttons.

**Screen 15 — Admin/Reporting:** Filter row (Period / Sales Team / Approval Status / Product),
summary cards (Quotes Created / Avg Approval Time / Top Upsold Product), "Export PDF" / "Export
XLS" buttons.

**Screen 16 — Product Dashboard:** Catalog table, summary cards (Total Products / Pricelists /
Variants), "+ New Product" / "Manage Price fields".

**Screen 17 — Product Detail:** General info form, subscription Yes/No toggle (reveals recurring
interval when Yes), variant table (Attribute / Values / Extra Price), pricelist table (Tier /
Currency / Price Rule).

**Screen 18 — Discount Tiers & Approval Chains:** Tier ceiling table (Bronze/Silver/Gold + Max
Discount), Category ceiling table, discount-range -> approval-level table, "Save Configuration"
button, footnote: "When a quote mixes categories with different ceilings, the system must compute
a blended risk score and route to the highest required level. All approvals, rejections, and
edits must be logged with user, timestamp, and reason."

## APPENDIX D — Quick Test Flow (Login to Payment)

Run this in one continuous pass after the Integration Phase — each step must produce the described
visible result before moving to the next:

1. Sign up/log in, set up a discount tier, a warehouse, and a subscription plan
2. Create a quotation, add a line with a discount higher than normally allowed
3. Confirm it automatically asks for manager approval, without the rep requesting it manually
4. While building the quote, accept an upsell suggestion; confirm total/margin update immediately
5. Get it approved; confirm stock pulls from the correct warehouse, splitting across two if needed
6. Confirm a one-time product and a recurring subscription on the same order bill correctly and
   separately
7. Open the customer portal, request a bigger discount as the customer; confirm the quote goes
   back for approval automatically
8. Confirm the order, record a payment via Razorpay, and confirm the invoice status updates
   correctly

---

*Generated for Darshan — DealFlow360 hackathon build, 2-developer parallel track. Keep this file
in `/docs` inside the repo. Update `/docs/api-contracts.md` as you go — it's the glue between
Track A and Track B.*
