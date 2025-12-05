#!/usr/bin/env node
/**
 * 构建用于静态托管 / Vercel 的 public 目录。
 * - 拷贝需要的 HTML、JS、YAML、图片和依赖
 * - 确保目录在每次构建时被重新生成
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'public');

function removeIfExists(targetPath) {
  if (fs.existsSync(targetPath)) fs.rmSync(targetPath, { recursive: true, force: true });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
  console.log(`[copy:file] ${path.relative(root, src)} -> ${path.relative(root, dest)}`);
}

function copyRecursive(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
  console.log(`[copy:dir] ${path.relative(root, src)}/ -> ${path.relative(root, dest)}/`);
}

removeIfExists(outDir);
ensureDir(outDir);

const filesToCopy = [
  'index.html',
  'options.html',
  'options.js',
  'manifest.json',
  'favicon.png',
  'start.png',
  'nav.yaml',
];

const dirsToCopy = ['css', 'dist', 'js', 'vendor'];

filesToCopy.forEach((file) => {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) return;
  copyFile(src, path.join(outDir, path.basename(file)));
});

dirsToCopy.forEach((dir) => {
  const src = path.join(root, dir);
  if (!fs.existsSync(src)) return;
  copyRecursive(src, path.join(outDir, dir));
});

console.log('public/ build completed.');
