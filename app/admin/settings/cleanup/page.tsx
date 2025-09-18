"use client";

import { useEffect, useState } from "react";

export default function CleanupSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // 全量配置（为满足 /api/config POST 的参数要求）
  const [defaultRole, setDefaultRole] = useState("CIVILIAN");
  const [emailDomains, setEmailDomains] = useState("");
  const [adminContact, setAdminContact] = useState("");
  const [maxEmails, setMaxEmails] = useState("10");
  const [cardKeyDefaultDays, setCardKeyDefaultDays] = useState("7");

  // 清理相关开关
  const [cleanupUsedExpired, setCleanupUsedExpired] = useState(true);
  const [cleanupExpiredEmails, setCleanupExpiredEmails] = useState(true);
  const [cleanupExpiredUnused, setCleanupExpiredUnused] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const res = await fetch("/api/config", { cache: "no-store" });
        if (!res.ok) throw new Error(`获取配置失败（${res.status}）`);
        const data = await res.json();
        setDefaultRole(data.defaultRole || "CIVILIAN");
        setEmailDomains(data.emailDomains || "");
        setAdminContact(data.adminContact || "");
        setMaxEmails(data.maxEmails || "10");
        setCardKeyDefaultDays(data.cardKeyDefaultDays || "7");
        setCleanupUsedExpired(
          (data.cleanupDeleteUsedExpiredCardKeys ?? "true").toLowerCase() ===
            "true"
        );
        setCleanupExpiredEmails(
          (data.cleanupDeleteExpiredEmails ?? "true").toLowerCase() === "true"
        );
        setCleanupExpiredUnused(
          (data.cleanupDeleteExpiredUnusedCardKeys ?? "true").toLowerCase() ===
            "true"
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "获取配置失败");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultRole,
          emailDomains,
          adminContact,
          maxEmails,
          cleanupDeleteUsedExpiredCardKeys: cleanupUsedExpired,
          cleanupDeleteExpiredEmails: cleanupExpiredEmails,
          cleanupDeleteExpiredUnusedCardKeys: cleanupExpiredUnused,
          cardKeyDefaultDays,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "保存失败");
      }
      setMessage("已保存");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-4">清理与到期策略</h1>
      <p className="text-sm text-muted-foreground mb-6">
        仅皇帝可编辑。开关生效于服务端 Edge 运行时，定时清理由 Worker 或 Pages Scheduled Triggers 调用
        /api/cleanup/temp-accounts。
      </p>

      {loading ? (
        <div>加载中…</div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-2">
            <h2 className="text-lg font-medium">卡密与邮箱清理开关</h2>
            <div className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">删除“已使用且过期”的卡密</div>
                <div className="text-xs text-muted-foreground">
                  过期且已被使用的卡密，将连带清理对应的临时账号/用户及其数据。
                </div>
              </div>
              <input
                type="checkbox"
                checked={cleanupUsedExpired}
                onChange={(e) => setCleanupUsedExpired(e.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">删除“过期未使用”的卡密</div>
                <div className="text-xs text-muted-foreground">
                  仅删除已过期且未被使用的卡密；不涉及任何用户级联。
                </div>
              </div>
              <input
                type="checkbox"
                checked={cleanupExpiredUnused}
                onChange={(e) => setCleanupExpiredUnused(e.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">删除“已过期邮箱（含消息）”</div>
                <div className="text-xs text-muted-foreground">
                  删除 emails 表中过期记录；会级联删除该邮箱下的消息。
                </div>
              </div>
              <input
                type="checkbox"
                checked={cleanupExpiredEmails}
                onChange={(e) => setCleanupExpiredEmails(e.target.checked)}
              />
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium">只读信息（保存时会原样带回）</h2>
            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm">
                默认角色（只读）：
                <input
                  value={defaultRole}
                  onChange={(e) => setDefaultRole(e.target.value)}
                  className="ml-2 border rounded px-2 py-1"
                  readOnly
                />
              </label>
              <label className="text-sm">
                邮箱域名（只读）：
                <input
                  value={emailDomains}
                  onChange={(e) => setEmailDomains(e.target.value)}
                  className="ml-2 border rounded px-2 py-1 w-full"
                  readOnly
                />
              </label>
              <label className="text-sm">
                管理员联系方式（只读）：
                <input
                  value={adminContact}
                  onChange={(e) => setAdminContact(e.target.value)}
                  className="ml-2 border rounded px-2 py-1 w-full"
                  readOnly
                />
              </label>
              <label className="text-sm">
                每用户邮箱上限（只读）：
                <input
                  value={maxEmails}
                  onChange={(e) => setMaxEmails(e.target.value)}
                  className="ml-2 border rounded px-2 py-1"
                  readOnly
                />
              </label>
              <label className="text-sm">
                卡密默认有效期-天（只读）：
                <input
                  value={cardKeyDefaultDays}
                  onChange={(e) => setCardKeyDefaultDays(e.target.value)}
                  className="ml-2 border rounded px-2 py-1"
                  readOnly
                />
              </label>
            </div>
          </section>

          {error && <div className="text-red-600 text-sm">{error}</div>}
          {message && <div className="text-green-600 text-sm">{message}</div>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存开关"}
          </button>
        </div>
      )}
    </div>
  );
}

