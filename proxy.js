import express from "express";
import cors from "cors";
import { onValue } from "firebase/database";
import {
  proxyConfigRef,
  derivativeOrderRef,
  orderRef,
  saveFirebaseData,
} from "./firebase/firebase-config.js";
import { PATH_URL } from "./url.js";
import http from "http";
import httpProxy from "http-proxy";
const { createProxyServer } = httpProxy;

const app = express();
app.use(cors());
app.use(express.json());

export const EMPTY_TYPE = {
  EMPTY_ARRAY: "EMPTY_ARRAY",
};

const DOMAINS_TYPE = {
  TRADING: "/trading/",
  MT: "/mt/",
  WWW_QC: "/www-qc/",
  IQ: "/iq/",
  AI: "/ai/",
  LOG: "/log/",
  SOCKET: "/socket/",
};

const KRX_INTEGRATION = {
  [DOMAINS_TYPE.TRADING]: "https://trading-krx.vietcap.int",
  [DOMAINS_TYPE.MT]: "https://trading-krx.vietcap.int",
  [DOMAINS_TYPE.WWW_QC]: "https://www-qc.vietcap.int",
  [DOMAINS_TYPE.IQ]: "https://trading-krx.vietcap.int",
  [DOMAINS_TYPE.AI]: "https://trading-krx.vietcap.int",
  [DOMAINS_TYPE.LOG]: "https://ncore-qc.vcsc.vn",
  [DOMAINS_TYPE.SOCKET]: "wss://trading-qc.vietcap.int",
};

const QC = {
  [DOMAINS_TYPE.TRADING]: "https://trading-qc.vietcap.int",
  [DOMAINS_TYPE.MT]: "https://mt-qc.vietcap.int",
  [DOMAINS_TYPE.WWW_QC]: "https://www-qc.vietcap.int",
  [DOMAINS_TYPE.IQ]: "https://iq-qc.vietcap.int",
  [DOMAINS_TYPE.AI]: "https://ai-qc.vietcap.int",
  [DOMAINS_TYPE.LOG]: "https://ncore-qc.vcsc.vn",
  [DOMAINS_TYPE.SOCKET]: "wss://trading-qc.vietcap.int",
};

const PRO = {
  [DOMAINS_TYPE.TRADING]: "https://trading.vietcap.com.vn",
  [DOMAINS_TYPE.MT]: "https://trading.vietcap.com.vn",
  [DOMAINS_TYPE.WWW_QC]: "https://www.vietcap.com.vn",
  [DOMAINS_TYPE.IQ]: "https://iq.vietcap.com.vn",
  [DOMAINS_TYPE.AI]: "https://ai.vietcap.com.vn",
  [DOMAINS_TYPE.LOG]: "https://ncore.vcsc.vn",
  [DOMAINS_TYPE.SOCKET]: "wss://trading-qc.vietcap.int",
};

let fakeDataResponse = [];
let ENV = "QC";
let targetSocket = "wss://trading-qc.vietcap.int";

onValue(proxyConfigRef, (snapshot) => {
  const proxyConfig = snapshot.val();
  if (proxyConfig) {
    targetSocket = proxyConfig.baseSocket;
  }
  if (proxyConfig) {
    if (proxyConfig?.ENV) {
      ENV = proxyConfig.ENV || "QC";
    }
    if (!proxyConfig.enableFakeData) {
      fakeDataResponse = [];
    } else {
      fakeDataResponse = proxyConfig.fakeData?.map?.((item) => ({
        ...item,
        data: item.data === EMPTY_TYPE.EMPTY_ARRAY ? [] : item.data,
      }));
    }
  }
});

function getTargetUrl() {
  switch (ENV) {
    case "QC":
      return QC;
    case "PRODUCTION":
      return PRO;
    case "KRX_INTEGRATION":
      return KRX_INTEGRATION;
    default:
      return QC;
  }
}

const isModeDev = process.env.MODE === "dev";
if (isModeDev) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

async function fetchData(req, target, targetUrl) {
  return await fetch(targetUrl, {
    method: req.method,
    headers: {
      ...req.headers,
      host: new URL(target).host,
    },
    body: ["GET", "HEAD"].includes(req.method)
      ? undefined
      : JSON.stringify(req.body),
  });
}

function timeDelay(delayInms) {
  return new Promise((resolve) => setTimeout(resolve, delayInms));
}

async function proxyApi(targetUrl, res, data) {
  let result = data;
  const fakeData = fakeDataResponse.find(
    (item) => item.url === targetUrl && item?.enable
  );

  if (fakeData?.delay) {
    await timeDelay(fakeData?.delay);
  }

  if (fakeData) {
    if (fakeData.dataStringify) {
      const dataObj = JSON.parse(fakeData.dataStringify);
      result = dataObj;
    } else {
      result = fakeData.data;
    }
  }
  res.json(result);
  simulatorSocket(targetUrl, result);
}

function simulatorSocket(targetUrl, res) {
  const targetUrlMain = targetUrl?.split?.("?")?.[0];
  switch (targetUrlMain) {
    case PATH_URL.DERIVATIVE_ORDER:
      saveFirebaseData(derivativeOrderRef, {
        data: res?.data,
        code: "c",
        id: res?.data?.id,
      });
      break;
    case PATH_URL.ORDER:
      saveFirebaseData(orderRef, {
        data: res?.data,
        code: "c",
        id: res?.data?.id,
      });
      break;
    default:
      break;
  }
}

const DOMAINS = Object.values(DOMAINS_TYPE);
DOMAINS.forEach((domain) => {
  app.use(domain, async (req, res) => {
    const targets = getTargetUrl();
    const target = targets[domain];
    const originalUrl = req.originalUrl.replace(domain, "/");
    const targetUrl = target + originalUrl;
    console.log("🔁 Proxy:", originalUrl);

    try {
      const fetchResponse = await fetchData(req, target, targetUrl);
      const contentType = fetchResponse.headers.get("content-type");
      res.status(fetchResponse.status);

      if (contentType && contentType.includes("application/json")) {
        const data = await fetchResponse.json();
        proxyApi(originalUrl.replace(domain, "/"), res, data);
      } else {
        const text = await fetchResponse.text();
        res.send(text);
      }
    } catch (err) {
      console.error("❌ Proxy error:", err.message);
      res.status(500).send("Proxy error");
    }
  });
});

// 🔌 Tạo server HTTP chung với Express (để thêm WebSocket proxy)
const server = http.createServer(app);

// 🔁 Proxy WebSocket
const wsProxy = createProxyServer({
  target: QC[DOMAINS_TYPE.SOCKET],
  changeOrigin: true,
  ws: true,
  secure: false,
});

server.on("upgrade", (req, socket, head) => {
  const fullWsUrl = `ws://${req.headers.host}${req.url}`;
  const targetWsUrl = getTargetUrl()[DOMAINS_TYPE.SOCKET];

  console.log("🔌 Proxy websocket to:", targetWsUrl);

  // Bắt lỗi để không làm sập server
  socket.on("error", (err) => {
    console.error("❌ Socket error (before proxy):", err.message);
  });

  wsProxy.ws(req, socket, head, { target: targetWsUrl });
});

// 🚀 Start server
const PORT = 4001;
server.listen(PORT, () => {
  console.log(`✅ Proxy server chạy tại http://localhost:${PORT}`);
});
