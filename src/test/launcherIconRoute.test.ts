import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/launcher-icon/[id]/route";
import { renderLauncherIcon } from "@/lib/launcherIconArt";

const call = (id: string, query = "") =>
  GET(new NextRequest(`http://localhost:9002/api/launcher-icon/${id}${query}`), { params: Promise.resolve({ id }) });

describe("GET /api/launcher-icon/[id]", () => {
  it("returns the icon drawn in the requested colour", async () => {
    const res = await call("smile", "?color=F0C545");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("image/svg+xml");
    const body = await res.text();
    expect(body.toUpperCase()).toContain("#F0C545");
    expect(body).toBe(renderLauncherIcon("smile", "F0C545"));
  });

  it("is safe to show on other websites and cannot do anything but display", async () => {
    const res = await call("orb", "?color=2563EB");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Cross-Origin-Resource-Policy")).toBe("cross-origin");
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
    expect(res.headers.get("Cache-Control")).toContain("max-age");
  });

  it("returns the original artwork when the colour is missing or invalid", async () => {
    const original = renderLauncherIcon("voice", null);
    for (const query of ["", "?color=", "?color=red", "?color=12", "?color=%22%3E%3Cscript%3E"]) {
      const res = await call("voice", query);
      expect(res.status, query).toBe(200);
      expect(await res.text(), query).toBe(original);
    }
  });

  it("never puts anything but a colour into the image", async () => {
    const res = await call("typing", "?color=" + encodeURIComponent('F0C545"/><script>alert(1)</script>'));
    const body = await res.text();
    expect(body).not.toMatch(/<script|onload|javascript:/i);
  });

  it("answers 404 for an unknown icon, the robot, and prototype names", async () => {
    for (const id of ["nope", "default", "__proto__", "constructor", ""]) {
      expect((await call(id, "?color=F0C545")).status, id).toBe(404);
    }
  });
});
