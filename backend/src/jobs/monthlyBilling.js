'use strict';

/**
 * Monthly Billing Job
 * ───────────────────
 * Cron: '5 0 * * *' — runs at 00:05 UTC every day.
 * (Daily check is safer than monthly: catches any sub whose nextBillDate
 *  fell on today regardless of when it was created.)
 *
 * For every ACTIVE subscription whose nextBillDate <= today:
 *   1. Create an Invoice record (type = RECURRING).
 *   2. Generate a PDF via pdfkit.
 *   3. EMAIL THE PDF TO customer.realEmail — NEVER the portal login address.
 *      These are two separate fields; the portal email (portalUser.email) is
 *      only for authentication. The realEmail is the customer's actual inbox.
 *   4. Advance nextBillDate by the plan interval.
 *   5. Log the action to ActivityLog.
 *
 * Per Global Constraint 7: recurring invoice email goes to customer.realEmail.
 */

const path   = require('path');
const fs     = require('fs');
const cron   = require('node-cron');
const PDFDocument = require('pdfkit');
const prisma = require('../config/prisma');
const { sendMail }  = require('../config/mailer');
const { logAudit }  = require('../utils/logAudit');
const { advanceByInterval } = require('../utils/proration');

const PDF_DIR = path.join(__dirname, '../../../invoices-pdf');
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

// ── PDF generator ──────────────────────────────────────────────────────────────

async function _generateRecurringPdf(invoice, sub, customer) {
  const filename = `invoice-${invoice.id}.pdf`;
  const filepath = path.join(PDF_DIR, filename);

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    doc.fontSize(20).font('Helvetica-Bold').text('DealFlow360', 50, 50);
    doc.fontSize(10).font('Helvetica').fillColor('#555').text('Recurring Invoice', 50, 75);
    doc.moveTo(50, 92).lineTo(560, 92).stroke('#ddd');

    doc.fontSize(10).fillColor('#000')
       .text(`Invoice #: ${invoice.id.slice(0, 8).toUpperCase()}`, 50, 102)
       .text(`Date: ${new Date(invoice.createdAt ?? new Date()).toLocaleDateString()}`, 50, 117)
       .text(`Due: ${new Date(invoice.dueDate).toLocaleDateString()}`, 50, 132)
       .text(`Billing Period: ${sub.plan.interval}`, 50, 147);

    doc.text(`Bill To: ${customer.companyName}`, 350, 102)
       .text(`Email: ${customer.realEmail}`, 350, 117);

    doc.moveTo(50, 162).lineTo(560, 162).stroke('#ddd');
    doc.font('Helvetica-Bold').fontSize(9)
       .text('Plan', 50, 172)
       .text('Qty', 280, 172)
       .text('Unit Price', 330, 172)
       .text('Total', 490, 172);
    doc.moveTo(50, 185).lineTo(560, 185).stroke('#ddd');

    const unitPrice = Number(sub.plan.product.price);
    const lineTotal = unitPrice * sub.quantity;

    doc.font('Helvetica').fontSize(9)
       .text(sub.plan.product.name, 50, 195, { width: 220 })
       .text(String(sub.quantity), 280, 195)
       .text(`$${unitPrice.toFixed(2)}`, 330, 195)
       .text(`$${lineTotal.toFixed(2)}`, 490, 195);

    doc.moveTo(50, 215).lineTo(560, 215).stroke('#ddd');
    doc.font('Helvetica-Bold').fontSize(10)
       .text('Total', 410, 222)
       .text(`$${Number(invoice.amount).toFixed(2)}`, 490, 222);

    doc.fontSize(8).font('Helvetica').fillColor('#999')
       .text('DealFlow360 — Thank you for your subscription.', 50, 250, { align: 'center', width: 510 });

    doc.end();
    stream.on('finish', () => resolve(filepath));
    stream.on('error', reject);
  });
}

// ── Core billing logic ─────────────────────────────────────────────────────────

async function runMonthlyBilling() {
  const now = new Date();
  console.log(`[monthlyBilling] Starting run at ${now.toISOString()}`);

  const due = await prisma.subscription.findMany({
    where: {
      status:       'ACTIVE',
      nextBillDate: { lte: now },
    },
    include: {
      plan: {
        include: { product: { select: { id: true, name: true, price: true, unit: true } } },
      },
      order: {
        include: {
          quotation: {
            include: {
              customer: { select: { id: true, companyName: true, realEmail: true } },
            },
          },
        },
      },
    },
  });

  console.log(`[monthlyBilling] ${due.length} subscription(s) due`);

  let created = 0, errors = 0;

  for (const sub of due) {
    try {
      // ── IMPORTANT: email goes to customer.realEmail, NOT the portal login address ──
      // The portal address is in portalUser.email and is ONLY for authentication.
      // The realEmail is the customer's actual business email inbox.
      const realEmail = sub.order?.quotation?.customer?.realEmail;
      const customer  = sub.order?.quotation?.customer;

      if (!realEmail) {
        console.warn(`[monthlyBilling] No realEmail for subscription ${sub.id}, skipping email`);
      }

      const amount  = Number(sub.plan.product.price) * sub.quantity;
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 30);

      await prisma.$transaction(async (tx) => {
        // 1. Create invoice
        const invoice = await tx.invoice.create({
          data: {
            subscriptionId: sub.id,
            type:           'RECURRING',
            amount:         Math.round(amount * 100) / 100,
            status:         'UNPAID',
            dueDate,
          },
        });

        // 2. Advance nextBillDate
        const nextBillDate = advanceByInterval(sub.nextBillDate, sub.plan.interval);
        await tx.subscription.update({
          where: { id: sub.id },
          data:  { nextBillDate },
        });

        // 3. Generate PDF (async, but we await inside transaction for atomicity)
        if (customer) {
          const pdfPath = await _generateRecurringPdf(invoice, sub, customer);
          await tx.invoice.update({ where: { id: invoice.id }, data: { pdfPath } });

          // 4. Email PDF to realEmail — NEVER the portal address
          if (realEmail) {
            const pdfBuffer = fs.readFileSync(pdfPath);
            await sendMail({
              to:      realEmail,  // <── customer.realEmail, not portal email
              subject: `DealFlow360 — Recurring Invoice for ${sub.plan.product.name}`,
              html: `
                <h2>Your recurring invoice is ready</h2>
                <p>Hi ${customer.companyName},</p>
                <p>Please find your invoice for <strong>${sub.plan.product.name}</strong>
                   (${sub.quantity} × $${Number(sub.plan.product.price).toFixed(2)}) attached.</p>
                <p><strong>Amount due: $${amount.toFixed(2)}</strong><br/>
                   Due date: ${dueDate.toLocaleDateString()}</p>
                <p>Log in to your customer portal to record payment.</p>
                <p>— DealFlow360</p>
              `,
              attachments: [{
                filename:    `invoice-${invoice.id.slice(0, 8)}.pdf`,
                content:     pdfBuffer,
                contentType: 'application/pdf',
              }],
            });
          }
        }

        created++;
      });

      await logAudit({
        userId:     null,
        action:     'RECURRING_INVOICE_CREATED',
        entityType: 'Subscription',
        entityId:   sub.id,
        details:    { interval: sub.plan.interval, amount, emailedTo: realEmail ?? 'none' },
      });

    } catch (err) {
      errors++;
      console.error(`[monthlyBilling] Failed for subscription ${sub.id}:`, err.message);
    }
  }

  console.log(`[monthlyBilling] Done — created: ${created}, errors: ${errors}`);
}

function scheduleMonthlyBilling() {
  // Daily at 00:05 UTC — catches any subscription due today
  cron.schedule('5 0 * * *', runMonthlyBilling, { timezone: 'UTC' });
  console.log('[monthlyBilling] Scheduled: 00:05 UTC daily');
}

module.exports = { scheduleMonthlyBilling, runMonthlyBilling };
