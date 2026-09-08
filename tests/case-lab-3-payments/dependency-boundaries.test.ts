import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import test from "node:test";
import * as ts from "typescript";

const expectedScripts = {
  test: "node --test tests/*.test.mjs && npm run test:case-lab-3-payments",
  "test:case-lab-3-payments": "tsx --test tests/case-lab-3-payments/**/*.test.ts",
  "test:case-lab-3-db": "node scripts/run-case-lab-3-db.mjs",
};

const expectedRuntimeDependencies = {
  nodemailer: "^10.0.1",
  pdfkit: "^0.20.2",
  qrcode: "^1.5.4",
  "@zxing/browser": "^0.2.1",
};

const expectedDevelopmentDependencies = {
  "@types/nodemailer": "^8.0.1",
  "@types/pdfkit": "^0.17.6",
  "@types/qrcode": "^1.5.6",
  tsx: "^4.23.13",
  supabase: "^2.116.0",
};

const sourceExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const serverOnlyPackages = new Set(["nodemailer", "pdfkit", "qrcode"]);

type StaticDependency = {
  kind: "import" | "re-export" | "require";
  specifier: string;
};

type SourceFileInput = {
  path: string;
  source: string;
};

type SourceFixture = SourceFileInput & {
  name: string;
  expectedViolationCount: number;
};

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const files: string[] = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(path)));
    } else if (entry.isFile() && sourceExtensions.has(path.slice(path.lastIndexOf(".")))) {
      files.push(path);
    }
  }

  return files.sort();
}

function repositoryPath(path: string): string {
  return relative(process.cwd(), path).split(sep).join("/");
}

function scriptKindFor(path: string): ts.ScriptKind {
  switch (path.slice(path.lastIndexOf("."))) {
    case ".js":
    case ".mjs":
    case ".cjs":
      return ts.ScriptKind.JS;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".tsx":
      return ts.ScriptKind.TSX;
    default:
      return ts.ScriptKind.TS;
  }
}

function isRuntimeImport(node: ts.ImportDeclaration): boolean {
  const importClause = node.importClause;
  if (!importClause) {
    return true;
  }
  if (importClause.isTypeOnly) {
    return false;
  }
  if (importClause.name) {
    return true;
  }

  const namedBindings = importClause.namedBindings;
  if (!namedBindings) {
    return false;
  }
  if (ts.isNamespaceImport(namedBindings)) {
    return true;
  }
  return namedBindings.elements.length === 0 || namedBindings.elements.some((element) => !element.isTypeOnly);
}

function isRuntimeReExport(node: ts.ExportDeclaration): boolean {
  if (node.isTypeOnly) {
    return false;
  }
  if (!node.exportClause) {
    return true;
  }
  if (ts.isNamedExports(node.exportClause)) {
    return node.exportClause.elements.length === 0 || node.exportClause.elements.some((element) => !element.isTypeOnly);
  }
  return true;
}

function collectStaticDependencies(sourceFile: ts.SourceFile): StaticDependency[] {
  const dependencies: StaticDependency[] = [];

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && isRuntimeImport(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      dependencies.push({ kind: "import", specifier: statement.moduleSpecifier.text });
    }
    if (ts.isExportDeclaration(statement) && isRuntimeReExport(statement) && statement.moduleSpecifier) {
      if (ts.isStringLiteral(statement.moduleSpecifier)) {
        dependencies.push({ kind: "re-export", specifier: statement.moduleSpecifier.text });
      }
    }
  }

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "require") {
      const [argument] = node.arguments;
      if (node.arguments.length === 1 && argument && ts.isStringLiteralLike(argument)) {
        dependencies.push({ kind: "require", specifier: argument.text });
      }
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);
  return dependencies;
}

function hasTopLevelUseClientDirective(sourceFile: ts.SourceFile): boolean {
  for (const statement of sourceFile.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) {
      return false;
    }
    if (statement.expression.text === "use client") {
      return true;
    }
  }
  return false;
}

function matchesPackage(specifier: string, packageName: string): boolean {
  return specifier === packageName || specifier.startsWith(`${packageName}/`);
}

function analyzeSourceFiles(files: readonly SourceFileInput[]): string[] {
  const violations: string[] = [];

  for (const { path, source } of files) {
    const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, scriptKindFor(path));
    const dependencies = collectStaticDependencies(sourceFile);
    const isClientModule = hasTopLevelUseClientDirective(sourceFile);

    for (const dependency of dependencies) {
      if (matchesPackage(dependency.specifier, "@zxing/browser")) {
        if (!path.startsWith("app/crm/check-in/")) {
          violations.push(
            `${path}: ${dependency.kind} of ${dependency.specifier} is only allowed below app/crm/check-in/`,
          );
        }
        continue;
      }

      const serverOnlyPackage = [...serverOnlyPackages].find((packageName) =>
        matchesPackage(dependency.specifier, packageName),
      );
      if (serverOnlyPackage && isClientModule) {
        violations.push(
          `${path}: ${dependency.kind} of ${dependency.specifier} must not be in a client module`,
        );
      }
    }
  }

  return violations;
}

test("payment scripts and approved dependencies are declared exactly", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    scripts?: Record<string, unknown>;
    dependencies?: Record<string, unknown>;
    devDependencies?: Record<string, unknown>;
  };
  const scripts = packageJson.scripts ?? {};
  const dependencies = packageJson.dependencies ?? {};
  const developmentDependencies = packageJson.devDependencies ?? {};

  for (const [name, value] of Object.entries(expectedScripts)) {
    assert.equal(scripts[name], value, `script ${name} must stay exact`);
  }

  for (const [name, value] of Object.entries(expectedRuntimeDependencies)) {
    assert.equal(dependencies[name], value, `runtime dependency ${name} must stay exact`);
    assert.equal(developmentDependencies[name], undefined, `${name} must not be a development dependency`);
  }

  for (const [name, value] of Object.entries(expectedDevelopmentDependencies)) {
    assert.equal(developmentDependencies[name], value, `development dependency ${name} must stay exact`);
    assert.equal(dependencies[name], undefined, `${name} must not be a runtime dependency`);
  }
});

test("payment imports stay in their intended source boundaries", async () => {
  const sourceFiles = await collectSourceFiles(resolve("app"));
  const files = await Promise.all(
    sourceFiles.map(async (file) => ({
      path: repositoryPath(file),
      source: await readFile(file, "utf8"),
    })),
  );

  assert.deepEqual(analyzeSourceFiles(files), [], "approved package boundary violations found in app source");
});

const sourceFixtures: SourceFixture[] = [
  {
    name: "type-only imports and re-exports are ignored",
    path: "app/components/payment-types.tsx",
    source: `
      "use client";
      import type { Transporter } from "nodemailer";
      import { type PDFDocument } from "pdfkit";
      export type { QRCode } from "qrcode";
      export { type MailOptions } from "nodemailer";
    `,
    expectedViolationCount: 0,
  },
  {
    name: "runtime imports are analyzed",
    path: "app/components/runtime-mail.tsx",
    source: `
      "use client";
      import mailer from "nodemailer";
    `,
    expectedViolationCount: 1,
  },
  {
    name: "empty named imports are runtime imports",
    path: "app/components/empty-import.tsx",
    source: `
      "use client";
      import {} from "nodemailer";
    `,
    expectedViolationCount: 1,
  },
  {
    name: "empty named re-exports are runtime re-exports",
    path: "app/components/empty-export.ts",
    source: `
      "use client";
      export {} from "pdfkit";
    `,
    expectedViolationCount: 1,
  },
  {
    name: "package subpaths are analyzed",
    path: "app/components/payment-subpath.tsx",
    source: `
      "use client";
      import "qrcode/lib/renderer";
      export {} from "pdfkit/lib/document";
    `,
    expectedViolationCount: 2,
  },
  {
    name: "static require calls are analyzed",
    path: "app/components/payment-require.ts",
    source: `
      "use client";
      const mailer = require("nodemailer/transports");
    `,
    expectedViolationCount: 1,
  },
  {
    name: "server-only packages are rejected in client modules",
    path: "app/components/payment-client.tsx",
    source: `
      "use client";
      import "nodemailer";
      import "pdfkit";
      import "qrcode";
    `,
    expectedViolationCount: 3,
  },
  {
    name: "normal app modules are server-side by default",
    path: "app/case-lab-3/order/page.tsx",
    source: `
      import mailer from "nodemailer";
      export { default as PDFDocument } from "pdfkit";
      const qrcode = require("qrcode");
    `,
    expectedViolationCount: 0,
  },
  {
    name: "ZXing is allowed below the check-in path",
    path: "app/crm/check-in/Scanner.tsx",
    source: `
      "use client";
      import { BrowserMultiFormatReader } from "@zxing/browser/browser";
    `,
    expectedViolationCount: 0,
  },
  {
    name: "ZXing is restricted outside the check-in path",
    path: "app/crm/Scanner.tsx",
    source: `
      "use client";
      import { BrowserMultiFormatReader } from "@zxing/browser";
    `,
    expectedViolationCount: 1,
  },
];

test("AST analyzer covers deterministic import-boundary fixtures", () => {
  for (const fixture of sourceFixtures) {
    const violations = analyzeSourceFiles([fixture]);
    assert.equal(
      violations.length,
      fixture.expectedViolationCount,
      `${fixture.name}: ${violations.join("\n")}`,
    );
  }
});
