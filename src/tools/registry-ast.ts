import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * Detect top-level `registry.register(...)` call statements in a tool module.
 *
 * Uses the TypeScript compiler (not acorn): these files are TypeScript, which
 * a plain JS parser cannot read — acorn fails on the first type annotation
 * and the failure was silently swallowed, disabling discovery entirely.
 */
function isRegistryRegisterCall(node: ts.Expression): boolean {
  if (!ts.isCallExpression(node)) return false;
  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee)) return false;
  if (!ts.isIdentifier(callee.expression) || callee.expression.text !== 'registry') return false;
  return ts.isIdentifier(callee.name) && callee.name.text === 'register';
}

function moduleRegistersTools(source: string): boolean {
  const ast = ts.createSourceFile('tool.ts', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  for (const node of ast.statements) {
    if (ts.isExpressionStatement(node) && isRegistryRegisterCall(node.expression)) {
      return true;
    }
  }
  return false;
}

export function discoverBuiltinTools(toolsDir: string): string[] {
  if (!fs.existsSync(toolsDir)) return [];

  const files = fs.readdirSync(toolsDir).filter(f =>
    f.endsWith('.ts') && !['index.ts', 'registry-types.ts', 'tool-availability-cache.ts', 'registry-ast.ts'].includes(f)
  );

  const discovered: string[] = [];
  for (const file of files) {
    const fullPath = path.join(toolsDir, file);
    const source = fs.readFileSync(fullPath, 'utf-8');
    if (moduleRegistersTools(source)) {
      discovered.push(file.replace('.ts', ''));
    }
  }
  return discovered;
}
