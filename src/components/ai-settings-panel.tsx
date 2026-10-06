"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Gauge, LoaderCircle, PlugZap, RefreshCw, Save, ShieldCheck, XCircle } from "lucide-react";
import { AI_PROVIDER_PRESETS, getProviderPreset, type AIProviderPreset } from "@/lib/ai/config";
import { clientAIConfigHeader, loadClientAIConfig, loadShareCode, saveClientAIConfig, saveShareCode } from "@/lib/ai/client-config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";

interface AISelection {
  provider: string;
  model: string;
  narrativeModel: string;
  adjudicatorModel: string;
  imageModel: string;
  customBaseUrl: string;
  customModel: string;
  useThinking: boolean;
  updatedAt: string | null;
}

interface AIConfigResponse {
  providers: AIProviderPreset[];
  selection: AISelection;
  status: {
    configured: boolean;
    provider: string;
    providerLabel: string;
    protocol: string;
    baseUrl: string;
    model: string;
    narrativeModel: string;
    adjudicatorModel: string;
    imageModel: string;
    useThinking: boolean;
    source: "runtime" | "env" | "none";
  };
  hasApiKey: boolean;
  keyMasked: string;
}

interface TestResult {
  ok: boolean;
  error?: string;
  elapsedMs?: number;
  provider?: string;
  model?: string;
  sample?: string;
}

export function AISettingsPanel() {
  const [config, setConfig] = useState<AIConfigResponse | null>(null);
  const [provider, setProvider] = useState("deepseek");
  const [model, setModel] = useState("");
  const [narrativeModel, setNarrativeModel] = useState("");
  const [adjudicatorModel, setAdjudicatorModel] = useState("");
  const [imageModel, setImageModel] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [useThinking, setUseThinking] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [shareCode, setShareCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [test, setTest] = useState<TestResult | null>(null);

  const apply = useCallback((payload: AIConfigResponse) => {
    setConfig(payload);
    setProvider(payload.selection.provider);
    setModel(payload.selection.model);
    setNarrativeModel(payload.selection.narrativeModel);
    setAdjudicatorModel(payload.selection.adjudicatorModel);
    setImageModel(payload.selection.imageModel);
    setCustomBaseUrl(payload.selection.customBaseUrl);
    setCustomModel(payload.selection.customModel);
    setUseThinking(payload.selection.useThinking);
  }, []);

  // 配置保存在访客自己的浏览器里：共享部署时不会用到站长的密钥。
  const load = useCallback(async () => {
    const saved = loadClientAIConfig();
    setShareCode(loadShareCode());
    const preset = getProviderPreset(saved.provider);
    apply({
      providers: AI_PROVIDER_PRESETS,
      selection: { ...saved, updatedAt: null },
      status: {
        configured: Boolean(saved.apiKey) || saved.provider === "compatible",
        provider: saved.provider,
        providerLabel: preset?.label ?? saved.provider,
        protocol: preset?.protocol ?? "chat-completions",
        baseUrl: saved.provider === "compatible" && saved.customBaseUrl ? saved.customBaseUrl : (preset?.baseUrl ?? ""),
        model: saved.model,
        narrativeModel: saved.narrativeModel,
        adjudicatorModel: saved.adjudicatorModel,
        imageModel: saved.imageModel,
        useThinking: saved.useThinking,
        source: "runtime",
      },
      hasApiKey: Boolean(saved.apiKey),
      keyMasked: saved.apiKey ? saved.apiKey.slice(0, 5) + "…" + saved.apiKey.slice(-4) : "",
    });
  }, [apply]);

  useEffect(() => { void load(); /* eslint-disable-line react-hooks/set-state-in-effect */ }, [load]);

  const preset = useMemo(() => config?.providers.find((item) => item.id === provider), [config, provider]);

  function pickProvider(nextId: string) {
    setProvider(nextId);
    const next = config?.providers.find((item) => item.id === nextId);
    const firstModel = next?.models[0]?.id ?? "";
    setModel(firstModel);
    setNarrativeModel(firstModel);
    setAdjudicatorModel(firstModel);
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const current = loadClientAIConfig();
      const next = {
        ...current,
        provider: provider as typeof current.provider,
        apiKey: apiKey.trim() ? apiKey.trim() : current.apiKey,
        model,
        narrativeModel,
        adjudicatorModel,
        imageModel,
        customBaseUrl,
        customModel,
        useThinking,
      };
      saveClientAIConfig(next);
      saveShareCode(shareCode);
      await load();
      setApiKey("");
      setMessage("AI 配置已保存到你的浏览器。密钥不会上传到服务器保存，只有你发起的请求才会带上它。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTest(null);
    try {
      const response = await fetch("/api/settings/ai/test", { method: "POST", headers: { ...clientAIConfigHeader() } });
      setTest(await response.json() as TestResult);
    } catch (error) {
      setTest({ ok: false, error: error instanceof Error ? error.message : "测试失败" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="serif text-xl">AI 接口与模型强度</h2>
            <p className="mt-1 text-xs text-muted">选择供应商与模型档位。API Key 只保存在服务端本地文件，永不写入浏览器或备份。</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{config?.status.configured ? "已配置" : "未配置"}</Badge>
            {config?.status.source === "env" && <Badge>来自 .env.local</Badge>}
            {config?.status.source === "runtime" && <Badge>来自本页面</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>供应商</Label>
            <Select value={provider} onChange={(event) => pickProvider(event.target.value)}>
              {config?.providers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
            {preset && <p className="mt-2 text-[11px] leading-5 text-muted">{preset.summary}</p>}
          </div>
          <div>
            <Label>API Key</Label>
            <Input
              type="password"
              autoComplete="off"
              placeholder={config?.hasApiKey ? `已保存：${config.keyMasked}（留空则不修改）` : (preset?.keyHint ?? "sk-...")}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <p className="mt-2 flex items-center gap-1 text-[11px] text-muted"><ShieldCheck className="size-3 text-moss" />仅在服务端保存，前端与备份里都查不到。</p>
          </div>
        </div>

        {provider === "compatible" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>自定义网关地址</Label>
              <Input value={customBaseUrl} onChange={(event) => setCustomBaseUrl(event.target.value)} placeholder="http://127.0.0.1:3001/v1" />
            </div>
            <div>
              <Label>自定义模型名</Label>
              <Input value={customModel} onChange={(event) => setCustomModel(event.target.value)} placeholder="local-model" />
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>默认模型</Label>
            <Select value={model} onChange={(event) => { setModel(event.target.value); setNarrativeModel(event.target.value); setAdjudicatorModel(event.target.value); }}>
              {preset?.models.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
          </div>
          <div>
            <Label>叙事模型</Label>
            <Select value={narrativeModel} onChange={(event) => setNarrativeModel(event.target.value)}>
              {preset?.models.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
          </div>
          <div>
            <Label>裁定模型</Label>
            <Select value={adjudicatorModel} onChange={(event) => setAdjudicatorModel(event.target.value)}>
              {preset?.models.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
          </div>
        </div>

        <div className="rounded-md border border-border bg-panel-soft p-3">
          <p className="mb-2 flex items-center gap-2 text-xs text-muted-strong"><Gauge className="size-4 text-brass" />模型强度参考</p>
          <div className="grid gap-2 text-[11px] text-muted sm:grid-cols-3">
            <div><strong className="text-foreground">快速</strong>：低延迟、低成本，适合日常回合。</div>
            <div><strong className="text-foreground">均衡</strong>：质量与成本平衡，默认选择。</div>
            <div><strong className="text-foreground">深度</strong>：最强推理，关键剧情与难裁定。</div>
          </div>
        </div>

        {provider === "qwen" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useThinking} onChange={(event) => setUseThinking(event.target.checked)} />
            开启 Qwen 思考模式（enable_thinking，更慢但推理更强）
          </label>
        )}

        <div>
          <Label>图像模型（可选）</Label>
          <Input value={imageModel} onChange={(event) => setImageModel(event.target.value)} placeholder="留空则使用程序化场景" />
        </div>

        <div><Label>分享访问口令（可选）</Label><Input value={shareCode} onChange={(event) => setShareCode(event.target.value)} placeholder="站长设置了 SHARE_ACCESS_CODE 时才需要填写" /><p className="mt-1 text-[11px] text-muted">口令只保存在当前浏览器，仅随 AI 请求发送；不会写入备份。</p></div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={saving}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}保存 AI 配置</Button>
          <Button variant="secondary" onClick={runTest} disabled={testing}>{testing ? <LoaderCircle className="size-4 animate-spin" /> : <PlugZap className="size-4" />}测试连接</Button>
          <Button variant="ghost" onClick={() => void load()}><RefreshCw className="size-4" />重新读取</Button>
          {message && <span className="text-xs text-muted">{message}</span>}
        </div>

        {test && (
          <div className={`rounded-md border p-3 text-xs ${test.ok ? "border-moss/50 bg-moss/10" : "border-danger/50 bg-danger/10"}`}>
            {test.ok
              ? <p className="flex items-center gap-2 text-moss"><CheckCircle2 className="size-4" />连接成功 · {test.provider} · {test.model} · {test.elapsedMs}ms</p>
              : <p className="flex items-center gap-2 text-danger"><XCircle className="size-4" />连接失败：{test.error}</p>}
            {test.ok && test.sample && <p className="mt-1 text-muted">返回样本：{test.sample}</p>}
          </div>
        )}

        {config && (
          <div className="grid gap-2 rounded-md border border-border bg-panel-soft p-3 text-[11px] text-muted sm:grid-cols-2 lg:grid-cols-3">
            <span>协议：{config.status.protocol}</span>
            <span>生效模型：{config.status.model}</span>
            <span>叙事：{config.status.narrativeModel}</span>
            <span>裁定：{config.status.adjudicatorModel}</span>
            <span className="truncate sm:col-span-2">地址：{config.status.baseUrl}</span>
            <span>来源：{config.status.source === "runtime" ? "本页面" : config.status.source === "env" ? ".env.local" : "未配置"}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}




