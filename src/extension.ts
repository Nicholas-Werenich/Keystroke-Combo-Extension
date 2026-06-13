/*
	VS code extension to make programming more fun. Inpsired combo system from Skate 3.
	Made by: Nicholas Werenich

	Mechanics:
		Typing adds points
		New line adds larger points
		Deleting sustains combo without adding points
		Opening brackets increases multiplier

		Notifications for points and combo break
		Inline effects while typing
		Side HTML panel to show combo countdown and points
		Live updating settings
*/


import * as vscode from 'vscode';

let intervalId: ReturnType<typeof setInterval>;
let timerInterval: ReturnType<typeof setInterval> | undefined;
let scoreBar: vscode.StatusBarItem;
let totalPoints: number = 0;
let currentPoints: number = 0;
let multiplier: number = 1;

//Side panel to display points and countdown
let panel = vscode.window.createWebviewPanel(
	'comboDisplay',
	'Combo',
	vscode.ViewColumn.Two,
	{ enableScripts: true }
);
let resolveProgress: (() => void) | undefined;

//Togglable effects
let notificationDisplay: boolean, progressBarDisplay: boolean, inlineDisplay: boolean;

//Inline VS code decoration
const flashDecoration = vscode.window.createTextEditorDecorationType({
	backgroundColor: 'rgba(255,215,0,0.3)',
	border: '1px solid gold',
	borderRadius: '3px',
	isWholeLine: true
});

//Start function
export function activate(context: vscode.ExtensionContext) {

	console.log('Keystroke Combo is now active');

	//Initialize settings
	let config = vscode.workspace.getConfiguration('keystrokeComboRad');
	let size: number = config.get<number>('size', 10);
	let countdownLength: number = config.get<number>("countdownLength", 3);
	let basePoints: number = config.get<number>("basePoints", 5);
	let largePoints: number = config.get<number>("largePoints", 10);
	let multiplierAdd: number = config.get<number>("multiplierAdd", 0.5);
	notificationDisplay = config.get<boolean>("notificationDisplay", true);
	progressBarDisplay = config.get<boolean>("progressBarDisplay", true);
	inlineDisplay = config.get<boolean>("inlineDisplay", true);

	//Brackets in pairs due to autocomplete
	const brackets: string[] = ["()", "{}", "[]"];

	//Message based on current multiplier
	// scoreBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	//Switch statment for thresholds
	// scoreBar.text = `You're on fire!`;
	// scoreBar.show();
	// context.subscriptions.push(scoreBar);

	//Side panel setup
	const fs = require('fs');
	const htmlPath = require('path').join(context.extensionPath, 'src', 'panel.html');
	panel.webview.html = fs.readFileSync(htmlPath, 'utf8');


	//Check if user live updated the settings
	vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('keystrokeComboRad')) {
			config = vscode.workspace.getConfiguration('keystrokeComboRad');
			size = config.get<number>('size', 10);
			countdownLength = config.get<number>("countdownLength", 3);
			basePoints = config.get<number>("basePoints", 5);
			largePoints = config.get<number>("largePoints", 10);
			multiplierAdd = config.get<number>("multiplierAdd", 0.5);

			notificationDisplay = config.get<boolean>("notificationDisplay", true);
			progressBarDisplay = config.get<boolean>("progressBarDisplay", true);
			inlineDisplay = config.get<boolean>("inlineDisplay", true);

			panel.webview.postMessage({
				type: "setup",
				time: countdownLength
			});
		}
	});

	//User altered document
	vscode.workspace.onDidChangeTextDocument((event) => {
		for (const change of event.contentChanges) {
			const text = change.text;

			vscode.window.showWarningMessage(change.text);

			if (text === "\n" || text === '\r\n') {
				popUpPoints(largePoints, multiplier, countdownLength, change.range);
			} else if (text === "") {
				startCountdown(countdownLength);
			} else {
				//Brackets add a multiplier
				if (brackets.includes(text)) {
					multiplier += multiplierAdd;
					vscode.window.showWarningMessage('COMBO x' + multiplier);
				}
				popUpPoints(basePoints, multiplier, countdownLength, change.range);
			}
		}
	});

	console.log(countdownLength);

	//Setup panel after initializing
	setTimeout(() => {
		panel.webview.postMessage({
			type: "setup",
			time: countdownLength
		});
	}, 500);

}

//Manage each points added
function popUpPoints(points: number, multiplier: number, timerLength: number, range: vscode.Range) {
	console.log("Points: " + (points * multiplier));
	currentPoints += points * multiplier;

	//Update panel
	panel.webview.postMessage({
		type: "update",
		time: timerLength,
		multiplier: multiplier,
		currentPoints: currentPoints,
		totalPoints: totalPoints
	});

	startCountdown(timerLength);

	if (notificationDisplay) {
		vscode.window.showInformationMessage("+" + points);
	}

	//Line display
	const editor = vscode.window.activeTextEditor;
	if (editor && inlineDisplay) {
		editor.setDecorations(flashDecoration, [range]);

		setTimeout(() => {
			editor.setDecorations(flashDecoration, []);
			flashDecoration.dispose();
		}, 300);
	}

	//Progress loading bar at bottom
	if (progressBarDisplay) {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			title: 'COMBO ACTIVE'
		}, async () => {
			await new Promise<void>((resolve) => {
				resolveProgress = resolve;
			});
		});
	}
}

//Countdown till current combo ends
function startCountdown(timerLength: number) {

	if (timerInterval) { clearInterval(timerInterval); }

	//Controls rate of timer update
	let smoothness = 20;

	//Update timer till reaches 0
	timerInterval = setInterval(() => {
		timerLength = Math.max(0, timerLength - smoothness / 1000);

		panel.webview.postMessage({
			type: "timer",
			time: timerLength
		});

		if (timerLength <= 0) {
			clearInterval(timerInterval);
			dropCombo();
		}

	}, smoothness);
}

//Combo ends when timer reaches 0
function dropCombo() {
	totalPoints += currentPoints;
	currentPoints = 0;
	multiplier = 1;

	// console.log("Dropped Combo: " + totalPoints);
	// vscode.workspace.getConfiguration('workbench').update(
	// 	'colorCustomizations',
	// 	{ "editor.background": "#131718" },
	// 	vscode.ConfigurationTarget.Global
	// );

	panel.webview.postMessage({
		type: "update",
		time: 0,
		multiplier: multiplier,
		currentPoints: currentPoints,
		totalPoints: totalPoints
	});

	if (notificationDisplay) {
		vscode.window.showErrorMessage('BAILED!');
	}

	//Close progress bar
	if (resolveProgress) {
		resolveProgress();
		resolveProgress = undefined;
	}
}

//End processes
export function deactivate() {
	if (timerInterval) { clearInterval(timerInterval); }
	if (resolveProgress) {
		resolveProgress();
	}
	//Reset settings if changed decoration
}
