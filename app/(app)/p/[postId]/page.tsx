type PostPageProps = {
  params: Promise<{ postId: string }>;
};

export default async function PostPage({ params }: PostPageProps) {
  const { postId } = await params;

  return (
    <section>
      <h1>Post</h1>
      <p>Viewing post {postId}</p>
    </section>
  );
}
