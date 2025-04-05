import type { Route } from "./+types/home";
import { DriverTimeline } from "~/components/driver-timeline";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Formula Strats" },
    { name: "description", content: "The favorite app of all formula armchair strategists." },
  ];
}

export default function Home() {
  return (
    <>
      <DriverTimeline />
    </>
  );
}
