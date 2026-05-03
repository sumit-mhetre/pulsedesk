// CSV exporter - no dependencies, proper escaping
//
// Usage:
//   const csv = toCSV(columnsMeta, rows);
//   res.setHeader('Content-Type', 'text/csv; charset=utf-8');
//   res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');
//   res.send(csv);

function escapeCell(val) {
  if (val === null || val === undefined) return '';
  let s;
  if (val instanceof Date) {
    s = val.toISOString().slice(0, 10);  // YYYY-MM-DD
  } else if (typeof val === 'object') {
    s = JSON.stringify(val);
  } else {
    s = String(val);
  }
  // Escape quotes by doubling; wrap in quotes if contains comma/newline/quote
  if (/[",\n\r]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCSV(columnsMeta, rows) {
  const headers = columnsMeta.map(c => escapeCell(c.label));
  const body = rows.map(row =>
    columnsMeta.map(c => escapeCell(row[c.key])).join(',')
  );
  // BOM so Excel opens UTF-8 correctly with ₹, ā, etc.
  const bom = '\ufeff';
  return bom + headers.join(',') + '\r\n' + body.join('\r\n');
}

module.exports = { toCSV };
