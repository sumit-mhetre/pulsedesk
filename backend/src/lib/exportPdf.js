// PDF exporter using pdfkit — simple, table + KPIs
//
// Usage (streaming):
//   const doc = toPDF({ title, subtitle, columnsMeta, rows, summary, clinicName });
//   res.setHeader('Content-Type', 'application/pdf');
//   res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');
//   doc.pipe(res);
//   doc.end();

const PDFDocument = require('pdfkit');

const COLORS = {
  primary:   '#1565C0',
  dark:      '#0D47A1',
  accent:    '#00BCD4',
  text:      '#1F2937',
  muted:     '#64748B',
  rowAlt:    '#F0F7FF',
  headerBg:  '#1565C0',
  border:    '#CBD5E1',
};

function toPDF({ title = 'Report', subtitle = '', columnsMeta, rows, summary = {}, clinicName = '' }) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 36,
    info: { Title: title, Author: 'SimpleRx EMR' },
  });

  // ── Header band ──
  doc.rect(0, 0, doc.page.width, 68).fill(COLORS.primary);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text('SimpleRx EMR', 36, 22);
  if (clinicName) {
    doc.fillColor('#DBEAFE').font('Helvetica').fontSize(10).text(clinicName, 36, 46);
  }
  doc.fillColor('#FFFFFF').fontSize(10)
     .text(new Date().toLocaleString('en-IN'), 36, 22, { align: 'right', width: doc.page.width - 72 });

  doc.y = 90;

  // ── Title + subtitle ──
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(16).text(title);
  if (subtitle) {
    doc.moveDown(0.2);
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(10).text(subtitle);
  }
  doc.moveDown(0.6);

  // ── Summary KPI block ──
  const summaryEntries = flattenSummary(summary);
  if (summaryEntries.length) {
    const boxX = doc.x;
    const boxY = doc.y;
    const boxW = doc.page.width - 72;
    const colCount = Math.min(4, summaryEntries.length);
    const rowCount = Math.ceil(summaryEntries.length / colCount);
    const cellW = boxW / colCount;
    const cellH = 36;
    const boxH = cellH * rowCount + 6;

    doc.roundedRect(boxX, boxY, boxW, boxH, 6).fill(COLORS.rowAlt);

    summaryEntries.forEach((entry, i) => {
      const row = Math.floor(i / colCount);
      const col = i % colCount;
      const x = boxX + col * cellW + 10;
      const y = boxY + row * cellH + 8;
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text(entry[0], x, y, { width: cellW - 14, ellipsis: true });
      doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(12).text(formatVal(entry[1]), x, y + 13, { width: cellW - 14, ellipsis: true });
    });

    doc.y = boxY + boxH + 12;
  }

  // ── Table ──
  if (columnsMeta && columnsMeta.length && rows && rows.length) {
    drawTable(doc, columnsMeta, rows);
  } else {
    doc.moveDown(1).fillColor(COLORS.muted).font('Helvetica').fontSize(11).text('No data for the selected filters.');
  }

  // ── Footer on each page ──
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
       .text(
         `SimpleRx EMR  ·  Page ${i + 1} of ${range.count}`,
         36, doc.page.height - 24,
         { align: 'center', width: doc.page.width - 72 }
       );
  }

  return doc;
}

function drawTable(doc, columnsMeta, rows) {
  const startX = 36;
  const tableWidth = doc.page.width - 72;
  const cellPad = 5;

  // Compute column widths based on label length (cap at max)
  const totalWeight = columnsMeta.reduce((s, c) => s + Math.max(8, Math.min(22, (c.label || '').length + (c.type === 'currency' ? 4 : 0))), 0);
  const colWidths = columnsMeta.map(c => {
    const w = Math.max(8, Math.min(22, (c.label || '').length + (c.type === 'currency' ? 4 : 0)));
    return (w / totalWeight) * tableWidth;
  });

  const rowHeight = 20;
  let y = doc.y;

  const drawHeader = () => {
    doc.rect(startX, y, tableWidth, rowHeight).fill(COLORS.headerBg);
    let x = startX;
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
    columnsMeta.forEach((c, i) => {
      doc.text(c.label, x + cellPad, y + 6, { width: colWidths[i] - cellPad * 2, ellipsis: true });
      x += colWidths[i];
    });
    y += rowHeight;
  };

  drawHeader();

  rows.forEach((row, idx) => {
    // page break if near bottom
    if (y + rowHeight > doc.page.height - 40) {
      doc.addPage();
      y = 90;
      drawHeader();
    }

    if (idx % 2 === 1) {
      doc.rect(startX, y, tableWidth, rowHeight).fill(COLORS.rowAlt);
    }

    let x = startX;
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8);
    columnsMeta.forEach((c, i) => {
      const val = formatCell(row[c.key], c.type);
      doc.fillColor(c.type === 'currency' ? COLORS.dark : COLORS.text)
         .text(val, x + cellPad, y + 6, { width: colWidths[i] - cellPad * 2, ellipsis: true, lineBreak: false });
      x += colWidths[i];
    });
    y += rowHeight;
  });

  doc.y = y + 10;
}

function formatCell(val, type) {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) {
    return val.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  if (type === 'currency') {
    const n = Number(val);
    if (isNaN(n)) return String(val);
    return '\u20B9' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  if (type === 'date' && typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d) ? val : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return String(val);
}

function formatVal(v) {
  if (typeof v === 'number') {
    return v.toLocaleString('en-IN');
  }
  return String(v ?? '');
}

function flattenSummary(summary) {
  const out = [];
  for (const [k, v] of Object.entries(summary || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v)) {
        out.push([`${label(k)} — ${k2}`, v2]);
      }
    } else if (Array.isArray(v)) {
      // top-N lists — skip from KPI block, too long
    } else {
      out.push([label(k), v]);
    }
  }
  return out.slice(0, 12);  // cap at 12 KPI cells
}

function label(k) {
  return k
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, c => c.toUpperCase())
    .trim();
}

module.exports = { toPDF };
