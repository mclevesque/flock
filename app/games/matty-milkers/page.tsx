import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function MattyMilkersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <iframe
        src="/games/matty-milkers/index.html"
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        allow="autoplay; gamepad"
        title="Matty Milkers"
      />
    </div>
  );
}
