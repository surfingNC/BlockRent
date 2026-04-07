import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load backend/.env only for local/dev. Render injects env vars in production.
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: join(__dirname, ".env") });
}
