# Tools

> [!WARNING]
> Make sure you have the correct version of [Python](https://www.python.org/downloads/) installed.
> You can get the current `<version>` from the [`.tool-versions`](../.tool-versions).

## Using the Python scripts

The Python scripts are located in the `tools` directory. To run a script, use the following command:

```bash
python3 ./tools/<script>.py
```

Most of these scripts can take arguments. To see the arguments for a script, use the following command:

```bash
python3 ./tools/<script>.py --help
```

## Utility

### Sort JSON

[./util/sortJson.py](./util/sortJson.py) sorts a given JSON file.

```bash
python3 ./tools/util/sortJson.py <file>
```

## Localization

There are several script that handle localization at different stages.

### Find String

[findString.py](./findString.py) is a utility script that searches for a given token across the codebase. This script
searches in the following directories:

- `./ts/`

```bash
python3 ./tools/findString.py <token>
```

The script can automatically open the files in VSCode by passing the `--open` flag.

```bash
python3 ./tools/findString.py <token> --open
```

> [!WARNING]
> The --open flag will open only the first result for the token in VSCode. If you wish to open more files, you can pass the `--limit` flag with the maximum number of files you wish to open. You can also pass the `--limit 0` flag to open all files containing the token.

```bash
python3 ./tools/findString.py <token> --open --limit 5
```

### [CrowdIn Post-Import](./localization/crowdInPostImport.sh)

When a CrowdIn PR is made to update the localizations
the [./localization/crowdInPostInstall.sh](./localization/crowdInPostImport.sh) - This script processes the imported
files by running the following script:

- [./localization/generateLocales.py](./localization/generateLocales.py) - This script generates the TypeScript type
  definitions [locales.ts](../ts/localization/locales.ts). This script also validates the dynamic variables in each
  locale file and flags any errors.

The generated type file is not committed to the repository and is generated at build time. It is generated here to ensure that changes to any type definitions are not problematic.

## [Generate Localized Strings Analysis](./localization/generateLocalizedStringsAnalysis.sh)

This script generates a report of the localized strings, identifying missing and unused strings, as well as strings that
are used but not known about. Without any input files this script outputs:

- [found_strings.csv] - A list of all strings found in the codebase.
- [not_found_strings.csv] - A list of all strings not found in the codebase.
- [potential_matches.csv] - A list of all not found strings in the codebase that have a potential match using a fuzzy
  search.

The script can be run with:

```bash
  python3 ./tools/localization/generateLocalizedStringsAnalysis.py
```

> [!WARNING]
> If using macOS always run this script with the `--disable-concurrency` flag.

```bash
python3 ./tools/localization/generateLocalizedStringsAnalysis.py --disable-concurrency
```

The script can also take the following arguments:

- `--output-dir` - The directory to output the files to. Default is `./tools/localization/analysis/`.
- `--master-strings` - A file containing a master list of strings to compare against. This list specifies the list of
  known strings. When this is provided a `missing_strings.csv` file is generated. This file contains all strings in the
  codebase that are not in the master list.
- `--to-be-removed` - A file containing a list of strings that are to be removed from the codebase. This list specifies
  the list of strings that are to be removed and so won't be flagged as missing from the master lists. Any strings in
  this list will not appear in the `missing_strings.csv` file.
- `--disable-concurrency` - Disables the use of concurrency in the script. This is required on macOS due to a bug in the `concurrent.futures` module.
