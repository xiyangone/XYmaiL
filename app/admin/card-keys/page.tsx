"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, Trash2, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRolePermission } from "@/hooks/use-role-permission";
import { PERMISSIONS } from "@/lib/permissions";

interface CardKey {
  id: string;
  code: string;
  emailAddress: string;
  isUsed: boolean;
  usedBy?: {
    id: string;
    name: string;
    username: string;
  };
  usedAt?: string;
  createdAt: string;
  expiresAt: string;
}

export default function CardKeysPage() {
  const [cardKeys, setCardKeys] = useState<CardKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [emailAddresses, setEmailAddresses] = useState("");
  const [expiryDays, setExpiryDays] = useState("30");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const { checkPermission } = useRolePermission();

  const canManageCardKeys = checkPermission(PERMISSIONS.MANAGE_CARD_KEYS);

  useEffect(() => {
    if (canManageCardKeys) {
      fetchCardKeys();
    }
  }, [canManageCardKeys]);

  const fetchCardKeys = async () => {
    try {
      const response = await fetch("/api/admin/card-keys");
      if (!response.ok) {
        throw new Error("获取卡密列表失败");
      }
      const data = (await response.json()) as { cardKeys: CardKey[] };
      setCardKeys(data.cardKeys);
    } catch (error) {
      toast({
        title: "错误",
        description:
          error instanceof Error ? error.message : "获取卡密列表失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateCardKeys = async () => {
    const addresses = emailAddresses
      .split("\n")
      .map((addr) => addr.trim())
      .filter((addr) => addr.length > 0);

    if (addresses.length === 0) {
      toast({
        title: "错误",
        description: "请输入至少一个邮箱地址",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch("/api/admin/card-keys/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailAddresses: addresses,
          expiryDays: parseInt(expiryDays),
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error: string };
        throw new Error(data.error);
      }

      const data = (await response.json()) as {
        message: string;
        cardKeys: { code: string; emailAddress: string }[];
      };
      toast({
        title: "成功",
        description: data.message,
      });

      // 下载生成的卡密
      downloadCardKeys(data.cardKeys);

      setDialogOpen(false);
      setEmailAddresses("");
      fetchCardKeys();
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "生成卡密失败",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const downloadCardKeys = (keys: { code: string; emailAddress: string }[]) => {
    const content = keys
      .map((key) => `${key.code} - ${key.emailAddress}`)
      .join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `card-keys-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "已复制",
      description: "卡密已复制到剪贴板",
    });
  };

  const deleteCardKey = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/card-keys?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json()) as { error: string };
        throw new Error(data.error);
      }

      toast({
        title: "成功",
        description: "卡密删除成功",
      });
      fetchCardKeys();
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "删除卡密失败",
        variant: "destructive",
      });
    }
  };

  if (!canManageCardKeys) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              您没有权限访问此页面
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">卡密管理</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              生成卡密
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>生成卡密</DialogTitle>
              <DialogDescription>
                为指定的邮箱地址生成卡密，每行一个邮箱地址
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="emails">邮箱地址</Label>
                <Textarea
                  id="emails"
                  placeholder="user1@example.com&#10;user2@example.com"
                  value={emailAddresses}
                  onChange={(e) => setEmailAddresses(e.target.value)}
                  rows={5}
                />
              </div>
              <div>
                <Label htmlFor="expiry">有效期（天）</Label>
                <Input
                  id="expiry"
                  type="number"
                  min="1"
                  max="365"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                />
              </div>
              <Button
                onClick={generateCardKeys}
                disabled={generating}
                className="w-full"
              >
                {generating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                生成卡密
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4">
          {cardKeys.map((cardKey) => (
            <Card key={cardKey.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-1 rounded text-sm">
                        {cardKey.code}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(cardKey.code)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      邮箱: {cardKey.emailAddress}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      创建时间: {new Date(cardKey.createdAt).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      过期时间: {new Date(cardKey.expiresAt).toLocaleString()}
                    </p>
                    {cardKey.isUsed && cardKey.usedBy && (
                      <p className="text-sm text-muted-foreground">
                        使用者: {cardKey.usedBy.name || cardKey.usedBy.username}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={cardKey.isUsed ? "secondary" : "default"}>
                      {cardKey.isUsed ? "已使用" : "未使用"}
                    </Badge>
                    {!cardKey.isUsed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCardKey(cardKey.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
