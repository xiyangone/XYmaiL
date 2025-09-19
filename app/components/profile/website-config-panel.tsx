"use client";

import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect } from "react";
import { Role, ROLES } from "@/lib/permissions";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EMAIL_CONFIG } from "@/config";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "next/navigation";

export function WebsiteConfigPanel() {
  const [defaultRole, setDefaultRole] = useState<string>("");
  const [emailDomains, setEmailDomains] = useState<string>("");
  const [adminContact, setAdminContact] = useState<string>("");
  const [maxEmails, setMaxEmails] = useState<string>(
    EMAIL_CONFIG.MAX_ACTIVE_EMAILS.toString()
  );
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  // 新增：清理开关与卡密默认天数
  const [cleanupUsedExpired, setCleanupUsedExpired] = useState<boolean>(true);
  const [cleanupEmails, setCleanupEmails] = useState<boolean>(true);
  const [cardKeyDefaultDays, setCardKeyDefaultDays] = useState<string>("7");
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const res = await fetch("/api/config");
    if (res.ok) {
      const data = (await res.json()) as {
        defaultRole: Exclude<Role, typeof ROLES.EMPEROR>;
        emailDomains: string;
        adminContact: string;
        maxEmails: string;
        cleanupDeleteUsedExpiredCardKeys?: string;
        cleanupDeleteExpiredEmails?: string;
        cardKeyDefaultDays?: string;
      };
      setDefaultRole(data.defaultRole);
      setEmailDomains(data.emailDomains);
      setAdminContact(data.adminContact);
      setMaxEmails(data.maxEmails || EMAIL_CONFIG.MAX_ACTIVE_EMAILS.toString());
      setCleanupUsedExpired(
        (data.cleanupDeleteUsedExpiredCardKeys ?? "true").toLowerCase() ===
          "true"
      );
      setCleanupEmails(
        (data.cleanupDeleteExpiredEmails ?? "true").toLowerCase() === "true"
      );
      setCardKeyDefaultDays(data.cardKeyDefaultDays ?? "7");
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultRole,
          emailDomains,
          adminContact,
          maxEmails: maxEmails || EMAIL_CONFIG.MAX_ACTIVE_EMAILS.toString(),
          cleanupDeleteUsedExpiredCardKeys: cleanupUsedExpired,
          cleanupDeleteExpiredEmails: cleanupEmails,
          cardKeyDefaultDays,
        }),
      });

      if (!res.ok) throw new Error("保存失败");

      toast({
        title: "保存成功",
        description: "网站设置已更新",
      });
    } catch (error) {
      toast({
        title: "保存失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background rounded-lg border-2 border-primary/20 p-6">
      <div className="flex items-center justify-between mb-6">
        <div
          className="flex items-center gap-2 cursor-pointer select-none"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "收起" : "展开"}
        >
          <Settings className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">网站设置</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/admin/settings/cleanup")}
          >
            清理与到期策略
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "收起" : "展开"}
          </Button>
        </div>
      </div>

      {expanded && (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <span className="text-sm">新用户默认角色:</span>
          <Select value={defaultRole} onValueChange={setDefaultRole}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROLES.DUKE}>公爵</SelectItem>
              <SelectItem value={ROLES.KNIGHT}>骑士</SelectItem>
              <SelectItem value={ROLES.CIVILIAN}>平民</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm">邮箱域名:</span>
          <div className="flex-1">
            <Input
              value={emailDomains}
              onChange={(e) => setEmailDomains(e.target.value)}
              placeholder="多个域名用逗号分隔，如: moemail.app,bitibiti.com"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm">管理员联系方式:</span>
          <div className="flex-1">
            <Input
              value={adminContact}
              onChange={(e) => setAdminContact(e.target.value)}
              placeholder="如: 微信号、邮箱等"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm">最大邮箱数量:</span>
          <div className="flex-1">
            <Input
              type="number"
              min="1"
              max="100"
              value={maxEmails}
              onChange={(e) => setMaxEmails(e.target.value)}
              placeholder={`默认为 ${EMAIL_CONFIG.MAX_ACTIVE_EMAILS}`}
            />
          </div>
        </div>

        {/* 新增：清理策略与默认天数 */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>清理已使用且过期的卡密</Label>
            <div className="text-sm text-muted-foreground">
              开启后，过期卡密（包含已使用）将被自动清理
            </div>
          </div>
          <Switch
            checked={cleanupUsedExpired}
            onCheckedChange={setCleanupUsedExpired}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>清理过期邮箱</Label>
            <div className="text-sm text-muted-foreground">
              开启后，邮箱过期后将被自动删除（会级联删除消息）
            </div>
          </div>
          <Switch checked={cleanupEmails} onCheckedChange={setCleanupEmails} />
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm">卡密默认有效期（天）:</span>
          <div className="flex-1">
            <Input
              type="number"
              min="1"
              max="365"
              value={cardKeyDefaultDays}
              onChange={(e) => setCardKeyDefaultDays(e.target.value)}
              placeholder="默认为 7"
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={loading} className="w-full">
          保存
        </Button>
      </div>
      )
    </div>
  );
}
