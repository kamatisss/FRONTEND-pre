import { Pencil } from 'lucide-react';
import { describeEdits } from '../data/designEdits';

// Booking / design views for staff and crew: "the customer changed the AI design" (dimensions.customerEdits,
// or the older bare editedByCustomer flag). Nothing for designs nobody edited.
export default function CustomerEditsNote({ dimensions, className = '' }) {
  const edits = dimensions?.customerEdits;
  if (!edits && !dimensions?.editedByCustomer) return null;
  const what = describeEdits(edits);
  const left = edits?.notesLeft || 0;
  return (
    <p title={edits?.notes?.length ? edits.notes.join(' / ') : undefined} className={`inline-flex items-start gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 m-0 ${className}`}>
      <Pencil size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        Customer edited the AI design{what ? `: ${what}` : ''}.
        {left > 0 && ` ${left} designer's note${left > 1 ? 's' : ''} left as is: check on the site visit.`}
      </span>
    </p>
  );
}
