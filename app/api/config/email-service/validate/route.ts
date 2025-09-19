export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { apiKey } = (await req.json()) as { apiKey?: string };
    if (!apiKey) {
      return new Response(JSON.stringify({ ok: false, error: "缺少 apiKey" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 通过访问 Resend API 做一次轻量校验（不发送邮件）
    // 说明：GET /emails 需要有效的 API Key，若返回 200 代表 Key 合法可用
    const res = await fetch("https://api.resend.com/emails?limit=1", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (res.ok) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    let detail = "";
    try {
      const data: any = await res.json();
      detail = data?.message || data?.error || JSON.stringify(data) || "";
    } catch {}

    return new Response(
      JSON.stringify({
        ok: false,
        error: detail || `Resend 校验失败 (${res.status})`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
