# Building

## Application Icons

If you update the app icon, you also need to update all those file generated from it and based on https://www.electron.build/icons.html.

The current source file is [build/session_icon_source_1024px.png](./session_icon_source_1024px.png)

### Linux

Build binaries on github actions, get the zip with the deb+appImage, extract it, all the icons are in a `.icons-set` folder, and you can copy paste them into [build/icons](./icons/).

### macOS

Use https://cloudconvert.com/png-to-icns to get an `.icns` file from the 1024px.png source file. Save as `icon-mac.icns`.

### Windows

Use https://cloudconvert.com/png-to-ico to get an `.ico` file from the 1024px.png source file. Save as `icon.ico`.
