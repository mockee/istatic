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
  lodash:
    tag: 0.8.2
    url: git://github.com/bestiejs/lodash.git
    file:
      /lodash.js: /public/js/lib/
  OzJS:
    commit: 95cf1fec22
    url: https://github.com/dexteryy/OzJS.git
    file:
      /oz.js: /public/js/lib/
      /mod/event.js: /public/js/lib/mod/
```

and then, run:

```bash
$ istatic pull
```
