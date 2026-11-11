"""Bounded ADB helpers for the assigned MuMu instance; never select another device."""
import argparse
import json
import pathlib
import re
import subprocess
import time
import xml.etree.ElementTree as ET

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[3]
DEVICE = '127.0.0.1:16480'
CHAT = 'f0120000-0000-4000-8000-000000000012'

def adb(*args, input_text=None):
    result = subprocess.run(['adb', '-s', DEVICE, *args], input=input_text, capture_output=True, text=True, timeout=15)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return result.stdout.strip()

def sql(statement, database='files/SQLite/dologram.db'):
    return adb('shell', 'run-as', 'com.dologram.app', 'sqlite3', database, input_text=statement + '\n')

parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['status', 'fixture', 'open', 'chat', 'screen', 'tap', 'back', 'record', 'cleanup'])
parser.add_argument('values', nargs='*')
args = parser.parse_args()
if args.action == 'status':
    print('Boot:', adb('shell', 'getprop', 'sys.boot_completed'))
    print('Wi-Fi setting:', adb('shell', 'settings', 'get', 'global', 'wifi_on'))
    print('Fixture rows:', sql(f"select count(*) from cache_chats where chat_id='{CHAT}';"))
elif args.action == 'fixture':
    session = json.loads(sql("select value from catalystLocalStorage where key='sb-jsyqtfsidtfahytcwutp-auth-token';", 'databases/RKStorage'))
    uid = session['user']['id']
    chat = dict(chat_id=CHAT, created_at='2026-11-10T08:00:00Z', created_by=uid, direct_key=None, next_seq=1, title='Phase 12 local test', type='group')
    member = dict(chat_id=CHAT, user_id=uid, role='owner', joined_at='2026-11-10T08:00:00Z', last_read_seq=0, archived=False, muted_until=None)
    chat_json = json.dumps(chat).replace("'", "''")
    member_json = json.dumps(member).replace("'", "''")
    adb('shell', 'am', 'force-stop', 'com.dologram.app')
    sql(f"insert or replace into cache_chats(chat_id,payload) values('{CHAT}','{chat_json}'); insert or replace into cache_chat_members(chat_id,user_id,payload,last_read_seq) values('{CHAT}','{uid}','{member_json}',0);")
    adb('push', str(ROOT / 'apps/mobile/assets/logo/dologram_logo.png'), '/sdcard/Pictures/dologram-phase12.png')
    adb('push', str(HERE / 'sample.txt'), '/sdcard/Download/dologram-phase12.txt')
    adb('shell', 'am', 'broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE', '-d', 'file:///sdcard/Pictures/dologram-phase12.png')
    print('Inserted local-only fixture and test files.')
elif args.action == 'open':
    print(adb('reverse', 'tcp:8092', 'tcp:8092'))
    print(adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'exp+dologram://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8092', 'com.dologram.app'))
elif args.action == 'chat':
    print(adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', f'dologram://chat/{CHAT}', 'com.dologram.app'))
elif args.action == 'screen':
    label = args.values[0] if args.values else 'screen'
    if not label.replace('-', '').isalnum():
        raise ValueError('Invalid evidence filename')
    adb('shell', 'uiautomator', 'dump', '/sdcard/phase12-window.xml')
    document = adb('shell', 'cat', '/sdcard/phase12-window.xml')
    (HERE / (label + '.xml')).write_text(document, encoding='utf-8')
    for node in ET.fromstring(document).iter('node'):
        if node.get('text') or node.get('content-desc'):
            print(node.get('text'), '|', node.get('content-desc'), '|', node.get('bounds'))
    adb('shell', 'screencap', '-p', '/sdcard/phase12-screen.png')
    adb('pull', '/sdcard/phase12-screen.png', str(HERE / (label + '.png')))
elif args.action == 'tap':
    print(adb('shell', 'input', 'tap', str(int(args.values[0])), str(int(args.values[1]))))
elif args.action == 'back':
    print(adb('shell', 'input', 'keyevent', '4'))
elif args.action == 'record':
    hold = subprocess.Popen(['adb', '-s', DEVICE, 'shell', 'input', 'swipe', '786', '1815', '786', '1815', '7000'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(2)
    adb('shell', 'uiautomator', 'dump', '/sdcard/phase12-window.xml')
    document = adb('shell', 'cat', '/sdcard/phase12-window.xml')
    (HERE / 'recording-during-hold.xml').write_text(document, encoding='utf-8')
    for node in ET.fromstring(document).iter('node'):
        if node.get('text') or node.get('content-desc'):
            print(node.get('text'), '|', node.get('content-desc'), '|', node.get('bounds'))
    hold.communicate(timeout=12)
elif args.action == 'cleanup':
    adb('shell', 'am', 'force-stop', 'com.dologram.app')
    for message_id in sql(f"select temp_id from queue_items where chat_id='{CHAT}';").splitlines():
        if not re.fullmatch(r'[0-9a-fA-F-]{36}', message_id):
            raise ValueError('Unexpected fixture queue identity')
        adb('shell', 'run-as', 'com.dologram.app', 'rm', '-r', 'files/queued-attachments/' + message_id)
    sql(f"delete from pending_read_states where chat_id='{CHAT}'; delete from queue_items where chat_id='{CHAT}'; delete from cache_message_media where chat_id='{CHAT}'; delete from cache_messages where chat_id='{CHAT}'; delete from cache_chat_members where chat_id='{CHAT}'; delete from cache_chats where chat_id='{CHAT}';")
    adb('shell', 'rm', '-f', '/sdcard/Pictures/dologram-phase12.png', '/sdcard/Download/dologram-phase12.txt', '/sdcard/phase12-screen.png', '/sdcard/phase12-window.xml')
    print('Removed this phase\'s local-only fixture and test files.')
