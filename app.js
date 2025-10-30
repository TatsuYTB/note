const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bodyParser = require("body-parser");

const DATA_DIR = path.join(__dirname, "data");
const MANIFEST = path.join(DATA_DIR, "manifest.json");
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(MANIFEST)) fs.writeFileSync(MANIFEST, JSON.stringify({}), "utf8");

const app = express();
app.use(bodyParser.json({ limit: "5mb" }));
app.use(bodyParser.urlencoded({ extended: false }));

function genId(n = 10) {
  return crypto.randomBytes(Math.ceil(n/2)).toString("hex").slice(0, n);
}

function loadManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST, "utf8") || "{}"); }
  catch (e) { return {}; }
}
function saveManifest(m) { fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2), "utf8"); }

app.post("/api/save", (req, res) => {
  try {
    let { id, content } = req.body;
    if (typeof content !== "string") return res.status(400).json({ error: "Missing content (string)." });
    if (!id || !/^[0-9a-zA-Z_-]{4,32}$/.test(id)) {
      id = genId(12);
    }
    id = id.replace(/[^0-9a-zA-Z_-]/g, "").slice(0, 32);
    const filePath = path.join(DATA_DIR, `${id}.txt`);
    fs.writeFileSync(filePath, content, "utf8");
    const manifest = loadManifest();
    manifest[id] = manifest[id] || {};
    manifest[id].updatedAt = new Date().toISOString();
    if (!manifest[id].createdAt) manifest[id].createdAt = manifest[id].updatedAt;
    saveManifest(manifest);
    const editUrl = `${BASE_URL}/edit/${id}`;
    const rawUrl = `${BASE_URL}/raw/${id}`;
    return res.json({ id, editUrl, rawUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/content/:id", (req, res) => {
  const id = String(req.params.id).replace(/[^0-9a-zA-Z_-]/g, "");
  const filePath = path.join(DATA_DIR, `${id}.txt`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Not found" });
  const raw = fs.readFileSync(filePath, "utf8");
  return res.json({ id, content: raw });
});

app.get("/raw/:id", (req, res) => {
  const id = String(req.params.id).replace(/[^0-9a-zA-Z_-]/g, "");
  const filePath = path.join(DATA_DIR, `${id}.txt`);
  if (!fs.existsSync(filePath)) return res.status(404).send("Not found");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

app.use("/static", express.static(path.join(__dirname, "public")));
app.get("/edit/:id?", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "edit.html"));
});
app.get("/rawpage/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "raw.html"));
});

app.listen(PORT, () => {
  console.log(`Online Textpad listening on ${PORT}. BASE_URL=${BASE_URL}`);
});
