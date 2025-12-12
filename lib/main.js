const ProjectList = require("./project-list");
const RecentList = require("./recent-list");

/**
 * Project List Package
 * Provides project and recent files list management.
 * Offers services for project and recent list access by other packages.
 */
module.exports = {
  /**
   * Activates the package and initializes list components.
   */
  activate() {
    this.projectList = new ProjectList();
    this.recentList = new RecentList();
  },

  /**
   * Deactivates the package and destroys list components.
   */
  deactivate() {
    this.projectList.destroy();
    this.recentList.destroy();
  },

  /**
   * Provides the project list service.
   * @returns {ProjectList} The project list instance
   */
  provideProjectList() {
    return this.projectList;
  },

  /**
   * Provides the recent files list service.
   * @returns {RecentList} The recent list instance
   */
  provideRecentList() {
    return this.recentList;
  },
};
