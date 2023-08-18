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
