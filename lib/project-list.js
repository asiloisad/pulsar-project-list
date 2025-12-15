/** @babel */

const { Disposable, CompositeDisposable, File, Task } = require("atom");
const {
  SelectListView,
  highlightMatches,
} = require("pulsar-select-list");
const fs = require("fs");
const CSON = require("cson");
const path = require("path");

module.exports = class ProjectList {
  // ***** PACKAGE ***** //

  constructor() {
    // initialize
    this.items = [];
    this.restart = true;
    this.restarting = false;

    // files
    this.configFile = new File(this.getConfigPath());
    this.cacheFile = new File(this.getCachePath());

    // create select-list
    this.selectList = new SelectListView({
      className: "project-list",
      items: this.items,
      maxResults: 50,
      emptyMessage: "No matches found",
      helpMarkdown:
        "Available commands:\n" +
        '- **Enter** — Open in new window\n' +
        '- **Alt+Enter** — Swap current window\n' +
        '- **Ctrl+Enter** — Switch in same window\n' +
        '- **Shift+Enter** — Append to current window\n' +
        '- **Alt+V** — Insert path',
      removeDiacritics: true,
      elementForItem: (item, options) => this.elementForItem(item, options),
      didConfirmSelection: () => this.performAction("open"),
      didCancelSelection: () => this.didCancelSelection(),
      willShow: () => this.onWillShow(),
      filterKeyForItem: (item) => item.text,
    });

    // create disposables
    this.disposables = new CompositeDisposable();
    this.subCacheFile1 = new Disposable();
    this.subCacheFile2 = new Disposable();

    // watch required config
    this.disposables.add(
      atom.config.observe("project-list.useCache", (value) => {
        this.useCache = value;
      }),
      atom.config.observe("project-list.checkExists", (value) => {
        this.checkExists = value;
      }),
      atom.config.observe("project-list.parseTitleTags", (value) => {
        this.parseTitleTagsEnabled = value;
        this.restart = true;
      })
    );

    // watch config for window title
    this.disposables.add(
      atom.config.observe("project-list.windowTitle", (value) => {
        this.windowTitle = value;
        atom.workspace.updateWindowTitle();
      }),
      atom.project.onDidChangePaths(() => {
        this.findCurrentProject();
      })
    );

    // add global & local shortcuts
    this.disposables.add(
      atom.commands.add("atom-workspace", {
        "project-list:toggle": () => this.selectList.toggle(),
        "project-list:update": () => this.updateView(false),
        "project-list:edit": () => this.editConfig(),
      }),
      atom.commands.add(this.selectList.element, {
        "select-list:open": () => this.performAction("open"),
        "select-list:swap": () => this.performAction("swap"),
        "select-list:switch": () => this.performAction("switch"),
        "select-list:append": () => this.performAction("append"),
        "select-list:paste": () => this.performAction("paste"),
        "select-list:update": () => this.updateView(false),
      })
    );

    // find window title if required
    this.patchWindowTitle();
    if (this.windowTitle) {
      this.updateView();
    }

    // watch config file
    this.observeConfigFile();
  }

  destroy() {
    this.subCacheFile1.dispose();
    this.subCacheFile2.dispose();
    this.disposables.dispose();
    this.selectList.destroy();
  }

  getConfigPath() {
    return `${atom.getConfigDirPath()}/projects.cson`;
  }

  getCachePath() {
    return `${atom.getConfigDirPath()}/compile-cache/projects.json`;
  }

  // ***** VIEW ***** //

  onWillShow() {
    if (this.restart) {
      this.updateView();
    }
  }

  async updateView(loadCache = true) {
    // prevent new updates by .show
    this.restart = false;

    // prevent multiscans
    if (this.restarting) {
      return;
    }
    this.restarting = true;

    // clean cache file watcher
    this.subCacheFile1.dispose();
    this.subCacheFile2.dispose();

    // update element
    this.selectList.update({
      loadingMessage: "Indexing projects\u2026",
      loadingBadge: null,
      errorMessage: null,
    });

    // initialize
    this.items = null;
    const errors = [];

    // try load cache if needed
    if (loadCache && this.useCache && !this.items) {
      try {
        await this.loadCache();
      } catch (err) {
        errors.push(`loadCache: ${err}`);
      }
    }

    // try build cache if needed
    if (!this.items) {
      try {
        await this.buildCache();
      } catch (err) {
        errors.push(`buildCache: ${err}`);
      }
    }

    // if nothing works then...
    if (!this.items) {
      this.items = [];
    }

    // create window title
    this.findCurrentProject();

    // update element
    this.selectList.update({
      items: this.items,
      loadingMessage: null,
      errorMessage: errors.length ? errors.join("\n") : null,
    });

    // create new cache file watcher
    if (this.useCache) {
      setTimeout(() => {
        this.observeCacheFile();
      }, 100);
    }

    // release
    this.restarting = false;
  }

  async updateViewSchedule() {
    this.restart = true;
    if (this.selectList.isVisible()) {
      await this.updateView();
    }
  }

  updateLoading() {
    this.selectList.update({
      items: this.items,
      loadingBadge: this.items.length,
    });
  }

  async observeConfigFile() {
    if (!(await this.configFile.exists())) {
      await this.configFile.create();
      await this.configFile.write("[]");
    }
    this.disposables.add(
      this.configFile.onDidChange(
        debounce(async () => {
          await this.clearCache();
          await this.updateViewSchedule();
        }, 100)
      )
    );
  }

  async observeCacheFile() {
    if (!(await this.cacheFile.exists())) {
      return;
    }
    this.subCacheFile1 = this.cacheFile.onDidChange(
      debounce(async () => {
        await this.updateViewSchedule();
      }, 100)
    );
    this.subCacheFile2 = this.cacheFile.onDidDelete(() => {
      this.subCacheFile1.dispose();
      this.subCacheFile2.dispose();
    });
  }

  // ***** LIST ***** //

  elementForItem(item, options) {
    let li = document.createElement("li");
    li.classList.add("two-lines");
    let e1 = document.createElement("div");
    e1.classList.add("primary-line");
    let total = 0;
    const indices = this.selectList.getMatchIndices(item) || [];

    // Render tags from item.tags array
    if (item.tags) {
      for (let tag of item.tags) {
        let et = document.createElement("span");
        et.classList.add("tag");
        total += 1;
        et.appendChild(highlightMatches(tag, indices.map((x) => x - total)));
        total += 1 + tag.length;
        e1.appendChild(et);
      }
    }

    // Parse and render [tag] patterns from title (if enabled)
    if (this.parseTitleTagsEnabled) {
      const titleParts = this.parseTitleTags(item.title);
      for (let part of titleParts) {
        if (part.isTag) {
          let et = document.createElement("span");
          et.classList.add("square");
          // Include brackets in the displayed text
          let text = "[" + part.text + "]";
          et.appendChild(highlightMatches(text, indices.map((x) => x - total)));
          total += text.length;
          e1.appendChild(et);
        } else {
          e1.appendChild(
            highlightMatches(part.text, indices.map((x) => x - total))
          );
          total += part.text.length;
        }
      }
    } else {
      // Render title as-is without parsing
      e1.appendChild(
        highlightMatches(item.title, indices.map((x) => x - total))
      );
    }

    li.appendChild(e1);
    for (let dirPath of item.paths) {
      let ep = document.createElement("div");
      ep.classList.add("secondary-line");
      ep.classList.add(
        "icon",
        "icon-line",
        item.icon ? item.icon : "icon-file-directory"
      );
      let ei = document.createElement("span");
      ei.textContent = dirPath;
      ep.appendChild(ei);
      li.appendChild(ep);
    }
    return li;
  }

  performAction(mode) {
    if (!mode) {
      mode = "open";
    }
    const item = this.selectList.getSelectedItem();
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
      if (item.devMode || item.safeMode) {
        atom.notifications.addWarning(
          "Cannot switch in same window with devMode or safeMode enabled",
          { detail: "Use 'Open' (Enter) to open in a new window instead." }
        );
        return;
      }
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

  // ***** DATA ***** //

  async dumpCache() {
    await this.cacheFile.create();
    let jsonstr = JSON.stringify(this.items);
    await this.cacheFile.write(jsonstr);
  }

  async loadCache() {
    if (!(await this.cacheFile.exists())) {
      return;
    }
    let data = await this.cacheFile.read(true);
    this.items = JSON.parse(data);
  }

  async clearCache() {
    try {
      this.subCacheFile1.dispose();
      this.subCacheFile2.dispose();
      await fs.promises.rm(this.getCachePath());
    } catch {}
  }

  async buildCache() {
    if (!(await this.configFile.exists())) {
      throw new Error("Config file does not exists");
    }
    const configData = CSON.parse(await this.configFile.read());
    if (configData instanceof Error) {
      throw new Error(configData.message);
    }
    this.items = [];
    for (const item of configData) {
      try {
        if (this.checkExists) {
          let paths = [];
          for (let ppath of item.paths) {
            try {
              await fs.promises.access(ppath);
              paths.push(ppath);
            } catch {}
          }
          if (paths.length === 0) {
            continue;
          }
          item.paths = paths;
        }
        this.items.push(this.prepareItem(item));
      } catch {}
    }
    this.updateLoading();
    const tasks = [];
    for (let item of this.items) {
      if (item.scan) {
        for (let dirPath of item.paths) {
          if (dirPath in tasks) {
            continue;
          }
          tasks[dirPath] = this.scanDir(dirPath, item.tags, item.scan);
        }
      }
    }
    await Promise.all(Object.values(tasks));
    if (this.useCache) {
      await this.dumpCache();
    }
  }

  scanDir(dirPath, tags, scanList) {
    return new Promise((resolve, reject) => {
      const taskPath = require.resolve("./project-scan");
      if (scanList == true) {
        scanList = "*/";
      }
      const task = Task.once(taskPath, { dirPath, scanList });
      task.once("project-list:scan", (data) => {
        for (let entry of data.entries) {
          const item = {
            title: entry,
            tags: tags,
            paths: [path.join(dirPath, entry)],
          };
          this.items.push(this.prepareItem(item));
        }
        this.updateLoading();
        resolve();
      });
    });
  }

  // ***** PROJECT ***** //

  findCurrentProject() {
    delete atom.project.title;
    if (!this.items) {
      return;
    }
    let proPaths = [];
    for (let proPath of atom.project.getPaths()) {
      proPaths.push(proPath + path.sep);
    }
    for (let item of this.items) {
      if (item.paths.length !== proPaths.length) {
        continue;
      }
      let br = false;
      for (let proPath of proPaths) {
        if (!item.paths.includes(proPath)) {
          br = true;
          break;
        }
      }
      if (br) {
        continue;
      }
      atom.project.title = item.title;
      atom.workspace.updateWindowTitle();
      return item;
    }
  }

  patchWindowTitle() {
    let _updateWindowTitle = atom.workspace.updateWindowTitle;
    atom.workspace.updateWindowTitle = () => {
      _updateWindowTitle();
      if (!atom.project.title) {
        return;
      } else if (this.windowTitle === 1) {
        document.title = atom.project.title;
      } else if (this.windowTitle === 2) {
        document.title = atom.project.title + " — " + document.title;
      } else if (this.windowTitle === 3) {
        document.title = "[" + atom.project.title + "] " + document.title;
      }
    };
  }

  // ***** TOOLS ***** //

  parseTitleTags(title) {
    const parts = [];
    let lastIndex = 0;
    const regex = /\[([^\]]+)\]/g;
    let match;

    while ((match = regex.exec(title)) !== null) {
      // Add text before the tag
      if (match.index > lastIndex) {
        parts.push({
          text: title.substring(lastIndex, match.index),
          isTag: false,
        });
      }

      // Add the tag content
      parts.push({
        text: match[1],
        isTag: true,
      });

      lastIndex = regex.lastIndex;
    }

    // Add remaining text after the last tag
    if (lastIndex < title.length) {
      parts.push({
        text: title.substring(lastIndex),
        isTag: false,
      });
    }

    return parts;
  }

  editConfig() {
    atom.workspace.open(this.getConfigPath());
  }

  prepareItem(item) {
    item.text = (
      item.tags
        ? item.tags.map((x) => `#${x} `).join("") + item.title
        : item.title
    );
    item.paths = item.paths.map((ppath) => {
      return ppath.split(/[\\\/]/g).join(path.sep) + path.sep;
    });
    return item;
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

function debounce(func, timeout) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}
