import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
// import TopBar from "./TopBar";

export default function Layout() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Sidebar />
      <div className="ml-[240px] min-h-screen">
        {/* <TopBar /> */}
        <main className="app-shell-grid min-h-screen bg-surface px-6 pb-8 pt-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
