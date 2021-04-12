var express = require("express");

var clientapp = express();
var path = require('path');
clientapp.use('/', express.static("public"));
clientapp.listen(29990);

clientapp.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/serverClient.html'));
});
clientapp.get('/login', function(req, res) {
    res.sendFile(path.join(__dirname + '/serverClientLogin.html'));
});
clientapp.get('/serverClient.css', function(req, res) {
    res.sendFile(path.join(__dirname + '/serverClient.css'));
});
clientapp.get('/serverClient.js', function(req, res) {
    res.sendFile(path.join(__dirname + '/serverClient.js'));
});
clientapp.get('/init_app.js', function(req, res) {
    res.sendFile(path.join(__dirname + '/init_app.js'));
});