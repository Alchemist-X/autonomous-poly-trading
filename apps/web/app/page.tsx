import { redirect } from "next/navigation";

// The forecasting hub is the product's front door.
export default function RootPage(): never {
  redirect("/world-cup");
}
