import ChessClient from "./ChessClient";

export default async function ChessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChessClient gameId={id} />;
}
