import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardPath } from '../data/roleHome';

// Where the installed app opens (manifest start_url "/app"): your own home if you're signed in,
// the landing page if not. Keeps customers out of staff screens and crew straight on their jobs.
export default function AppHome() {
  const { user } = useAuth();
  return <Navigate to={user ? dashboardPath(user) : '/'} replace />;
}
