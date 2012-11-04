#!/usr/bin/env node
/*jshint node:true loopfunc:true */

var fs = require('fs')
  , util = require('util')
  , path = require('path')
  , yaml = require('js-yaml')
  , mkdirp = require('mkdirp')
  , difflib = require('difflib')
  , cp = require('child_process')

  , notify = require('./lib/event')()
  , logger = Object.create(console)
  , PATH_STATIC = '.statictmp/'
  , cwd = process.cwd()

cp.exec = (function(fn) {
  var self = this, fuid = 0
  return function(command) {
    var eid = 'callback' + fuid++
    fn.call(self, command, function(err) {
      notify[err ? 'reject' : 'resolve'](eid, arguments)
    })
    return notify.promise(eid)
  }
})(cp.exec.bind(cp))

function makeTmpDir() {
  fs.existsSync(PATH_STATIC, function(exists) {
    if (exists) { return }
    fs.mkdir(PATH_STATIC)
  })
}

function getGitPath(url) {
  return PATH_STATIC + path.basename(url.trim(), '.git')
}

function getConfig(cb) {
  var CONF_FILE = 'static.yaml'
  fs.readFile(CONF_FILE, 'utf8', function(err, data) {
    if (!err) { return cb(data) }
    return logger.error('\033[31m', "There's no `"
      + CONF_FILE + "` in your app root directory.", '\033[0m')
  })
}

function outputs(err, stdout, stderr) {
  logger.info(stdout.split('\n')[0])
}

function copy(src, dst, cb) {
  function copyHelper(err) {
    var is, os
    fs.stat(src, function (err, stat) {
      if (err) { return cb(err) }
      is = fs.createReadStream(src)
      os = fs.createWriteStream(dst)

      util.pump(is, os, function(err) {
        if (err) { return cb(err) }
        fs.utimes(dst, stat.atime, stat.mtime, cb)
      })
    })
  }

  cb = cb || function(){}
  fs.stat(dst, copyHelper)
}

function copyFile(src, dst, cb) {
  var sep = path.sep
    , pathArr = dst.split(sep)

  if (!fs.existsSync(dst)) {
    mkdirp.sync(!pathArr.slice(-1)[0]
      ? dst : pathArr.slice(0, -1).join(sep))
  }

  if (fs.statSync(src).isFile()) {
    var dstIsDir = dst.substr(-1) === sep
      , dstFile = dstIsDir ? dst + src.split(sep).slice(-1)[0] : dst

    if (!coverFile(src, dstFile)) {
      return logger.info('`' + dstFile + '`'
        , 'has been modified in local. Ignored automatically.')
    }
    copy(src, dstFile)
  } else if (fs.statSync(src).isDirectory()) {
    fs.readdirSync(src).forEach(function(name) {
      var srcPath = [src, name].join(sep)
        , isDir = fs.statSync(srcPath).isDirectory()
      copyFile(srcPath, isDir ? dst + name + sep : dst)
    })
  }

  logger.info(' \033[30m', src
    , '\033[0m->\033[30m', dst, '\033[0m')
}

function coverFile(src, dstFile) {
  if (!fs.existsSync(dstFile)) { return true }
  return !localModified(src, dstFile)
}

function copy2app(repoName, files) {
  logger.info('Starting to copy files...')
  for (var src in files) {
    copyFile(PATH_STATIC + repoName + src
      , files[src].slice(1))
  }
}

function clone(url, path) {
  return cp
    .exec(['git clone', url, path].join(' '))
    .done(outputs)
}

function pulldown(name) {
  process.chdir(PATH_STATIC + name)
  return cp.exec('git pull')
    .done(function(err, stdout) {
      logger.log('`' + name + '`'
        , stdout.split('\n')[0])
      process.chdir(cwd)
    })
}

function reset(name, commit) {
  process.chdir(PATH_STATIC + name)
  return cp.exec('git reset --hard ' + commit)
}

function getMtime(file) {
  return (new Date(fs.statSync(file).mtime)).getTime()
}

function localModified(src, dst) {
  var srcStr = fs.readFileSync(src, 'UTF-8')
    , dstStr = fs.readFileSync(dst, 'UTF-8')
    , diffRatio = (new difflib
      .SequenceMatcher(null, srcStr, dstStr))
      .quickRatio()

  return getMtime(dst) > getMtime(src)
    && diffRatio !== 1
}

function pull() {
  makeTmpDir()
  getConfig(function(data) {
    var commit, tag, files
      , repo, repoUrl, repoPath
      , conf = yaml.load(data)
      , repos = conf.repos

    for (var name in repos) {
      (function(name) {
        repo = repos[name]
        repoUrl = 'url' in repo
          ? repo.url
          : repoUrl = 'http://code.dapps.douban.com/{name}.git'
              .replace('{name}', name)

        repoPath = getGitPath(repoUrl)

        function hasCloned(repo) {
          process.chdir(cwd)
          return fs.existsSync(repo)
        }

        function pulling() {
          repo = repos[name]
          files = repo.file || {}
          commit = repo.tag || repo.commit

          if (!commit) {
            pulldown(name).done(function() {
              copy2app(name, repos[name].file)
            })
          } else {
            reset(name, commit).done(function() {
              process.chdir(cwd)
              logger.info('HEAD is now at', commit)
              copy2app(name, repos[name].file)
            })
          }
        }
        
        if (hasCloned(repoPath)) {
          return pulling(name)
        }

        clone(repoUrl, repoPath)
          .done(function() { pulling(name) })

      })(name)
    }
  })
}

exports.pull = pull
exports.version = '0.1.7'
