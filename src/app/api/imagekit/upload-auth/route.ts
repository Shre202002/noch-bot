import { NextResponse } from "next/server";
import crypto from "crypto";
import { getUserIdFromCookie } from "@/lib/auth";

/**
 * ImageKit Upload Authentication Route
 * Generates a signature for secure client-side uploads.
 */
export async function GET() {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;

  if (!privateKey || !publicKey) {
    console.error("ImageKit credentials missing in environment variables.");
    return NextResponse.json(
      { error: "Server configuration error: ImageKit keys not found" },
      { status: 500 }
    );
  }

  const token = crypto.randomBytes(16).toString("hex");
  const expire = Math.floor(Date.now() / 1000) + 1800; // 30 mins

  const signature = crypto
    .createHmac("sha1", privateKey)
    .update(token + expire)
    .digest("hex");

  return NextResponse.json({
    token,
    expire,
    signature,
    publicKey,
  });
}
