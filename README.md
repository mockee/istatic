[![Build Status](https://secure.travis-ci.org/mockee/istatic.png)](http://travis-ci.org/mockee/istatic)

# iStatic

Static File Manager

## Installation
```bash
$ npm install -g node-istatic
```

### Example

Put a file named `static.yaml` to the root of your project repository.

```yaml
repos:
  backbone:
    tag: v0.9.2
    url: git://github.com/documentcloud/backbone.git
    file:
      /backbone.js: /public/js/lib/backbone/

  lodash:
    tag: v0.8.2
    url: git://github.com/bestiejs/lodash.git
    file:
      /lodash.js: /public/js/lib/
```

and then

```bash
$ istatic pull
```
