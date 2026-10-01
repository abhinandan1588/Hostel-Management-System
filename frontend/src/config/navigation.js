import {
  Activity,
  BedDouble,
  Bell,
  CalendarCheck,
  ClipboardList,
  FileBarChart,
  GraduationCap,
  Heart,
  Home,
  LayoutDashboard,
  Lightbulb,
  Megaphone,
  MessageSquare,
  Salad,
  School,
  Settings,
  Siren,
  TrendingUp,
  User,
  UserCheck,
  Users,
} from 'lucide-react'

/** Admin sidebar, grouped so the menu stays scannable on small screens. */
export const ADMIN_NAV = [
  {
    section: 'Overview',
    items: [{ to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    section: 'People',
    items: [
      { to: '/admin/students', label: 'Students', icon: GraduationCap },
      { to: '/admin/parents', label: 'Parents', icon: Users },
      { to: '/admin/rooms', label: 'Rooms', icon: BedDouble },
    ],
  },
  {
    section: 'Daily records',
    items: [
      { to: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
      { to: '/admin/activities', label: 'Daily Activities', icon: Activity },
      { to: '/admin/health', label: 'Health', icon: Heart },
      { to: '/admin/meals', label: 'Food & Meals', icon: Salad },
      { to: '/admin/school-attendance', label: 'School Tracking', icon: School },
      { to: '/admin/progress', label: 'Progress', icon: TrendingUp },
    ],
  },
  {
    section: 'Communication',
    items: [
      { to: '/admin/suggestions', label: 'Suggestions', icon: Lightbulb },
      { to: '/admin/notifications', label: 'Notifications', icon: Bell },
      { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
      { to: '/admin/emergency', label: 'Emergency Alerts', icon: Siren },
    ],
  },
  {
    section: 'Administration',
    items: [
      { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
      { to: '/admin/profile', label: 'Admin Profile', icon: User },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export const PARENT_NAV = [
  {
    section: 'My child',
    items: [
      { to: '/parent/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/parent/children', label: 'My Children', icon: GraduationCap },
    ],
  },
  {
    section: 'Communication',
    items: [
      { to: '/parent/suggestions', label: 'Suggestions', icon: MessageSquare },
      { to: '/parent/notifications', label: 'Notifications', icon: Bell },
      { to: '/parent/announcements', label: 'Announcements', icon: Megaphone },
    ],
  },
  {
    section: 'Account',
    items: [{ to: '/parent/profile', label: 'My Profile', icon: User }],
  },
]

export const STUDENT_NAV = [
  {
    section: 'Today',
    items: [
      { to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/student/activity', label: "Today's Routine", icon: Activity },
      { to: '/student/meals', label: 'Meals', icon: Salad },
    ],
  },
  {
    section: 'My records',
    items: [
      { to: '/student/attendance', label: 'Attendance', icon: CalendarCheck },
      { to: '/student/school', label: 'School Status', icon: School },
      { to: '/student/health', label: 'Health', icon: Heart },
      { to: '/student/progress', label: 'Progress', icon: TrendingUp },
    ],
  },
  {
    section: 'More',
    items: [
      { to: '/student/notifications', label: 'Notifications', icon: Bell },
      { to: '/student/announcements', label: 'Announcements', icon: Megaphone },
      { to: '/student/report-issue', label: 'Report an Issue', icon: ClipboardList },
      { to: '/student/profile', label: 'My Profile', icon: User },
    ],
  },
]

/** Bottom bar for phones - at most five destinations per role. */
export const MOBILE_TABS = {
  ADMIN: [
    { to: '/admin/dashboard', label: 'Home', icon: Home },
    { to: '/admin/students', label: 'Students', icon: GraduationCap },
    { to: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
    { to: '/admin/meals', label: 'Meals', icon: Salad },
    { to: '/admin/parents', label: 'Parents', icon: UserCheck },
  ],
  PARENT: [
    { to: '/parent/dashboard', label: 'Home', icon: Home },
    { to: '/parent/children', label: 'Children', icon: GraduationCap },
    { to: '/parent/notifications', label: 'Alerts', icon: Bell },
    { to: '/parent/suggestions', label: 'Feedback', icon: MessageSquare },
    { to: '/parent/profile', label: 'Profile', icon: User },
  ],
  STUDENT: [
    { to: '/student/dashboard', label: 'Home', icon: Home },
    { to: '/student/activity', label: 'Routine', icon: Activity },
    { to: '/student/attendance', label: 'Attendance', icon: CalendarCheck },
    { to: '/student/progress', label: 'Progress', icon: TrendingUp },
    { to: '/student/profile', label: 'Profile', icon: User },
  ],
}

export const NAV_BY_ROLE = {
  ADMIN: ADMIN_NAV,
  PARENT: PARENT_NAV,
  STUDENT: STUDENT_NAV,
}

export const PORTAL_TITLES = {
  ADMIN: 'Hostel Administration',
  PARENT: 'Parent Portal',
  STUDENT: 'Student Portal',
}

export const NOTIFICATION_PATH = {
  ADMIN: '/admin/notifications',
  PARENT: '/parent/notifications',
  STUDENT: '/student/notifications',
}
