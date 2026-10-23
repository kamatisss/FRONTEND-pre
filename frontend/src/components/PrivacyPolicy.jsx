import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { SiteHeader, SiteFooter } from './SiteChrome';
import { useBusiness } from '../services/business';

/*
 * Privacy notice (Data Privacy Act of 2012, RA 10173). Customers agree to it at sign-up; the server
 * records which version (BACKEND serializers.PRIVACY_POLICY_VERSION — change both together).
 * It describes what this system really does; when a feature changes what is collected or who
 * receives it, update this page. The owner should read it through before going live.
 */
export const PRIVACY_UPDATED = 'October 23, 2026';

const Section = ({ title, children }) => (
  <section className="mt-9">
    <h2 className="m-0 text-xl font-extrabold text-slate-900 tracking-tight">{title}</h2>
    <div className="mt-3 text-[15px] leading-relaxed text-slate-700 flex flex-col gap-3">{children}</div>
  </section>
);

const List = ({ items }) => (
  <ul className="m-0 pl-5 flex flex-col gap-1.5">
    {items.map(([label, text]) => <li key={label}><b className="text-slate-900">{label}</b> {text}</li>)}
  </ul>
);

export default function PrivacyPolicy() {
  const { name, email, phone, address } = useBusiness();
  const contact = [email && `email ${email}`, phone && `call ${phone}`].filter(Boolean).join(' or ');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <SiteHeader />
      <main className="flex-1 px-4 py-12 sm:py-16">
        <article className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-10">
          <span className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><ShieldCheck size={24} /></span>
          <h1 className="m-0 mt-5 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Privacy Notice</h1>
          <p className="m-0 mt-2 text-sm text-slate-500">Last updated {PRIVACY_UPDATED}</p>
          <p className="m-0 mt-5 text-[15px] leading-relaxed text-slate-700">
            {name} designs and builds gardens. To do that we need some information about you and your property.
            This notice explains, in plain words, what we collect, why, who else sees it, how long we keep it and
            what your rights are under the Data Privacy Act of 2012 (Republic Act No. 10173).
          </p>

          <Section title="What we collect">
            <List items={[
              ['Your account:', 'name, username, email address and password (stored scrambled; nobody at our company can read it).'],
              ['Bookings and orders:', 'service or delivery address, contact number, preferred dates, your notes, and the site location if you share it.'],
              ['Your garden designs:', 'the designs you make in the 3D Studio or AI Designer, and any photo of your yard you upload.'],
              ['Payments:', 'the amount, method and status of each payment. Card and e-wallet details are entered on PayMongo and never reach us.'],
              ['Reviews:', 'the rating and comment you leave, shown the way you choose when you write it.'],
              ['Site photos:', 'before, during and after photos our crew take of the work. Location data is removed from every photo.'],
              ['Our staff:', 'crew working hours, and the phone location at the moment they start and end a job (to confirm they are on site).'],
              ['Alerts:', 'if you turn on phone notifications, the address your browser gives us for sending them.'],
            ]} />
          </Section>

          <Section title="Why we use it">
            <p className="m-0">Only to run our service: to price and plan your garden, schedule and carry out the work, deliver your order,
              take payment, send you updates about your booking or order, answer your questions, and keep the records the law requires.
              We do not sell your information and we do not use it for advertising.</p>
          </Section>

          <Section title="Who else receives it">
            <List items={[
              ['PayMongo', 'processes online payments (GCash, Maya, cards).'],
              ['Google (Gemini AI)', 'receives your design request, and the yard photo if you upload one, to suggest a layout. Your name and contact details are not sent.'],
              ['Our hosting and email providers', 'store the system and send our emails, under their own security obligations.'],
              ['Browser notification services', '(Google, Mozilla, Apple) deliver phone alerts if you turn them on.'],
            ]} />
            <p className="m-0">Our crew see the address, contact number and notes of the jobs they are assigned to, and nothing else.
              We may also disclose information when the law or a court requires it.</p>
          </Section>

          <Section title="What is ever shown publicly">
            <p className="m-0">A finished garden appears in our <Link to="/projects" className="text-emerald-700 font-semibold">project gallery</Link> only
              if you give separate permission for that project, and only in the way you choose (for example, first name and last initial, or anonymous,
              with or without the house). You can withdraw that permission at any time from your account.</p>
          </Section>

          <Section title="How long we keep it">
            <List items={[
              ['Your account and designs:', 'until you ask us to delete them.'],
              ['Bookings, orders and payments:', 'as long as tax and accounting rules require, even after an account is closed.'],
              ['Backups:', 'a daily copy of the system is kept for 7 days, then replaced.'],
              ['On a crew phone:', 'jobs and photos saved for use without signal are wiped when the crew member signs out.'],
            ]} />
          </Section>

          <Section title="How we protect it">
            <p className="m-0">Connections are encrypted (HTTPS), passwords are stored scrambled, sign-in attempts are limited, and each person
              in our team sees only what their role needs. Location data is removed from uploaded photos.</p>
          </Section>

          <Section title="Your rights">
            <p className="m-0">Under the Data Privacy Act you have the right to be informed, to access your information, to have it corrected,
              to object to its use, to have it deleted or blocked, to receive a copy in a common format, and to be compensated
              for damage caused by its misuse. If you believe we have mishandled your information, you can complain to the
              National Privacy Commission (<a href="https://privacy.gov.ph" target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-semibold">privacy.gov.ph</a>).</p>
          </Section>

          <Section title="Contact us">
            <p className="m-0">For any privacy question or request, {contact ? <>{contact}</> : 'contact us through the details at the bottom of this page'}
              {address ? <>, or write to us at {address}</> : null}. We will answer within 15 days.</p>
          </Section>

          <Section title="Changes to this notice">
            <p className="m-0">If we change what we collect or who receives it, we will update this page and its date. When you create an account,
              we keep a record of the version you agreed to.</p>
          </Section>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
