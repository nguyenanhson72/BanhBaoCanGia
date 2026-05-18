import React, { useEffect, useState } from "react";
import { Brain, Sparkles, TrendingUp, AlertTriangle, Users as UsersIcon, Phone } from "lucide-react";
import api from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useI18n } from "../contexts/I18nContext";
import { formatVND, cn } from "../lib/utils";

const SEGMENTS = [
  { key: "vip", label: "Khách VIP", color: "amber", desc: "≥ 5 đơn · ≥ 1tr · ≤14 ngày" },
  { key: "high_potential", label: "Tiềm năng", color: "blue", desc: "≥ 2 đơn · giá trị tốt" },
  { key: "at_risk", label: "Nguy cơ rời", color: "lowstock", desc: "30+ ngày · từng quay lại" },
  { key: "churned", label: "Đã rời", color: "cancelled", desc: "60+ ngày không đặt" },
  { key: "new", label: "Mới", color: "delivered", desc: "Chưa hoặc ít đơn" },
];

export default function Insights() {
  const { t } = useI18n();
  const [scoring, setScoring] = useState(null);
  const [combos, setCombos] = useState(null);
  const [aiSuggest, setAiSuggest] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeSegment, setActiveSegment] = useState("vip");

  useEffect(() => {
    api.get("/insights/customer-scoring").then((r) => setScoring(r.data));
    api.get("/insights/combos").then((r) => setCombos(r.data));
  }, []);

  const runAi = async () => {
    setAiLoading(true);
    try {
      const { data } = await api.get("/insights/ai-suggest");
      setAiSuggest(data);
    } catch (e) {
      setAiSuggest({ raw: "AI tạm chưa phản hồi", parsed: null });
    } finally {
      setAiLoading(false);
    }
  };

  const renderSegmentList = (items) => {
    if (!items || items.length === 0) return <div className="text-center py-8 text-sm text-ink-muted">Chưa có khách trong nhóm này</div>;
    return (
      <table className="w-full text-sm">
        <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
          <tr>
            <th className="text-left py-3 px-4">Khách hàng</th>
            <th className="text-left py-3 px-4">SĐT</th>
            <th className="text-right py-3 px-4">Đơn</th>
            <th className="text-right py-3 px-4">Tổng chi</th>
            <th className="text-right py-3 px-4">TB/đơn</th>
            <th className="text-right py-3 px-4">Ngày qua</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.customer_id} className="border-t border-border hover:bg-cream/30" data-testid={`insight-customer-${c.customer_id}`}>
              <td className="py-3 px-4">
                <div className="font-medium">{c.name}</div>
                {c.nickname && <div className="text-xs text-ink-muted">({c.nickname})</div>}
              </td>
              <td className="py-3 px-4 text-xs">
                {c.phone ? <a href={`tel:${c.phone}`} className="text-bamboo hover:underline flex items-center gap-1"><Phone size={11}/> {c.phone}</a> : "—"}
              </td>
              <td className="py-3 px-4 text-right">{c.order_count}</td>
              <td className="py-3 px-4 text-right font-mono text-xs">{formatVND(c.total_spent)}</td>
              <td className="py-3 px-4 text-right font-mono text-xs">{formatVND(c.avg_order_value)}</td>
              <td className="py-3 px-4 text-right text-xs">{c.days_since_last_order >= 9999 ? "Chưa đặt" : `${c.days_since_last_order}d`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="insights-page">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
          <Brain size={28} className="text-terracotta" /> AI Insights
        </h1>
        <p className="text-sm text-ink-secondary mt-1">
          Phân loại khách hàng · Combo gợi ý · Hành động đề xuất từ AI
        </p>
      </div>

      {/* AI suggestion */}
      <Card className="border-terracotta/30 bg-gradient-to-br from-cream/40 to-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Sparkles size={16} className="text-terracotta" /> AI Gợi ý hành động tuần này</CardTitle>
            <Button onClick={runAi} disabled={aiLoading} data-testid="ai-suggest-run">
              {aiLoading ? "AI đang phân tích..." : "Phân tích ngay"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!aiSuggest ? (
            <div className="text-sm text-ink-muted">Bấm "Phân tích ngay" để AI gợi ý 3-5 hành động ưu tiên dựa trên data tiệm bạn.</div>
          ) : aiSuggest.parsed ? (
            <div className="space-y-3">
              <p className="text-sm text-ink">{aiSuggest.parsed.summary}</p>
              <div className="space-y-2">
                {(aiSuggest.parsed.actions || []).map((a, i) => (
                  <div key={i} className="flex gap-3 p-3 border border-border rounded-md bg-white" data-testid={`ai-action-${i}`}>
                    <Badge variant={a.priority === "high" ? "cancelled" : a.priority === "medium" ? "lowstock" : "regular"}>
                      {a.priority === "high" ? "Ưu tiên cao" : a.priority === "medium" ? "Trung" : "Thấp"}
                    </Badge>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{a.title}</div>
                      <div className="text-xs text-ink-muted mt-0.5">{a.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <pre className="text-xs whitespace-pre-wrap text-ink">{aiSuggest.raw}</pre>
          )}
        </CardContent>
      </Card>

      {/* Customer Scoring */}
      {scoring && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UsersIcon size={16} className="text-bamboo" /> Phân loại khách hàng</CardTitle>
          </CardHeader>
          <CardContent className="!p-0">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-4 border-b border-border">
              {SEGMENTS.map((s) => {
                const active = activeSegment === s.key;
                const count = scoring.counts[s.key] || 0;
                return (
                  <button
                    key={s.key}
                    onClick={() => setActiveSegment(s.key)}
                    className={cn(
                      "p-3 border rounded-md text-left transition-all",
                      active ? "border-bamboo bg-bamboo/5" : "border-border hover:border-bamboo/50"
                    )}
                    data-testid={`segment-${s.key}`}
                  >
                    <div className="text-xs uppercase tracking-wider text-ink-muted">{s.label}</div>
                    <div className="font-heading text-2xl font-bold mt-1">{count}</div>
                    <div className="text-[10px] text-ink-muted mt-1">{s.desc}</div>
                  </button>
                );
              })}
            </div>
            <div className="overflow-x-auto">
              {renderSegmentList(scoring[activeSegment])}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Combos */}
      {combos && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp size={16} className="text-bamboo" /> Combo bán chạy (Frequently bought together)</CardTitle>
          </CardHeader>
          <CardContent className="!p-0">
            {combos.items.length === 0 ? (
              <div className="text-center py-8 text-sm text-ink-muted">Chưa đủ data (cần ≥2 đơn có 2 sản phẩm trở lên)</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
                  <tr>
                    <th className="text-left py-3 px-4">Combo</th>
                    <th className="text-right py-3 px-4">Số đơn</th>
                    <th className="text-right py-3 px-4">Tổng doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {combos.items.map((c, i) => (
                    <tr key={i} className="border-t border-border" data-testid={`combo-row-${i}`}>
                      <td className="py-3 px-4">
                        <span className="font-medium">{c.name_a}</span>
                        <span className="text-ink-muted mx-2">+</span>
                        <span className="font-medium">{c.name_b}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">{c.count}</td>
                      <td className="py-3 px-4 text-right font-mono">{formatVND(c.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
