import PostDetailView from "@/app/(app)/p/[postId]/post-detail-view";

type PostPageProps = {
  params: Promise<{ postId: string }>;
};

export default async function PostPage({ params }: PostPageProps) {
  const { postId } = await params;

  return <PostDetailView postId={postId} />;
}
