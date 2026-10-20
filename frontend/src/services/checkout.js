// Checkout rules shared by the Shop and the Studio panel. The backend enforces the same
// rules (views_api.checkout); these only let the form explain them before submitting.

/** '0917 123 4567', '+63 917-123-4567', '639171234567' -> '09171234567'; null if not a PH mobile. */
export const normalizePhMobile = (raw) => {
  const match = String(raw || '').replace(/[\s\-().]/g, '').match(/^(?:\+?63|0)?(9\d{9})$/);
  return match ? `0${match[1]}` : null;
};

export const PHONE_HINT = 'Enter an 11-digit mobile number, e.g. 09171234567.';

/** Why Cash on Delivery can't be used for this order, or null if it can. codMax 0 = no limit. */
export const codBlockReason = ({ total, codMax, loggedIn }) => {
  if (!loggedIn) return 'Log in to use Cash on Delivery';
  if (codMax > 0 && total > codMax) return `COD is for orders up to ₱${codMax.toLocaleString()}`;
  return null;
};
