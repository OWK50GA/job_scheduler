import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import JobsLedger from "./pages/JobsLedger";
import CreateJob from "./pages/CreateJob";
import DLQOverview from "./pages/DLQOverview";
import DLQDetail from "./pages/DLQDetail";
import Settings from "./pages/Settings";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/jobs" element={<JobsLedger />} />
        <Route path="/jobs/new" element={<CreateJob />} />
        <Route path="/jobs/dlq" element={<DLQOverview />} />
        <Route path="/jobs/dlq/:id" element={<DLQDetail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
