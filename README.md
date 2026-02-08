# project-list

Quick access and switching between projects. Manage projects with tags, scanning, and recent history from a fuzzy-searchable list.

![project-list](https://github.com/asiloisad/pulsar-project-list/raw/master/assets/project-list.png)

![recent-list](https://github.com/asiloisad/pulsar-project-list/raw/master/assets/recent-list.png)

## Features

- **Project list**: Browse and open saved projects with `F10`.
- **Recent list**: Access recently opened projects with `Alt+F10`.
- **Directory scanning**: Auto-discover projects in directories.
- **Tags support**: Organize and filter projects by tags.
- **Multiple paths**: Projects can span multiple directories.
- **Tree view integration**: When used with [tree-view-plus](https://github.com/asiloisad/pulsar-tree-view-plus), the empty project view provides quick access to the project list and recent projects.

## Installation

To install `project-list` search for [project-list](https://web.pulsar-edit.dev/packages/project-list) in the Install pane of the Pulsar settings or run `ppm install project-list`. Alternatively, you can run `ppm install asiloisad/pulsar-project-list` to install a package directly from the GitHub repository.

## `projects.cson`

You can edit a file by command `project-list:edit` or by manually opening `<config-dir>/projects.cson`. The main file structure consists of a array of objects.

| Setting | Type | Description | Default |
| --- | --- | --- | --- |
| `title` | `string` | Project title used in the project list | *mandatory* |
| `paths` | `string[]` | The array of paths to project directories | *mandatory* |
| `tags` | `string[]` | The tags help's organize and find projects | `[]` |
| `scan` | `boolean\|string\|string[]` | scan paths and add subdirs as projects. A `true` is equal to `"*/"`. [More...](https://github.com/isaacs/node-glob?tab=readme-ov-file#glob-primer) | `false` |
| `icon` | `string` | custom icon of project e.g. `"icon-star"` | `"icon-file-directory"` |
| `devMode` | `boolean` | project should open in [Dev Mode](https://pulsar-edit.dev/docs/launch-manual/sections/core-hacking/#running-in-development-mode) | `false` |
| `safeMode` | `boolean` | project should open in [Safe Mode](https://pulsar-edit.dev/docs/launch-manual/sections/core-hacking/#using-safe-mode) | `false` |

Here is an example of `projects.cson`:

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
    scan: true
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
    scan: [
      "*/"
      "*/[1233456798]*/"
    ]
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

## Commands

Commands available in `atom-workspace`:

- `project-list:toggle`: (`F10`) opens project list,
- `project-list:recent`: (`Alt+F10`) opens recent list,
- `project-list:update`: update projects list,
- `project-list:edit`: (`Ctrl+F10`) open configuration file.

Commands available in `.project-list`:

- `select-list:open`: (`Enter`) opens a new window with selected project,
- `select-list:swap`: (`Alt+Enter`) closes active window and opens a new one with the selected project,
- `select-list:switch`: (`Ctrl+Enter`) switches to a new window with the selected project,
- `select-list:append`: (`Shift+Enter`) appends selected project to active window,
- `select-list:paste`: (`Alt+V`) paste paths into active text-editor,
- `select-list:update`: (`F5`) update projects list.

## Configuration

The package provides several configuration options available in Settings → Packages → project-list:

### Enable keystroke hints

Shows info message with available keyboard shortcuts at the bottom of the project list panel.

- **Type**: Boolean
- **Default**: `true`

### Use cached data

When enabled, the parsed project list is stored in a cache file located in the Pulsar cache directory (`<config-dir>/compile-cache/projects.json`). This significantly improves performance when using the `scan` feature, as the package doesn't need to re-scan directories every time you open the project list. The cache is automatically updated when the `projects.cson` file changes.

- **Type**: Boolean
- **Default**: `true`

### Existing items only

When enabled, only adds projects to the list if at least one of their paths exists on the filesystem. This helps keep the project list clean by filtering out projects with non-existent directories.

- **Type**: Boolean
- **Default**: `true`

### Parse [tags] in titles

When enabled, any text in the format `[tag]` within project titles will be parsed and displayed as styled tag elements (similar to the regular tags). For example, a title like `My Project [dev]` will display "dev" as a styled tag.

- **Type**: Boolean
- **Default**: `true`

### Modify window title

Controls how the window title is modified when the open folders match a project's paths:

- **0**: Original title (no modification)
- **1**: Project title only
- **2**: Project title — Original title
- **3**: [Project title] Original title
- **Type**: Integer (0-3)
- **Default**: `1`

## Service

The package provides services for other packages:

### project-list (v1.0.0)

Provides access to the project list manager instance.

### recent-list (v1.0.0)

Provides access to the recent projects list manager instance.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub — any feedback's welcome!
