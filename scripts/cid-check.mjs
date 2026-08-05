#!/usr/bin/env node
/**
 * Pack SI — cid:check (genérico, KISS).
 * Uso: node scripts/cid-check.mjs
 * Opcional: CID_PROJECT_NAME="Meu App" CID_SCAN_ROOTS="src,app,packages"
 *
 * Fail: .env versionado; secrets óbvios em .env.example; chaves hardcoded em código.
 * Warn: .gitignore sem .env; padrões suspeitos.
 * Não imprime valores de secrets.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROJECT =
  process.env.CID_PROJECT_NAME?.trim() || path.basename(ROOT);

/** @typedef {"ok"|"warn"|"fail"|"skip"} Nivel */
/** @typedef {{ id: string, nivel: Nivel, titulo: string, detalhe: string }} Resultado */

/** @type {Resultado[]} */
const resultados = [];

function add(/** @type {Resultado} */ r) {
  resultados.push(r);
}

function gitLsFiles(pattern) {
  try {
    return execFileSync("git", ["ls-files", pattern], {
      cwd: ROOT,
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    return null;
  }
}

function checkEnvTracked() {
  const tracked = gitLsFiles(".env");
  if (tracked === null) {
    add({
      id: "repo-env",
      nivel: "warn",
      titulo: "Confidencialidade — .env no git",
      detalhe: "não foi possível rodar git ls-files",
    });
    return;
  }
  if (tracked.length > 0) {
    add({
      id: "repo-env",
      nivel: "fail",
      titulo: "Confidencialidade — .env no git",
      detalhe: `.env versionado (${tracked.join(", ")}); remova do índice`,
    });
    return;
  }
  const local = existsSync(path.join(ROOT, ".env"));
  add({
    id: "repo-env",
    nivel: "ok",
    titulo: "Confidencialidade — .env",
    detalhe: local
      ? "presente no disco, fora do git"
      : "sem .env na raiz (ok se só secrets remotos)",
  });
}

function checkGitignoreEnv() {
  const gi = path.join(ROOT, ".gitignore");
  if (!existsSync(gi)) {
    add({
      id: "gitignore-env",
      nivel: "warn",
      titulo: "Confidencialidade — .gitignore",
      detalhe: "arquivo ausente — adicione .env",
    });
    return;
  }
  const txt = readFileSync(gi, "utf8");
  const hasEnv =
    /(^|\/)\.env(\.|$|\s|\*)/m.test(txt) || /^\s*\.env\b/m.test(txt);
  add({
    id: "gitignore-env",
    nivel: hasEnv ? "ok" : "warn",
    titulo: "Confidencialidade — .gitignore cobre .env",
    detalhe: hasEnv ? ".env listado" : "adicione .env ao .gitignore",
  });
}

function checkEnvExample() {
  const candidates = [".env.example", ".env.sample", ".env.template"];
  let found = null;
  for (const name of candidates) {
    const p = path.join(ROOT, name);
    if (existsSync(p)) {
      found = { name, txt: readFileSync(p, "utf8") };
      break;
    }
  }
  if (!found) {
    add({
      id: "repo-example",
      nivel: "skip",
      titulo: "Confidencialidade — .env.example",
      detalhe: "ausente",
    });
    return;
  }
  const { name, txt } = found;
  // Nome da variável PRIVATE_KEY sozinho não é fail — só valor/PEM/JWT parecendo real.
  if (
    /BEGIN (RSA |EC )?PRIVATE KEY/.test(txt) ||
    /PRIVATE_KEY\s*=\s*['\"]?(0x)?[0-9a-fA-F]{64}/.test(txt) ||
    /SERVICE_ROLE\s*=\s*['\"]?[A-Za-z0-9_\-/+=]{20,}/.test(txt) ||
    /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./.test(txt) ||
    /(?:api[_-]?key|secret|password|token)\s*=\s*['\"]?[A-Za-z0-9_\-/+=]{24,}/i.test(
      txt
    )
  ) {
    add({
      id: "repo-example",
      nivel: "fail",
      titulo: `Confidencialidade — ${name}`,
      detalhe: "parece conter secret/token real",
    });
  } else {
    add({
      id: "repo-example",
      nivel: "ok",
      titulo: `Confidencialidade — ${name}`,
      detalhe: "sem secrets óbvios",
    });
  }
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".expo",
  "coverage",
  "android",
  "ios",
  ".gradle",
  "vendor",
]);

const CODE_EXT = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".kt",
  ".kts",
  ".py",
  ".dart",
  ".java",
  ".go",
]);

/** Padrões que costumam ser secrets reais (não placeholders). */
const SECRET_PATTERNS = [
  {
    id: "aws-key",
    re: /AKIA[0-9A-Z]{16}/,
    titulo: "possível AWS Access Key",
  },
  {
    id: "private-pem",
    re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    titulo: "chave privada PEM",
  },
  {
    id: "jwt-hardcoded",
    re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    titulo: "JWT hardcoded",
  },
  {
    id: "sk-live",
    re: /sk_live_[A-Za-z0-9]{16,}/,
    titulo: "Stripe sk_live",
  },
  {
    id: "gh-pat",
    re: /ghp_[A-Za-z0-9]{36}/,
    titulo: "GitHub PAT",
  },
];

function walkFiles(dir, out, maxFiles = 4000) {
  if (out.length >= maxFiles) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (out.length >= maxFiles) return;
    if (ent.name.startsWith(".") && ent.name !== ".env.example") continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walkFiles(full, out, maxFiles);
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name);
      if (CODE_EXT.has(ext)) out.push(full);
    }
  }
}

function checkHardcodedSecrets() {
  const rootsEnv = process.env.CID_SCAN_ROOTS?.trim();
  const roots = rootsEnv
    ? rootsEnv.split(",").map((s) => s.trim()).filter(Boolean)
    : ["src", "app", "apps", "packages", "services", "functions", "lib"].filter(
        (d) => existsSync(path.join(ROOT, d))
      );

  if (roots.length === 0) {
    // scan shallow at root for small projects
    try {
      for (const ent of readdirSync(ROOT, { withFileTypes: true })) {
        if (ent.isFile() && CODE_EXT.has(path.extname(ent.name))) {
          roots.push(".");
          break;
        }
      }
    } catch {
      /* ignore */
    }
  }

  /** @type {string[]} */
  const files = [];
  for (const r of roots) {
    const abs = path.join(ROOT, r);
    if (!existsSync(abs)) continue;
    const st = statSync(abs);
    if (st.isFile()) files.push(abs);
    else walkFiles(abs, files);
  }

  /** @type {{ id: string, file: string }[]} */
  const hits = [];
  for (const file of files) {
    let txt;
    try {
      txt = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    // ignore this script and test fixtures with obvious fakes
    if (file.includes("cid-check")) continue;
    if (/fake\.signature|placeholder|YOUR[_-]?SECRET|example\.com/i.test(txt) &&
        !/AKIA[0-9A-Z]{16}|-----BEGIN/.test(txt)) {
      // still scan PEM/AWS; skip soft patterns below via continue only for jwt in tests
    }
    for (const p of SECRET_PATTERNS) {
      if (p.re.test(txt)) {
        // allow intentional fake JWT probe strings
        if (
          p.id === "jwt-hardcoded" &&
          /fake\.signature|cid-check-probe|eyJhbGciOiJub25lIn0\.fake/.test(txt)
        ) {
          continue;
        }
        hits.push({
          id: p.id,
          file: path.relative(ROOT, file),
        });
        break;
      }
    }
  }

  if (hits.length === 0) {
    add({
      id: "hardcoded",
      nivel: "ok",
      titulo: "Confidencialidade — secrets no código",
      detalhe: `nenhum padrão crítico em ${files.length} arquivo(s)`,
    });
    return;
  }

  const sample = hits
    .slice(0, 5)
    .map((h) => `${h.file} (${h.id})`)
    .join("; ");
  add({
    id: "hardcoded",
    nivel: "fail",
    titulo: "Confidencialidade — secrets no código",
    detalhe: `${hits.length} hit(s): ${sample}`,
  });
}

function printReport() {
  const icon = { ok: "✓", warn: "⚠", fail: "✗", skip: "·" };
  console.log(`\n=== Pack SI — cid:check (${PROJECT}) ===\n`);
  console.log("Escopo: .env no git, .gitignore, .env.example, padrões de secret\n");

  for (const r of resultados) {
    console.log(`${icon[r.nivel]} [${r.nivel.toUpperCase()}] ${r.titulo}`);
    console.log(`    ${r.detalhe}`);
  }

  const fails = resultados.filter((r) => r.nivel === "fail").length;
  const warns = resultados.filter((r) => r.nivel === "warn").length;
  const skips = resultados.filter((r) => r.nivel === "skip").length;
  console.log("\n---");
  console.log(
    `Resumo: ${fails} fail · ${warns} warn · ${skips} skip · ${resultados.length} checks`
  );
  console.log("BD: npm run db:check (se existir) · docs/comandos-testes.md\n");

  if (fails > 0) process.exitCode = 1;
}

function main() {
  console.log("cid:check (pack SI) — iniciando…");
  checkEnvTracked();
  checkGitignoreEnv();
  checkEnvExample();
  checkHardcodedSecrets();
  printReport();
}

main();
