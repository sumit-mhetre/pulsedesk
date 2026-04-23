import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'

import AuthLayout          from './layouts/AuthLayout'
import DashLayout          from './layouts/DashLayout'
import SuperLayout         from './layouts/SuperLayout'

import LoginPage           from './pages/auth/LoginPage'
import ForgotPasswordPage  from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage   from './pages/auth/ResetPasswordPage'
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
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />
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

          {/* Prescriptions — viewPrescriptions to list/view; createPrescriptions to add/edit */}
          <Route element={<RoleRoute requires={['viewPrescriptions']} />}>
            <Route path="/prescriptions"       element={<PrescriptionsPage />} />
            <Route path="/prescriptions/:id"   element={<ViewPrescriptionPage />} />
          </Route>
          <Route element={<RoleRoute requires={['createPrescriptions']} />}>
            <Route path="/prescriptions/new"       element={<NewPrescriptionPage />} />
            <Route path="/prescriptions/:id/edit"  element={<NewPrescriptionPage />} />
          </Route>

          {/* Billing */}
          <Route element={<RoleRoute requires={['viewBilling']} />}>
            <Route path="/billing"       element={<BillsPage />} />
            <Route path="/billing/:id"   element={<ViewBillPage />} />
          </Route>
          <Route element={<RoleRoute requires={['createBilling']} />}>
            <Route path="/billing/new"   element={<NewBillPage />} />
          </Route>

          {/* Reports */}
          <Route element={<RoleRoute requires={['viewReports']} />}>
            <Route path="/reports"         element={<ReportsPage />} />
          </Route>

          {/* Templates */}
          <Route element={<RoleRoute requires={['viewPrescriptions']} />}>
            <Route path="/templates"        element={<TemplatesPage />} />
          </Route>
          <Route element={<RoleRoute requires={['manageTemplates']} />}>
            <Route path="/templates/new"       element={<TemplateEditorPage />} />
            <Route path="/templates/:id/edit"  element={<TemplateEditorPage />} />
          </Route>

          {/* Old URLs redirected to /settings for backwards compatibility */}
          <Route path="/page-designer" element={<Navigate to="/settings" replace />} />
          <Route path="/clinic/setup"  element={<Navigate to="/settings" replace />} />

          {/* Admin area — permission-gated */}
          <Route element={<RoleRoute requires={['manageSettings']} />}>
            <Route path="/settings"             element={<SettingsPage />} />
          </Route>
          <Route element={<RoleRoute requires={['manageUsers']} />}>
            <Route path="/users"                element={<UsersPage />} />
          </Route>
          <Route element={<RoleRoute requires={['manageMasterData']} />}>
            <Route path="/master-data"          element={<MasterDataPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
