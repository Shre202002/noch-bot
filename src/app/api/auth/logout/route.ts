// import { NextResponse } from 'next/server';

// export async function POST() {
//   const response = NextResponse.json({ success: true });
//   response.cookies.set('token', '', { maxAge: 0, path: '/' });
//   return response;
// }

import { NextResponse } from "next/server";

export async function POST() {

  const res =
    NextResponse.json({
      success: true,
    });

  res.cookies.set("token", "", {
    expires: new Date(0),
    path: "/",
  });

  return res;
}
