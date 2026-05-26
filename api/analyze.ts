import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

// System Instructions to guide the AI's data analysis behavior and output format
const SYSTEM_INSTRUCTIONS = `
你是一位專業的資料分析師。
你的任務是接收一段 CSV 或表格結構的原始數據，理解其欄位意義，並提出精確的摘要報告與洞察。

請務必嚴格遵循以下 Markdown 輸出格式：

### 1. 📊 資料概況與欄位理解
簡要說明這份資料的主題是什麼，並列出關鍵欄位的意義。

### 2. ⚠️ 異常與缺值檢查
檢查資料中是否有空白（例如缺少數量或金額）、極端值（例如不合理的高價），並將發現的異常項目條列出來。若無異常，說明「未發現明顯異常」。

### 3. 📈 統計與趨勢洞察
請回答以下問題的總結：
- **總計概況**：銷售數量或總金額的大概加總。
- **分類表現**：哪個業務員或哪項產品表現最好？
- **業務建議**：從數據中給出 1-2 個可以執行的商業建議。

請以 Markdown 格式輸出，所有繁體中文部分必須使用**繁體中文**回覆，不要包含任何額外的問候語或結語。
`;

// Helper to sanitize and trim inputs
function sanitizeCsv(csvString: string): string {
  if (!csvString) return "";
  return csvString.trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "僅支援 POST 請求！",
    });
  }

  try {
    const { csvData, reportType, customPrompt, analysisMode, provider = "gemini" } = req.body;

    if (!csvData || typeof csvData !== "string") {
      return res.status(400).json({
        success: false,
        error: "請提供有效的 CSV 數據！",
      });
    }

    const cleanCsv = sanitizeCsv(csvData);
    if (cleanCsv.length === 0) {
      return res.status(400).json({
        success: false,
        error: "CSV 數據內容為空！",
      });
    }

    // Build prompting context
    let promptText = `
這是供分析的 CSV 數據內容：
\`\`\`csv
${cleanCsv}
\`\`\`

【分析規格與特別要求】：
請再三確認您的輸出結構，必須精確包含且僅包含以下三個標題欄位：
1. "### 1. 📊 資料概況與欄位理解"
2. "### 2. ⚠️ 異常與缺值檢查"
3. "### 3. 📈 統計與趨勢洞察"

在回答「### 3. 📈 統計與趨勢洞察」時，請融入以下額外焦點要求：
`;

    if (reportType === "summary") {
      promptText += "- 著重在「綜合數據精要與主要摘要」，簡潔明瞭地在該區塊描述數值總結與關鍵分類。\n";
    } else if (reportType === "trends") {
      promptText += "- 著重在「趨勢發掘與異常波動」，指出哪些維度、時間點或分類有顯著的增長、衰退或規律變化。\n";
    } else if (reportType === "kpi") {
      promptText += "- 著重在「核心績效指標 (KPIs) 與數值指標」，在該區塊可使用 Markdown 表格來呈現重要加總與比例。\n";
    } else if (reportType === "action") {
      promptText += "- 著重在「行動化商業建議與具體執行策略」，在業務建議部分提供立即可執行的策略方向與具體方案。\n";
    } else {
      promptText += "- 進行綜合性多維度分析，包含上述所有焦點維度（概覽, KPIs, 趨勢, 改善建議）。\n";
    }

    if (analysisMode === "deep") {
      promptText += "- 本次分析採用「深度剖析模式」，請在三個標準段落內部，更加深度、細緻地推導數據背後的商業關聯因素。\n";
    } else {
      promptText += "- 本次分析採用「快速精煉模式」，請講求高效率且重點突出、直接有力的洞察呈現。\n";
    }

    if (customPrompt && typeof customPrompt === "string" && customPrompt.trim().length > 0) {
      promptText += `- 使用者加註的額外特別要求：\n"${customPrompt.trim()}"\n`;
    }

    promptText += "\n請以 Markdown 格式直接回覆分析內容，絕對不要有任何問候語、前言或任何結尾贅字。";

    let report = "";

    if (provider === "nvidia") {
      const apiKey = process.env.NVIDIA_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: "NVIDIA_API_KEY 尚未設定，請在 Vercel 或本地環境變數中設定金鑰。",
        });
      }

      // Proactively call NVIDIA API using standard fetch
      const nvidiaResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "nvidia/nemotron-mini-4b-instruct",
          messages: [
            {
              role: "system",
              content: SYSTEM_INSTRUCTIONS,
            },
            {
              role: "user",
              content: promptText,
            },
          ],
          temperature: 0.2,
        }),
      });

      if (!nvidiaResponse.ok) {
        const errorDetail = await nvidiaResponse.text();
        throw new Error(`NVIDIA API 呼叫失敗 (${nvidiaResponse.status}): ${errorDetail}`);
      }

      const nvidiaData = await nvidiaResponse.json();
      report = nvidiaData.choices?.[0]?.message?.content || "";
    } else {
      // Default to Google Gemini
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: "GEMINI_API_KEY 尚未設定，請在 Vercel 或本地環境變數中設定金鑰。",
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: promptText,
        config: {
          systemInstruction: SYSTEM_INSTRUCTIONS,
          temperature: 0.2,
        },
      });

      report = response.text || "";
    }

    return res.status(200).json({
      success: true,
      report: report || "未能產生分析結果，請檢查輸入數據是否有誤。",
      metadata: {
        timestamp: new Date().toISOString(),
        csvLength: cleanCsv.length,
        linesAnalyzed: cleanCsv.split("\n").filter(line => line.trim()).length,
      },
    });

  } catch (error: any) {
    console.error("AI Analysis Serverless Function Error:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "伺服器在進行 AI 分析時發生未知錯誤，請稍後再試。",
    });
  }
}
