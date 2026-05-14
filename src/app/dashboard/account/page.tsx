"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User, Mail, Shield, CreditCard, Key, LogOut,
  CheckCircle2, AlertCircle, Loader2, Save, Eye, EyeOff
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface AccountData {
  id: string;
  email: string;
  name: string | null;
  plan: "free" | "starter" | "pro";
  crawlCount: number;
}

const PLAN_CONFIG = {
  free:    { label: "Free",    color: "bg-muted text-muted-foreground border-border",         limit: "100 messages/mo"  },
  starter: { label: "Starter", color: "bg-blue-500/10 text-blue-400 border-blue-400/20",      limit: "5,000 messages/mo" },
  pro:     { label: "Pro",     color: "bg-[#36f4a4]/10 text-[#36f4a4] border-[#36f4a4]/20",  limit: "50,000 messages/mo" },
};

export default function AccountPage() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);

  // Name edit state
  const [name, setName] = useState("");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password state
  const [showPw, setShowPw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setAccount(d);
        setName(d.name || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const saveName = async () => {
    if (!name.trim()) return;
    setNameLoading(true);
    setNameMsg(null);
    try {
      const res = await fetch("/api/account/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        setNameMsg({ type: "success", text: "Name updated successfully" });
        setAccount((prev) => prev ? { ...prev, name: name.trim() } : prev);
      } else {
        setNameMsg({ type: "error", text: "Failed to update name" });
      }
    } catch {
      setNameMsg({ type: "error", text: "Network error" });
    } finally {
      setNameLoading(false);
    }
  };

  const changePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      setPwMsg({ type: "error", text: "All fields are required" });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: "error", text: "New passwords do not match" });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }
    setPwLoading(true);
    setPwMsg(null);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwMsg({ type: "success", text: "Password changed successfully" });
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
      } else {
        setPwMsg({ type: "error", text: data.error || "Failed to change password" });
      }
    } catch {
      setPwMsg({ type: "error", text: "Network error" });
    } finally {
      setPwLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const plan = PLAN_CONFIG[account?.plan || "free"];

  return (
    <div className="space-y-8 pb-20 max-w-2xl mx-auto">

      {/* Header */}
      <div>
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-black">
          Account
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-sm mt-1">
          Manage your profile, password, and subscription
        </motion.p>
      </div>

      {/* Profile Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-border bg-card/50">
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#36f4a4]/10 border border-[#36f4a4]/20 flex items-center justify-center">
                <User className="h-5 w-5 text-[#36f4a4]" />
              </div>
              <h2 className="font-bold">Profile</h2>
            </div>

            {/* Avatar + info */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-accent/20 border border-border">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#36f4a4]/20 to-primary/20 border border-border flex items-center justify-center text-2xl font-black text-foreground">
                {(account?.name || account?.email || "U")[0].toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-foreground">{account?.name || "No name set"}</p>
                <p className="text-sm text-muted-foreground">{account?.email}</p>
                <Badge className={cn("mt-1 text-[10px] font-bold border", plan.color)}>
                  {plan.label} Plan · {plan.limit}
                </Badge>
              </div>
            </div>

            {/* Edit name */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Display Name</label>
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                  placeholder="Enter your name"
                  className="flex-1 px-3 py-2.5 bg-accent/30 border border-border rounded-xl text-sm outline-none focus:border-[#36f4a4]/50 transition-colors placeholder:text-muted-foreground"
                />
                <Button onClick={saveName} disabled={nameLoading || !name.trim()} size="sm" className="rounded-xl px-4">
                  {nameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
              </div>
              {nameMsg && (
                <p className={cn("text-xs flex items-center gap-1.5", nameMsg.type === "success" ? "text-[#36f4a4]" : "text-red-400")}>
                  {nameMsg.type === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                  {nameMsg.text}
                </p>
              )}
            </div>

            {/* Email (readonly) */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Address</label>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-accent/20 border border-border rounded-xl">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{account?.email}</span>
                <Badge variant="outline" className="ml-auto text-[10px]">Verified</Badge>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-accent/20 border border-border text-center">
                <p className="text-2xl font-black text-foreground">{account?.crawlCount ?? 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Total Crawls</p>
              </div>
              <div className="p-3 rounded-xl bg-accent/20 border border-border text-center">
                <p className="text-2xl font-black text-[#36f4a4]">{plan.label}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Current Plan</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Password Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="border-border bg-card/50">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center">
                <Key className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="font-bold">Change Password</h2>
                <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
              </div>
              <button
                onClick={() => setShowPw(!showPw)}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showPw ? "Hide" : "Show"}
              </button>
            </div>

            <div className="space-y-3">
              {[
                { label: "Current Password", value: currentPw, setter: setCurrentPw, placeholder: "Enter current password" },
                { label: "New Password", value: newPw, setter: setNewPw, placeholder: "Enter new password" },
                { label: "Confirm New Password", value: confirmPw, setter: setConfirmPw, placeholder: "Confirm new password" },
              ].map(({ label, value, setter, placeholder }) => (
                <div key={label} className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">{label}</label>
                  <input
                    type={showPw ? "text" : "password"}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2.5 bg-accent/30 border border-border rounded-xl text-sm outline-none focus:border-blue-400/50 transition-colors placeholder:text-muted-foreground"
                  />
                </div>
              ))}
            </div>

            {pwMsg && (
              <p className={cn("text-xs flex items-center gap-1.5", pwMsg.type === "success" ? "text-[#36f4a4]" : "text-red-400")}>
                {pwMsg.type === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                {pwMsg.text}
              </p>
            )}

            <Button onClick={changePassword} disabled={pwLoading} className="w-full rounded-xl">
              {pwLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
              Update Password
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Plan Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="border-border bg-card/50">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-400/10 border border-purple-400/20 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h2 className="font-bold">Subscription</h2>
                <p className="text-xs text-muted-foreground">Manage your plan</p>
              </div>
              <Badge className={cn("ml-auto text-[10px] font-bold border", plan.color)}>
                {plan.label}
              </Badge>
            </div>

            <div className="p-4 rounded-xl bg-accent/20 border border-border space-y-3">
              {[
                { label: "Plan", value: plan.label },
                { label: "Message Limit", value: plan.limit },
                { label: "Crawl Count", value: `${account?.crawlCount ?? 0} crawls done` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>

            <Button variant="outline" className="w-full rounded-xl">
              <CreditCard className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Danger Zone */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-6 space-y-4">
            <h2 className="font-bold text-red-400">Danger Zone</h2>
            <Button
              onClick={logout}
              variant="outline"
              className="w-full rounded-xl border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}