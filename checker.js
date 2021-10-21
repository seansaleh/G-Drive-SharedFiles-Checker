const CHECK_PRIVATE_FILES = true; // change to false if you don't want to check 'PRIVATE' files, aka those which aren't shared with a link

const FOLDER_TYPE = 'D';
const FILE_TYPE = 'F';
const NUMBER_OF_OUTPUT_COLUMNS = 13;

// If this is unset then we use the domain of the current user
var internalDomains = [

];

const folderId = ""; // Define this to use a folder other than the user's root folder. Get the folder ID from the long chunk of random numbers/letters in the URL when you navigate to the folder

// List of users who are outside our domain but still considered "internal"
const internalUsers = [

];

function main() {
    if(internalDomains.length == 0) {
        const currentUserDomain = Session.getEffectiveUser().getEmail().split("@")[1];
        if (currentUserDomain != "gmail.com") {
            internalDomains.push(Session.getEffectiveUser().getEmail().split("@")[1]);
        }
    }
    Logger.log('Considering users at the following domains to be internal users');
    Logger.log(internalDomains)

    Logger.log('Looking for shared files in your drive, please wait... (This may take a while)');

    var rootFolder;
    if (folderId == "") {
        rootFolder = DriveApp.getRootFolder();
    } else {
        rootFolder = DriveApp.getFolderById(folderId);
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(`Folder:${rootFolder.getName()}`);
    sheet.appendRow(["Status", "Path", "Access", "Permissions", "Owner", "Editors", "Viewers", "ExternalEditors", "ExternalViewers", "Date", "Size", "URL", "Type"]);

    const results = [];
    getAllFilesInFolder('', rootFolder, false, sheet, results);
    flushResultsToSheet(sheet, results);
}

function flushResultsToSheet(sheet, results) {
    console.time("flushResultsToSheet");
    Logger.log(`Flushing ${results.length} rows to the sheet`)
    // Don't use appendRow which takes 800ms for each row, instead batch insert.
    sheet.getRange(sheet.getLastRow() + 1, 1, results.length, NUMBER_OF_OUTPUT_COLUMNS).setValues(results);
    // In JS will clear the array without losing the reference to it.
    results.length = 0;
    console.timeEnd("flushResultsToSheet");
}

function getAllFilesInFolder(parentPath, folder, inherited, sheet, results) {
    const subFolders = folder.getFolders();
    const folderFiles = folder.getFiles();
    const path = parentPath + '/' + folder.getName();

    var isShared = false;

    try {
        isShared = folder.getSharingAccess() != DriveApp.Access.PRIVATE;
    } catch (err) {
        Logger.log(`Path: ${path}, Error with getSharingAccess: ${err}`)
    }

    addFileOrFolder(parentPath, folder, FOLDER_TYPE, inherited, results);

    while (folderFiles.hasNext()) {
        addFileOrFolder(path, folderFiles.next(), FILE_TYPE, isShared, results);
    }
    
    if (results.length >= 50) {
        flushResultsToSheet(sheet, results);
    }
    
    while (subFolders.hasNext()) {
        const folder = subFolders.next();
        getAllFilesInFolder(path, folder, isShared, sheet, results);
    }
}

function isNotInternalUser(user) {
  if (internalUsers.includes(user.getEmail())) return false;
  if (internalDomains.includes(user.getDomain())) return false;
  return true;
}

function addFileOrFolder(parentPath, file, type, inheritShare, results) {
    const filePath = parentPath + '/' + file.getName();
    console.time("addFileOrFolder");
    try {
        const sharingAccess = file.getSharingAccess();
        if (CHECK_PRIVATE_FILES || inheritShare || DriveApp.Access.PRIVATE != sharingAccess) {
            const editors = file.getEditors();
            const viewers = file.getViewers();
            const listEditors = editors.map(it => it.getEmail()).join(', ');
            const listViewers = viewers.map(it => it.getEmail()).join(', ');
            const listExternalEditors = editors.filter(isNotInternalUser).map(it => it.getEmail()).join(', ');
            const listExternalViewers = viewers.filter(isNotInternalUser).map(it => it.getEmail()).join(', ');

            const fileData = [
                'ok',
                filePath,
                sharingAccess + (inheritShare ? ' (inherited)' : ''),
                file.getSharingPermission(),
                file.getOwner().getEmail(),
                listEditors,
                listViewers,
                listExternalEditors,
                listExternalViewers,
                file.getDateCreated(),
                file.getSize(),
                file.getUrl(),
                FILE_TYPE == type ? file.getMimeType() : 'Folder',
            ];
            results.push(fileData);
        }
    } catch (err) {
        Logger.log('Error while analyzing file %s : %s', filePath, err)
        const fileData = [
            err,
            filePath,
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
        ];
        results.push(fileData);
    }
    console.timeEnd("addFileOrFolder");
}
