const PList = require('./plist')
const RList = require('./rlist')

module.exports = {

  activate() {
    this.plist = new PList()
    this.rlist = new RList()
  },

  deactivate() {
    this.plist.destroy()
    this.rlist.destroy()
  },
}
