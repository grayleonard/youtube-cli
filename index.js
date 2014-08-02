#!/usr/bin/env node

var fs = require('fs');
var googleauth = require('google-auth-cli');
var resumableupload = require('node-youtube-resumable-upload');
var GoogleTokenProvider = require('refresh-token').GoogleTokenProvider;
var argv = require('optimist').argv;
var secrets = require('./secrets.json');

var tokenFile = getUserHome() + "/.youtubecli";

var tokenProvider;
var tokens;
var metadata = {};
if((argv.f == null) || (argv.t == null) || (argv.d == null) || (argv.p) == null) {
		console.log("Usage: ./index.js -f [filename] -t [title] -d [description] -p [privacy (private/public)]");
		process.exit(code=0);
}
metadata = {snippet: { title: argv.t, description: argv.d }, status: { privacyStatus: argv.p }};

function getUserHome() {
	return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

//TODO: make function logic better
var loadTokens = function(callback) {
	fs.readFile(tokenFile, function(err, data) {
		if(!err) {
			tokens = JSON.parse(data);
			callback(tokens);
		} else {
			googleauth({
					access_type: 'offline',
					scope: 'https://www.googleapis.com/auth/youtube.upload'
				},
				{
					client_id: secrets.client_id,
					client_secret: secrets.client_secret,
					port: 3000
				},
				function(err, authClient, tokens) {
					fs.writeFileSync(tokenFile, JSON.stringify(tokens));
					callback(tokens);
				}
			);
		}
	});
}

loadTokens(function(result) {
	tokens = result;
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
			resumableUpload.filepath = argv.f;
			resumableUpload.metadata = metadata;
			resumableUpload.monitor = true;
			resumableUpload.initUpload(function(result) {
				console.log("Video uploaded!\r\n" + result);
				process.exit(code=0);
			});
		}
	});
});
