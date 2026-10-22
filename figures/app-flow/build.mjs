// NochBot "sorting desk": the app's real request path drawn as one machine.
// A visitor's message is a capsule. It passes a guard gate (llmGuard), a diverter (isBookingIntent), and then
// either the answer line (recall -> compose -> verify -> reply) or the booking line (seats -> pay -> ticket -> scan).
// Run: node figures/app-flow/build.mjs [--light]
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "file:///C:/Users/Shre/.claude/skills/anatomy/kit/iso-kit.mjs";
import { kitScript } from "file:///C:/Users/Shre/.claude/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 860;
const HEIGHT = 440;

const PLATE = { x: -284, y: -140, w: 560, d: 232, r: 10 };
const PLATE_H = 12;
const FOOT_H = 5;

// Track centre lines (y), and where the branches leave the diverter.
const MAIN_Y = 0;
const ASK_Y = 62;
const BOOK_Y = -72;
const DIV = [-130, 0];
const RAIL_Z = 2.6;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-60, -110, 78], [150, -110, 70], [0, 30, 70]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 62, elevation: 34 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const key = (x, y, z = 0) => k.depthOf([x, y, z], P);

// ---- small recipes -------------------------------------------------------------------------------------

const box = (plan, z, h, tone = "mid", steps = 3, bevel = 0.5, extra = {}) => S(k.slabOf(plan, z, h, P, steps, bevel), { tone, ...extra });
const screws = (plan, z, inset = 3.2) => D(k.corners(plan, inset).map(([x, y]) => at([x, y, z])), { size: 0.42 });
const groove = (plan, z, by = 2.4) => L(k.planOutline(k.insetPlan(plan, by), z, P, 3), { tone: "faint" });
const labelPlate = (x, y, z) => {
  const plan = { x, y, w: 20, d: 8, r: 1 };
  return [
    S(k.slabOf(plan, z, 0.7, P, 3), { tone: "lo", crease: "none" }),
    L(k.lineOnTop([x + 3, y + 2.4], [x + 17, y + 2.4], z + 0.7, P), { tone: "lo", free: true }),
    L(k.lineOnTop([x + 3, y + 4], [x + 13, y + 4], z + 0.7, P), { tone: "lo", free: true }),
    L(k.lineOnTop([x + 3, y + 5.6], [x + 15, y + 5.6], z + 0.7, P), { tone: "lo", free: true }),
  ].join("");
};
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ---- the desk ------------------------------------------------------------------------------------------

function desk() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 26))) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6.2, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screwsAt = k.corners(PLATE, 11);
  out.push(L(screwsAt.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screwsAt.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the front edge
  const strip = { x: -240, y: PLATE.y + PLATE.d - 15, w: 480, d: 8, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 4, 0.6]), at([strip.x + strip.w - 2, strip.y + 4, 0.6])], { size: 0.45 }));
  out.push(labelPlate(PLATE.x + 16, PLATE.y + PLATE.d - 20, 0));
  return out.join("");
}

// ---- track: sleepers, rails, and the two branches off the diverter --------------------------------------

// A straight track along x between x0 and x1 at centre line y.
function straight(x0, x1, y) {
  const out = [];
  for (let x = x0 + 6; x < x1 - 2; x += 14) out.push(S(k.slabOf({ x: x - 2.2, y: y - 9, w: 4.4, d: 18, r: 0.8 }, 0, 1.6, P, 2), { tone: "lo", crease: "none" }));
  for (const dy of [-5, 5]) out.push(S(k.slabOf({ x: x0, y: y + dy - 1.3, w: x1 - x0, d: 2.6, r: 0.8 }, 1.6, 1.2, P, 2), { tone: "mid", crease: "none" }));
  return out.join("");
}

// A diagonal branch as a flat strip with two rails, from a to b.
function branch(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  const ux = dx / length, uy = dy / length;
  const nx = -uy, ny = ux;
  const strip = (half, z, h) => [
    [a[0] + nx * half, a[1] + ny * half],
    [b[0] + nx * half, b[1] + ny * half],
    [b[0] - nx * half, b[1] - ny * half],
    [a[0] - nx * half, a[1] - ny * half],
  ];
  const out = [];
  out.push(S(k.extrude(strip(8.5), 0, 1.6, P), { tone: "lo", crease: "none" }));
  for (const side of [-5, 5]) {
    const rail = [
      [a[0] + nx * (side + 1.3), a[1] + ny * (side + 1.3)],
      [b[0] + nx * (side + 1.3), b[1] + ny * (side + 1.3)],
      [b[0] + nx * (side - 1.3), b[1] + ny * (side - 1.3)],
      [a[0] + nx * (side - 1.3), a[1] + ny * (side - 1.3)],
    ];
    out.push(S(k.extrude(rail, 1.6, 1.2, P), { tone: "mid", crease: "none" }));
  }
  return out.join("");
}

const ENTRY_X = -246;
const END_X = 238;
const ASK_START = [-100, ASK_Y];
const BOOK_START = [-100, BOOK_Y];

function track() {
  const out = [];
  out.push(straight(ENTRY_X, DIV[0] - 8, MAIN_Y));
  out.push(branch([DIV[0] + 4, DIV[1] + 2], ASK_START));
  out.push(branch([DIV[0] + 4, DIV[1] - 2], BOOK_START));
  out.push(straight(ASK_START[0], END_X, ASK_Y));
  out.push(straight(BOOK_START[0], END_X, BOOK_Y));
  // turnout plates where each branch lands on its straight track, so no strip corner juts out
  for (const y of [ASK_Y, BOOK_Y]) out.push(S(k.slabOf({ x: ASK_START[0] - 9, y: y - 9, w: 18, d: 18, r: 1.4 }, 0, 1.6, P, 3), { tone: "lo", crease: "none" }));
  // end stops
  for (const y of [ASK_Y, BOOK_Y]) out.push(S(k.slabOf({ x: END_X, y: y - 8, w: 5, d: 16, r: 1.2 }, 0, 7, P, 3, 0.4), { tone: "mid" }));
  return out.join("");
}

// ---- items: every static station as separately depth-sorted parts ----------------------------------------

const items = []; // { key, svg, name }
const add = (name, sortKey, svg) => items.push({ name, key: sortKey, svg });

// 1. Widget intake (the embed snippet on the customer's site): a small terminal with a drop chute over the track.
{
  const base = { x: -276, y: -30, w: 44, d: 26, r: 3 };
  const svg = [];
  svg.push(box(base, 0, 30, "mid", 3, 0.6));
  svg.push(groove(base, 30));
  svg.push(screws(base, 30));
  // screen window on the +y face is hidden; show a keyboard-ish key row and a hopper on top
  svg.push(S(k.cylinder(-254, -17, 9, 30, 4, P, 28), { tone: "mid" }));
  svg.push(S(k.cylinder(-254, -17, 6.2, 34, 8, P, 28), { tone: "lo" }));
  svg.push(L(k.ring(-254, -17, 4.6, 42, P, 20), { tone: "faint" }));
  svg.push(labelPlate(base.x + 12, base.y + 9, 30));
  add("widget", key(-254, -17, 12), svg.join(""));
  // the chute that drops the capsule onto the track
  const chute = [];
  chute.push(S(k.slabOf({ x: -250, y: -16, w: 8, d: 14, r: 2 }, 6, 22, P, 3, 0.4), { tone: "mid", crease: "none" }));
  chute.push(S(k.slabOf({ x: -252, y: -17, w: 12, d: 16, r: 2 }, 3, 3.4, P, 3, 0.3), { tone: "lo" }));
  add("chute", key(-246, -9, 12), chute.join(""));
}

// 2. Guard gate (llmGuard): posts either side of the track and a lintel with a lens, drawn as three depth slots.
const GATE_X = -196;
{
  const post = (y) => [
    S(k.slabOf({ x: GATE_X - 6, y: y - 3.5, w: 12, d: 7, r: 1.4 }, 0, 30, P, 3, 0.5), { tone: "mid" }),
    S(k.slabOf({ x: GATE_X - 7.5, y: y - 5, w: 15, d: 10, r: 1.8 }, 0, 4, P, 3, 0.4), { tone: "lo" }),
  ].join("");
  add("gate-back", key(GATE_X, -14, 12), post(-14));
  const lintel = [];
  lintel.push(S(k.slabOf({ x: GATE_X - 6, y: -17.5, w: 12, d: 35, r: 1.4 }, 30, 7, P, 3, 0.6), { tone: "mid" }));
  lintel.push(L(k.planOutline(k.insetPlan({ x: GATE_X - 6, y: -17.5, w: 12, d: 35, r: 1.4 }, 2), 37, P, 3), { tone: "faint" }));
  lintel.push(S(k.cylinder(GATE_X, 0, 5.6, 37, 2.4, P, 28), { tone: "hi", lit: true }));
  lintel.push(L(k.ring(GATE_X, 0, 3.4, 39.4, P, 20), { tone: "mid" }));
  lintel.push(D([at([GATE_X, 0, 39.4])], { size: 0.5, tone: "hi" }));
  add("gate-lintel", key(GATE_X, 0, 40), lintel.join(""));
  add("gate-front", key(GATE_X, 14, 12) + 0.01, post(14));
}

// 3. Diverter (isBookingIntent): a turntable with a pivoting tongue (tongue is live).
{
  const out = [];
  out.push(S(k.cylinder(DIV[0], DIV[1], 17, 0, 5, P, 40, 0.6), { tone: "mid" }));
  out.push(L(k.ring(DIV[0], DIV[1], 14, 5, P, 40), { tone: "faint" }));
  out.push(L(k.radialTicks(DIV[0], DIV[1], 12.8, 36, 6, 5, [1, 2], P).minor, { tone: "lo" }));
  out.push(S(k.cylinder(DIV[0], DIV[1], 4.2, 5, 4, P, 24, 0.4), { tone: "hi" }));
  add("diverter", key(DIV[0], DIV[1], 0), out.join(""));
}

// 4. Cabinet of cards (the owner's knowledge, scoped by userId): tiers of drawers with one pulled out.
const CAB = { x: -66, y: 14, w: 76, d: 40, r: 2.4 };
{
  const out = [];
  const tiers = 5;
  const tierH = 7.2;
  out.push(box({ ...CAB, x: CAB.x - 2, y: CAB.y - 2, w: CAB.w + 4, d: CAB.d + 4 }, 0, 3, "lo", 3, 0.4));
  for (let i = 0; i < tiers; i++) {
    const z = 3 + i * tierH;
    out.push(box(CAB, z, tierH - 0.5, "mid", 3, 0.4));
    out.push(L(k.sideSeam(CAB, z + tierH - 0.5, P, 3), { tone: "lo" }));
    // drawer handle on the +y face: a short slab with a recessed groove above it
    const handle = { x: CAB.x + CAB.w / 2 - 6, y: CAB.y + CAB.d, w: 12, d: 1.6, r: 0.6 };
    out.push(S(k.slabOf(handle, z + 2.2, 2, P, 2), { tone: "hi", crease: "none" }));
  }
  const top = 3 + tiers * tierH;
  out.push(box({ ...CAB, x: CAB.x - 1.5, y: CAB.y - 1.5, w: CAB.w + 3, d: CAB.d + 3 }, top - 0.5, 3, "mid", 3, 0.6));
  out.push(groove(CAB, top + 2.5));
  out.push(screws(CAB, top + 2.5));
  out.push(labelPlate(CAB.x + 8, CAB.y + 10, top + 2.5));
  add("cabinet", key(CAB.x + CAB.w / 2, CAB.y + CAB.d / 2, 20), out.join(""));
  // the retrieval arm on a post: reaches over the track edge, ends in a lit card
  const arm = [];
  arm.push(S(k.cylinder(CAB.x + CAB.w + 8, 34, 4, 0, 28, P, 24), { tone: "mid" }));
  arm.push(S(k.cylinder(CAB.x + CAB.w + 8, 34, 5.6, 0, 3, P, 24), { tone: "lo" }));
  arm.push(S(k.slabOf({ x: CAB.x + CAB.w - 14, y: 31.5, w: 28, d: 5, r: 1.2 }, 28, 3.4, P, 3, 0.4), { tone: "mid" }));
  arm.push(S(k.slabOf({ x: CAB.x + CAB.w - 14, y: 38, w: 10, d: 1.2, r: 0.4 }, 24, 8, P, 2), { tone: "hi", lit: true }));
  add("arm", key(CAB.x + CAB.w + 8, 34, 20) + 0.02, arm.join(""));
}

// 5. Crawl-and-embed press behind the cabinet (the knowledge is fed from here): hopper over a press with a spring.
{
  const base = { x: -62, y: -30, w: 62, d: 30, r: 2.4 };
  const out = [];
  out.push(box(base, 0, 10, "mid", 3, 0.5));
  out.push(groove(base, 10));
  out.push(screws(base, 10));
  // two guide columns and a head
  const columns = [[-52, -22], [-52, -8], [-10, -22], [-10, -8]];
  for (const [x, y] of columns) out.push(S(k.cylinder(x, y, 1.8, 10, 26, P, 16), { tone: "mid", crease: "none" }));
  out.push(box({ x: -58, y: -26, w: 52, d: 22, r: 2 }, 36, 7, "mid", 3, 0.6));
  out.push(L(k.planOutline(k.insetPlan({ x: -58, y: -26, w: 52, d: 22, r: 2 }, 2.4), 43, P, 3), { tone: "faint" }));
  // hopper funnel: three stacked discs
  out.push(S(k.cylinder(-32, -15, 11, 43, 3, P, 32), { tone: "mid" }));
  out.push(S(k.cylinder(-32, -15, 8.4, 46, 4, P, 32), { tone: "lo" }));
  out.push(S(k.cylinder(-32, -15, 5.6, 50, 4, P, 28), { tone: "mid" }));
  out.push(L(k.ring(-32, -15, 4, 54, P, 20), { tone: "faint" }));
  out.push(L(k.knurl(-32, -15, 11, 43, 46, 40, P), { tone: "lo" }));
  // output chute down to the cabinet
  out.push(S(k.slabOf({ x: -36, y: -4, w: 8, d: 18, r: 1.2 }, 30, 8, P, 3, 0.3), { tone: "mid", crease: "none" }));
  add("press", key(-31, -15, 24), out.join(""));
}

// 6. Groq pump (the language model): a drum with a coil spring on a rod and a knurled cap.
{
  const cx = 62, cy = 36;
  const out = [];
  out.push(S(k.cylinder(cx, cy, 20, 0, 4, P, 40), { tone: "lo" }));
  out.push(S(k.cylinder(cx, cy, 15.5, 4, 24, P, 40, 0.8), { tone: "mid" }));
  out.push(L([10, 18].map((z) => k.sideArc(cx, cy, 15.5, z, P, 24)).join(""), { tone: "faint" }));
  out.push(L(k.knurl(cx, cy, 15.5, 4, 10, 40, P), { tone: "lo" }));
  out.push(S(k.cylinder(cx, cy, 11, 28, 3, P, 32), { tone: "hi" }));
  out.push(L(k.ring(cx, cy, 8, 31, P, 28), { tone: "faint" }));
  out.push(L(k.radialTicks(cx, cy, 9.4, 20, 5, 31, [0.8, 1.8], P).minor, { tone: "lo" }));
  out.push(S(k.cylinder(cx, cy, 2.2, 31, 12, P, 16), { tone: "hi", lit: true }));
  out.push(S(k.cylinder(cx, cy, 5, 43, 4, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(cx, cy, 5, 43, 47, 18, P), { tone: "lo" }));
  add("pump", key(cx, cy, 24), out.join(""));
  // intake pipe stub from the side
  const pipe = [];
  pipe.push(S(k.slabOf({ x: cx - 36, y: cy - 3, w: 22, d: 6, r: 2 }, 8, 6, P, 3, 0.3), { tone: "mid", crease: "none" }));
  pipe.push(S(k.slabOf({ x: cx - 38, y: cy - 4.4, w: 4, d: 8.8, r: 1.4 }, 7, 8, P, 3, 0.3), { tone: "lo" }));
  add("pump-pipe", key(cx - 25, cy, 8) - 0.02, pipe.join(""));
}

// 7. Verifier (answerWithGuards): twin columns, a lintel and a dial that compares figures against the sources.
const VER_X = 142;
{
  const out = [];
  const base = { x: VER_X - 24, y: 20, w: 48, d: 30, r: 2.4 };
  out.push(box(base, 0, 7, "mid", 3, 0.5));
  out.push(groove(base, 7));
  out.push(screws(base, 7));
  for (const x of [VER_X - 17, VER_X + 17]) {
    out.push(S(k.cylinder(x, 35, 3.6, 7, 26, P, 20), { tone: "mid" }));
    out.push(L(k.sideArc(x, 35, 3.6, 16, P, 12), { tone: "faint" }));
  }
  out.push(box({ x: VER_X - 22, y: 28, w: 44, d: 14, r: 2 }, 33, 6, "mid", 3, 0.5));
  // dial on top
  out.push(S(k.cylinder(VER_X, 35, 13, 39, 6, P, 48, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(VER_X, 35, 10.6, 45, P, 48), { tone: "lo" }));
  const ticks = k.radialTicks(VER_X, 35, 10, 40, 5, 45, [1.2, 2.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.knurl(VER_X, 35, 13, 39, 42, 60, P, 0.3), { tone: "lo" }));
  out.push(S(k.cylinder(VER_X, 35, 1.6, 45, 1.2, P, 14), { tone: "mid" }));
  add("verifier", key(VER_X, 35, 24), out.join(""));
}

// 8. Reply tray (the answer leaves the machine): a shallow tray at the end stop.
{
  const out = [];
  const tray = { x: 204, y: 16, w: 34, d: 24, r: 2 };
  out.push(box(tray, 0, 8, "mid", 3, 0.5));
  out.push(box(k.insetPlan(tray, 2.2), 8, 1.4, "lo", 3, 0.3, { crease: "none" }));
  out.push(screws(tray, 9.4, 2.8));
  out.push(S(k.slabOf({ x: 208, y: 20, w: 20, d: 1.4, r: 0.5 }, 9.4, 6, P, 2), { tone: "hi", lit: true }));
  add("reply", key(221, 28, 8), out.join(""));
}

// ---- booking line ---------------------------------------------------------------------------------------

// 9. Seat counter: three towers of beads on rods: sold, held and free (truth: the live numbers in the readout).
const SEATS = { sold: 4, held: 2, free: 4 };
const SEAT_X = -34;
{
  const out = [];
  const base = { x: SEAT_X - 40, y: -122, w: 80, d: 36, r: 2.4 };
  out.push(box(base, 0, 7, "mid", 3, 0.5));
  out.push(groove(base, 7));
  out.push(screws(base, 7));
  const rods = [[SEAT_X - 24, -104, "sold", SEATS.sold], [SEAT_X, -104, "held", SEATS.held], [SEAT_X + 24, -104, "free", SEATS.free]];
  for (const [x, y, kind, n] of rods) {
    out.push(S(k.cylinder(x, y, 1.1, 7, 38, P, 12), { tone: "mid", crease: "none" }));
    for (let i = 0; i < n; i++) out.push(S(k.cylinder(x, y, 6.4, 8 + i * 3.4, 3, P, 28, 0.3), { tone: kind === "free" ? "lo" : "mid", lit: kind === "held" }));
    out.push(S(k.cylinder(x, y, 2.4, 45, 2.2, P, 16), { tone: "mid" }));
  }
  // top bar tying the rods
  out.push(box({ x: SEAT_X - 30, y: -107.2, w: 60, d: 6.4, r: 1.6 }, 47, 3.4, "mid", 3, 0.4));
  out.push(D([at([SEAT_X - 27, -104, 50.4]), at([SEAT_X + 27, -104, 50.4])], { size: 0.42 }));
  add("seats", key(SEAT_X, -104, 24), out.join(""));
}

// 10. Payment acceptor (Stripe, Razorpay, PayPal, Cashfree): a coin box with a slot and four knurled provider knobs.
const PAY_X = 62;
{
  const out = [];
  const body = { x: PAY_X - 26, y: -118, w: 52, d: 34, r: 2.6 };
  out.push(box(body, 0, 26, "mid", 3, 0.6));
  out.push(groove(body, 26));
  out.push(screws(body, 26));
  // coin slot on top and a coin standing in it
  out.push(S(k.slabOf({ x: PAY_X - 10, y: -104, w: 20, d: 3.4, r: 1.2 }, 26, 0.6, P, 3), { tone: "lo", crease: "none" }));
  out.push(S(k.cylinder(PAY_X, -102.3, 6.4, 26, 1.6, P, 28), { tone: "hi", lit: true }));
  // four provider knobs on the +y face edge (top row)
  [-18, -6, 6, 18].forEach((dx) => {
    out.push(S(k.cylinder(PAY_X + dx, -90, 3.2, 26, 3, P, 20), { tone: "mid" }));
    out.push(L(k.knurl(PAY_X + dx, -90, 3.2, 26, 29, 18, P), { tone: "lo" }));
    out.push(L(k.lineOnTop([PAY_X + dx, -90], [PAY_X + dx + 3.2, -90], 29, P), { tone: "hi" }));
  });
  add("pay", key(PAY_X, -101, 14), out.join(""));
}

// 11. Ticket printer: a box with a paper slot and a ticket carrying a QR-style dot grid.
const TIX_X = 150;
{
  const out = [];
  const body = { x: TIX_X - 24, y: -118, w: 48, d: 32, r: 2.6 };
  out.push(box(body, 0, 20, "mid", 3, 0.6));
  out.push(groove(body, 20));
  out.push(screws(body, 20));
  out.push(S(k.slabOf({ x: TIX_X - 14, y: -101, w: 28, d: 2.4, r: 0.8 }, 20, 0.6, P, 2), { tone: "lo", crease: "none" }));
  // ticket coming out of the slot, lying on the tray in front
  const ticket = { x: TIX_X - 12, y: -100, w: 24, d: 20, r: 1 };
  out.push(S(k.slabOf(ticket, 20.4, 1, P, 2, 0.3), { tone: "hi", lit: true }));
  out.push(D(k.dotGrid(TIX_X - 8, -96, 5, 4, 3.4, 21.4, P), { size: 0.5, tone: "mid" }));
  add("ticket", key(TIX_X, -102, 14), out.join(""));
}

// 12. Door scanner: a gate over the end of the track with a lens; the capsule ends here.
const SCAN_X = 214;
{
  const post = (y) => [
    S(k.slabOf({ x: SCAN_X - 5, y: y - 3.2, w: 10, d: 6.4, r: 1.2 }, 0, 28, P, 3, 0.5), { tone: "mid" }),
    S(k.slabOf({ x: SCAN_X - 6.5, y: y - 4.6, w: 13, d: 9.2, r: 1.6 }, 0, 3.6, P, 3, 0.4), { tone: "lo" }),
  ].join("");
  add("scan-back", key(SCAN_X, BOOK_Y - 14, 12), post(BOOK_Y - 14));
  const lintel = [];
  lintel.push(S(k.slabOf({ x: SCAN_X - 5, y: BOOK_Y - 16.5, w: 10, d: 33, r: 1.2 }, 28, 6, P, 3, 0.6), { tone: "mid" }));
  lintel.push(S(k.cylinder(SCAN_X, BOOK_Y, 5, 34, 2.2, P, 28), { tone: "hi", lit: true }));
  lintel.push(L(k.ring(SCAN_X, BOOK_Y, 3, 36.2, P, 20), { tone: "mid" }));
  lintel.push(D([at([SCAN_X, BOOK_Y, 36.2])], { size: 0.5, tone: "hi" }));
  add("scan-lintel", key(SCAN_X, BOOK_Y, 36), lintel.join(""));
  add("scan-front", key(SCAN_X, BOOK_Y + 14, 12) + 0.01, post(BOOK_Y + 14));
}

// ---- capsule (the visitor's message) ----------------------------------------------------------------------

function capsule() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: -5, y: -5, w: 10, d: 10, r: 5 }, 0, 0.1, P)}" style="filter:blur(2px)"/>`);
  out.push(S(k.cylinder(0, 0, 5.2, RAIL_Z, 9, P, 28, 0.4), { tone: "hi", lit: true }));
  out.push(L(k.sideArc(0, 0, 5.2, RAIL_Z + 3, P, 14), { tone: "mid" }));
  out.push(L(k.sideArc(0, 0, 5.2, RAIL_Z + 6.4, P, 14), { tone: "mid" }));
  out.push(S(k.cylinder(0, 0, 3.6, RAIL_Z + 9, 1.6, P, 22), { tone: "hi", lit: true }));
  return out.join("");
}

// ---- diverter tongue (live) ----------------------------------------------------------------------------

const tongueAt = (angle) => {
  const [x, y] = DIV;
  const tip = [x + Math.cos(angle) * 15, y + Math.sin(angle) * 15];
  const tail = [x - Math.cos(angle) * 6, y - Math.sin(angle) * 6];
  return k.lineOnTop(tail, tip, 9.2, P);
};

// ---- stations the capsule visits, in order, with the true thing each one does -----------------------------

const ASK_STOPS = [
  { x: -246, name: "widget", says: "the visitor types; the embed script posts it to /api/chat" },
  { x: GATE_X, name: "guard", says: "llmGuard: history sanitised, injection patterns and Prompt Guard checked" },
  { x: DIV[0], name: "router", says: "isBookingIntent says: not a booking, take the answer line" },
  { x: -24, name: "recall", says: "Atlas $vectorSearch, filtered to this owner's userId, returns the best passages" },
  { x: 62, name: "compose", says: "Groq writes the reply from the passages, rotating keys if one fails" },
  { x: VER_X, name: "verify", says: "numbers, emails and links not in the sources are blocked or retried" },
  { x: 221, name: "reply", says: "the grounded answer goes back to the widget" },
];
const BOOK_STOPS = [
  ASK_STOPS[0],
  ASK_STOPS[1],
  { x: DIV[0], name: "router", says: "isBookingIntent says: a booking, take the booking line" },
  { x: SEAT_X, name: "seats", says: `seats are taken atomically: ${SEATS.sold} sold, ${SEATS.held} held, ${SEATS.free} free` },
  { x: PAY_X, name: "pay", says: "the owner's own gateway (Stripe, Razorpay, PayPal or Cashfree) takes the payment" },
  { x: TIX_X, name: "ticket", says: "the webhook confirms the booking, issues a QR ticket and emails it" },
  { x: SCAN_X, name: "scan", says: "door staff scan the code once; the ticket cannot be used twice" },
];

// The capsule's path in world space, one polyline per line.
const ASK_PATH = [[ENTRY_X, MAIN_Y], DIV, ASK_START, [END_X - 12, ASK_Y]];
const BOOK_PATH = [[ENTRY_X, MAIN_Y], DIV, BOOK_START, [END_X - 12, BOOK_Y]];


// ---- station name labels (above each machine, ending on a dot on its top face) -----------------------------

// id, text, stop it lights for (if any), the point on the station's top, and a screen-px nudge for the text.
const LABELS = [
  { text: "Widget", stop: "widget", at: [-254, -17, 42], nudge: [0, 0] },
  { text: "Guard", stop: "guard", at: [GATE_X, 0, 39.4], nudge: [0, 0] },
  { text: "Router", stop: "router", at: [DIV[0], DIV[1], 9], nudge: [0, 0] },
  { text: "Crawler", stop: null, at: [-32, -15, 54], nudge: [-34, -16] },
  { text: "Knowledge", stop: "recall", at: [CAB.x + 10, CAB.y + 8, 41.5], nudge: [-50, 48] },
  { text: "Model", stop: "compose", at: [62, 36, 47], nudge: [0, 0] },
  { text: "Verifier", stop: "verify", at: [VER_X, 35, 45], nudge: [0, 0] },
  { text: "Reply", stop: "reply", at: [221, 28, 15], nudge: [0, 0] },
  { text: "Seats", stop: "seats", at: [SEAT_X, -104, 50.4], nudge: [0, 0] },
  { text: "Payment", stop: "pay", at: [PAY_X, -102, 29], nudge: [0, 0] },
  { text: "Ticket", stop: "ticket", at: [TIX_X, -96, 21.4], nudge: [0, -12] },
  { text: "Scanner", stop: "scan", at: [SCAN_X, BOOK_Y, 36], nudge: [16, -4] },
];
const LABEL_RISE = 14;

function labels() {
  const out = [
    `<style>[data-label]{font:8.5px var(--anatomy-mono);letter-spacing:.1em;text-transform:uppercase;fill:var(--anatomy-muted);paint-order:stroke;stroke:var(--anatomy-card);stroke-width:3.2px;stroke-linejoin:round;transition:fill .25s}[data-label][data-on]{fill:var(--anatomy-text)}@media (max-width:560px){[data-layer=labels]{display:none}}</style>`,
  ];
  for (const label of LABELS) {
    const [x, y, z] = label.at;
    const top = at([x, y, z]);
    const head = at([x, y, z + LABEL_RISE]);
    const tx = head[0] + label.nudge[0];
    const ty = head[1] + label.nudge[1] - 3;
    // leader from the text down to a dot on the station's top face
    out.push(k.lineSvg(`M${tx.toFixed(1)} ${(ty + 2).toFixed(1)}L${top[0].toFixed(1)} ${top[1].toFixed(1)}`, { tone: "lo", free: "start" }));
    out.push(k.dotsSvg([top], { size: 0.55, tone: "mid" }));
    out.push(`<text data-label${label.stop ? ` data-stop="${label.stop}"` : ""} x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle">${label.text}</text>`);
  }
  return out.join("");
}

// ---- assemble ----------------------------------------------------------------------------------------------

const staticItems = items.map((item, index) => `<g data-item="${index}" data-key="${item.key.toFixed(3)}">${item.svg}</g>`);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A sorting desk that stands for the NochBot request path. A capsule, the visitor's message, enters at a terminal, passes a guard gate, and a turntable sends it down one of two lines. The answer line has a cabinet of knowledge drawers, a pump, a verifying dial and a reply tray; the booking line has a seat counter with sold, held and free beads, a payment box, a ticket printer and a door scanner.",
  body: [
    desk(),
    track(),
    `<g data-layer="items">${staticItems.join("")}<g data-part="capsule" data-key="0" transform="${k.translateAlong(P, [ENTRY_X + 14, MAIN_Y, 0])}">${capsule()}</g></g>`,
    `<path data-part="tongue" class="iso-line" data-tone="lit" data-free="start" d="${tongueAt(0)}" style="stroke-width:1.4"/>`,
    `<g data-layer="labels">${labels()}</g>`,
  ],
});

const live = `
const P = ${JSON.stringify(P)};
const ASK = ${JSON.stringify(ASK_PATH)}, BOOK = ${JSON.stringify(BOOK_PATH)};
const ASK_STOPS = ${JSON.stringify(ASK_STOPS)}, BOOK_STOPS = ${JSON.stringify(BOOK_STOPS)};
const DIV = ${JSON.stringify(DIV)};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const layer = svg.querySelector('[data-layer="items"]');
const capsule = svg.querySelector('[data-part="capsule"]');
const tongue = svg.querySelector('[data-part="tongue"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const tongueAt = ${tongueAt.toString().replace("k.lineOnTop", "lineOnTop").replace("DIV", "DIV")};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lengths = (path) => { let t = 0; const out = [0]; for (let i = 1; i < path.length; i++) { t += Math.hypot(path[i][0] - path[i-1][0], path[i][1] - path[i-1][1]); out.push(t); } return out; };
const along = (path, cum, s) => {
  s = clamp(s, 0, cum[cum.length - 1]);
  let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
  const f = (s - cum[i-1]) / ((cum[i] - cum[i-1]) || 1);
  return [path[i-1][0] + (path[i][0] - path[i-1][0]) * f, path[i-1][1] + (path[i][1] - path[i-1][1]) * f];
};
const lines = { ask: { path: ASK, cum: lengths(ASK), stops: ASK_STOPS }, book: { path: BOOK, cum: lengths(BOOK), stops: BOOK_STOPS } };
const stopS = (line, stop) => { // arc length of the stop = projection of its x on the polyline
  const { path, cum } = line;
  for (let i = 1; i < path.length; i++) if (stop.x >= Math.min(path[i-1][0], path[i][0]) - 0.01 && stop.x <= Math.max(path[i-1][0], path[i][0]) + 0.01) {
    const f = (stop.x - path[i-1][0]) / ((path[i][0] - path[i-1][0]) || 1);
    return cum[i-1] + (cum[i] - cum[i-1]) * clamp(f, 0, 1);
  }
  return cum[cum.length - 1];
};
let which = "ask", line = lines.ask, stopIndex = 0, s = stopS(line, line.stops[0]), target = s, dwell = 1.2, angle = 0;
const sorted = () => [...layer.querySelectorAll(":scope > [data-item]")].map((el) => [parseFloat(el.dataset.key), el]).sort((a, b) => a[0] - b[0]);
const SLOTS = sorted();
function place(x, y) {
  capsule.setAttribute("transform", translateAlong(P, [x, y, 0]));
  const kk = depthOf([x, y, 6], P);
  let before = null; for (const [key, el] of SLOTS) if (key > kk) { before = el; break; }
  if (capsule.nextSibling !== before) layer.insertBefore(capsule, before);
}
let frame = 0, last = 0, visible = false, auto = true, autoTimer = 0;
const saysEl = document.querySelector("[data-says]");
const labelEls = [...svg.querySelectorAll("[data-label][data-stop]")];
const say = () => { const stop = line.stops[stopIndex]; const text = (stopIndex + 1) + "/" + line.stops.length + " · " + stop.name; if (readout.textContent !== text) { readout.textContent = text; saysEl.textContent = stop.says; for (const el of labelEls) el.toggleAttribute("data-on", el.dataset.stop === stop.name); } };
function send(next) { which = next; line = lines[which]; stopIndex = 0; s = stopS(line, line.stops[0]); target = s; dwell = 0.9; run(); }
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60; last = now;
  const calm = still.matches;
  if (dwell > 0) { dwell -= dt; if (dwell <= 0) { if (stopIndex < line.stops.length - 1) { stopIndex++; target = stopS(line, line.stops[stopIndex]); } else if (auto) { send(which === "ask" ? "book" : "ask"); } } }
  else if (s !== target) {
    const speed = 130; const step = Math.sign(target - s) * Math.min(Math.abs(target - s), speed * dt);
    // ease in and out: slow near the target
    const near = Math.abs(target - s); const eased = Math.min(1, 0.25 + near / 50);
    s += Math.sign(target - s) * Math.min(near, speed * eased * dt);
    if (Math.abs(target - s) < 0.05) { s = target; dwell = 1.6; }
  }
  if (calm) { s = target; }
  const [x, y] = along(line.path, line.cum, s);
  place(x, y);
  const want = which === "ask" ? Math.atan2(${ASK_Y} - DIV[1], ${ASK_START[0]} - DIV[0]) : Math.atan2(${BOOK_Y} - DIV[1], ${BOOK_START[0]} - DIV[0]);
  const wantNow = x < DIV[0] - 6 && stopIndex < 2 ? want : want;
  angle += (wantNow - angle) * (1 - Math.exp(-dt / 0.18));
  tongue.setAttribute("d", tongueAt(angle));
  say();
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
function steer(next) { auto = false; send(next); clearTimeout(autoTimer); autoTimer = setTimeout(() => { auto = !still.matches; }, 9000); }
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) auto = false;
stage.addEventListener("click", (event) => { const box = svg.getBoundingClientRect(); steer((event.clientY - box.top) / box.height > 0.5 ? "ask" : "book"); });
stage.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp" || event.key === "b") { event.preventDefault(); steer("book"); }
  if (event.key === "ArrowDown" || event.key === "a" || event.key === "Enter" || event.key === " ") { event.preventDefault(); steer("ask"); }
});
// When embedded, tell the host page how tall the figure is so its frame fits exactly.
if (parent !== window) {
  document.documentElement.style.overflow = "hidden";
  const fig = document.querySelector(".iso-figure") || document.body;
  const post = () => {
    const style = getComputedStyle(fig), pad = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
    parent.postMessage({ type: 'nochbot-figure', height: Math.ceil(fig.getBoundingClientRect().bottom + scrollY + (parseFloat(style.marginBottom) || 0) + pad) }, '*');
  };
  new ResizeObserver(post).observe(fig); addEventListener("load", post); post();
}
place(...along(line.path, line.cum, s));
tongue.setAttribute("d", tongueAt(0));
say();
`;

const html = k.plateHtml({
  fig: "Fig 1",
  title: "The sorting desk",
  hint: "Click the front to ask, the back to book",
  readout: "1/7 · " + ASK_STOPS[0].name,
  body: `<div class="iso-stage" tabindex="0" role="img" aria-label="The NochBot request path as a sorting desk. Press A for the answer line, B for the booking line.">${svg}</div><p data-says aria-live="polite" style="margin:6px auto 0;max-width:62ch;min-height:2.9em;text-align:center;font:12px/1.5 var(--anatomy-mono);color:var(--anatomy-muted)">${ASK_STOPS[0].says}</p>`,
});

const name = theme === "light" ? "app-flow-light.html" : "app-flow.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "NochBot sorting desk", theme, body: html, script: kitScript() + live, width: 880 }));
console.log("wrote", name, `(${items.length} depth items)`);
