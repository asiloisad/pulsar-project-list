# project-list

<p align="center">
  <a href="https://github.com/bacadra/pulsar-project-list/tags">
  <img src="https://img.shields.io/github/v/tag/bacadra/pulsar-project-list?style=for-the-badge&label=Latest&color=blue" alt="Latest">
  </a>
  <a href="https://github.com/bacadra/pulsar-project-list/issues">
  <img src="https://img.shields.io/github/issues-raw/bacadra/pulsar-project-list?style=for-the-badge&color=blue" alt="OpenIssues">
  </a>
  <a href="https://github.com/bacadra/pulsar-project-list/blob/master/package.json">
  <img src="https://img.shields.io/github/languages/top/bacadra/pulsar-project-list?style=for-the-badge&color=blue" alt="Language">
  </a>
  <a href="https://github.com/bacadra/pulsar-project-list/blob/master/LICENSE">
  <img src="https://img.shields.io/github/license/bacadra/pulsar-project-list?style=for-the-badge&color=blue" alt="Licence">
  </a>
</p>

![project-list](https://github.com/bacadra/pulsar-project-list/raw/master/assets/project-list.png)

![recent-list](https://github.com/bacadra/pulsar-project-list/raw/master/assets/recent-list.png)

The Project list is a window that makes it easier to navigate through projects. The project file is located in the Pulsar configuration files under the name `project.cson`.

## Installation

To install `project-list` search for [project-list](https://web.pulsar-edit.dev/packages/project-list) in the Install pane of the Pulsar settings or run `ppm install project-list`.

Alternatively, run `ppm install bacadra/pulsar-project-list` to install a package directly from Github repository.

## Projects...

The project file must be a valid `.cson` file. The main file structure consists of a list of objects with the following keys:

* `title`: [string] the name of the project.
* `paths`: [list of strings] the list of paths that describe the project.
* `tags`: [list of strings] (optional) tags for the project.
* `scan`: [boolean] (optional) flag to include subfolders as projects.

Here is an example of `project.cson`:

```cson
[
  {
    title: "py-bacadra",
    paths: [
      "C:/bacadra/"
    ],
    tags: [
      "bacadra"
    ]
  },
  {
    title: "Projects",
    paths: [
      "C:/Projects/",
      "D:/Projects/"
    ],
    tags: [
      "Projects"
    ],
    scan: true
  },
  {
    title: "Samples",
    paths: [
      "C:/Samples/"
    ],
    tags: [
      "Samples"
    ]
  }
]
```

## Shortcuts

In the `atom-workspace` space, the following commands are available:

* `project-list:toggle`: (default `F10`) opens the project list.
* `project-list:recent`: (default `Alt-F10`) opens the recent projects.
* `project-list:update`: manually update the projects list.
* `project-list:edit`: open the project configuration file.

In the `project-list` view, the following keymap is available:

* `Enter`: opens a new window with the selected project.
* `Alt-Enter`: closes the active window and opens a new one with the selected project.
* `Shift-Enter`: appends the selected project to the projects in the active window.

## Configuration

The `Preserve last search` config option is used from the `command-palette` package.

# Contributing [🍺](https://www.buymeacoffee.com/asiloisad)

If you have any ideas on how to improve the package, spot any bugs, or would like to support the development of new features, please feel free to share them via GitHub.
