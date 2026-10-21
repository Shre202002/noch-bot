"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Camera, CameraOff, CheckCircle2, Loader2, LogOut, ScanLine, XCircle } from "lucide-react";

type Counts = { total: number; scanned: number; remaining: number };
type Me = { signedIn: boolean; loginId?: string; event?: { name: string; startAt: string | null; venue: string | null } | null; counts?: Counts; code?: string; message?: string };
type Result = {
  result: string;
  code?: string;
  attendee?: string | null;
  scannedAt?: string | null;
  scannedBy?: string | null;
  retry?: boolean;
  counts?: Counts;
};
type Banner = { tone: "ok" | "warn" | "bad"; title: string; detail?: string; code?: string };

const REPEAT_LOCK_MS = 2500;

/** How each server outcome is shown to the person at the door. */
function bannerFor(r: Result): Banner {
  const who = r.attendee ? r.attendee : undefined;
  const when = r.scannedAt ? new Date(r.scannedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
  switch (r.result) {
    case "admitted":
      return { tone: "ok", title: "Admitted", detail: who ?? "Valid ticket", code: r.code };
    case "already_scanned":
      return { tone: "warn", title: "Already scanned", detail: [who, when && `at ${when}`, r.scannedBy && `by ${r.scannedBy}`].filter(Boolean).join(" · "), code: r.code };
    case "void":
      return { tone: "bad", title: "Ticket is not valid", detail: "This ticket was cancelled.", code: r.code };
    case "wrong_event":
      return { tone: "bad", title: "Wrong event", detail: "This ticket is for a different event.", code: r.code };
    case "test_ticket":
      return { tone: "bad", title: "Test ticket", detail: "Made to try the booking. It cannot admit anyone.", code: r.code };
    case "not_confirmed":
      return { tone: "bad", title: "Booking not confirmed", detail: "Payment or booking is not complete, or it was refunded.", code: r.code };
    case "tampered":
      return { tone: "bad", title: "Fake ticket", detail: "This code was not issued by us.", code: r.code };
    case "not_found":
      return { tone: "bad", title: "Ticket not found", detail: "No ticket has this code.", code: r.code };
    default:
      return { tone: "bad", title: "Not a ticket code", detail: "Scan the QR code on the ticket, or type the code that starts with EVT-." };
  }
}

const TONE = {
  ok: { box: "border-emerald-400 bg-emerald-500/20 text-emerald-100", Icon: CheckCircle2 },
  warn: { box: "border-amber-400 bg-amber-500/20 text-amber-100", Icon: AlertTriangle },
  bad: { box: "border-red-400 bg-red-500/20 text-red-100", Icon: XCircle },
} as const;

const newScanId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

export default function ScannerPage() {
  const { slug } = useParams<{ slug: string }>();
  const api = `/api/scan/${slug}`;

  const [me, setMe] = useState<Me | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);

  // sign-in form
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // scanner
  const [banner, setBanner] = useState<Banner | null>(null);
  const [checking, setChecking] = useState(false);
  const [manual, setManual] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraNote, setCameraNote] = useState("");
  const [history, setHistory] = useState<Array<Banner & { at: number }>>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastSeen = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const busy = useRef(false);

  const refreshMe = useCallback(async () => {
    const res = await fetch(`${api}/auth/me`, { cache: "no-store" });
    if (res.status === 404) { setUnavailable(true); return null; }
    const data: Me = await res.json().catch(() => ({ signedIn: false }));
    setMe(data);
    if (data.counts) setCounts(data.counts);
    return data;
  }, [api]);

  useEffect(() => { void refreshMe().catch(() => setMe({ signedIn: false, message: "Could not reach the server. Check your connection." })); }, [refreshMe]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);
  useEffect(() => stopCamera, [stopCamera]);

  const signIn = useCallback(async (id: string, pass: string, quiet = false) => {
    const res = await fetch(`${api}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ loginId: id, password: pass }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setWaiting(false); setPassword(""); setFormError(""); await refreshMe(); return true; }
    if (data.code === "pending") { setWaiting(true); setFormError(""); return false; }
    setWaiting(false);
    if (!quiet || data.code !== "invalid") setFormError(data.error || "Could not sign in.");
    return false;
  }, [api, refreshMe]);

  // While waiting for approval, try again every few seconds so the screen moves on by itself.
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => { void signIn(loginId.trim(), password, true); }, 4000);
    return () => clearInterval(t);
  }, [waiting, loginId, password, signIn]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      if (mode === "register") {
        const res = await fetch(`${api}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ loginId, password }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setFormError(data.error || "Could not create the account."); return; }
        setWaiting(true);
      } else {
        await signIn(loginId.trim(), password);
      }
    } catch {
      setFormError("Connection problem. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = async () => {
    stopCamera();
    await fetch(`${api}/auth/logout`, { method: "POST" }).catch(() => {});
    setBanner(null);
    setHistory([]);
    await refreshMe();
  };

  const check = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || busy.current) return;
    busy.current = true;
    setChecking(true);
    try {
      const res = await fetch(`${api}/scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketCode: text, clientScanId: newScanId() }) });
      if (res.status === 401 || res.status === 403) {
        stopCamera();
        await refreshMe();
        return;
      }
      const data: Result & { error?: string } = await res.json().catch(() => ({ result: "error" }));
      if (!res.ok) { setBanner({ tone: "bad", title: "Could not check the ticket", detail: data.error || "Try again." }); return; }
      const b = bannerFor(data);
      setBanner(b);
      setHistory((h) => [{ ...b, at: Date.now() }, ...h].slice(0, 8));
      if (data.counts) setCounts(data.counts);
      try { navigator.vibrate?.(b.tone === "ok" ? 80 : [60, 60, 60]); } catch { /* not supported */ }
    } catch {
      setBanner({ tone: "bad", title: "Connection problem", detail: "Nothing was checked. Try again." });
    } finally {
      busy.current = false;
      setChecking(false);
    }
  }, [api, refreshMe, stopCamera]);

  const startCamera = async () => {
    setCameraNote("");
    if (!navigator.mediaDevices?.getUserMedia) { setCameraNote("The camera needs a secure (https) page. Type the ticket code instead."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      setCameraNote("Camera permission was blocked. Allow it in your browser, or type the ticket code instead.");
    }
  };

  // Read QR codes from the camera: the browser's detector when there is one, jsQR otherwise.
  useEffect(() => {
    if (!cameraOn) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {});

    let stopped = false;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    type Detector = { detect: (v: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
    const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const detector = Native ? new Native({ formats: ["qr_code"] }) : null;
    let jsQR: typeof import("jsqr").default | null = null;

    const tick = async () => {
      if (stopped) return;
      if (video.readyState >= 2 && !busy.current) {
        let value = "";
        try {
          if (detector) {
            value = (await detector.detect(video))[0]?.rawValue ?? "";
          } else if (context) {
            jsQR = jsQR ?? (await import("jsqr")).default;
            const scale = Math.min(1, 640 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            value = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data ?? "";
          }
        } catch { /* a frame that cannot be read is skipped */ }
        const now = Date.now();
        if (value && !(value === lastSeen.current.code && now - lastSeen.current.at < REPEAT_LOCK_MS)) {
          lastSeen.current = { code: value, at: now };
          void check(value);
        }
      }
      setTimeout(tick, detector ? 150 : 250);
    };
    void tick();
    return () => { stopped = true; };
  }, [cameraOn, check]);

  // ── screens ────────────────────────────────────────────────────────────────

  const shell = (children: React.ReactNode) => (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 bg-[#0a0a0a] px-4 py-6 text-white">{children}</main>
  );

  if (unavailable) {
    return shell(
      <div className="my-auto space-y-3 text-center">
        <XCircle aria-hidden="true" className="mx-auto h-12 w-12 text-red-400" />
        <h1 className="text-xl font-bold">This scanner link isn&apos;t available</h1>
        <p className="text-sm text-white/60">It may have been switched off or replaced. Ask the organizer for the current link.</p>
      </div>
    );
  }
  if (!me) {
    return shell(<div className="my-auto flex justify-center"><Loader2 aria-label="Loading" className="h-8 w-8 animate-spin text-white/60" /></div>);
  }

  if (!me.signedIn) {
    const note = formError || (me.code && me.code !== "none" ? me.message : "");
    return shell(
      <>
        <header className="space-y-1 pt-6 text-center">
          <ScanLine aria-hidden="true" className="mx-auto h-10 w-10 text-[#36f4a4]" />
          <h1 className="text-2xl font-black">Ticket scanner</h1>
          <p className="text-sm text-white/60">Sign in to scan tickets at the door.</p>
        </header>

        {waiting ? (
          <div role="status" className="space-y-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-5 text-center">
            <Loader2 aria-hidden="true" className="mx-auto h-6 w-6 animate-spin text-amber-300" />
            <p className="font-semibold text-amber-100">Waiting for the organizer to approve your account</p>
            <p className="text-sm text-amber-100/70">Keep this page open. It signs you in automatically as soon as you are approved.</p>
            <button type="button" onClick={() => { setWaiting(false); setMode("login"); }} className="text-sm text-white/60 underline">Back</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1 text-sm font-semibold">
              {(["login", "register"] as const).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setFormError(""); }}
                  className={`rounded-lg py-2 ${mode === m ? "bg-[#36f4a4] text-black" : "text-white/70"}`}>
                  {m === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-white/70">Login ID</span>
              <input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" autoCapitalize="none" required
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-3 text-base text-white" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-white/70">Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 8 : undefined}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-3 text-base text-white" />
              {mode === "register" && <span className="mt-1 block text-xs text-white/50">At least 8 characters. The organizer must approve your account before you can scan.</span>}
            </label>
            {note && <p role="alert" className="text-sm text-amber-300">{note}</p>}
            <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#36f4a4] py-3 text-base font-bold text-black disabled:opacity-60">
              {submitting && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        )}
      </>
    );
  }

  const Tone = banner ? TONE[banner.tone] : null;
  return shell(
    <>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black">{me.event?.name ?? "Ticket scanner"}</h1>
          <p className="truncate text-xs text-white/50">Signed in as {me.loginId}</p>
        </div>
        <button type="button" onClick={signOut} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80">
          <LogOut aria-hidden="true" className="h-4 w-4" /> Sign out
        </button>
      </header>

      {counts && (
        <div className="grid grid-cols-3 gap-2 text-center" aria-label="Door counts">
          {[["Scanned", counts.scanned], ["Left", counts.remaining], ["Total", counts.total]].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl bg-white/5 py-2">
              <p className="text-2xl font-black tabular-nums">{value}</p>
              <p className="text-[11px] uppercase tracking-wide text-white/50">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div aria-live="assertive" className="min-h-[8.5rem]">
        {checking ? (
          <div className="flex h-full min-h-[8.5rem] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-white/70">
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> Checking…
          </div>
        ) : banner && Tone ? (
          <div className={`flex min-h-[8.5rem] items-center gap-4 rounded-2xl border-2 p-5 ${Tone.box}`}>
            <Tone.Icon aria-hidden="true" className="h-12 w-12 shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl font-black">{banner.title}</p>
              {banner.detail && <p className="break-words text-base">{banner.detail}</p>}
              {banner.code && <p className="mt-1 font-mono text-xs opacity-70">{banner.code}</p>}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[8.5rem] items-center justify-center rounded-2xl border border-dashed border-white/15 p-5 text-center text-white/50">
            Point the camera at a ticket QR code, or type the code below.
          </div>
        )}
      </div>

      <section className="space-y-3">
        {cameraOn ? (
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
            <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-[#36f4a4]/70" />
            <button type="button" onClick={stopCamera} className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/70 px-3 py-2 text-sm">
              <CameraOff aria-hidden="true" className="h-4 w-4" /> Stop camera
            </button>
          </div>
        ) : (
          <button type="button" onClick={startCamera} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#36f4a4] py-4 text-lg font-bold text-black">
            <Camera aria-hidden="true" className="h-6 w-6" /> Start camera
          </button>
        )}
        {cameraNote && <p role="alert" className="text-sm text-amber-300">{cameraNote}</p>}

        <form onSubmit={(e) => { e.preventDefault(); void check(manual); setManual(""); }} className="flex gap-2">
          <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Type ticket code (EVT-…)" aria-label="Ticket code" autoCapitalize="characters" autoComplete="off"
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-3 font-mono text-base text-white" />
          <button type="submit" disabled={checking || !manual.trim()} className="rounded-xl bg-white px-5 py-3 font-bold text-black disabled:opacity-50">Check</button>
        </form>
      </section>

      {history.length > 0 && (
        <section aria-label="Recent scans" className="space-y-2">
          <h2 className="text-xs uppercase tracking-wide text-white/50">This session</h2>
          <ul className="space-y-1.5">
            {history.map((h, i) => (
              <li key={h.at + String(i)} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{h.detail || h.title}</span>
                <span className={`shrink-0 text-xs font-semibold ${h.tone === "ok" ? "text-emerald-300" : h.tone === "warn" ? "text-amber-300" : "text-red-300"}`}>{h.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
