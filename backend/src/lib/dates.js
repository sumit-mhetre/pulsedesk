// Simple date helpers used across reports

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function daysBetween(from, to) {
  const ms = endOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

// Resolve a preset range like '7d', '30d', 'today', 'month', 'quarter', 'year' to { from, to }
function resolveDateRange(preset) {
  const now = new Date();
  const today = startOfDay(now);
  let from, to = endOfDay(now);

  switch (preset) {
    case 'today':    from = today; break;
    case 'yesterday':{
      const y = new Date(today); y.setDate(y.getDate() - 1);
      from = y; to = endOfDay(y); break;
    }
    case '7d':       from = new Date(today); from.setDate(from.getDate() - 6); break;
    case '30d':      from = new Date(today); from.setDate(from.getDate() - 29); break;
    case '90d':      from = new Date(today); from.setDate(from.getDate() - 89); break;
    case 'month':    from = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'lastMonth':{
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to   = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      break;
    }
    case 'quarter':  {
      const q = Math.floor(now.getMonth() / 3);
      from = new Date(now.getFullYear(), q * 3, 1);
      break;
    }
    case 'year':     from = new Date(now.getFullYear(), 0, 1); break;
    default:         from = new Date(today); from.setDate(from.getDate() - 29); // default last 30d
  }
  return { from, to };
}

module.exports = { startOfDay, endOfDay, daysBetween, resolveDateRange };
