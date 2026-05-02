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
import DocumentsListPage  from './pages/documents/DocumentsListPage'
import NewDocumentPage    from './pages/documents/NewDocumentPage'
import ViewDocumentPage   from './pages/documents/ViewDocumentPage'
import SuperDashboard      from './pages/super/SuperDashboard'
import SuperClinics        from './pages/super/SuperClinics'
import SuperCreateClinic   from './pages/super/SuperCreateClinic'
import SuperActivity       from './pages/super/SuperActivity'

// IPD pages
import BedBoardPage              from './pages/ipd/BedBoardPage'
import BedManagementPage         from './pages/ipd/BedManagementPage'
import AdmissionsListPage        from './pages/ipd/AdmissionsListPage'
import NewAdmissionPage          from './pages/ipd/NewAdmissionPage'
import AdmissionDetailPage       from './pages/ipd/AdmissionDetailPage'
import DischargeSummaryPrint     from './pages/ipd/DischargeSummaryPrint'
import IPDDashboardPage          from './pages/ipd/IPDDashboardPage'
import ProcurementSlipPrint      from './pages/ipd/ProcurementSlipPrint'
import SampleCollectionSlipPrint from './pages/ipd/SampleCollectionSlipPrint'

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
          <Route path="/super/activity"    element={<SuperActivity />} />
        </Route>
      </Route>

      {/* Print routes — full screen, no DashLayout wrapper.
          Authenticated but no sidebar / header so window.print() outputs only
          the document. Pattern matches existing prescription/bill print pages. */}
      <Route element={<PrivateRoute />}>
        <Route element={<RoleRoute requires={['manageIPD']} />}>
          <Route path="/ipd/admissions/:id/discharge-summary/print" element={<DischargeSummaryPrint />} />
          <Route path="/ipd/admissions/:id/procurement-slip/print"  element={<ProcurementSlipPrint />} />
          <Route path="/ipd/admissions/:id/sample-slip/print"       element={<SampleCollectionSlipPrint />} />
        </Route>
      </Route>

      <Route element={<PrivateRoute />}>
        <Route element={<DashLayout />}>
          <Route path="/dashboard"              element={<DashboardPage />} />
          <Route path="/profile"                element={<ProfilePage />} />
          <Route path="/patients"               element={<PatientsPage />} />
          <Route path="/patients/:id"           element={<PatientDetailPage />} />
          <Route path="/queue"                  element={<QueuePage />} />

          {/* Prescriptions */}
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

          {/* Documents */}
          <Route element={<RoleRoute requires={['viewDocuments']} />}>
            <Route path="/documents"          element={<DocumentsListPage />} />
            <Route path="/documents/:id/view" element={<ViewDocumentPage />} />
          </Route>
          <Route element={<RoleRoute requires={['createDocuments']} />}>
            <Route path="/documents/new"       element={<NewDocumentPage />} />
            <Route path="/documents/:id/edit"  element={<NewDocumentPage />} />
          </Route>

          {/* Templates */}
          <Route element={<RoleRoute requires={['viewPrescriptions']} />}>
            <Route path="/templates"        element={<TemplatesPage />} />
          </Route>
          <Route element={<RoleRoute requires={['manageTemplates']} />}>
            <Route path="/templates/new"       element={<TemplateEditorPage />} />
            <Route path="/templates/:id/edit"  element={<TemplateEditorPage />} />
          </Route>

          {/* Old URL redirects */}
          <Route path="/page-designer" element={<Navigate to="/settings" replace />} />
          <Route path="/clinic/setup"  element={<Navigate to="/settings" replace />} />

          {/* Admin area */}
          <Route element={<RoleRoute requires={['manageSettings']} />}>
            <Route path="/settings"             element={<SettingsPage />} />
          </Route>
          <Route element={<RoleRoute requires={['manageUsers']} />}>
            <Route path="/users"                element={<UsersPage />} />
          </Route>
          <Route element={<RoleRoute requires={['manageMasterData']} />}>
            <Route path="/master-data"          element={<MasterDataPage />} />
          </Route>

          {/* IPD module — sidebar hides routes when ipdEnabled=false; backend
              re-enforces with requireIPD middleware. */}
          <Route element={<RoleRoute requires={['manageIPD']} />}>
            <Route path="/ipd/dashboard"           element={<IPDDashboardPage />} />
            <Route path="/ipd/beds"                element={<BedBoardPage />} />
          </Route>
          <Route element={<RoleRoute requires={['manageBeds']} />}>
            <Route path="/ipd/bed-management"      element={<BedManagementPage />} />
          </Route>
          <Route element={<RoleRoute requires={['manageIPD']} />}>
            <Route path="/ipd/admissions"          element={<AdmissionsListPage />} />
            <Route path="/ipd/admissions/:id"      element={<AdmissionDetailPage />} />
          </Route>
          <Route element={<RoleRoute requires={['manageAdmissions']} />}>
            <Route path="/ipd/admissions/new"      element={<NewAdmissionPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
