const { globSync } = require('glob')

module.exports = function(props) {
  let entries = globSync(props.scanList, { cwd:props.dirPath, absolute:false })
  emit('project-list:scan', { dirPath:props.dirPath, entries:entries })
}
