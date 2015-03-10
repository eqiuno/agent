var express = require('express');
var router = express.Router();
var cm = require('./common');
var cfg = require('../config');
var async = require('async');
var request = require('request');
var fs = require('fs');
var http = require('http');
var _ = require('underscore');


var tab = {ip: 'handleIPs', log:'handleLogs'};

var index = function(req, res, next) {
    res.redirect('/getips');
};

var tailStream = function(req, res, next){
    var ip = req.query['ip'] || '127.0.0.1';
    var logname = req.query['logname'] || 'access.log';
    var str = String.prototype.split.call(logname, '.');
    var arr = Array.prototype.splice.call(str, -1);
    var formatList = ['gz', 'bz2', 'tar'];
    if(_.contains(formatList, arr[0])) return next({code:1, message:'This file cannot read !'});
    var url = cfg.tailStreamAPI.replace('{ip}', ip);
    var options = { url: url.replace('{logname}', logname), method: 'get' };

    request(options).on('data', function(chunk){
        res.write(chunk);
    }).on('error', function(err){
        console.log(err);
    }).on('end',function(){
        res.end();
    });

};

var getIpList = function (req, res, next) {
    async.waterfall([
        function(cb){
            redisClient.hgetall(cfg.redisKeys.agent, cb);
        },
        function(data, cb){
            cb(null, data);
        }
    ], function(err, results){
        if(err) return next(err);
        res.render('ips', {data: results, tab: tab['ip']});
    });
};

var getFileList = function(req, res, next){
    var ip = req.query['ip'];
    if(!ip) return next(new Error('No ip'));
    async.waterfall([
        function(cb){
            var options = { url: cfg.fileListAPI.replace('{ip}', ip), method: 'get', timeout: cfg.proxyRequestTimeout };
            request(options, cb);
        },
        function(resp, body, cb){
            try{
                body = JSON.parse(body);
            }catch (e){
                return cb(e);
            }
            cb(null, body);
        }
    ],function(err, results){
        if(err) return next(err);
        res.render('filelist', {data: results, tab: tab['log'], desIp:ip});
    });

};

var download = function(req, res, next){
    var filename = req.query['filename'];
    if(!filename) return next(new Error('No log name'));


    var options = { url: cfg.downloadAPI + filename, method: 'get', timeout: cfg.proxyRequestTimeout };
    return request(options).pipe(res);
};
var APIs = [
    {
        path: '/',
        method: 'get',
        describe: 'index page',
        handler: [index]
    },
    {
        path: '/getips',
        method: 'get',
        describe: 'get all the ips of host',
        handler: [cm.pre, getIpList]
    },
    {
        path: '/filelist',
        method: 'get',
        describe: 'get all the names of log',
        handler: [getFileList]
    },
    {
        path: '/download',
        method: 'get',
        describe: 'get a log file',
        handler: [download]
    },
    {
        path: '/tailstream',
        method: 'get',
        describe: 'tail a log file',
        handler: [tailStream]
    }
];

APIs.forEach(function(item){
    var path = item.path;
    var handler = item.handler;
    var method = item.method;

    var fn = router[method];
    if(fn && fn instanceof Function){
        fn.call(router, path, handler);
    }
});

module.exports = router;
