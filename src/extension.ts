import * as vscode from 'vscode';

let intervalId: ReturnType<typeof setInterval>;
let timerInterval: ReturnType<typeof setInterval> | undefined;
let scoreBar: vscode.StatusBarItem;
let totalPoints: number = 0;
let currentPoints: number = 0;
let multiplyer = 1;

export function activate(context: vscode.ExtensionContext) {

	console.log('Keystroke Combo active');

	//Initialize settings
	let config = vscode.workspace.getConfiguration('keystrokeComboRad');
	let size: number = config.get<number>('size', 10);
	let countdownLength: number = config.get<number>("countdownLength", 5);
	let basePoints: number = config.get<number>("basePoints", 5);
	let largePoints: number = config.get<number>("largePoints", 5);
	let multiplyerAdd: number = config.get<number>("multiplyerAdd", 0.5);

	const brackets: string[] = ["(", "{", "["];

	//Message based on current multiplier
	scoreBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	scoreBar.text = `You're on fire!`;
	scoreBar.show();
	context.subscriptions.push(scoreBar);


	//Panel
	//TODO display page with points, multiplier and graphics and timer
	const panel = vscode.window.createWebviewPanel(
		'comboDisplay',
		'Combo',
		vscode.ViewColumn.Two,
		{}
	);

	panel.webview.html = `
  <html>
    <body style="background: black; color: gold; font-size: 48px; text-align: center">
      <p>KICKFLIP!</p>
      <p>x3 multiplier</p>
    </body>
  </html>
`;

	//Check if user live updated the settings
	vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('keystrokeComboRad')) {
			config = vscode.workspace.getConfiguration('keystrokeComboRad');
			size = config.get<number>('size', 10);
			countdownLength = config.get<number>("countdownLength", 5);
			basePoints = config.get<number>("basePoints", 5);
			largePoints = config.get<number>("largePoints", 10);
			multiplyerAdd = config.get<number>("multiplyerAdd", 0.5);
		}
	});

	//User altered document
	vscode.workspace.onDidChangeTextDocument((event) => {
		for (const change of event.contentChanges) {
			const text = change.text;
			//Deleting sustains combo wihtout adding points
			if (text === "") {
				startCountdown(countdownLength);
			} else if (text === "\n") {
				popUpPoints(largePoints, multiplyer, countdownLength, change.range);
			} else {
				if (brackets.includes(text)) {
					multiplyer += multiplyerAdd;
				}
				popUpPoints(basePoints, multiplyer, countdownLength, change.range);
			}
		}
	});



}

function popUpPoints(points: number, multiplyer: number, timerLength: number, range: vscode.Range) {
	console.log("Points: " + (points * multiplyer));
	startCountdown(timerLength);

	const flashDecoration = vscode.window.createTextEditorDecorationType({
		backgroundColor: 'rgba(255, 215, 0, 0.3)', // gold flash
		borderRadius: '3px'
	});

	// apply it to the last change
	const editor = vscode.window.activeTextEditor;
	if (editor) {
		editor.setDecorations(flashDecoration, [range]);

		// clear it after 300ms
		setTimeout(() => {
			editor.setDecorations(flashDecoration, []);
		}, 300);
	}
}


function startCountdown(timerLength: number) {

	if (timerInterval) { clearInterval(timerInterval); }

	timerInterval = setInterval(() => {
		timerLength = Math.max(0, timerLength - 0.1);

		if (timerLength <= 0) {
			clearInterval(timerInterval);
			dropCombo();
		}
	}, 100);
}

function dropCombo() {
	totalPoints += currentPoints;
	multiplyer = 1;
}


export function deactivate() {
	if (timerInterval) { clearInterval(timerInterval); }
}
