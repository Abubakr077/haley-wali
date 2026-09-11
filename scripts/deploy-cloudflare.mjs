import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wranglerConfigPath = join(root, "wrangler.jsonc");
const wrangler = join(root, "node_modules", ".bin", "wrangler");
const vinext = join(root, "node_modules", ".bin", "vinext");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const node = process.execPath;
const databaseName = "haley-wali-production";
const managerUrl = "https://manager.haleywali.pk";
const storefrontUrl = "https://haleywali.pk";
const cloudflareEnv = {
  ...process.env,
  XDG_CONFIG_HOME: join(root, ".wrangler", "config"),
  WRANGLER_LOG_PATH: join(root, ".wrangler", "deploy.log"),
};
const productionEnv = {
  ...cloudflareEnv,
  HALEY_WALI_PRODUCTION_BUILD: "1",
};

function run(command, args, options = {}) {
  const { capture = false, env = cloudflareEnv, input } = options;
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: capture ? [input ? "pipe" : "inherit", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    if (capture) {
      child.stdout.on("data", (chunk) => {
        const text = chunk.toString();
        stdout += text;
        process.stdout.write(text);
      });
      child.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        stderr += text;
        process.stderr.write(text);
      });
      if (input) child.stdin.end(input);
    }
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolveRun({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function wranglerJson(args) {
  const child = spawn(wrangler, args, {
    cwd: root,
    env: cloudflareEnv,
    stdio: ["ignore", "pipe", "inherit"],
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  const code = await new Promise((resolveExit, reject) => {
    child.on("error", reject);
    child.on("exit", resolveExit);
  });
  if (code !== 0) throw new Error(`Wrangler exited with code ${code}.`);
  return JSON.parse(stdout);
}

async function updateManagerConfig(databaseId) {
  const config = JSON.parse(await readFile(wranglerConfigPath, "utf8"));
  config.d1_databases = [
    {
      binding: "DB",
      database_name: databaseName,
      database_id: databaseId,
      migrations_dir: "drizzle",
    },
  ];
  delete config.r2_buckets;
  config.vars = {
    ...(config.vars ?? {}),
    PUBLIC_STOREFRONT_ORIGIN: [
      "https://haleywali.pk",
      "https://www.haleywali.pk",
    ].join(","),
  };
  await writeFile(wranglerConfigPath, `${JSON.stringify(config, null, 2)}\n`);
}

console.log("\n1/8 Verifying Cloudflare login...");
await run(wrangler, ["whoami"]);

console.log("\n2/8 Preparing the empty production D1 database...");
let databases = await wranglerJson(["d1", "list", "--json"]);
let database = databases.find((entry) => entry.name === databaseName);
if (!database) {
  await run(wrangler, ["d1", "create", databaseName, "--location", "apac"]);
  databases = await wranglerJson(["d1", "list", "--json"]);
  database = databases.find((entry) => entry.name === databaseName);
}
const databaseId = database?.uuid ?? database?.id;
if (!databaseId) throw new Error("Could not find the production D1 database ID.");
await updateManagerConfig(databaseId);

console.log("\n3/8 Applying D1 migrations...");
await run(wrangler, [
  "d1", "migrations", "apply", databaseName,
  "--remote", "--config", "wrangler.jsonc",
]);

console.log("\n4/8 Deploying Store Manager and API...");
await run(vinext, ["deploy"], {
  env: productionEnv,
});

console.log("\n5/8 Configuring Store Manager security...");
const sessionSecret = randomBytes(48).toString("hex");
await run(wrangler, ["secret", "put", "ADMIN_SESSION_SECRET", "--config", "wrangler.jsonc"], {
  capture: true,
  input: `${sessionSecret}\n`,
});
console.log("Enter a strong Store Manager password at the hidden prompt below.");
await run(wrangler, ["secret", "put", "ADMIN_PASSWORD", "--config", "wrangler.jsonc"]);
console.log("\nConfigure Supabase Storage for article images.");
await run(node, [join(root, "scripts", "configure-supabase-storage.mjs")]);

console.log("\n6/8 Building and deploying the customer storefront...");
await run(npm, ["run", "build:storefront"], {
  env: { ...cloudflareEnv, PUBLIC_CATALOG_API_BASE: managerUrl },
});
await run(wrangler, [
  "deploy", "--config", "apps/storefront/wrangler.jsonc",
]);

console.log("\n7/8 Connecting the two Workers...");
await updateManagerConfig(databaseId);
await run(vinext, ["deploy"], {
  env: { ...productionEnv, NEXT_PUBLIC_STOREFRONT_URL: storefrontUrl },
});

console.log("\n8/8 Confirming the production catalog is empty...");
await run(wrangler, [
  "d1", "execute", databaseName, "--remote", "--config", "wrangler.jsonc",
  "--command", "SELECT COUNT(*) AS article_count FROM manual_products; SELECT COUNT(*) AS imported_count FROM catalog_products;",
]);

const deployment = {
  deployedAt: new Date().toISOString(),
  managerUrl,
  storefrontUrl,
  databaseName,
  databaseId,
};
await writeFile(
  join(root, ".wrangler", "last-deployment.json"),
  `${JSON.stringify(deployment, null, 2)}\n`,
);

console.log("\nHaley Wali is deployed on Cloudflare:");
console.log(`Customer shop: ${storefrontUrl}`);
console.log(`Store Manager: ${managerUrl}`);
console.log("The production catalog contains no articles until you publish one from Store Manager.");
