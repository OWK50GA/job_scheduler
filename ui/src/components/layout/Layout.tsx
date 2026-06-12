import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#051424",
      }}
    >
      <Sidebar />
      <div
        style={{
          flex: 1,
          marginLeft: "240px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <TopBar />
        <main style={{ paddingTop: "60px", padding: "1.5rem", flex: 1 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
