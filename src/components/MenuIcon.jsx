const SOFT = { fill: "currentColor", fillOpacity: 0.12, stroke: "none" };

export default function MenuIcon({ name, size = 24 }) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: "false",
  };

  switch (name) {
    case "home":
      return (
        <svg {...p}>
          <path {...SOFT} d="M5 10.5 12 5l7 5.5V20H5z" />
          <path d="M3.5 11.5 12 4.5l8.5 7" />
          <path d="M6 10.5V20h12v-9.5" />
          <path d="M10 20v-5h4v5" />
        </svg>
      );

    case "records": // All Data
      return (
        <svg {...p}>
          <ellipse {...SOFT} cx="12" cy="6" rx="7" ry="3" />
          <ellipse cx="12" cy="6" rx="7" ry="3" />
          <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
          <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
        </svg>
      );

    case "stats":
      return (
        <svg {...p}>
          <rect {...SOFT} x="4" y="12" width="4" height="8" rx="1" />
          <rect {...SOFT} x="10" y="5" width="4" height="15" rx="1" />
          <rect {...SOFT} x="16" y="9" width="4" height="11" rx="1" />
          <rect x="4" y="12" width="4" height="8" rx="1" />
          <rect x="10" y="5" width="4" height="15" rx="1" />
          <rect x="16" y="9" width="4" height="11" rx="1" />
        </svg>
      );

    case "users":
      return (
        <svg {...p}>
          <circle {...SOFT} cx="9" cy="8.5" r="3.5" />
          <circle cx="9" cy="8.5" r="3.5" />
          <path d="M2.5 20c.7-3.4 3.2-5 6.5-5s5.8 1.6 6.5 5" />
          <path d="M16 5.3a3.2 3.2 0 0 1 0 6" />
          <path d="M18 15.2c1.8.6 3 2 3.5 4.8" />
        </svg>
      );

    case "report":
      return (
        <svg {...p}>
          <rect {...SOFT} x="5" y="4" width="14" height="17" rx="2.5" />
          <rect x="5" y="4" width="14" height="17" rx="2.5" />
          <path d="M9 2.5h6V6H9z" />
          <path d="M9 11.5h6M9 15.5h4" />
        </svg>
      );

    case "line": // Sewing lines
      return (
        <svg {...p}>
          <path d="M3 6.5h3M9.5 6.5h5M18 6.5h3" />
          <path d="M3 12h5M11.5 12h3M18 12h3" />
          <path d="M3 17.5h3M9.5 17.5h5M18 17.5h3" />
        </svg>
      );

    case "attendance":
      return (
        <svg {...p}>
          <rect {...SOFT} x="3.5" y="5" width="17" height="15.5" rx="3" />
          <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
          <path d="m8.5 15 2.5 2.5 4.5-5" />
        </svg>
      );

    case "logout":
      return (
        <svg {...p}>
          <path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10" />
          <path d="m16 8 4 4-4 4" />
          <path d="M20 12H9" />
        </svg>
      );

    case "close":
      return (
        <svg {...p}>
          <path d="M5 5l14 14M19 5 5 19" />
        </svg>
      );

    default: // profile
      return (
        <svg {...p}>
          <circle {...SOFT} cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="10" r="3" />
          <path d="M6.2 18.2c1.3-2 3.2-3 5.8-3s4.5 1 5.8 3" />
        </svg>
      );
  }
}