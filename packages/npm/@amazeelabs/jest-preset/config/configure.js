#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question(`Please make sure you ran this command from your project root!
This command will add/adjust files in your project root. Please use VCS to track changes.
Ready? (y/n): `, function (answer) {
  if (answer.trim() === 'y') {
    tasks.copyFiles();
    tasks.adjustFiles();
    console.log('Done! Please check the changes.');
  } else {
    console.log('See you next time.');
  }
  rl.close();
});

const data = {
  paths: {
    projectRoot: process.env.PWD,
    files: path.join(__dirname, 'files'),
  },
  version: process.argv[2] || 'base', // e.g. "react"
};

const tasks = {
  copyFiles: () => {
    utils.copyFiles(path.join(data.paths.files, 'base'));
    if (data.version !== 'base') {
      utils.copyFiles(path.join(data.paths.files, data.version));
    }
  },

  adjustFiles: () => {
    utils.adjustPackageJson(path.join(data.paths.projectRoot, 'package.json'));
  },
};

const utils = {
  copyFiles: (dirpath) => {
    for (const file of fs.readdirSync(dirpath)) {
      const scr = path.join(dirpath, file);
      const dest = path.join(data.paths.projectRoot, file);
      fs.copyFileSync(scr, dest);
    }
  },

  adjustPackageJson: (filepath) => {
    const contents = fs.readFileSync(filepath, 'utf8');
    const json = JSON.parse(contents);
    if (!json.scripts) {
      json.scripts = {};
    }
    json.scripts['test:ci'] = 'jest';
    json.scripts['test:watch'] = 'jest --watch';
    json.scripts['test'] = 'is-ci test:ci test:watch';
    fs.writeFileSync(filepath, JSON.stringify(json, null, 2));
  },
};
