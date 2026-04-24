// Excel (.xlsx) exporter using exceljs
//
// Usage:
//   const buffer = await toXLSX({ title, subtitle, columnsMeta, rows, summary });
//   res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//   res.setHeader('Content-Disposition', 'attachment; filename="report.xlsx"');
//   res.send(buffer);

const ExcelJS = require('exceljs');

async function toXLSX({ title = 'Report', subtitle = '', columnsMeta, rows, summary = {} }) {
  const wb = new ExcelJS.Workbook();
  wb.creator   = 'SimpleRx EMR';
  wb.created   = new Date();

  // ── Data sheet ──
  const ws = wb.addWorksheet('Report', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  // Title row
  ws.mergeCells(1, 1, 1, Math.max(1, columnsMeta.length));
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF0D47A1' } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(1).height = 24;

  if (subtitle) {
    ws.mergeCells(2, 1, 2, Math.max(1, columnsMeta.length));
    const subCell = ws.getCell(2, 1);
    subCell.value = subtitle;
    subCell.font = { size: 10, italic: true, color: { argb: 'FF64748B' } };
    subCell.alignment = { horizontal: 'left' };
  }

  // Header row (row 3)
  const headerRow = ws.getRow(3);
  columnsMeta.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.label;
    cell.font  = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    cell.border    = { bottom: { style: 'thin', color: { argb: 'FF0D47A1' } } };
  });
  headerRow.height = 22;

  // Data rows
  rows.forEach((row, rIdx) => {
    const r = ws.getRow(rIdx + 4);
    columnsMeta.forEach((col, i) => {
      const cell = r.getCell(i + 1);
      const val  = row[col.key];
      if (val === null || val === undefined) {
        cell.value = '';
      } else if (col.type === 'date' && val instanceof Date) {
        cell.value = val;
        cell.numFmt = 'dd-mmm-yyyy';
      } else if (col.type === 'date' && typeof val === 'string') {
        const d = new Date(val);
        cell.value = isNaN(d) ? val : d;
        cell.numFmt = 'dd-mmm-yyyy';
      } else if (col.type === 'currency') {
        cell.value = Number(val) || 0;
        cell.numFmt = '"₹"#,##0.00;[Red]-"₹"#,##0.00';
      } else if (col.type === 'number') {
        cell.value = Number(val) || 0;
      } else {
        cell.value = String(val);
      }
      if (rIdx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7FF' } };
      }
    });
  });

  // Auto column widths (rough)
  columnsMeta.forEach((col, i) => {
    const colNum = i + 1;
    let maxLen = col.label.length;
    rows.forEach(r => {
      const v = r[col.key];
      const s = v == null ? '' : (v instanceof Date ? 11 : String(v).length);
      if (typeof s === 'number' ? s > maxLen : s > maxLen) maxLen = Math.min(40, typeof s === 'number' ? s : s);
    });
    ws.getColumn(colNum).width = Math.max(10, Math.min(40, maxLen + 2));
  });

  // ── Summary sheet ──
  const sumWs = wb.addWorksheet('Summary');
  sumWs.getColumn(1).width = 28;
  sumWs.getColumn(2).width = 24;

  const sumTitle = sumWs.getCell(1, 1);
  sumTitle.value = 'Summary';
  sumTitle.font  = { size: 14, bold: true, color: { argb: 'FF0D47A1' } };
  sumWs.getRow(1).height = 22;

  const entries = flattenSummary(summary);
  let row = 3;
  entries.forEach(([k, v]) => {
    sumWs.getCell(row, 1).value = k;
    sumWs.getCell(row, 1).font  = { bold: true };
    const vCell = sumWs.getCell(row, 2);
    if (typeof v === 'number' && /amount|total|collected|pending|billed|avg/i.test(k)) {
      vCell.value = v;
      vCell.numFmt = '"₹"#,##0.00';
    } else {
      vCell.value = v;
    }
    row++;
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function flattenSummary(summary, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(summary || {})) {
    const key = prefix ? `${prefix} — ${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v)) {
        out.push([`${key} — ${k2}`, v2]);
      }
    } else if (Array.isArray(v)) {
      out.push([key, v.map(x => Array.isArray(x) ? x.join(': ') : x).join('; ')]);
    } else {
      out.push([key, v]);
    }
  }
  return out;
}

module.exports = { toXLSX };
