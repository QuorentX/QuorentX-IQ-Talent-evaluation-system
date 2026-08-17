import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy path — always send users to the candidate login portal. */
export const Route = createFileRoute("/auth")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
  component: () => null,
});
