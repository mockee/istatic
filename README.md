[![Build Status](https://secure.travis-ci.org/mockee/istatic.png)](http://travis-ci.org/mockee/istatic)

# iStatic

Static File Manager

## Installation
```bash
$ npm install node-istatic -g
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
    commit: 7827c7c605
    url: https://github.com/dexteryy/OzJS.git
    file:
      /oz.js: /public/js/lib/
      /eventMaster/eventmaster.js: /public/js/lib/mod/event.js
```

and then, run:

```bash
$ istatic pull
```
