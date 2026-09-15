import "./admin-console.css";
import "../reseller/reseller.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-console-root">{children}</div>;
}
