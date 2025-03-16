# Building

This document alongside [Releasing.md](RELEASING.md) primarily covers our internal build process for release builds.

If you are an external contributor please refer to [Contributing.md](CONTRIBUTING.md) for building instructions.

## Automated

Automatic building of session binaries is done using github actions. Windows and linux binaries will build right out of the box but there are some extra steps needed for Mac OS

<details>
<summary>Mac</summary>

The build script for Mac OS requires you to have a valid `Developer ID Application` certificate. Without this the build script cannot sign and notarize the mac binary which is needed for Catalina 10.15 and above.
If you would like to disable this then comment out `"afterSign": "build/notarize.js",` in [package.json](./package.json).

You will also need an [App-specific password](https://support.apple.com/en-al/HT204397) for the apple account you wish to notarize with

#### Setup

Once you have your `Developer ID Application` you need to export it into a `.p12` file. Keep a note of the password used to encrypt this file as it will be needed later.

We need to Base64 encode this file, so run the following command:

```sh
base64 -i certificate.p12 -o encoded.txt
```

#### On GitHub:

1.  Navigate to the main page of the repository.
2.  Under your repository name, click **Settings**.
3.  In the left sidebar, click **Secrets**.
4.  Add the following secrets:

    | Name                       | Value                                                                       |
    | -------------------------- | --------------------------------------------------------------------------- |
    | `MAC_CERTIFICATE`          | The encoded Base64 certificate                                              |
    | `MAC_CERTIFICATE_PASSWORD` | The password that was set when the certificate was exported                 |
    | `SIGNING_APPLE_ID`         | The apple id (email) to use for signing                                     |
    | `SIGNING_APP_PASSWORD`     | The app-specific password that was generated for the apple id               |
    | `SIGNING_TEAM_ID`          | **OPTIONAL** The apple team id if you're signing the application for a team |

</details>

## Manual

Follow the instructions in [Contributing.md](CONTRIBUTING.md) to set up your development environment.

### Prerequisites

<details>
<summary>Linux</summary>

The [rpm](https://rpm.org) package is required for running the build-release script on Linux. Run the appropriate command to install the `rpm` package:

```sh
sudo pacman -S rpm    # Arch
```

```sh
sudo apt install rpm  # Ubuntu/Debian
```

</details>

<details>
<summary>Mac</summary>

If you are going (and only if) to distribute the binary then make sure you have a `Developer ID Application` certificate in your keychain. Without this the build script cannot sign and notarize the mac binary which is needed for Catalina 10.15 and above.

You will also need an [App-specific password](https://support.apple.com/en-al/HT204397) for the apple account you wish to notarize with

Then run the following to export the variables

```sh
export SIGNING_APPLE_ID=<your apple id>
export SIGNING_APP_PASSWORD=<your app specific password>
export SIGNING_TEAM_ID=<your team id if applicable>
```

</details>

### Building

Once your development environment is set up, here are the steps to build the application:

```sh
yarn install --frozen-lockfile # install all dependencies of this project
yarn build-everything # transpile and assemble files
yarn build-release
```

The binaries will be placed inside the `release/` folder.

<details>
<summary>Linux</summary>

You can change in [package.json](./package.json) `"target": "deb",` to any of the [electron-builder targets](https://www.electron.build/linux#target) to build for another target.

</details>
