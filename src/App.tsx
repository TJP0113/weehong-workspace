import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import { useApp } from './lib/app';
import Board from './pages/Board';
import CalendarPage from './pages/CalendarPage';
import Home from './pages/Home';
import InspectionDetail from './pages/InspectionDetail';
import Inspections from './pages/Inspections';
import Login, { NoAccess } from './pages/Login';
import NewWorksheet from './pages/NewWorksheet';
import Parts from './pages/Parts';
import PrintWorksheet from './pages/PrintWorksheet';
import RentalDetail from './pages/RentalDetail';
import Rentals from './pages/Rentals';
import Search from './pages/Search';
import Settings from './pages/settings/Settings';
import Transport from './pages/Transport';
import WorksheetDetail from './pages/WorksheetDetail';
import Worksheets from './pages/Worksheets';

export default function App() {
  const { ready, authUser, staff } = useApp();
  const loc = useLocation();
  if (!ready) return <div style={{ padding: 40 }}><Loading /></div>;
  if (!authUser) return <Login />;
  if (!staff) return <NoAccess />;
  if (loc.pathname.endsWith('/print')) {
    return <Routes><Route path="/worksheets/:id/print" element={<PrintWorksheet />} /></Routes>;
  }
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/board" element={<Board />} />
        <Route path="/worksheets" element={<Worksheets />} />
        <Route path="/worksheets/new" element={<NewWorksheet />} />
        <Route path="/worksheets/:id" element={<WorksheetDetail />} />
        <Route path="/parts" element={<Parts />} />
        <Route path="/rentals" element={<Rentals />} />
        <Route path="/rentals/:code" element={<RentalDetail />} />
        <Route path="/inspections" element={<Inspections />} />
        <Route path="/inspections/:id" element={<InspectionDetail />} />
        <Route path="/transport" element={<Transport />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/search" element={<Search />} />
        <Route path="/settings/*" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
