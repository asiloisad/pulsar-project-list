const PList = require('./plist')
const RList = require('./rlist')

module.exports = {

  config: {
    showKeystrokes: {
      order: 1,
      title: 'Enable keystroke hints',
      description: 'Show info message with keystrokes',
      type: 'boolean',
      default: true,
    },
    windowTitle: {
      order: 2,
      title: 'Add project titile to window title',
      description: 'If a list of open folders matches a project paths, then add project title to window title',
      type: 'boolean',
      default: true,
    },
    useCache: {
      order: 3,
      title: 'Use cached data',
      description: 'Do not trigger list update at program startup. Useful for large scans',
      type: 'boolean',
      default: true,
    },
    checkExists: {
      order: 4,
      title: 'Existing items only',
      description: 'Add item to list only if one or more of its paths exist',
      type: 'boolean',
      default: true,
    },
  },

  activate() {
    this.plist = new PList()
    this.rlist = new RList()
  },

  deactivate() {
    this.plist.destroy()
    this.rlist.destroy()
  },
}
