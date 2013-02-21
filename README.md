[![Build Status](https://secure.travis-ci.org/mockee/istatic.png)](http://travis-ci.org/mockee/istatic)

# iStatic

Static File Manager

### Installation
```bash
$ npm install node-istatic -g
```

### Usage

Put a file named `static.yaml` (refer to the following __Configuration__) at the root of your project repository.
And then, run:

```bash
$ istatic pull
```

### Configuration

You can specify any git hosting provider, such as:

```yaml
hostDict:
  code: http://code.dapps.douban.com/
  gitcafe: git://gitcafe.com/
```
Note: iStatic has been added __github__, __bitbucket__ and __local__ by default.

Specify the git repos info (including __name__, __host__, __tag__ or __commit__) and the path of the files or directories you need.
The default host is __github__, and the default commit (or tag) is __origin/master__. These two properties can be omitted.
But you need to specify one __file__ mapping (origin: target) at least. It sounds to be a little complicated, here's a example:

```yaml
repos:
  arkui:
    host: code
    file:
      ./stylus: ./public/css/arkui/
      ./pics: ./public/pics/

  dexteryy/OzJS:
    tag: 2.5.1
    file:
      ./oz.js: ./public/js/lib/
      ./eventMaster/eventmaster.js: ./public/js/lib/mod/event.js

  /Users/mockee/M3:
    host: local
    commit: 7827c7c605
    file:
      ./define.js: ./public/js/lib/
      ./mod/touch.js: ./public/js/mod/
```

### Grunt task

[Grunt-istatic](https://github.com/mockee/grunt-istatic) task now available.

## Release History

- 2013-02-22 - v0.3.1 - Support async callback for `grunt-istatic`.
- 2013-02-07 - v0.2.7 - Support local git repos. Format logs. Add `--version` & `clear` options.
- 2012-12-06 - v0.2.5 - Bugfix for `pulldown` && checking local files modification.

## License
Copyright (c) 2013 mockee
Licensed under the MIT license.
