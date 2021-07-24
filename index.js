"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express = require("express");
var fs = require("fs");
var path = require("path");
var dayjs = require('dayjs');
var app = express();
app.use(express.static('static'));
app.set('views', './views');
app.set('view engine', 'pug');
app.get('/about', function (_req, res) {
    res.render('about.pug');
});
app.get('/', function (_req, res) {
    var blogsDirPath = path.resolve(__dirname, './static/blogs');
    var blogs = fs.readdirSync(blogsDirPath);
    var articles = blogs.map(function (name) {
        var jsonPath = path.resolve(blogsDirPath, "./" + name + "/info.json");
        var res = JSON.parse(fs.readFileSync(jsonPath, { encoding: 'utf8' }));
        res.createTime = dayjs(res.createTime).format('YYYY-MM-DD');
        res.updateTime = dayjs(res.updateTime).format('YYYY-MM-DD');
        return res;
    }).sort(function (a, b) {
        return dayjs(a.createTime).isAfter(b.createTime) ? -1 : 1;
    });
    res.render('posts', { articles: articles });
});
app.get('/timeline', function (_req, res) {
    var items = JSON.parse(fs.readFileSync(path.resolve(__dirname, './timeline.json'), { encoding: 'utf8' }));
    var order = Object.keys(items).sort(function (a, b) { return a > b ? -1 : 1; });
    res.render('timeline', { items: items, order: order });
});
app.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});
