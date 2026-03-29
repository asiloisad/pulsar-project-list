const { globSync } = require("glob");

module.exports = function(dirPath, scanList) {
  const entries = globSync(scanList, {
    cwd: dirPath,
    absolute: false,
  });
  emit('project-list:entries', entries);
};
