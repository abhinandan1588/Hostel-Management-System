import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { Loader } from './components/common/States'
import { ProtectedRoute, PublicOnlyRoute } from './components/common/ProtectedRoute'
import { AdminLayout, ParentLayout, StudentLayout } from './components/layout/AppShell'
import { ROLES, useAuth } from './context/auth'

/* --- public / shared ---------------------------------------------------- */
const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))
const PendingVerification = lazy(() => import('./pages/auth/PendingVerification'))
const NotFound = lazy(() => import('./pages/NotFound'))

/* --- admin -------------------------------------------------------------- */
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminStudents = lazy(() => import('./pages/admin/Students'))
const AdminStudentProfile = lazy(() => import('./pages/admin/StudentProfile'))
const AdminParents = lazy(() => import('./pages/admin/Parents'))
const AdminParentProfile = lazy(() => import('./pages/admin/ParentProfile'))
const AdminRooms = lazy(() => import('./pages/admin/Rooms'))
const AdminAttendance = lazy(() => import('./pages/admin/Attendance'))
const AdminActivities = lazy(() => import('./pages/admin/Activities'))
const AdminHealth = lazy(() => import('./pages/admin/Health'))
const AdminMeals = lazy(() => import('./pages/admin/Meals'))
const AdminSchool = lazy(() => import('./pages/admin/SchoolTracking'))
const AdminProgress = lazy(() => import('./pages/admin/Progress'))
const AdminSuggestions = lazy(() => import('./pages/admin/Suggestions'))
const AdminNotifications = lazy(() => import('./pages/admin/Notifications'))
const AdminAnnouncements = lazy(() => import('./pages/admin/Announcements'))
const AdminEmergency = lazy(() => import('./pages/admin/Emergency'))
const AdminReports = lazy(() => import('./pages/admin/Reports'))
const AdminSettings = lazy(() => import('./pages/admin/Settings'))
const AdminProfile = lazy(() => import('./pages/admin/Profile'))

/* --- parent ------------------------------------------------------------- */
const ParentDashboard = lazy(() => import('./pages/parent/Dashboard'))
const ParentChildren = lazy(() => import('./pages/parent/Children'))
const ParentChildProfile = lazy(() => import('./pages/parent/ChildProfile'))
const ParentChildDaily = lazy(() => import('./pages/parent/ChildDailyActivity'))
const ParentChildAttendance = lazy(() => import('./pages/parent/ChildAttendance'))
const ParentChildHealth = lazy(() => import('./pages/parent/ChildHealth'))
const ParentChildMeals = lazy(() => import('./pages/parent/ChildMeals'))
const ParentChildSchool = lazy(() => import('./pages/parent/ChildSchool'))
const ParentChildProgress = lazy(() => import('./pages/parent/ChildProgress'))
const ParentSuggestions = lazy(() => import('./pages/parent/Suggestions'))
const ParentNotifications = lazy(() => import('./pages/parent/Notifications'))
const ParentAnnouncements = lazy(() => import('./pages/parent/Announcements'))
const ParentProfile = lazy(() => import('./pages/parent/Profile'))

/* --- student ------------------------------------------------------------ */
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'))
const StudentActivity = lazy(() => import('./pages/student/Activity'))
const StudentAttendance = lazy(() => import('./pages/student/Attendance'))
const StudentSchool = lazy(() => import('./pages/student/School'))
const StudentHealth = lazy(() => import('./pages/student/Health'))
const StudentMeals = lazy(() => import('./pages/student/Meals'))
const StudentProgress = lazy(() => import('./pages/student/Progress'))
const StudentNotifications = lazy(() => import('./pages/student/Notifications'))
const StudentAnnouncements = lazy(() => import('./pages/student/Announcements'))
const StudentReportIssue = lazy(() => import('./pages/student/ReportIssue'))
const StudentProfile = lazy(() => import('./pages/student/Profile'))

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <Loader label="Loading…" />
    </div>
  )
}

/** Sends "/" to the right place for the signed-in role. */
function RootRedirect() {
  const { homePath, loading } = useAuth()
  if (loading) return <FullPageLoader />
  return <Navigate to={homePath} replace />
}

export default function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        {/* public */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>

        <Route
          path="/pending-verification"
          element={
            <ProtectedRoute roles={[ROLES.PARENT]}>
              <PendingVerification />
            </ProtectedRoute>
          }
        />

        {/* admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={[ROLES.ADMIN]}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="students/:id" element={<AdminStudentProfile />} />
          <Route path="parents" element={<AdminParents />} />
          <Route path="parents/:id" element={<AdminParentProfile />} />
          <Route path="rooms" element={<AdminRooms />} />
          <Route path="attendance" element={<AdminAttendance />} />
          <Route path="activities" element={<AdminActivities />} />
          <Route path="health" element={<AdminHealth />} />
          <Route path="meals" element={<AdminMeals />} />
          <Route path="school-attendance" element={<AdminSchool />} />
          <Route path="progress" element={<AdminProgress />} />
          <Route path="suggestions" element={<AdminSuggestions />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="emergency" element={<AdminEmergency />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="profile" element={<AdminProfile />} />
        </Route>

        {/* parent */}
        <Route
          path="/parent"
          element={
            <ProtectedRoute roles={[ROLES.PARENT]} requireVerifiedParent>
              <ParentLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/parent/dashboard" replace />} />
          <Route path="dashboard" element={<ParentDashboard />} />
          <Route path="children" element={<ParentChildren />} />
          <Route path="children/:id" element={<ParentChildProfile />} />
          <Route path="children/:id/daily-activity" element={<ParentChildDaily />} />
          <Route path="children/:id/attendance" element={<ParentChildAttendance />} />
          <Route path="children/:id/health" element={<ParentChildHealth />} />
          <Route path="children/:id/meals" element={<ParentChildMeals />} />
          <Route path="children/:id/school" element={<ParentChildSchool />} />
          <Route path="children/:id/progress" element={<ParentChildProgress />} />
          <Route path="suggestions" element={<ParentSuggestions />} />
          <Route path="notifications" element={<ParentNotifications />} />
          <Route path="announcements" element={<ParentAnnouncements />} />
          <Route path="profile" element={<ParentProfile />} />
        </Route>

        {/* student */}
        <Route
          path="/student"
          element={
            <ProtectedRoute roles={[ROLES.STUDENT]}>
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/student/dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="activity" element={<StudentActivity />} />
          <Route path="attendance" element={<StudentAttendance />} />
          <Route path="school" element={<StudentSchool />} />
          <Route path="health" element={<StudentHealth />} />
          <Route path="meals" element={<StudentMeals />} />
          <Route path="progress" element={<StudentProgress />} />
          <Route path="notifications" element={<StudentNotifications />} />
          <Route path="announcements" element={<StudentAnnouncements />} />
          <Route path="report-issue" element={<StudentReportIssue />} />
          <Route path="profile" element={<StudentProfile />} />
        </Route>

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
