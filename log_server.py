__author__ = 'ianl'

from gevent import monkey, queue, sleep, spawn, subprocess
monkey.patch_all()

import argparse
from bottle import get, request, response, run, post, static_file, error
import redis
import time
import os
import json
import mimetypes

count = 1
heartbeat_interval = 20 * 1000
heartbeat_key = 'agent_clients'
read_root = '/var/log/nginx'
write_root = '/home/ianl/writable'
redis_host = 'localhost'
redis_port = 6379
port = 9090


def _tail(q, f):
    def __tail():
        p = subprocess.Popen('tail -f %s' % f, stdout=subprocess.PIPE, shell=True)
        while True:
            next_line = p.stdout.readline()
            if next_line == '' and p.poll() is not None:
                break
            q.put(next_line)
            sleep(0.5)
    spawn(__tail)

@get('/list')
def list_file():
    result = []
    for root, dirs, files in os.walk(read_root):
        for f in files:
            result.append(f)
    response.content_type = 'application/json'
    return json.dumps(result)

@get('/tail')
def tail():
    f = os.path.join(read_root, request.query.p)

    if request.query.p is None or len(request.query.p) < 1 or not os.path.exists(f):
        return dict(success=0, msg='missing tail file, tail?p={tail_file} or tail file is invalid:%s' % request.query.p)

    q = queue.Queue()
    _tail(q, f)
    return q


@get('/download')
def download():
    path = request.query.p
    return static_file(path, root=read_root, download=path)


@post('upload')
def upload():
    upload_file = request.files.get('upload')
    _, name = os.path.split(upload_file)
    upload_file.save(os.path.join(write_root, name))


def parse_command_line():
    parser = argparse.ArgumentParser()
    parser.add_argument('-l', '--read_dir', help='base read dir', default='/var/log/nginx')
    parser.add_argument('-w', '--write_dir', default='/home/ianl/writable', help='base write host')
    parser.add_argument('-r', '--redis', default='localhost:6379', help='redis url')
    parser.add_argument('-p', '--port', default=9090, type=int, help='server listen port')
    args = parser.parse_args()

    if args.read_dir is not None:
        global read_root
        read_root = args.read_dir

    if args.write_dir is not None:
        global write_root
        write_root = args.write_dir

    if args.redis is not None:
        global redis_host, redis_port
        redis_arg = args.redis
        h, p = redis_arg.split(':')
        redis_host = h
        redis_port = int(p)

    if args.port is not None:
        global port
        port = int(args.port)


def get_local_ip():
    import os
    import socket

    if os.name != "nt":
        import fcntl
        import struct

        def get_interface_ip(ifname):
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            return socket.inet_ntoa(fcntl.ioctl(s.fileno(), 0x8915, struct.pack('256s',
                                                                                ifname[:15]))[20:24])

    def get_lan_ip():
        ip = socket.gethostbyname(socket.gethostname())
        if ip.startswith("127.") and os.name != "nt":
            interfaces = [
                "eth0",
                "eth1",
                "eth2",
                "wlan0",
                "wlan1",
                "wifi0",
                "ath0",
                "ath1",
                "ppp0",
                ]
            for ifname in interfaces:
                try:
                    ip = get_interface_ip(ifname)
                    break
                except IOError:
                    pass
        return ip

    return get_lan_ip()


def ts():
    return int(int(time.time()) * 1000)


def register(redis, ip):
    def loop():
        while True:
            redis.hset(heartbeat_key, ip, ts())
            sleep(10)
    spawn(loop)

@error(500)
def internal(error):
    print error
    return dict(msg=error)


if __name__ == '__main__':
    parse_command_line()
    redis_client = redis.Redis(host=redis_host, port=redis_port)
    register(redis_client, get_local_ip())
    # app = bottle.app()
    # app.catchall = False #Now most exceptions are re-raised within bottle.
    # myapp = DebuggedApplication(app) #Replace this with a middleware of your choice (see below)
    run(host=get_local_ip(), port=port, server='gevent')
