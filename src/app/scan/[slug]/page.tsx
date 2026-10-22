"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, AtSign, CalendarDays, Camera, CameraOff, CheckCircle2, Eye, EyeOff, Flashlight, Loader2, Lock, LogOut, MapPin, ScanLine, UserRound, XCircle } from "lucide-react";
import { createSameCodeLock, openCamera, startQrReading, type CameraHandle } from "@/lib/qrScanner";
import { armSound, signalResult } from "@/lib/scanFeedback";

type Counts = { total: number; scanned: number; remaining: number };
type Me = { signedIn: boolean; loginId?: string; name?: string | null; event?: { name: string; startAt: string | null; venue: string | null } | null; counts?: Counts; code?: string; message?: string };
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

// How long a result stays on screen before the page is ready-looking again, and how often the door counts are re-checked.
const RESULT_SHOWN_MS = 4000;
const COUNTS_SYNC_MS = 15000;

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

const INPUT = "h-12 w-full rounded-xl border border-white/15 bg-black/40 pl-10 pr-3 text-base text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#36f4a4] focus:ring-2 focus:ring-[#36f4a4]/30";

/** How strong a password looks: length and variety, shown while creating an account. */
function passwordStrength(password: string): { score: number; label: string; bar: string; text: string } {
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  const score = password.length < 8 ? 1 : password.length >= 12 && variety >= 3 ? 3 : variety >= 2 ? 2 : 1;
  if (password.length < 8) return { score: 1, label: "Too short", bar: "bg-red-400", text: "text-red-300" };
  return score === 3
    ? { score, label: "Strong", bar: "bg-emerald-400", text: "text-emerald-300" }
    : score === 2
      ? { score, label: "Okay", bar: "bg-amber-400", text: "text-amber-300" }
      : { score, label: "Weak: add numbers or capitals", bar: "bg-orange-400", text: "text-orange-300" };
}

function Field({ label, icon: Icon, hint, error, children }: { label: string; icon: typeof Lock; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-white/80">{label}</span>
      <span className="relative block">
        <Icon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/40" />
        {children}
      </span>
      {error ? <span role="alert" className="mt-1.5 block text-xs text-red-300">{error}</span> : hint ? <span className="mt-1.5 block text-xs text-white/45">{hint}</span> : null}
    </label>
  );
}

/** A password box with an eye button to show or hide what is typed. */
function PasswordInput({ value, onChange, autoComplete, placeholder, invalid }: { value: string; onChange: (v: string) => void; autoComplete: string; placeholder: string; invalid?: boolean }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <input type={shown ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} autoCapitalize="none" required placeholder={placeholder}
        aria-invalid={invalid || undefined} className={`${INPUT} pr-12 ${invalid ? "border-red-400/70 focus:border-red-400 focus:ring-red-400/30" : ""}`} />
      <button type="button" onClick={() => setShown((v) => !v)} aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown}
        className="absolute right-0.5 top-1/2 grid size-11 -translate-y-1/2 place-content-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white">
        {shown ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
      </button>
    </>
  );
}

export default function ScannerPage() {
  const { slug } = useParams<{ slug: string }>();
  const api = `/api/scan/${slug}`;

  const [me, setMe] = useState<Me | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);

  // sign-in form
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginId, setLoginId] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // scanner
  const [banner, setBanner] = useState<Banner | null>(null);
  const [checking, setChecking] = useState(false);
  const [manual, setManual] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraNote, setCameraNote] = useState("");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [history, setHistory] = useState<Array<Banner & { at: number }>>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<CameraHandle | null>(null);
  const lock = useRef(createSameCodeLock());
  const busy = useRef(false);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const autoStarted = useRef(false);

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
    cameraRef.current?.stream.getTracks().forEach((t) => t.stop());
    cameraRef.current = null;
    setCameraOn(false);
    setTorchOn(false);
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

  // An error is about what was typed, so it goes away as soon as the person edits a field.
  useEffect(() => setFormError(""), [fullName, loginId, password, confirm]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      if (mode === "register") {
        if (fullName.trim().length < 2) { setFormError("Enter your name."); return; }
        if (password !== confirm) { setFormError("Passwords do not match."); return; }
        const res = await fetch(`${api}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: fullName, loginId, password }) });
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
      signalResult(b.tone === "ok");
      // The count moves the instant someone is admitted; the server's numbers are re-checked every few seconds.
      if (data.result === "admitted" && !data.retry) setCounts((c) => (c ? { total: c.total, scanned: c.scanned + 1, remaining: Math.max(0, c.remaining - 1) } : c));
      else if (data.counts) setCounts(data.counts);
      clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => setBanner(null), RESULT_SHOWN_MS);
    } catch {
      setBanner({ tone: "bad", title: "Connection problem", detail: "Nothing was checked. Try again." });
    } finally {
      busy.current = false;
      setChecking(false);
    }
  }, [api, refreshMe, stopCamera]);

  const startCamera = useCallback(async () => {
    setCameraNote("");
    if (!navigator.mediaDevices?.getUserMedia) { setCameraNote("The camera needs a secure (https) page. Type the ticket code instead."); return; }
    try {
      const camera = await openCamera();
      cameraRef.current = camera;
      setTorchSupported(camera.torchSupported);
      setCameraOn(true);
    } catch {
      setCameraNote("Camera permission was blocked. Allow it in your browser, or type the ticket code instead.");
    }
  }, []);

  // The camera starts by itself once signed in, so the first ticket can be scanned without touching anything.
  useEffect(() => {
    if (!me?.signedIn || autoStarted.current) return;
    autoStarted.current = true;
    void startCamera();
  }, [me?.signedIn, startCamera]);

  // Every code the camera sees: a new one is checked at once; the same one is ignored while it stays in view.
  useEffect(() => {
    if (!cameraOn) return;
    const video = videoRef.current;
    const camera = cameraRef.current;
    if (!video || !camera) return;
    video.srcObject = camera.stream;
    void video.play().catch(() => {});
    return startQrReading(video, (text) => {
      if (busy.current) { lock.current.touch(text); return; }
      if (lock.current.accept(text)) void check(text);
    });
  }, [cameraOn, check]);

  // Door counts also change from other phones and the dashboard, so they are re-read every few seconds.
  useEffect(() => {
    if (!me?.signedIn) return;
    const t = setInterval(() => { if (!document.hidden) void refreshMe().catch(() => {}); }, COUNTS_SYNC_MS);
    return () => clearInterval(t);
  }, [me?.signedIn, refreshMe]);

  const toggleTorch = async () => {
    const next = !torchOn;
    await cameraRef.current?.setTorch(next);
    setTorchOn(next);
  };

  // ── screens ────────────────────────────────────────────────────────────────

  const shell = (children: React.ReactNode) => (
    <div onPointerDown={armSound} className="min-h-dvh bg-[#0a0a0a] text-white">
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 pb-28 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1.5rem,env(safe-area-inset-top))] short-landscape:max-w-4xl short-landscape:pb-6 short-landscape:pt-3">{children}</main>
    </div>
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
    const when = me.event?.startAt ? new Date(me.event.startAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "";
    const eventLine = [when, me.event?.venue].filter(Boolean).join(" · ");
    const registering = mode === "register";
    const strength = passwordStrength(password);
    const mismatch = registering && confirm.length > 0 && confirm !== password;

    return shell(
      <>
        <header className="flex flex-col items-center gap-3 pt-4 text-center">
          <span className="grid size-16 place-content-center rounded-2xl bg-gradient-to-br from-[#36f4a4]/30 to-[#36f4a4]/5 ring-1 ring-[#36f4a4]/40 short-landscape:hidden">
            <ScanLine aria-hidden="true" className="h-8 w-8 text-[#36f4a4]" />
          </span>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Ticket scanner</h1>
            <p className="mt-1 text-sm text-white/60">Sign in to scan tickets at the door.</p>
          </div>
          {me.event?.name && (
            <div className="max-w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5">
              <p className="flex items-center justify-center gap-2 text-sm font-semibold text-white"><CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-[#36f4a4]" /><span className="truncate">{me.event.name}</span></p>
              {eventLine && <p className="mt-0.5 flex items-center justify-center gap-1.5 text-xs text-white/50"><MapPin aria-hidden="true" className="h-3 w-3 shrink-0" /><span className="truncate">{eventLine}</span></p>}
            </div>
          )}
        </header>

        {waiting ? (
          <div role="status" className="space-y-3 rounded-3xl border border-amber-400/40 bg-amber-500/10 p-6 text-center">
            <Loader2 aria-hidden="true" className="mx-auto h-7 w-7 animate-spin text-amber-300" />
            <p className="text-lg font-bold text-amber-100">Waiting for approval{fullName.trim() ? `, ${fullName.trim().split(" ")[0]}` : ""}</p>
            <p className="text-sm text-amber-100/70">The organizer has to approve your account. Keep this page open: it signs you in automatically as soon as you are approved.</p>
            <button type="button" onClick={() => { setWaiting(false); setMode("login"); }} className="inline-flex min-h-11 items-center px-4 text-sm text-white/60 underline underline-offset-4">Back to sign in</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/40">
            <div role="tablist" aria-label="Sign in or create an account" className="grid grid-cols-2 gap-1 rounded-2xl bg-black/40 p-1 text-sm font-semibold">
              {(["login", "register"] as const).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setFormError(""); setConfirm(""); }}
                  className={`min-h-11 rounded-xl transition-colors ${mode === m ? "bg-[#36f4a4] text-black shadow" : "text-white/70 hover:text-white"}`}>
                  {m === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            {registering && (
              <Field label="Full name" icon={UserRound}>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required maxLength={60} placeholder="e.g. Asha Rao" className={INPUT} />
              </Field>
            )}

            <Field label="Login ID" icon={AtSign} hint={registering ? "Letters, numbers, dots, dashes or underscores (3 to 32 characters)." : undefined}>
              <input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required placeholder="e.g. gate.1" className={INPUT} />
            </Field>

            <Field label="Password" icon={Lock}>
              <PasswordInput value={password} onChange={setPassword} autoComplete={registering ? "new-password" : "current-password"} placeholder={registering ? "At least 8 characters" : "Your password"} />
            </Field>
            {registering && password.length > 0 && (
              <div aria-live="polite" className="-mt-2 flex items-center gap-3">
                <div className="flex flex-1 gap-1" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-full ${i < strength.score ? strength.bar : "bg-white/10"}`} />
                  ))}
                </div>
                <span className={`text-xs font-semibold ${strength.text}`}>{strength.label}</span>
              </div>
            )}

            {registering && (
              <Field label="Confirm password" icon={Lock} error={mismatch ? "Passwords do not match." : undefined}>
                <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" placeholder="Type it again" invalid={mismatch} />
              </Field>
            )}

            {note && (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> {note}
              </p>
            )}

            <button type="submit" disabled={submitting} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#36f4a4] py-3.5 text-base font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-60">
              {submitting && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
              {registering ? "Create account" : "Sign in"}
            </button>
            {registering && <p className="text-center text-xs text-white/50">The organizer must approve your account before you can scan.</p>}
          </form>
        )}
      </>
    );
  }

  const Tone = banner ? TONE[banner.tone] : null;
  return shell(
    <div className="flex flex-col gap-5 short-landscape:grid short-landscape:grid-cols-2 short-landscape:items-start short-landscape:gap-x-5 short-landscape:gap-y-3">
      <header className="flex items-start justify-between gap-3 short-landscape:col-span-2">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black">{me.event?.name ?? "Ticket scanner"}</h1>
          <p className="truncate text-xs text-white/50">Signed in as {me.name || me.loginId}</p>
        </div>
        <button type="button" onClick={signOut} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-white/15 px-3 text-sm text-white/80">
          <LogOut aria-hidden="true" className="h-4 w-4" /> Sign out
        </button>
      </header>

      {counts && (
        <div role="group" className="grid grid-cols-3 gap-2 text-center short-landscape:col-start-2 short-landscape:row-start-2" aria-label="Door counts">
          {[["Scanned", counts.scanned], ["Left", counts.remaining], ["Total", counts.total]].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl bg-white/5 py-2">
              <p className="text-2xl font-black tabular-nums">{value}</p>
              <p className="text-[11px] uppercase tracking-wide text-white/50">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div aria-live="assertive" className="min-h-[8.5rem] short-landscape:col-start-2 short-landscape:row-start-3 short-landscape:min-h-24">
        {checking ? (
          <div className="flex h-full min-h-[8.5rem] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-white/70 short-landscape:min-h-24">
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> Checking…
          </div>
        ) : banner && Tone ? (
          <div className={`flex min-h-[8.5rem] items-center gap-4 rounded-2xl border-2 p-5 short-landscape:min-h-24 short-landscape:p-3 ${Tone.box}`}>
            <Tone.Icon aria-hidden="true" className="h-12 w-12 shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl font-black">{banner.title}</p>
              {banner.detail && <p className="break-words text-base">{banner.detail}</p>}
              {banner.code && <p className="mt-1 font-mono text-xs opacity-70">{banner.code}</p>}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[8.5rem] items-center justify-center rounded-2xl border border-dashed border-white/15 p-5 text-center text-white/50 short-landscape:min-h-24 short-landscape:p-3">
            Ready. Hold a ticket QR in the box, or type the code below.
          </div>
        )}
      </div>

      <section className="space-y-3 short-landscape:col-start-1 short-landscape:row-span-4 short-landscape:row-start-2">
        {cameraOn ? (
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
            <video ref={videoRef} playsInline muted aria-label="Camera view for scanning tickets" className="aspect-[4/3] w-full object-cover short-landscape:aspect-auto short-landscape:h-[calc(100dvh-10rem)]" />
            {/* A square, because the reader decodes the centre square of the frame (80% of its height). */}
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 aspect-square h-4/5 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-[#36f4a4]/70" />
            {torchSupported && (
              <button type="button" onClick={toggleTorch} aria-pressed={torchOn} className={`absolute bottom-3 left-3 flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm ${torchOn ? "bg-[#36f4a4] text-black" : "bg-black/70"}`}>
                <Flashlight aria-hidden="true" className="h-4 w-4" /> Light
              </button>
            )}
            <button type="button" onClick={stopCamera} className="absolute bottom-3 right-3 flex min-h-11 items-center gap-1.5 rounded-lg bg-black/70 px-3 text-sm">
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
        <section aria-label="Recent scans" className="space-y-2 short-landscape:col-start-2 short-landscape:row-start-5">
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
    </div>
  );
}
