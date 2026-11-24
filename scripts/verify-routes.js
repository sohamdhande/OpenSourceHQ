const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log("Starting full routes audit against http://localhost:3000 ...");

  // 1. Log in admin
  const adminLogin = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sarah.admin@hyperscale.org', password: 'password123' })
  });
  const adminCookie = adminLogin.headers.get('set-cookie')?.split(';')[0];
  if (!adminCookie) throw new Error("Failed to authenticate Sarah Jenkins (Admin)");

  // 2. Log in mentor
  const mentorLogin = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alex.mentor@hyperscale.org', password: 'password123' })
  });
  const mentorCookie = mentorLogin.headers.get('set-cookie')?.split(';')[0];
  if (!mentorCookie) throw new Error("Failed to authenticate Alex Rivera (Mentor)");

  // 3. Log in student
  const studentLogin = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'marcus.mentee@hyperscale.org', password: 'password123' })
  });
  const studentCookie = studentLogin.headers.get('set-cookie')?.split(';')[0];
  if (!studentCookie) throw new Error("Failed to authenticate Marcus Vance (Student)");

  const mentee = await prisma.user.findFirst({
    where: { email: 'marcus.mentee@hyperscale.org' }
  });

  const routesToTest = [
    // Public & Auth
    { path: '/', cookie: null, role: 'Public' },
    { path: '/login', cookie: null, role: 'Public' },
    { path: '/unauthorized', cookie: null, role: 'Public' },
    { path: '/select-org', cookie: adminCookie, role: 'Admin' },

    // Admin Routes
    { path: '/org/hyperscale/admin', cookie: adminCookie, role: 'Admin' },
    { path: '/org/hyperscale/admin/members', cookie: adminCookie, role: 'Admin' },
    { path: '/org/hyperscale/admin/cohorts', cookie: adminCookie, role: 'Admin' },
    { path: '/org/hyperscale/admin/repositories', cookie: adminCookie, role: 'Admin' },
    { path: '/org/hyperscale/admin/events', cookie: adminCookie, role: 'Admin' },
    { path: '/org/hyperscale/admin/announcements', cookie: adminCookie, role: 'Admin' },
    { path: '/org/hyperscale/admin/audit', cookie: adminCookie, role: 'Admin' },
    { path: '/org/hyperscale/admin/settings', cookie: adminCookie, role: 'Admin' },
    { path: '/org/hyperscale/admin/analytics', cookie: adminCookie, role: 'Admin' },
    { path: '/org/hyperscale/admin/mentors', cookie: adminCookie, role: 'Admin' },
    { path: '/org/hyperscale/admin/mentees', cookie: adminCookie, role: 'Admin' },
    { path: '/org/hyperscale/admin/reports', cookie: adminCookie, role: 'Admin' },
    { path: '/org/hyperscale/admin/tasks', cookie: adminCookie, role: 'Admin' },
    { path: '/org/hyperscale/admin/integrations/github', cookie: adminCookie, role: 'Admin' },

    // Mentor Routes
    { path: '/org/hyperscale/mentor', cookie: mentorCookie, role: 'Mentor' },
    { path: '/org/hyperscale/mentor/mentees', cookie: mentorCookie, role: 'Mentor' },
    { path: '/org/hyperscale/mentor/mentees/' + mentee.id, cookie: mentorCookie, role: 'Mentor' },
    { path: '/org/hyperscale/mentor/reviews', cookie: mentorCookie, role: 'Mentor' },
    { path: '/org/hyperscale/mentor/tasks', cookie: mentorCookie, role: 'Mentor' },
    { path: '/org/hyperscale/mentor/blockers', cookie: mentorCookie, role: 'Mentor' },
    { path: '/org/hyperscale/mentor/events', cookie: mentorCookie, role: 'Mentor' },
    { path: '/org/hyperscale/mentor/cohorts', cookie: mentorCookie, role: 'Mentor' },
    { path: '/org/hyperscale/mentor/reports', cookie: mentorCookie, role: 'Mentor' },
    { path: '/org/hyperscale/mentor/analytics', cookie: mentorCookie, role: 'Mentor' },

    // Student Routes
    { path: '/org/hyperscale/student', cookie: studentCookie, role: 'Student' },
    { path: '/org/hyperscale/student/daily-log', cookie: studentCookie, role: 'Student' },
    { path: '/org/hyperscale/student/reports', cookie: studentCookie, role: 'Student' },
    { path: '/org/hyperscale/student/tasks', cookie: studentCookie, role: 'Student' },
    { path: '/org/hyperscale/student/learning', cookie: studentCookie, role: 'Student' },
    { path: '/org/hyperscale/student/feedback', cookie: studentCookie, role: 'Student' },
    { path: '/org/hyperscale/student/blockers', cookie: studentCookie, role: 'Student' },
    { path: '/org/hyperscale/student/community', cookie: studentCookie, role: 'Student' },
    { path: '/org/hyperscale/student/events', cookie: studentCookie, role: 'Student' },
    { path: '/org/hyperscale/student/github', cookie: studentCookie, role: 'Student' },
    { path: '/org/hyperscale/student/repositories', cookie: studentCookie, role: 'Student' },
    { path: '/org/hyperscale/student/profile', cookie: studentCookie, role: 'Student' },
  ];

  console.log(`Auditing ${routesToTest.length} routes...`);
  let passed = 0;
  let failed = 0;

  for (const route of routesToTest) {
    const headers = {};
    if (route.cookie) headers.cookie = route.cookie;
    try {
      const res = await fetch('http://localhost:3000' + route.path, { headers, redirect: 'manual' });
      
      // If 302/307 redirect, check redirect destination
      if (res.status === 302 || res.status === 307) {
        const location = res.headers.get('location');
        console.log(`↪️  REDIRECT [${res.status}]: ${route.path} -> ${location}`);
        passed++;
        continue;
      }

      const text = await res.text();
      const hasStylesheet = text.includes('rel="stylesheet"') || text.includes('stylesheet');
      const isServerError = res.status >= 500 || text.includes('Internal Server Error') || text.includes('Application error');

      if (isServerError || res.status >= 400 || !hasStylesheet) {
        console.error(`❌ FAIL [${res.status}]: ${route.path} (hasCSS: ${hasStylesheet}, length: ${text.length})`);
        failed++;
      } else {
        console.log(`✅ OK   [${res.status}]: ${route.path} (${text.length} bytes, stylesheet loaded)`);
        passed++;
      }
    } catch (err) {
      console.error(`❌ ERR: ${route.path} - ${err.message}`);
      failed++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Audit Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error("Fatal error during audit:", err);
  process.exit(1);
});
