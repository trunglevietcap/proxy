import express from "express";
import cors from "cors";
import { onValue } from "firebase/database";
import { proxyConfigRef } from "./firebase/firebase-config.js";

export const EMPTY_TYPE = {
  EMPTY_ARRAY: "EMPTY_ARRAY",
};

const app = express();

const DOMAINS_TYPE = {
  TRADING: "/trading/",
  MT: "/mt/",
  WWW_QC: "/www-qc/",
  IQ: "/iq/",
  AI: "/ai/",
};

const KRX_INTEGRATION = {
  [DOMAINS_TYPE.TRADING]: "https://trading-krx.vietcap.int",
  [DOMAINS_TYPE.MT]: "https://trading-krx.vietcap.int",
  [DOMAINS_TYPE.WWW_QC]: "https://www-qc.vietcap.int",
  [DOMAINS_TYPE.IQ]: "https://trading-krx.vietcap.int",
  [DOMAINS_TYPE.AI]: "https://trading-krx.vietcap.int",
};

const QC = {
  [DOMAINS_TYPE.TRADING]: "https://trading-qc.vietcap.int",
  [DOMAINS_TYPE.MT]: "https://mt-qc.vietcap.int",
  [DOMAINS_TYPE.WWW_QC]: "https://www-qc.vietcap.int",
  [DOMAINS_TYPE.IQ]: "https://iq-qc.vietcap.int",
  [DOMAINS_TYPE.AI]: "https://ai-qc.vietcap.int",
};

const PRO = {
  [DOMAINS_TYPE.TRADING]: "https://trading.vietcap.com.vn",
  [DOMAINS_TYPE.MT]: "https://trading.vietcap.com.vn",
  [DOMAINS_TYPE.WWW_QC]: "https://www.vietcap.com.vn",
  [DOMAINS_TYPE.IQ]: "https://iq.vietcap.com.vn",
  [DOMAINS_TYPE.AI]: "https://ai.vietcap.int",
};

let fakeDataResponse = [
  // {
  //   targetUrl: "https://trading.vietcap.com.vn/api/chart/OHLCChart/gap",
  //   data: [],
  // },
];

onValue(proxyConfigRef, (snapshot) => {
  const proxyConfig = snapshot.val();
  if (!proxyConfig.enableFakeData) {
    fakeDataResponse = [];
  } else {
    fakeDataResponse = proxyConfig.fakeData?.map?.((item) => ({
      ...item,
      data: item.data === EMPTY_TYPE.EMPTY_ARRAY ? [] : item.data,
    }));
  }
});

const TARGETS = PRO;

const DOMAINS = Object.values(DOMAINS_TYPE);

app.use(cors());
app.use(express.json());

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

function proxyApi(targetUrl, res, data) {
  const fakeData = fakeDataResponse.find((item) => item.url === targetUrl);
  if (fakeData) {
    res.json(fakeData.data);
  } else {
    res.json(data);
  }
}

DOMAINS.forEach((domain) => {
  app.use(domain, async (req, res) => {
    const target = TARGETS[domain];
    const targetUrl = (target + req.originalUrl).replace(domain, "/");
    try {
      const fetchResponse = await fetchData(req, target, targetUrl);
      const contentType = fetchResponse.headers.get("content-type");
      res.status(fetchResponse.status);

      if (contentType && contentType.includes("application/json")) {
        const data = await fetchResponse.json();
        proxyApi(targetUrl, res, data);
      } else {
        const text = await fetchResponse.text();
        res.send(text);
      }
    } catch (err) {
      res.status(500).send("Proxy error");
    }
  });
});
const PORT = 4001;
app.listen(PORT, () => {
  console.log(`✅ Proxy server chạy tại http://localhost:${PORT}`);
});
