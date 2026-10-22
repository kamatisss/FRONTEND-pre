import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Leaf, Menu, X, MapPin, Phone, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../services/business';
import { prefetchStudio } from '../services/prefetch';

/*
 * The public site's one header and footer: landing page, Project Hub, Track Record and the AI
 * Designer gate all share them, so moving between them never feels like leaving the site.
 * Section links (Services, How it works, Pricing) work from any page: off the landing page they
 * go to "/#id" and ui/ScrollManager scrolls there once the section has rendered.
 */

const dashboardPath = (user) =>
  user?.is_superuser ? '/admin-dashboard' : user?.is_staff ? '/staff-dashboard' : '/user-dashboard';

const SECTIONS = [
  { id: 'services',     label: 'Services' },
  { id: 'how-it-works', label: 'How it Works' },
  { id: 'estimate',     label: 'Pricing' },
];

function useSectionLink() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (id) => {
    if (pathname === '/') document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    else navigate(`/#${id}`);
  };
}

// The logo on the landing page scrolls back to the top instead of doing nothing
function useHomeLink() {
  const { pathname } = useLocation();
  return (e) => {
    if (pathname !== '/') return;
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
}

const CHROME_CSS = `
  :root { --site-nav-h: 68px; }
  @media (max-width: 768px) { :root { --site-nav-h: 60px; } }
  .sh { position: fixed; top: 0; left: 0; right: 0; z-index: 50; height: var(--site-nav-h);
    display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 32px;
    background: rgba(255,255,255,0.88); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(226,232,240,0.8); transition: background .3s, box-shadow .3s;
    font-family: 'Inter', system-ui, sans-serif; }
  .sh.scrolled { background: rgba(255,255,255,0.97); box-shadow: 0 1px 0 rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); }
  .sh-spacer { height: var(--site-nav-h); }
  .sh-logo { display: flex; align-items: center; gap: 8px; font-weight: 900; font-size: 20px; letter-spacing: -0.5px; color: #0f172a; text-decoration: none; flex-shrink: 0; }
  .sh-links { display: flex; align-items: center; gap: 30px; list-style: none; margin: 0; padding: 0; }
  .sh-link { position: relative; background: none; border: none; padding: 6px 0; cursor: pointer; font: inherit; font-size: 15px; font-weight: 600;
    color: #475569; text-decoration: none; transition: color .2s; }
  .sh-link:hover { color: #10b981; }
  .sh-link[aria-current="page"] { color: #047857; }
  .sh-link[aria-current="page"]::after { content: ''; position: absolute; left: 0; right: 0; bottom: -2px; height: 2px; border-radius: 2px; background: #10b981; }
  .sh-cta { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
  .sh-ghost { font-size: 15px; font-weight: 700; padding: 8px 14px; color: #475569; text-decoration: none; border-radius: 8px; }
  .sh-ghost:hover { color: #047857; }
  .sh-primary { display: inline-flex; align-items: center; gap: 6px; padding: 10px 22px; border-radius: 100px; font-size: 14px; font-weight: 700;
    text-decoration: none; background: #10b981; color: #fff; box-shadow: 0 4px 14px rgba(16,185,129,0.35); transition: background .2s, transform .2s; }
  .sh-primary:hover { background: #059669; transform: translateY(-1px); }
  .sh-ham { display: none; background: none; border: none; cursor: pointer; color: #0f172a; padding: 8px; margin-right: -8px; }
  .sh-menu { position: fixed; top: var(--site-nav-h); left: 0; right: 0; z-index: 49; background: #fff; border-bottom: 1px solid #e2e8f0;
    box-shadow: 0 8px 32px rgba(0,0,0,0.08); padding: 12px 20px 20px; display: flex; flex-direction: column;
    max-height: calc(100vh - var(--site-nav-h)); overflow-y: auto; font-family: 'Inter', system-ui, sans-serif;
    animation: sh-menu-in .18s ease-out; }
  @keyframes sh-menu-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
  .sh-menu .sh-link { font-size: 17px; font-weight: 700; padding: 14px 0; color: #0f172a; text-align: left; border-bottom: 1px solid #f1f5f9; }
  .sh-menu .sh-link[aria-current="page"] { color: #047857; }
  .sh-menu .sh-link[aria-current="page"]::after { display: none; }
  .sh-menu-cta { margin-top: 14px; padding: 14px; background: #10b981; color: #fff; border-radius: 100px; font-size: 16px; font-weight: 800; text-align: center; text-decoration: none; }
  @media (max-width: 900px) { .sh-links { gap: 20px; } }
  @media (max-width: 768px) {
    .sh { padding: 0 20px; }
    .sh-links, .sh-cta { display: none; }
    .sh-ham { display: block; }
  }
  @media (prefers-reduced-motion: reduce) { .sh-menu { animation: none; } }

  .sf { background: #fff; color: #64748b; padding-top: 72px; border-top: 1px solid #e2e8f0; font-family: 'Inter', system-ui, sans-serif; }
  .sf-wrap { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 24px; }
  .sf-grid { display: grid; grid-template-columns: 1.5fr 1fr 1.2fr 1.3fr; gap: 48px; padding-bottom: 60px; border-bottom: 1px solid #e2e8f0; }
  .sf-brand { display: flex; align-items: center; gap: 8px; color: #0f172a; margin-bottom: 16px; text-decoration: none; font-size: 18px; font-weight: 900; letter-spacing: -0.5px; }
  .sf-about { font-size: 14px; line-height: 1.75; margin: 0 0 24px; }
  .sf-socials { display: flex; flex-wrap: wrap; gap: 10px; }
  .sf-social { height: 36px; padding: 0 14px; border-radius: 99px; border: 1px solid #e2e8f0; display: inline-flex; align-items: center;
    font-size: 12px; font-weight: 800; color: #475569; text-decoration: none; }
  .sf-social:hover { border-color: #10b981; color: #10b981; }
  .sf-heading { font-size: 14px; font-weight: 800; color: #0f172a; margin: 0 0 20px; letter-spacing: 0.3px; }
  .sf-links { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .sf-links a, .sf-links button { font: inherit; font-size: 14px; color: #64748b; text-decoration: none; background: none; border: none; cursor: pointer; padding: 0; text-align: left; }
  .sf-links a:hover, .sf-links button:hover { color: #059669; }
  .sf-contact { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; line-height: 1.6; margin-bottom: 14px; color: inherit; text-decoration: none; }
  .sf-contact svg { color: #10b981; flex-shrink: 0; margin-top: 2px; }
  .sf-text { font-size: 14px; line-height: 1.7; margin: 0 0 16px; }
  .sf-start { display: flex; flex-direction: column; gap: 10px; }
  .sf-start .sh-primary { justify-content: center; }
  .sf-more { display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-size: 14px; font-weight: 700; color: #059669; text-decoration: none; }
  .sf-more:hover { color: #047857; }
  .sf-bottom { padding: 24px 0; display: flex; justify-content: space-between; align-items: center; font-size: 13px; flex-wrap: wrap; gap: 12px; }
  .sf-legal { display: flex; gap: 24px; }
  .sf-legal a { color: #64748b; text-decoration: none; }
  .sf-legal a:hover { color: #059669; }
  @media (max-width: 1024px) { .sf-grid { grid-template-columns: 1fr 1fr; gap: 36px; } }
  @media (max-width: 768px) { .sf-grid { grid-template-columns: 1fr; gap: 32px; } .sf-bottom { flex-direction: column; text-align: center; } }
`;

/**
 * `overlay`: the page reserves room for the fixed header itself (the landing hero does);
 * everywhere else a spacer keeps content from starting underneath it.
 */
export function SiteHeader({ overlay = false }) {
  const { user } = useAuth();
  const BUSINESS = useBusiness();
  const location = useLocation();
  const goToSection = useSectionLink();
  const onHome = useHomeLink();
  const [scrolled, setScrolled] = useState(() => window.scrollY > 40);
  const [menuOpen, setMenuOpen] = useState(false);
  const inProjects = location.pathname.startsWith('/projects');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const section = (id, label) => (
    <button type="button" className="sh-link" onClick={() => goToSection(id)}>{label}</button>
  );
  const projectsLink = (
    <Link to="/projects" className="sh-link" aria-current={inProjects ? 'page' : undefined}>Projects</Link>
  );

  return (
    <>
      <style>{CHROME_CSS}</style>
      <header className={`sh ${scrolled ? 'scrolled' : ''}`}>
        <Link to="/" className="sh-logo" onClick={onHome} aria-label={`${BUSINESS.name} home`}>
          <Leaf size={22} color="#10b981" /> <span>{BUSINESS.name}</span>
        </Link>
        <nav aria-label="Main">
          <ul className="sh-links">
            {SECTIONS.map(s => <li key={s.id}>{section(s.id, s.label)}</li>)}
            <li>{projectsLink}</li>
          </ul>
        </nav>
        <div className="sh-cta">
          {user ? (
            <Link to={dashboardPath(user)} className="sh-primary">My Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="sh-ghost">Log In</Link>
              <Link to="/register" className="sh-primary">Sign Up Free</Link>
            </>
          )}
        </div>
        <button type="button" className="sh-ham" onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="site-menu">
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {menuOpen && (
        // Any link or section button in the menu closes it
        <nav id="site-menu" className="sh-menu" aria-label="Main" onClick={e => { if (e.target.closest('a, button')) setMenuOpen(false); }}>
          <Link to="/" className="sh-link" onClick={onHome}
            aria-current={location.pathname === '/' ? 'page' : undefined}>Home</Link>
          {SECTIONS.map(s => <div key={s.id} style={{ display: 'contents' }}>{section(s.id, s.label)}</div>)}
          {projectsLink}
          <Link to="/track-record" className="sh-link" aria-current={location.pathname === '/track-record' ? 'page' : undefined}>Track Record</Link>
          {user ? (
            <Link to={dashboardPath(user)} className="sh-menu-cta">My Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="sh-link" style={{ color: '#475569' }}>Log In</Link>
              <Link to="/register" className="sh-menu-cta">Sign Up Free</Link>
            </>
          )}
        </nav>
      )}
      {!overlay && <div className="sh-spacer" aria-hidden="true" />}
    </>
  );
}

export function SiteFooter() {
  const { user } = useAuth();
  const BUSINESS = useBusiness();  // the owner edits it in Business profile
  const goToSection = useSectionLink();
  const onHome = useHomeLink();
  return (
    <footer className="sf">
      <style>{CHROME_CSS}</style>
      <div className="sf-wrap">
        <div className="sf-grid">
          <div>
            <Link to="/" className="sf-brand" onClick={onHome}><Leaf size={20} color="#10b981" /> {BUSINESS.name}</Link>
            <p className="sf-about">
              {BUSINESS.tagline}{BUSINESS.foundedYear ? ` Serving gardens since ${BUSINESS.foundedYear}.` : ''}
            </p>
            {/* Only real profiles: an empty link hides the button */}
            {Object.values(BUSINESS.social).some(Boolean) && (
              <div className="sf-socials">
                {[['facebook', 'Facebook'], ['instagram', 'Instagram'], ['tiktok', 'TikTok']].filter(([k]) => BUSINESS.social[k]).map(([k, label]) => (
                  <a key={k} href={BUSINESS.social[k]} target="_blank" rel="noreferrer" className="sf-social">{label}</a>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="sf-heading">Quick Links</h4>
            <ul className="sf-links">
              <li><Link to="/try-studio" onPointerEnter={prefetchStudio}>Free 3D Studio</Link></li>
              <li><Link to="/ai-designer">AI Designer</Link></li>
              <li><Link to="/projects">Our Projects</Link></li>
              <li><Link to="/track-record">Track Record</Link></li>
              {SECTIONS.map(s => <li key={s.id}><button type="button" onClick={() => goToSection(s.id)}>{s.label}</button></li>)}
              {user ? (
                <li><Link to={dashboardPath(user)}>My Dashboard</Link></li>
              ) : (
                <>
                  <li><Link to="/login">Login</Link></li>
                  <li><Link to="/register">Sign Up</Link></li>
                </>
              )}
            </ul>
          </div>

          {/* Contact — from the Business profile; empty fields are not shown */}
          <div>
            <h4 className="sf-heading">Contact Us</h4>
            {BUSINESS.address && <div className="sf-contact"><MapPin size={16} /><span>{BUSINESS.address}</span></div>}
            {BUSINESS.phone && (
              <a href={`tel:${BUSINESS.phone.replace(/\s/g, '')}`} className="sf-contact"><Phone size={16} /><span>{BUSINESS.phone}</span></a>
            )}
            {BUSINESS.email && (
              <a href={`mailto:${BUSINESS.email}`} className="sf-contact"><Mail size={16} /><span>{BUSINESS.email}</span></a>
            )}
            {BUSINESS.serviceArea && <div className="sf-contact"><Leaf size={16} /><span>Serving {BUSINESS.serviceArea}</span></div>}
          </div>

          <div>
            <h4 className="sf-heading">Get Started</h4>
            <p className="sf-text">Plan your garden in 3D for free, then book our crew when you're ready.</p>
            <div className="sf-start">
              <Link to="/try-studio" className="sh-primary" onPointerEnter={prefetchStudio}>Design my garden free</Link>
              <Link to="/projects" className="sf-more">See finished projects <ArrowRight size={14} /></Link>
            </div>
          </div>
        </div>

        <div className="sf-bottom">
          <p style={{ margin: 0 }}>© {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.</p>
          <div className="sf-legal">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
