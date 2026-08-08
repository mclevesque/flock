import type { Metadata } from "next";
import EmberkinClient from "./EmberkinClient";

export const metadata: Metadata = {
  title: "Emberkin — Great Souls",
  description: "Hatch something from the ash. Raise it. Find out what it becomes.",
};

export default function EmberkinPage() {
  return <EmberkinClient />;
}
