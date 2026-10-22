import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, CalendarCheck, Star, Repeat, Ruler, Trees, ThumbsUp, FileText, Award, Users, BadgeCheck, ArrowRight,
} from 'lucide-react';
import { getTrackRecord, getPublicProjects } from '../services/api';
import { PublicHeader, ProjectCard } from './ProjectHub';
import { SiteFooter } from './SiteChrome';
import { fmtDate } from '../data/projectHub';

/* /track-record — live numbers from signed-off jobs + admin-entered credentials. */

const CREDENTIAL_ICONS = { registration: BadgeCheck, permit: FileText, certification: ShieldCheck, award: Award, partnership: Users };

export default function TrackRecord() {
  const [data,     setData]     = useState(null);
  const [error,    setError]    = useState(null);
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    getTrackRecord().then(setData).catch(e => setError(e.message));
    getPublicProjects({ featured: 1, limit: 3 })
      .then(d => (d.results.length ? d.results : getPublicProjects({ limit: 3 }).then(r => r.results)))
      .then(setFeatured)
      .catch(() => {});
  }, []);

  const st = data?.stats;
  // Only numbers that are real and non-zero — never pad the record
  const tiles = st ? [
    st.projects_completed > 0 && { Icon: CalendarCheck, value: st.projects_completed.toLocaleString(), label: 'Projects completed' },
    st.average_rating && { Icon: Star, value: `${st.average_rating}★`, label: `Average rating · ${st.review_count.toLocaleString()} reviews` },
    st.repeat_customers > 0 && { Icon: Repeat, value: st.repeat_customers.toLocaleString(), label: `Repeat customers · ${Math.round((st.repeat_customers / st.customers) * 100)}% come back` },
    st.area_sqm > 0 && { Icon: Ruler, value: `${st.area_sqm.toLocaleString()} m²`, label: 'Landscaped from Studio designs' },
    st.plants_installed > 0 && { Icon: Trees, value: st.plants_installed.toLocaleString(), label: 'Plants installed from Studio designs' },
    st.years_in_business > 0 && { Icon: ThumbsUp, value: st.years_in_business, label: `Years in business · since ${st.founded_year}` },
  ].filter(Boolean) : [];
  const credentials = data?.credentials || [];

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <PublicHeader />
      <section className="bg-gradient-to-b from-emerald-50 to-slate-50 border-b border-emerald-100">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
          <p className="inline-flex items-center gap-1.5 text-xs font-extrabold tracking-widest uppercase text-emerald-700 bg-white border border-emerald-200 rounded-full px-3 py-1 m-0 mb-4">
            <ShieldCheck size={13} /> Track record
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight m-0 mb-3">Proof, not promises</h1>
          <p className="text-lg text-slate-500 max-w-2xl m-0 leading-relaxed">
            These numbers are calculated live from jobs our office has signed off and reviews left by real customers.
          </p>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-10 flex flex-col gap-14">
        {error ? <p className="text-red-600 font-semibold m-0">{error}</p> : !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => <div key={i} className="h-36 bg-white border border-slate-200 rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <section>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tiles.map(({ Icon, value, label }) => (
                <div key={label} className="bg-white border border-slate-200 rounded-2xl p-6">
                  <Icon size={20} className="text-emerald-500 mb-3" />
                  <p className="text-3xl md:text-4xl font-black text-slate-900 m-0 mb-1 tracking-tight">{value}</p>
                  <p className="text-sm text-slate-500 m-0">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3 mb-0">
              As of {new Date(`${data.as_of}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'long' })}.
            </p>
          </section>
        )}

        {credentials.length > 0 && (
          <section>
            <h2 className="text-2xl font-black text-slate-900 m-0 mb-1">Registrations, permits &amp; recognition</h2>
            <p className="text-sm text-slate-500 m-0 mb-5">Current documents only. Expired ones are removed automatically.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {credentials.map(c => {
                const Icon = CREDENTIAL_ICONS[c.kind] || FileText;
                return (
                  <div key={`${c.kind}-${c.title}-${c.issued_on}`} className="bg-white border border-slate-200 rounded-2xl p-5 flex gap-4">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><Icon size={20} /></div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 m-0">{c.kind_display}</p>
                      <p className="font-extrabold text-slate-900 m-0">{c.title}</p>
                      {(c.issuer || c.reference_no) && (
                        <p className="text-sm text-slate-500 m-0">{[c.issuer, c.reference_no && `No. ${c.reference_no}`].filter(Boolean).join(' · ')}</p>
                      )}
                      {(c.issued_on || c.expires_on) && (
                        <p className="text-xs text-slate-400 m-0 mt-1">
                          {[c.issued_on && `Issued ${fmtDate(c.issued_on)}`, c.expires_on && `Valid until ${fmtDate(c.expires_on)}`].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {c.document_url && (
                        <a href={c.document_url} target="_blank" rel="noopener noreferrer"
                           className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 mt-2">
                          <FileText size={12} /> View document
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {featured.length > 0 && (
          <section>
            <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
              <h2 className="text-2xl font-black text-slate-900 m-0">Recent projects</h2>
              <Link to="/projects" className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600 no-underline">
                See all projects <ArrowRight size={15} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featured.map(p => <ProjectCard key={p.slug} project={p} />)}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
