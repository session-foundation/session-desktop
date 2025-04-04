# Contributor Guidelines

## Advice for new contributors

Start small. The PRs most likely to be merged are the ones that make small,
easily reviewed changes with clear and specific intentions.

[Guidelines on Pull Requests](#pull-requests).

It's a good idea to gauge interest in your intended work by finding the current issue
for it or creating a new one yourself. Use Github issues as a place to signal
your intentions and get feedback from the users most likely to appreciate your changes.

You're most likely to have your pull request accepted if it addresses an existing Github issue marked with the [good-first-issue](https://github.com/session-foundation/session-desktop/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22) tag, these issues are specifically tagged, because they are generally features/bug fixes which can be cleanly merged on a single platform without requiring cross platform work, are generally of lower complexity than larger features and are non contentious, meaning that the core team doesn't need to try and assess the community desire for such a feature before merging.

Of course we encourage community developers to work on ANY issue filed on our Github regardless of how it’s tagged, however if you pick up or create an issue without the “Good first issue” tag it would be best if you leave a comment on the issue so that the core team can give you any guidance required, especially around UI heavy features or issues which require cross platform integration.

# Development setup

## Tips

### Node.js

You'll need a [Node.js](https://nodejs.org/) version which matches our current version. You can check [`.nvmrc` in the `dev` branch](https://github.com/session-foundation/session-desktop/blob/dev/.nvmrc) to see what the current version is.

If you use other node versions you might have or need a node version manager.

- [nvm](https://github.com/nvm-sh/nvm) - you can run `nvm use` in the project directory and it will use the node version specified in `.nvmrc`.
- Some node version management tools can read from the `.nvmrc` file and automatically make the change. If you use [asdf](https://asdf-vm.com/) you can make a [config change](https://asdf-vm.com/guide/getting-started.html#using-existing-tool-version-files) to support the `.nvmrc` file.
- We use [Yarn Classic](https://classic.yarnpkg.com) as our package manager. You can install it by running `npm install --global yarn`.

### Python

You will need a [Python](https://www.python.org) version which matches our current version. You can check [`.tool-versions` in the `dev` branch](https://github.com/session-foundation/session-desktop/blob/dev/.tool-versions) to see what the current version is.

If you use other python versions you might have or need a python version manager.

- [asdf](https://asdf-vm.com/) - you can run `asdf install` in the project directory and it will use the python version specified in `.tool-versions`.

> [!WARNING]
> The package [setuptools](https://pypi.org/project/setuptools/) was removed in Python 3.12, so you'll need to install it manually.

```sh
python -m pip install --upgrade pip setuptools
```

## Linux

- Depending on your distribution, you might need to install [hunspell](https://github.com/hunspell/hunspell) and your specific locale (`hunspell-<lang>`) e.g. `hunspell-en-au`.

- Install the required build tools for your operating system

  <details>
  <summary>Debian/Ubuntu</summary>

  This will install `make`, `g++`, `gcc`, etc.

  ```sh
  sudo apt install build-essential cmake
  ```

  </details>

  <details>
  <summary>Fedora</summary>

  ```sh
  sudo dnf install make automake gcc gcc-c++ kernel-devel
  ```

  </details>

- Git setup

  You may need to disable `core.autocrlf` to prevent line ending issues.

  ```sh
  git config --global core.autocrlf false
  ```

- Install [Node.JS](https://nodejs.org/en/download/)

  We recommend using [nvm](https://github.com/nvm-sh/nvm) or [asdf](https://asdf-vm.com/).

  You can get the current `<version>` from the [`.nvmrc`](.nvmrc).

- Verify your [Python](https://www.python.org/downloads/) version.

  Most modern Linux distributions should come with Python 3 pre-installed.

  It should be equal to or greater than the version specified in the [`.tool-versions`](.tool-versions).

- Install [setuptools](https://pypi.org/project/setuptools/).

  ```sh
  python -m pip install --upgrade pip setuptools
  ```

- Install [Yarn Classic](https://classic.yarnpkg.com/en/docs/install/#mac-stable)

  ```sh
  npm install --global yarn
  ```

## macOS

- Install the [Xcode Command-Line Tools](http://osxdaily.com/2014/02/12/install-command-line-tools-mac-os-x/).

  **Optional:** Install [Homebrew](https://brew.sh/).

- Install [Git](https://git-scm.com/download/mac).

  We recommend using Homebrew to install Git.

  ```sh
    brew install git
  ```

  After installing Git, you may need to disable `core.autocrlf` to prevent line ending issues.

  ```sh
  git config --global core.autocrlf false
  ```

- Install [Node.JS](https://nodejs.org/en/download/)

  We recommend using [nvm](https://github.com/nvm-sh/nvm) or [asdf](https://asdf-vm.com/).

  You can get the current `<version>` from the [`.nvmrc`](.nvmrc).

- Install [Python](https://www.python.org/downloads/)

  We recommend using [asdf](https://asdf-vm.com/).

  You can get the current `<version>` from the [`.tool-versions`](.tool-versions).

- Install [setuptools](https://pypi.org/project/setuptools/).

  ```sh
  python -m pip install --upgrade pip setuptools
  ```

- Install [Yarn Classic](https://classic.yarnpkg.com/en/docs/install/#mac-stable)

  ```sh
  npm install --global yarn
  ```

## Windows

Building on Windows can be a bit tricky. You can set this up manually, but we recommend using [Chocolatey](https://chocolatey.org/) to install the necessary dependencies.

The following instructions will install the following:

- [Git](https://git-scm.com/download/win)
- [CMake](https://cmake.org/download/)
- [Visual Studio 2022](https://visualstudio.microsoft.com/downloads/)
- [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [Node.js](https://nodejs.org/en/download/)
- [Python](https://www.python.org/downloads/)

Setup instructions for Windows using Chocolatey:

- Open PowerShell as Administrator

- Install [Chocolatey](https://docs.chocolatey.org/en-us/choco/setup#installing-chocolatey-cli)

  ```PowerShell
  Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
  ```

> [!WARNING]
> Make sure to read the Chocolatey output for each `choco install` step.
> It will tell you if you need to restart your terminal or computer.
> If you don't do this, you may encounter issues with the next steps.

- Install [Git](https://git-scm.com/download/win)

  ```sh
  choco install git
  ```

  After installing Git, you may need to disable `core.autocrlf` to prevent line ending issues.

  ```sh
  git config --global core.autocrlf false
  ```

- Install [CMake](https://cmake.org/download/)

  CMake does not add itself to the system path by default, so you'll need specify the `ADD_CMAKE_TO_PATH` argument.

  ```sh
  choco install cmake --installargs 'ADD_CMAKE_TO_PATH=System'
  ```

- Install [Visual Studio 2022](https://visualstudio.microsoft.com/downloads/)

  ```sh
  choco install visualstudio2022community
  ```

> [!WARNING]
> This next step will likely take a long time.
> Make sure to restart your computer once it is finished.

- Install [Visual C++ build tools workload for Visual Studio 2022](https://community.chocolatey.org/packages/visualstudio2022-workload-vctools)

  ```sh
  choco install visualstudio2022-workload-vctools
  ```

- Install [Node.js](https://nodejs.org/en/download/)

  If you have multiple node version installed and/or use a node version manager you should install a Node how you normally would.

  If you are using [nvm for windows](https://github.com/coreybutler/nvm-windows) you will need to run `nvm install <version>` and `nvm use <version>` as it doesn't support `.nvmrc` files.

  You can get the current `<version>` from the [`.nvmrc`](.nvmrc).

  ```sh
  choco install nodejs --version <version>
  ```

- Install [Python](https://www.python.org/downloads/)

  You can get the current `<version>` from the [`.tool-versions`](.tool-versions).

  ```sh
  choco install python --version <version>
  ```

- Install [setuptools](https://pypi.org/project/setuptools/)

  ```sh
  python -m pip install --upgrade pip setuptools
  ```

- Install [Yarn Classic](https://classic.yarnpkg.com/en/docs/install/#windows-stable)

  ```sh
  npm install --global yarn
  ```

  You'll likely encounter an issue with windows preventing you from running scripts when you run the `yarn` command, See: [Exclusion Policies](https:/go.microsoft.com/fwlink/?LinkID=135170). If you do, you can fix it by running the following command:

  ```PowerShell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

# Build and run

Now, run these commands in your preferred terminal in a good directory for development:

```sh
git clone https://github.com/session-foundation/session-desktop.git
cd session-desktop
npm install --global yarn      # (only if you don’t already have `yarn`)
yarn install --frozen-lockfile # Install and build dependencies (this will take a while)
yarn build-everything
yarn test                      # A good idea to make sure tests run first
yarn start-prod                # Start Session!
```

This will build the project and start the application in production mode.

## Troubleshooting

<details>
<summary><em>The SUID sandbox helper binary was found, but is not configured correctly. Rather than run without sandboxing I'm aborting now.</em></summary>

This error is caused by the [Electron](https://www.electronjs.org/) sandbox not being able to run. This is a security feature and not a bug. You can run the application with the `--no-sandbox` flag to disable this behavior.

```sh
yarn start-prod --no-sandbox   # Start Session!
```

</details>

<details>
<summary><em>Python was not found; run without arguments to install from the Microsoft Store, or disable this shortcut from Settings > Manage App Execution Aliases.</em></summary>

We use the `python3` command for many of our scripts. If you have installed Python using [Chocolatey](https://chocolatey.org/), you will need to create an alias for `python3` that points to `python`. Alternatively, you can update the scripts to use `python` instead of `python3`.

</details>

<details>
<summary><em>...(mach-o file, but is an incompatible architecture (have 'x86_64', need 'arm64'))...</em></summary>

> **TLDR**
> If you are using VS Code, check the architecture of your integrated terminal by running `uname -m` in it.
> This also applies to NodeJS installations. Check with `node -p process.arch`.
> If the architecture doesn't match your host operating system Session will fail to run.

Are you using Visual Studio Code? Make sure that your installation matches your host operating system. For example if your device is `arm64` make sure the VS Code installation is not `x86_64`. If they do not match and you are using VS Code's integrated terminal, it will run on the architecture of the VS Code installation. Therefore if you installed NodeJS or adding packages via the integrated terminal, it will use the wrong architecture and not match your host system. You can check the architecture of your NodeJS installation by running `node -p process.arch` in the terminal.

This error comes from when you build Session's native modules e.g. `better-sqlite3`, `libsession_util_nodejs`, they have been compiled for the wrong cpu architecture.

</details>

## Hot reloading

More often than not, you'll need to restart the application regularly to see your changes, as there
is no automatic restart mechanism for the entire application.

You can keep the developer tools open (`View > Toggle Developer Tools`) and press <kbd>Cmd</kbd> + <kbd>R</kbd> (macOS) or <kbd>Ctrl</kbd> + <kbd>R</kbd> (Windows & Linux) to reload the application frontend.

```sh
# Runs until you stop it, re-generating built assets on file changes.

# Once this command is waiting for changes, you will need to run in another terminal
# `yarn build:workers` to fix the "exports undefined" error on start.

# Terminal A
yarn build-everything:watch # this process will keep running until you stop it

# Terminal B
yarn build:workers

# If you change any SASS files while running "yarn build-everything:watch" it won't be detected.
# You will need to run the sass build command.

# Terminal B
yarn sass
```

## Running multiple instances

Since there is no registration restrictions for Session, you can make as many accounts as you want. Each client however has a dedicated storage profile on your machine which is determined by the environment and instance variables.

To run a new instance, you can set the `MULTI` environment variable to a unique value.

```sh
# Terminal A
yarn start-prod # Start Session!

# Terminal B
MULTI=1 yarn start-prod # Start another instance of Session!
```

## Storage profile locations

- Linux `~/.config/`
- macOS `~/Library/Application Support/`
- Windows `%AppData%/`

This storage profile folder will change directories from `[PROFILE_PATH]/Session-{environment}` to `[PROFILE_PATH]/Session-{environment}{instance}`.

For example, running:

```sh
# Terminal A
MULTI=alice yarn start-prod

# Terminal B
MULTI=bob yarn start-prod
```

Will run the development environment with the `alice` and `bob` instances and thus create separate storage profiles. The storage profiles will be stored at `[PROFILE_PATH]/Session-devalice` and `[PROFILE_PATH]/Session-devbob`.

# Making changes

So you're in the process of preparing that pull request. Here's how to make that go
smoothly.

## Testing

Please write tests! Our testing framework is
[mocha](http://mochajs.org/) and our assertion library is
[chai](http://chaijs.com/api/assert/).

The easiest way to run all tests at once is `yarn test`.

## Commit your changes

Before a commit is accepted the staged changes will be formatted using [prettier](https://prettier.io/) and linted using [eslint](https://eslint.org/). The commit will be reverted if files are formatted or lint errors are returned.

### Commit Message Conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)

Commit messages will be checked using [husky](https://typicode.github.io/husky/#/) and [commitlint](https://commitlint.js.org/).

## Pull requests

So you wanna make a pull request? Please observe the following guidelines.

- First, make sure that your `yarn ready` run passes - it's very similar to what our
  Continuous Integration servers do to test the app.
- Never use plain strings right in the source code - pull them from `messages.json`!
  You **only** need to modify the default locale
  [`_locales/en/messages.json`](_locales/en/messages.json).
  Other locales are generated automatically based on that file and then periodically
  uploaded to Crowdin for translation. If you add or change strings in messages.json
  you will need to run `yarn buid:locales-soft` this command generates updated TypeScript type definitions to ensure you aren't using a localization key which doesn't exist.
- Please do not submit pull requests for pure translation fixes. Anyone can update
  the translations at [Crowdin](https://getsession.org/translate).
- [Rebase](https://nathanleclaire.com/blog/2014/09/14/dont-be-scared-of-git-rebase/) your
  changes on the latest `dev` branch, resolving any conflicts.
  This ensures that your changes will merge cleanly when you open your PR.
- Be sure to add and run tests!
- Make sure the diff between `dev` and your branch contains only the
  minimal set of changes needed to implement your feature or bug fix. This will
  make it easier for the person reviewing your code to approve the changes.
  Please do not submit a PR with commented out code or unfinished features.
- Avoid meaningless or too-granular commits. If your branch contains commits like
  the lines of "Oops, reverted this change" or "Just experimenting, will
  delete this later", please [squash or rebase those changes away](https://robots.thoughtbot.com/git-interactive-rebase-squash-amend-rewriting-history).
- Don't have too few commits. If you have a complicated or long lived feature
  branch, it may make sense to break the changes up into logical atomic chunks
  to aid in the review process.
- Provide a well written and nicely formatted commit message. See [this
  link](http://chris.beams.io/posts/git-commit/)
  for some tips on formatting. As far as content, try to include in your
  summary
  1.  What you changed
  2.  Why this change was made (including git issue # if appropriate)
  3.  Any relevant technical details or motivations for your implementation
      choices that may be helpful to someone reviewing or auditing the commit
      history in the future. When in doubt, err on the side of a longer
      commit message.

Above all, spend some time with the repository. Follow the pull request template added to
your pull request description automatically. Take a look at recent approved pull requests,
see how they did things.

## Production Builds

You can build a production binary by running the following:

```sh
yarn build-everything
yarn build-release
```

The binaries will be placed inside the `release/` folder.

<details>
<summary>Linux</summary>

You can change in [package.json](./package.json) `"target": "deb",` to any of the [electron-builder targets](https://www.electron.build/linux#target) to build for another target.

</details>
