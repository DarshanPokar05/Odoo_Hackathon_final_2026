'use strict';

/**
 * Reports Service
 * ===============
 * Provides filtered query + PDF/XLS export for the Admin/Reporting screen.
 * No paid third-party services — PDF via pdfkit, XLS via a hand-rolled CSV
 * (compatible with Excel/Sheets) since xlsx library is not in the approved list.
 */

const PDFDocument = require('pdfkit');
const prisma      = require('../../config/prisma');

// ── Helpers ───────────────────────────────────────────────────────────────────

function _buildWhere(query, user) {
  const where = {};

  // Sales rep sees only their own data
  if (user.role === 'SALES_REP') where.repId = user.userId;

  if (query?.status)  where.status     = query.status;
  if (query?.repId && user.role !== 'SALES_REP')  where.repId = query.repId;
  if (query?.customerId) where.customerId = query.customerId;

  // Date range
  if (query?.from || query?.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = new Date(query.from);
    if (query.to)   where.createdAt.lte = new Date(query.to);
  }

  return where;
}

// ── Public API ─────────────────────────────────────────────────────────────────

async function getSummary(query, user) {
  const where = _buildWhere(query, user);

  const [quotations, approvalSteps, topUpsell] = await Promise.all([
    prisma.quotation.findMany({
      where,
      include: {
        customer: { select: { companyName: true } },
        lines:    true,
        approvalSteps: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.approvalStep.findMany({
      where: { status: 'APPROVED', actedAt: { not: null } },
      select: { quotationId: true, actedAt: true, quotation: { select: { createdAt: true } } },
    }),
    // Top upsold product: find the most-added product across all quotes
    prisma.quotationLine.groupBy({
      by:      ['productId'],
      _count:  { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take:    1,
    }),
  ]);

  // Average approval time (hours from quotation creation to first approval)
  const approvedWithTimes = approvalSteps.filter((s) => s.actedAt && s.quotation?.createdAt);
  const avgApprovalHours  = approvedWithTimes.length
    ? Math.round(
        approvedWithTimes.reduce((sum, s) => {
          const hrs = (new Date(s.actedAt) - new Date(s.quotation.createdAt)) / (1000 * 60 * 60);
          return sum + hrs;
        }, 0) / approvedWithTimes.length
      )
    : null;

  // Top upsold product name
  let topUpsoldProduct = null;
  if (topUpsell[0]) {
    const p = await prisma.product.findUnique({ where: { id: topUpsell[0].productId } });
    topUpsoldProduct = p?.name ?? null;
  }

  return {
    quotationsCreated:   quotations.length,
    avgApprovalTimeHours: avgApprovalHours,
    topUpsoldProduct,
    quotations,
  };
}

/**
 * Export as PDF — returns a Buffer containing the PDF bytes.
 */
async function exportPdf(query, user) {
  const { quotations } = await getSummary(query, user);

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end',  ()  => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).font('Helvetica-Bold').text('DealFlow360 — Quotations Report', 40, 40);
    doc.fontSize(9).font('Helvetica').fillColor('#555')
       .text(`Generated: ${new Date().toLocaleString()}`, 40, 62);
    doc.moveTo(40, 78).lineTo(555, 78).stroke('#ccc');

    // Headers
    let y = 88;
    const cols = [40, 170, 260, 330, 420, 480];
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#000')
       .text('Customer',    cols[0], y)
       .text('Status',      cols[1], y)
       .text('Risk',        cols[2], y)
       .text('Amount',      cols[3], y)
       .text('Lines',       cols[4], y)
       .text('Date',        cols[5], y);
    doc.moveTo(40, y + 12).lineTo(555, y + 12).stroke('#ccc');
    y += 18;

    for (const q of quotations.slice(0, 200)) {
      const total = q.lines.reduce((s, l) => {
        return s + Number(l.unitPrice) * l.quantity * (1 - Number(l.discountPercent) / 100);
      }, 0);

      doc.font('Helvetica').fontSize(8).fillColor('#000')
         .text(q.customer?.companyName ?? '—',       cols[0], y, { width: 120 })
         .text(q.status,                              cols[1], y, { width: 80 })
         .text(String(Number(q.blendedRiskScore)),   cols[2], y)
         .text(`$${total.toFixed(2)}`,               cols[3], y)
         .text(String(q.lines.length),               cols[4], y)
         .text(new Date(q.createdAt).toLocaleDateString(), cols[5], y);
      y += 14;

      if (y > 740) { doc.addPage(); y = 40; }
    }

    doc.end();
  });
}

/**
 * Export as CSV (Excel-compatible) — returns a string.
 */
async function exportCsv(query, user) {
  const { quotations } = await getSummary(query, user);

  const rows = [
    ['Customer', 'Status', 'Blended Risk', 'Total Amount', 'Lines', 'Created'].join(','),
    ...quotations.map((q) => {
      const total = q.lines.reduce((s, l) => {
        return s + Number(l.unitPrice) * l.quantity * (1 - Number(l.discountPercent) / 100);
      }, 0);
      return [
        `"${q.customer?.companyName ?? ''}"`,
        q.status,
        Number(q.blendedRiskScore),
        total.toFixed(2),
        q.lines.length,
        new Date(q.createdAt).toISOString(),
      ].join(',');
    }),
  ];

  return rows.join('\n');
}

module.exports = { getSummary, exportPdf, exportCsv };
