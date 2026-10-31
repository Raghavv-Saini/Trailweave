"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignupRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login?role=tourist&mode=signup");
  }, [router]);

  return null;
}
