const express = require("express");
const cors = require("cors");

const app = express();
const TARGET = "https://trading-qc.vietcap.int";

app.use(cors());
app.use(express.json());

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

app.use("/api", async (req, res) => {
  const targetUrl = TARGET + req.originalUrl;
  try {
    const fetchResponse = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...req.headers,
        host: new URL(TARGET).host,
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

const PORT = 6000;
app.listen(PORT, () => {
  console.log(`✅ Proxy server chạy tại http://localhost:${PORT} → ${TARGET}`);
});
