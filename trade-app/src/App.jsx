import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

// ─── 定数 ────────────────────────────────────────────────
const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
const CAPITAL = 300000;
const STORAGE_KEY_RECORDS = "trade_records_v1";
const STORAGE_KEY_RULES = "trade_rules_v1";

const DEFAULT_RULES = [
  "エントリーは9:30。9:00〜9:30の30分で方向性を確認してから判断。",
  "注文方式はIFD-OCO（不成含む）。利確=指値、損切=逆指値+不成。",
  "ポジションは100株固定。銘柄は楽天グループ（4755）のみ。",
  "リスクリワード最低1:1.5。損切幅より利確幅を広くとる。",
  "1日1トレード。現在は検証フェーズのため毎日エントリー。",
  "逆張り禁止：月足・週足・日足がすべて同方向の場合、逆方向エントリー禁止。",
];

const DEFAULT_RECORDS = [
  { id: 1, date: "2026-06-03", side: "買", result: "勝", ep: 780, tp: 795, sl: 770, entry: 780, exit: 795, open: 778, high: 798, low: 775, close: 794, vol: "2.1M", pred: "上昇", memo: "3足揃いで素直に動いた" },
  { id: 2, date: "2026-06-02", side: "売", result: "負", ep: 782, tp: 767, sl: 792, entry: 782, exit: 792, open: 780, high: 795, low: 776, close: 780, vol: "1.8M", pred: "下降", memo: "上位足に逆らった" },
  { id: 3, date: "2026-05-30", side: "買", result: "勝", ep: 765, tp: 778, sl: 755, entry: 765, exit: 778, open: 763, high: 780, low: 761, close: 777, vol: "2.3M", pred: "上昇", memo: "ボリバン+1σで利確" },
  { id: 4, date: "2026-05-27", side: "買", result: "勝", ep: 760, tp: 773, sl: 750, entry: 760, exit: 773, open: 758, high: 775, low: 756, close: 772, vol: "1.9M", pred: "上昇", memo: "日足ボリバンミドルで反発" },
  { id: 5, date: "2026-05-23", side: "売", result: "勝", ep: 771, tp: 758, sl: 781, entry: 771, exit: 758, open: 770, high: 773, low: 755, close: 759, vol: "2.0M", pred: "下降", memo: "週足下降で売り成功" },
];

// ─── ユーティリティ ──────────────────────────────────────
function calcPnl(side, entry, exit) {
  return (side === "買" ? exit - entry : entry - exit) * 100;
}
function dayStr(dateStr) {
  const d = new Date(dateStr);
  return DAYS[d.getDay()];
}
function fmtYen(n) {
  return (n >= 0 ? "+" : "") + n.toLocaleString() + "円";
}

// ─── CSS ─────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0d0f14;
    --surface: #161a23;
    --surface2: #1e2433;
    --border: rgba(255,255,255,0.08);
    --border2: rgba(255,255,255,0.14);
    --text: #e8eaf0;
    --muted: #6b7280;
    --accent: #3b82f6;
    --accent2: #1d6ef5;
    --green: #22c55e;
    --green-bg: rgba(34,197,94,0.1);
    --red: #ef4444;
    --red-bg: rgba(239,68,68,0.1);
    --amber: #f59e0b;
    --amber-bg: rgba(245,158,11,0.1);
    --font: 'Noto Sans JP', sans-serif;
    --mono: 'JetBrains Mono', monospace;
  }
  html { background: var(--bg); color: var(--text); font-family: var(--font); font-size: 14px; }
  body { min-height: 100vh; }
  button { font-family: var(--font); cursor: pointer; }
  input, select, textarea { font-family: var(--font); font-size: 13px; background: var(--surface2); border: 1px solid var(--border2); color: var(--text); border-radius: 6px; padding: 7px 10px; outline: none; }
  input:focus, select:focus, textarea:focus { border-color: var(--accent); }
  select option { background: var(--surface2); }

  .app { max-width: 960px; margin: 0 auto; padding: 0 16px 40px; }
  .header { display: flex; align-items: center; gap: 12px; padding: 20px 0 16px; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
  .header-logo { font-family: var(--mono); font-size: 11px; font-weight: 600; letter-spacing: 2px; color: var(--accent); text-transform: uppercase; }
  .header-title { font-size: 16px; font-weight: 700; }
  .header-badge { margin-left: auto; background: var(--surface2); border: 1px solid var(--border2); border-radius: 20px; padding: 4px 12px; font-size: 11px; font-family: var(--mono); color: var(--muted); }

  .nav { display: flex; gap: 4px; margin-bottom: 24px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 4px; }
  .nav-btn { flex: 1; padding: 8px 12px; border: none; background: transparent; color: var(--muted); border-radius: 7px; font-size: 13px; font-weight: 500; transition: all 0.15s; }
  .nav-btn:hover { color: var(--text); background: var(--surface2); }
  .nav-btn.active { background: var(--accent); color: #fff; }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
  .grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
  @media(max-width: 640px) {
    .grid-5 { grid-template-columns: repeat(2, 1fr); }
    .grid-3 { grid-template-columns: repeat(2, 1fr); }
  }

  .metric { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
  .metric-label { font-size: 11px; color: var(--muted); margin-bottom: 6px; letter-spacing: 0.5px; }
  .metric-value { font-size: 22px; font-weight: 700; font-family: var(--mono); }
  .metric-sub { font-size: 12px; margin-top: 3px; }

  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; margin-bottom: 14px; }
  .card-title { font-size: 12px; font-weight: 600; color: var(--muted); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 14px; }

  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 7px; border: 1px solid var(--border2); background: var(--surface2); color: var(--text); font-size: 13px; font-weight: 500; transition: all 0.15s; }
  .btn:hover { border-color: var(--accent); color: var(--accent); }
  .btn-primary { background: var(--accent); color: #fff; border-color: var(--accent2); }
  .btn-primary:hover { background: var(--accent2); color: #fff; border-color: var(--accent2); }
  .btn-danger { border-color: var(--red); color: var(--red); background: transparent; }
  .btn-danger:hover { background: var(--red-bg); }
  .btn-row { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }

  .up { color: var(--green); }
  .down { color: var(--red); }
  .neutral { color: var(--amber); }

  .trend-pills { display: flex; gap: 8px; margin-bottom: 12px; }
  .trend-pill { flex: 1; text-align: center; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 600; }
  .pill-up { background: var(--green-bg); color: var(--green); border: 1px solid rgba(34,197,94,0.25); }
  .pill-down { background: var(--red-bg); color: var(--red); border: 1px solid rgba(239,68,68,0.25); }
  .pill-neutral { background: var(--amber-bg); color: var(--amber); border: 1px solid rgba(245,158,11,0.25); }

  .alert { border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 12px; }
  .alert-danger { background: var(--red-bg); color: var(--red); border: 1px solid rgba(239,68,68,0.25); }
  .alert-success { background: var(--green-bg); color: var(--green); border: 1px solid rgba(34,197,94,0.25); }
  .alert-info { background: rgba(59,130,246,0.1); color: var(--accent); border: 1px solid rgba(59,130,246,0.25); }

  .prob-row { margin-bottom: 10px; }
  .prob-head { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; }
  .prob-bar { height: 6px; background: var(--surface2); border-radius: 3px; overflow: hidden; }
  .prob-fill { height: 100%; border-radius: 3px; transition: width 0.4s; }

  .scenario { border-radius: 8px; padding: 14px; margin-top: 12px; border-left: 3px solid; }
  .scenario-ai { background: rgba(59,130,246,0.07); border-left-color: var(--accent); }
  .scenario-rule { background: var(--green-bg); border-left-color: var(--green); }
  .scenario-label { font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
  .scenario-text { font-size: 13px; line-height: 1.8; font-family: var(--mono); }

  .divider { border: none; border-top: 1px solid var(--border); margin: 16px 0; }

  .tbl-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; min-width: 960px; }
  th { font-size: 10px; font-weight: 600; color: var(--muted); padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; letter-spacing: 0.5px; text-transform: uppercase; }
  td { padding: 9px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; font-family: var(--mono); font-size: 12px; }
  tr:hover td { background: var(--surface2); }

  .win { color: var(--green); font-weight: 600; }
  .lose { color: var(--red); font-weight: 600; }

  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .modal { background: var(--surface); border: 1px solid var(--border2); border-radius: 14px; padding: 24px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
  .modal-title { font-size: 16px; font-weight: 700; margin-bottom: 18px; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .form-field { display: flex; flex-direction: column; gap: 4px; }
  .form-label { font-size: 11px; color: var(--muted); }
  .form-field input, .form-field select, .form-field textarea { width: 100%; }
  .form-full { grid-column: 1 / -1; }
  .modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }

  .rule-list { display: flex; flex-direction: column; gap: 0; }
  .rule-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
  .rule-num { font-family: var(--mono); font-size: 11px; color: var(--accent); font-weight: 600; min-width: 20px; margin-top: 3px; }
  .rule-text { flex: 1; font-size: 14px; line-height: 1.7; }
  .rule-del { padding: 4px 8px; font-size: 11px; }
  .add-row { display: flex; gap: 8px; margin-top: 14px; }
  .add-row input { flex: 1; }

  .period-select { margin-left: auto; }

  .ai-loading { display: flex; align-items: center; gap: 8px; padding: 16px; color: var(--muted); font-size: 13px; }
  .spinner { width: 16px; height: 16px; border: 2px solid var(--border2); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

// ─── コンポーネント: 資産ページ ──────────────────────────
function AssetPage({ records }) {
  const [period, setPeriod] = useState("all");

  const wins = records.filter(r => r.result === "勝").length;
  const buyWins = records.filter(r => r.side === "買" && r.result === "勝").length;
  const buys = records.filter(r => r.side === "買").length;
  const sellWins = records.filter(r => r.side === "売" && r.result === "勝").length;
  const sells = records.filter(r => r.side === "売").length;
  const totalPnl = records.reduce((s, r) => s + calcPnl(r.side, r.entry, r.exit), 0);
  const currentAsset = CAPITAL + totalPnl;
  const winRate = records.length ? Math.round(wins / records.length * 100) : 0;

  const sorted = [...records].sort((a, b) => a.date > b.date ? 1 : -1);
  const months = [...new Set(sorted.map(r => r.date.slice(0, 7)))];

  const filtered = period === "all" ? sorted : sorted.filter(r => r.date.startsWith(period));

  let cumPnl = period === "all" ? 0 : (() => {
    const before = sorted.filter(r => r.date < period + "-01");
    return before.reduce((s, r) => s + calcPnl(r.side, r.entry, r.exit), 0);
  })();

  const chartData = filtered.map(r => {
    cumPnl += calcPnl(r.side, r.entry, r.exit);
    return {
      date: r.date.slice(5).replace("-", "/"),
      asset: CAPITAL + cumPnl,
    };
  });

  if (period === "all" && chartData.length > 0) {
    chartData.unshift({ date: "開始", asset: CAPITAL });
  }

  return (
    <div>
      <div className="grid-5">
        <div className="metric">
          <div className="metric-label">資本金</div>
          <div className="metric-value" style={{ fontSize: 18 }}>¥{CAPITAL.toLocaleString()}</div>
        </div>
        <div className="metric">
          <div className="metric-label">現在の資産</div>
          <div className="metric-value" style={{ fontSize: 18, color: totalPnl >= 0 ? "var(--green)" : "var(--red)" }}>
            ¥{currentAsset.toLocaleString()}
          </div>
          <div className={`metric-sub ${totalPnl >= 0 ? "up" : "down"}`}>
            {fmtYen(totalPnl)} ({totalPnl >= 0 ? "+" : ""}{(totalPnl / CAPITAL * 100).toFixed(1)}%)
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">総合勝率</div>
          <div className="metric-value">{winRate}<span style={{ fontSize: 14 }}>%</span></div>
          <div className="metric-sub" style={{ color: "var(--muted)" }}>{wins}勝{records.length - wins}敗</div>
        </div>
        <div className="metric">
          <div className="metric-label">買い勝率</div>
          <div className="metric-value">{buys ? Math.round(buyWins / buys * 100) : 0}<span style={{ fontSize: 14 }}>%</span></div>
          <div className="metric-sub" style={{ color: "var(--muted)" }}>{buyWins}勝{buys - buyWins}敗</div>
        </div>
        <div className="metric">
          <div className="metric-label">売り勝率</div>
          <div className="metric-value">{sells ? Math.round(sellWins / sells * 100) : 0}<span style={{ fontSize: 14 }}>%</span></div>
          <div className="metric-sub" style={{ color: "var(--muted)" }}>{sellWins}勝{sells - sellWins}敗</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <span className="card-title" style={{ marginBottom: 0 }}>資産推移</span>
          <select
            className="period-select"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            style={{ marginLeft: "auto", width: 120 }}
          >
            <option value="all">全体</option>
            {months.map(m => (
              <option key={m} value={m}>{m.replace("-", "年") + "月"}</option>
            ))}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: "#6b7280", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => Math.round(v / 10000) + "万"}
              width={40}
            />
            <Tooltip
              contentStyle={{ background: "#1e2433", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 12 }}
              formatter={v => ["¥" + v.toLocaleString(), "資産"]}
            />
            <Line type="monotone" dataKey="asset" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── コンポーネント: インプットページ ────────────────────
function InputPage({ records }) {
  const [monthly, setMonthly] = useState("up");
  const [weekly, setWeekly] = useState("up");
  const [daily, setDaily] = useState("up");
  const [aiResult, setAiResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const allUp = monthly === "up" && weekly === "up" && daily === "up";
  const allDown = monthly === "down" && weekly === "down" && daily === "down";
  const reverseWarning = allUp || allDown;
  const warningDir = allUp ? "売り" : "買い";
  const trendDir = allUp ? "上昇" : allDown ? "下降" : "混在";

  const wins = records.filter(r => r.result === "勝").length;
  const winRate = records.length ? Math.round(wins / records.length * 100) : 0;
  const buyWins = records.filter(r => r.side === "買" && r.result === "勝").length;
  const buys = records.filter(r => r.side === "買").length;
  const buyRate = buys ? Math.round(buyWins / buys * 100) : 0;
  const sellWins = records.filter(r => r.side === "売" && r.result === "勝").length;
  const sells = records.filter(r => r.side === "売").length;
  const sellRate = sells ? Math.round(sellWins / sells * 100) : 0;

  async function runAI() {
    setLoading(true);
    setAiResult(null);
    try {
      const prompt = `あなたは株式デイトレードのアナリストです。
以下の情報をもとに楽天グループ（4755）の本日のトレード分析をJSON形式で回答してください。

【トレンド情報】
- 月足: ${monthly === "up" ? "上昇" : monthly === "down" ? "下降" : "横這い"}
- 週足: ${weekly === "up" ? "上昇" : weekly === "down" ? "下降" : "横這い"}
- 日足: ${daily === "up" ? "上昇" : daily === "down" ? "下降" : "横這い"}

【トレードルール】
- エントリーは9:30（9:00〜9:30で方向確認後）
- IFD-OCO注文（利確=指値、損切=逆指値+不成）
- 100株固定
- 逆張り禁止：3足同方向の場合は逆方向エントリー禁止
- リスクリワード最低1:1.5

以下のJSON形式のみで回答してください（他のテキスト不要）:
{
  "ai_up_pct": 数値(0-100),
  "ai_flat_pct": 数値(0-100),
  "ai_down_pct": 数値(0-100),
  "ai_up_range": "〇〇〇〜〇〇〇円",
  "ai_down_range": "〇〇〇〜〇〇〇円",
  "ai_summary": "AI分析コメント（50字以内）",
  "rule_action": "買いエントリー" or "売りエントリー" or "エントリー見送り",
  "rule_tp": 数値(円),
  "rule_sl": 数値(円),
  "rule_rr": "1:X.X",
  "rule_comment": "ルールベースコメント（50字以内）"
}`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
       headers: { "Content-Type": "application/json", "x-api-key": process.env.REACT_APP_ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      const text = data.content?.map(c => c.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setAiResult(parsed);
    } catch (e) {
      setAiResult({ error: "分析に失敗しました。再試行してください。" });
    }
    setLoading(false);
  }

  const TrendBtn = ({ val, current, onChange, label }) => (
    <button
      className="trend-pill"
      style={{
        background: current === val ? (val === "up" ? "var(--green-bg)" : val === "down" ? "var(--red-bg)" : "var(--amber-bg)") : "var(--surface2)",
        color: current === val ? (val === "up" ? "var(--green)" : val === "down" ? "var(--red)" : "var(--amber)") : "var(--muted)",
        border: current === val ? "1px solid " + (val === "up" ? "rgba(34,197,94,0.3)" : val === "down" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)") : "1px solid var(--border)",
        cursor: "pointer"
      }}
      onClick={() => onChange(val)}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="card">
        <div className="card-title">トレンド入力（3足チェック）</div>
        <div style={{ display: "grid", gap: 10 }}>
          {[["月足", monthly, setMonthly], ["週足", weekly, setWeekly], ["日足（前日）", daily, setDaily]].map(([lbl, cur, setter]) => (
            <div key={lbl}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{lbl}</div>
              <div className="trend-pills">
                <TrendBtn val="up" current={cur} onChange={setter} label="↑ 上昇" />
                <TrendBtn val="flat" current={cur} onChange={setter} label="→ 横這い" />
                <TrendBtn val="down" current={cur} onChange={setter} label="↓ 下降" />
              </div>
            </div>
          ))}
        </div>
        {reverseWarning && (
          <div className="alert alert-danger" style={{ marginTop: 4 }}>
            ⚠ 3足そろって{trendDir} — {warningDir}エントリー禁止（逆張り禁止ルール）
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">過去実績（ルールベース参考）</div>
        <div className="grid-3">
          <div className="metric">
            <div className="metric-label">総合勝率</div>
            <div className="metric-value">{winRate}<span style={{ fontSize: 14 }}>%</span></div>
            <div className="metric-sub" style={{ color: "var(--muted)" }}>{wins}勝{records.length - wins}敗</div>
          </div>
          <div className="metric">
            <div className="metric-label">買い勝率</div>
            <div className="metric-value">{buyRate}<span style={{ fontSize: 14 }}>%</span></div>
            <div className="metric-sub" style={{ color: "var(--muted)" }}>{buyWins}勝{buys - buyWins}敗</div>
          </div>
          <div className="metric">
            <div className="metric-label">売り勝率</div>
            <div className="metric-value">{sellRate}<span style={{ fontSize: 14 }}>%</span></div>
            <div className="metric-sub" style={{ color: "var(--muted)" }}>{sellWins}勝{sells - sellWins}敗</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">AI予測 × ルールベース分析</div>
        <button className="btn btn-primary" onClick={runAI} disabled={loading} style={{ marginBottom: 14 }}>
          {loading ? "分析中..." : "Claude AIで分析する"}
        </button>

        {loading && (
          <div className="ai-loading">
            <div className="spinner" />
            トレンド情報をもとにClaudeが分析中...
          </div>
        )}

        {aiResult?.error && (
          <div className="alert alert-danger">{aiResult.error}</div>
        )}

        {aiResult && !aiResult.error && (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>AI予測（市場分析ベース）</div>
              <div className="prob-row">
                <div className="prob-head"><span className="up">上昇</span><span className="up">{aiResult.ai_up_pct}%</span></div>
                <div className="prob-bar"><div className="prob-fill" style={{ width: aiResult.ai_up_pct + "%", background: "var(--green)" }} /></div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>予想レンジ {aiResult.ai_up_range}</div>
              </div>
              <div className="prob-row">
                <div className="prob-head"><span className="neutral">横這い</span><span className="neutral">{aiResult.ai_flat_pct}%</span></div>
                <div className="prob-bar"><div className="prob-fill" style={{ width: aiResult.ai_flat_pct + "%", background: "var(--amber)" }} /></div>
              </div>
              <div className="prob-row">
                <div className="prob-head"><span className="down">下降</span><span className="down">{aiResult.ai_down_pct}%</span></div>
                <div className="prob-bar"><div className="prob-fill" style={{ width: aiResult.ai_down_pct + "%", background: "var(--red)" }} /></div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>予想レンジ {aiResult.ai_down_range}</div>
              </div>
              <div className="scenario scenario-ai">
                <div className="scenario-label" style={{ color: "var(--accent)" }}>AIコメント</div>
                <div className="scenario-text" style={{ fontFamily: "var(--font)", fontSize: 13 }}>{aiResult.ai_summary}</div>
              </div>
            </div>

            <hr className="divider" />

            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>ルールベース推奨（あなたのルール適用後）</div>
              <div className="scenario scenario-rule">
                <div className="scenario-label" style={{ color: "var(--green)" }}>推奨アクション</div>
                <div className="scenario-text">
                  9:30 {aiResult.rule_action}（100株）{"\n"}
                  IFD-OCO：利確 {aiResult.rule_tp}円 / 損切 {aiResult.rule_sl}円{"\n"}
                  リスクリワード {aiResult.rule_rr}
                </div>
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 10, lineHeight: 1.7 }}>{aiResult.rule_comment}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── コンポーネント: 記録ページ ──────────────────────────
const EMPTY_FORM = { date: "", side: "買", result: "勝", ep: "", tp: "", sl: "", entry: "", exit: "", open: "", high: "", low: "", close: "", vol: "", pred: "上昇", memo: "" };

function RecordPage({ records, setRecords }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  function openAdd() { setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) }); setModal(true); }
  function closeModal() { setModal(false); }

  function save() {
    if (!form.date) return alert("日付を入力してください");
    const entry = Number(form.entry) || 0;
    const exit = Number(form.exit) || 0;
    const pnl = calcPnl(form.side, entry, exit);
    const rec = {
      id: Date.now(),
      ...form,
      ep: Number(form.ep) || entry,
      tp: Number(form.tp) || 0,
      sl: Number(form.sl) || 0,
      entry, exit, pnl,
      open: Number(form.open) || 0,
      high: Number(form.high) || 0,
      low: Number(form.low) || 0,
      close: Number(form.close) || 0,
    };
    setRecords(prev => [rec, ...prev]);
    setModal(false);
  }

  function deleteRec(id) {
    if (!window.confirm("この記録を削除しますか？")) return;
    setRecords(prev => prev.filter(r => r.id !== id));
  }

  function exportCSV() {
    const hdr = "日付,曜日,売買,勝敗,EP,利確設定,損切設定,約定,決済,損益,始値,高値,安値,終値,出来高,差分,レンジ,予想,振り返り\n";
    const rows = records.map(r => {
      const diff = r.close - r.open;
      const range = r.high - r.low;
      return [r.date, dayStr(r.date), r.side, r.result, r.ep, r.tp, r.sl, r.entry, r.exit, calcPnl(r.side, r.entry, r.exit), r.open, r.high, r.low, r.close, r.vol, diff, range, r.pred, `"${r.memo}"`].join(",");
    }).join("\n");
    const blob = new Blob(["\uFEFF" + hdr + rows], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "trade_log.csv"; a.click();
  }

  const F = ({ label, id, type = "text", opts }) => (
    <div className="form-field">
      <label className="form-label">{label}</label>
      {opts ? (
        <select value={form[id]} onChange={e => setForm(p => ({ ...p, [id]: e.target.value }))}>
          {opts.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={form[id]} onChange={e => setForm(p => ({ ...p, [id]: e.target.value }))} />
      )}
    </div>
  );

  return (
    <div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={openAdd}>+ 新規追加</button>
        <button className="btn" onClick={exportCSV}>↓ CSV出力</button>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>操作</th><th>日付</th><th>曜</th><th>売買</th><th>勝敗</th>
              <th>EP</th><th>利確設定</th><th>損切設定</th><th>約定</th><th>決済</th><th>損益</th>
              <th>始値</th><th>高値</th><th>安値</th><th>終値</th><th>出来高</th>
              <th>差分</th><th>レンジ</th><th>予想</th><th>振り返り</th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => {
              const pnl = calcPnl(r.side, r.entry, r.exit);
              return (
                <tr key={r.id}>
                  <td><button className="btn btn-danger rule-del" onClick={() => deleteRec(r.id)}>削除</button></td>
                  <td>{r.date.slice(5).replace("-", "/")}</td>
                  <td>{dayStr(r.date)}</td>
                  <td>{r.side}</td>
                  <td className={r.result === "勝" ? "win" : "lose"}>{r.result}</td>
                  <td>{r.ep}</td><td>{r.tp}</td><td>{r.sl}</td>
                  <td>{r.entry}</td><td>{r.exit}</td>
                  <td className={pnl >= 0 ? "win" : "lose"}>{fmtYen(pnl)}</td>
                  <td>{r.open}</td><td>{r.high}</td><td>{r.low}</td><td>{r.close}</td>
                  <td>{r.vol}</td>
                  <td>{r.close - r.open >= 0 ? "+" : ""}{r.close - r.open}</td>
                  <td>{r.high - r.low}</td>
                  <td>{r.pred}</td>
                  <td style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", fontFamily: "var(--font)" }}>{r.memo}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-title">新規トレード記録</div>
            <div className="form-grid">
              <F label="日付" id="date" type="date" />
              <F label="売買" id="side" opts={["買", "売"]} />
              <F label="勝敗" id="result" opts={["勝", "負"]} />
              <F label="EP（エントリー予定）" id="ep" type="number" />
              <F label="利確設定（円）" id="tp" type="number" />
              <F label="損切設定（円）" id="sl" type="number" />
              <F label="約定価格（円）" id="entry" type="number" />
              <F label="決済価格（円）" id="exit" type="number" />
              <F label="始値" id="open" type="number" />
              <F label="高値" id="high" type="number" />
              <F label="安値" id="low" type="number" />
              <F label="終値" id="close" type="number" />
              <F label="出来高" id="vol" />
              <F label="予想" id="pred" opts={["上昇", "横這い", "下降"]} />
              <div className="form-field form-full">
                <label className="form-label">振り返り</label>
                <textarea rows={3} value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={closeModal}>キャンセル</button>
              <button className="btn btn-primary" onClick={save}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── コンポーネント: ルールページ ────────────────────────
function RulePage({ rules, setRules }) {
  const [input, setInput] = useState("");

  function add() {
    const t = input.trim(); if (!t) return;
    setRules(prev => [...prev, t]);
    setInput("");
  }

  function remove(i) {
    if (!window.confirm("このルールを削除しますか？")) return;
    setRules(prev => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">トレードルール</div>
        <div className="rule-list">
          {rules.map((r, i) => (
            <div className="rule-item" key={i}>
              <div className="rule-num">{String(i + 1).padStart(2, "0")}</div>
              <div className="rule-text">{r}</div>
              <button className="btn btn-danger rule-del" onClick={() => remove(i)}>削除</button>
            </div>
          ))}
        </div>
        <div className="add-row" style={{ marginTop: 16 }}>
          <input
            type="text"
            placeholder="新しいルールを入力..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()}
          />
          <button className="btn btn-primary" onClick={add}>追加</button>
        </div>
      </div>
    </div>
  );
}

// ─── メインApp ───────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("asset");

  const [records, setRecords] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RECORDS);
      return saved ? JSON.parse(saved) : DEFAULT_RECORDS;
    } catch { return DEFAULT_RECORDS; }
  });

  const [rules, setRules] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RULES);
      return saved ? JSON.parse(saved) : DEFAULT_RULES;
    } catch { return DEFAULT_RULES; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records)); } catch {}
  }, [records]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules)); } catch {}
  }, [rules]);

  const PAGES = [
    { id: "asset", label: "資産" },
    { id: "input", label: "インプット" },
    { id: "record", label: "記録" },
    { id: "rule", label: "ルール" },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <div className="header">
          <span className="header-logo">4755</span>
          <span className="header-title">楽天グループ デイトレ管理</span>
          <span className="header-badge">検証フェーズ</span>
        </div>
        <nav className="nav">
          {PAGES.map(p => (
            <button
              key={p.id}
              className={`nav-btn${page === p.id ? " active" : ""}`}
              onClick={() => setPage(p.id)}
            >
              {p.label}
            </button>
          ))}
        </nav>
        {page === "asset" && <AssetPage records={records} />}
        {page === "input" && <InputPage records={records} />}
        {page === "record" && <RecordPage records={records} setRecords={setRecords} />}
        {page === "rule" && <RulePage rules={rules} setRules={setRules} />}
      </div>
    </>
  );
}
