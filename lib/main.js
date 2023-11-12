'use babel'

import ProjectList from './project-list'
import RecentList  from './recent-list'

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
      description: 'If a list of open folders matches a project paths, then add project titile to window title. The startup of the package takes a bit longer, because a project list has to be updated at startup',
      type: 'boolean',
      default: true,
    },
  },

  activate() {
    this.plist = new ProjectList(this)
    this.rlist = new RecentList (this)
  },

  deactivate() {
    this.plist.destroy()
    this.rlist.destroy()
  },
}
