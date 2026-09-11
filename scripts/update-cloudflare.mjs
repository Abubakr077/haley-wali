import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = join(root, "node_modules", ".bin", "wrangler");
const vinext = join(root, "node_modules", ".bin", "vinext");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const deploymentPath = join(root, ".wrangler", "last-deployment.json");
const databaseName = "haley-wali-production";
const managerUrl = "https://manager.haleywali.pk";
const storefrontUrl = "https://haleywali.pk";
const cloudflareEnv = {
  ...process.env,
  XDG_CONFIG_HOME: join(root, ".wrangler", "config"),
  WRANGLER_LOG_PATH: join(root, ".wrangler", "deploy.log"),
};

function run(command, args, options = {}) {
  const { capture = false, env = cloudflareEnv } = options;
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    if (capture) {
      child.stdout.on("data", (chunk) => {
        const output = chunk.toString();
        stdout += output;
        process.stdout.write(output);
      });
      child.stderr.on("data", (chunk) => {
        const output = chunk.toString();
        stderr += output;
        process.stderr.write(output);
      });
    }
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolveRun({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function catalogCounts() {
  const query = [
    "SELECT",
    "(SELECT COUNT(*) FROM manual_products) AS manual_articles,",
    "(SELECT COUNT(*) FROM catalog_products) AS imported_articles,",
    "(SELECT COUNT(*) FROM orders) AS orders;",
  ].join(" ");
  const result = await run(wrangler, [
    "d1", "execute", databaseName,
    "--remote", "--config", "wrangler.jsonc",
    "--command", query, "--json",
  ], { capture: true });
  const payload = JSON.parse(result.stdout);
  const row = payload?.[0]?.results?.[0];
  if (!row) throw new Error("Could not read production record counts from D1.");
  return {
    manualArticles: Number(row.manual_articles),
    importedArticles: Number(row.imported_articles),
    orders: Number(row.orders),
  };
}

function assertPreserved(before, after) {
  for (const key of Object.keys(before)) {
    if (before[key] !== after[key]) {
      throw new Error(
        `Production data check failed: ${key} changed from ${before[key]} to ${after[key]}.`,
      );
    }
  }
}

let storedDeployment = {};
try {
  storedDeployment = JSON.parse(await readFile(deploymentPath, "utf8"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const { articleImageBucketName: _legacyImageBucket, ...previousDeployment } = storedDeployment;

console.log("\n1/7 Verifying Cloudflare login...");
await run(wrangler, ["whoami"]);

const secretResult = await run(wrangler, ["secret", "list", "--config", "wrangler.jsonc", "--format", "json"], { capture: true });
const configuredSecrets = new Set(JSON.parse(secretResult.stdout).map((secret) => secret.name));
for (const name of ["SUPABASE_URL", "SUPABASE_STORAGE_BUCKET"]) {
  if (!configuredSecrets.has(name)) {
    throw new Error(`Missing ${name}. Run npm run configure:supabase-storage before deployment.`);
  }
}
if (!configuredSecrets.has("SUPABASE_SECRET_KEY") && !configuredSecrets.has("SUPABASE_SERVICE_ROLE_KEY")) {
  throw new Error("Missing SUPABASE_SECRET_KEY. Run npm run configure:supabase-storage before deployment.");
}

console.log("\n2/7 Recording production data counts before deployment...");
const before = await catalogCounts();
console.log("Production records before deployment:", before);

console.log("\n3/7 Applying forward-only D1 migrations...");
await run(wrangler, [
  "d1", "migrations", "apply", databaseName,
  "--remote", "--config", "wrangler.jsonc",
]);

console.log("\n4/7 Deploying Store Manager and API without changing secrets...");
await run(vinext, ["deploy"], {
  env: {
    ...cloudflareEnv,
    HALEY_WALI_PRODUCTION_BUILD: "1",
    NEXT_PUBLIC_STOREFRONT_URL: storefrontUrl,
  },
});

console.log("\n5/7 Building and deploying the customer storefront...");
await run(npm, ["run", "build:storefront"], {
  env: {
    ...cloudflareEnv,
    PUBLIC_CATALOG_API_BASE: managerUrl,
  },
});
await run(wrangler, [
  "deploy", "--config", "apps/storefront/wrangler.jsonc",
]);

console.log("\n6/7 Confirming production records were preserved...");
const after = await catalogCounts();
console.log("Production records after deployment:", after);
assertPreserved(before, after);

console.log("\n7/7 Saving the deployment record...");
await mkdir(dirname(deploymentPath), { recursive: true });
await writeFile(deploymentPath, `${JSON.stringify({
  ...previousDeployment,
  deployedAt: new Date().toISOString(),
  managerUrl,
  storefrontUrl,
  databaseName,
}, null, 2)}\n`);

console.log("\nHaley Wali code update completed without deleting production records:");
console.log(`Customer shop: ${storefrontUrl}`);
console.log(`Store Manager: ${managerUrl}`);
