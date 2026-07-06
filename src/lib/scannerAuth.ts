import { NextRequest } from "next/server";
import crypto from "crypto";
import { getDb } from "./db";

/**
 * Authenticates a request from the Scanner PWA using a bearer token.
 * Compares the SHA-256 hash of the provided token against the stored hash.
 */
export async function authenticateScannerRequest(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];
  if (!token) return null;

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const db = await getDb();

  const staff = await db.collection("scanner_staff").findOne({ 
    access_token: hashedToken 
  });

  return staff;
}
