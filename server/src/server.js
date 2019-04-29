const fs = require('fs');
const https = require('https');
const os = require('os');

var {
	exec
} = require('child_process');

var {
	createConnection,
	DiagnosticSeverity,
	Files,
	IPCMessageReader,
	IPCMessageWriter,
	TextDocumentSyncKind,
	TextDocuments,
} = require('vscode-languageserver');

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents = new TextDocuments();
documents.listen(connection);

connection.onInitialize((params) => {
	connection.onRequest('storagePath', (path) => {
		storagePath = path;

		if (!fs.existsSync(storagePath)) {
			fs.mkdirSync(storagePath, { recursive: true });
		}
	});

	return {
		capabilities: {
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: TextDocumentSyncKind.Full,
			// Tell the client that the server support code complete
			completionProvider: {
				resolveProvider: true
			}
		}
	}
});

let storagePath;

let checkstyleVersion;
let checkstyleProperties;
let checkstyleConfiguration;

connection.onDidChangeConfiguration(change => {
	checkstyleConfiguration = change.settings.java.checkstyle.configuration || '';
	checkstyleConfiguration = checkstyleConfiguration.replace('${workspaceFolder}', fs.realpathSync('.'));
	checkstyleVersion = change.settings.java.checkstyle.version || '8.16'; //TODO: Add google checkstyle file.
	checkstyleProperties = change.settings.java.checkstyle.properties || null;
	Object.keys(checkstyleProperties).forEach((key) => {
		checkstyleProperties[key] = checkstyleProperties[key].replace('${workspaceFolder}', fs.realpathSync('.'));
	});

	if (checkstyleConfiguration === '') {
		https.get('https://raw.githubusercontent.com/checkstyle/checkstyle/master/src/main/resources/google_checks.xml', (res) => {
			var googleCheckstyle = [];

			res.on('data', (chunk) => googleCheckstyle.push(chunk));

			res.on('end', () => {
				const checkstylePath = `${storagePath}/checkstyle.xml`;

				try {
					fs.writeFileSync(checkstylePath, Buffer.concat(googleCheckstyle), { mode: 0o775 });
				} catch(e) {
					connection.console.error(`Unable to open ${checkstylePath}`);
				}

				checkstyleConfiguration = checkstylePath;

				getCheckstyleJar(checkstyleVersion);
				// Revalidate all open text documents
				documents.all().forEach(doc => validateDocument(doc.uri));
			});
		});
	} else {
		getCheckstyleJar(checkstyleVersion);
		// Revalidate all open text documents
		documents.all().forEach(doc => validateDocument(doc.uri));
	}
});

function parseOutput(output) {
	let regex = /^(?:\[[A-Z]*?\] )?(.*\.java):(\d+)(?::([\w \-]+))?: (warning:|)(.+)/;
	let diagnostics = [];

    // Split into lines
    let lines = output.split(/\r?\n/);
    for (let line of lines) {
		const match = line.match(regex);

		if (match) {
			let [file, lineNum, colNum, typeStr, mess] = match.slice(1, 6)
			
			connection.console.info(mess);

			diagnostics.push({
				severity: DiagnosticSeverity.Warning,
				range: {
					start: { line: Number(lineNum)-1, character: Number(colNum)},
					end: { line: Number(lineNum)-1, character: Number(colNum || Number.MAX_VALUE) }
				},
				message: mess,
				source: 'checkstyle'
			});
		}
	}

	return diagnostics
}

function validateDocument(uri) {
	let fsPath = Files.uriToFilePath(uri);
	if (!fsPath || !storagePath) {
		// checkstyle can only lint files on disk, save temp file
		return;
	}

	const checkStyleArgs = getCheckstyleArguments(fsPath);
	try {
		exec(getCmdAndArgs(checkStyleArgs), (error, stdout, stderr) => {
			if (stdout.lastIndexOf('Audit done.') != -1) { // Use lastindexof because the string will be at the end
				let diagnostics = parseOutput(stdout);
	
				// Send the computed diagnostics to VSCode.
				connection.sendDiagnostics({ uri, diagnostics });
			} else {
				connection.console.error(`Checkstyle failed with error code ${error.code}:\n${stdout + stderr}`);
			}
		});
	} catch (e) {
		connection.console.error(e.message);
	}
}

/**
 * Returns the command and arguments needed to run checkstyle.
 * @param extraArgs	Arguments to be passed to checkstyle
 */
function getCmdAndArgs(extraArgs) {
	let systemProperties = '';

	if (checkstyleProperties) {
		systemProperties = Object.keys(checkstyleProperties).map(key => `-D${key}=${checkstyleProperties[key]}`).join(' ');
	}

	return `java ${systemProperties} -jar ${createJarName(checkstyleVersion).replace(/\s/g, '\\ ')} ${extraArgs.map(arg => arg.replace(/\s/g, '\\ ')).join(' ')}`;
}

/**
 * Returns the set of arguments to pass to checkstyle.
 * @param file	The file to lint via checkstyle
 */
function getCheckstyleArguments(file) {
	if (checkstyleConfiguration) {
		return ['-c', checkstyleConfiguration, file];
	} else {
		return [file];
	}
}

function getCheckstyleJar(version) {
	// Wait until it's defined
	if (!storagePath) return;

	const filePath = createJarName(version);

	if(!fs.existsSync(filePath)) {
		connection.console.info(`Downloading checkstyle ${version} jar.`);
		https.get(`https://github.com/checkstyle/checkstyle/releases/download/checkstyle-${version}/checkstyle-${version}-all.jar`, (res) => {
			var body = '';

			res.on('data', (data) => {
				body += data.toString();
			});
			
			res.on('end', () => {
				const redirectUrl = body.replace('\n', '').match(/.*href="(.*)".*/)[1].replace(/amp;/g, '');

				connection.console.info(`Being redirected to ${redirectUrl}.`);

				https.get(redirectUrl, (res2) => {
					var jarBody = [];

					res2.on('data', (d) => {
						jarBody.push(d);
					});

					res2.on('end', () => {
						fs.writeFileSync(filePath, Buffer.concat(jarBody), { mode: 0o775 });
						connection.console.info(`Saved checkstyle jar to ${filePath}.`);
					});
				});
			});
		});
	}
}

function createJarName(version) {
	return `${storagePath}/checkstyle-${version}.jar`;
}

// This handler provides the initial list of the completion items.
connection.onCompletion(() => []);

documents.onDidChangeContent((event) => {
	validateDocument(event.document.uri);
})

documents.onDidOpen((event) => {
	validateDocument(event.document.uri);
})

documents.onDidSave((event) => {
	validateDocument(event.document.uri);
})

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
