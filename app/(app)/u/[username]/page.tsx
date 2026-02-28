import ProfileView from "@/app/(app)/profile/profile-view";

type UserPageProps = {
  params: Promise<{ username: string }>;
};

export default async function UserPage({ params }: UserPageProps) {
  const { username } = await params;
  return <ProfileView username={username} />;
}
