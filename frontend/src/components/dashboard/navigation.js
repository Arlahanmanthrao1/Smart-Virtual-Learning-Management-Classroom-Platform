const item = (id, label, icon) => ({ id, label, icon });

export const dashboardNavigation = {
  admin: [item("dashboard", "Dashboard", "dashboard"), item("users", "Users", "users"),
    item("register-student", "Register student", "users"), item("register-faculty", "Create faculty", "users"),
    item("departments", "Departments", "department"), item("courses", "Courses", "courses"),
    item("materials", "Study Materials", "upload")],
  student: [item("dashboard", "Dashboard", "dashboard"), item("courses", "My Courses", "courses"),
    item("assignments", "Assignments", "assignments"), item("quizzes", "Quizzes", "quiz"),
    item("materials", "Study Guide", "material")],
  faculty: [item("dashboard", "Dashboard", "dashboard"), item("courses", "My Courses", "courses"),
    item("create-course", "Create Course", "courses"), item("assignments", "Assignments", "assignments"),
    item("quizzes", "Quiz Builder", "quiz"), item("grading", "Grading", "check"),
    item("roster", "Student Roster", "users")],
  hod: [item("dashboard", "Dashboard", "dashboard"), item("students", "Students", "users"),
    item("faculty", "Faculty", "users"), item("courses", "Courses", "courses"),
    item("attendance", "Attendance", "chart")],
};

export function dashboardPath(role, page = "dashboard") {
  return `/${role}${page === "dashboard" ? "" : `/${page}`}`;
}

export function isDashboardPage(role, page = "dashboard") {
  return dashboardNavigation[role]?.some((item) => item.id === page) || false;
}
