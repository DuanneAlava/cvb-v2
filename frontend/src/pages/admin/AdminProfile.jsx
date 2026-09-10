import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

/*
 * "Admin Profile" in the sidebar.
 *
 * An administrator looking at their own account wants the same screen they
 * look at everybody else's on - their details, their figures, their
 * submissions - so this sends them there rather than being a second, slightly
 * different profile page that would have to be kept in step with the first.
 *
 * The controls that should not apply to yourself (suspend, delete, change your
 * own role) are already disabled inside that page.
 */
function AdminProfile() {
  const { user } = useAuth();
  return <Navigate to={`/admin/users/${user.id}`} replace />;
}

export default AdminProfile;
