let http = require('http')
let fs = require('fs')
let path = require('path')
let url = require('url')
let zlib = require('zlib')
let util = require('util')
let { promisify } = util
let crypto = require('crypto')
// promise化
let stat = promisify(fs.stat);
let readdir = promisify(fs.readdir);
// 第三方的
let mime = require('mime');//getType
let ejs = require('ejs');
// color write
let chalk = require('chalk');
// 页面模板
let templateStr = fs.readFileSync(path.resolve(__dirname, '../src/index.html'), { encoding: 'utf-8' })

class Server {
  constructor(config){
    // 启动服务 根据config
    this.config = config;
    this.templateStr = templateStr;
  }
  async handleRequest(req,res){ // 处理请求的方法
    let { pathname } = url.parse(req.url)
    pathname = decodeURIComponent(pathname)
    if (pathname == '/favicon.ico') {
      res.statusCode = 404
      res.end()
      return
    }
    let realPath = path.join(this.config.cwd, pathname)
    try {
      let statObj = await stat(realPath)
      if (statObj.isDirectory()) {
        // 如果是文件夹返回列表
        let paths = await readdir(realPath)
        paths = paths.map(p => {
          return {
            path: p,
            link: `./${p}`
          }
        })
        let template = ejs.render(templateStr, { paths })
        res.setHeader('Content-Type', 'text/html;charset=utf-8')
        res.write(template)
        res.end()
      } else {
        // 如果是文件
        res.setHeader('Content-Type', `${mime.getType(realPath)};charset=utf-8`)
        this.sendFile(req, res, statObj, realPath)
      }
    } catch (e) {
      this.sendError(e)
    }
  }
  cache(req, res, statObj, realPath){
    // 设置5秒缓存
    res.setHeader('Cache-Control', 'max-age=5')
    res.setHeader('Expires', new Date(new Date() + 5 * 1000).toGMTString())
    // 设置对比缓存
    // 最后修改时间
    let ctime = statObj.ctime.toGMTString()
    // 设置最后编辑时间
    res.setHeader('Last-Modified', ctime)
    let ifModifiedSince = req.headers['if-modified-since']
    if (ifModifiedSince) {
      if (ifModifiedSince != ctime) {
        return false
      }
    } else {
      return false
    }
    let fileContent = fs.readFileSync(realPath, 'utf-8')
    let md5Str = crypto.createHash('md5').update(fileContent).digest('base64')
    res.setHeader('Etag', md5Str)
    let ifNoneMatch = req.headers['if-none-match']
    if (ifNoneMatch) {
      if (ifNoneMatch != md5Str) {
        return false
      }
    } else {
      return false
    }
    return true
  }
  compress(req, res, statObj, realPath){ // 如果可以压缩 就返回一个压缩流
    let acceptEncoding = req.headers['accept-encoding']
    if (/\bgzip\b/.test(acceptEncoding)) {
      res.setHeader('Content-Encoding', 'gzip')
      return zlib.createGzip()
    } else if (/\bdeflate\b/.test(acceptEncoding)) {
      res.setHeader('Content-Encoding', 'deflate')
      return zlib.createDeflate()
    } else {
      return null
    }
  }
  sendFile(req, res, statObj, realPath){
    if (this.cache(req, res, statObj, realPath)) {
      res.statusCode = 304
      res.end()
      return
    }
    let compressType = this.compress(req, res, statObj, realPath)
    if (compressType) {
      fs.createReadStream(realPath).pipe(compressType).pipe(res)
    } else {
      fs.createReadStream(realPath).pipe(res)
    }
  }
  sendError(err){ // 专门处理错误的方法
    console.log(util.inspect(err))
  }
  start() {
    let server = http.createServer(this.handleRequest.bind(this))
    let { port, host } = this.config
    server.listen(port, host, function () {
      console.log(`server is start：${chalk.green(`${host}:${port}`)}`)
    })
  }
}

module.exports = Server




