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
gitHostDict:
  code: http://code.dapps.douban.com/
  
repos:
  arkui:
    gitHost: code
    file:
      /stylus: /public/css/arkui/
      /pics: /public/pics/

  bestiejs/lodash:
    tag: 0.8.2
    file:
      /lodash.js: /public/js/lib/

  dexteryy/OzJS:
    commit: 7827c7c605
    file:
      /oz.js: /public/js/lib/
      /eventMaster/eventmaster.js: /public/js/lib/mod/event.js
```

and then, run:

```bash
$ istatic pull
```

## License
Copyright (c) 2012 mockee  
Licensed under the MIT license.
