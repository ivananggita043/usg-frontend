export const MENU_ADMIN = [
  { key: "home", label: "HOME", icon: "home" },
  { key: "history", label: "ALL DATA", icon: "records" },
  { key: "stats", label: "STATISTIK", icon: "stats" },
  { key: "users", label: "USERS", icon: "users" },
  { key: "attendance", label: "ATTENDANCE", icon: "attendance" },
  { key: "reports", label: "REPORT", icon: "report" },
  { key: "profile", label: "PROFILE", icon: "profile" },
];

export const MENU_ADMIN_SEWING = [
  ...MENU_ADMIN.slice(0, 4),
  { key: "lines", label: "LINES", icon:"line" },
  ...MENU_ADMIN.slice(4),
];

export const MENU_SUPER = [
  { key: "home", label: "HOME", icon: "home" },
  { key: "history", label: "ALL DATA", icon: "records" },
  { key: "stats", label: "STATISTIK", icon: "stats" },
  { key: "users", label: "USERS", icon: "users" },
  { key: "attendance", label: "ATTENDANCE", icon: "attendance" },
  { key: "lines", label: "LINES", icon: "line" },
  { key: "reports", label: "REPORT", icon: "report" },
  { key: "profile", label: "PROFILE", icon: "profile" },
];

export const PAGE_TITLE = {
  records: "QC Records",
  stats: "Statistik",
  users: "Users",
  reports: "Reports",
  history: "All Data",
};

