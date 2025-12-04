// server.js

// 引入必要的套件
const express = require("express");
const axios = require("axios");
const cors = require("cors");
// 載入 .env 檔案中的環境變數，確保 API Key 可用
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3300; // 使用環境變數的 PORT，如果沒有則預設 3300
const CWA_API_KEY = process.env.CWA_API_KEY;

// --- 中間件 (Middleware) 設定 ---
// 啟用 CORS，允許所有來源進行跨域請求 (如果您有特定前端網域，建議改為指定網域)
app.use(cors());
app.use(express.json()); // 讓 Express 可以解析 JSON 格式的請求 body

// --- 輔助函式：取得並格式化全臺灣天氣資料 ---

/**
 * 呼叫中央氣象署 API (F-C0032-001) 取得全臺灣所有縣市的 36 小時天氣預報。
 * @returns {Array} 格式化後的天氣資料陣列，每個元素包含一個縣市的預報。
 */
async function fetchAllTaiwanWeather() {
  // 檢查 API Key 是否已設定
  if (!CWA_API_KEY) {
    console.error("錯誤: CWA_API_KEY 未設定在 .env 檔案中!");
    throw new Error("CWA_API_KEY is not configured.");
  }

  // 完整的 API 請求 URL，不包含 locationName 參數
  const cwaApiUrl = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001?Authorization=${CWA_API_KEY}`;

  try {
    const response = await axios.get(cwaApiUrl);
    const data = response.data;

    if (data.success !== "true") {
      // 如果 API 回傳失敗狀態，拋出錯誤
      console.error("[CWA API Error]", data.message);
      throw new Error(data.message || "無法取得天氣資料，API 回應失敗");
    }

    const locations = data.records.location;

    if (!locations || locations.length === 0) {
      return []; // 無資料則回傳空陣列
    }

    // 格式化每個縣市的資料
    const allCityWeather = locations.map((location) => {
      const cityName = location.locationName;
      const elements = location.weatherElement;

      // 提取第一個預報時段的資料 (Index 0)
      const firstTime = elements[0].time[0];

      // 使用 find 函式提取所需的氣象元素
      const extractElement = (elementName) =>
        elements.find((e) => e.elementName === elementName)?.time[0]?.parameter
          ?.parameterName || "N/A";

      return {
        cityName: cityName,
        startTime: firstTime.startTime,
        endTime: firstTime.endTime,
        // 提取並清理資料
        weatherDescription: extractElement("Wx"), // 天氣現象描述
        minTemperature: parseInt(extractElement("MinT"), 10), // 最低溫度 (轉數字)
        maxTemperature: parseInt(extractElement("MaxT"), 10), // 最高溫度 (轉數字)
        rainProbability: parseInt(extractElement("PoP"), 10), // 降雨機率 (轉數字)
        comfortIndex: extractElement("CI"), // 舒適度/指數
        // 由於風速、風向不是 F-C0032-001 的主要元素，您可以根據需要自行調整
      };
    });

    return allCityWeather;
  } catch (error) {
    console.error("呼叫 CWA API 發生錯誤:", error.message);
    throw new Error(`天氣資料服務錯誤: ${error.message}`);
  }
}

// --- API 路由：全臺灣天氣資訊 ---

app.get("/api/taiwan-weather", async (req, res) => {
  try {
    const weatherData = await fetchAllTaiwanWeather();

    // 成功回傳 JSON 格式的資料
    res.json({
      success: true,
      count: weatherData.length,
      data: weatherData,
    });
  } catch (error) {
    // 錯誤處理
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// --- 啟動伺服器 ---

app.listen(PORT, () => {
  console.log(`\n🎉 伺服器已啟動!`);
  console.log(`📡 監聽 Port: ${PORT}`);
  console.log(
    `🔗 全臺灣天氣 API 路由: http://localhost:${PORT}/api/taiwan-weather\n`
  );

  if (!CWA_API_KEY) {
    console.warn("⚠️ 警告: CWA API Key 未設定，請檢查 .env 檔案。");
  }
});
