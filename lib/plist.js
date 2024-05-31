'use babel'
/** @jsx etch.dom */

import etch from 'etch'
import { CompositeDisposable, File, Task } from 'atom'
import SelectListView from 'atom-select-list'
import fs from 'fs'
import CSON from 'cson'
import Diacritics from 'diacritic'
import path from 'path'

export default class PList {

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
      atom.config.observe('project-list.windowTitle', (value) => {
        this.windowTitle = value ; atom.workspace.updateWindowTitle()
      }),
      atom.commands.add('atom-workspace', {
        'project-list:toggle': () => this.toggle(),
        'project-list:update': () => { this.restart = true ; this.update() },
        'project-list:edit' : () => this.edit(),
      }),
      atom.commands.add(this.slv.element, {
        'select-list:open': () => this.didConfirmSelection('open'),
        'select-list:swap': () => this.didConfirmSelection('swap'),
        'select-list:append': () => this.didConfirmSelection('append'),
        'select-list:paste': () => this.didConfirmSelection('paste'),
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
    return <div class='error-message'>Cannot parse "project.cson" file</div>
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
    this.slv.update({ items: this.items,
      loadingMessage: this.getLoadingMessage(), infoMessage: null, errorMessage: null })
  }

  getPath() {
    return `${atom.getConfigDirPath()}/projects.cson`
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

  update() {
    if (this.restart) {
      this.restart = false ; this.items = []
      this.updateLoadingMessage()
      this.cache()
      .then(() => {
        this.updateInfoMessage()
      })
      .catch(() => {
        this.updateErrorMessage()
      })
      .then(() => {
        this.findCurrentProject()
      })
    }
  }

  cache() {
    return new Promise((resolve, reject) => {
      let naviPath = this.getPath()
      if (!fs.existsSync(naviPath)) {
        this.items = []
        return reject()
      }
      let result = CSON.parseFile(naviPath, {})
      if ( result instanceof Error ) {
        this.items = []
        console.error(result.stack)
        return reject()
      }
      for (let item of result) {
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
      Promise.all(Object.values(this.tasks)).then(() => { resolve() })
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
    let item = this.slv.getSelectedItem()
    if (!item) { return } else { this.hide() }
    if (mode==='open') {
      atom.open(getParams(item))
    } else if (mode==='swap') {
      let closed = atom.project.getPaths().length ? true : false
      atom.open(getParams(item))
      if (closed) { atom.close() }
    } else if (mode==='append') {
      for (let projectPath of item.paths) {
        atom.project.addPath(projectPath, { mustExist:true })
      }
    } else if (mode==='paste') {
      const editor = atom.workspace.getActiveTextEditor()
      if (!editor) {
        atom.notifications.addError('Cannot insert path, because there is no active text editor')
        return
      }
      editor.insertText(item.paths.join('\n'), { selection: true })
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

function getParams(item) {
  let params = { pathsToOpen:item.paths }
  if (item.devMode) { params.devMode = true }
  if (item.safeMode) { params.safeMode = true }
  return params
}
