export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
}

export function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return "Today";
  if (diff < 2 * day) return "Yesterday";
  const days = Math.floor(diff / day);
  if (days < 7) return days + " days ago";
  if (days < 30) return Math.floor(days / 7) + "w ago";
  if (days < 365) return Math.floor(days / 30) + "mo ago";
  return Math.floor(days / 365) + "y ago";
}

export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + ":" + s.toString().padStart(2, "0");
}

export function formatWeight(weight: number | null): string {
  if (weight === null) return "-";
  if (weight === 0) return "BW";
  return weight.toString();
}

/**
 * Display-ready weight label including unit. Bodyweight (0) renders as "BW"
 * with no unit; null renders as "-"; otherwise "<weight> lb".
 */
export function formatWeightLabel(weight: number | null): string {
  if (weight === null) return "-";
  if (weight === 0) return "BW";
  return weight.toString() + " lb";
}
