#! /usr/bin/env node
let program = require('commander')
let package = require('../package.json')

let args = program
  .version(package.version, '-v, --version')
  .usage('zf-server-http -h -p -c')
  .option('-p, --port <n>', 'server port')
  .option('-a, --host <n>', 'server host')
  .option('-c, --cwd <n>', 'server run diraction')
  .parse(process.argv)


let config = {
  port: 3000,
  host: 'localhost',
  cwd: process.cwd()
}

Object.assign(config, args)


// 核心的功能拿到外面去写
// new一个服务根据参数
let Server = require('../src/index');
new Server(config).start();

