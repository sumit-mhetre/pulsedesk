import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'

import AuthLayout          from './layouts/AuthLayout'
import DashLayout          from './layouts/DashLayout'
import SuperLayout         from './layouts/SuperLayout'

import LoginPage           from './pages/auth/LoginPage'
import DashboardPage       from './pages/dashboard/DashboardPage'
import SettingsPage        from './pages/settings/SettingsPage'
import UsersPage           from './pages/users/UsersPage'
import ProfilePage         from './pages/users/ProfilePage'
import PatientsPage        from './pages/patients/PatientsPage'
import PatientDetailPage   from './pages/patients/PatientDetailPage'
import QueuePage           from './pages/appointments/QueuePage'
import MasterDataPage      from './pages/masterdata/MasterDataPage'
import PrescriptionsPage   from './pages/prescriptions/PrescriptionsPage'
import NewPrescriptionPage from './pages/prescriptions/NewPrescriptionPage'
import ViewPrescriptionPage from './pages/prescriptions/ViewPrescriptionPage'
import BillsPage      from './pages/billing/BillsPage'
import ReportsPage      from './pages/reports/ReportsPage'
import TemplatesPage    from './pages/templates/TemplatesPage'
import TemplateEditorPage  from './pages/templates/TemplateEditorPage'
import NewBillPage    from './pages/billing/NewBillPage'
import ViewBillPage   from './pages/billing/ViewBillPage'
import SuperDashboard      from './pages/super/SuperDashboard'
import SuperClinics        from './pages/super/SuperClinics'
import SuperCreateClinic   from './pages/super/SuperCreateClinic'

import PrivateRoute  from './components/guards/PrivateRoute'
import SuperRoute    from './components/guards/SuperRoute'
import RoleRoute     from './components/guards/RoleRoute'
import LoadingScreen from './components/ui/LoadingScreen'

export default function App() {
  const { init, isLoading } = useAuthStore()
  useEffect(() => { init() }, [])
  if (isLoading) return <LoadingScreen />

  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<SuperRoute />}>
        <Route element={<SuperLayout />}>
          <Route path="/super/dashboard"   element={<SuperDashboard />} />
          <Route path="/super/clinics"     element={<SuperClinics />} />
          <Route path="/super/clinics/new" element={<SuperCreateClinic />} />
        </Route>
      </Route>

      <Route element={<PrivateRoute />}>
        <Route element={<DashLayout />}>
          <Route path="/dashboard"              element={<DashboardPage />} />
          <Route path="/profile"                element={<ProfilePage />} />
          <Route path="/patients"               element={<PatientsPage />} />
          <Route path="/patients/:id"           element={<PatientDetailPage />} />
          <Route path="/queue"                  element={<QueuePage />} />
          <Route path="/prescriptions"          element={<PrescriptionsPage />} />
          <Route path="/prescriptions/new"      element={<NewPrescriptionPage />} />
          <Route path="/prescriptions/:id"      element={<ViewPrescriptionPage />} />
          <Route path="/prescriptions/:id/edit"  element={<NewPrescriptionPage />} />
          <Route path="/billing"       element={<BillsPage />} />
          <Route path="/reports"         element={<ReportsPage />} />
          <Route path="/templates"        element={<TemplatesPage />} />
          <Route path="/templates/new"    element={<TemplateEditorPage />} />
          <Route path="/templates/:id/edit"  element={<TemplateEditorPage />} />
          {/* Old URLs redirected to /settings for backwards compatibility */}
          <Route path="/page-designer" element={<Navigate to="/settings" replace />} />
          <Route path="/clinic/setup"  element={<Navigate to="/settings" replace />} />
          <Route path="/billing/new"   element={<NewBillPage />} />
          <Route path="/billing/:id"   element={<ViewBillPage />} />
          <Route element={<RoleRoute roles={['ADMIN']} />}>
            <Route path="/settings"             element={<SettingsPage />} />
            <Route path="/users"                element={<UsersPage />} />
            <Route path="/master-data"          element={<MasterDataPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
