/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  FileSpreadsheet,
  TrendingUp,
  Cpu,
  Users,
  Play,
  Check,
  Copy,
  Upload,
  RefreshCw,
  Database,
  History,
  Download,
  FileText,
  AlertCircle,
  HelpCircle,
  Trash2,
  Settings,
  ChevronRight,
  Maximize2,
  BookOpen
} from "lucide-react";
import { CSV_TEMPLATES } from "./data";
import { ReportType, AnalysisMode, AnalysisResponse, AnalysisHistoryItem } from "./types";

export default function App() {
  // Input states
  const [csvContent, setCsvContent] = useState<string>("");
  const [reportType, setReportType] = useState<ReportType>("all");
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("fast");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [provider, setProvider] = useState<"gemini" | "nvidia">("gemini");

  // UI state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"input" | "history">("input");
  const [currentReport, setCurrentReport] = useState<string>("");
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [successInfo, setSuccessInfo] = useState<{ lines: number; chars: number } | null>(null);
  
  // History state
  const [historyList, setHistoryList] = useState<AnalysisHistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  // Auto-updating fun status loader messages
  const [loadingText, setLoadingText] = useState<string>("正在解析 CSV 欄位維度...");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loaderMessages = [
    "正在解析 CSV 欄位維度與格式...",
    "正在對齊關鍵指標 (KPI) 以及過濾空白內容...",
    provider === "gemini"
      ? "正在啟動 Google Gemini 智慧分析大腦..."
      : "正在啟動 NVIDIA Nemotron 智慧分析大腦...",
    "正在多維度掃描數據，尋找異常高低點與變形趨勢...",
    "正在構建繁體中文專業數據洞察報告表格...",
    "正在彙整 3 到 5 項具體可行、即刻落地的商業改善建言...",
    "正在做最後的美化與結構調整，即將呈現精彩洞察報告..."
  ];

  // Rotate loading text during analysis
  useEffect(() => {
    let interval: any;
    if (isAnalyzing) {
      let idx = 0;
      interval = setInterval(() => {
        idx = (idx + 1) % loaderMessages.length;
        setLoadingText(loaderMessages[idx]);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing, provider]);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem("ai_analysis_history");
    if (saved) {
      try {
        setHistoryList(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load local storage analysis history", e);
      }
    }
  }, []);

  // Save history to localStorage whenever it changes
  const saveHistory = (newList: AnalysisHistoryItem[]) => {
    setHistoryList(newList);
    localStorage.setItem("ai_analysis_history", JSON.stringify(newList));
  };

  // Helper: Count rows and chars in current data
  const getCsvStats = (text: string) => {
    if (!text.trim()) return { lines: 0, chars: 0 };
    const rows = text.split("\n").filter((line) => line.trim()).length;
    return { lines: rows, chars: text.length };
  };

  const currentStats = getCsvStats(csvContent);

  // Apply a template to state
  const selectTemplate = (content: string) => {
    setCsvContent(content);
    setErrorMsg(null);
  };

  // Drag and drop event handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Check extension
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      setErrorMsg("僅支援貼上或上傳 .csv 或 .txt 格式檔案！");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") {
        setCsvContent(text);
        setErrorMsg(null);
      }
    };
    reader.onerror = () => {
      setErrorMsg("檔案讀取失敗，請確認檔案是否損毀。");
    };
    reader.readAsText(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Copy to clipboard
  const copyToClipboard = () => {
    if (!currentReport) return;
    navigator.clipboard.writeText(currentReport)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch((err) => {
        console.error("無法複製報告", err);
        alert("複製失敗，請手動複製結果。");
      });
  };

  // Download Report as Markdown File
  const downloadReport = () => {
    if (!currentReport) return;
    const stats = getCsvStats(csvContent);
    const dateStr = new Date().toLocaleDateString("zh-TW").replace(/\//g, "-");
    const filename = `AI_📊數據分析報告_${dateStr}.md`;
    const element = document.createElement("a");
    const file = new Blob([currentReport], { type: "text/markdown;charset=utf-8" });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Send request to API route
  const startAnalysis = async () => {
    if (!csvContent.trim()) {
      setErrorMsg("請貼上 CSV 資料，或選取下方其中一個推薦資料範本開始！");
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);
    setCurrentReport("");
    setSuccessInfo(null);
    setLoadingText(loaderMessages[0]);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvData: csvContent,
          reportType,
          customPrompt,
          analysisMode,
          provider,
        }),
      });

      const data: AnalysisResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || "分析請求失敗");
      }

      setCurrentReport(data.report);
      setSuccessInfo({
        lines: data.metadata?.linesAnalyzed || currentStats.lines,
        chars: data.metadata?.csvLength || currentStats.chars,
      });

      // Save into history
      const reportNameMapping: Record<ReportType, string> = {
        all: "📖 全方位綜合分析報告",
        summary: "综合數據精要與摘要",
        trends: "趨勢與異常用量偵測",
        kpi: "核心績效指標 (KPI) 分析",
        action: "商務策略改善建議報告",
      };

      const newItem: AnalysisHistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString("zh-TW"),
        reportType,
        analysisMode,
        csvLength: currentStats.chars,
        linesCount: currentStats.lines,
        report: data.report,
        title: `${reportNameMapping[reportType]} - 共 ${currentStats.lines} 筆數據`,
        provider,
      };

      const updatedHistory = [newItem, ...historyList].slice(0, 30); // limit to 30 histories
      saveHistory(updatedHistory);
      setSelectedHistoryId(newItem.id);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "無法連線至 AI 數據分析模組，請檢查伺服器狀態。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Load a history item
  const loadHistoryItem = (item: AnalysisHistoryItem) => {
    setCurrentReport(item.report);
    setSelectedHistoryId(item.id);
    setSuccessInfo({
      lines: item.linesCount,
      chars: item.csvLength,
    });
    if (item.provider) {
      setProvider(item.provider);
    }
  };

  // Delete a history item
  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const filtered = historyList.filter((item) => item.id !== id);
    saveHistory(filtered);
    if (selectedHistoryId === id) {
      setSelectedHistoryId(null);
      setCurrentReport("");
      setSuccessInfo(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] font-sans antialiased flex flex-col">
      
      {/* HEADER SECTION */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#e2e8f0] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Professional Polish Brand Logo icon */}
            <div className="w-10 h-10 bg-gradient-to-br from-[#4f46e5] to-[#818cf8] rounded-lg flex items-center justify-center text-white font-extrabold text-xl shadow-md shadow-indigo-150">
              A
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1e293b] tracking-tight">
                AI 數據分析與洞察工具
              </h1>
              <p className="text-xs text-[#64748b] font-normal">
                專屬您的 3.5 級 AI 數據顧問：秒速處理、智慧提煉、商務決策落地
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Mocked Project Tag & Interactive Indicator from mockup */}
            <div className="hidden md:inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-50 text-[#1e293b] border border-[#e2e8f0]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-2" />
              <span>智能引擎已就緒</span>
            </div>
          </div>
        </div>
      </header>

      {/* WORKSPACE CONTAINER */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: CONTROLS & CSV pasting */}
        <section className="lg:col-span-12 xl:col-span-5 flex flex-col space-y-6">
          
          {/* Main Card */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
              <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider flex items-center gap-2">
                <Database className="h-4 w-4 text-[#4f46e5]" />
                第一步：貼上 CSV 資料
              </span>
              <button
                onClick={() => setCsvContent("")}
                disabled={isAnalyzing || !csvContent}
                className="text-xs text-[#4f46e5] hover:text-[#3730a3] font-semibold disabled:opacity-40 transition-colors cursor-pointer"
                title="清空目前輸入"
              >
                清空重填
              </button>
            </div>

            {/* Drag & Drop Overlay container */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`relative border border-dashed rounded-xl transition-all duration-300 min-h-[220px] flex flex-col ${
                dragActive
                  ? "border-[#4f46e5] bg-indigo-50/20 scale-[0.99]"
                  : csvContent.trim()
                  ? "border-[#e2e8f0] bg-white text-[#1e293b]"
                  : "border-slate-300 hover:border-indigo-400 bg-slate-50/50"
              }`}
            >
              {/* Textarea for typing/pasting */}
              <textarea
                value={csvContent}
                onChange={(e) => {
                  setCsvContent(e.target.value);
                  setErrorMsg(null);
                }}
                disabled={isAnalyzing}
                spellCheck="false"
                placeholder="在此貼上您從 Excel、Google Sheets 複製出來的 CSV 文字，或者將 .csv 檔案直接拖曳放到這個區塊..."
                className="w-full h-48 sm:h-56 p-4 bg-transparent outline-none border-0 text-xs font-mono leading-relaxed placeholder:text-[#64748b] placeholder:not-mono resize-none focus:ring-0"
                id="csv-text-input"
              />

              {/* Upload Helper Banner when Empty */}
              {!csvContent.trim() && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 text-center space-y-2 select-none">
                  <Upload className="h-8 w-8 text-[#818cf8] animate-bounce" />
                  <p className="text-sm font-semibold text-slate-700">
                    貼上 CSV 數據，或拉入 CSV/TXT 檔案
                  </p>
                  <p className="text-xs text-[#64748b]">
                    首行需包含欄位名稱標頭標記、支援逗號與換行
                  </p>
                  <button
                    type="button"
                    onClick={triggerFileInput}
                    className="mt-3 pointer-events-auto px-4 py-2 text-xs font-semibold text-[#4f46e5] bg-white border border-[#e2e8f0] rounded-lg shadow-sm hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
                  >
                    選擇檔案上傳
                  </button>
                </div>
              )}

              {/* Floating invisible file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Current Input Stats */}
            {csvContent.trim() ? (
              <div className="flex items-center justify-between text-xs text-[#64748b] bg-slate-50 px-3 py-2.5 rounded-lg border border-[#e2e8f0]">
                <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <FileText className="h-3.5 w-3.5 text-[#4f46e5]" />
                  已檢獲數據規格
                </span>
                <span className="font-mono">
                  共 <strong>{currentStats.lines}</strong> 行資料 ({currentStats.chars.toLocaleString()} 字元)
                </span>
              </div>
            ) : null}

            {/* Second Step: Parameter Settings */}
            <div className="space-y-4 pt-1 border-t border-[#e2e8f0]">
              <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider flex items-center gap-2">
                <Settings className="h-4 w-4 text-[#4f46e5]" />
                第二步：自訂分析設定
              </span>

              {/* AI Provider Choose */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 block">AI 服務提供商：</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setProvider("gemini")}
                    className={`flex-1 p-2.5 rounded-lg border transition-all text-xs flex flex-col items-center justify-center text-center cursor-pointer ${
                      provider === "gemini"
                        ? "border-[#4f46e5] bg-indigo-50/20 text-[#4f46e5] ring-1 ring-[#4f46e5]"
                        : "border-[#e2e8f0] hover:border-slate-300 text-slate-700 bg-white"
                    }`}
                  >
                    <span className="font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Google Gemini
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 font-normal">gemini-2.5-flash-lite</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProvider("nvidia")}
                    className={`flex-1 p-2.5 rounded-lg border transition-all text-xs flex flex-col items-center justify-center text-center cursor-pointer ${
                      provider === "nvidia"
                        ? "border-[#10b981] bg-emerald-50/20 text-[#047857] ring-1 ring-[#10b981]"
                        : "border-[#e2e8f0] hover:border-slate-300 text-slate-700 bg-white"
                    }`}
                  >
                    <span className="font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      NVIDIA
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 font-normal">nemotron-mini-4b</span>
                  </button>
                </div>
              </div>

              {/* Report Strategy Choose */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 block">分析報告著重焦點：</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "all", label: "綜合全貌報告 (推薦)", desc: "全部覆蓋" },
                    { id: "summary", label: "綜合數據精要", desc: "濃縮與摘要" },
                    { id: "trends", label: "趨勢異常檢測", desc: "找波動起伏" },
                    { id: "kpi", label: "指標數值分析", desc: "算平均與極值" },
                    { id: "action", label: "商務策略改善", desc: "提改善指引" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setReportType(opt.id as ReportType)}
                      className={`text-left p-2.5 rounded-lg border transition-all text-xs flex flex-col justify-between cursor-pointer ${
                        reportType === opt.id
                          ? "border-[#4f46e5] bg-indigo-50/20 text-[#4f46e5] ring-1 ring-[#4f46e5]"
                          : "border-[#e2e8f0] hover:border-slate-300 text-slate-700 bg-white"
                      } ${opt.id === "all" ? "col-span-2 py-3" : ""}`}
                    >
                      <span className="font-bold block">{opt.label}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Deep Analysis Options */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-slate-600 block">AI 分析精準模式：</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAnalysisMode("fast")}
                    className={`flex-1 py-2.5 text-center rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      analysisMode === "fast"
                        ? "border-[#4f46e5] bg-indigo-50/20 text-[#4f46e5] ring-1 ring-[#4f46e5]"
                        : "border-[#e2e8f0] hover:border-slate-300 text-slate-700 bg-white"
                    }`}
                  >
                    🚀 快速精煉模式
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalysisMode("deep")}
                    className={`flex-1 py-2.5 text-center rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      analysisMode === "deep"
                        ? "border-[#4f46e5] bg-indigo-50/20 text-[#4f46e5] ring-1 ring-[#4f46e5]"
                        : "border-[#e2e8f0] hover:border-slate-300 text-slate-700 bg-white"
                    }`}
                  >
                    🧠 深度剖析模式
                  </button>
                </div>
              </div>

              {/* Custom directives */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-600 block">
                    額外補充分析要求 (選填)：
                  </label>
                  <span className="text-[10px] text-slate-400">至多 150 字</span>
                </div>
                <input
                  type="text"
                  maxLength={150}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  disabled={isAnalyzing}
                  placeholder="例如：請幫我特別計算美妝類別的總貢獻度或分析異常高的退貨率原因..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#e2e8f0] focus:outline-none focus:ring-1 focus:ring-[#4f46e5] focus:border-[#4f46e5]"
                  id="custom-instructions"
                />
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 text-rose-800 rounded-lg text-xs leading-relaxed flex items-start space-x-2 border border-rose-100">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-650 mt-0.5" />
                <div>
                  <strong className="font-bold block mb-0.5">無法啟動 analysis</strong>
                  <span>{errorMsg}</span>
                </div>
              </div>
            )}

            {/* Submit Analyze Button */}
            <button
              onClick={startAnalysis}
              disabled={isAnalyzing || !csvContent.trim()}
              className="w-full mt-2 py-3.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold rounded-lg text-sm transition-all focus:ring-4 focus:ring-indigo-100 shadow-lg shadow-[#4f46e5]/20 flex items-center justify-center space-x-2 group shrink-0 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none cursor-pointer"
              id="start-analyze-btn"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>AI 正在全力診斷中... 請稍候</span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:scale-110">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                  </svg>
                  <span>開始 AI 智能分析及決策產出</span>
                </>
              )}
            </button>
          </div>

          {/* Quick interactive templates */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-5 space-y-3">
            <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider block">
              💡 體驗精選 CSV 範本資料庫
            </span>
            <p className="text-xs text-slate-500">
              您可以點擊下方範例快速帶入專業的業務測試數據：
            </p>
            <div className="space-y-2.5">
              {CSV_TEMPLATES.map((tpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectTemplate(tpl.content)}
                  className="w-full text-left p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-100 transition-colors flex items-start space-x-3 group cursor-pointer"
                >
                  <div className="p-1.5 bg-indigo-50 rounded-lg text-[#4f46e5] mt-0.5 group-hover:bg-[#4f46e5] group-hover:text-white transition-colors">
                    {tpl.icon === "TrendingUp" && <TrendingUp className="h-4 w-4" />}
                    {tpl.icon === "Users" && <Users className="h-4 w-4" />}
                    {tpl.icon === "Cpu" && <Cpu className="h-4 w-4" />}
                  </div>
                  <div className="flex-grow">
                    <div className="text-xs font-semibold text-slate-900 flex items-center justify-between">
                      <span>{tpl.name}</span>
                      <ChevronRight className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                    <p className="text-[11px] text-[#64748b] mt-0.5 leading-relaxed">
                      {tpl.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <div className="pt-2 text-[10px] text-[#64748b] text-center border-t border-slate-100">
              系統指令集配置：高級數據分析師模式 v2.1
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: PREVIEW REPORT */}
        <section className="lg:col-span-12 xl:col-span-7 flex flex-col space-y-6">
          
          {/* Professional Stat-Grid above cards to display metadata elegantly */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-sm">
              <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">最暢銷/優勢焦點</div>
              <div className="text-xs font-bold text-[#1e293b] flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                {csvContent.includes("美妝") ? "美妝時尚 / 會員轉型" : csvContent.includes("3C") ? "3C電子 類目" : "未指定類目"}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-sm">
              <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">已分析總列數</div>
              <div className="text-xs font-bold text-[#1e293b]">
                {currentStats.lines > 0 ? `共 ${currentStats.lines} 筆數據記錄` : "等待範本數據"}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-sm">
              <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">數據健康度</div>
              <div className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <span>99.8% 高可用適配</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm flex-grow flex flex-col min-h-[500px] overflow-hidden">
            
            {/* Header of display area with tab-like design */}
            <div className="border-b border-[#e2e8f0] bg-slate-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setActiveTab("input")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "input"
                      ? "bg-white text-[#1e293b] shadow-sm border border-[#e2e8f0] font-bold"
                      : "text-[#64748b] hover:text-[#1e293b]"
                  }`}
                >
                  📄 洞察報告結果
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === "history"
                      ? "bg-white text-[#1e293b] shadow-sm border border-[#e2e8f0] font-bold"
                      : "text-[#64748b] hover:text-[#1e293b]"
                  }`}
                >
                  <History className="h-3 w-3" />
                  <span>分析歷程 ({historyList.length})</span>
                </button>
              </div>

              {/* Utility actions for the current generated report */}
              {currentReport && activeTab === "input" && (
                <div className="flex items-center space-x-2 self-end sm:self-auto">
                  <button
                    onClick={copyToClipboard}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-[#1e293b] bg-white border border-[#e2e8f0] rounded-lg hover:bg-slate-50 active:scale-95 transition-all shadow-sm cursor-pointer"
                    title="一鍵複製 Markdown 數據"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500 mr-1.5 animate-bounce" />
                        <span className="text-emerald-700 font-bold">已複製！</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                        <span>複製報告</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={downloadReport}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-[#4f46e5] rounded-lg hover:bg-[#4338ca] active:scale-95 transition-all shadow-sm cursor-pointer"
                    title="導出報告至 Markdown 檔案"
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    <span>下載 .md 報告</span>
                  </button>
                </div>
              )}
            </div>

            {/* Content Switcher */}
            {activeTab === "input" ? (
              // Main generated report panel
              <div className="p-6 sm:p-8 flex-grow flex flex-col justify-start">
                
                {/* Empty State */}
                {!isAnalyzing && !currentReport && (
                  <div className="flex-grow flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto select-none">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-[#818cf8] mb-6 border border-[#e2e8f0]">
                      <BookOpen className="h-8 w-8" />
                    </div>
                    <h3 className="text-sm font-bold text-[#1e293b] mb-2">等待啟動 AI 智能分析</h3>
                    <p className="text-xs text-[#64748b] leading-relaxed">
                      請在左側貼上資料或載入精選測試範本，點擊即可獲得專業且富含商業洞察的多維結論。
                    </p>
                    <div className="mt-8 flex flex-col items-left space-y-2 border border-[#e2e8f0] bg-[#f8fafc] p-4 rounded-xl text-left w-full">
                      <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block mb-1">
                        🛠️ 常見 CSV 輸入方式範本：
                      </span>
                      <p className="text-[11px] text-[#1e293b] leading-relaxed font-mono">• 第一行為欄位標頭，如：月份,銷售額,退貨率</p>
                      <p className="text-[11px] text-[#64748b] leading-relaxed font-mono">• 第二行起為數值，各行欄位長度應盡量對齊</p>
                    </div>
                  </div>
                )}

                {/* Loading Analytics State with Rotating updates */}
                {isAnalyzing && (
                  <div className="flex-grow flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
                    <div className="relative mb-6">
                      {/* Nested rings spinning with subtle size differences */}
                      <div className="w-14 h-14 rounded-full border-4 border-slate-100 border-t-[#4f46e5] animate-spin" />
                      <div className="w-10 h-10 absolute inset-2 rounded-full border-4 border-dashed border-indigo-100 border-t-[#818cf8] animate-spin" />
                    </div>
                    <h3 className="text-sm font-bold text-[#1e293b] mb-1.5">AI 數據顧問正在密集運算中</h3>
                    <p className="text-xs text-[#4f46e5] font-bold animate-pulse tracking-wide">
                      {loadingText}
                    </p>
                    <p className="text-[10px] text-[#64748b] mt-4 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-[#e2e8f0] max-w-xs block">
                      此過程平均耗時 3-6 秒，系統正運用 Google 最強大的機器學習大腦做跨維度關聯分析。
                    </p>
                  </div>
                )}

                {/* Markdown analyzed result */}
                {currentReport && !isAnalyzing && (
                  <div className="flex-grow flex flex-col">
                    
                    {/* Header Metadata badge block */}
                    {successInfo && (
                      <div className="mb-6 pb-4 border-b border-[#e2e8f0] flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded bg-[#f1f5f9] text-[#475569] text-xs font-semibold">
                          📊 已分析 {successInfo.lines} 行
                        </span>
                        <span className="inline-flex items-center px-2.5 py-1 rounded bg-indigo-50 text-[#4f46e5] text-xs font-semibold">
                          ⚡ 模式：{analysisMode === "deep" ? "深度剖析" : "快速精煉"}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${
                          provider === "nvidia" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                        }`}>
                          🤖 引擎：{provider === "nvidia" ? "NVIDIA" : "Gemini"}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-1 rounded bg-amber-50 text-amber-700 text-xs font-semibold">
                          🎯 著重：
                          {reportType === "all" && "全方位綜合報告"}
                          {reportType === "summary" && "綜合數據精要"}
                          {reportType === "trends" && "趨勢異常用量"}
                          {reportType === "kpi" && "核心績效指標"}
                          {reportType === "action" && "商務執行建議"}
                        </span>
                        <span className="text-[10px] text-[#64748b] ml-auto hidden sm:inline font-mono">
                          完成時間：{new Date().toLocaleTimeString()}
                        </span>
                      </div>
                    )}

                    {/* Report Output Content Area */}
                    <article className="prose prose-sm max-w-none prose-slate text-[#1e293b] leading-relaxed overflow-y-auto max-h-[640px] pr-2 break-words text-left">
                      <ReactMarkdown
                        components={{
                          table: ({ node, ...props }) => (
                            <div className="overflow-x-auto my-4 border border-[#e2e8f0] rounded-xl shadow-sm">
                              <table className="min-w-full divide-y divide-[#e2e8f0] bg-white text-xs text-left" {...props} />
                            </div>
                          ),
                          th: ({ node, ...props }) => (
                            <th className="bg-slate-50 px-4 py-2 text-left text-xs font-bold text-[#1e293b] border-b border-[#e2e8f0] uppercase tracking-wider" {...props} />
                          ),
                          td: ({ node, ...props }) => (
                            <td className="px-4 py-2 border-b border-slate-100 text-[#1e293b] text-xs text-left" {...props} />
                          ),
                          h2: ({ node, ...props }) => (
                            <h2 className="text-sm font-bold text-[#4f46e5] border-l-4 border-[#4f46e5] pl-2.5 mt-6 mb-3 flex items-center gap-1.5 uppercase tracking-wider" {...props} />
                          ),
                          h3: ({ node, ...props }) => (
                            <h3 className="text-xs font-bold text-[#1e293b] mt-4 mb-2 border-b-2 border-slate-100 pb-1" {...props} />
                          ),
                          p: ({ node, ...props }) => (
                            <p className="text-xs text-[#334155] leading-relaxed mb-3" {...props} />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul className="list-disc pl-5 mb-3 text-xs text-[#334155] space-y-1" {...props} />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol className="list-decimal pl-5 mb-3 text-xs text-[#334155] space-y-1" {...props} />
                          ),
                          li: ({ node, ...props }) => (
                            <li className="text-xs text-[#334155]" {...props} />
                          ),
                          strong: ({ node, ...props }) => (
                            <strong className="font-bold text-[#1e293b]" {...props} />
                          )
                        }}
                      >
                        {currentReport}
                      </ReactMarkdown>
                    </article>
                  </div>
                )}
              </div>
            ) : (
              // History panel
              <div className="p-6 sm:p-8 flex-grow flex flex-col">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-[#1e293b]">歷程記錄列表</h3>
                  <p className="text-xs text-[#64748b]">
                    系統會將您在本地端生成過的數據分析自動保存（至多 30 筆），點擊即可快速重載檢視。
                  </p>
                </div>

                {historyList.length === 0 ? (
                  <div className="flex-grow flex flex-col items-center justify-center py-20 text-center select-none">
                    <History className="h-10 w-10 text-slate-350 mb-4 animate-pulse" />
                    <p className="text-xs text-[#64748b]">目前尚無歷史分析紀錄。請開始在輸入區啟動分析！</p>
                  </div>
                ) : (
                  <div className="flex-grow overflow-y-auto max-h-[550px] space-y-3 pr-2">
                    {historyList.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          loadHistoryItem(item);
                          setActiveTab("input");
                        }}
                        className={`p-4 rounded-xl border transition-all cursor-pointer text-left flex items-start justify-between group ${
                          selectedHistoryId === item.id
                            ? "bg-indigo-50/20 border-[#4f46e5]"
                            : "bg-white hover:bg-slate-50 border-[#e2e8f0]"
                        }`}
                      >
                        <div className="space-y-1 select-none flex-grow">
                          <span className="text-xs font-bold text-[#1e293b] group-hover:text-[#4f46e5] transition-colors block">
                            {item.title}
                          </span>
                          <div className="flex items-center space-x-2 text-[10px] text-[#64748b] flex-wrap gap-y-1">
                            <span>🕒 {item.timestamp}</span>
                            <span>•</span>
                            <span>模式：{item.analysisMode === "deep" ? "深度" : "快速"}</span>
                            <span>•</span>
                            <span>大小：{(item.csvLength / 1000).toFixed(1)} KB</span>
                            {item.provider && (
                              <>
                                <span>•</span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  item.provider === "nvidia" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                                }`}>
                                  {item.provider === "nvidia" ? "NVIDIA" : "Gemini"}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              loadHistoryItem(item);
                              setActiveTab("input");
                            }}
                            className="p-1 text-slate-400 hover:text-[#4f46e5] rounded hover:bg-slate-100 transition-colors cursor-pointer"
                            title="開啟載入"
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => deleteHistoryItem(e, item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                            title="刪除此紀錄"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

      </main>

      {/* FOOTER SECTION */}
      <footer className="bg-white border-t border-[#e2e8f0] py-6 mt-12 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between text-xs text-[#64748b] font-normal space-y-3 md:space-y-0">
          <p>© 2026 AI 數據分析與洞察工具. 系統全程維持本機資料庫隱私並安全連接 Gemini。</p>
          <div className="flex items-center space-x-4">
            <span className="flex items-center gap-1.5 hover:text-[#1e293b] transition-colors cursor-help bg-white border border-[#e2e8f0] px-2.5 py-1 rounded-md" title="CSV 全規格支援：包括以逗號、表格分格或換行符號對齊的數據均能極佳適配。">
              <HelpCircle className="h-3.5 w-3.5 text-[#4f46e5]" />
              <span className="font-semibold text-slate-700">CSV 格式規格指南</span>
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
