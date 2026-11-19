import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { STAFF_GROUPS } from './navLinks';

/*
 * The office navigation, in groups, for three places (DashboardLayout sidebar + tablet rail, TopNavbar phone menu):
 *   sidebar / drawer  Overview on top, then folding groups. "Daily work" starts open; the group holding the
 *                     current page is always open (its heading can't hide it); every other open/closed
 *                     choice is remembered on this device. Keeps the full admin list on a laptop screen.
 *   rail              The tablet icon strip: every icon, groups split by a thin line (no labels to fold).
 * Links without a group (the field crew's four) are shown as one plain list.
 */
const STORE_KEY = 'gs-nav-groups';
function readOpen() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}

function NavItem({ link, variant, onNavigate }) {
  const { label, icon: Icon, to, active } = link;
  const rail = variant === 'rail';
  const drawer = variant === 'drawer';
  return (
    <Link to={to} title={label} onClick={onNavigate} aria-current={active ? 'page' : undefined}
      className={`group flex items-center gap-3 rounded-xl no-underline transition-colors duration-150 ${rail ? 'justify-center h-11 w-11 mx-auto' : drawer ? 'px-3.5 py-3' : 'px-3 py-2.5'} ${active
        ? 'bg-emerald-50 text-emerald-800 font-semibold'
        : 'text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900'}`}>
      <Icon size={18} className={`shrink-0 ${active ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'}`} />
      {!rail && <span className={`${drawer ? 'text-[15px]' : 'text-sm'} truncate`}>{label}</span>}
      {active && !rail && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />}
    </Link>
  );
}

export default function StaffNav({ links, variant = 'sidebar', onNavigate }) {
  const [open, setOpen] = useState(readOpen);
  const groups = links.some(l => l.group)
    ? STAFF_GROUPS.map(g => ({ ...g, links: links.filter(l => (l.group || 'home') === g.key) })).filter(g => g.links.length)
    : [{ key: 'home', links }];

  const toggle = (key, now) => {
    const next = { ...open, [key]: !now };
    setOpen(next);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* not remembered: fine */ }
  };

  if (variant === 'rail') {
    return (
      <nav aria-label="Main" className="flex flex-col gap-1">
        {groups.map((g, i) => (
          <div key={g.key} className={`flex flex-col gap-1 ${i ? 'pt-2 mt-1 border-t border-slate-100' : ''}`}>
            {g.links.map(l => <NavItem key={l.label} link={l} variant="rail" onNavigate={onNavigate} />)}
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {groups.map(g => {
        if (!g.label) {
          return <div key={g.key} className="flex flex-col gap-0.5 mb-1">{g.links.map(l => <NavItem key={l.label} link={l} variant={variant} onNavigate={onNavigate} />)}</div>;
        }
        const hasActive = g.links.some(l => l.active);
        const isOpen = hasActive || (open[g.key] ?? !!g.open);
        const id = `nav-group-${g.key}`;
        return (
          <div key={g.key} className="flex flex-col">
            {hasActive ? (
              // The current page's group stays open: a plain heading, nothing to fold
              <p className="m-0 px-3 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{g.label}</p>
            ) : (
              <button type="button" onClick={() => toggle(g.key, isOpen)} aria-expanded={isOpen} aria-controls={id}
                className="w-full flex items-center justify-between gap-2 px-3 pt-3 pb-1.5 border-none bg-transparent cursor-pointer text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 rounded-lg">
                <span>{g.label}</span>
                <span className="flex items-center gap-1.5">
                  {!isOpen && <span className="normal-case tracking-normal font-semibold text-slate-400 tabular-nums">{g.links.length}</span>}
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
                </span>
              </button>
            )}
            {isOpen && (
              <div id={id} className="flex flex-col gap-0.5">
                {g.links.map(l => <NavItem key={l.label} link={l} variant={variant} onNavigate={onNavigate} />)}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
