# GoogleDrive - Shared Files Finder Script

This script analyses your Google Drive to find all files you've shared.

It returns a Spreadsheet with the files and their access rights alongside the viewers.

## How to use

- Connect to your google drive account
- Create a new spreadsheet (optional: rename it)
- Go to "Tools -> Script Editor"
- Copy the content of the file checker.js into the editor
- Save and Run
- It may asks for permissions that you need to accept in order to access the drive.

## Result
It creates a new sheet in the spreadsheet that should be populated with the results according to this column format :

| Path | Access | Permissions | Owner | Editors | Viewers | ExternalEditors	| ExternalViewers | Date | Size | URL | Type |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |

## Options
If you want the script to check only files shared via links you can set :
```
const CHECK_PRIVATE_FILES = false;
```

If you want to set specific users files are shared with as not `ExternalEditors` or `ExternalViewers` then you can add them to
```
const internalUsers = [
  "username@example.org",
];
```

If you want to set certain email domains to be considered not `ExternalEditors` or `ExternalViewers` then you can add them to
```
var internalDomains = [
  "example.org",
];
```

## Author
* Arnaud Moya <dev@amoya.fr>

## Thanks
* @moya-a (https://github.com/moya-a/G-Drive-SharedFiles-Checker)

For what this script evolved out of

* @[Senseful](https://stackoverflow.com/users/35690/senseful) on StackOverflow (https://stackoverflow.com/questions/45689629/how-to-use-continuationtoken-with-recursive-folder-iterator/54104948#54104948)

For a great safe resumable recursive google drive folder and file iterator

* @woodwardtw (https://gist.github.com/woodwardtw/22a199ecca73ff15a0eb)

For the inital idea

* @danjargold (https://gist.github.com/danjargold/c6542e68fe3a3b46eeb0172f914641bc)

For the version of the script Arnaud Moya's was based on



## License
* MIT
