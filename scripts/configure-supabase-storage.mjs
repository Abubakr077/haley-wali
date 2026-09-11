import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = join(root, "node_modules", ".bin", "wrangler");
const env = {
  ...process.env,
  XDG_CONFIG_HOME: join(root, ".wrangler", "config"),
  WRANGLER_LOG_PATH: join(root, ".wrangler", "deploy.log"),
};

function run(args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(wrangler, args, { cwd: root, env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolveRun() : reject(new Error(`wrangler ${args.join(" ")} exited with code ${code}`)));
  });
}

console.log("\nConfigure the existing Haley Wali manager Worker for Supabase Storage.");
console.log("Wrangler hides each value while you paste it. Do not put these values in a source file.\n");

for (const [name, guidance] of [
  ["SUPABASE_URL", "Paste the Project URL, for example https://abc.supabase.co"],
  ["SUPABASE_SECRET_KEY", "Paste the server-side sb_secret_ key (legacy service_role JWT also works; never use a publishable key)"],
  ["SUPABASE_STORAGE_BUCKET", "Paste the public bucket name, recommended: haley-wali-articles"],
]) {
  console.log(`${guidance}:`);
  await run(["secret", "put", name, "--config", "wrangler.jsonc"]);
}

console.log("\nSupabase Storage secrets saved. You can now run npm run deploy:cloudflare:update.");
