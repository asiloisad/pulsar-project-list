const { globSync } = require('glob')

module.exports = function(dirPath) {
  let entries = globSync('*/', { cwd: dirPath, absolute: true })
  emit('project-list:entries', { dirPath: dirPath, entries: entries })
}
