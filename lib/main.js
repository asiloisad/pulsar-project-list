'use babel'

import PList from './plist'
import RList from './rlist'

export default {

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
      description: 'If a list of open folders matches a project paths, then add project title to window title. The startup of the package takes a bit longer, because a project list has to be updated at startup',
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
