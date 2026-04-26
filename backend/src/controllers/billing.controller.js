const prisma = require('../lib/prisma');
const { successResponse, errorResponse, paginatedResponse } = require('../lib/response');

// ── Generate Bill Number ──────────────────────────────────
async function generateBillNo(clinicId) {
  const count = await prisma.bill.count({ where: { clinicId } });
  const year  = new Date().getFullYear();
  return `BL/${year}/${String(count + 1).padStart(4, '0')}`;
}

// ── Get all bills ─────────────────────────────────────────
async function getBills(req, res) {
  try {
    const { page = 1, limit = 20, patientId, status, search, from, to } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { clinicId: req.clinicId };

    if (patientId) where.patientId = patientId;
    if (status)    where.paymentStatus = status;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to)   where.date.lte = new Date(new Date(to).setHours(23, 59, 59));
    }
    if (search) {
      where.OR = [
        { billNo: { contains: search, mode: 'insensitive' } },
        { patient: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { date: 'desc' },
        include: {
          patient:  { select: { id: true, name: true, patientCode: true, age: true, gender: true } },
          items:    { select: { name: true, qty: true, rate: true, amount: true } },
        },
      }),
      prisma.bill.count({ where }),
    ]);

    return paginatedResponse(res, bills, total, page, limit);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to fetch bills', 500);
  }
}

// ── Get single bill ───────────────────────────────────────
async function getBill(req, res) {
  try {
    const bill = await prisma.bill.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
      include: {
        patient:      true,
        prescription: { select: { rxNo: true, date: true, complaint: true, diagnosis: true } },
        items:        true,
      },
    });
    if (!bill) return errorResponse(res, 'Bill not found', 404);
    return successResponse(res, bill);
  } catch (err) {
    return errorResponse(res, 'Failed to fetch bill', 500);
  }
}

// ── Create bill ───────────────────────────────────────────
async function createBill(req, res) {
  try {
    const {
      patientId, prescriptionId, items = [],
      discount = 0, paymentMode = 'Cash',
      paymentStatus = 'Pending', amountPaid = 0, notes,
    } = req.body;

    const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId: req.clinicId } });
    if (!patient) return errorResponse(res, 'Patient not found', 404);

    const billNo   = await generateBillNo(req.clinicId);
    const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.rate) * parseInt(item.qty)), 0);
    const total    = subtotal - parseFloat(discount);
    const paid     = parseFloat(amountPaid);
    const balance  = total - paid;

    const bill = await prisma.$transaction(async (tx) => {
      const b = await tx.bill.create({
        data: {
          clinicId: req.clinicId,
          billNo,
          patientId,
          prescriptionId: prescriptionId || null,
          subtotal,
          discount: parseFloat(discount),
          total,
          paymentMode,
          paymentStatus: paid >= total ? 'Paid' : paid > 0 ? 'Partial' : 'Pending',
          amountPaid: paid,
          balance: Math.max(balance, 0),
          notes: notes || null,
        },
      });

      if (items.length > 0) {
        await tx.billItem.createMany({
          data: items.map(item => ({
            billId:        b.id,
            billingItemId: item.billingItemId || null,
            name:          item.name,
            qty:           parseInt(item.qty) || 1,
            rate:          parseFloat(item.rate) || 0,
            amount:        parseFloat(item.rate) * (parseInt(item.qty) || 1),
          })),
        });
      }

      // ── Auto-queue: when bill is saved for TODAY, add patient to today's queue ──
      // One bill = one queue entry. Receptionist creates bill → patient is queued
      // as Waiting. Doctor flips to InConsultation/Done as the visit progresses.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const lastToken = await tx.appointment.findFirst({
        where: { clinicId: req.clinicId, tokenDate: { gte: today, lt: tomorrow } },
        orderBy: { tokenNo: 'desc' },
        select: { tokenNo: true },
      });
      const nextToken = lastToken ? lastToken.tokenNo + 1 : 1;

      try {
        await tx.appointment.create({
          data: {
            clinicId:  req.clinicId,
            patientId,
            tokenNo:   nextToken,
            tokenDate: today,
            status:    'Waiting',
            notes:     `Auto-queued from bill ${billNo}`,
          },
        });
      } catch (e) {
        // Don't fail the bill if queue insert hits a race condition — log only
        console.warn('[createBill] auto-queue failed (non-fatal):', e?.message);
      }

      return tx.bill.findUnique({
        where: { id: b.id },
        include: { patient: true, items: true, prescription: { select: { rxNo: true } } },
      });
    });

    return successResponse(res, bill, 'Bill created and patient added to queue', 201);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to create bill', 500);
  }
}

// ── Update bill (payment update) ──────────────────────────
async function updateBill(req, res) {
  try {
    const existing = await prisma.bill.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
    if (!existing) return errorResponse(res, 'Bill not found', 404);

    const { amountPaid, paymentMode, paymentStatus, notes, discount, items } = req.body;

    let updateData = {};

    if (amountPaid !== undefined) {
      const paid    = parseFloat(amountPaid);
      const total   = existing.total;
      const balance = Math.max(total - paid, 0);
      updateData = {
        amountPaid: paid,
        balance,
        paymentStatus: paid >= total ? 'Paid' : paid > 0 ? 'Partial' : 'Pending',
      };
    }
    if (paymentMode   !== undefined) updateData.paymentMode   = paymentMode;
    if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
    if (notes         !== undefined) updateData.notes         = notes;

    // If items updated, recalculate totals
    if (items !== undefined) {
      await prisma.billItem.deleteMany({ where: { billId: req.params.id } });
      const subtotal  = items.reduce((s, i) => s + parseFloat(i.rate) * parseInt(i.qty), 0);
      const disc      = discount !== undefined ? parseFloat(discount) : existing.discount;
      const total     = subtotal - disc;
      const paid      = updateData.amountPaid ?? existing.amountPaid;
      updateData = {
        ...updateData,
        subtotal, discount: disc, total,
        balance:       Math.max(total - paid, 0),
        paymentStatus: paid >= total ? 'Paid' : paid > 0 ? 'Partial' : 'Pending',
      };
      await prisma.billItem.createMany({
        data: items.map(i => ({
          billId: req.params.id,
          billingItemId: i.billingItemId || null,
          name: i.name, qty: parseInt(i.qty) || 1,
          rate: parseFloat(i.rate) || 0,
          amount: parseFloat(i.rate) * (parseInt(i.qty) || 1),
        })),
      });
    }

    const updated = await prisma.bill.update({
      where: { id: req.params.id },
      data: updateData,
      include: { patient: true, items: true },
    });

    return successResponse(res, updated, 'Bill updated');
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to update bill', 500);
  }
}

// ── Get patient bills ─────────────────────────────────────
async function getPatientBills(req, res) {
  try {
    const bills = await prisma.bill.findMany({
      where: { patientId: req.params.patientId, clinicId: req.clinicId },
      orderBy: { date: 'desc' },
      include: { items: true, prescription: { select: { rxNo: true } } },
    });
    return successResponse(res, bills);
  } catch (err) {
    return errorResponse(res, 'Failed', 500);
  }
}

// ── Auto-suggest items from prescription ──────────────────
async function suggestFromPrescription(req, res) {
  try {
    const { prescriptionId } = req.params;
    const rx = await prisma.prescription.findFirst({
      where: { id: prescriptionId, clinicId: req.clinicId },
      include: { medicines: true, labTests: true },
    });
    if (!rx) return errorResponse(res, 'Prescription not found', 404);

    // Get billing items for matching
    const billingItems = await prisma.billingItem.findMany({
      where: { clinicId: req.clinicId, isActive: true },
    });

    const suggestions = [];

    // Always add consultation fee
    const consultFee = billingItems.find(b =>
      b.name.toLowerCase().includes('consultation') && b.name.toLowerCase().includes('general')
    );
    if (consultFee) {
      suggestions.push({ billingItemId: consultFee.id, name: consultFee.name, qty: 1, rate: consultFee.defaultPrice });
    }

    // Add lab test fees if tests were ordered
    if (rx.labTests.length > 0) {
      const ecgTest  = rx.labTests.find(t => t.labTestName.includes('ECG'));
      const ecgItem  = billingItems.find(b => b.name.includes('ECG'));
      if (ecgTest && ecgItem) suggestions.push({ billingItemId: ecgItem.id, name: ecgItem.name, qty: 1, rate: ecgItem.defaultPrice });
    }

    return successResponse(res, suggestions);
  } catch (err) {
    return errorResponse(res, 'Failed to get suggestions', 500);
  }
}

// ── Daily summary ─────────────────────────────────────────
async function getDailySummary(req, res) {
  try {
    const { date } = req.query;
    const d     = date ? new Date(date) : new Date();
    const start = new Date(d.setHours(0, 0, 0, 0));
    const end   = new Date(d.setHours(23, 59, 59, 999));

    const bills = await prisma.bill.findMany({
      where: { clinicId: req.clinicId, date: { gte: start, lte: end } },
      include: { patient: { select: { name: true } }, items: true },
    });

    const totalBilled    = bills.reduce((s, b) => s + b.total, 0);
    const totalCollected = bills.reduce((s, b) => s + b.amountPaid, 0);
    const totalPending   = bills.reduce((s, b) => s + b.balance, 0);
    const byMode         = {};
    bills.forEach(b => {
      if (b.amountPaid > 0) byMode[b.paymentMode] = (byMode[b.paymentMode] || 0) + b.amountPaid;
    });

    return successResponse(res, {
      date:     start,
      count:    bills.length,
      totalBilled, totalCollected, totalPending,
      byMode,
      bills,
    });
  } catch (err) {
    return errorResponse(res, 'Failed to get summary', 500);
  }
}

module.exports = { getBills, getBill, createBill, updateBill, getPatientBills, suggestFromPrescription, getDailySummary };
