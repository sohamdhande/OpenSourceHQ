import { redirect } from "next/navigation";

export default function MentorRepositoriesPage({ params }: { params: { orgSlug: string } }) {
  redirect(`/org/${params.orgSlug}/mentor`);
}
