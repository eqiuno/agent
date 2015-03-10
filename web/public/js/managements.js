/**
 * Created by Daniels on 3/6/15.
 */
$().ready(function(){
    var data = window.data;
    var ip = window.ip || '127.0.0.1';
    if(!data) return false;
    data = typeof data != 'object'?JSON.parse(data):data;
    var contents = [];
    var el;

    function handleIPs(){
        for(var key in data){
            var dead = false;
            if((Number(data[key])+(1000 * 60 * 10)) <= +new Date()) dead = true;
            contents.push({ip: key, heartbeat:new Date(typeof data[key] == 'string'?Number(data[key]):data[key]).toString() , dead: dead});
        }
    };
    function handleLogs(){
        if(Array.isArray(data)) {
            for (var i = 0, len = data.length; i < len; i++) {
                var format = data[i].indexOf('.') >= 0 ? Array.prototype.splice.call(data[i].split('.'), -1):['false'];
                var display = true;
                if(format[0] === 'gz' || format[0] === 'bz2' || format[0] === 'tar' || format[0] === 'null') display = false;
                contents.push({'logname': data[i], ip: ip, display: display});
            }
        }
    };
    switch (window.tab){
        case 'handleIPs':el = '#ips';handleIPs();break;
        case 'handleLogs':el= '#filelist';handleLogs();break;
    }

    var vue = new Vue({
        el: el,
        data: {
            contents: contents
        }
    });
}());