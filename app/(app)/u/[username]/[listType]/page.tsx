import { notFound } from "next/navigation";
import ConnectionsView from "@/app/(app)/profile/connections-view";

type ListType = "followers" | "following";

type UserConnectionsPageProps = {
  params: Promise<{ username: string; listType: string }>;
};

function parseListType(value: string): ListType | null {
  if (value === "followers" || value === "following") {
    return value;
  }
  return null;
}

export default async function UserConnectionsPage({ params }: UserConnectionsPageProps) {
  const { username, listType } = await params;
  const mode = parseListType(listType);
  if (!mode) {
    notFound();
  }

  return <ConnectionsView mode={mode} username={username} />;
}
