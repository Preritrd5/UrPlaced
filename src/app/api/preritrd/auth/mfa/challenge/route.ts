import { NextRequest } from "next/server";
import { POST as loginHandler } from "@/app/api/preritrd/auth/login/route";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return loginHandler(request);
}
