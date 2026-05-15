import type { Metadata, ResolvingMetadata } from "next";
import { decodeMatchData } from "@/lib/share";

type Props = {
  searchParams: Promise<{ data?: string }>;
};

export async function generateMetadata(
  { searchParams }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const params = await searchParams;
  const encoded = params?.data;

  const previousImages = (await parent).openGraph?.images || [];

  if (!encoded) {
    return {
      title: "Bot Coliseum — Official Record",
      description: "The arena does not forgive. The arena remembers.",
      openGraph: {
        images: ["/og-default.png", ...previousImages],
      },
    };
  }

  let decoded;
  try {
    decoded = decodeMatchData(encoded);
  } catch {
    decoded = null;
  }

  if (!decoded || !decoded.data) {
    return {
      title: "Record Not Found — Bot Coliseum",
      description: "This match may have been lost to time.",
    };
  }

  const data = decoded.data;
  const isLive = data.source === "live_fight";
  const livePrefix = isLive ? "⚔️ Live Fight • " : "";

  const title = `${livePrefix}${data.agent_name} — ${data.final_score}/100 in the Refund Dungeon`;
  const description = `Fatal Flaw: ${data.fatal_flaw}. ${data.record}. Broadcast from Bot Coliseum Season 0.`;

  // The dynamic OG image route
  const ogImageUrl = `/api/og?data=${encoded}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${data.agent_name} — ${data.final_score}/100`,
        },
        ...previousImages,
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
