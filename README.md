# project-list

Quick access and switching between projects. Manage projects with tags, scanning.

![demo](https://github.com/asiloisad/pulsar-project-list/raw/master/assets/demo.png)

## Features

- **Project list**: Browse and open saved projects.
- **Directory scanning**: Auto-discover projects in directories.
- **Glob paths**: Use wildcard patterns directly in `paths` to expand matching directories at load time.
- **Tags support**: Organize and filter projects by tags.
- **Multiple paths**: Projects can span multiple directories.
- **Multiple open modes**: Open in new window, swap, switch in same window, or append to current window.
- **Dev and safe mode**: Open projects in dev mode or safe mode directly from the list.
- **Visual indicators**: Items configured with `devMode` or `safeMode` are marked with distinct icons in the list.
- **Window title**: Automatically updates the window title to reflect the active project name.
- **Performance cache**: Project list is cached to avoid re-scanning on every open.
- **Tree view integration**: When used with [tree-view-plus](https://github.com/asiloisad/pulsar-tree-view-plus), the empty project view provides quick access to the project list.

## Installation

To install `project-list` search for [project-list](https://web.pulsar-edit.dev/packages/project-list) in the Install pane of the Pulsar settings or run `ppm install project-list`. Alternatively, you can run `ppm install asiloisad/pulsar-project-list` to install a package directly from the GitHub repository.

The [recent-list](https://github.com/asiloisad/pulsar-recent-list) package extends the workflow with a recently opened projects list, fuzzy-searchable and sorted by recency.

## `projects.cson`

You can edit a file by command `project-list:edit` or by manually opening `<config-dir>/projects.cson`. The main file structure consists of a array of objects.

| Setting | Type | Description | Default |
| --- | --- | --- | --- |
| `title` | `string` | Project title used in the project list | *mandatory* |
| `paths` | `string[]` | The array of paths to project directories. Glob wildcards (`*`, `**`, `?`, `[...]`, `{...}`) are supported and expand to all matching directories at load time. | *mandatory* |
| `tags` | `string[]` | The tags help's organize and find projects | `[]` |
| `scan` | `boolean\|string\|string[]` | scan paths and add subdirs as projects. A `true` is equal to `"*/"`. [More...](https://github.com/isaacs/node-glob?tab=readme-ov-file#glob-primer) | `false` |
| `icon` | `string` | custom icon of project e.g. `"icon-star"` | `"icon-file-directory"` |
| `devMode` | `boolean` | project should open in [Dev Mode](https://pulsar-edit.dev/docs/launch-manual/sections/core-hacking/#running-in-development-mode) | `false` |
| `safeMode` | `boolean` | project should open in [Safe Mode](https://pulsar-edit.dev/docs/launch-manual/sections/core-hacking/#using-safe-mode) | `false` |

Here is an example of `projects.cson`:

```cson
[
  {
    title: "My Library",
    paths: [
      "C:/Work/library/"
    ],
    tags: [
      "work"
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
      "work"
    ],
    scan: [
      "*/"
      "*/[1233456798]*/"
    ]
  },
  {
    title: "Core",
    paths: [
      "C:/Work/core/"
    ],
    tags: [
      "work"
    ]
    devMode: true
  },
  {
    title: "Packages",
    paths: [
      "C:/Work/packages/*"
    ],
    tags: [
      "work"
    ]
  }
]
```

## Commands

Commands available in `atom-workspace`:

- `project-list:toggle`: <kbd>F10</kbd> opens project list,
- `project-list:update`: update projects list,
- `project-list:edit`: <kbd>Ctrl+F10</kbd> open configuration file.

Commands available in `.project-list`:

- `select-list:open`: <kbd>Enter</kbd> opens a new window with selected project,
- `select-list:swap`: <kbd>Alt+Enter</kbd> closes active window and opens a new one with the selected project,
- `select-list:switch`: <kbd>Ctrl+Enter</kbd> switches to a new window with the selected project,
- `select-list:append`: <kbd>Shift+Enter</kbd> appends selected project to active window,
- `select-list:paste`: <kbd>Alt+V</kbd> paste paths into active text-editor,
- `select-list:dev`: <kbd>Alt+D</kbd> opens a new window with selected project in dev mode,
- `select-list:safe`: <kbd>Alt+S</kbd> opens a new window with selected project in safe mode,
- `select-list:external`: <kbd>Alt+F12</kbd> open folders externally (via [open-external](https://github.com/asiloisad/pulsar-open-external)),
- `select-list:show`: <kbd>Ctrl+F12</kbd> show folders in explorer (via [open-external](https://github.com/asiloisad/pulsar-open-external)),
- `select-list:update`: <kbd>F5</kbd> update projects list.

## Filtering

The search query is matched against a combined text string in the format `#tag1 #tag2 Title`. Tags are placed first so that a query like `"pulsar pack"` can match a tag `Pulsar` followed by a title `Packages` in the correct order.

Prefixing a query term with `#` targets tags explicitly. For example, `#work` will rank projects tagged `work` much higher, since the `#` character is part of the internal text and aligns directly with the tag prefix.

Fuzzy matching uses the `fuzzaldrin` algorithm. Match scores are further adjusted by:

- **Title length**: shorter titles score higher (common projects rank up),
- **Tag count**: fewer tags score higher (general projects rank up).

## Consumed Service `open-external`

When the [open-external](https://github.com/asiloisad/pulsar-open-external) package is installed, two additional actions become available in both project list: open folders externally and show folders in explorer. For multi-path projects, the action is applied to each path.

## Provided Service `project-list`

Provides access to the project list manager instance. Other packages can use this to query and interact with the saved project list.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
