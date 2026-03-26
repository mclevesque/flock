import GuestEntry from "../GuestEntry";

interface Props {
  params: Promise<{ area: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { area } = await params;
  const label = area.charAt(0).toUpperCase() + area.slice(1);
  return { title: `Enter ${label} — Ryft`, description: "Play as WARRIOR, no account needed." };
}

export default async function GuestAreaPage({ params }: Props) {
  const { area } = await params;
  return <GuestEntry area={area} />;
}
