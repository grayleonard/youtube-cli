#!/usr/bin/env node

var fs = require('fs');

var googleauth = require('google-auth-cli');
var resumableupload = require('node-youtube-resumable-upload');
var GoogleTokenProvider = require('refresh-token').GoogleTokenProvider;

var blessed = require('blessed');
var screen = blessed.screen();

screen.key(['q', 'C-c'], function(ch, key) {
  return process.exit(0);
});
screen.key(['escape'], function(ch, key) {
	menu.focus();
});

var secrets;

var appFolder = getUserHome() + "/.youtubecli/";
var tokenFile = "tokens.json";
var secretsFile = "secrets.json";
var tokenProvider;
var tokens;
var metadata = {};



//TODO: Figure out how to make this prettier
var menu = blessed.list({ parent: screen, top: 'center', left: '1%', width: '30%', height: '95%', keys: true, border: { type: 'line' }, style: { fg: 'white', hover: { bg: 'green' } } }); 
menu.setItems([ 'Set API Keys', 'Connect Accounts', 'Upload Video', 'Account List']);
 menu.prepend(new blessed.Text({ left: 2, content: ' Menu ' }));

var actionbox = blessed.box({ parent: screen, top: 'center', left: '32%', width: '67%', height: '95%', border: { type: 'line' } });

var clientscreen = blessed.form({ parent: screen, label: 'Set API Keys', top: 'center', left: '32%', keys: true, width: '67%', height: '95%', border: { type: 'line' } }); 

clientscreen._.client_id_input = blessed.textbox({ parent: clientscreen, keys: true, inputOnFocus: true, left: '5%', width: '90%', height: 3, top: '10%', name: 'client_id', label: 'Client ID', border: { type: 'line' } });

clientscreen._.client_secret_input = blessed.textbox({ parent: clientscreen, keys: true, inputOnFocus: true, left: '5%', width: '90%', height: 3, top: '25%', name: 'client_secret', label: 'Client Secret', border: { type: 'line' } });

clientscreen._.submit = blessed.button({ parent: clientscreen, mouse: true, keys: true, shrink: true, padding: { left: 1, right: 1 }, left: '5%', width: 15, top: '45%', name: 'submit', content: 'submit', style: { focus: { bg: 'blue', fg: 'white' }, hover: { bg: 'blue', fg: 'white' } }, border: { type: 'line' } });

clientscreen._.cancel = blessed.button({ parent: clientscreen, mouse: true, keys: true, shrink: true, padding: { left: 1, right: 1 }, left: '30%', width: 15, top: '45%', name: 'cancel', content: 'cancel', style: { focus: { bg: 'blue', fg: 'white' }, hover: { bg: 'blue', fg: 'white' } }, border: { type: 'line' } });

var connectscreen = blessed.form( { parent: screen, label: 'Connect Accounts', top: 'center', left: '32%', keys: true, width: '67%', height: '95%', border: { type: 'line' } });

connectscreen._.oauth = blessed.button({ parent: connectscreen, mouse: true, keys: true, shrink: true, padding: { left: 1, right: 1 }, left: '5%', width: 15, top: '45%', name: 'cancel', content: 'Oauth2', style: { focus: { bg: 'blue', fg: 'white' }, hover: { bg: 'blue', fg: 'white' } }, border: { type: 'line' } });

connectscreen._.cancel = blessed.button({ parent: connectscreen, mouse: true, keys: true, shrink: true, padding: { left: 1, right: 1 }, left: '30%', width: 15, top: '45%', name: 'cancel', content: 'cancel', style: { focus: { bg: 'blue', fg: 'white' }, hover: { bg: 'blue', fg: 'white' } }, border: { type: 'line' } });

connectscreen._.inputname = blessed.textbox({ parent: connectscreen, keys: true, inputOnFocus: true, left: '5%', width: '90%', height: 3, top: '25%', name: 'account_name', label: 'Account Identifier', border: { type: 'line' } });

var alertscreen = blessed.box({ parent: screen, width: '50%', height: '50%', content: '' });

var uploadscreen = blessed.box({ parent: screen, label: 'Upload', top: 'center', left: '32%', keys: true, width: '67%', height: '95%', border: { type: 'line' } }); 

uploadscreen._.accountlist = blessed.list({ parent: uploadscreen, label: 'Accounts', top:'5%', left: '5%', keys: true, width: '30%', height: '35%', border: { type: 'line' }, style: { fg: 'white', hover: { bg: 'green' }}});

uploadscreen._.filemanager = blessed.filemanager({ parent: uploadscreen, label: 'Choose a file:', top: 'center', left: '40%', keys: true, width: '60%', height: '95%', border: { type: 'line' }, style: { fg: 'white', hover: { bg: 'green' }}} );

uploadscreen._.uploadprogressbar = blessed.progressbar({
	parent: uploadscreen, label: 'Progress', top: '70%', left: '5%', keys: false, width: '80%', height: '15%', border: { type: 'line' }, orientation: 'horizontal', barFg: "#0055FF", barBg: 'white', filled: 0});

var uploadAccount = "";

uploadscreen._.accountlist.on('select', function(selected) {
	uploadAccount = selected.content;
	uploadscreen._.filemanager.focus();
});

uploadscreen._.filemanager.cwd = appFolder;
uploadscreen._.filemanager.refresh();

var uploadFile = "";
uploadscreen._.filemanager.on('file', function(selected) {
	uploadFile = selected;
	initUpload(uploadFile, loadTokens()[uploadAccount]);
});
menu.on('select', function(selected) {
	if(selected.content == "Set API Keys") {
		hideAll();
		clientscreen._.client_id_input.focus();
		clientscreen.show();
	}
	if(selected.content == "Connect Accounts") {
		hideAll();
		connectscreen.show();
		connectscreen._.inputname.focus();
	}
	if(selected.content == "Upload Video") {
		hideAll();
		uploadscreen.show();
		uploadscreen._.accountlist.focus();
		getAccounts();
	}
	actionbox.setContent(selected.content);
	screen.render();
});

clientscreen._.submit.on('press', function() {
	clientscreen.submit();
});

clientscreen._.cancel.on('press', function() {
	clientscreen.cancel();
});

connectscreen._.oauth.on('press', function() {
	connectscreen.submit();
});

connectscreen._.cancel.on('press', function() {
	connectscreen.cancel();
});

connectscreen.on('submit', function(data) {
	connectAccountInit(data.account_name);
	menu.focus();
});
clientscreen.on('submit', function(data) {
	saveClientKeys(data);
	actionbox.setContent("Saved Client Keys!");
	screen.append(actionbox);
	menu.focus();
});

clientscreen.on('cancel', function() {
	menu.focus();
});

connectscreen.on('cancel', function() {
	menu.focus();
});

function initApp() {
	screen.append(menu);
	screen.append(actionbox);
	screen.append(clientscreen);
	screen.append(connectscreen);
	clientscreen.hide();
	connectscreen.hide();
	actionbox.show();
	menu.focus();
	menu.select(0);
	screen.render();
	console.log = function(){};
	if(checkAppFolder()) {
		secrets = require(appFolder + secretsFile);
	}
}

initApp();

function getUserHome() {
	return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

function hideAll() {
	actionbox.hide();
	clientscreen.hide();
	connectscreen.hide();
}

function checkAppFolder() {
	try {
		fs.readdirSync(appFolder)
		return true;
	} catch(e) {
		fs.mkdirSync(appFolder);
		return true;
	}
	return false;
}

function saveClientKeys(data) {
	if(checkAppFolder()) {
		var jsonString = JSON.stringify(data);
		fs.writeFileSync(appFolder + secretsFile, jsonString);
	}
}

function connectAccountInit(name) {
	googleauth({
	
		access_type: 'offline',
		scope: 'https://www.googleapis.com/auth/youtube'
	},
	{
		client_id: secrets.client_id,
		client_secret: secrets.client_secret,
		port: 3000
	},
	function(err, authClient, tokens) {
		saveAccountTokens(name, tokens);
	});
}

function loadTokens() {
	try {
		return JSON.parse(fs.readFileSync(appFolder + tokenFile));
	} catch(e) {
		return {};
	}
}
function saveAccountTokens(name, tokens) {
	var savedTokens = loadTokens();
	savedTokens[name] = tokens;
	console.log(savedTokens);
	fs.writeFileSync(appFolder + tokenFile, JSON.stringify(savedTokens));
	actionbox.content = "You can now use the account: " + name;
	hideAll();
	actionbox.show();
	screen.render();
}

function getAccounts() {
	var accounts = loadTokens();
	var accountList = [];
	for(accountName in accounts) {
		accountList.push(accountName);
	}
	uploadscreen._.accountlist.setItems(accountList);
}

function initUpload(file, tokens) {
	tokenProvider = new GoogleTokenProvider({
		refresh_token: tokens.refresh_token,
		client_id: secrets.client_id,
		client_secret: secrets.client_secret
	});
	tokenProvider.getToken(function(err, token) {
		if(!err) {
			tokens.access_token = token; //Set refreshed access_token
			var resumableUpload = new resumableupload();
			resumableUpload.tokens = tokens;
			resumableUpload.filepath = file;
			resumableUpload.metadata = metadata;
			resumableUpload.monitor = true;
			resumableUpload.eventEmitter.on('progress', function(progress) {
				var numStrings = progress.split("/");
				var numer = parseInt(numStrings[0]);
				var denom = parseInt(numStrings[1]);
				var percentage = Math.round(numer / denom);
				uploadscreen._.uploadprogressbar.setProgress(percentage);
				screen.render();
			});
			resumableUpload.initUpload(function(result) {
				console.log("Video uploaded!\r\n" + result);
				process.exit(code=0);
			});
		}
	});
}

