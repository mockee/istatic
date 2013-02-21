#!/usr/bin/env node
/*jshint node:true loopfunc:true*/

var fs = require('fs')
  , util = require('util')
  , path = require('path')
  , mkdirp = require('mkdirp')
  , difflib = require('difflib')
  , cp = require('child_process')
  , eventMaster = require('./lib/event')

  , slice = [].slice
  , keys = Object.keys
  , logger = Object.create(console)
  , PATH_STATIC = path.resolve('.statictmp/')
  , basename = path.basename
  , extname = path.extname
  , availableFiles = {}
  , cwd = process.cwd()
  , sep = path.sep

  , defaultHostDict = {
      github: 'git://github.com/'
    , bitbucket: 'git://bitbucket.org/'
    , local: ''
    }

cp.exec = (function(fn) {
  var self = this, seq = 0
  return function(command) {
    var promise = new eventMaster.Promise()
    fn.call(self, command, function(err) {
      promise[err ? 'reject' : 'resolve'](arguments)
    })
    return promise
  }
})(cp.exec.bind(cp))

logger.istatic = function() {
  var args = slice.call(arguments).join(' ')
  return logger.info('istatic', args)
}

function extend(obj) {
  slice.call(arguments, 1)
    .forEach(function(source) {
      for (var prop in source) {
        obj[prop] = source[prop]
      }
    })
  return obj
}

function colour(color) {
  var colors = {
        red: '\033[31m'
      , cyan: '\033[36m'
      , grey: '\033[90m'
      , white: '\033[37m'
      , yellow: '\033[33m'
      }

  return [colors[color]
    , slice.call(arguments, 1).join(' ')
    , '\033[0m'].join('')
}

function makeTempGitReposDir() {
  fs.existsSync(PATH_STATIC, function(exists) {
    if (exists) { return }
    fs.mkdir(PATH_STATIC)
  })
}

function getGitPath(url) {
  var lastItem = url.split(sep).pop()
    , isLocal = lastItem.indexOf('.git') === -1
    , repoName = isLocal ? lastItem
      : basename(url.trim(), '.git')

  return path.resolve(PATH_STATIC, repoName)
}

function shortenName(repoName) {
  repoName = /\//g.test(repoName)
    ? repoName.split('/').pop() : repoName
  return repoName
}

function normalizeName(name){
  return name.trim().replace(/^\//, './');
}

function getConfigFile(filename) {
  var promise = new eventMaster.Promise()
  fs.readFile(filename, 'utf8', function(err, data) {
    if (!err) {
      // Convert yaml to json
      var yaml = require('js-yaml')
        , json = yaml.load(data)

      promise.resolve([json])
    } else {
      var errInfo = "There's no `" + filename
        + "` in your app root directory."
      promise.reject([errInfo])
    }
  })

  return promise
}

function outputs(err, stdout, stderr) {
  logger.info(stdout.split('\n')[0])
}

function filterFiles(src) {
  var fileType = extname(src).slice(1)
    , allowedFileTypes = [
        'html', 'jade', 'js', 'coffee'
      , 'css', 'styl', 'sass', 'scss'
      , 'png', 'jpg', 'jpeg', 'gif'
      ]

  return fs.statSync(src).isFile()
    ? allowedFileTypes.indexOf(fileType) !== -1
    : !/^\./.test(src.split('/').pop())
}

function copy(src, dst, cb) {
  function copyHelper(err) {
    var is, os
    fs.stat(src, function (err, stat) {
      if (err) { return cb(err) }
      is = fs.createReadStream(src)
      os = fs.createWriteStream(dst)

      is.pipe(os)
      is.on('end', function() {
        fs.utimes(dst, stat.atime, stat.mtime, cb)
      }).on('error', function(err) {
        if (err) { return cb(err) }
      })
    })
  }

  cb = cb || function(){}
  fs.stat(dst, copyHelper)
}

function copyFile(src, dst) {
  var pathArr = dst.split(sep)
    , isLegalType = filterFiles(src)

  if (!isLegalType) { return }

  if (!fs.existsSync(dst)) {
    mkdirp.sync(!pathArr.slice(-1)[0]
      ? dst : pathArr.slice(0, -1).join(sep))
  }

  if (fs.statSync(src).isFile()) {
    var dstIsDir = dst.substr(-1) === sep
      , dstFile = dstIsDir ? dst
          + src.split(sep).pop() : dst

    if (!(src in availableFiles)
      && fs.existsSync(dstFile)
      && localModified(src, dstFile)) {
        return logger.info(
          colour('red', '  IGNORED (file)', dstFile))
    }

    copy(src, dstFile, function(err) {
      if (err) { return }
      logger.info(' \033[90m'
        , src.replace(path.resolve(cwd), '').replace(/^\//, '')
        , '\033[0m->\033[90m', dst, '\033[0m')
    })

  } else if (fs.statSync(src).isDirectory()) {
    fs.readdirSync(src).forEach(function(name) {
      var srcPath = [src.replace(/\/$/g, ''), name].join(sep)
        , isDir = fs.statSync(srcPath).isDirectory()

      copyFile(srcPath, isDir ? dst + name + sep : dst)
    })
  }
}

function diffFile(src, dst) {
  var sep = path.sep
    , pathArr = dst.split(sep)
    , isLegalType = filterFiles(src)
    , noDstFile = fs.existsSync(dst)

  if (!isLegalType || !noDstFile) { return }

  if (fs.statSync(src).isFile()) {
    var dstIsDir = dst.substr(-1) === sep
      , dstFile = dstIsDir ? dst
          + src.split(sep).slice(-1)[0] : dst

    if (!localModified(src, dstFile)) {
      availableFiles[src] = dstFile
    }
  } else if (fs.statSync(src).isDirectory()) {
    fs.readdirSync(src).forEach(function(name) {
      var srcPath = [src, name].join(sep)
        , isDir = fs.statSync(srcPath).isDirectory()
      diffFile(srcPath, isDir ? dst + name + sep : dst)
    })
  }
}

function outputFilesNum(files) {
  var dirNum = 0, fileNum = 0

  function combinText(typeNum) {
    var type, num, t, text = ''
    for (t in typeNum) {
      num = typeNum[t]
      text += (!num ? '' : (!text ? '' : ' and ')
        + [num, num > 1 ? t + 's' : t].join(' '))
    }
    return text
  }

  keys(files).forEach(function(n) {
    if (!!extname(n)) { fileNum++ }
    else { dirNum++ }
  })

  return combinText({
    file: fileNum, dir: dirNum
  })
}

function copy2app(repoName, files) {
  repoName = shortenName(repoName)
  logger.istatic(colour('cyan', 'copying')
    , colour('white', outputFilesNum(files)))

  for (var src in files) {
    copyFile(path.resolve(PATH_STATIC, repoName, normalizeName(src))
      , normalizeName(files[src]))
  }
}

function clone(url, path) {
  var cmd = ['git clone', url, path].join(' ')
  return cp.exec(cmd).done(function(a) {
    logger.istatic(colour('cyan', 'cloning')
      , colour('yellow', url))
  })
}

function fetch(name) {
  name = shortenName(name)
  process.chdir(path.resolve(PATH_STATIC, name))

  return cp.exec('git fetch --all')
    .done(function(err, stdout) {
      process.chdir(cwd)
    })
}

function reset(name, commit) {
  name = shortenName(name)
  commit = commit || 'origin/master'
  process.chdir(path.resolve(PATH_STATIC, name))

  return cp.exec('git reset --hard ' + commit)
    .done(function() {
      logger.istatic(colour('cyan', 'pulling')
        , colour('yellow', name, '(' + commit + ')'))
    })
}

// Get modified time that used for compare files
function getMtime(file) {
  return (new Date(fs.statSync(file).mtime)).getTime()
}

function localModified(src, dst) {
  if (!fs.existsSync(dst)) {
      return false;
  }
  var srcStr = fs.readFileSync(src, 'UTF-8')
    , dstStr = fs.readFileSync(dst, 'UTF-8')
    , diffRatio = (new difflib
        .SequenceMatcher(null, srcStr, dstStr))
        .quickRatio()

  return diffRatio !== 1
}

function pullAction(config) {
  var commit, files
    , repos = config.repos
    , repo, repoUrl, repoPath
    , customHostDict = config.hostDict
    , defaultHost = config.host || 'github'
    , hostDict = extend(defaultHostDict, customHostDict)

  function generateRepoUrl(host, name) {
    return [hostDict[host], name, '.git'].join('')
  }

  function copyAfterReset(name) {
    repo = repos[name]
    commit = repo.tag || repo.commit
    return reset(name, commit).done(function() {
      process.chdir(cwd)
      copy2app(name, repos[name].file)
    })
  }

  function hasCloned(repo) {
    process.chdir(cwd)
    return fs.existsSync(repo)
  }

  var promises = []

  for (var name in repos) {
    (function(name) {
      repo = repos[name]
      repoUrl = 'host' in repo
        ? repo.host === 'local'
          ? name : generateRepoUrl(repo.host, name)
        : generateRepoUrl(defaultHost, name)

      repoPath = getGitPath(repoUrl)

      if (hasCloned(repoPath)) {
        files = repos[name].file

        for (var src in files) {
          diffFile(path.resolve(PATH_STATIC, shortenName(name),
            normalizeName(src)), normalizeName(files[src]))
        }

        promises.push(fetch(name).done(function() {
          return copyAfterReset(name)
        }).follow())
      } else {
        promises.push(clone(repoUrl, repoPath).done(function() {
          return copyAfterReset(name)
        }).follow())
      }
    })(name)
  }

  return eventMaster.when.apply(this, promises)
}

function pull(config, cb) {
  makeTempGitReposDir()
  if (config) { return pullAction(config).then(cb) }

  getConfigFile('static.yaml')
    .done(pullAction)
    .fail(function(err) {
      logger.error(err)
    }).follow().then(cb)
}

function clear(name) {
  var rimraf = require('rimraf')
  rimraf(PATH_STATIC, function(err) {
    if (!err) { return }
    console.error(err)
  })
}

exports.pull = pull
exports.clear = clear
exports.version = '0.3.1'
