// Final design approval (backend design_review.py): what each state means to each person.
// States: none | draft | sent | changes | changed | approved

export const fmtReviewDate = (iso) => (iso
  ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  : '');

// tone: emerald (done) · amber (someone has to act) · slate (waiting)
export function officeReviewText(review) {
  const r = review || {};
  switch (r.state) {
    case 'approved':
      return { tone: 'emerald', label: r.approved_in_person ? 'Approved in person' : 'Approved by customer',
        help: `Version ${r.approved_revision}, ${fmtReviewDate(r.approved_at)}${r.approved_by ? ` (${r.approved_by})` : ''}. The crew builds this version.` };
    case 'sent':
      return { tone: 'slate', label: 'Waiting for the customer',
        help: 'The customer has been asked to approve it. You can also record an in-person approval.' };
    case 'changes':
      return { tone: 'amber', label: 'Customer asked for changes',
        help: 'Adjust the design in the Studio, then send it again.' };
    case 'changed':
      return { tone: 'amber', label: 'Changed since it was sent',
        help: 'The design was edited after the customer saw it. Send it again so they approve this version.' };
    case 'draft':
      return { tone: 'amber', label: 'Not sent yet',
        help: 'After the site visit, adjust the design in the Studio if the yard needs it, then send it to the customer to approve.' };
    default:
      return null;
  }
}

export function customerReviewText(review) {
  const r = review || {};
  switch (r.state) {
    case 'approved':
      return { tone: 'emerald', label: 'Final design approved',
        help: `You approved it on ${fmtReviewDate(r.approved_at)}. This is the design our crew will build.` };
    case 'sent':
      return { tone: 'amber', label: 'Your final design is ready',
        help: 'We adjusted your design to your yard. Please look at it and approve it, or tell us what to change.' };
    case 'changes':
      return { tone: 'slate', label: 'We are updating your design',
        help: "Thanks for your feedback. We'll send you the updated design to approve." };
    case 'changed':
      return { tone: 'slate', label: 'We are updating your design',
        help: "We're making a few changes. We'll send you the final version to approve." };
    case 'draft':
      return { tone: 'slate', label: 'Final design: after the site visit',
        help: "We'll check your design against your yard, adjust it if needed, and send you the final version to approve before any work starts." };
    default:
      return null;
  }
}

export function crewReviewText(review) {
  const r = review || {};
  if (r.state === 'none' || !r.state) return null;
  if (r.state === 'approved') {
    return { tone: 'emerald', label: 'Final design', help: `Approved ${fmtReviewDate(r.approved_at)}. Build this version.` };
  }
  return { tone: 'amber', label: 'Design not final', help: 'The customer has not approved the final design yet. Check with the office before planting.' };
}

export const TONE_CLASSES = {
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  slate: 'bg-slate-50 text-slate-700 border-slate-200',
};
