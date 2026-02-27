const { Disposable } = require("atom");
const ProjectList = require("./project-list");
const RecentList = require("./recent-list");

module.exports = {
  activate() {
    this.projectList = new ProjectList();
    this.recentList = new RecentList();
  },

  deactivate() {
    this.projectList.destroy();
    this.recentList.destroy();
  },

  provideProjectList() {
    return this.projectList;
  },

  provideRecentList() {
    return this.recentList;
  },

  consumeOpenExternalService(service) {
    this.projectList.setOpenExternalService(service);
    this.recentList.setOpenExternalService(service);
    return new Disposable(() => {
      this.projectList.setOpenExternalService(null);
      this.recentList.setOpenExternalService(null);
    });
  },
};
