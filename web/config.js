/**
 * Created by Daniels on 3/6/15.
 */
var redis = require('redis');
var REDIS = {
    host: '192.168.67.50',
    port: 6379
};
var redisClient = redis.createClient(REDIS.port, REDIS.host);
redisClient.on('ready', function(){
    console.log('Redis is ready on IP: ' + REDIS.host + ' Port: ' + REDIS.port);
});
redisClient.on('error', function(err){
    console.log('Redis error: ', err);
});

global.redisClient = redisClient;
exports.redisKeys = {
    agent: 'agent_clients'
};

exports.proxyRequestTimeout = 1000 * 5;

exports.fileListAPI = "http://{ip}:9090/list";
exports.downloadAPI = "http://192.168.67.50:9090/download?p=";
exports.tailStreamAPI = "http://{ip}:9090/tail?p={logname}";