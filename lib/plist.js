'use babel'
/** @jsx etch.dom */

const etch = require('etch')
const { CompositeDisposable, File, Task } = require('atom')
const SelectListView = require('atom-select-list')
const fs = require('fs')
const CSON = require('cson')
const Diacritics = require('diacritic')
const path = require('path')

module.exports = class PList {

  constructor() {
    this.items = [] ; this.tasks = {} ; this.restart = true
    this.query = ''
    this.slv = new SelectListView({
      items: [],
      maxResults: this.getMaxResults(),
      emptyMessage: this.getEmptyMessage(),
      elementForItem: this.elementForItem.bind(this),
      didConfirmSelection: () => { this.didConfirmSelection.bind(this)('open') },
      didCancelSelection: this.didCancelSelection.bind(this),
      filter: this.filter.bind(this),
    })
    this.slv.element.classList.add('project-list')
    this.slv.element.classList.add('command-palette')
    this.disposables = new CompositeDisposable()
    this.disposables.add(
      atom.config.observe('command-palette.preserveLastSearch', (value) => {
        this.preserveLastSearch = value
      }),
      atom.config.observe('project-list.showKeystrokes', (value) => {
        this.showKeystrokes = value
        this.slv.update({ infoMessage:this.getInfoMessage() })
      }),
      atom.config.observe('project-list.useCache', (value) => {
        this.useCache = value
      }),
      atom.config.observe('project-list.checkExists', (value) => {
        this.checkExists = value
      }),
      atom.config.observe('project-list.windowTitle', (value) => {
        this.windowTitle = value ; atom.workspace.updateWindowTitle()
      }),
      atom.commands.add('atom-workspace', {
        'project-list:toggle': () => this.toggle(),
        'project-list:update': () => { this.restart = true ; this.update() },
        'project-list:edit' : () => this.edit(),
      }),
      atom.commands.add(this.slv.element, {
        'project-list:open': () => this.didConfirmSelection('open'),
        'project-list:swap': () => this.didConfirmSelection('swap'),
        'project-list:append': () => this.didConfirmSelection('append'),
        'project-list:paste': () => this.didConfirmSelection('paste'),
      }),
      new File(this.getPath()).onDidChange(() => {
        this.restart = true
        if (this.windowTitle) { this.update() }
      }),
      atom.project.onDidChangePaths(() => {
        this.findCurrentProject()
      }),
    )
    this.patchWindowTitle() ; if (this.windowTitle) { this.update() }
  }

  destroy() {
    this.disposables.dispose()
    if (this.panel) { this.panel.destroy() }
    this.slv.destroy()
  }

  getMaxResults() {
    return 50
  }

  getEmptyMessage() {
    return <div class='empty-message'>No matches found</div>
  }

  getInfoMessage() {
    return this.showKeystrokes ? ['Press ', <span class='keystroke'>Enter</span>, ', ', <span class='keystroke'>Alt-Enter</span>, ', ', <span class='keystroke'>Shift-Enter</span>, ' or ', <span class='keystroke'>Alt-V</span>] : null
  }

  getErrorMessage() {
    return <div class='error-message'>Cannot parse "projects.cson" file</div>
  }

  getLoadingMessage() {
    return [<span>{`Indexing project \u2026`}</span>, <span class='loading loading-spinner-tiny'/>]
  }

  updateInfoMessage() {
    this.slv.update({ items: this.items,
      loadingMessage: null, infoMessage: this.getInfoMessage(), errorMessage: null })
  }

  updateErrorMessage() {
    this.slv.update({ items: this.items,
      loadingMessage: null, infoMessage: null, errorMessage: this.getErrorMessage() })
  }

  updateLoadingMessage() {
    this.slv.update({ items: [],
      loadingMessage: this.getLoadingMessage(), infoMessage: null, errorMessage: null })
  }

  getPath() {
    return `${atom.getConfigDirPath()}/projects.cson`
  }

  getCachePath() {
    return `${atom.getConfigDirPath()}/compile-cache/projects.json`
  }

  show() {
    this.previouslyFocusedElement = document.activeElement
    if (this.preserveLastSearch) {
      this.slv.refs.queryEditor.selectAll()
    } else {
      this.slv.reset()
    }
    if (!this.panel) { this.panel = atom.workspace.addModalPanel({ item: this.slv }) }
    this.panel.show()
    this.slv.focus()
  }

  hide() {
    this.panel.hide()
    if (this.previouslyFocusedElement) {
      this.previouslyFocusedElement.focus()
      this.previouslyFocusedElement = null
    }
  }

  toggle() {
    if (this.panel && this.panel.isVisible()) {
      this.hide()
    } else {
      this.update()
      this.show()
    }
  }

  async update() {
    if (this.restart) {
      this.restart = false
      this.items = []
      try {
        await this.cache()
        this.updateInfoMessage()
        this.findCurrentProject()
      } catch (err) {
        this.updateErrorMessage()
        this.restart = true
      }
    }
  }

  async dumpCache() {
    let jsonstr = JSON.stringify(this.items)
    fs.promises.writeFile(this.getCachePath(), jsonstr)
  }

  async loadCache() {
    let data = await fs.promises.readFile(this.getCachePath(), 'utf8')
    this.items = JSON.parse(data)
  }

  async cache() {
    if (this.useCache) {
      try {
        await this.loadCache()
        this.useCache = false
        return
      } catch (err) {}
    }
    let naviPath = this.getPath()
    if (!fs.existsSync(naviPath)) {
      this.items = []
      throw new Error()
    }
    let result = CSON.parseFile(naviPath, {})
    if ( result instanceof Error ) {
      this.items = []
      console.error(result.stack)
      throw new Error()
    }
    for (let item of result) {
      if (this.checkExists) {
        let paths = []
        for (let ppath of item.paths) {
          try {
            await fs.promises.access(ppath)
            paths.push(ppath)
          } catch (err) {}
        }
        if (paths.length===0) { continue }
        item.paths = paths
      }
      this.items.push(prepareItem(item))
    }
    this.updateLoadingMessage()
    for (let item of this.items) {
      if (item.scan) {
        for (let dirPath of item.paths) {
          if (dirPath in this.tasks) { continue }
          this.tasks[dirPath] = this.scanDir(dirPath, item.tags)
        }
      }
    }
    await Promise.all(Object.values(this.tasks)).then(() => {
      if (!this.useCache) { return }
      try {
        this.dumpCache()
      } catch (err) {
        console.error(err)
      }
    })
  }

  scanDir(dirPath, tags) {
    return new Promise((resolve, reject) => {
      if (this.restart) { return reject() }
      const taskPath = require.resolve('./pscan')
      const task = Task.once(taskPath, dirPath)
      task.once('project-list:scan', (data) => {
        delete this.tasks[dirPath]
        for (let entry of data.entries) {
          this.items.push(prepareItem({ title: path.basename(entry), tags: tags, paths: [entry]}))
        }
        this.updateLoadingMessage()
        resolve()
      })
    })
  }

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
    const item = this.slv.getSelectedItem()
    if (!item) { return } else { this.hide() }
    const data = prepareData(item)
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
    this.hide()
  }

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

  edit() {
    atom.workspace.open(this.getPath())
  }

  findCurrentProject() {
    delete atom.project.title
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
}

function prepareItem(item) {
  item.text = Diacritics.clean(item.tags ?
    item.tags.map(x=>`#${x} `).join('') + item.title : item.title)
  item.paths = item.paths.map((ppath) => {
    return ppath.split(/[\\\/]/g).join(path.sep)+path.sep
  })
  return item
}

function prepareData(item) {
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
