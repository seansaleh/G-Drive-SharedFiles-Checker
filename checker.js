const FOLDER_TYPE = 'D';
const FILE_TYPE = 'F';
const PROPERTY_KEY_FOR_SHEET_ID = "PROPERTY_KEY_FOR_SHEET_ID";
const NUMBER_OF_OUTPUT_COLUMNS = 13;
const MAX_RUNNING_TIME_MS = 5 * 60 * 1000;
var counter = 0;

const CHECK_PRIVATE_FILES = true; // change to false if you don't want to check 'PRIVATE' files, aka those which aren't shared with a link

const folderId = "";  // Define this to use a folder other than the user's root folder. Get the folder ID from the long chunk of random numbers/letters in the URL when you navigate to the folder

// List of domains which should be considered "internal"
var internalDomains = [
];

// List of users who are outside our domain but still considered "internal"
const internalUsers = [
];

function main() {
  const results = [];

  setupInternalDomains();

  const rootFolder = selectFolder();
  const sheet = loadOrCreateSheetInSpreadsheet();

  // Recursively loop through all files, with resume support
  const finishedExecution = processRootFolder(rootFolder, (fileOrFolder,path, type) => processFileOrFolder(fileOrFolder, path, type, results, sheet));

  flushResultsToSheet(sheet, results);
  Logger.log("Flushed all results!");

  if (!finishedExecution) {
    Logger.log(`Did not finish execution, therefore setting up trigger to rerun. ${counter} files processed this round.`);
    ScriptApp.newTrigger('main')
      .timeBased()
      .after(MAX_RUNNING_TIME_MS + 60 * 1000) // at least 1 minute after the current run is set to timeout
      .create();
  } else {
    PropertiesService.getDocumentProperties().deleteProperty(PROPERTY_KEY_FOR_SHEET_ID)
    Logger.log(`Finished processing all files! ${counter} files were processed this round.`);
    deleteAllTriggers();
  }
}

function processFileOrFolder(file, parentPath, type, results, sheet) {
  counter++;
    const filePath = parentPath + '/' + file.getName();
    console.time("processFileOrFolder");
    try {
        const sharingAccess = file.getSharingAccess();
        if (CHECK_PRIVATE_FILES || DriveApp.Access.PRIVATE != sharingAccess) {
            const editors = file.getEditors();
            const viewers = file.getViewers();
            const listEditors = editors.map(it => it.getEmail()).join(', ');
            const listViewers = viewers.map(it => it.getEmail()).join(', ');
            const listExternalEditors = editors.filter(isNotInternalUser).map(it => it.getEmail()).join(', ');
            const listExternalViewers = viewers.filter(isNotInternalUser).map(it => it.getEmail()).join(', ');

            const fileData = [
                'ok',
                filePath,
                sharingAccess,
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
    console.timeEnd("processFileOrFolder");
  if (results.length >= 20) {
    flushResultsToSheet(sheet, results);
  }
}

function loadOrCreateSheetInSpreadsheet() {
  const sheetId = JSON.parse(PropertiesService.getDocumentProperties().getProperty(PROPERTY_KEY_FOR_SHEET_ID));

  if (sheetId == null) {
    var newSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet();
    //var newSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(`Folder:${rootFolder.getName()}`);

    newSheet.appendRow(["Status", "Path", "Access", "Permissions", "Owner", "Editors", "Viewers", "ExternalEditors", "ExternalViewers", "Date", "Size", "URL", "Type"]);

    PropertiesService.getDocumentProperties().setProperty(PROPERTY_KEY_FOR_SHEET_ID, JSON.stringify(newSheet.getSheetId()));
    return newSheet;
  } else {
    var foundSheet = getSheetById(SpreadsheetApp.getActiveSpreadsheet(), sheetId);
    if(foundSheet) {
      return foundSheet;
    } else {
      throw "Failed to resume, failed ot find sheet from previous run."
    }
  }
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

function selectFolder() {
  if (folderId == "") {
    return DriveApp.getRootFolder();
  } else {
    return DriveApp.getFolderById(folderId);
  }
}

function setupInternalDomains() {
  if(internalDomains.length == 0) {
    const currentUserDomain = Session.getEffectiveUser().getEmail().split("@")[1];
    if (currentUserDomain != "gmail.com") {
        internalDomains.push(Session.getEffectiveUser().getEmail().split("@")[1]);
    }
  }
  Logger.log('Considering users at the following domains to be internal users');
  Logger.log(internalDomains)
}

// From https://developers.google.com/apps-script/reference/script/script-app#deletetriggertrigger
function deleteAllTriggers() {
  // Deletes all triggers in the current project.
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  Logger.log(`Deleted all triggers.`);
}

// From https://stackoverflow.com/a/68092341
function getSheetById(ss, sheetId) {
  var foundSheets = ss.getSheets().filter(sheet => sheet.getSheetId() === sheetId);
  return foundSheets.length ? foundSheets[0] : undefined;
}

// Folder & File iteration based on https://stackoverflow.com/a/54104948
function processRootFolder(rootFolder, callback, timeoutCallback) {
  var RECURSIVE_ITERATOR_KEY = "RECURSIVE_ITERATOR_KEY";

  var startTime = (new Date()).getTime();

  // [{folderName: String, fileIteratorContinuationToken: String?, folderIteratorContinuationToken: String}]
  var recursiveIterator = JSON.parse(PropertiesService.getDocumentProperties().getProperty(RECURSIVE_ITERATOR_KEY));
  if (recursiveIterator !== null) {
    // verify that it's actually for the same folder
    if (rootFolder.getName() !== recursiveIterator[0].folderName) {
      console.warn("Looks like this is a new folder. Clearing out the old iterator.");
      recursiveIterator = null;
    } else {
      console.info("Resuming session.");
    }
  }
  if (recursiveIterator === null) {
    console.info("Starting new session.");
    recursiveIterator = [];
    recursiveIterator.push(makeIterationFromFolder(rootFolder));
  }

  while (recursiveIterator.length > 0) {
    recursiveIterator = nextIteration(recursiveIterator, callback);

    var currTime = (new Date()).getTime();
    var elapsedTimeInMS = currTime - startTime;
    var timeLimitExceeded = elapsedTimeInMS >= MAX_RUNNING_TIME_MS;
    if (timeLimitExceeded) {
      PropertiesService.getDocumentProperties().setProperty(RECURSIVE_ITERATOR_KEY, JSON.stringify(recursiveIterator));
      console.info("Stopping loop after '%d' milliseconds. Please continue running.", elapsedTimeInMS);
      return false;
    }
  }

  console.info("Done running");
  PropertiesService.getDocumentProperties().deleteProperty(RECURSIVE_ITERATOR_KEY);
  return true;
}

// process the next file or folder
function nextIteration(recursiveIterator, callback) {
  var currentIteration = recursiveIterator[recursiveIterator.length-1];
  if (currentIteration.fileIteratorContinuationToken !== null) {
    var fileIterator = DriveApp.continueFileIterator(currentIteration.fileIteratorContinuationToken);
    if (fileIterator.hasNext()) {
      // process the next file
      var path = recursiveIterator.map(function(iteration) { return iteration.folderName; }).join("/");
      callback(fileIterator.next(), path, FILE_TYPE);
      currentIteration.fileIteratorContinuationToken = fileIterator.getContinuationToken();
      recursiveIterator[recursiveIterator.length-1] = currentIteration;
      return recursiveIterator;
    } else {
      // done processing files
      currentIteration.fileIteratorContinuationToken = null;
      recursiveIterator[recursiveIterator.length-1] = currentIteration;
      return recursiveIterator;
    }
  }

  if (currentIteration.folderIteratorContinuationToken !== null) {
    var folderIterator = DriveApp.continueFolderIterator(currentIteration.folderIteratorContinuationToken);
    if (folderIterator.hasNext()) {
      // process the next folder
      var folder = folderIterator.next();
      var path = recursiveIterator.map(function(iteration) { return iteration.folderName; }).join("/");
      callback(folder, path, FOLDER_TYPE)
      recursiveIterator[recursiveIterator.length-1].folderIteratorContinuationToken = folderIterator.getContinuationToken();
      recursiveIterator.push(makeIterationFromFolder(folder));
      return recursiveIterator;
    } else {
      // done processing subfolders
      recursiveIterator.pop();
      return recursiveIterator;
    }
  }

  throw "should never get here";
}

function makeIterationFromFolder(folder) {
  return {
    folderName: folder.getName(), 
    fileIteratorContinuationToken: folder.getFiles().getContinuationToken(),
    folderIteratorContinuationToken: folder.getFolders().getContinuationToken()
  };
}