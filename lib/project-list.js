'use babel'
/** @jsx etch.dom */

import etch from 'etch'
import { CompositeDisposable, File } from 'atom'
import SelectListView from 'atom-select-list'
import fs from 'fs'
import CSON from 'cson'
import Diacritics from 'diacritic'
import zadeh from 'zadeh'
import path from 'path'
import fg from 'fast-glob'

export default class ProjectList {

  constructor(S) {
    this.S = S
    this.items = null
    this.slist = new SelectListView({
      items: [],
      maxResults: this.getMaxResults(),
      emptyMessage: this.getEmptyMessage(),
      elementForItem: this.elementForItem.bind(this),
      didCancelSelection: this.didCancelSelection.bind(this),
      filter: this.filter.bind(this),
    })
    this.slist.element.classList.add('project-list')
    this.slist.element.classList.add('command-palette')
    this.panel = atom.workspace.addModalPanel({ item: this.slist })
    this.disposables = new CompositeDisposable()
    this.disposables.add(
      atom.config.observe('command-palette.preserveLastSearch', (value) => {
        this.preserveLastSearch = value
      }),
      atom.config.observe('project-list.showKeystrokes', (value) => {
        this.showKeystrokes = value
        this.slist.update({ infoMessage:this.getInfoMessage() })
      }),
      atom.commands.add('atom-workspace', {
        'project-list:toggle': () => this.toggle(),
        'project-list:update': () => this.update(true),
        'project-list:edit'  : () => this.edit(),
      }),
      atom.commands.add(this.slist.element, {
        'select-list:open'  : () => this.didConfirmSelection('open'),
        'select-list:swap'  : () => this.didConfirmSelection('swap'),
        'select-list:append': () => this.didConfirmSelection('append'),
        'select-list:paste' : () => this.didConfirmSelection('paste'),
      }),
      new File(this.getPath()).onDidChange(() => { this.items = null }),
    )
  }

  destroy() {
    this.disposables.dispose()
    this.panel.destroy()
    this.slist.destroy()
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
    return [<span>{'Indexing project\u2026'}</span>, <span class='loading loading-spinner-tiny'/>]
  }

  getPath() {
    return `${atom.getConfigDirPath()}/projects.cson`
  }

  show() {
    this.previouslyFocusedElement = document.activeElement
    if (this.preserveLastSearch) {
      this.slist.refs.queryEditor.selectAll()
    } else {
      this.slist.reset()
    }
    this.panel.show()
    this.slist.focus()
  }

  hide() {
    this.panel.hide()
    this.previouslyFocusedElement.focus()
  }

  toggle() {
    if (this.panel.isVisible()) {
      this.hide()
    } else {
      this.update()
      this.show()
    }
  }

  update(force) {
    if (force || !this.items) {
      this.slist.update({ items: [],
        loadingMessage: this.getLoadingMessage(), infoMessage: null, errorMessage: null })
      this.cache().then(() => {
        this.slist.update({ items: this.items,
          loadingMessage: null, infoMessage: this.getInfoMessage(), errorMessage: null })
      }).catch(() => {
        this.slist.update({ items: [],
          loadingMessage: null, infoMessage: null, errorMessage: this.getErrorMessage() })
      })
    }
  }

  cache() {
    return new Promise((resolve) => {
      let naviPath = this.getPath()
      if (!fs.existsSync(naviPath)) {
        this.items = []
        return
      }
      this.items = CSON.parseFile(naviPath)
      let promises = []
      for (let item of [...this.items]) {
        if (item.scan) {
          for (let dirPath of item.paths) {
            promises.push(this.scanDir(item, dirPath))
          }
        }
      }
      Promise.all(promises).then(() => {
        for (let item of this.items) {
          // create text for fuzzy-finder
          item.text = Diacritics.clean(item.tags ? item.tags.map(x=>`#${x} `).join('') + item.title : item.title)
          // normalize paths
          item.paths = item.paths.map((ppath) => { return ppath.split(/[\\\/]/g).join(path.sep)+path.sep })
          // initialize values
          item.score = 0 ; item.indices = []
        }
        resolve()
      })
    })
  }

  scanDir(masterItem, dirPath) {
    return fg.glob('*', { cwd: dirPath, onlyDirectories: true }).then((entries) => {
      for (let entry of entries) {
        let item = { title: path.basename(entry), tags: masterItem.tags, paths: [path.join(dirPath, entry)]}
        this.items.push(item)
      }
    }).catch(() => {
      console.error(`Cannot scan "${dirPath}"`)
    })
  }

  filter(items, query) {
    if (query.length===0) {
      items.forEach((item) => { item.score = 0 ; item.indices = [] })
      return items
    }
    query = Diacritics.clean(query)
    let scoredItems = []
    for (let item of items) {
      item.score = zadeh.score(item.text, query)
      if (item.score<=0) { continue }
      item.indices = zadeh.match(item.text, query)
      if (!item.indices) { item.indices = [] }
      scoredItems.push(item)
    }
    return scoredItems.sort((a,b) => b.score-a.score)
  }

  elementForItem(item, options) {
    let li = document.createElement('li')
    if (!options.visible) { return li }
    li.classList.add('two-lines')
    let e1 = document.createElement('div')
    e1.classList.add('primary-line')
    let total = 0
    if (item.tags) {
      for (let tag of item.tags) {
        let et = document.createElement('span')
        et.classList.add('tag')
        total += 1
        this.highlightInElement(et, tag, item.indices.map(x=>x-total))
        total += 1 + tag.length
        e1.appendChild(et)
      }
    }
    this.highlightInElement(e1, item.title, item.indices.map(x=>x-total))
    li.appendChild(e1)
    for (let dirPath of item.paths) {
      let ep = document.createElement('div')
      ep.classList.add('icon', 'icon-line')
      if (this.S.addIconToElement) {
        this.S.addIconToElement(ep, dirPath)
      } else {
        ep.classList.add('icon-file-directory')
      }
      let ei = document.createElement('span')
      ei.classList.add('secondary-line')
      ei.innerHTML = dirPath
      ep.appendChild(ei)
      li.appendChild(ep)
    }
    li.addEventListener('contextmenu', () => { this.slist.selectIndex(options.index) })
    return li
  }

  didConfirmSelection(mode) {
    let item = this.slist.getSelectedItem()
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
      editor.insertText(item.paths.join('\n'))
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
}
