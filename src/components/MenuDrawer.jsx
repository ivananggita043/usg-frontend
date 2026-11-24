import { useEffect } from "react";
import "./DashboardUser.css";
import MenuIcon from "./MenuIcon.jsx";

export default function MenuDrawer({
  open,
  onClose,
  user,
  items,
  active,
  onSelect,
  onLogout,
}) {
  // tutup dengan tombol Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`overlay ${open ? "show" : ""}`} onClick={onClose} />
      <nav
        className={`drawer ${open ? "open" : ""}`}
        aria-hidden={!open}
        aria-label="Main menu"
      >
        <div className="drawer-head">
          <div className="avatar">
            <MenuIcon name="profile" size={32} />
          </div>
          <div className="drawer-who">
            <p className="drawer-name">{user.name}</p>
            <p className="drawer-area">{user.area}</p>
          </div>
          <button
            type="button"
            className="drawer-close"
            aria-label="Close menu"
            onClick={onClose}
          >
            <MenuIcon name="close" size={20} />
          </button>
        </div>

        <ul className="drawer-list">
          {items.map((m) => (
            <li key={m.key}>
              <button
                type="button"
                className={`drawer-item ${active === m.key ? "active" : ""}`}
                aria-current={active === m.key ? "page" : undefined}
                onClick={() => {
                  onSelect(m.key);
                  onClose();
                }}
              >
                <MenuIcon name={m.icon} />
                <span>{m.label}</span>
              </button>
            </li>
          ))}
        </ul>

        <button type="button" className="logout" onClick={onLogout}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 4H5v16h4" />
            <path d="M16 8l4 4-4 4" />
            <path d="M20 12H9" />
          </svg>
          <span>LOG OUT</span>
        </button>
      </nav>
    </>
  );
}

