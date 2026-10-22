// Each person's home screen: the owner's Business overview, staff and crew the staff app (crew land on
// "Today"), customers their dashboard. Used by the site header and by the installed app's start page.
export const dashboardPath = (user) =>
  user?.is_superuser ? '/admin-dashboard' : user?.is_staff ? '/staff-dashboard' : '/user-dashboard';
