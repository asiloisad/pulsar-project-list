'use babel'
/** @jsx etch.dom */

import etch from 'etch'
import { CompositeDisposable } from 'atom'
import SelectListView from 'atom-select-list'
import Diacritics from 'diacritic'
import zadeh from 'zadeh'
import path from 'path'

export default class ProjectList {

  constructor(S) {
    this.S = S
    this.items = null
    this.slv = new SelectListView({
      items: [],
      maxResults: this.getMaxResults(),
      emptyMessage: this.getEmptyMessage(),
      elementForItem: this.elementForItem.bind(this),
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
        this.items = null
      })   ,
      atom.config.observe('project-list.showKeystrokes', (value) => {
        this.showKeystrokes = value
        this.slv.update({ infoMessage:this.getInfoMessage() })
      }),
      atom.commands.add('atom-workspace', {
        'project-list:recent': () => this.toggle(),
      }),
      atom.commands.add(this.slv.element, {
        'select-list:open'  : () => this.didConfirmSelection('open'),
        'select-list:swap'  : () => this.didConfirmSelection('swap'),
        'select-list:append': () => this.didConfirmSelection('append'),
        'select-list:paste' : () => this.didConfirmSelection('paste'),
      }),
    )
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

  getLoadingMessage() {
    return [<span>{'Indexing project\u2026'}</span>, <span class='loading loading-spinner-tiny'/>]
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
    if (!this.items) {
      this.items = []
      this.updateLoadingMessage()
      this.cache().then(() => {
        this.updateInfoMessage()
      })
      .catch(() => {
        this.updateErrorMessage()
      })
    }
  }

  cache() {
    return new Promise((resolve) => {
      this.items = []
      for (let project of atom.history.getProjects()) {
        let item = {
          paths: project.paths.map((ppath) => { return ppath.split(/[\\\/]/g).join(path.sep)+path.sep }),
        }
        // initialize values
        item.score = 0 ; item.indices = [] ; item.index = null
        // push item
        this.items.push(item)
      }
      resolve()
    })
  }

  filter(items, query) {
    if (query.length===0) {
      items.forEach((item) => { item.score = 0 ; item.indices = [] ; item.index = null })
      return items
    }
    query = Diacritics.clean(query)
    let scoredItems = []
    for (let item of items) {
      for (let i=0 ; i<item.paths.length ; i++) {
        let score = zadeh.score(item.paths[i], query)
        if (item.score<score) {
          item.score = score
          item.index = i
        }
      }
      if (item.score<=0) { continue }
      item.indices = zadeh.match(item.paths[item.index], query)
      if (!item.indices) { item.indices = [] }
      scoredItems.push(item)
    }
    return scoredItems.sort((a,b) => b.score-a.score)
  }

  elementForItem(item, options) {
    let li = document.createElement('li')
    if (!options.visible) { return li }
    for (let i=0 ; i<item.paths.length ; i++) {
      let ep = document.createElement('div')
      this.assignIcon(ep, item.paths[i])
      let ei = document.createElement('span')
      ei.classList.add('secondary-line')
      if (i===item.index) {
        this.highlightInElement(ei, item.paths[i], item.indices)
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
    let item = this.slv.getSelectedItem()
    if (!item) { return } else { this.hide() }
    if (mode==='open') {
      atom.open({ pathsToOpen:item.paths })
    } else if (mode==='swap') {
      let closed = atom.project.getPaths().length ? true : false
      atom.open({ pathsToOpen:item.paths })
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

  assignIcon(ep, dirPath) {
    ep.classList.add('icon', 'icon-line', 'icon-file-directory')
  }
}
