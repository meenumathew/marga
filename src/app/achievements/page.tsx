import type { Metadata } from "next";
import { AchievementsView } from "@/components/achievements-view";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: `Achievements | ${site.name}`,
  description: `Achievements earned from real learning activity in ${site.name}.`,
};

export default function AchievementsPage() {
  return <AchievementsView />;
}
