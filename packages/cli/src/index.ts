#!/usr/bin/env node

import { program } from 'commander';
import startServer from '@vuensight/app';

program
    .description('Vue Component Insight CLI')
<<<<<<< HEAD
    .option('-d, --dir [dir]', 'specify the directory that should be analyzed', 'src')
    .option('-p, --port [port]', 'start the application in a different port (default is 4444)', 'src')
=======
    .option('-d, --dir [dir]', 'specify the directory that should be analyzed (default is src)', 'src')
    .option('-p, --port [port]', 'start the application in a different port (default is 4444)')
>>>>>>> upstream/main
    .option('-wpc, --webpack-config [webpackConfig]', 'path to webpack config file')
    .option('-tsc, --ts-config [tsConfig]', 'path to TypeScript config file')
    .parse();

const dir = program.opts().dir;
const port = program.opts().port;
const webpackConfig = program.opts().webpackConfig;
const tsConfig = program.opts().tsConfig;

const init = async () => {
  try {
<<<<<<< HEAD
    await startServer(dir, webpackConfig, tsConfig, port);
=======
      await startServer(dir, port, webpackConfig, tsConfig);
>>>>>>> upstream/main
  } catch (e) {
    console.error('Something went wrong parsing the project', e);
  }
};

init();

