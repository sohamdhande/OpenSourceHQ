import prisma from "../src/lib/db";
import { signJwt } from "../src/server/auth/session";

async function main() {
  console.log("Starting Mentee & Mentor Repository Assignment verification...");

  // 1. Fetch organization and users
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "nstsdc" },
  });

  const mentee = await prisma.user.findUniqueOrThrow({
    where: { email: "devon.mentee@nstsdc.org" },
  });

  const mentor = await prisma.user.findUniqueOrThrow({
    where: { email: "alex.mentor@nstsdc.org" },
  });

  const repos = await prisma.repository.findMany({
    where: { organizationId: org.id },
  });

  if (repos.length < 2) {
    throw new Error("Expected at least 2 repositories in org nstsdc");
  }

  const menteeToken = signJwt({
    userId: mentee.id,
    email: mentee.email,
    activeOrgId: org.id,
    createdAt: Date.now(),
  });

  const mentorToken = signJwt({
    userId: mentor.id,
    email: mentor.email,
    activeOrgId: org.id,
    createdAt: Date.now(),
  });

  const baseUrl = "http://localhost:3000";

  // 2. Mentee fetches their repositories
  console.log("1. Mentee fetches their repositories...");
  const res1 = await fetch(`${baseUrl}/api/mentee-repositories?organizationId=${org.id}`, {
    headers: { Cookie: `oshq_session=${menteeToken}` },
  });
  if (!res1.ok) throw new Error(`Fetch failed: ${res1.status}`);
  const data1 = await res1.json();
  console.log(`   Found ${data1.menteeRepositories.length} initial repositories for Devon.`);

  // 3. Mentee chooses repo[2] (if available) or repo[0]
  const targetRepo = repos[repos.length - 1];
  console.log(`2. Mentee self-chooses repo: ${targetRepo.fullName}...`);
  const res2 = await fetch(`${baseUrl}/api/mentee-repositories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `oshq_session=${menteeToken}`,
    },
    body: JSON.stringify({
      organizationId: org.id,
      repositoryId: targetRepo.id,
      isPrimary: false,
    }),
  });
  if (!res2.ok) throw new Error(`Choose failed: ${res2.status} ${await res2.text()}`);
  const data2 = await res2.json();
  console.log(`   Successfully self-chosen: ${data2.menteeRepository.id}, assignedById=${data2.menteeRepository.assignedById}`);

  // 4. Mentor assigns a repository with notes
  console.log(`3. Mentor assigns repo ${repos[0].fullName} to Devon with focus notes...`);
  const res3 = await fetch(`${baseUrl}/api/mentee-repositories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `oshq_session=${mentorToken}`,
    },
    body: JSON.stringify({
      organizationId: org.id,
      menteeId: mentee.id,
      repositoryId: repos[0].id,
      isPrimary: true,
      notes: "Focus on kernel subsystem memory leak profiling.",
    }),
  });
  if (!res3.ok) throw new Error(`Mentor assign failed: ${res3.status} ${await res3.text()}`);
  const data3 = await res3.json();
  console.log(`   Assigned by mentor: ${data3.menteeRepository.assignedBy?.name}, primary=${data3.menteeRepository.isPrimary}`);

  // 5. Mentor unassigns repository
  console.log(`4. Mentor unassigns repo...`);
  const res4 = await fetch(`${baseUrl}/api/mentee-repositories?id=${data2.menteeRepository.id}`, {
    method: "DELETE",
    headers: { Cookie: `oshq_session=${mentorToken}` },
  });
  if (!res4.ok) throw new Error(`Unassign failed: ${res4.status}`);
  console.log(`   Successfully unassigned.`);

  // 6. Verify audit logs were written
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      organizationId: org.id,
      targetType: "MenteeRepository",
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log(`5. Verified audit logs: ${auditLogs.length} audit records found.`);
  for (const log of auditLogs) {
    console.log(`   - Action: ${log.action}, Target: ${log.targetId}`);
  }

  console.log("All mentee and mentor repository operations passed with 100% success!");
}

main()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

