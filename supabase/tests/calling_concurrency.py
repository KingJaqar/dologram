"""Run only against the disposable local calling verification container."""
import argparse
import json
import subprocess
from uuid import uuid4

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("container", help="Disposable local Supabase database container")
CONTAINER = parser.parse_args().container
if not CONTAINER.startswith("supabase_db_dologram-calling-phase01-"):
    parser.error("Use a dedicated dologram-calling-phase01 Supabase project")
PSQL = ["docker", "exec", "-i", CONTAINER, "psql", "-XqAt", "-U", "postgres", "-v", "ON_ERROR_STOP=1"]
ACTOR = "set local role service_role;"
CALLER, CALLEE, PEER = (str(uuid4()) for _ in range(3))
CHAT, CHAT2 = str(uuid4()), str(uuid4())
CALLER_SESSION, CALLEE_SESSION = str(uuid4()), str(uuid4())

def db(sql):
    return subprocess.run(PSQL, input=sql, text=True, capture_output=True, check=True, timeout=12).stdout.strip()

def start_session(label):
    return subprocess.Popen(
        [*PSQL, "-c", f"set application_name = '{label}'; set statement_timeout = '8s'; "
         "set idle_in_transaction_session_timeout = '12s'", "-f", "-"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )

def send(process, command):
    process.stdin.write(command + "\n")
    process.stdin.flush()

def race(label, first_sql, second_sql):
    first = start_session(f"calling-{label}-first")
    second = None
    try:
        send(first, f"begin; {ACTOR} {first_sql};")
        first_result = first.stdout.readline().strip()
        if not first_result:
            raise RuntimeError(first.stderr.read())
        second = start_session(f"calling-{label}-second")
        send(second, f"begin; {ACTOR} {second_sql}; commit;")
        waiting = db(
            "select pg_sleep(0.75); select count(*) from pg_stat_activity "
            f"where application_name = 'calling-{label}-second' and wait_event_type = 'Lock';"
        )
        assert waiting == "1", (label, waiting, first_result)
        send(first, "commit;")
        first.communicate(timeout=10)
        second_out, second_err = second.communicate(timeout=10)
        assert first.returncode == 0, label
        print(f"{label}: second transaction observed waiting on a PostgreSQL lock")
        return json.loads(first_result), second_out, second_err
    finally:
        for process in (first, second):
            if process and process.poll() is None:
                process.kill()
                process.communicate(timeout=3)

def create(actor, chat, session, request_id=None):
    return f"select public.call_create('{actor}','{chat}','voice','{request_id or uuid4()}','{session}')"

def transition(actor, target, action, session):
    return f"select public.call_transition('{actor}','{target}','{action}','{uuid4()}','{session}')"

def status(result):
    return result["call"]["status"]

db(f"""
insert into auth.users(id,email) values
('{CALLER}','{CALLER}@example.invalid'),('{CALLEE}','{CALLEE}@example.invalid'),('{PEER}','{PEER}@example.invalid');
insert into public.chats(chat_id,type,created_by) values ('{CHAT}','direct','{CALLER}'),('{CHAT2}','direct','{PEER}');
insert into public.chat_members(chat_id,user_id,role) values
('{CHAT}','{CALLER}','owner'),('{CHAT}','{CALLEE}','member'),
('{CHAT2}','{PEER}','owner'),('{CHAT2}','{CALLEE}','member');
update private.call_settings set calling_enabled = true, create_limit = 100, ring_seconds = 30;
""")

same_create = create(CALLER, CHAT, CALLER_SESSION)
first, other, error = race("duplicate", same_create, same_create)
assert not error and first["call"]["callId"] == json.loads(other)["call"]["callId"]
target = first["call"]["callId"]
assert db(f"select count(*) from private.call_user_reservations where call_id = '{target}';") == "2"
db(f"begin; {ACTOR} {transition(CALLER, target, 'cancel', CALLER_SESSION)}; commit;")

first, other, error = race("opposite", create(CALLER, CHAT, CALLER_SESSION), create(CALLEE, CHAT, CALLEE_SESSION))
assert not error and status(first) == "ringing" and json.loads(other)["call"]["endReason"] == "busy"
target = first["call"]["callId"]
db(f"begin; {ACTOR} {transition(CALLER, target, 'cancel', CALLER_SESSION)}; commit;")

first, other, error = race("shared-callee", create(CALLER, CHAT, CALLER_SESSION), create(PEER, CHAT2, str(uuid4())))
assert not error and status(first) == "ringing" and json.loads(other)["call"]["endReason"] == "busy"
target = first["call"]["callId"]

first, _, error = race("accept", transition(CALLEE, target, "accept", CALLEE_SESSION),
                       transition(CALLEE, target, "accept", str(uuid4())))
assert status(first) == "accepted" and "CALL_ALREADY_HANDLED" in error
first, other, error = race("hangup", transition(CALLER, target, "end", CALLER_SESSION),
                            transition(CALLEE, target, "end", CALLEE_SESSION))
assert not error and status(first) == "ended" and first["call"]["revision"] == json.loads(other)["call"]["revision"]
assert db(f"select count(*) from private.call_user_reservations where call_id = '{target}';") == "0"
target = json.loads(db(f"begin; {ACTOR} {create(CALLER, CHAT, CALLER_SESSION)}; commit;"))["call"]["callId"]
_, _, error = race(
    "expiry",
    f"update public.calls set created_at = clock_timestamp() - interval '31 seconds', "
    f"ring_expires_at = clock_timestamp() - interval '1 second' where call_id = '{target}' returning to_jsonb(call_id)",
    transition(CALLEE, target, "accept", CALLEE_SESSION),
)
assert "CALL_EXPIRED" in error

worker = start_session("calling-worker-first")
try:
    send(worker, f"begin; {ACTOR} select public.call_worker_tick(1);")
    first_claim = json.loads(worker.stdout.readline())
    other_claim = json.loads(db(f"begin; {ACTOR} select public.call_worker_tick(1); commit;"))
    assert len(first_claim) == len(other_claim) == 1, (first_claim, other_claim)
    assert first_claim[0]["job_id"] != other_claim[0]["job_id"], "Overlapping workers claimed the same job"
    send(worker, "commit;")
    worker.communicate(timeout=10)
    assert worker.returncode == 0
finally:
    if worker.poll() is None:
        worker.kill()
        worker.communicate(timeout=3)

assert db(f"select status from public.calls where call_id = '{target}';") == "missed"
print("Six blocked-transaction races and overlapping worker claims passed")
