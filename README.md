# project-list

<p align="center">
  <a href="https://github.com/bacadra/atom-project-list/tags">
  <img src="https://img.shields.io/github/v/tag/bacadra/atom-project-list?style=for-the-badge&label=Latest&color=blue" alt="Latest">
  </a>
  <a href="https://github.com/bacadra/atom-project-list/issues">
  <img src="https://img.shields.io/github/issues-raw/bacadra/atom-project-list?style=for-the-badge&color=blue" alt="OpenIssues">
  </a>
  <a href="https://github.com/bacadra/atom-project-list/blob/master/package.json">
  <img src="https://img.shields.io/github/languages/top/bacadra/atom-project-list?style=for-the-badge&color=blue" alt="Language">
  </a>
  <a href="https://github.com/bacadra/atom-project-list/blob/master/LICENSE">
  <img src="https://img.shields.io/github/license/bacadra/atom-project-list?style=for-the-badge&color=blue" alt="Licence">
  </a>
</p>

## Installation

### Atom Text Editor

The official Atom packages store has been [disabled](https://github.blog/2022-06-08-sunsetting-atom/). To obtain the latest version, please run the following shell command:

```shell
apm install bacadra/atom-project-list
```

This will allow you to directly download the package from the GitHub repository.

### Pulsar Text Editor

The package is compatible with [Pulsar](https://pulsar-edit.dev/) and can be installed using the following command:

```shell
ppm install bacadra/atom-project-list
```

Alternatively, you can directly install [project-list](https://web.pulsar-edit.dev/packages/project-list) from the Pulsar package store.

## Project list

![project-list](https://github.com/bacadra/atom-project-files/raw/master/assets/project-list.png)

The Project list is a window that makes it easier to navigate through projects. The project file is located in the Atom configuration files under the name `project.cson`. The file must be a valid `.cson` file. The main file structure consists of a list of objects with the following keys:

* `title`: [string] the name of the project.
* `paths`: [list of strings] the list of paths that describe the project.
* `tags`: [list of strings] (optional) tags for the project.
* `subsQ`: [boolean] (optional) flag to include subfolders as projects.

Here is an example of `project.cson`:

```cson
[
  {
    title: "py-bacadra",
    paths: [
      "c:/bacadra/"
    ],
    tags: [
      "bacadra"
    ]
  },
  {
    title: "projects",
    paths: [
      "c:/projects/",
      "d:/projects/"
    ],
    tags: [
      "projects"
    ],
    subsQ: true
  },
  {
    title: "samples",
    paths: [
      "c:/samples/"
    ],
    tags: [
      "projects"
    ]
  }
]
```

In the `atom-workspace` space, the following commands are available:

* `project-files:projects-toggle`: (default `F10`) opens the project list.
* `project-files:projects-edit`: edits the project list in Atom.
* `project-files:projects-cache`: manually caches the projects.

In the `project-list` view, the following keymap is available:

* `Enter`: opens a new window with the selected project.
* `Alt-Enter`: closes the active window and opens a new one with the selected project.
* `Shift-Enter`: appends the selected project to the projects in the active window.
* `Alt-Q`: changes the query to the project file path of the selected item (does not hide the view).
* `Alt-S`: changes the query to the selection (does not hide the view).

## Recent list

![recent-list](https://github.com/bacadra/atom-project-files/raw/master/assets/recent-list.png)

In the `atom-workspace` space, the following command is available:

* `project-files:recent-toggle`: (default `Alt+F10`) opens the recent projects.

In the `recent-list` view, the following keymap is available:

* `Enter`: opens a new window with the selected project.
* `Alt-Enter`: closes the active window and opens a new one with the selected project.
* `Shift-Enter`: appends the selected project to the projects in the active window.
* `Alt-S`: changes the query to the selection (does not hide the view).

## Configuration

The `Preserve last search` config option is used from the `command-palette` package. The [file-icons](https://github.com/file-icons/atom) package is required for this functionality.

# Contributing [🍺](https://www.buymeacoffee.com/asiloisad)

If you have any ideas on how to improve the package, spot any bugs, or would like to support the development of new features, please feel free to share them via GitHub.
