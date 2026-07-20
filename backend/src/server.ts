// Load .env before any other import so env-driven modules (jwt secret,
// google client id, port) see the values at module-eval time.
import "dotenv/config";
import app from "./app";

const PORT = process.env.PORT
  ? Number.isFinite(Number(process.env.PORT))
    ? Number(process.env.PORT)
    : 3000
  : 3000;

app.listen(PORT, () => {
  console.log(`Posts API running on http://localhost:${PORT}`);
});
