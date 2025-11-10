/** @babel */
/** @jsx etch.dom */

const etch = require('etch')
const { Disposable, CompositeDisposable, File, Task } = require('atom')
const SelectListView = require('atom-select-list')
const fs = require('fs')
const CSON = require('cson')
const Diacritics = require('diacritic')
const path = require('path')

module.exports = class PList {

  // ***** PACKAGE ***** //

  constructor() {
    // initialize
    this.panel = null
    this.previouslyFocusedElement = null
    this.items = []
    this.restart = true
    this.restarting = false
    this.query = null

    // files
    this.configFile = new File(this.getConfigPath())
    this.cacheFile = new File(this.getCachePath())

    // create select-list
    this.slv = new SelectListView({
      items: this.items,
      maxResults: 50,
      emptyMessage: this.getEmptyMessage(),
      elementForItem: this.elementForItem.bind(this),
      didConfirmSelection: this.didConfirmSelection.bind(this, 'open'),
      didCancelSelection: this.didCancelSelection.bind(this),
      filter: this.filter.bind(this),
    })
    this.slv.element.classList.add('project-list')
    this.slv.element.classList.add('command-palette')

    // create disposables
    this.disposables = new CompositeDisposable()
    this.subCacheFile1 = new Disposable()
    this.subCacheFile2 = new Disposable()

    // watch required config
    this.disposables.add(
      atom.config.observe('command-palette.preserveLastSearch', (value) => {
        this.preserveLastSearch = value
      }),
      atom.config.observe('project-list.showKeystrokes', (value) => {
        this.slv.update({ infoMessage:this.getInfoMessage(value) })
      }),
      atom.config.observe('project-list.useCache', (value) => {
        this.useCache = value
      }),
      atom.config.observe('project-list.checkExists', (value) => {
        this.checkExists = value
      }),
    )

    // watch config for window title
    this.disposables.add(
      atom.config.observe('project-list.windowTitle', (value) => {
        this.windowTitle = value ; atom.workspace.updateWindowTitle()
      }),
      atom.project.onDidChangePaths(() => {
        this.findCurrentProject()
      }),
    )

    // add global & local shortcuts
    this.disposables.add(
      atom.commands.add('atom-workspace', {
        'project-list:toggle': () => this.toggleView(),
        'project-list:update': () => this.updateView(false),
        'project-list:edit': () => this.editConfig(),
      }),
      atom.commands.add(this.slv.element, {
        'project-list:open': () => this.didConfirmSelection('open'),
        'project-list:swap': () => this.didConfirmSelection('swap'),
        'project-list:append': () => this.didConfirmSelection('append'),
        'project-list:paste': () => this.didConfirmSelection('paste'),
      }),
    )

    // find window title if required
    this.patchWindowTitle() ; if (this.windowTitle) { this.updateView() }

    // watch config file
    this.observeConfigFile()
  }

  destroy() {
    this.subCacheFile1.dispose()
    this.subCacheFile2.dispose()
    this.disposables.dispose()
    this.slv.destroy()
  }

  getConfigPath() {
    return `${atom.getConfigDirPath()}/projects.cson`
  }

  getCachePath() {
    return `${atom.getConfigDirPath()}/compile-cache/projects.json`
  }

  // ***** VIEW ***** //

  showView() {
    this.previouslyFocusedElement = document.activeElement
    if (this.preserveLastSearch) {
      this.slv.refs.queryEditor.selectAll()
    } else {
      this.slv.reset()
    }
    if (!this.panel) {
      this.panel = atom.workspace.addModalPanel({ item: this.slv })
    }
    if (this.restart) {
      this.updateView()
    }
    this.panel.show()
    this.slv.focus()
  }

  hideView() {
    this.panel.hide()
    if (this.previouslyFocusedElement) {
      this.previouslyFocusedElement.focus()
      this.previouslyFocusedElement = null
    }
    this.previouslyFocusedElement = null
  }

  toggleView() {
    if (this.panel && this.panel.isVisible()) {
      this.hideView()
    } else {
      this.showView()
    }
  }

  async updateView(loadCache=true) {
    // prevent new updates by .show
    this.restart = false

    // prevent multiscans
    if (this.restarting) { return }
    this.restarting = true

    // clean cache file watcher
    this.subCacheFile1.dispose()
    this.subCacheFile2.dispose()

    // update element
    this.slv.update({
      loadingMessage: this.getLoadingMessage(true),
      errorMessage: this.getErrorMessage(false),
    })

    // initialize
    this.items = null
    const errors = []

    // try load cache if needed
    if (loadCache && this.useCache && !this.items) {
      try {
        await this.loadCache()
      } catch (err) {
        errors.push(`loadCache: ${err}`)
      }
    }

    // try build cache if needed
    if (!this.items) {
      try {
        await this.buildCache()
      } catch (err) {
        errors.push(`buildCache: ${err}`)
      }
    }

    // if nothing works then...
    if (!this.items) {
      this.items = []
    }

    // create window title
    this.findCurrentProject()

    // update element
    this.slv.update({
      items: this.items,
      loadingMessage: this.getLoadingMessage(false),
      errorMessage: this.getErrorMessage(errors)
    })

    // create new cache file watcher
    if (this.useCache) {
      setTimeout(() => { this.observeCacheFile() }, 100)
    }

    // release
    this.restarting = false
  }

  async updateViewSchedule() {
    this.restart = true
    if (this.panel && this.panel.isVisible()) {
      await this.updateView()
    }
  }

  updateLoading() {
    this.slv.update({
      items: this.items,
      loadingMessage: this.getLoadingMessage(this.items.length),
    })
  }

  async observeConfigFile() {
    if (!(await this.configFile.exists())) {
      await this.configFile.create()
      await this.configFile.write('[]')
    }
    this.disposables.add(
      this.configFile.onDidChange(debounce(async () => {
        await this.clearCache()
        await this.updateViewSchedule()
      }, 100))
    )
  }

  async observeCacheFile() {
    if (!(await this.cacheFile.exists())) { return }
    this.subCacheFile1 = this.cacheFile.onDidChange(debounce(async () => {
      await this.updateViewSchedule()
    }, 100))
    this.subCacheFile2 = this.cacheFile.onDidDelete(() => {
      this.subCacheFile1.dispose()
      this.subCacheFile2.dispose()
    })
  }

  // ***** LIST ***** //

  filter(items, query) {
    this.query = Diacritics.clean(query)
    if (this.query.length === 0) {
      return items
    }
    const scoredItems = []
    for (const item of items) {
      item.score = atom.ui.fuzzyMatcher.score(item.text, this.query)
      if (item.score>0) { scoredItems.push(item) }
    }
    scoredItems.sort((a, b) => b.score - a.score)
    return scoredItems
  }

  elementForItem(item, options) {
    let li = document.createElement('li')
    if (!options.visible) { return li }
    li.classList.add('two-lines')
    let e1 = document.createElement('div')
    e1.classList.add('primary-line')
    let total = 0
    let indices = this.query.length>0 ? atom.ui.fuzzyMatcher.match(item.text, this.query, { recordMatchIndexes:true }).matchIndexes : []
    if (item.tags) {
      for (let tag of item.tags) {
        let et = document.createElement('span')
        et.classList.add('tag')
        total += 1
        this.highlightInElement(et, tag, indices.map(x=>x-total))
        total += 1 + tag.length
        e1.appendChild(et)
      }
    }
    this.highlightInElement(e1, item.title, indices.map(x=>x-total))
    li.appendChild(e1)
    for (let dirPath of item.paths) {
      let ep = document.createElement('div')
      ep.classList.add('icon', 'icon-line', item.icon ? item.icon : 'icon-file-directory')
      let ei = document.createElement('span')
      ei.classList.add('secondary-line')
      ei.innerHTML = dirPath
      ep.appendChild(ei)
      li.appendChild(ep)
    }
    li.addEventListener('contextmenu', () => { this.slv.selectIndex(options.index) })
    return li
  }

  didConfirmSelection(mode) {
    if (!mode) { mode = 'open' }
    const item = this.slv.getSelectedItem()
    if (!item) { return } else { this.hideView() }
    const data = this.prepareData(item)
    if (!data.pathsToOpen.length) { return }
    if (mode==='open') {
      atom.open(data)
    } else if (mode==='swap') {
      let closed = atom.project.getPaths().length ? true : false
      atom.open(data)
      if (closed) { atom.close() }
    } else if (mode==='append') {
      for (let projectPath of data.pathsToOpen) {
        atom.project.addPath(projectPath, { mustExist:true })
      }
    } else if (mode==='paste') {
      const editor = atom.workspace.getActiveTextEditor()
      if (!editor) {
        atom.notifications.addError('Cannot insert path, because there is no active text editor')
        return
      }
      editor.insertText(data.pathsToOpen.join('\n'), { selection: true })
    }
  }

  didCancelSelection() {
    this.hideView()
  }

  getLoadingMessage(mode) {
    return mode ? [<span>{`Indexing project \u2026 ${Number.isInteger(mode)? mode : ""}`}</span>, <span class='loading loading-spinner-tiny'/>] : null
  }

  getErrorMessage(errors) {
    return (errors && errors.length) ? errors.map((err) => {
      return <div class='error-message'>{err}</div>
    }) : null
  }

  getInfoMessage(mode) {
    return mode ? ['Press ', <span class='keystroke'>Enter</span>, ', ', <span class='keystroke'>Alt-Enter</span>, ', ', <span class='keystroke'>Shift-Enter</span>, ' or ', <span class='keystroke'>Alt-V</span>] : null
  }

  getEmptyMessage() {
    return <div class='empty-message'>No matches found</div>
  }

  // ***** DATA ***** //

  async dumpCache() {
    await this.cacheFile.create()
    let jsonstr = JSON.stringify(this.items)
    await this.cacheFile.write(jsonstr)
  }

  async loadCache() {
    if (!(await this.cacheFile.exists())) { return }
    let data = await this.cacheFile.read(true)
    this.items = JSON.parse(data)
  }

  async clearCache() {
    try {
      this.subCacheFile1.dispose()
      this.subCacheFile2.dispose()
      await fs.promises.rm(this.getCachePath())
    } catch {}
  }

  async buildCache() {
    if (!(await this.configFile.exists())) {
      throw new Error('Config file does not exists')
    }
    const configData = CSON.parse(await this.configFile.read())
    if (configData instanceof Error) {
      throw new Error(configData.message)
    }
    this.items = []
    for (const item of configData) {
      try {
        if (this.checkExists) {
          let paths = []
          for (let ppath of item.paths) {
            try {
              await fs.promises.access(ppath)
              paths.push(ppath)
            } catch {}
          }
          if (paths.length===0) { continue }
          item.paths = paths
        }
        this.items.push(this.prepareItem(item))
      } catch {}
    }
    this.updateLoading()
    const tasks = []
    for (let item of this.items) {
      if (item.scan) {
        for (let dirPath of item.paths) {
          if (dirPath in tasks) { continue }
          tasks[dirPath] = this.scanDir(dirPath, item.tags)
        }
      }
    }
    await Promise.all(Object.values(tasks))
    if (this.useCache) { await this.dumpCache() }
  }

  scanDir(dirPath, tags) {
    return new Promise((resolve, reject) => {
      const taskPath = require.resolve('./pscan')
      const task = Task.once(taskPath, dirPath)
      task.once('project-list:scan', (data) => {
        for (let entry of data.entries) {
          const item = {
            title: path.basename(entry),
            tags: tags,
            paths: [entry],
          }
          this.items.push(this.prepareItem(item))
        }
        this.updateLoading()
        resolve()
      })
    })
  }

  // ***** PROJECT ***** //

  findCurrentProject() {
    delete atom.project.title
    if (!this.items) { return }
    let proPaths = []
    for (let proPath of atom.project.getPaths()) {
      proPaths.push(proPath+path.sep)
    }
    for (let item of this.items) {
      if (item.paths.length!==proPaths.length) { continue }
      let br = false
      for (let proPath of proPaths) {
        if (!item.paths.includes(proPath)) { br=true ; break }
      }
      if (br) { continue }
      atom.project.title = item.title
      atom.workspace.updateWindowTitle()
      return item
    }
  }

  patchWindowTitle() {
    let _updateWindowTitle = atom.workspace.updateWindowTitle
    atom.workspace.updateWindowTitle = () => {
      _updateWindowTitle()
      if (this.windowTitle && atom.project.title) {
        document.title = '[' + atom.project.title + '] ' + document.title
      }
    }
  }

  // ***** TOOLS ***** //

  highlightInElement(el, text, indices) {
    let matchedChars = []
    let lastIndex = 0
    for (const matchIndex of indices) {
      const unmatched = text.substring(lastIndex, matchIndex)
      if (unmatched) {
        if (matchedChars.length > 0) {
          const matchSpan = document.createElement('span')
          matchSpan.classList.add('character-match')
          matchSpan.textContent = matchedChars.join('')
          el.appendChild(matchSpan)
          matchedChars = []
        }
        el.appendChild(document.createTextNode(unmatched))
      }
      matchedChars.push(text[matchIndex])
      lastIndex = matchIndex + 1
    }
    if (matchedChars.length > 0) {
      const matchSpan = document.createElement('span')
      matchSpan.classList.add('character-match')
      matchSpan.textContent = matchedChars.join('')
      el.appendChild(matchSpan)
    }
    const unmatched = text.substring(lastIndex)
    if (unmatched) {
      el.appendChild(document.createTextNode(unmatched))
    }
  }

  editConfig() {
    atom.workspace.open(this.getConfigPath())
  }

  prepareItem(item) {
    item.text = Diacritics.clean(item.tags ?
      item.tags.map(x=>`#${x} `).join('') + item.title : item.title)
    item.paths = item.paths.map((ppath) => {
      return ppath.split(/[\\\/]/g).join(path.sep)+path.sep
    })
    return item
  }

  prepareData(item) {
    const pathsToOpen = [] ; const errs = []
    for (let projectPath of item.paths) {
      if (fs.existsSync(projectPath) && fs.lstatSync(projectPath).isDirectory()) {
        pathsToOpen.push(projectPath)
      } else {
        errs.push(projectPath)
      }
    }
    if (errs.length) {
      atom.notifications.addError('Directory does not exist', { detail:errs.join('\n') })
    }
    let params = { pathsToOpen:pathsToOpen, errs:errs }
    if (item.devMode) { params.devMode = true }
    if (item.safeMode) { params.safeMode = true }
    return params
  }
}

function debounce(func, timeout){
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      func.apply(this, args)
    }, timeout)
  }
}
