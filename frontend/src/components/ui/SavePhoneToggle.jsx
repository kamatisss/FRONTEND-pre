// "Save as my mobile number" under a phone field (services/me.js): only for signed-in people, and only
// when the typed number is valid and isn't already the one on their account.
import { phoneDiffers } from '../../services/me';
import { normalizePhMobile } from '../../services/checkout';

export default function SavePhoneToggle({ me, phone, checked, onChange, id = 'save-phone' }) {
  if (!phoneDiffers(me, phone)) return null;
  const number = normalizePhMobile(phone);
  return (
    <label htmlFor={id} className="mt-1.5 flex items-start gap-2 text-xs text-slate-600 cursor-pointer min-h-[32px]">
      <input id={id} type="checkbox" className="w-4 h-4 mt-px accent-emerald-600 shrink-0" checked={checked}
        onChange={e => onChange(e.target.checked)} />
      <span>{me.phone
        ? <>Use <b className="text-slate-800">{number}</b> as my mobile number from now on (instead of {me.phone})</>
        : <>Save <b className="text-slate-800">{number}</b> as my mobile number for next time</>}</span>
    </label>
  );
}
