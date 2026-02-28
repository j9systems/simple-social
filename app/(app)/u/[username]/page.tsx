type UserPageProps = {
  params: Promise<{ username: string }>;
};

export default async function UserPage({ params }: UserPageProps) {
  const { username } = await params;

  return (
    <section>
      <h1>User</h1>
      <p>Profile for @{username}</p>
    </section>
  );
}
