import { isAdminAuthenticated } from "../../lib/auth";
import { AdminConsole } from "../../components/admin-console";
import { AdminLogin } from "../../components/admin-login";

export default async function AdminPage() {
  const authenticated = await isAdminAuthenticated();
  return authenticated ? <AdminConsole /> : <AdminLogin />;
}

