import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ChessHubClient from "./ChessHubClient";

export const metadata = { title: "Chess — FLOCK" };

export default async function ChessPage() {
  return <ChessHubClient />;
}
