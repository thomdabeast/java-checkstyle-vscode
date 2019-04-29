# Java Checkstyle

A checkstyle extension for Java.

## Donations

Donations are very much appreciated! It will help support the life and health of this project(also the developer needs coffee).

[patreon](https://www.patreon.com/thomhemenway) | [paypal](https://paypal.me/pools/c/8ehVmR9sav)

## Coming soon

1. Grab checkstyle version from `build.gradle`
2. "Fix suggestion" windows.
3. Auto-linting.

## Features

* Automatically downloads the checkstyle version you need.
* Ability to use `${workspaceFolder}` in configs.

## Requirements

None at the moment.

## Extension Settings

* `java.checkstyle.version`: The version of checkstyle you want to use.
  * Default: `8.16`
* `java.checkstyle.enabled`: Enable auto-checking of files.
  * Default: `true`
* `java.checkstyle.properties`: Java system properties that you will be using inside of your checkstyle configuration file.
  * Default: `null`
* `java.checkstyle.configuration`: Java checkstyle configuration file.
  * Default: [Google Checkstyle](https://github.com/checkstyle/checkstyle/blob/master/src/main/resources/google_checks.xml)

## Known Issues

null

## Release Notes

### 1.1.0

* Ability to use `${workspaceFolder}` in configs
* If no checkstyle configuration file is defined, Google checkstyle will be used.

### 1.0.2

Adding donation links.

### 1.0.1

Updating the readme and adding an icon.

### 1.0.0

Initial release of the extension.
