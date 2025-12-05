#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function remove(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
    console.log(`Removed ${path.relative(root, targetPath)}`);
  }
}

['dist', 'release-ext'].forEach((dir) => {
  remove(path.join(root, dir));
});

fs.readdirSync(root)
  .filter((file) => /^release-ext.*\.zip$/.test(file))
  .forEach((file) => remove(path.join(root, file)));
