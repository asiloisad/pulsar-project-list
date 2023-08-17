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
    this.projectList = new ProjectList(this)
    this.recentList  = new RecentList (this)
  },

  deactivate() {
    this.projectList.destroy()
    this.recentList .destroy()
  },
}
