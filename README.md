# project-list

![project-list](https://github.com/bacadra/pulsar-project-list/raw/master/assets/project-list.png)

![recent-list](https://github.com/bacadra/pulsar-project-list/raw/master/assets/recent-list.png)

Get easy access to all your projects and manage them with project specific options. The project file is located in the Pulsar configuration files under the name `project.cson`.

## Installation

To install `project-list` search for [project-list](https://web.pulsar-edit.dev/packages/project-list) in the Install pane of the Pulsar settings or run `ppm install project-list`. Alternatively, you can run `ppm install bacadra/pulsar-project-list` to install a package directly from the Github repository.

## `project.cson`

You can edit a file by command `project-list:edit` or by manually opening `<config-dir>/project.cson`. The main file structure consists of a array of objects.

Setting | Type | Description | Default
-|-|-|-
`title` | `string` | Project title used in the project list | *mandatory*
`paths` | `array[string]` | The array of paths to project directories | *mandatory*
`tags` | `array[string]` | The tags help's organize and find projects | `[]`
`scan` | `boolean` | scan paths and add subdir as projects | `false`
`icon` | `string` | custom icon of project e.g. `"icon-star"` | `"icon-file-directory"`
`devMode` | `boolean` | project should open in [Dev Mode](https://pulsar-edit.dev/docs/launch-manual/sections/core-hacking/#running-in-development-mode) | `falsse`
`safeMode` | `boolean` | project should open in [Safe Mode](https://pulsar-edit.dev/docs/launch-manual/sections/core-hacking/#using-safe-mode) | `false`

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
    devMode: true
  }
]
```

## Shortcuts

In the `atom-workspace` space, the following commands are available:

- `project-list:toggle`: (default `F10`) opens the project list.
- `project-list:recent`: (default `Alt-F10`) opens the recent projects.
- `project-list:update`: manually update the projects list.
- `project-list:edit`: open the project configuration file.

In the `project-list` view, the following keymap is available:

- `Enter`: opens a new window with the selected project.
- `Alt-Enter`: closes the active window and opens a new one with the selected project.
- `Shift-Enter`: appends the selected project to the projects in the active window.

## Configuration

The `Preserve last search` config option is used from the `command-palette` package.

# Contributing

If you have any ideas on how to improve the package, spot any bugs, or would like to support the development of new features, please feel free to share them via GitHub.
