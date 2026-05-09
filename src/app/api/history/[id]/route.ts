// import { NextRequest, NextResponse } from "next/server";
// import { getUserIdFromCookie } from "@/lib/auth";
// import { getMessageThread } from "@/lib/conversations";

// export const dynamic = "force-dynamic";

// export async function GET(
//   req: NextRequest,
//   context: { params: { conversationId: string } }
// ) {
//   try {
//     const userId = await getUserIdFromCookie();
//     if (!userId)
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

//     // const { conversationId } = await params;
//     const conversationId = context.params.conversationId;

//     const data = await getMessageThread(conversationId, userId);
//     if (!data)
//       return NextResponse.json({ error: "Not found" }, { status: 404 });

//     return NextResponse.json(data);
//   } catch (err: any) {
//     console.error("[history/thread] error:", err);
//     return NextResponse.json({ error: "Failed to fetch thread" }, { status: 500 });
//   }
// }

import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { getMessageThread } from "@/lib/conversations";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: {
    params: {
      conversationId: string;
    };
  }
) {

  console.log("THREAD ROUTE HIT");

  console.log("context:", context);

  try {

    const userId =
      await getUserIdFromCookie();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const conversationId =
      context.params.conversationId;

    console.log(
      "conversationId:",
      conversationId
    );

    const data =
      await getMessageThread(
        conversationId,
        userId
      );

    if (!data) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);

  } catch (err: any) {

    console.error(
      "[history/thread] error:",
      err
    );

    return NextResponse.json(
      { error: "Failed to fetch thread" },
      { status: 500 }
    );
  }
}