#!/usr/bin/env node
/*jshint node:true loopfunc:true*/

var fs = require('fs')
  , util = require('util')
  , path = require('path')
  , mkdirp = require('mkdirp')
  , difflib = require('difflib')
  , cp = require('child_process')

  , notify = require('./lib/event')()
  , logger = Object.create(console)
  , slice = Array.prototype.slice
  , PATH_STATIC = '.statictmp/'
  , basename = path.basename
  , cwd = process.cwd()

  , gitHostDict = {
      github: 'git://github.com/'
    , bitbucket: 'git://bitbucket.org/'
    }

cp.exec = (function(fn) {
  var self = this, seq = 0
  return function(command) {
    var eid = 'callback' + seq++
    fn.call(self, command, function(err) {
      notify[err ? 'reject' : 'resolve'](eid, arguments)
    })
    return notify.promise(eid)
  }
})(cp.exec.bind(cp))

function extend(obj) {
  slice.call(arguments, 1)
    .forEach(function(source) {
      for (var prop in source) {
        obj[prop] = source[prop]
      }
    })
  return obj
}

function makeTempGitReposDir() {
  fs.existsSync(PATH_STATIC, function(exists) {
    if (exists) { return }
    fs.mkdir(PATH_STATIC)
  })
}

function getGitPath(url) {
  return PATH_STATIC + basename(url.trim(), '.git')
}

function shortenName(repoName) {
  repoName = /\//g.test(repoName)
    ? repoName.split('/')[1] : repoName
  return repoName
}

function getConfigFile(filename) {
  var eid = 'getConfig'
  fs.readFile(filename, 'utf8', function(err, data) {
    if (!err) {
      // Convert yaml to json
      var yaml = require('js-yaml')
        , json = yaml.load(data)
      notify.resolve(eid, [json])
    } else {
      var errInfo = "There's no `" + filename
        + "` in your app root directory."
      notify.reject(eid, [errInfo])
    }
  })

  return notify.promise(eid)
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

  // GRAY_FG = '\033[90m', END = '\033[0m'
  logger.info(' \033[90m', src, '\033[0m->\033[90m', dst, '\033[0m')
}

function coverFile(src, dstFile) {
  if (!fs.existsSync(dstFile)) { return true }
  return !localModified(src, dstFile)
}

function copy2app(repoName, files) {
  logger.info('Starting to copy files...')
  repoName = shortenName(repoName)
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
  name = shortenName(name)
  process.chdir(PATH_STATIC + name)
  return cp.exec('git reset --hard ' + commit)
}

// Get modified time that used for compare files
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

function pullAction(config) {
  var commit, tag, files
    , repos = config.repos
    , repo, repoUrl, repoPath
    , customHostDict = config.gitHostDict
    , defaultHost = config.gitHost || 'github'
    , hostDict = extend(gitHostDict, customHostDict)

  for (var name in repos) {
    (function(name) {
      repo = repos[name]
      repoUrl = [hostDict['gitHost' in repo
        ? repo.gitHost : defaultHost], name, '.git'].join('')

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
}

function pull(config) {
  makeTempGitReposDir()
  if (config) { return pullAction(config) }

  getConfigFile('static.yaml')
    .done(pullAction)
    .fail(function(err) {
      logger.error(err)
    })
}

exports.pull = pull
exports.version = '0.2.2'
