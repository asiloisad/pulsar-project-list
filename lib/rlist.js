'use babel'
/** @jsx etch.dom */

const etch = require('etch')
const { CompositeDisposable } = require('atom')
const SelectListView = require('atom-select-list')
const Diacritics = require('diacritic')
const path = require('path')
const fs = require('fs')

module.exports = class PList {

  constructor() {
    this.items = [] ; this.restart = true
    this.slv = new SelectListView({
      items: [],
      maxResults: 50,
      emptyMessage: this.getEmptyMessage(),
      elementForItem: this.elementForItem.bind(this),
      didConfirmSelection: this.didConfirmSelection.bind(this, 'open'),
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
      atom.history.onDidChangeProjects(() => {
        this.restart = true
      }),
      atom.config.observe('project-list.showKeystrokes', (value) => {
        this.showKeystrokes = value
        this.slv.update({ infoMessage:this.getInfoMessage() })
      }),
      atom.commands.add('atom-workspace', {
        'project-list:recent': () => this.toggle(),
      }),
      atom.commands.add(this.slv.element, {
        'project-list:open': () => this.didConfirmSelection('open'),
        'project-list:swap': () => this.didConfirmSelection('swap'),
        'project-list:append': () => this.didConfirmSelection('append'),
        'project-list:paste': () => this.didConfirmSelection('paste'),
        'project-list:update': () => this.refresh(),
      }),
    )
  }

  destroy() {
    this.disposables.dispose()
    if (this.panel) { this.panel.destroy() }
    this.slv.destroy()
  }

  getEmptyMessage() {
    return <div class='empty-message'>No matches found</div>
  }

  getInfoMessage() {
    return this.showKeystrokes ? ['Press ', <span class='keystroke'>Enter</span>, ', ', <span class='keystroke'>Alt-Enter</span>, ', ', <span class='keystroke'>Shift-Enter</span>, ' or ', <span class='keystroke'>Alt-V</span>] : null
  }

  getLoadingMessage() {
    return [<span>{'Indexing project\u2026'}</span>, <span class='loading loading-spinner-tiny'/>]
  }

  updateInfoMessage() {
    this.slv.update({ items: this.items,
      loadingMessage: null, infoMessage: this.getInfoMessage(), errorMessage: null })
  }

  updateLoadingMessage() {
    this.slv.update({ items: [],
      loadingMessage: this.getLoadingMessage(), infoMessage: null, errorMessage: null })
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

  refresh() {
    this.restart = true
    this.update()
  }

  update() {
    if (this.restart) {
      this.restart = false ; this.items = []
      this.updateLoadingMessage()
      this.cache()
      .then(() => {
        this.updateInfoMessage()
      })
    }
  }

  cache() {
    return new Promise((resolve) => {
      for (let project of atom.history.getProjects()) {
        this.items.push({
          paths: project.paths.map((ppath) => { return ppath.split(/[\\\/]/g).join(path.sep)+path.sep }),
        })
      }
      resolve()
    })
  }

  filter(items, query) {
    this.query = Diacritics.clean(query)
    if (this.query.length===0) {
      return items
    }
    const scoredItems = []
    for (const item of items) {
      let scores = [] ; item.score = 0
      for (let i=0 ; i<item.paths.length ; i++) {
        let score = atom.ui.fuzzyMatcher.score(item.paths[i], this.query)
        if (score>item.score) { item.score = score ; item.ibest = i }
      }
      if (item.score>0) { scoredItems.push(item) }
    }
    return scoredItems.sort((a, b) => b.score - a.score)
  }

  elementForItem(item, options) {
    let li = document.createElement('li')
    if (!options.visible) { return li }
    for (let i=0 ; i<item.paths.length ; i++) {
      let ep = document.createElement('div')
      ep.classList.add('icon', 'icon-line', 'icon-file-directory')
      let ei = document.createElement('span')
      ei.classList.add('secondary-line')
      if (i===item.ibest) {
        let indices = this.query.length>0 ? atom.ui.fuzzyMatcher.match(item.paths[item.ibest], this.query, { recordMatchIndexes:true }).matchIndexes : []
        this.highlightInElement(ei, item.paths[item.ibest], indices)
      } else {
        ei.innerHTML = item.paths[i]
      }
      ep.appendChild(ei)
      li.appendChild(ep)
    }
    li.addEventListener('contextmenu', () => { this.slv.selectIndex(options.index) })
    return li
  }

  didConfirmSelection(mode) {
    if (!mode) { mode = 'open' }
    let item = this.slv.getSelectedItem()
    if (!item) { return } else { this.hide() }
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
