const path = require('path');
const vscode = require('vscode');
const {
	LanguageClient,
	TransportKind,
	SettingMonitor
} = require('vscode-languageclient');

var client;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	// The server is implemented in node
	let serverModule = context.asAbsolutePath(
		path.join('server', 'src', 'server.js')
	);

	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	let serverOptions = {
		run : { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
	}

	// Options to control the language client
	let clientOptions = {
		// Register the server for plain text documents
		documentSelector: [ 'java' ],
		synchronize: {
			configurationSection: 'java'
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'java-checkstyle',
		'Java Checkstyle',
		serverOptions,
		clientOptions
	);

	context.subscriptions.push(new SettingMonitor(client, 'java.checkstyle.enabled').start());	
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
