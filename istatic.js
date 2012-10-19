#!/usr/bin/env node
/*jshint node:true */

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
      , dstFile = dstIsDir ? dst + src.split(sep).slice(-1)[0]
                           : dst

    if (fs.existsSync(dstFile)
      && diffRatio(src, dstFile) !== 1) {
      // TODO Using `readlines` to deal with status
      return logger.info('`' + dstFile + '`'
        , 'has been modified in local. Ignord automatically.')
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

function copy2app(repoName, files) {
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
  return cp
    .exec('git reset --hard ' + commit)
    .done(function() {
      process.chdir(cwd)
    })
}

function diffRatio(src, dst) {
  src = fs.readFileSync(src, 'UTF-8')
  dst = fs.readFileSync(dst, 'UTF-8')
  return (new difflib
    .SequenceMatcher(null, src, dst))
    .quickRatio()
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

        if (fs.existsSync(repoPath)) {
          pulldown(name).done(function() {
            logger.info('Starting to copy files...')
            copy2app(name, repos[name].file)
          })
        } else {
          var cloning = clone(repoUrl, repoPath)
          cloning.done(function() {
            repo = repos[name]
            if ('tag' in repo) { commit = repo.tag }
            if ('commit' in repo) { commit = repo.commit }

            if (commit) {
              (function(name, commit) {
                reset(name, commit).done(function() {
                  logger.info('HEAD is now at', commit)
                  copy2app(name, repos[name].file)
                }).fail(function(err) {
                  logger.error(err)
                })
              })(name, commit)
            } else {
              copy2app(name, repo.file)
            }
          })
          .fail(function(err) {
            logger.error(err)
          })
        }
      })(name)
    }
  })
}

exports.pull = pull
exports.version = '0.1.4'
