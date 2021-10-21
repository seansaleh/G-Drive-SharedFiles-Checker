const CHECK_PRIVATE_FILES = true; // change to false if you don't want to check 'PRIVATE' files, aka those which aren't shared with a link

const FOLDER_TYPE = 'D';
const FILE_TYPE = 'F';

const resultFiles = [];

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
    sheet.appendRow(["Status", "Path", "Access", "Permissions", "Editors", "Viewers", "ExternalEditors", "ExternalViewers", "Date", "Size", "URL", "Type"]);
    getAllFilesInFolder('', rootFolder, false, sheet);
}

function getAllFilesInFolder(parentPath, folder, inherited, sheet) {
    const subFolders = folder.getFolders();
    const folderFiles = folder.getFiles();
    const path = parentPath + '/' + folder.getName();

    var isShared = false;

    try {
        isShared = folder.getSharingAccess() != DriveApp.Access.PRIVATE;
    } catch (err) {
        Logger.log(`Path: ${path}, Error with getSharingAccess: ${err}`)
    }

    addFileOrFolder(parentPath, folder, FOLDER_TYPE, inherited, sheet);

    while (subFolders.hasNext()) {
        const folder = subFolders.next();
        getAllFilesInFolder(path, folder, isShared, sheet);
    }
    while (folderFiles.hasNext()) {
        addFileOrFolder(path, folderFiles.next(), FILE_TYPE, isShared, sheet);
    }
}

function isNotInternalUser(user) {
  if (internalUsers.includes(user.getEmail())) return false;
  if (internalDomains.includes(user.getDomain())) return false;
  return true;
}

function addFileOrFolder(parentPath, file, type, inheritShare, sheet) {
    const filePath = parentPath + '/' + file.getName();

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
                listEditors,
                listViewers,
                listExternalEditors,
                listExternalViewers,
                file.getDateCreated(),
                file.getSize(),
                file.getUrl(),
                FILE_TYPE == type ? file.getMimeType() : 'Folder',
            ];
            sheet.appendRow(fileData);
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
        ];
        sheet.appendRow(fileData);
    }
}

