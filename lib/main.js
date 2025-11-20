const ProjectList = require('./projectList')
const RecentList = require('./recentList')

module.exports = {

  activate() {
    this.projectList = new ProjectList()
    this.recentList = new RecentList()
  },

  deactivate() {
    this.projectList.destroy()
    this.recentList.destroy()
  },

  provideProjectList() {
    return this.projectList
  },

  provideRecentList() {
    return this.recentList
  },
}
