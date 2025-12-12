/** @babel */

const { CompositeDisposable } = require("atom");
const SelectListView = require("pulsar-select-list");
const path = require("path");
const fs = require("fs");

module.exports = class RecentList {
  constructor() {
    this.items = [];
    this.restart = true;
    this.selectList = new SelectListView({
      className: "project-list",
      items: [],
      maxResults: 50,
      emptyMessage: "No matches found",
      helpMarkdown: this.getHelpMarkdown(),
      elementForItem: (item, options) => this.elementForItem(item, options),
      didConfirmSelection: () => this.performAction("open"),
      didCancelSelection: () => this.didCancelSelection(),
      willShow: () => this.onWillShow(),
      filter: (items, query) => this.filter(items, query),
    });
    this.disposables = new CompositeDisposable();
    this.disposables.add(
      atom.history.onDidChangeProjects(() => {
        this.restart = true;
      }),
      atom.commands.add("atom-workspace", {
        "project-list:recent": () => this.selectList.toggle(),
      }),
      atom.commands.add(this.selectList.element, {
        "select-list:open": () => this.performAction("open"),
        "select-list:swap": () => this.performAction("swap"),
        "select-list:switch": () => this.performAction("switch"),
        "select-list:append": () => this.performAction("append"),
        "select-list:paste": () => this.performAction("paste"),
        "select-list:update": () => this.refresh(),
      })
    );
  }

  destroy() {
    this.disposables.dispose();
    this.selectList.destroy();
  }

  getHelpMarkdown() {
    return fs.readFileSync(path.join(__dirname, "help.md"), "utf8");
  }

  updateItems() {
    this.selectList.update({
      items: this.items,
      loadingMessage: null,
    });
  }

  updateLoadingMessage() {
    this.selectList.update({
      items: [],
      loadingMessage: "Indexing project\u2026",
    });
  }

  onWillShow() {
    if (this.restart) {
      this.restart = false;
      this.items = [];
      this.updateLoadingMessage();
      this.cache().then(() => {
        this.updateItems();
      });
    }
  }

  refresh() {
    this.restart = true;
    this.onWillShow();
  }

  cache() {
    return new Promise((resolve) => {
      for (let project of atom.history.getProjects()) {
        this.items.push({
          paths: project.paths.map((ppath) => {
            return ppath.split(/[\\\/]/g).join(path.sep) + path.sep;
          }),
          texts: project.paths.map((ppath) => {
            return SelectListView.replaceDiacritics(
              ppath.split(/[\\\/]/g).join(path.sep) + path.sep
            );
          }),
        });
      }
      resolve();
    });
  }

  filter(items, query) {
    query = SelectListView.replaceDiacritics(query);
    if (query.length === 0) {
      return items;
    }
    const scoredItems = [];
    for (const item of items) {
      item.score = 0;
      item.matchIndices = null;
      for (let i = 0; i < item.texts.length; i++) {
        const result = atom.ui.fuzzyMatcher.match(item.texts[i], query, {
          recordMatchIndexes: true,
        });
        if (result && result.score > item.score) {
          item.score = result.score;
          item.ibest = i;
          item.matchIndices = result.matchIndexes;
        }
      }
      if (item.score > 0) {
        scoredItems.push(item);
      }
    }
    return scoredItems.sort((a, b) => b.score - a.score);
  }

  elementForItem(item, options) {
    const indices = item.matchIndices || [];
    const li = document.createElement("li");

    for (let i = 0; i < item.paths.length; i++) {
      const line = document.createElement("div");
      line.classList.add("primary-line", "icon", "icon-file-directory");
      if (i > 0) {
        line.classList.add("icon-line");
      }
      if (i === item.ibest && indices.length > 0) {
        line.appendChild(
          SelectListView.highlightMatches(item.paths[i], indices)
        );
      } else {
        line.textContent = item.paths[i];
      }
      li.appendChild(line);
    }

    return li;
  }

  performAction(mode) {
    if (!mode) {
      mode = "open";
    }
    let item = this.selectList.getSelectedItem();
    if (!item) {
      return;
    } else {
      this.selectList.hide();
    }
    const data = this.prepareData(item);
    if (!data.pathsToOpen.length) {
      return;
    }
    if (mode === "open") {
      atom.open(data);
    } else if (mode === "swap") {
      let closed = atom.project.getPaths().length ? true : false;
      atom.open(data);
      if (closed) {
        atom.close();
      }
    } else if (mode === "switch") {
      atom.project.setPaths(data.pathsToOpen);
    } else if (mode === "append") {
      for (let projectPath of data.pathsToOpen) {
        atom.project.addPath(projectPath, { mustExist: true });
      }
    } else if (mode === "paste") {
      const editor = atom.workspace.getActiveTextEditor();
      if (!editor) {
        atom.notifications.addError(
          "Cannot insert path, because there is no active text editor"
        );
        return;
      }
      editor.insertText(data.pathsToOpen.join("\n"), { selection: true });
    }
  }

  didCancelSelection() {
    this.selectList.hide();
  }

  prepareData(item) {
    const pathsToOpen = [];
    const errs = [];
    for (let projectPath of item.paths) {
      if (
        fs.existsSync(projectPath) &&
        fs.lstatSync(projectPath).isDirectory()
      ) {
        pathsToOpen.push(projectPath);
      } else {
        errs.push(projectPath);
      }
    }
    if (errs.length) {
      atom.notifications.addError("Directory does not exist", {
        detail: errs.join("\n"),
      });
    }
    let params = { pathsToOpen: pathsToOpen, errs: errs };
    if (item.devMode) {
      params.devMode = true;
    }
    if (item.safeMode) {
      params.safeMode = true;
    }
    return params;
  }
};
