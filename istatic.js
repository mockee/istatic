#!/usr/bin/env node

var fs = require('fs')
  , util = require('util')
  , yaml = require('js-yaml')
  , mkdirp = require('mkdirp')
  , notify = require('./lib/event')()
  , cp = require('child_process')
  , logger = Object.create(console)
  , PATH_STATIC = '.statictmp/'

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
  var name = url.trim().split('/').pop()
  return PATH_STATIC + name.substring(0, name.length - 4)
}

function getConfig(cb) {
  var CONF_FILE = 'static.yaml'
  fs.readFile(CONF_FILE, 'utf8', function(err, data) {
    if (!err) { return cb(data) }
    return logger.error('\033[31m', "There's no `"
      + CONF_FILE + "` in your app root directory.", '\033[0m')
  })
}

function reset(commit) {
  cp.exec(['git', 'reset', '--hard', commit].join(' '))
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
  var pathArr = dst.split('/')

  if (!fs.existsSync(dst)) {
    if (!pathArr.slice(-1)[0]) {
      mkdirp.sync(dst)
    } else {
      mkdirp.sync(pathArr.slice(0, -1).join('/'))
    }
  }

  if (fs.statSync(src).isFile()) {
    copy(src, dst + src.split('/').slice(-1)[0])
  } else if (fs.statSync(src).isDirectory()) {
    fs.readdir(src, function(err, list) {
      list.forEach(function(name) {
        copyFile([src, name].join('/'), dst)
      })
    })
  }

  logger.info(' \033[30m', src
    , '\033[0m->\033[30m', dst, '\033[0m')
}

function copy2app(repoName, files) {
  if (files) {
    for (var src in files) {
      copyFile(PATH_STATIC + repoName + src
        , files[src].slice(1))
    }
  }
}

function pull() {
  makeTmpDir()
  getConfig(function(data) {
    var commit, files
      , repo, repoUrl, repoPath
      , conf = yaml.load(data)
      , repos = conf.repos

    for (var name in repos) {
      repo = repos[name]
      commit = 'version' in repo
        ? repo.version : ''

      repoUrl = 'url' in repo
        ? repo.url
        : repoUrl = 'http://code.dapps.douban.com/{name}.git'
            .replace('{name}', name)

      repoPath = getGitPath(repoUrl)
      files = repo.file || null

      if (fs.existsSync(repoPath)) {
        copy2app(name, files)
      } else {
        (function(name) {
          cp.exec(['git', 'clone', repoUrl, repoPath].join(' '))
            .done(function(err, stdout, stderr) {
              logger.info(stdout.split('\n')[0])
              files = repos[name].file
              copy2app(name, files)
            })
            .fail(function(err) {
              logger.error(err)
            })
        })(name)
      }
    }
  })
}

exports.pull = pull
exports.version = '0.1.2'
