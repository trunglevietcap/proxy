const express = require("express");
const cors = require("cors");

const app = express();

const DOMAINS_TYPE = {
  TRADING: "/trading/",
  MT: "/mt/",
  WWW_QC: "/www-qc/"
};
const TARGETS = {
  [DOMAINS_TYPE.TRADING]: "https://trading-qc.vietcap.int",
  [DOMAINS_TYPE.MT]: "https://mt-qc.vietcap.int",
  [DOMAINS_TYPE.WWW_QC]: "https://www-qc.vietcap.int",
};

const DOMAINS = Object.values(DOMAINS_TYPE);

app.use(cors());
app.use(express.json());

const isModeDev = process.env.MODE === "dev";
if (isModeDev) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}
DOMAINS.forEach((domain) => {
  app.use(domain, async (req, res) => {
    const target = TARGETS[domain];
    const targetUrl = (target + req.originalUrl).replace(domain, "/");
    try {
      const fetchResponse = await fetch(targetUrl, {
        method: req.method,
        headers: {
          ...req.headers,
          host: new URL(target).host,
        },
        body: ["GET", "HEAD"].includes(req.method)
          ? undefined
          : JSON.stringify(req.body),
      });
      const contentType = fetchResponse.headers.get("content-type");
      res.status(fetchResponse.status);

      if (contentType && contentType.includes("application/json")) {
        const data = await fetchResponse.json();
        res.json(data);
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
